from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    name: str
    category: str
    price: Optional[int] = 500
    stock: int
    reserved_stock: Optional[int] = 0
    sku: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    sizes: Optional[List[str]] = None
    colors: Optional[List[str]] = None
    status: Optional[str] = None
    is_unique: Optional[bool] = None


class ProductCreate(ProductBase):
    tags: List[str] = []
    description: Optional[str] = None


class ProductAIUpdate(BaseModel):
    description: Optional[str] = None
    tags: List[str] = []
    status: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[int] = None
    stock: Optional[int] = None
    sku: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    sizes: Optional[List[str]] = None
    colors: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    is_unique: Optional[bool] = None


class Product(ProductBase):
    id: int
    description: Optional[str] = None
    tags: List[Tag] = []
    available_stock: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class StockConsumeItem(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class StockConsumeRequest(BaseModel):
    items: List[StockConsumeItem]


class StockConsumeResult(BaseModel):
    product_id: int
    stock: int
    reserved_stock: int
    available_stock: int
    is_unique: bool


class StockConsumeResponse(BaseModel):
    updated: List[StockConsumeResult]


class InventoryLockItem(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class InventoryLockRequest(BaseModel):
    lock_id: str = Field(..., min_length=3, max_length=120)
    items: List[InventoryLockItem]
    ttl_seconds: int = Field(300, ge=60, le=3600)


class InventoryReleaseRequest(BaseModel):
    lock_id: str = Field(..., min_length=3, max_length=120)


class InventoryLockSummary(BaseModel):
    product_id: int
    stock: int
    reserved_stock: int
    available_stock: int
    is_unique: bool


class InventoryLockResponse(BaseModel):
    lock_id: str
    expires_at: datetime | None = None
    updated: List[InventoryLockSummary]
