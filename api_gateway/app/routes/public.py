from datetime import date

from fastapi import APIRouter, Request, Response

from app.config import NOTIFICATION_SERVICE_URL, ORDER_SERVICE_URL, PRODUCT_SERVICE_URL, SITE_BASE_URL
from app.services.proxy import build_forward_headers, get_http_client, proxy_request

router = APIRouter(tags=['public'])

CATEGORY_SLUGS = ['shirts', 'shoes', 'vests', 'trousers', 'sweaters']


def slugify(value: str) -> str:
    return '-'.join(filter(None, ''.join(ch.lower() if ch.isalnum() else '-' for ch in value).split('-')))


def product_slug(name: str, product_id: int) -> str:
    base = slugify(name or 'product') or 'product'
    return f'{base}-{product_id}'


async def _fetch_all_products() -> list[dict]:
    client = get_http_client()
    offset = 0
    limit = 100
    rows: list[dict] = []

    while True:
        response = await client.get(
            f'{PRODUCT_SERVICE_URL}/products/',
            params={'limit': limit, 'offset': offset},
        )
        if response.status_code != 200:
            break

        payload = response.json()
        if not isinstance(payload, list) or not payload:
            break

        rows.extend([item for item in payload if isinstance(item, dict)])

        if len(payload) < limit:
            break
        offset += limit

    return rows


def _build_sitemap_xml(products: list[dict]) -> str:
    today = date.today().isoformat()
    static_urls = [
        {'loc': f'{SITE_BASE_URL}/', 'changefreq': 'daily', 'priority': '1.0'},
        {'loc': f'{SITE_BASE_URL}/faq', 'changefreq': 'weekly', 'priority': '0.4'},
        {'loc': f'{SITE_BASE_URL}/catalog/all', 'changefreq': 'daily', 'priority': '0.9'},
    ]
    static_urls.extend(
        {
            'loc': f'{SITE_BASE_URL}/catalog/{category}',
            'changefreq': 'daily',
            'priority': '0.8',
        }
        for category in CATEGORY_SLUGS
    )

    dynamic_urls = []
    for product in products:
        product_id = product.get('id')
        if not isinstance(product_id, int):
            continue
        name = str(product.get('name') or 'product')
        dynamic_urls.append(
            {
                'loc': f"{SITE_BASE_URL}/product/{product_slug(name, product_id)}",
                'changefreq': 'daily',
                'priority': '0.7',
            }
        )

    all_urls = [*static_urls, *dynamic_urls]

    body = ''.join(
        (
            '<url>'
            f"<loc>{entry['loc']}</loc>"
            f'<lastmod>{today}</lastmod>'
            f"<changefreq>{entry['changefreq']}</changefreq>"
            f"<priority>{entry['priority']}</priority>"
            '</url>'
        )
        for entry in all_urls
    )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f'{body}'
        '</urlset>'
    )


@router.post('/mpesa/callback')
async def mpesa_callback(request: Request):
    return await proxy_request(
        'POST',
        f'{ORDER_SERVICE_URL}/mpesa/callback',
        headers=build_forward_headers(request, forward_content_type=True),
        content=await request.body(),
    )


@router.post('/kcb/callback')
async def legacy_callback(request: Request):
    return await mpesa_callback(request)


@router.get('/r/{token}')
async def receipt_redirect(token: str):
    return await proxy_request('GET', f'{NOTIFICATION_SERVICE_URL}/r/{token}')


@router.get('/sitemap.xml')
async def sitemap_xml():
    products = await _fetch_all_products()
    xml = _build_sitemap_xml(products)
    return Response(content=xml, media_type='application/xml')


@router.get('/robots.txt')
async def robots_txt():
    content = f'User-agent: *\nAllow: /\n\nSitemap: {SITE_BASE_URL}/sitemap.xml\n'
    return Response(content=content, media_type='text/plain')
