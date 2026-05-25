import logging

from fastapi import APIRouter, Request

from app.services.order import mark_order_failed_by_external_id, mark_order_paid_by_external_id

router = APIRouter()
logger = logging.getLogger('order_service.callback')


def _extract_mpesa_metadata(stk_callback: dict) -> dict[str, str]:
    metadata = {}
    for item in stk_callback.get('CallbackMetadata', {}).get('Item', []):
        name = item.get('Name')
        if not name:
            continue
        metadata[name] = item.get('Value')
    return metadata


def _extract_identifiers(payload: dict) -> tuple[str | None, str | None, int | None, float | None, str | int | None]:
    body = payload.get('Body', {})
    stk_callback = body.get('stkCallback', {})

    if stk_callback:
        checkout_request_id = stk_callback.get('CheckoutRequestID') or stk_callback.get('MerchantRequestID')
        result_code = stk_callback.get('ResultCode')
        metadata = _extract_mpesa_metadata(stk_callback)
        receipt = metadata.get('MpesaReceiptNumber')
        amount = metadata.get('Amount')
        phone = metadata.get('PhoneNumber')
        try:
            parsed_result = int(result_code) if result_code is not None else None
        except (TypeError, ValueError):
            parsed_result = None
        try:
            parsed_amount = float(amount) if amount is not None else None
        except (TypeError, ValueError):
            parsed_amount = None
        return checkout_request_id, receipt, parsed_result, parsed_amount, phone

    # legacy payload shape fallback
    request_id = payload.get('requestId')
    receipt = payload.get('transactionId')
    status = payload.get('status')
    parsed_result = 0 if status == 'SUCCESS' else 1 if status else None
    return request_id, receipt, parsed_result, None, None


@router.post('/mpesa/callback')
async def mpesa_callback(request: Request):
    payload = await request.json()
    external_id, receipt, result_code, amount, phone = _extract_identifiers(payload)

    if not external_id:
        logger.warning('Ignoring callback without external request id')
        return {'status': 'accepted'}

    if result_code == 0:
        updated = mark_order_paid_by_external_id(
            external_id,
            receipt=receipt,
            callback_amount=amount,
            callback_phone=phone,
        )
        if not updated:
            logger.warning(
                'Ignoring successful callback that failed validation',
                extra={'external_tx_id': external_id, 'receipt': receipt, 'amount': amount, 'phone': phone},
            )
    else:
        mark_order_failed_by_external_id(external_id)

    return {'status': 'accepted'}


@router.post('/kcb/callback')
async def legacy_callback(request: Request):
    # Backward-compatible alias while clients migrate callback URLs.
    return await mpesa_callback(request)
