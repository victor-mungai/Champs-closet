import logging
from collections import defaultdict
from datetime import datetime

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.config import (
    ORDER_INVENTORY_LOCK_TTL_SECONDS,
    ORDER_TEST_MODE,
    PRODUCT_SERVICE_INTERNAL_TOKEN,
    PRODUCT_SERVICE_URL,
)
from app.db import SessionLocal
from app.events import emit_event
from app.models import Order, OrderItem
from app.services.delivery import calculate_delivery_fee
from app.services.mpesa import build_invoice, initiate_stk

logger = logging.getLogger('order_service.order')


def _get_db() -> Session:
    return SessionLocal()


def _calculate_total(items: list[dict]) -> float:
    return float(sum(item['quantity'] * item['unit_price'] for item in items))


def _normalize_delivery(payload: dict) -> dict:
    delivery = payload.get('delivery') or {'type': 'pickup'}
    delivery_type = delivery.get('type') or 'pickup'
    if delivery_type not in {'pickup', 'delivery'}:
        raise HTTPException(status_code=422, detail='Delivery type must be pickup or delivery.')

    if delivery_type == 'delivery':
        lat = delivery.get('lat')
        lng = delivery.get('lng')
        if lat is None or lng is None:
            raise HTTPException(status_code=422, detail='Delivery location coordinates are required.')
        fee = calculate_delivery_fee(float(lat), float(lng))
    else:
        lat = None
        lng = None
        fee = 0.0

    return {
        'type': delivery_type,
        'fee': float(fee),
        'lat': lat,
        'lng': lng,
        'label': delivery.get('label'),
    }


def _serialize_order(order: Order) -> dict:
    return {
        'order_id': order.id,
        'amount': float(order.amount or 0.0),
        'phone': order.phone,
        'receipt': order.receipt,
        'receipt_url': order.receipt_url,
        'channel': order.channel,
        'payment_method': order.payment_method,
        'created_by': order.created_by,
        'items': [
            {
                'name': item.item_name or f'Product #{item.product_id}',
                'quantity': item.quantity,
                'price': float(item.unit_price or 0.0),
                'size': item.size,
            }
            for item in order.items
        ],
        'delivery': {
            'type': order.delivery_type or 'pickup',
            'fee': float(order.delivery_fee or 0.0),
            'label': order.delivery_address,
            'lat': order.delivery_lat,
            'lng': order.delivery_lng,
        },
    }


def _aggregate_quantities(items: list[dict] | list[OrderItem]) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for item in items:
        if isinstance(item, dict):
            totals[int(item['product_id'])] += int(item['quantity'])
        else:
            totals[int(item.product_id)] += int(item.quantity)
    return dict(totals)


def _product_headers() -> dict[str, str]:
    headers = {'Content-Type': 'application/json'}
    if PRODUCT_SERVICE_INTERNAL_TOKEN:
        headers['X-Service-Token'] = PRODUCT_SERVICE_INTERNAL_TOKEN
    return headers


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None


def _normalize_phone_digits(value: str | int | None) -> str | None:
    if value is None:
        return None
    digits = ''.join(char for char in str(value) if char.isdigit())
    if not digits:
        return None
    if digits.startswith('254') and len(digits) >= 12:
        return digits[-12:]
    if digits.startswith('0') and len(digits) >= 10:
        return f'254{digits[-9:]}'
    if len(digits) == 9:
        return f'254{digits}'
    return digits


def _inventory_items_payload(items: list[dict] | list[OrderItem]) -> list[dict]:
    return [
        {'product_id': int(product_id), 'quantity': int(quantity)}
        for product_id, quantity in _aggregate_quantities(items).items()
    ]


def _lock_inventory(order: Order, items: list[dict] | list[OrderItem]) -> tuple[str, datetime | None]:
    lock_id = f'order:{order.id}'
    payload = {
        'lock_id': lock_id,
        'ttl_seconds': ORDER_INVENTORY_LOCK_TTL_SECONDS,
        'items': _inventory_items_payload(items),
    }

    with httpx.Client(timeout=20) as client:
        response = client.post(
            f'{PRODUCT_SERVICE_URL}/products/inventory/lock',
            headers=_product_headers(),
            json=payload,
        )

    if response.status_code == 409:
        raise HTTPException(status_code=409, detail=f'Insufficient stock: {response.text}')
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail='Failed to reserve inventory for this order')

    body = response.json()
    return lock_id, _parse_iso_datetime(body.get('expires_at'))


def _release_inventory_lock(order: Order) -> None:
    if not order.inventory_lock_id:
        return

    with httpx.Client(timeout=20) as client:
        response = client.post(
            f'{PRODUCT_SERVICE_URL}/products/inventory/release',
            headers=_product_headers(),
            json={'lock_id': order.inventory_lock_id},
        )

    if response.status_code >= 400:
        logger.warning(
            'Failed to release inventory lock',
            extra={'order_id': order.id, 'lock_id': order.inventory_lock_id, 'status_code': response.status_code, 'body': response.text},
        )


