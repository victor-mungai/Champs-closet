import logging
import threading

from fastapi import FastAPI

from app.consumer import consume
from app.metrics import metrics

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)

app = FastAPI(title='Champs Closet AI Service')


@app.on_event('startup')
def start_consumer():
    thread = threading.Thread(target=consume, daemon=True)
    thread.start()


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/metrics')
def metrics_endpoint():
    return metrics.snapshot()
