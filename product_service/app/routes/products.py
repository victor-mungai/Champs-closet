from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, Header, HTTPException, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import verify_firebase_token
from app.config import PRODUCT_SERVICE_INTERNAL_TOKEN
from app.database import SessionLocal
from app.events import publish_event, redis_client
from app.storage import upload_image

router = APIRouter(prefix='/products', tags=['Products'])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalize_category(category: str) -> str:
    return (category or '').strip().lower()


def _parse_csv_values(raw: str | None) -> list[str]:
    if raw is None:
        return []
    values = []
    for value in raw.split(','):
        trimmed = value.strip()
        if trimmed and trimmed not in values:
            values.append(trimmed)
    return values


def _normalize_size_label(value: str) -> str:
    cleaned = value.strip().lower().replace(' ', '')
    mapping = {
        'small': 'S',
        's': 'S',
        'medium': 'M',
        'm': 'M',
        'large': 'L',
        'l': 'L',
        'xl': 'XL',
        'xlarge': 'XL',
        '2xl': '2XL',
        'xxl': '2XL',
        '3xl': '3XL',
        '4xl': '4XL',
        '5xl': '5XL',
    }
    return mapping.get(cleaned, value.strip().upper())


def _parse_sizes(category: str, sizes_raw: str) -> list[str]:
    if not sizes_raw:
        return []

    category_key = _normalize_category(category)
    raw_sizes = [s.strip() for s in sizes_raw.split(',') if s.strip()]

    if category_key in {'shirt', 'shirts', 'sweater', 'sweaters'}:
        allowed = {'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'}
        normalized = [_normalize_size_label(s) for s in raw_sizes]
        invalid = [s for s in normalized if s not in allowed]
        if invalid:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid sizes for {category}. Allowed: {', '.join(sorted(allowed))}",
            )
        return normalized

    if category_key in {'shoe', 'shoes', 'shoe hub', 'shoe_hub'}:
        normalized = []
        for s in raw_sizes:
            if not re.fullmatch(r"\d{1,2}(?:\.\d)?", s):
                raise HTTPException(status_code=422, detail='Shoe sizes must be numeric (e.g. 41, 42.5).')
            normalized.append(s)
        return normalized

    if category_key in {'jeans', 'trouser', 'trousers'}:
        normalized = []
        for s in raw_sizes:
            if not re.fullmatch(r"\d{2,3}", s):
                raise HTTPException(status_code=422, detail='Jeans waist sizes must be numeric (e.g. 32, 34).')
            normalized.append(s)
        return normalized

    return raw_sizes


def _require_internal_service_token(x_service_token: str | None) -> None:
    if PRODUCT_SERVICE_INTERNAL_TOKEN and x_service_token != PRODUCT_SERVICE_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail='Unauthorized service request')


