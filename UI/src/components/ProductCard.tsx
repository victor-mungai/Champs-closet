import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import Button from './Button';

const getProductImage = (product: Product) => {
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return product.image_url || undefined;
};

const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const defaultSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'M';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group cursor-pointer flex flex-col gap-4"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container-low">
        <img src={getProductImage(product) || 'https://picsum.photos/seed/product/600/800'} alt={product.name} className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
        <div className="absolute bottom-4 left-4 right-4 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <Button
            variant="secondary"
            className="w-full py-2 text-sm shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product, defaultSize);
            }}
          >
            Quick Buy
          </Button>
        </div>
      </div>
      <div>
        <h3 className="font-medium text-on-surface">{product.name}</h3>
        <p className="text-on-surface-variant mt-1">{product.price} Ksh</p>
      </div>
    </motion.div>
  );
};

export default ProductCard;
