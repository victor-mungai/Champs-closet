from collections import defaultdict
from datetime import datetime, timedelta, timezone
import re
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas

UNIQUE_CATEGORIES = {'shirt', 'shirts', 'sweater', 'sweaters'}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_category(category: str) -> str:
    return (category or '').strip().lower()


def _category_key(value: str) -> str:
    normalized = _normalize_category(value)
    return re.sub(r'[_\-\s]+', '', normalized)


def _category_code(category: str) -> str:
    normalized = _normalize_category(category)
    if not normalized:
        return 'GEN'
    words = re.split(r"[^a-z0-9]+", normalized)
    words = [w for w in words if w]
    if not words:
        return 'GEN'
    if len(words) == 1:
        return (words[0][:3] if len(words[0]) >= 3 else words[0]).upper()
    return (words[0][0] + words[1][0]).upper()


def _generate_sku(category: str) -> str:
    date_part = datetime.utcnow().strftime('%y%m%d')
    rand = uuid.uuid4().hex[:6].upper()
    return f"CC-{_category_code(category)}-{date_part}-{rand}"


def _normalize_tags(tag_names: list[str]) -> list[str]:
    cleaned = []
    for name in tag_names:
        if not isinstance(name, str):
            continue
        trimmed = name.strip().lower()
        if trimmed and trimmed not in cleaned:
            cleaned.append(trimmed)
    return cleaned


def _normalize_colors(color_names: list[str]) -> list[str]:
    cleaned = []
    for name in color_names:
        if not isinstance(name, str):
            continue
        trimmed = name.strip().lower()
        if trimmed and trimmed not in cleaned:
            cleaned.append(trimmed)
    return cleaned


def _build_tag_objects(db: Session, tag_names: list[str]) -> list[models.Tag]:
    normalized = _normalize_tags(tag_names)
    tag_objects: list[models.Tag] = []
    for tag_name in normalized:
        tag = db.query(models.Tag).filter(models.Tag.name == tag_name).first()
        if not tag:
            tag = models.Tag(name=tag_name)
            db.add(tag)
        tag_objects.append(tag)
    return tag_objects


def _available_stock(product: models.Product) -> int:
    stock = int(product.stock or 0)
    reserved = int(product.reserved_stock or 0)
    return max(0, stock - reserved)


def _aggregate_quantities(items: list) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for item in items:
        totals[int(item.product_id)] += int(item.quantity)
    return dict(totals)


def _release_lock_rows(db: Session, lock_rows: list[models.InventoryLock]) -> dict[int, models.Product]:
    if not lock_rows:
        return {}

    quantities: dict[int, int] = defaultdict(int)
    for row in lock_rows:
        quantities[int(row.product_id)] += int(row.quantity)

    product_ids = list(quantities.keys())
    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    by_id = {product.id: product for product in products}

    for product_id, quantity in quantities.items():
        product = by_id.get(product_id)
        if not product:
            continue
        reserved = int(product.reserved_stock or 0)
        product.reserved_stock = max(0, reserved - quantity)

    for row in lock_rows:
        db.delete(row)

    return by_id


def _cleanup_expired_locks(db: Session) -> bool:
    expired_rows = (
        db.query(models.InventoryLock)
        .filter(models.InventoryLock.expires_at <= _utcnow())
        .all()
    )
    if not expired_rows:
        return False

    _release_lock_rows(db, expired_rows)
    return True


def _mark_available(products: list[models.Product]) -> list[models.Product]:
    for product in products:
        setattr(product, 'available_stock', _available_stock(product))
    return products


def create_product(db: Session, product: schemas.ProductCreate) -> models.Product:
    category_lower = _normalize_category(product.category)
    is_unique = category_lower in UNIQUE_CATEGORIES if product.is_unique is None else bool(product.is_unique)
    stock = 1 if is_unique else int(product.stock)

    sku = product.sku or _generate_sku(product.category)
    for _ in range(5):
        exists = db.query(models.Product).filter(models.Product.sku == sku).first()
        if not exists:
            break
        sku = _generate_sku(product.category)

    image_urls = product.image_urls or []
    image_url = product.image_url
    if not image_url and image_urls:
        image_url = image_urls[0]

    db_product = models.Product(
        sku=sku,
        name=product.name,
        category=product.category,
        price=product.price,
        stock=stock,
        reserved_stock=0,
        image_url=image_url,
        image_urls=image_urls,
        sizes=product.sizes or [],
        colors=_normalize_colors(product.colors or []),
        description=product.description,
        status=product.status or 'pending_ai',
        is_unique=is_unique,
    )

    db_product.tags = _build_tag_objects(db, product.tags)

    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    setattr(db_product, 'available_stock', _available_stock(db_product))
    return db_product