@router.get('/', response_model=list[schemas.Product])
def list_products(
    category: str | None = None,
    tag: str | None = None,
    search: str | None = None,
    tags: str | None = Query(default=None, description='Comma separated tags'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    parsed_tags = [value.strip() for value in (tags or '').split(',') if value.strip()]
    return crud.get_products(db, category, tag, search, parsed_tags, limit=limit, offset=offset)


@router.post('/', response_model=schemas.Product)
def create_product(
    name: str = Form(...),
    category: str = Form(...),
    price: int = Form(500),
    stock: int = Form(0),
    description: str | None = Form(None),
    tags: str = Form(''),
    sizes: str = Form(''),
    colors: str = Form(''),
    sku: str | None = Form(None),
    image_url: str | None = Form(None),
    image_urls: str = Form(''),
    is_unique: bool | None = Form(None),
    images: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
    _user=Depends(verify_firebase_token),
):
    final_image_urls: list[str] = []

    if image_url:
        final_image_urls.append(image_url)

    if image_urls:
        final_image_urls.extend([u.strip() for u in image_urls.split(',') if u.strip()])

    if images:
        for image in images:
            if image is None:
                continue
            final_image_urls.append(upload_image(image.file))

    final_image_urls = [u for i, u in enumerate(final_image_urls) if u and u not in final_image_urls[:i]]
    primary_image = final_image_urls[0] if final_image_urls else None

    parsed_sizes = _parse_sizes(category, sizes)

    product = schemas.ProductCreate(
        name=name,
        category=category,
        price=price,
        stock=stock,
        sku=sku,
        image_url=primary_image,
        image_urls=final_image_urls,
        sizes=parsed_sizes,
        colors=_parse_csv_values(colors),
        description=description,
        tags=[t.strip() for t in tags.split(',') if t.strip()],
        status='pending_ai',
        is_unique=is_unique,
    )

    db_product = crud.create_product(db, product)
    publish_event(
        'product_stream',
        {
            'event_type': 'product_created',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': {
                'product_id': db_product.id,
                'image_url': db_product.image_url,
                'category': db_product.category,
                'status': db_product.status,
            },
        },
    )
    return db_product


@router.patch('/{product_id}', response_model=schemas.Product)
def update_product(
    product_id: int,
    name: str | None = Form(None),
    category: str | None = Form(None),
    price: int | None = Form(None),
    stock: int | None = Form(None),
    description: str | None = Form(None),
    tags: str | None = Form(None),
    sizes: str | None = Form(None),
    colors: str | None = Form(None),
    sku: str | None = Form(None),
    image_url: str | None = Form(None),
    image_urls: str | None = Form(None),
    replace_images: bool = Form(False),
    is_unique: bool | None = Form(None),
    images: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
    _user=Depends(verify_firebase_token),
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Product not found')

    target_category = category if category is not None else product.category

    parsed_sizes = None
    if sizes is not None:
        parsed_sizes = _parse_sizes(target_category, sizes)

    parsed_tags = None if tags is None else _parse_csv_values(tags)
    parsed_colors = None if colors is None else _parse_csv_values(colors)

    next_images = None
    if replace_images:
        next_images = []
    elif image_urls is not None or images:
        existing = list(product.image_urls or [])
        if not existing and product.image_url:
            existing = [product.image_url]
        next_images = existing

    if image_urls is not None:
        url_values = _parse_csv_values(image_urls)
        if replace_images:
            next_images = url_values
        elif next_images is not None:
            next_images.extend(url_values)

    if images:
        for image in images:
            if image is None:
                continue
            uploaded = upload_image(image.file)
            if next_images is None:
                next_images = []
            next_images.append(uploaded)

    if next_images is not None:
        deduped = []
        for url in next_images:
            cleaned = (url or '').strip()
            if cleaned and cleaned not in deduped:
                deduped.append(cleaned)
        next_images = deduped

    payload = schemas.ProductUpdate(
        name=name,
        category=category,
        price=price,
        stock=stock,
        sku=sku,
        image_url=image_url,
        image_urls=next_images,
        sizes=parsed_sizes,
        colors=parsed_colors,
        tags=parsed_tags,
        description=description,
        is_unique=is_unique,
    )

    try:
        updated = crud.update_product(db, product, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return updated


@router.post('/inventory/lock', response_model=schemas.InventoryLockResponse)
def lock_inventory(
    payload: schemas.InventoryLockRequest,
    db: Session = Depends(get_db),
    x_service_token: str | None = Header(default=None, alias='X-Service-Token'),
):
    _require_internal_service_token(x_service_token)

    try:
        updated, expires_at = crud.lock_inventory(db, payload, redis_client)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return schemas.InventoryLockResponse(
        lock_id=payload.lock_id,
        expires_at=expires_at,
        updated=[
            schemas.InventoryLockSummary(
                product_id=product.id,
                stock=int(product.stock or 0),
                reserved_stock=int(product.reserved_stock or 0),
                available_stock=int(getattr(product, 'available_stock', int(product.stock or 0) - int(product.reserved_stock or 0))),
                is_unique=bool(product.is_unique),
            )
            for product in updated
        ],
    )


@router.post('/inventory/release', response_model=schemas.InventoryLockResponse)
def release_inventory(
    payload: schemas.InventoryReleaseRequest,
    db: Session = Depends(get_db),
    x_service_token: str | None = Header(default=None, alias='X-Service-Token'),
):
    _require_internal_service_token(x_service_token)

    updated = crud.release_inventory_lock(db, payload.lock_id, redis_client)
    return schemas.InventoryLockResponse(
        lock_id=payload.lock_id,
        updated=[
            schemas.InventoryLockSummary(
                product_id=product.id,
                stock=int(product.stock or 0),
                reserved_stock=int(product.reserved_stock or 0),
                available_stock=int(getattr(product, 'available_stock', int(product.stock or 0) - int(product.reserved_stock or 0))),
                is_unique=bool(product.is_unique),
            )
            for product in updated
        ],
    )


@router.post('/inventory/commit', response_model=schemas.InventoryLockResponse)
def commit_inventory(
    payload: schemas.InventoryReleaseRequest,
    db: Session = Depends(get_db),
    x_service_token: str | None = Header(default=None, alias='X-Service-Token'),
):
    _require_internal_service_token(x_service_token)

    try:
        updated = crud.commit_inventory_lock(db, payload.lock_id, redis_client)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return schemas.InventoryLockResponse(
        lock_id=payload.lock_id,
        updated=[
            schemas.InventoryLockSummary(
                product_id=product.id,
                stock=int(product.stock or 0),
                reserved_stock=int(product.reserved_stock or 0),
                available_stock=int(getattr(product, 'available_stock', int(product.stock or 0) - int(product.reserved_stock or 0))),
                is_unique=bool(product.is_unique),
            )
            for product in updated
        ],
    )


@router.post('/consume-stock', response_model=schemas.StockConsumeResponse)
def consume_stock(
    payload: schemas.StockConsumeRequest,
    db: Session = Depends(get_db),
    x_service_token: str | None = Header(default=None, alias='X-Service-Token'),
):
    _require_internal_service_token(x_service_token)
    try:
        updated = crud.consume_stock(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return schemas.StockConsumeResponse(
        updated=[
            schemas.StockConsumeResult(
                product_id=product.id,
                stock=int(product.stock or 0),
                reserved_stock=int(product.reserved_stock or 0),
                available_stock=int(getattr(product, 'available_stock', int(product.stock or 0) - int(product.reserved_stock or 0))),
                is_unique=bool(product.is_unique),
            )
            for product in updated
        ]
    )


@router.get('/{product_id}', response_model=schemas.Product)
def retrieve_product(product_id: int, db: Session = Depends(get_db)):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Product not found')
    return product


@router.patch('/{product_id}/ai', response_model=schemas.Product)
def update_product_ai(
    product_id: int,
    payload: schemas.ProductAIUpdate,
    db: Session = Depends(get_db),
):
    product = crud.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Product not found')
    updated = crud.update_product_ai(db, product, payload)
    return updated


@router.delete('/{product_id}', response_model=schemas.Product)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _user=Depends(verify_firebase_token),
):
    product = crud.delete_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Product not found')
    return product
