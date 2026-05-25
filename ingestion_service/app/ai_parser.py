import hashlib
import json
import re
import time

import httpx

from app.config import AI_PARSE_TTL_SECONDS, GEMINI_API_KEY, GEMINI_MODEL
from app.redis_client import redis_client

BANNED_PHRASES = [
    'new arrivals',
    'fully restocked',
    'top qualities',
    'available',
    'restocked',
    'now available',
]

BRAND_KEYWORDS = [
    'timberland',
    'nike',
    'airmax',
    'air max',
    'adidas',
    'jordan',
    'puma',
    'reebok',
    'vans',
    'converse',
    'new balance',
    'berluti',
    'cat',
    'dr martens',
    'clarks',
    'gucci',
    'balenciaga',
    'louis',
]

GENERIC_NAMES = {
    'shoe',
    'shoes',
    'sneaker',
    'sneakers',
    'boot',
    'boots',
    'footwear',
    'casual',
}

TOKEN_SPLIT_PATTERN = r"[,/\s]+"
COLOR_WORDS = {'navy', 'black', 'brown', 'coffee', 'white', 'grey', 'gray', 'blue', 'red', 'green'}


def _cache_key(text: str) -> str:
    digest = hashlib.sha256(text.encode('utf-8')).hexdigest()
    return f"ai_parse:{digest}"


def _clean_json(text: str) -> dict | None:
    stripped = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL | re.IGNORECASE)
    if fence_match:
        stripped = fence_match.group(1).strip()

    try:
        return json.loads(stripped)
    except Exception:
        pass

    obj_match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if obj_match:
        try:
            return json.loads(obj_match.group(0))
        except Exception:
            return None

    return None


def _remove_noise_words(value: str) -> str:
    cleaned = value
    for phrase in BANNED_PHRASES:
        cleaned = re.sub(re.escape(phrase), '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[*_????]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _clean_product_name(name: str) -> str:
    cleaned = _remove_noise_words(name)
    return cleaned.title()


def _looks_like_size_or_price(line: str) -> bool:
    lowered = line.lower()
    if 'size' in lowered or 'sizes' in lowered:
        return True
    if re.search(r"\b(ksh|kes|usd|sh)\b", lowered):
        return True
    if re.fullmatch(r"[\d\s\-_.]+", lowered):
        return True
    return False


def _contains_brand(text: str) -> bool:
    lowered = text.lower()
    return any(brand in lowered for brand in BRAND_KEYWORDS)


def _is_generic_name(name: str) -> bool:
    normalized = re.sub(r"[^a-zA-Z\s]", "", name).strip().lower()
    if not normalized:
        return True
    if normalized in GENERIC_NAMES:
        return True
    if len(normalized.split()) == 1 and normalized in GENERIC_NAMES:
        return True
    return False


def _best_name_from_text(text: str) -> str:
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    candidates: list[str] = []

    for line in lines:
        if _looks_like_size_or_price(line):
            continue
        cleaned = _remove_noise_words(line)
        if not cleaned:
            continue
        candidates.append(cleaned)

    if not candidates:
        return 'Shoe'

    for candidate in candidates:
        if _contains_brand(candidate):
            return _clean_product_name(candidate)

    candidates.sort(key=lambda v: len(v), reverse=True)
    return _clean_product_name(candidates[0])


def _expand_range(start: int, end: int) -> list[str]:
    if start > end:
        start, end = end, start
    if end - start > 30:
        return []
    return [str(n) for n in range(start, end + 1)]


def _expand_sizes(sizes: list[str]) -> list[str]:
    expanded: list[str] = []
    for size in sizes:
        s = str(size).strip().upper()
        if not s:
            continue
        s = s.replace('\u2013', '-').replace('\u2014', '-')
        if re.match(r"^\d{1,2}\s*[-_]\s*\d{1,2}$", s):
            parts = re.split(r"[-_]", s)
            try:
                expanded.extend(_expand_range(int(parts[0]), int(parts[1])))
            except Exception:
                continue
        elif re.fullmatch(r"\d{1,2}(?:\.\d)?", s):
            expanded.append(s)
    unique: list[str] = []
    for item in expanded:
        if item not in unique:
            unique.append(item)
    return unique


def _extract_sizes_fallback(text: str) -> list[str]:
    sizes: list[str] = []
    for match in re.finditer(r"(\d{1,2})\s*[-_]{1,}\s*(\d{1,2})", text):
        try:
            sizes.extend(_expand_range(int(match.group(1)), int(match.group(2))))
        except Exception:
            continue
    if not sizes:
        for num in re.findall(r"\b\d{1,2}\b", text):
            sizes.append(num)
    return _expand_sizes(sizes)


def _extract_colors_fallback(text: str) -> list[str]:
    colors: list[str] = []
    for group in re.findall(r"\(([^)]*)\)", text):
        parts = re.split(TOKEN_SPLIT_PATTERN, group)
        for part in parts:
            color = part.strip().lower()
            if color:
                colors.append(color)
    if not colors:
        words = re.findall(r"[a-zA-Z]+", text)
        for word in words:
            w = word.lower()
            if w in COLOR_WORDS:
                colors.append(w)
    return _clean_colors(colors)


def _clean_colors(colors: list[str]) -> list[str]:
    unique: list[str] = []
    for color in colors:
        c = color.strip().lower()
        if c and c not in unique:
            unique.append(c)
    return unique


def _extract_price_fallback(text: str) -> int | None:
    match = re.search(r"(\d{3,5})", text)
    if match:
        return int(match.group(1))
    return None


def _empty_parse_result() -> dict:
    return {
        'name': 'Shoe',
        'price': None,
        'sizes': [],
        'colors': [],
    }


def _cached_result(cache_key: str) -> dict | None:
    cached = redis_client.get(cache_key)
    if not cached:
        return None
    try:
        return json.loads(cached)
    except Exception:
        return None


def _build_prompt(text: str) -> str:
    return (
        "You are a strict data extraction engine.\n\n"
        "Extract structured product data from this WhatsApp supplier message:\n\n"
        f"\"{text}\"\n\n"
        "Return ONLY valid JSON (no markdown, no explanation):\n\n"
        "{\n"
        "  \"name\": string,\n"
        "  \"price\": number,\n"
        "  \"sizes\": array of strings,\n"
        "  \"colors\": array of strings\n"
        "}\n\n"
        "STRICT RULES:\n"
        "1. PRODUCT NAME\n"
        "- Remove ALL symbols like *, _, emojis\n"
        "- Remove words like \"New arrivals\", \"Fully restocked\", \"Top qualities\"\n"
        "- Keep only clean product name\n"
        "- Example: \"*AZAM CASUAL*\" -> \"Azam Casual\"\n\n"
        "2. PRICE\n"
        "- MUST extract from text\n"
        "- Examples: \"Ksh 3500\" -> 3500\n"
        "- NEVER default price\n"
        "- If price not found -> return price: null\n\n"
        "3. SIZES\n"
        "- Expand ranges: \"40-45\" -> [\"40\",\"41\",\"42\",\"43\",\"44\",\"45\"]\n"
        "- If single sizes -> return as list\n\n"
        "4. COLORS\n"
        "- Extract color words: \"Navy black coffee\" -> [\"navy\",\"black\",\"coffee\"]\n"
        "- Also detect colors in parentheses\n\n"
        "5. NORMALIZATION\n"
        "- name must be Title Case\n"
        "- colors must be lowercase\n"
        "- sizes must be strings\n\n"
        "6. OUTPUT\n"
        "- MUST be valid JSON\n"
        "- NO markdown\n"
        "- NO backticks\n"
    )


def _fetch_raw_ai_output(prompt: str, headers: dict[str, str]) -> str:
    with httpx.Client(timeout=10) as client:
        resp = client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            headers=headers,
        )
        resp.raise_for_status()
    return resp.json()['candidates'][0]['content']['parts'][0]['text']


