#  Champ’s Closet — Event-Driven E-Commerce Platform

##  Overview

Champ’s Closet is a modern, mobile-first e-commerce platform focused on men’s fashion, with shirts as the primary product offering.

The system is designed using a **lightweight microservices architecture**, optimized for:

* Fast product browsing
* Seamless M-Pesa payments (STK Push)
* Automated AI-generated product descriptions
* Real-time WhatsApp notifications
* Scalable event-driven workflows

---

##  Core Features

###  Customer Experience

* Clean, editorial-style product catalog
* Category-based browsing (Shirts, Jeans, Shoes, etc.)
* Product detail view with:

  * Size & color selection
  * AI-generated descriptions
* Fast checkout using **M-Pesa STK Push**
* Delivery area selection (Kitengela-focused)
* Instant WhatsApp receipt after payment

---

### Admin Console

* Dashboard with:

  * Total sales
  * Orders today
  * M-Pesa success rate
* Product management:

  * Add/edit products
  * Upload images
  * Auto-generate descriptions via AI
* Inventory tracking
* Transaction logs with filtering:

  * Status (completed, pending, failed)
  * Delivery area
  * Date range
* WhatsApp alerts for new orders

---

##  Architecture Overview

The system follows a **microservices + event-driven architecture**:

```
Frontend (Customer + Admin)
        ↓
API Gateway (FastAPI BFF)
        ↓
-------------------------------------------------
| Product | Order | Payment | Admin | Auth       |
-------------------------------------------------
        ↓
PostgreSQL (Core Data)

Event Bus → Redis Streams
        ↓
-----------------------------------------
| AI Service | Receipt/Notification     |
-----------------------------------------
        ↓
External Services:
- WhatsApp API
- AI (Gemini)
- Image Storage (Cloudinary)
- Firebase Authentication
```

---

##  Tech Stack

### Backend

* FastAPI (Python)
* PostgreSQL
* Redis (Streams + Caching)

### External Services

* Firebase Authentication (user auth)
* Cloudinary (image storage & optimization)
* Gemini (AI for descriptions & tagging)
* WhatsApp API (customer + admin notifications)
* M-Pesa STK Push (payments)

### DevOps 

* Docker
* Kubernetes
* CI/CD (GitHub Actions)

---

##  Event-Driven Design

The system uses **Redis Streams** to enable asynchronous communication between services.

### Key Events

* `product_created`
* `product_ai_enriched`
* `order_created`
* `payment_successful`
* `receipt_sent`
* `admin_notified`

---

### Example Event

```json
{
  "event_type": "payment_successful",
  "timestamp": "2026-03-19T10:00:00Z",
  "data": {
    "order_id": "123",
    "phone_number": "2547XXXXXXX",
    "amount": 1000,
    "mpesa_receipt": "ABC123XYZ",
    "items": [],
    "delivery_area": "Kitengela Mall"
  }
}
```

---

##  Key Workflows

###  Product Creation (Admin)

1. Admin uploads product + image
2. Image stored via Cloudinary
3. Product saved with empty description
4. Event emitted: `product_created`
5. AI Service:

   * Generates description + tags
   * Updates product
6. Event emitted: `product_ai_enriched`

---

###  Purchase Flow

1. User selects product and checkout
2. Order Service creates order
3. Payment Service triggers M-Pesa STK Push
4. User completes payment
5. M-Pesa sends callback
6. Payment Service emits `payment_successful`

---

###  Notifications

Triggered by `payment_successful`:

* WhatsApp receipt sent to customer
* WhatsApp alert sent to admin

---

##  Microservices

| Service              | Responsibility             |
| -------------------- | -------------------------- |
| API Gateway          | Routing & aggregation      |
| Product Service      | Products, categories, tags |
| Order Service        | Orders & cart logic        |
| Payment Service      | M-Pesa integration         |
| AI Service           | Description + tagging      |
| Receipt/Notification | WhatsApp messaging         |
| Admin Service        | Metrics & reporting        |

---

##  Data Model (Core)

### Products

* id
* name
* category
* price
* image_url
* description
* stock

### Orders

* id
* status
* total_amount
* phone_number
* delivery_area

### Payments

* id
* order_id
* amount
* status
* mpesa_receipt

### Tags

* id
* name

---

##  Performance Optimizations

* Redis caching for product listings
* Image CDN via Cloudinary
* Async processing for AI + notifications
* Lightweight microservices (no over-engineering)

---

##  Future Enhancements

* Recommendation engine (based on tags)
* Email notifications
* Admin analytics expansion
* Kafka migration (if scaling requires it)
* Mobile app integration

---

## Design Philosophy

* Keep services **loosely coupled**
* Prefer **async over blocking operations**
* Optimize for **speed and simplicity**
* Build for **real-world scalability without early complexity**

---

## Local Startup Guide (All Services)

Use these steps from the project root (`c:\work\Champs-closet`) to run the full stack locally.

### 1. Prerequisites

* Python 3.12+
* Node.js 20+
* Docker Desktop (for Redis)
* Valid `.env` files in:
  * `product_service/.env`
  * `ai_service/.env`
  * `ingestion_service/.env`
  * `order_service/.env`
  * `notification_service/.env`
  * `UI/.env`

### 2. Start Redis (required by all async services)

```powershell
docker compose up -d redis
```

### 3. Start Product Service (port 8000)

```powershell
cd product_service
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start AI Service (port 8001)

```powershell
cd ai_service
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 5. Start WhatsApp Ingestion Service (port 8002)

```powershell
cd ingestion_service
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

### 6. Start Order Service (port 8003)

```powershell
cd order_service
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```

### 7. Start Notification Service (port 8004)

```powershell
cd notification_service
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8004
```

### 8. Start UI (port 3000)

```powershell
cd UI
npm install
npm run dev
```

### 9. Quick Health Checks

```powershell
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```


