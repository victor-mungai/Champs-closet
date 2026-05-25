from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    name: Optional[str] = None
    size: Optional[str] = None


class DeliveryInput(BaseModel):
    type: Literal['pickup', 'delivery'] = 'pickup'
    lat: Optional[float] = None
    lng: Optional[float] = None
    label: Optional[str] = None


class OrderCreate(BaseModel):
    phone: str
    items: List[OrderItemCreate]
    amount: Optional[float] = None
    delivery: Optional[DeliveryInput] = None


class AdminOrderCreate(OrderCreate):
    payment_method: Literal['stk', 'cash'] = 'cash'
    created_by: str = Field(..., min_length=1)


class OrderItem(BaseModel):
    product_id: int
    quantity: int
    unit_price: float
    item_name: Optional[str] = None
    size: Optional[str] = None

    class Config:
        orm_mode = True


class OrderOut(BaseModel):
    id: int
    amount: float
    phone: str
    status: str
    channel: Optional[str] = None
    payment_method: Optional[str] = None
    created_by: Optional[str] = None
    external_tx_id: Optional[str] = None
    receipt: Optional[str] = None
    receipt_url: Optional[str] = None
    invoice_number: Optional[str] = None
    created_at: Optional[datetime] = None
    delivery_type: Optional[str] = None
    delivery_fee: Optional[float] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_address: Optional[str] = None
    inventory_lock_id: Optional[str] = None
    inventory_lock_expires_at: Optional[datetime] = None
    inventory_synced: Optional[bool] = None
    items: List[OrderItem] = []

    class Config:
        orm_mode = True


class TrendPoint(BaseModel):
    date: str
    revenue: float
    count: int


class StaffSalesPoint(BaseModel):
    staff: str
    sales_count: int
    revenue: float


class ChannelBreakdownPoint(BaseModel):
    channel: str
    sales_count: int
    revenue: float


class TopProductPoint(BaseModel):
    product_name: str
    quantity: int
    revenue: float


class OrderMetrics(BaseModel):
    total_orders: int
    paid_orders: int
    failed_orders: int
    pending_orders: int
    revenue_total: float
    success_rate: float
    revenue_trend: List[TrendPoint]
    sales_per_staff: List[StaffSalesPoint]
    channel_breakdown: List[ChannelBreakdownPoint]
    top_products: List[TopProductPoint]


class DeliveryQuoteRequest(BaseModel):
    lat: float
    lng: float


class DeliveryQuoteResponse(BaseModel):
    fee: float
    currency: str = 'Ksh'


class OrderReceiptUpdate(BaseModel):
    receipt_url: str


class OrderStatusOut(BaseModel):
    order_id: int
    status: str
    amount: float
    payment_method: Optional[str] = None
    invoice_number: Optional[str] = None
    receipt: Optional[str] = None
    receipt_url: Optional[str] = None
