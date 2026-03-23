import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, CheckCircle2, Package, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import ProductImageViewer from '../components/ProductImageViewer';
import { useCart } from '../context/CartContext';
import { fetchProduct } from '../services/api';
import type { Product } from '../types';

const MpesaButton = ({ onClick, className = '' }: { onClick?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`w-full bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-full py-4 px-6 font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#4CAF50]/20 ${className}`}
  >
    <Lock className="w-5 h-5" />
    Pay with M-Pesa
  </button>
);

const fallbackSizes = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('shoe')) return ['40', '41', '42', '43', '44'];
  if (normalized.includes('jean') || normalized.includes('trouser')) return ['30', '32', '34', '36'];
  if (normalized.includes('vest') || normalized.includes('sweater') || normalized.includes('shirt')) return ['S', 'M', 'L', 'XL', '2XL'];
  return ['M', 'L', 'XL'];
};

const parseDescription = (value?: string | null) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"description"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.description === 'string') {
        return parsed.description;
      }
    } catch {
      return value;
    }
  }
  return value;
};

const formatCurrency = (amount: number) => amount.toLocaleString('en-KE');

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('light');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    fetchProduct(id)
      .then(setProduct)
      .catch(() => setError('Product not found'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const sizeOptions = useMemo(() => {
    if (!product) return ['M'];
    return product.sizes && product.sizes.length > 0 ? product.sizes : fallbackSizes(product.category);
  }, [product]);

  useEffect(() => {
    if (sizeOptions.length > 0) {
      setSelectedSize(sizeOptions[0]);
    }
  }, [sizeOptions]);

  if (isLoading) {
    return <div className="pt-24 text-center text-on-surface-variant">Loading product...</div>;
  }

  if (error || !product) {
    return (
      <div className="pt-24 text-center text-on-surface-variant">
        {error || 'Product not found.'}
        <Button variant="ghost" className="mt-6" onClick={() => navigate('/catalog/all')}>Back to Catalog</Button>
      </div>
    );
  }

  const galleryImages = (product.image_urls && product.image_urls.length > 0)
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : [];

  const description = parseDescription(product.description) || 'A wardrobe staple redefined. Crafted for comfort and everyday versatility.';
  const originalPrice = Math.round(product.price * 1.2);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-sm text-on-surface-variant mb-8 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-primary">Home</button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => navigate('/catalog/all')} className="hover:text-primary">{product.category}</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-on-surface">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <ProductImageViewer images={galleryImages} />

          <div className="lg:py-12 flex flex-col">
            <h1 className="font-headline text-4xl lg:text-5xl font-bold tracking-tight mb-4">{product.name}</h1>
            <div className="flex items-end gap-4 mb-8">
              <span className="text-3xl font-medium">{formatCurrency(product.price)} Ksh</span>
              <span className="text-on-surface-variant line-through mb-1">{formatCurrency(originalPrice)} Ksh</span>
              <span className="bg-error-container text-on-error-container px-2 py-1 rounded text-xs font-bold mb-1">SALE</span>
            </div>

            <p className="text-on-surface-variant mb-6 leading-relaxed">
              {description}
            </p>

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {product.tags.map(tag => (
                  <span key={tag.id} className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-container-low text-on-surface-variant">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-6 mb-12">
              <div>
                <div className="flex justify-between mb-3">
                  <span className="font-medium">Size</span>
                  <button className="text-sm text-on-surface-variant underline" onClick={() => alert('Size guide coming soon.')}>Size Guide</button>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {sizeOptions.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-[3rem] h-12 px-3 rounded-full flex items-center justify-center font-medium border transition-colors ${selectedSize === size ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-medium block mb-3">Color</span>
                <div className="flex gap-3">
                  <button
                    className={`w-10 h-10 rounded-full bg-[#f0f0f0] border-2 ${selectedColor === 'light' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                    onClick={() => setSelectedColor('light')}
                    aria-label="Light color"
                  ></button>
                  <button
                    className={`w-10 h-10 rounded-full bg-[#2a3b4c] border-2 ${selectedColor === 'navy' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                    onClick={() => setSelectedColor('navy')}
                    aria-label="Navy color"
                  ></button>
                  <button
                    className={`w-10 h-10 rounded-full bg-[#8b9dc3] border-2 ${selectedColor === 'steel' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                    onClick={() => setSelectedColor('steel')}
                    aria-label="Steel color"
                  ></button>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-4">
              <MpesaButton onClick={() => { addToCart(product, selectedSize); navigate('/checkout'); }} />
              <Button variant="outline" className="w-full" onClick={() => addToCart(product, selectedSize)}>Add to Cart</Button>
            </div>

            <div className="mt-12 pt-8 border-t border-outline-variant/20 grid grid-cols-2 gap-8 text-sm">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary"/> Quality Guaranteed</h4>
                <p className="text-on-surface-variant">Premium craftsmanship, verified before dispatch.</p>
              </div>
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-primary"/> Delivery</h4>
                <p className="text-on-surface-variant">Same day in Nairobi</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductDetail;