def _commit_inventory_lock(order: Order) -> None:
    if not order.inventory_lock_id:
        return

    with httpx.Client(timeout=20) as client:
        response = client.post(
            f'{PRODUCT_SERVICE_URL}/products/inventory/commit',
            headers=_product_headers(),
            json={'lock_id': order.inventory_lock_id},
        )

    if response.status_code == 409:
        raise HTTPException(status_code=409, detail=f'Inventory commit conflict: {response.text}')
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail='Failed to finalize inventory update with product service')


def save_order(
    payload: dict,
    *,
    channel: str = 'online',
    created_by: str | None = None,
    payment_method: str = 'stk',
) -> Order:
    db = _get_db()
    try:
        items = payload['items']

        delivery = _normalize_delivery(payload)
        subtotal = _calculate_total(items)
        total = subtotal + delivery['fee']
        client_amount = payload.get('amount')
        if client_amount is not None and abs(float(client_amount) - total) > 1:
            logger.warning(
                'Client amount mismatch',
                extra={'client_amount': client_amount, 'server_amount': total},
            )

        order = Order(
            amount=total,
            phone=payload['phone'],
            status='PENDING',
            channel=channel,
            payment_method=payment_method,
            created_by=created_by,
            delivery_type=delivery['type'],
            delivery_fee=delivery['fee'],
            delivery_lat=delivery['lat'],
            delivery_lng=delivery['lng'],
            delivery_address=delivery['label'],
            inventory_synced=False,
        )

        db.add(order)
        db.flush()

        for item in items:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=item['product_id'],
                    quantity=item['quantity'],
                    unit_price=item['unit_price'],
                    item_name=item.get('name'),
                    size=item.get('size'),
                )
            )

        db.commit()
        db.refresh(order)

        try:
            lock_id, lock_expires_at = _lock_inventory(order, items)
            order.inventory_lock_id = lock_id
            order.inventory_lock_expires_at = lock_expires_at
            db.commit()
            db.refresh(order)
        except HTTPException:
            order.status = 'FAILED'
            db.commit()
            raise

        return order
    finally:
        db.close()


def update_order(order_id: int, data: dict) -> None:
    db = _get_db()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return

        for key, value in data.items():
            setattr(order, key, value)

        db.commit()
    finally:
        db.close()


def update_order_by_external_id(request_id: str, data: dict) -> None:
    db = _get_db()
    try:
        order = db.query(Order).filter(Order.external_tx_id == request_id).first()
        if not order:
            return

        for key, value in data.items():
            setattr(order, key, value)

        db.commit()
    finally:
        db.close()


def _mark_order_paid(order: Order, *, receipt: str | None = None) -> dict:
    if order.status == 'PAID':
        if not order.inventory_synced:
            _commit_inventory_lock(order)
            order.inventory_synced = True
            order.inventory_lock_id = None
            order.inventory_lock_expires_at = None
        return _serialize_order(order)

    order.status = 'PAID'
    if receipt:
        order.receipt = receipt

    if not order.inventory_synced:
        _commit_inventory_lock(order)
        order.inventory_synced = True
        order.inventory_lock_id = None
        order.inventory_lock_expires_at = None

    return _serialize_order(order)


def _mark_order_failed(order: Order) -> dict:
    if order.status == 'PAID':
        return _serialize_order(order)

    order.status = 'FAILED'
    _release_inventory_lock(order)
    order.inventory_lock_id = None
    order.inventory_lock_expires_at = None
    return _serialize_order(order)


def _mark_order_paid_by_id(order_id: int, *, receipt: str | None = None, test: bool = False) -> dict | None:
    db = _get_db()
    try:
        order = (
            db.query(Order)
            .options(selectinload(Order.items))
            .filter(Order.id == order_id)
            .first()
        )
        if not order:
            return None

        was_paid = order.status == 'PAID'
        event_data = _mark_order_paid(order, receipt=receipt)
        db.commit()
        if not was_paid:
            if test:
                event_data['test'] = True
            emit_event('order_paid', event_data)
        return event_data
    finally:
        db.close()


def mark_order_paid_by_external_id(
    request_id: str,
    *,
    receipt: str | None = None,
    callback_amount: float | None = None,
    callback_phone: str | int | None = None,
) -> dict | None:
    db = _get_db()
    try:
        order = (
            db.query(Order)
            .options(selectinload(Order.items))
            .filter(Order.external_tx_id == request_id)
            .first()
        )
        if not order:
            return None

        if not receipt:
            logger.warning('Skipping payment confirmation without receipt', extra={'external_tx_id': request_id, 'order_id': order.id})
            return None

        if callback_amount is not None:
            expected = float(order.amount or 0.0)
            if abs(float(callback_amount) - expected) > 1.0:
                logger.error(
                    'Callback amount mismatch',
                    extra={
                        'order_id': order.id,
                        'external_tx_id': request_id,
                        'expected_amount': expected,
                        'callback_amount': float(callback_amount),
                    },
                )
                return None

        if callback_phone is not None:
            expected_phone = _normalize_phone_digits(order.phone)
            received_phone = _normalize_phone_digits(callback_phone)
            if expected_phone and received_phone and expected_phone != received_phone:
                logger.error(
                    'Callback phone mismatch',
                    extra={
                        'order_id': order.id,
                        'external_tx_id': request_id,
                        'expected_phone': expected_phone,
                        'callback_phone': received_phone,
                    },
                )
                return None

        was_paid = order.status == 'PAID'
        event_data = _mark_order_paid(order, receipt=receipt)
        db.commit()
        if not was_paid:
            emit_event('order_paid', event_data)
        return event_data
    finally:
        db.close()


