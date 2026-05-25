import httpx

from app.config import ORDER_SERVICE_INTERNAL_TOKEN, ORDER_SERVICE_URL


def attach_receipt_url(order_id: int, receipt_url: str) -> None:
    headers = {'Content-Type': 'application/json'}
    if ORDER_SERVICE_INTERNAL_TOKEN:
        headers['X-Service-Token'] = ORDER_SERVICE_INTERNAL_TOKEN

    with httpx.Client(timeout=10) as client:
        response = client.patch(
            f'{ORDER_SERVICE_URL}/orders/{order_id}/receipt',
            headers=headers,
            json={'receipt_url': receipt_url},
        )
        response.raise_for_status()
