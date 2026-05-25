import logging
import os
import subprocess
import time
from contextlib import contextmanager

import requests

from app.config import (
    APP_ENV,
    AT_API_KEY,
    AT_CURL_FALLBACK,
    AT_DISABLE_PROXY,
    AT_SENDER_ID,
    AT_USERNAME,
    SMS_MAX_RETRIES,
    SMS_RETRY_BASE_SECONDS,
)

logger = logging.getLogger('notification_service.sms')


@contextmanager
def _proxy_sanitized(disable_proxy: bool):
    if not disable_proxy:
        yield
        return

    keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
    saved = {key: os.environ.get(key) for key in keys}
    for key in keys:
        os.environ.pop(key, None)

    try:
        yield
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _normalize_phone(phone: str) -> str:
    raw = phone.strip()
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if digits.startswith('0'):
        digits = f'254{digits[1:]}'
    elif digits.startswith('7'):
        digits = f'254{digits}'
    elif digits.startswith('1'):
        digits = f'254{digits}'
    return f'+{digits}' if digits else ''


def _sms_url() -> str:
    return (
        'https://api.sandbox.africastalking.com/version1/messaging'
        if AT_USERNAME == 'sandbox'
        else 'https://api.africastalking.com/version1/messaging'
    )


def _build_payload(phone: str, message: str) -> dict[str, str]:
    payload = {
        'username': AT_USERNAME,
        'to': phone,
        'message': message,
    }
    if APP_ENV != 'sandbox' and AT_SENDER_ID:
        payload['from'] = AT_SENDER_ID
    return payload


def _send_via_direct_api(phone: str, message: str) -> requests.Response:
    if not AT_API_KEY:
        raise RuntimeError("Africa's Talking configuration is incomplete")

    url = _sms_url()
    payload = _build_payload(phone, message)
    proxies = {'http': None, 'https': None} if AT_DISABLE_PROXY else None

    with requests.Session() as session:
        if AT_DISABLE_PROXY:
            session.trust_env = False
            session.proxies = {'http': None, 'https': None}
        response = session.post(
            url,
            headers={
                'apiKey': AT_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json, text/xml, */*',
            },
            data=payload,
            proxies=proxies,
            timeout=20,
        )

    if not response.ok:
        raise RuntimeError(f'Direct SMS API failed ({response.status_code}): {response.text}')
    return response


def _send_via_curl_api(phone: str, message: str) -> None:
    if not AT_API_KEY:
        raise RuntimeError("Africa's Talking configuration is incomplete")

    url = _sms_url()
    curl_binaries = ['curl.exe', 'curl']
    sender = AT_SENDER_ID if APP_ENV != 'sandbox' and AT_SENDER_ID else None

    last_error: Exception | None = None
    for binary in curl_binaries:
        cmd = [
            binary,
            '--silent',
            '--show-error',
            '--fail-with-body',
            '--max-time',
            '20',
            '--noproxy',
            '*',
            '-X',
            'POST',
            url,
            '-H',
            f'apiKey: {AT_API_KEY}',
            '-H',
            'Content-Type: application/x-www-form-urlencoded',
            '--data-urlencode',
            f'username={AT_USERNAME}',
            '--data-urlencode',
            f'to={phone}',
            '--data-urlencode',
            f'message={message}',
        ]
        if sender:
            cmd.extend(['--data-urlencode', f'from={sender}'])

        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
        except FileNotFoundError as exc:
            last_error = exc
            continue

        if result.returncode != 0:
            details = (result.stderr or result.stdout or '').strip()
            raise RuntimeError(f'curl SMS fallback failed ({result.returncode}): {details}')

        logger.info('SMS sent via curl fallback', extra={'phone': phone, 'preview': result.stdout[:160]})
        return

    if last_error:
        raise RuntimeError('curl binary not found for SMS fallback') from last_error
    raise RuntimeError('curl fallback failed unexpectedly')


def send_sms(phone: str, message: str, *, force_log: bool = False) -> None:
    normalized_phone = _normalize_phone(phone)
    if not normalized_phone.startswith('+254') or len(normalized_phone) < 13:
        raise ValueError(f'Invalid phone number after normalization: {normalized_phone or "<empty>"}')

    if force_log:
        logger.info('SMS dry run', extra={'phone': normalized_phone, 'preview': message[:160]})
        return

    attempts = max(1, SMS_MAX_RETRIES)
    for attempt in range(1, attempts + 1):
        try:
            logger.info(
                "Sending SMS via Africa's Talking direct API",
                extra={'phone': normalized_phone, 'app_env': APP_ENV, 'attempt': attempt},
            )
            with _proxy_sanitized(AT_DISABLE_PROXY):
                response = _send_via_direct_api(normalized_phone, message)
            logger.info(
                'SMS sent',
                extra={'phone': normalized_phone, 'status_code': response.status_code},
            )
            return
        except requests.exceptions.SSLError as exc:
            logger.warning(
                'SMS SSL error',
                extra={'phone': normalized_phone, 'attempt': attempt, 'error': str(exc)},
            )
            if AT_CURL_FALLBACK:
                logger.info('Trying curl SMS fallback', extra={'phone': normalized_phone})
                _send_via_curl_api(normalized_phone, message)
                return

            is_last_attempt = attempt >= attempts
            if is_last_attempt:
                raise RuntimeError(
                    'SMS SSL handshake failed. Check HTTPS proxy settings and ensure sandbox endpoint is reachable over TLS.'
                ) from exc

            sleep_seconds = SMS_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                'Retrying SMS after SSL error',
                extra={'phone': normalized_phone, 'attempt': attempt, 'sleep_seconds': sleep_seconds},
            )
            time.sleep(sleep_seconds)
        except requests.exceptions.RequestException as exc:
            logger.warning(
                'SMS transport error',
                extra={'phone': normalized_phone, 'attempt': attempt, 'error': str(exc)},
            )
            if AT_CURL_FALLBACK:
                logger.info('Trying curl SMS fallback', extra={'phone': normalized_phone})
                _send_via_curl_api(normalized_phone, message)
                return

            is_last_attempt = attempt >= attempts
            if is_last_attempt:
                raise RuntimeError(f'SMS transport error after {attempts} attempts: {exc}') from exc

            sleep_seconds = SMS_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                'Retrying SMS after transport error',
                extra={'phone': normalized_phone, 'attempt': attempt, 'sleep_seconds': sleep_seconds},
            )
            time.sleep(sleep_seconds)
