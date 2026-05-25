# Champs Closet Product Service

This service manages the product catalog and admin product management for Champs Closet. It publishes `product_created` events to Redis Streams for AI enrichment and downstream workflows.

## Features
- Customer-facing product catalog (list and detail)
- Admin product creation with optional Cloudinary image upload
- Tagging support via many-to-many relationship
- Redis Streams event publishing (`product_stream`)
- Firebase Auth protection for admin routes (can be disabled for local dev)

## Project Structure
```
product_service/
+-- app/
¦   +-- main.py
¦   +-- config.py
¦   +-- database.py
¦   +-- models.py
¦   +-- schemas.py
¦   +-- crud.py
¦   +-- events.py
¦   +-- storage.py
¦   +-- auth.py
¦   +-- routes/
¦   ¦   +-- products.py
¦   ¦   +-- admin.py
¦   ¦   +-- health.py
+-- requirements.txt
+-- Dockerfile
+-- README.md
```

## Environment Variables
Required for production:
- `SUPABASE_DB_URL`
- `REDIS_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Firebase Auth (admin routes):
- `FIREBASE_AUTH_DISABLED` (default `true` for local dev)
- `FIREBASE_CREDENTIALS` (path to service account JSON)
- `FIREBASE_PROJECT_ID`

## Local Setup
1. Change into the service directory:
```
cd product_service
```

2. Install dependencies:
```
pip install -r requirements.txt
```

3. Set environment variables:
```
SUPABASE_DB_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
FIREBASE_AUTH_DISABLED=true
```

4. Start the service:
```
uvicorn app.main:app --reload
```

## Endpoints
Public:
- `GET /health`
- `GET /products`
- `GET /products/{id}`
- `POST /products` (currently open; should be restricted in production)

Admin:
- `POST /admin/products` (Firebase Auth required unless disabled)

## Admin Create Example (multipart/form-data)
Fields:
- `name`, `category`, `price`, `stock`
- `description` (optional)
- `tags` (comma-separated string)
- `image` (optional file upload)
- `image_url` (optional; ignored if `image` provided)

## Notes
- If `SUPABASE_DB_URL` is not set, the service falls back to local SQLite at `./dev.db`.
- `product_created` events are published to `product_stream` with the product id, image, and tags.

