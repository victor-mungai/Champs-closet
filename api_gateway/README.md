# Champs Closet API Gateway

Central entry point for frontend traffic. It proxies requests to internal services and enforces Firebase admin auth for protected routes.

## Features
- Unified routing to Product + Order services
- Firebase admin verification middleware
- Centralized request logging
- Request ID tracing (`X-Request-ID`) across gateway -> internal services
- Built-in in-memory rate limiting with standard rate-limit headers
- Configurable service URLs via environment variables
- Error normalization for upstream failures

## Environment Variables
- `PRODUCT_SERVICE_URL`
- `ORDER_SERVICE_URL`
- `INGESTION_SERVICE_URL`
- `AI_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `FIREBASE_AUTH_DISABLED`
- `FIREBASE_CREDENTIALS_PATH`
- `CORS_ALLOW_ORIGINS`
- `HTTP_TIMEOUT_SECONDS`
- `REQUEST_ID_HEADER`
- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_REQUESTS`
- `RATE_LIMIT_WINDOW_SECONDS`

Use `.env.example` as your baseline.

## Run Locally
```powershell
cd api_gateway
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

## Route Summary
Public:
- `GET /products`
- `GET /products/{id}`
- `POST /orders`
- `POST /orders/delivery-quote`
- `GET /health`

Admin-protected (Firebase custom claim `admin: true`):
- `POST /products`
- `PATCH /products/{id}`
- `DELETE /products/{id}`
- `GET /orders`
- `GET /orders/{id}`
- `GET /orders/metrics`
- `POST /admin/orders`

## Response Headers
- `X-Request-ID`: request trace identifier
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Window`
- `Retry-After` (only when rate limited)