def mark_order_failed_by_external_id(request_id: str) -> dict | None:
    db = _get_db()
    try:
        order = (
            db.query(Order)
            .options(selectinload(Order.items))
            .filter(Order.external_tx_id == request_id)
            .first()
        )
        if not order:
            return None

        event_data = _mark_order_failed(order)
        db.commit()
        return event_data
    finally:
        db.close()


def get_order_event_data(order_id: int) -> dict | None:
    db = _get_db()
    try:
        order = (
            db.query(Order)
            .options(selectinload(Order.items))
            .filter(Order.id == order_id)
            .first()
        )
        if not order:
            return None
        return _serialize_order(order)
    finally:
        db.close()


def get_order_event_data_by_external_id(request_id: str) -> dict | None:
    db = _get_db()
    try:
        order = (
            db.query(Order)
            .options(selectinload(Order.items))
            .filter(Order.external_tx_id == request_id)
            .first()
        )
        if not order:
            return None
        return _serialize_order(order)
    finally:
        db.close()


async def create_order(
    payload: dict,
    *,
    channel: str = 'online',
    created_by: str | None = None,
    payment_method: str = 'stk',
) -> dict:
    order = save_order(payload, channel=channel, created_by=created_by, payment_method=payment_method)

    if payment_method == 'cash':
        receipt = f'CASH-{order.id:06d}'
        event_data = _mark_order_paid_by_id(order.id, receipt=receipt, test=False)
        return {
            'message': 'Cash sale recorded',
            'order_id': order.id,
            'amount': order.amount,
            'delivery_fee': order.delivery_fee,
            'delivery_type': order.delivery_type,
            'status': 'PAID',
            'receipt': event_data.get('receipt') if event_data else receipt,
        }

    if ORDER_TEST_MODE:
        invoice = build_invoice(order.id)
        update_order(
            order.id,
            {
                'external_tx_id': f'TEST-{order.id}',
                'invoice_number': invoice,
            },
        )
        receipt = f'TEST-{order.id:06d}'
        _mark_order_paid_by_id(order.id, receipt=receipt, test=True)
        return {
            'message': 'Order processed',
            'order_id': order.id,
            'invoice': invoice,
            'amount': order.amount,
            'delivery_fee': order.delivery_fee,
            'delivery_type': order.delivery_type,
            'test': True,
        }

    try:
        stk_response, invoice = await initiate_stk(
            phone=payload['phone'],
            amount=order.amount,
            order_id=order.id,
        )
    except httpx.HTTPStatusError as exc:
        detail = 'M-Pesa payment initiation failed'
        response_text = exc.response.text if exc.response is not None else ''
        if response_text:
            logger.error('M-Pesa payment error', extra={'status': exc.response.status_code, 'body': response_text})
            detail = f'{detail}: {response_text}'
        # explicit lock release when STK initiation fails before tx id assignment
        db = _get_db()
        try:
            current = db.query(Order).options(selectinload(Order.items)).filter(Order.id == order.id).first()
            if current:
                _mark_order_failed(current)
                db.commit()
        finally:
            db.close()
        raise HTTPException(status_code=502, detail=detail) from exc
    except ValueError as exc:
        db = _get_db()
        try:
            current = db.query(Order).options(selectinload(Order.items)).filter(Order.id == order.id).first()
            if current:
                _mark_order_failed(current)
                db.commit()
        finally:
            db.close()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        update_order(order.id, {'status': 'FAILED'})
        db = _get_db()
        try:
            current = db.query(Order).options(selectinload(Order.items)).filter(Order.id == order.id).first()
            if current:
                _mark_order_failed(current)
                db.commit()
        finally:
            db.close()
        logger.error('Payment initiation error', extra={'error': str(exc)})
        raise HTTPException(status_code=502, detail='Payment service unavailable') from exc

    update_order(
        order.id,
        {
            'status': 'STK_SENT',
            'external_tx_id': stk_response.get('CheckoutRequestID') or stk_response.get('requestId') or stk_response.get('MerchantRequestID'),
            'invoice_number': invoice,
        },
    )

    return {
        'message': 'STK push sent',
        'order_id': order.id,
        'invoice': invoice,
        'amount': order.amount,
        'delivery_fee': order.delivery_fee,
        'delivery_type': order.delivery_type,
    }


async def create_admin_order(payload: dict) -> dict:
    payment_method = payload.get('payment_method') or 'cash'
    created_by = payload.get('created_by')
    return await create_order(
        payload,
        channel='admin',
        created_by=created_by,
        payment_method=payment_method,
    )


def get_invoice(order_id: int) -> str:
    return build_invoice(order_id)
