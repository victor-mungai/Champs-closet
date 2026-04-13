import type { Product } from '../types';

const isAsciiAlphaNumeric = (char: string) => {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 97 && code <= 122) // a-z
  );
};

export const slugify = (value: string) => {
  const normalized = value.toLowerCase().trim();
  let slug = '';
  let lastWasHyphen = false;

  for (const char of normalized) {
    if (isAsciiAlphaNumeric(char)) {
      slug += char;
      lastWasHyphen = false;
      continue;
    }

    if (!lastWasHyphen && slug.length > 0) {
      slug += '-';
      lastWasHyphen = true;
    }
  }

  if (slug.endsWith('-')) {
    slug = slug.slice(0, -1);
  }

  return slug;
};

export const buildProductPath = (product: Pick<Product, 'id' | 'name'>) => {
  return `/product/${slugify(product.name)}-${product.id}`;
};

export const parseProductIdFromSlug = (value?: string | null) => {
  if (!value) return null;
  let end = value.length - 1;

  while (end >= 0 && value[end] === '/') {
    end -= 1;
  }

  if (end < 0) return null;

  let start = end;
  while (start >= 0) {
    const code = value.charCodeAt(start);
    if (code < 48 || code > 57) {
      break;
    }
    start -= 1;
  }

  if (start === end) return null;
  return value.slice(start + 1, end + 1);
};

export const extractAlphaNumericTokens = (value: string) => {
  const normalized = value.toLowerCase();
  const tokens: string[] = [];
  let currentToken = '';

  for (const char of normalized) {
    if (isAsciiAlphaNumeric(char)) {
      currentToken += char;
      continue;
    }

    if (currentToken.length > 0) {
      tokens.push(currentToken);
      currentToken = '';
    }
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
};
