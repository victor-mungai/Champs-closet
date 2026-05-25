from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text, func
from sqlalchemy.orm import relationship

from app.database import Base

product_tags = Table(
    'product_tags',
    Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id')),
    Column('tag_id', Integer, ForeignKey('tags.id')),
)


class Product(Base):
    __tablename__ = 'products'

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Integer, default=500)
    stock = Column(Integer, default=0)
    reserved_stock = Column(Integer, default=0)
    image_url = Column(Text)
    image_urls = Column(JSON, default=list)
    description = Column(Text)
    status = Column(String, default='pending_ai')
    sizes = Column(JSON, default=list)
    colors = Column(JSON, default=list)
    is_unique = Column(Boolean, default=False)
    tags = relationship('Tag', secondary=product_tags, back_populates='products')


class InventoryLock(Base):
    __tablename__ = 'inventory_locks'

    id = Column(Integer, primary_key=True, index=True)
    lock_id = Column(String, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    quantity = Column(Integer, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Tag(Base):
    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    products = relationship('Product', secondary=product_tags, back_populates='tags')
