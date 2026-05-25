from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql import Select

from app.config import ORDER_SERVICE_INTERNAL_TOKEN
from app.db import SessionLocal
from app.models import Order, OrderItem
from app.schemas import (
    AdminOrderCreate,
    ChannelBreakdownPoint,
    DeliveryQuoteRequest,
    DeliveryQuoteResponse,
    OrderCreate,
    OrderMetrics,
    OrderOut,
    OrderReceiptUpdate,
    OrderStatusOut,
    StaffSalesPoint,
    TopProductPoint,
    TrendPoint,
)
from app.services.delivery import calculate_delivery_fee
from app.services.order import create_admin_order, create_order, update_order

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _date_bounds(start: date | None, end: date | None) -> tuple[datetime | None, datetime | None]:
    if start:
        start_dt = datetime.combine(start, time.min)
    else:
        start_dt = None
    if end:
        end_dt = datetime.combine(end, time.max)
    else:
        end_dt = None
    return start_dt, end_dt


def _apply_date_filter(query: Select, start: date | None, end: date | None) -> Select:
    start_dt, end_dt = _date_bounds(start, end)
    if start_dt:
        query = query.filter(Order.created_at >= start_dt)
    if end_dt:
        query = query.filter(Order.created_at <= end_dt)
    return query


def _normalize_phone(value: str | None) -> str:
    digits = ''.join(char for char in str(value or '') if char.isdigit())
    if digits.startswith('254') and len(digits) >= 12:
        return digits[-12:]
    if digits.startswith('0') and len(digits) >= 10:
        return f'254{digits[-9:]}'
    if len(digits) == 9:
        return f'254{digits}'
    return digits


@router.post('/orders')
async def create_order_endpoint(payload: OrderCreate):
    return await create_order(payload.model_dump())


@router.post('/admin/orders')
async def create_admin_order_endpoint(payload: AdminOrderCreate):
    return await create_admin_order(payload.model_dump())


@router.post('/orders/delivery-quote', response_model=DeliveryQuoteResponse)
def delivery_quote(payload: DeliveryQuoteRequest):
    try:
        fee = calculate_delivery_fee(payload.lat, payload.lng)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Failed to calculate delivery fee: {exc}') from exc
    return DeliveryQuoteResponse(fee=fee)


