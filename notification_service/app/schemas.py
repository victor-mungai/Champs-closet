from typing import List, Optional

from pydantic import BaseModel, Field


class PaidItem(BaseModel):
    name: str
    quantity: int = Field(..., gt=0)
    price: float = Field(..., ge=0)
    size: Optional[str] = None


class PaidDelivery(BaseModel):
    type: str = 'pickup'
    fee: float = 0
    label: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class OrderPaidData(BaseModel):
    order_id: int
    amount: float
    phone: str
    receipt: str
    items: List[PaidItem]
    delivery: Optional[PaidDelivery] = None
    test: bool = False


class OrderEvent(BaseModel):
    event_type: str
    timestamp: Optional[str] = None
    data: OrderPaidData
