import base64
import json
import re
import httpx

from app.config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT


def _build_payload(image_bytes: bytes, mime_type: str, prompt: str):
    return {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image_bytes).decode('utf-8'),
                        }
                    },
                ]
            }
        ]
    }


def _parse_response(data: dict):
    text = ''
    try:
        text = data['candidates'][0]['content']['parts'][0]['text']
    except Exception:
        return None
    return text


def _extract_json(text: str) -> dict | None:
    stripped = text.strip()
    # Remove fenced blocks if present
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL | re.IGNORECASE)
    if fence_match:
        candidate = fence_match.group(1)
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # Try raw JSON
    try:
        return json.loads(stripped)
    except Exception:
        pass

    # Try to salvage first JSON object in text
    obj_match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if obj_match:
        candidate = obj_match.group(0)
        try:
            return json.loads(candidate)
        except Exception:
            return None
    return None


def generate_description_and_tags(image_url: str) -> dict | None:
    if not GEMINI_API_KEY:
        raise RuntimeError('GEMINI_API_KEY is not set')

    prompt = (
        "Analyze this clothing image and return JSON with:\n"
        "- description: A compelling and detailed explanation of the product, its unique features, the materials it's made from, and styling suggestions for complementary clothing, what type of clothing goes with it and A brief description of the ideal customer (e.g., 'urban professionals,' 'outdoor enthusiasts')\n"
        "- tags: 5-10 relevant, lowercase fashion tags for categorization and SEO\n"
        "Return only valid JSON."
    )

    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
    }

    with httpx.Client(timeout=GEMINI_TIMEOUT) as client:
        image_resp = client.get(image_url)
        image_resp.raise_for_status()
        mime_type = image_resp.headers.get('content-type', 'image/jpeg')
        payload = _build_payload(image_resp.content, mime_type, prompt)

        resp = client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        text = _parse_response(resp.json())

    if not text:
        return None

    parsed = _extract_json(text)
    if parsed is not None:
        return parsed

    return {
        "description": text.strip(),
        "tags": [],
    }
