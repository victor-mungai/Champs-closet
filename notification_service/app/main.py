import threading

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import RedirectResponse

from app.consumer import consume
from app.logging import configure_logging
from app.metrics import render_prometheus, snapshot
from app.receipt_links import resolve_link

configure_logging()

app = FastAPI(title="Champs Closet Notification Service")


@app.on_event('startup')
def startup() -> None:
    thread = threading.Thread(target=consume, daemon=True)
    thread.start()


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/metrics')
def metrics() -> Response:
    return Response(render_prometheus(), media_type='text/plain; version=0.0.4')


@app.get('/metrics/json')
def metrics_json() -> dict[str, int]:
    return snapshot()


@app.get('/r/{token}')
def receipt_redirect(token: str):
    destination = resolve_link(token)
    if not destination:
        raise HTTPException(status_code=404, detail='Receipt link expired or not found')
    return RedirectResponse(destination, status_code=307)
