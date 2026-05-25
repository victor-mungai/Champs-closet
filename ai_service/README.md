# Champs Closet AI Service

This service listens to product creation events, uses Gemini to generate descriptions + tags, updates the Product Service, and emits enrichment events.

## Environment Variables
- `REDIS_URL=redis://redis:6379`
- `GEMINI_API_KEY=your_key`
- `PRODUCT_SERVICE_URL=http://product-service:8000`
- `PRODUCT_STREAM=product_stream`

## Run
```
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Health
`GET /health`
