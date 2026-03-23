import httpx

from app.config import PRODUCT_SERVICE_URL


def _to_multipart(payload: dict) -> list[tuple[str, tuple[None, str]]]:
    items: list[tuple[str, tuple[None, str]]] = []
    for key, value in payload.items():
        if value is None:
            continue
        items.append((key, (None, str(value))))
    return items


def _safe_json(resp: httpx.Response) -> dict:
    content_type = resp.headers.get('content-type', '')
    if 'application/json' not in content_type:
        return {}
    try:
        return resp.json()
    except Exception:
        return {}


async def create_product(payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.post(
            f"{PRODUCT_SERVICE_URL}/products/",
            files=_to_multipart(payload),
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Product service error {resp.status_code}: {resp.text}")
        return _safe_json(resp)
