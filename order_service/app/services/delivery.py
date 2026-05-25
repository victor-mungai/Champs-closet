import logging
import math

import httpx

from app.config import GOOGLE_MAPS_API_KEY, SHOP_LAT, SHOP_LNG

logger = logging.getLogger('order_service.delivery')


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c


def _fallback_fee(dest_lat: float, dest_lng: float, reason: str) -> float:
    # Road travel is usually longer than straight-line distance, so we pad the
    # Haversine estimate slightly instead of failing checkout entirely.
    km = _haversine_km(SHOP_LAT, SHOP_LNG, dest_lat, dest_lng) * 1.2
    fee = float(round(km * 40))
    logger.warning(
        'Using fallback delivery fee estimate',
        extra={'reason': reason, 'distance_km': round(km, 2), 'fee': fee},
    )
    return fee


def calculate_delivery_fee(dest_lat: float, dest_lng: float) -> float:
    if not GOOGLE_MAPS_API_KEY:
        return _fallback_fee(dest_lat, dest_lng, 'missing_google_maps_api_key')

    origin = f'{SHOP_LAT},{SHOP_LNG}'
    destination = f'{dest_lat},{dest_lng}'

    try:
        with httpx.Client(timeout=10) as client:
            res = client.get(
                'https://maps.googleapis.com/maps/api/distancematrix/json',
                params={
                    'origins': origin,
                    'destinations': destination,
                    'key': GOOGLE_MAPS_API_KEY,
                },
            )
            res.raise_for_status()
            data = res.json()
    except Exception as exc:
        return _fallback_fee(dest_lat, dest_lng, f'http_error:{exc}')

    if data.get('status') != 'OK':
        return _fallback_fee(dest_lat, dest_lng, f"api_status:{data.get('status')}")

    rows = data.get('rows') or []
    elements = rows[0].get('elements') if rows else []
    element = elements[0] if elements else {}

    if element.get('status') != 'OK':
        return _fallback_fee(dest_lat, dest_lng, f"element_status:{element.get('status')}")

    distance = element.get('distance') or {}
    meters = distance.get('value')
    if meters is None:
        return _fallback_fee(dest_lat, dest_lng, 'missing_distance_value')

    km = float(meters) / 1000.0
    return float(round(km * 40))
