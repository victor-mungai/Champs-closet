import { ChevronRight, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

const IMAGES = {
  hero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1GtuFuQo0xQiQaRV_3PO0NnIk4_v5d7XQSReWVH-SQUf6mYaap-YdXIlVfEsIQ4YkwAyXtJhP5Vo4lp9wqIw0na1Ac0ZzT4CJk8BolI-tq09MDWJIE4k1ZpbsHLY7CbiX6yExYYsN9ifaj5OKCoKtZKujL6pODifY3UETl9eJOzj38D8ZeqnNrs4gJDUFFs7ewsb7dGtJtOOQ2Zp13J81oR5_3KM_yTWg21uaWEO-Yjk132kD_7nXsHHD1aJIp7WY64j2vxFPkvI',
  sweaters: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ0qP8wUto2QR2A9TJpRWbBjvzv_wbqypqJIYYVL7XtyMwWlqPWbGzN-21-CCeTFBDL38KUdDGp87HB0plqQ_wS_3G9vWdQzBGVBU_Tzth-Sulp4i2iGiDSGO91Jzr9BKk23zGNTByU8YjJDFgew4B7LtO5EHLcKJJ1PIQtXAD6fTtFarHNr-0pV93MtSlv_zKgBob3Y8Y9KE-7fSieWKCCSTWDsshheLLvVGADBaw6hg77BsVc-w98pQJZk2rIH6c_ThJCYOe6aU',
  jeans: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcJC7odeB6EhrjLab_c_aOgG5JppD-e8DF_DTq89cliZn-YbHzfzQoKuBr9kPrbpxSIS7FLhMst-hV-c4tsAjUV9VMRBPFfR-Fkcj3QrtqsOR5pAc1HsbC1U0ZOI_lqBjDMARHlztQCZz10xe5fNZczaIS3XK6VsqmFn_Hcm8uawZX7Vh35Xfu87nVJFGNsg_PykDGVUQ2hacvHfXZraLlWJ20awB_wsgEYIbvw-hLRsAMGRv-IiJiRcg5vJJEcUiZ92IBsMA-s00',
  shoes: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBtY-2INflxJbw736OIXle8btvS0emYoArzX5LH0hLWGtIW9OP654nHWKuSsF8QcFucSamSBdLa5ZZQRFDi9gDN4VfaJiQg_jtMvbMDYuBo1W1jXwMjGqyuxnRzOuM_d6bwH3L7NpJm1gFZMy17gB3EuvJi82SuiB9xCgDn3Z38i_OiczeEzVaKi0rvUNpiy0m8TIwvfReRIAY-mxoPR0WHk2_z8LUPn-OQ-miGxlc6A8HbjtbqgGgpUw2YE0dzaf-v0SdMNOP3dV8',
};

const Home = () => {
  const navigate = useNavigate();
  const { products, isLoading, error } = useProducts();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
      <section className="max-w-7xl mx-auto px-6 py-12 lg:py-24 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 z-10">
          <h1 className="font-headline text-5xl lg:text-7xl font-extrabold tracking-tighter leading-[1.1] mb-6">
            Premium Men's<br/>Essentials.
          </h1>
          <p className="text-xl text-on-surface-variant mb-8 max-w-md">
            Every Shirt, Only 500 Ksh. Uncompromising quality for the modern gentleman.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => navigate('/catalog/shirts')} className="w-full sm:w-auto">Shop Collection</Button>
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
            <img src={IMAGES.hero} alt="Shirts" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white">
              <h3 className="font-headline text-2xl font-bold mb-2">The Shirt Collection</h3>
              <p className="text-white/80 text-sm">Starting at 500 Ksh</p>
            </div>
          </div>
          <div className="md:col-span-2 rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low">
            <img src={IMAGES.sweaters} alt="Sweaters" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="font-headline text-xl font-bold">Knitwear</h3>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low">
            <img src={IMAGES.jeans} alt="Denim" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="font-headline text-xl font-bold">Denim</h3>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low">
            <img src={IMAGES.shoes} alt="Shoes" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
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
              <h2 className="font-headline text-3xl font-bold tracking-tight mb-2">Essential Shirts</h2>
              <p className="text-on-surface-variant">Our signature 500 Ksh collection.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/catalog/shirts')} className="w-full sm:w-auto">Shop All</Button>
          </div>
          {isLoading ? (
            <div className="py-12 text-on-surface-variant">Loading products...</div>
          ) : error ? (
            <div className="py-12 text-on-surface-variant">{error}</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-on-surface-variant">No products available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              {products.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
};

export default Home;
