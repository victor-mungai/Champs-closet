import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Filters from '../components/Filters';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

const CATEGORY_MAP: Record<string, string> = {
  shirts: 'Shirts',
  'shoe-hub': 'Shoe Hub',
  vests: 'Vests',
  trousers: 'Trousers',
  sweaters: 'Sweaters',
  all: 'All',
};

const CATEGORY_OPTIONS = ['Shirts', 'Shoe Hub', 'Vests', 'Trousers', 'Sweaters'];
const STYLE_TAGS = ['Casual', 'Formal', 'Summer', 'Evening', 'Minimal'];

const Catalog = () => {
  const params = useParams();
  const navigate = useNavigate();
  const categorySlug = params.category || 'all';
  const categoryName = CATEGORY_MAP[categorySlug] || 'All';
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const { products, isLoading, error } = useProducts({
    category: categoryName === 'All' ? undefined : categoryName,
    tag: selectedTags[0],
    search,
  });

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = query.length === 0 || product.name.toLowerCase().includes(query);
      const tagNames = product.tags?.map(tag => tag.name.toLowerCase()) || [];
      const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => tagNames.includes(tag.toLowerCase()));
      return matchesSearch && matchesTags;
    });
  }, [products, search, selectedTags]);

  const handleCategoryChange = (category: string) => {
    const slug = Object.entries(CATEGORY_MAP).find(([, value]) => value === category)?.[0] || 'all';
    navigate(`/catalog/${slug}`);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="font-headline text-4xl lg:text-5xl font-bold tracking-tight mb-4">{categoryName === 'All' ? 'The New Standard.' : categoryName}</h1>
        <p className="text-on-surface-variant max-w-2xl">Explore our complete collection of premium shirts. Designed in Nairobi, crafted for the world. Every piece is 500 Ksh.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        <Filters
          categories={CATEGORY_OPTIONS}
          selectedCategory={categoryName === 'All' ? 'all' : categoryName}
          onCategoryChange={handleCategoryChange}
          tags={STYLE_TAGS}
          selectedTags={selectedTags}
          onToggleTag={toggleTag}
          search={search}
          onSearch={setSearch}
        />

        <div className="flex-1">
          {isLoading ? (
            <div className="text-center py-24 text-on-surface-variant">Loading products...</div>
          ) : error ? (
            <div className="text-center py-24 text-on-surface-variant">{error}</div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 text-on-surface-variant">
              <p>No products found matching your filters.</p>
              <button
                className="mt-4 text-sm font-medium text-primary"
                onClick={() => {
                  setSelectedTags([]);
                  setSearch('');
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Catalog;