def update_product(db: Session, product: models.Product, payload: schemas.ProductUpdate) -> models.Product:
    if payload.name is not None:
        product.name = payload.name
    if payload.category is not None:
        product.category = payload.category
    if payload.price is not None:
        product.price = int(payload.price)
    if payload.sku is not None:
        next_sku = payload.sku.strip() or None
        if next_sku:
            existing = db.query(models.Product).filter(models.Product.sku == next_sku, models.Product.id != product.id).first()
            if existing:
                raise ValueError('SKU already exists for another product')
        product.sku = next_sku

    if payload.image_urls is not None:
        cleaned_urls = [url.strip() for url in payload.image_urls if isinstance(url, str) and url.strip()]
        product.image_urls = cleaned_urls
        product.image_url = cleaned_urls[0] if cleaned_urls else None
    elif payload.image_url is not None:
        next_primary = payload.image_url.strip() if isinstance(payload.image_url, str) else payload.image_url
        product.image_url = next_primary or None
        if next_primary:
            existing_urls = list(product.image_urls or [])
            if next_primary not in existing_urls:
                product.image_urls = [next_primary, *existing_urls]

    if payload.description is not None:
        product.description = payload.description
    if payload.sizes is not None:
        product.sizes = payload.sizes
    if payload.colors is not None:
        product.colors = _normalize_colors(payload.colors)

    if payload.tags is not None:
        product.tags = _build_tag_objects(db, payload.tags)

    if payload.is_unique is not None:
        product.is_unique = bool(payload.is_unique)

    if payload.stock is not None:
        next_stock = max(0, int(payload.stock))
        if product.is_unique:
            next_stock = 1 if next_stock > 0 else 0
        product.stock = next_stock

    category_lower = _normalize_category(product.category)
    if payload.is_unique is None and category_lower in UNIQUE_CATEGORIES:
        product.is_unique = True

    if product.is_unique and int(product.stock or 0) > 1:
        product.stock = 1

    if int(product.reserved_stock or 0) > int(product.stock or 0):
        product.reserved_stock = int(product.stock or 0)

    db.commit()
    db.refresh(product)
    setattr(product, 'available_stock', _available_stock(product))
    return product


