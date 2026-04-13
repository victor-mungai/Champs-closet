import { ChevronRight, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import Seo from '../components/Seo';
import { useProducts } from '../hooks/useProducts';

const IMAGES = {
  hero: '../../public/main-shirt.png',
  sweaters: '../../public/sweater-main.png',
  jeans: '../../public/trouser-main.png',
  shoes: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBtY-2INflxJbw736OIXle8btvS0emYoArzX5LH0hLWGtIW9OP654nHWKuSsF8QcFucSamSBdLa5ZZQRFDi9gDN4VfaJiQg_jtMvbMDYuBo1W1jXwMjGqyuxnRzOuM_d6bwH3L7NpJm1gFZMy17gB3EuvJi82SuiB9xCgDn3Z38i_OiczeEzVaKi0rvUNpiy0m8TIwvfReRIAY-mxoPR0WHk2_z8LUPn-OQ-miGxlc6A8HbjtbqgGgpUw2YE0dzaf-v0SdMNOP3dV8',
};

const Home = () => {
  const navigate = useNavigate();
  const { products, isLoading, error } = useProducts();

  return (
    <>
      <Seo
        title="Champ's Closet | Premium Men's Fashion"
        description="Shop premium men's essentials in Kenya: shirts, shoes, trousers, sweaters, and more. Fast checkout and same-day Nairobi delivery."
        canonicalPath="/"
      />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
      <section className="max-w-7xl mx-auto px-6 py-12 lg:py-24 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 z-10">
          <h1 className="font-headline text-5xl lg:text-7xl font-extrabold tracking-tighter leading-[1.1] mb-6">
            Premium Men's<br />Essentials.
          </h1>
          <p className="text-xl text-on-surface-variant mb-8 max-w-md">
            Curated quality for every category in Champ's Closet.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => navigate('/catalog/all')} className="w-full sm:w-auto">Shop Collection</Button>
            <Button variant="ghost" className="w-full sm:w-auto gap-2" onClick={() => navigate('/catalog/all')}>
              View Lookbook <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 relative w-full aspect-square lg:aspect-[4/5] rounded-[2rem] overflow-hidden">
          <img src={IMAGES.hero} alt="Hero" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-12">
          <h2 className="font-headline text-3xl font-bold tracking-tight">Curated Selection</h2>
          <button className="text-sm font-medium flex items-center gap-1 hover:text-primary" onClick={() => navigate('/catalog/all')}>
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[250px]">
          <div className="md:col-span-2 md:row-span-2 rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low" onClick={() => navigate('/catalog/shirts')}>
            <img src={IMAGES.hero} alt="Shirts" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white">
              <h3 className="font-headline text-2xl font-bold mb-2">The Shirt Collection</h3>
              <p className="text-white/80 text-sm">Classic and modern fits</p>
            </div>
          </div>
          <div className="md:col-span-2 rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low" onClick={() => navigate('/catalog/sweaters')}>
            <img src={IMAGES.sweaters} alt="Sweaters" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="font-headline text-xl font-bold">Knitwear</h3>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low" onClick={() => navigate('/catalog/trousers')}>
            <img src={IMAGES.jeans} alt="Denim" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="font-headline text-xl font-bold">Trousers</h3>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low" onClick={() => navigate('/catalog/shoes')}>
            <img src={IMAGES.shoes} alt="Shoes" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="font-headline text-xl font-bold">Footwear</h3>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-12">
            <div>
              <h2 className="font-headline text-3xl font-bold tracking-tight mb-2">Featured Products</h2>
              <p className="text-on-surface-variant">Fresh picks from every category.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/catalog/all')} className="w-full sm:w-auto">Shop All</Button>
          </div>
          {isLoading ? (
            <div className="py-12 text-on-surface-variant">Loading products...</div>
          ) : error ? (
            <div className="py-12 text-on-surface-variant">{error}</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-on-surface-variant">No products available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              {products.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
      </motion.div>
    </>
  );
};

export default Home;
