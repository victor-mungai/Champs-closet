import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Filters from '../components/Filters';
import ProductCard from '../components/ProductCard';
import Seo from '../components/Seo';
import { useProducts } from '../hooks/useProducts';

const CATEGORY_META: Record<string, { title: string; description: string; backendCategory?: string }> = {
  all: {
    title: 'All Categories',
    description: "Explore the full Champ's Closet catalog across every category.",
  },
  shirts: {
    title: 'Essential Shirts',
    description: 'Premium shirts tailored for everyday wear and clean styling.',
    backendCategory: 'shirts',
  },
  shoes: {
    title: 'Footwear Collection',
    description: 'Durable, stylish shoes for every occasion and every day use.',
    backendCategory: 'shoe_hub',
  },
  'shoe-hub': {
    title: 'Footwear Collection',
    description: 'Durable, stylish shoes for every occasion and every day use.',
    backendCategory: 'shoe_hub',
  },
  vests: {
    title: 'Layered Essentials',
    description: 'Minimal, versatile vests that sharpen your fit instantly.',
    backendCategory: 'vests',
  },
  trousers: {
    title: 'Trouser Edit',
    description: 'Structured trousers built for comfort, movement, and polish.',
    backendCategory: 'trousers',
  },
  sweaters: {
    title: 'Knit & Sweater',
    description: 'Warm, premium sweaters designed for clean layered looks.',
    backendCategory: 'sweaters',
  },
};

const CATEGORY_OPTIONS = ['All Categories', 'Shirts', 'Shoes', 'Vests', 'Trousers', 'Sweaters'];

const DISPLAY_TO_SLUG: Record<string, string> = {
  'All Categories': 'all',
  Shirts: 'shirts',
  Shoes: 'shoes',
  Vests: 'vests',
  Trousers: 'trousers',
  Sweaters: 'sweaters',
};

const STYLE_TAGS = ['casual', 'formal', 'summer', 'evening', 'minimal', 'streetwear', 'office'];
const PAGE_SIZE = 20;

const tokenizeTags = (search: string) => {
  return Array.from(
    new Set(
      search
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2),
    ),
  );
};

const Catalog = () => {
  const params = useParams();
  const navigate = useNavigate();
  const categorySlug = (params.category || 'all').toLowerCase();
  const categoryMeta = CATEGORY_META[categorySlug] || CATEGORY_META.all;
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const searchTags = useMemo(() => tokenizeTags(search), [search]);
  const queryTags = useMemo(() => Array.from(new Set([...selectedTags, ...searchTags])), [selectedTags, searchTags]);
  const offset = (page - 1) * PAGE_SIZE;

  const { products, isLoading, error } = useProducts({
    category: categoryMeta.backendCategory,
    tags: queryTags,
    search,
    limit: PAGE_SIZE,
    offset,
  });

  const canGoPrevious = page > 1;
  const canGoNext = products.length === PAGE_SIZE;

  const handleCategoryChange = (category: string) => {
    const slug = DISPLAY_TO_SLUG[category] || 'all';
    setPage(1);
    navigate(`/catalog/${slug}`);
  };

  const toggleTag = (tag: string) => {
    setPage(1);
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <>
      <Seo
        title={`${categoryMeta.title} | Champ's Closet`}
        description={categoryMeta.description}
        canonicalPath={`/catalog/${categorySlug}`}
      />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="font-headline text-4xl lg:text-5xl font-bold tracking-tight mb-4">{categoryMeta.title}</h1>
          <p className="text-on-surface-variant max-w-2xl">{categoryMeta.description}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          <Filters
            categories={CATEGORY_OPTIONS}
            selectedCategory={CATEGORY_OPTIONS.find((option) => DISPLAY_TO_SLUG[option] === categorySlug) || 'All Categories'}
            onCategoryChange={handleCategoryChange}
            tags={STYLE_TAGS}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            search={search}
            onSearch={(value) => {
              setPage(1);
              setSearch(value);
            }}
          />

          <div className="flex-1">
            {isLoading ? (
              <div className="text-center py-24 text-on-surface-variant">Loading products...</div>
            ) : error ? (
              <div className="text-center py-24 text-on-surface-variant">{error}</div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <div className="mt-10 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={!canGoPrevious}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="px-4 py-2 rounded-xl border border-outline-variant/20 text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-on-surface-variant">Page {page}</span>
                  <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="px-4 py-2 rounded-xl border border-outline-variant/20 text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-24 text-on-surface-variant">
                <p>No products found matching your filters.</p>
                <button
                  className="mt-4 text-sm font-medium text-primary"
                  onClick={() => {
                    setSelectedTags([]);
                    setSearch('');
                    setPage(1);
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default Catalog;
