import type { Product } from '../types';
import { buildProductPath } from './productUrl';

const FALLBACK_WHATSAPP_NUMBER = '254700000000';

const sanitizeNumber = (value: string | undefined) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length > 0 ? digits : FALLBACK_WHATSAPP_NUMBER;
};

const getOrigin = () => {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
};

export const buildProductUrl = (product: Pick<Product, 'id' | 'name'>) => {
  const basePath = buildProductPath(product);
  return `${getOrigin()}${basePath}?source=whatsapp`;
};

export const buildProductInquiryMessage = (product: Product) => {
  const category = product.category || 'Product';
  const productUrl = buildProductUrl(product);

  return (
    "Hello, I'm interested in this product:\n\n" +
    `Name: ${product.name}\n` +
    `Price: ${product.price} Ksh\n` +
    `Category: ${category}\n\n` +
    `View product:\n${productUrl}\n\n` +
    'Is it available?'
  );
};

export const buildProductWhatsAppLink = (product: Product) => {
  const configured = (import.meta as any).env?.VITE_WHATSAPP_NUMBER as string | undefined;
  const whatsappNumber = sanitizeNumber(configured);
  const message = encodeURIComponent(buildProductInquiryMessage(product));
  return `https://wa.me/${whatsappNumber}?text=${message}`;
};
