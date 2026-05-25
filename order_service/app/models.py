from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db import Base


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, index=True)

    amount = Column(Float)
    phone = Column(String)

    status = Column(String, default='PENDING')
    channel = Column(String, default='online')
    payment_method = Column(String, default='stk')
    created_by = Column(String, nullable=True)

    external_tx_id = Column(String, nullable=True)
    receipt = Column(String, nullable=True)
    receipt_url = Column(String, nullable=True)

    invoice_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    delivery_type = Column(String, default='pickup')
    delivery_fee = Column(Float, default=0)
    delivery_lat = Column(Float, nullable=True)
    delivery_lng = Column(Float, nullable=True)
    delivery_address = Column(String, nullable=True)

    inventory_lock_id = Column(String, nullable=True)
    inventory_lock_expires_at = Column(DateTime(timezone=True), nullable=True)
    inventory_synced = Column(Boolean, default=False)

    items = relationship('OrderItem', back_populates='order', cascade='all, delete-orphan')


class OrderItem(Base):
    __tablename__ = 'order_items'

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('orders.id'))
    product_id = Column(Integer)
    quantity = Column(Integer)
    unit_price = Column(Float)
    item_name = Column(String, nullable=True)
    size = Column(String, nullable=True)

    order = relationship('Order', back_populates='items')
