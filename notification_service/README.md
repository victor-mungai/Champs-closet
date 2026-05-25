# Champs Closet Notification Service

Consumes `order_paid` events, generates branded PDF receipts, uploads them to Supabase Storage, and sends SMS receipt links through Africa's Talking direct HTTP API.

## Environment
- `REDIS_URL`
- `STREAM_NAME=order_events`
- `CONSUMER_GROUP`
- `CONSUMER_NAME`
- `DLQ_STREAM`
- `AT_API_KEY`
- `AT_USERNAME=sandbox` for sandbox mode
- `AT_SENDER_ID` for production sender IDs
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET=receipts`
- `APP_ENV=sandbox` or `production`
- `ADMIN_PHONE`
- `SECRET_KEY` for secure receipt token generation
- `RECEIPT_LINK_BASE_URL` for customer/admin links (example `http://localhost:8004`)
- `RECEIPT_LINK_TTL_SECONDS` token + signed URL lifetime
- `ORDER_SERVICE_URL` (example `http://localhost:8003`)
- `ORDER_SERVICE_INTERNAL_TOKEN` shared secret for service-to-service receipt sync
- `NOTIFICATION_SMS_DRY_RUN=false` to send real sandbox/production SMS, `true` to log only
- `NOTIFICATION_SMS_FAIL_OPEN=true` continue event processing when SMS delivery fails
- `SMS_MAX_RETRIES=3`
- `SMS_RETRY_BASE_SECONDS=1.0`
- `AT_DISABLE_PROXY=true` to ignore `HTTP_PROXY/HTTPS_PROXY` during SMS sends (helps SSL wrong version issues)

## Run
```powershell
cd notification_service
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8004
```

## Endpoints
- `GET /health`
- `GET /metrics`
- `GET /metrics/json`
- `GET /r/{token}` secure receipt redirect
