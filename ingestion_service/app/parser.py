import re

BANNED_PHRASES = [
    'fully restocked',
    'now available',
    'available',
    'restocked',
    'new arrivals',
    'arrival',
    'just in',
]

STOPWORDS = {
    'size',
    'sizes',
    'ksh',
    'kes',
    'usd',
    'sh',
    'shoes',
    'shoe',
    'new',
    'arrivals',
    'arrival',
    'available',
    'restocked',
    'fully',
    'now',
}

STYLE_KEYWORDS = {'casual', 'boots', 'boot', 'laced', 'sneakers', 'sneaker', 'lowtop', 'low-top'}


def _normalize_line(line: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s]", "", line.lower()).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def _is_banned(line: str) -> bool:
    normalized = _normalize_line(line)
    if not normalized:
        return True
    for phrase in BANNED_PHRASES:
        if normalized == phrase:
            return True
    return False


def _looks_like_size_or_price(line: str) -> bool:
    lowered = line.lower()
    if 'size' in lowered or 'sizes' in lowered:
        return True
    if re.search(r"\b(ksh|kes|usd|sh)\b", lowered):
        return True
    if re.fullmatch(r"[\d\s\-_.]+", lowered):
        return True
    return False


def _extract_price(text: str) -> int:
    # number before currency
    match = re.search(r"(\d{2,6})\s*(ksh|kes|usd|dollars|sh)", text, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # currency before number
    match = re.search(r"(ksh|kes|usd|dollars|sh)\s*(\d{2,6})", text, re.IGNORECASE)
    if match:
        return int(match.group(2))

    # remove size range patterns to avoid grabbing 40/45
    cleaned = re.sub(r"\b\d{1,2}\s*[-_]{1,}\s*\d{1,2}\b", " ", text)
    cleaned = re.sub(r"\bsize\b.*", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bsizes\b.*", " ", cleaned, flags=re.IGNORECASE)

    numbers = [int(n) for n in re.findall(r"\d{2,6}", cleaned)]
    if numbers:
        return max(numbers)

    return 500


def _expand_range(start: int, end: int) -> list[str]:
    if start > end:
        start, end = end, start
    if end - start > 25:
        return []
    return [str(n) for n in range(start, end + 1)]


def _extract_sizes(text: str) -> list[str]:
    sizes: list[str] = []

    for match in re.finditer(r"(\d{1,2})\s*[-_]{1,}\s*(\d{1,2})", text):
        try:
            start = int(match.group(1))
            end = int(match.group(2))
        except Exception:
            continue
        sizes.extend(_expand_range(start, end))

    for line in text.split('\n'):
        if re.search(r"\bsize|sizes|sz\b", line, re.IGNORECASE):
            for num in re.findall(r"\d{1,2}(?:\.\d)?", line):
                if num not in sizes:
                    sizes.append(num)

    unique = []
    for size in sizes:
        if size not in unique:
            unique.append(size)
    return unique


def _extract_colors(text: str) -> list[str]:
    colors: list[str] = []
    for group in re.findall(r"\(([^)]*)\)", text):
        parts = re.split(r"[,/]", group)
        for part in parts:
            color = part.strip().lower()
            if color and color not in colors:
                colors.append(color)
    return colors


def _extract_tags(name: str, text: str) -> list[str]:
    tags: list[str] = []
    tokens = re.findall(r"[a-z0-9]+", name.lower())
    for token in tokens:
        if token in STOPWORDS:
            continue
        if len(token) < 3 and not token.isdigit():
            continue
        if token not in tags:
            tags.append(token)

    for keyword in STYLE_KEYWORDS:
        if keyword in name.lower() and keyword not in tags:
            tags.append(keyword)

    for color in _extract_colors(text):
        if color not in tags:
            tags.append(color)

    return tags


def parse_text(text: str) -> dict:
    lines = [line.strip() for line in text.strip().split('\n') if line.strip()]

    name = 'Shoe'
    for line in lines:
        if _is_banned(line):
            continue
        if _looks_like_size_or_price(line):
            continue
        name = line
        break

    price = _extract_price(text)
    sizes = _extract_sizes(text)
    tags = _extract_tags(name, text)

    return {
        'name': name,
        'price': price,
        'category': 'shoes',
        'sizes': sizes,
        'tags': tags,
    }
