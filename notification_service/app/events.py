import logging

from pydantic import ValidationError

from app.config import ADMIN_PHONE, NOTIFICATION_SMS_DRY_RUN, NOTIFICATION_SMS_FAIL_OPEN
from app.formatter import build_admin_sms, build_sms
from app.idempotency import is_processed
from app.metrics import increment
from app.order_client import attach_receipt_url
from app.pdf import generate_invoice_pdf
from app.receipt_links import build_receipt_url, generate_token, store_link
from app.schemas import OrderEvent
from app.sms import send_sms
from app.storage import cleanup_file, upload_pdf

logger = logging.getLogger('notification_service.events')


def _send_with_policy(phone: str, message: str, metric_sent: str, metric_failed: str) -> None:
    try:
        send_sms(phone, message, force_log=NOTIFICATION_SMS_DRY_RUN)
        increment(metric_sent)
    except Exception:
        increment(metric_failed)
        if NOTIFICATION_SMS_FAIL_OPEN:
            logger.exception('SMS delivery failed in fail-open mode', extra={'phone': phone})
            return
        raise


def handle_event(event: dict) -> bool:
    try:
        parsed = OrderEvent.model_validate(event)
    except ValidationError as exc:
        increment('events_failed_total')
        raise ValueError(f'invalid_event:{exc}') from exc

    if parsed.event_type != 'order_paid':
        return False

    data = parsed.data

    if is_processed(data.order_id):
        logger.info('Duplicate order_paid ignored', extra={'order_id': data.order_id})
        return True

    logger.info('Processing order_paid', extra={'order_id': data.order_id, 'test': data.test})
    pdf_path = generate_invoice_pdf(data)
    try:
        destination_url = upload_pdf(pdf_path, data.order_id)
        token = generate_token(data.order_id)
        store_link(token, destination_url)
        receipt_link = build_receipt_url(token)

        try:
            attach_receipt_url(data.order_id, receipt_link)
        except Exception:
            logger.exception('Failed syncing receipt URL to order service', extra={'order_id': data.order_id})

        logger.info('Receipt PDF uploaded', extra={'order_id': data.order_id, 'link': receipt_link})
        customer_message = build_sms(data, receipt_link)
        _send_with_policy(data.phone, customer_message, 'customer_messages_sent_total', 'customer_messages_failed_total')

        if ADMIN_PHONE:
            admin_message = build_admin_sms(data, receipt_link)
            _send_with_policy(ADMIN_PHONE, admin_message, 'admin_messages_sent_total', 'admin_messages_failed_total')
    finally:
        cleanup_file(pdf_path)

    increment('events_processed_total')
    return True