def _normalize_name(parsed: dict, text: str) -> str:
    raw_name = str(parsed.get('name') or '').strip()
    name = _clean_product_name(raw_name) if raw_name else ''
    if not name or _is_generic_name(name):
        return _best_name_from_text(text)
    return name


def _normalize_price(parsed: dict, text: str) -> int:
    price = parsed.get('price')
    if price is None:
        price = _extract_price_fallback(text)
    if price is None or (isinstance(price, (int, float)) and price <= 0):
        raise RuntimeError('Invalid price from AI')
    return int(price)


def _normalize_sizes(parsed: dict, text: str) -> list[str]:
    sizes = parsed.get('sizes') or []
    if isinstance(sizes, str):
        sizes = re.split(TOKEN_SPLIT_PATTERN, sizes)
    normalized = _expand_sizes(sizes)
    if normalized:
        return normalized
    return _extract_sizes_fallback(text)


def _normalize_colors(parsed: dict, text: str) -> list[str]:
    colors = parsed.get('colors') or []
    if isinstance(colors, str):
        colors = re.split(TOKEN_SPLIT_PATTERN, colors)
    normalized = _clean_colors(colors)
    if normalized:
        return normalized
    return _extract_colors_fallback(text)


def _build_ai_result(parsed: dict, text: str) -> dict:
    return {
        'name': _normalize_name(parsed, text),
        'price': _normalize_price(parsed, text),
        'sizes': _normalize_sizes(parsed, text),
        'colors': _normalize_colors(parsed, text),
    }


def _parse_with_ai(text: str, prompt: str, headers: dict[str, str]) -> dict:
    raw_text = _fetch_raw_ai_output(prompt, headers)
    parsed = _clean_json(raw_text)
    if not parsed:
        raise RuntimeError('Invalid AI output')
    return _build_ai_result(parsed, text)


def _parse_with_retries(text: str, prompt: str, headers: dict[str, str]) -> dict | None:
    for attempt in range(3):
        try:
            return _parse_with_ai(text, prompt, headers)
        except Exception:
            if attempt == 2:
                return None
            time.sleep(2 ** attempt)
    return None


def _fallback_parse(text: str) -> dict:
    return {
        'name': _best_name_from_text(text),
        'price': _extract_price_fallback(text),
        'sizes': _extract_sizes_fallback(text),
        'colors': _extract_colors_fallback(text),
    }


def parse_product_text(text: str) -> dict:
    if not text:
        return _empty_parse_result()

    if not GEMINI_API_KEY:
        return _fallback_parse(text)

    cache_key = _cache_key(text)
    cached = _cached_result(cache_key)
    if cached:
        return cached

    prompt = _build_prompt(text)
    headers = {"x-goog-api-key": GEMINI_API_KEY or ''}
    result = _parse_with_retries(text, prompt, headers)
    if not result:
        return _fallback_parse(text)

    redis_client.set(cache_key, json.dumps(result), ex=AI_PARSE_TTL_SECONDS)
    return result
