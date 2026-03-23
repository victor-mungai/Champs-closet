from typing import List, Tuple


def parse_whatsapp_payload(data) -> Tuple[str | None, str, List[str]]:
    text = (data.get('Body') or '').strip()
    phone = data.get('From')

    image_urls: List[str] = []
    try:
        num_media = int(data.get('NumMedia') or 0)
    except Exception:
        num_media = 0

    if num_media > 0:
        for idx in range(num_media):
            url = data.get(f"MediaUrl{idx}")
            if url:
                image_urls.append(url)
    else:
        maybe_url = data.get('MediaUrl0')
        if maybe_url:
            image_urls.append(maybe_url)

    return phone, text, image_urls
