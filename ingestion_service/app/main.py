import logging

from fastapi import FastAPI, Request

from app.service import process_whatsapp

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)

app = FastAPI(title='Champs Closet Ingestion Service')


@app.post('/webhook/whatsapp')
async def whatsapp_webhook(request: Request):
    data = await request.form()
    await process_whatsapp(data)
    return {"status": "ok"}


@app.get('/health')
def health():
    return {"status": "ok"}