def get_products(
    db: Session,
    category: str | None = None,
    tag: str | None = None,
    search: str | None = None,
    tags: list[str] | None = None,
    limit: int = 20,
    offset: int = 0,
):
    if _cleanup_expired_locks(db):
        db.commit()

    query = db.query(models.Product)

    if category:
        category_key = _category_key(category)
        query = query.filter(
            func.replace(
                func.replace(func.replace(func.lower(models.Product.category), '_', ''), '-', ''),
                ' ',
                '',
            ) == category_key
        )

    requested_tags = []
    if tag:
        requested_tags.append(tag)
    if tags:
        requested_tags.extend(tags)

    normalized_tags = _normalize_tags(requested_tags)
    tags_filter = None
    if normalized_tags:
        tags_filter = models.Product.tags.any(models.Tag.name.in_(normalized_tags))

    if search:
        like = f"%{search}%"
        search_filter = models.Product.name.ilike(like) | models.Product.description.ilike(like)
        if tags_filter is not None:
            query = query.filter(tags_filter | search_filter)
        else:
            query = query.filter(search_filter)
    elif tags_filter is not None:
        query = query.filter(tags_filter)

    safe_limit = max(1, min(int(limit), 100))
    safe_offset = max(0, int(offset))

    rows = (
        query
        .order_by(models.Product.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    return _mark_available(rows)


def get_product(db: Session, product_id: int):
    if _cleanup_expired_locks(db):
        db.commit()
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if product:
        setattr(product, 'available_stock', _available_stock(product))
    return product


def update_product_ai(db: Session, product: models.Product, payload: schemas.ProductAIUpdate) -> models.Product:
    if product.status == 'enriched':
        return product

    if payload.description:
        product.description = payload.description
    if payload.status:
        product.status = payload.status

    if payload.tags:
        existing = [tag.name for tag in product.tags] if product.tags else []
        merged = _normalize_tags(existing + payload.tags)
        product.tags = _build_tag_objects(db, merged)

    db.commit()
    db.refresh(product)
    setattr(product, 'available_stock', _available_stock(product))
    return product


def lock_inventory(
    db: Session,
    payload: schemas.InventoryLockRequest,
    redis_client,
) -> tuple[list[models.Product], datetime | None]:
    _cleanup_expired_locks(db)

    existing = db.query(models.InventoryLock).filter(models.InventoryLock.lock_id == payload.lock_id).all()
    if existing:
        product_ids = sorted({row.product_id for row in existing})
        products = (
            db.query(models.Product)
            .filter(models.Product.id.in_(product_ids))
            .all()
        )
        expires_at = max(row.expires_at for row in existing) if existing else None
        return _mark_available(products), expires_at

    quantities = _aggregate_quantities(payload.items)
    if not quantities:
        return [], None

    product_ids = list(quantities.keys())
    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    by_id = {product.id: product for product in products}

    missing = [product_id for product_id in product_ids if product_id not in by_id]
    if missing:
        raise ValueError(f'Products not found: {missing}')

    for product_id, quantity in quantities.items():
        product = by_id[product_id]
        available = _available_stock(product)
        if product.is_unique and quantity > 1:
            raise ValueError(f'Unique product {product_id} can only be reserved once')
        if available < quantity:
            raise ValueError(f'Insufficient stock for product {product_id}')

    expires_at = _utcnow() + timedelta(seconds=payload.ttl_seconds)
    for product_id, quantity in quantities.items():
        product = by_id[product_id]
        product.reserved_stock = int(product.reserved_stock or 0) + int(quantity)
        db.add(
            models.InventoryLock(
                lock_id=payload.lock_id,
                product_id=product_id,
                quantity=quantity,
                expires_at=expires_at,
            )
        )

    try:
        redis_client.set(f'lock:{payload.lock_id}', '1', ex=payload.ttl_seconds)
    except Exception:
        pass

    db.commit()
    for product in products:
        db.refresh(product)
    return _mark_available(products), expires_at


def release_inventory_lock(db: Session, lock_id: str, redis_client) -> list[models.Product]:
    _cleanup_expired_locks(db)

    lock_rows = db.query(models.InventoryLock).filter(models.InventoryLock.lock_id == lock_id).all()
    if not lock_rows:
        return []

    by_id = _release_lock_rows(db, lock_rows)
    try:
        redis_client.delete(f'lock:{lock_id}')
    except Exception:
        pass

    db.commit()
    products = list(by_id.values())
    for product in products:
        db.refresh(product)
    return _mark_available(products)


def commit_inventory_lock(db: Session, lock_id: str, redis_client) -> list[models.Product]:
    _cleanup_expired_locks(db)

    lock_rows = db.query(models.InventoryLock).filter(models.InventoryLock.lock_id == lock_id).all()
    if not lock_rows:
        return []

    quantities: dict[int, int] = defaultdict(int)
    for row in lock_rows:
        quantities[int(row.product_id)] += int(row.quantity)

    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(list(quantities.keys())))
        .with_for_update()
        .all()
    )
    by_id = {product.id: product for product in products}

    missing = [product_id for product_id in quantities if product_id not in by_id]
    if missing:
        raise ValueError(f'Products not found: {missing}')

    for product_id, quantity in quantities.items():
        product = by_id[product_id]
        stock = int(product.stock or 0)
        reserved = int(product.reserved_stock or 0)

        if stock < quantity:
            raise ValueError(f'Insufficient stock for product {product_id}')

        product.stock = stock - quantity
        product.reserved_stock = max(0, reserved - quantity)

    for row in lock_rows:
        db.delete(row)

    try:
        redis_client.delete(f'lock:{lock_id}')
    except Exception:
        pass

    db.commit()
    for product in products:
        db.refresh(product)
    return _mark_available(products)


def consume_stock(db: Session, payload: schemas.StockConsumeRequest) -> list[models.Product]:
    if not payload.items:
        return []

    _cleanup_expired_locks(db)

    quantities = _aggregate_quantities(payload.items)
    product_ids = list(quantities.keys())
    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )

    by_id = {product.id: product for product in products}
    missing = [product_id for product_id in product_ids if product_id not in by_id]
    if missing:
        raise ValueError(f'Products not found: {missing}')

    for product_id, quantity in quantities.items():
        product = by_id[product_id]
        available = _available_stock(product)
        if product.is_unique:
            if available < 1:
                raise ValueError(f'Product {product_id} is out of stock')
            product.stock = max(0, int(product.stock or 0) - 1)
        else:
            if available < quantity:
                raise ValueError(f'Insufficient stock for product {product_id}')
            product.stock = max(0, int(product.stock or 0) - quantity)

    db.commit()
    for product in products:
        db.refresh(product)
    return _mark_available(products)


def delete_product(db: Session, product_id: int):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        return None
    db.delete(product)
    db.commit()
    return product