@router.get('/orders', response_model=list[OrderOut])
def list_orders(
    status: str | None = None,
    channel: str | None = None,
    created_by: str | None = None,
    q: str | None = Query(None, alias='q'),
    start: date | None = Query(None, alias='from'),
    end: date | None = Query(None, alias='to'),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Order).options(selectinload(Order.items))
    if status:
        query = query.filter(Order.status == status)
    if channel:
        query = query.filter(Order.channel == channel)
    if created_by:
        query = query.filter(Order.created_by.ilike(f'%{created_by.strip()}%'))
    if q:
        like = f'%{q.strip()}%'
        query = (
            query.outerjoin(Order.items)
            .filter(
                or_(
                    Order.phone.ilike(like),
                    Order.receipt.ilike(like),
                    Order.invoice_number.ilike(like),
                    Order.external_tx_id.ilike(like),
                    Order.created_by.ilike(like),
                    OrderItem.item_name.ilike(like),
                )
            )
            .distinct()
        )
    query = _apply_date_filter(query, start, end)
    return (
        query.order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get('/orders/{order_id}/status', response_model=OrderStatusOut)
def get_order_status(order_id: int, phone: str = Query(...), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')

    provided_phone = _normalize_phone(phone)
    order_phone = _normalize_phone(order.phone)
    if not provided_phone or provided_phone != order_phone:
        raise HTTPException(status_code=403, detail='Order lookup not authorized')

    return OrderStatusOut(
        order_id=order.id,
        status=order.status,
        amount=float(order.amount or 0.0),
        payment_method=order.payment_method,
        invoice_number=order.invoice_number,
        receipt=order.receipt,
        receipt_url=order.receipt_url,
    )


@router.patch('/orders/{order_id}/receipt')
def update_order_receipt(
    order_id: int,
    payload: OrderReceiptUpdate,
    x_service_token: str | None = Header(default=None, alias='X-Service-Token'),
):
    if ORDER_SERVICE_INTERNAL_TOKEN and x_service_token != ORDER_SERVICE_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail='Unauthorized service request')

    update_order(order_id, {'receipt_url': payload.receipt_url})
    return {'status': 'updated'}


@router.get('/orders/metrics', response_model=OrderMetrics)
def order_metrics(
    days: int = 7,
    channel: str | None = None,
    created_by: str | None = None,
    start: date | None = Query(None, alias='from'),
    end: date | None = Query(None, alias='to'),
    db: Session = Depends(get_db),
):
    if start or end:
        start_date = start or (end - timedelta(days=6) if end else date.today() - timedelta(days=6))
        end_date = end or date.today()
    else:
        end_date = date.today()
        start_date = end_date - timedelta(days=max(days - 1, 0))

    start_dt, end_dt = _date_bounds(start_date, end_date)

    base_query = db.query(Order).filter(Order.created_at >= start_dt, Order.created_at <= end_dt)
    if channel:
        base_query = base_query.filter(Order.channel == channel)
    if created_by:
        base_query = base_query.filter(Order.created_by.ilike(f'%{created_by.strip()}%'))

    total_orders = base_query.count()
    paid_orders = base_query.filter(Order.status == 'PAID').count()
    failed_orders = base_query.filter(Order.status == 'FAILED').count()
    pending_orders = base_query.filter(Order.status.in_(['PENDING', 'STK_SENT'])).count()

    revenue_total = (
        base_query.filter(Order.status == 'PAID')
        .with_entities(func.coalesce(func.sum(Order.amount), 0.0))
        .scalar()
        or 0.0
    )

    success_rate = (paid_orders / total_orders * 100.0) if total_orders else 0.0

    paid_order_query = db.query(Order).filter(Order.status == 'PAID', Order.created_at >= start_dt, Order.created_at <= end_dt)
    if channel:
        paid_order_query = paid_order_query.filter(Order.channel == channel)
    if created_by:
        paid_order_query = paid_order_query.filter(Order.created_by.ilike(f'%{created_by.strip()}%'))

    revenue_rows = dict(
        paid_order_query.with_entities(func.date(Order.created_at), func.coalesce(func.sum(Order.amount), 0.0))
        .group_by(func.date(Order.created_at))
        .all()
    )

    count_rows = dict(
        base_query.with_entities(func.date(Order.created_at), func.count(Order.id))
        .group_by(func.date(Order.created_at))
        .all()
    )

    revenue_trend: list[TrendPoint] = []
    cursor = start_date
    while cursor <= end_date:
        revenue_trend.append(
            TrendPoint(
                date=cursor.isoformat(),
                revenue=float(revenue_rows.get(cursor, 0.0)),
                count=int(count_rows.get(cursor, 0)),
            )
        )
        cursor += timedelta(days=1)

    sales_per_staff_rows = (
        db.query(
            func.coalesce(Order.created_by, 'system').label('staff'),
            func.count(Order.id).label('sales_count'),
            func.coalesce(func.sum(Order.amount), 0.0).label('revenue'),
        )
        .filter(
            Order.status == 'PAID',
            Order.channel == 'admin',
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
        )
        .group_by(func.coalesce(Order.created_by, 'system'))
        .all()
    )

    channel_rows = (
        db.query(
            func.coalesce(Order.channel, 'unknown').label('channel'),
            func.count(Order.id).label('sales_count'),
            func.coalesce(func.sum(Order.amount), 0.0).label('revenue'),
        )
        .filter(Order.status == 'PAID', Order.created_at >= start_dt, Order.created_at <= end_dt)
        .group_by(func.coalesce(Order.channel, 'unknown'))
        .all()
    )

    top_products_query = (
        db.query(
            func.coalesce(OrderItem.item_name, 'Unknown Product').label('product_name'),
            func.sum(OrderItem.quantity).label('quantity'),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label('revenue'),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status == 'PAID', Order.created_at >= start_dt, Order.created_at <= end_dt)
    )
    if channel:
        top_products_query = top_products_query.filter(Order.channel == channel)
    if created_by:
        top_products_query = top_products_query.filter(Order.created_by.ilike(f'%{created_by.strip()}%'))

    top_products_rows = (
        top_products_query
        .group_by(func.coalesce(OrderItem.item_name, 'Unknown Product'))
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )

    return OrderMetrics(
        total_orders=total_orders,
        paid_orders=paid_orders,
        failed_orders=failed_orders,
        pending_orders=pending_orders,
        revenue_total=float(revenue_total),
        success_rate=success_rate,
        revenue_trend=revenue_trend,
        sales_per_staff=[
            StaffSalesPoint(staff=str(row.staff), sales_count=int(row.sales_count), revenue=float(row.revenue))
            for row in sales_per_staff_rows
        ],
        channel_breakdown=[
            ChannelBreakdownPoint(channel=str(row.channel), sales_count=int(row.sales_count), revenue=float(row.revenue))
            for row in channel_rows
        ],
        top_products=[
            TopProductPoint(product_name=str(row.product_name), quantity=int(row.quantity or 0), revenue=float(row.revenue or 0.0))
            for row in top_products_rows
        ],
    )

@router.get('/orders/{order_id}', response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .options(selectinload(Order.items))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    return order
