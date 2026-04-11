import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Search } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';

const DELIVERY_RATE_PER_KM = Number((import.meta as any).env?.VITE_DELIVERY_RATE_PER_KM || 40);
const LOCK_TTL_MINUTES = Number((import.meta as any).env?.VITE_INVENTORY_LOCK_TTL_MINUTES || 5);

type FaqEntry = {
  id: string;
  category: 'delivery' | 'payment' | 'inventory' | 'general' | 'returns' | 'store-location';
  question: string;
  answer: string;
};

const Faq = () => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>('delivery-calc');
  const { products } = useProducts();

  const countsByCategory = useMemo(() => {
    return products.reduce<Record<string, number>>((acc, product) => {
      const key = (product.category || 'other').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [products]);

  const catalogSummary = useMemo(() => {
    const entries = Object.entries(countsByCategory);
    if (!entries.length) return 'Our catalog is updated continuously as new products are added.';
    const top = entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${count} in ${name}`)
      .join(', ');
    return `Live catalog snapshot: ${top}.`;
  }, [countsByCategory]);

  const faqs: FaqEntry[] = [
    {
      id: 'delivery-calc',
      category: 'delivery',
      question: 'How is delivery fee calculated?',
      answer: `Delivery is calculated from the store to your selected location at about ${DELIVERY_RATE_PER_KM} Ksh per kilometer using map distance.`,
    },
    {
      id: 'payment-flow',
      category: 'payment',
      question: 'What happens after I tap Pay with M-Pesa?',
      answer: 'We create your order, reserve inventory, then send STK push to your phone. Once payment succeeds, your order is marked paid and receipt processing starts instantly.',
    },
    {
      id: 'inventory-lock',
      category: 'inventory',
      question: 'Can someone else buy my item while I am paying?',
      answer: `No. We reserve stock for your order before payment. The reservation auto-expires after roughly ${LOCK_TTL_MINUTES} minutes if payment does not complete.`,
    },
    {
      id: 'sizes',
      category: 'general',
      question: 'How do I choose the correct size?',
      answer: 'Use the size selector on each product page. Shoe categories use numeric sizing, while shirts/sweaters/vests support S to 5XL.',
    },
    {
      id: 'store-location',
      category: 'store-location',
      question: 'What is your physical store location?',
      answer: 'We are located in Kitengela, just outside Nairobi at Club Enkare. Visit us for in-person shopping and fittings!',
    }
  ];

  const filteredFaqs = faqs.filter((item) => {
    const text = `${item.question} ${item.answer}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 min-h-screen bg-surface-container-low/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 sm:mb-10">
          <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">Frequently Asked Questions</h1>
          <p className="text-on-surface-variant">Everything you need to know about ordering, delivery, payments, and stock availability.</p>
        </div>

        <div className="relative mb-6 sm:mb-8">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions"
            className="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border border-outline-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-surface rounded-2xl p-6 text-on-surface-variant">No FAQ matched your search.</div>
          ) : (
            filteredFaqs.map((item) => {
              const isOpen = item.id === openId;
              return (
                <div key={item.id} className="bg-surface rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-5 sm:px-6 py-4 flex items-center justify-between gap-4"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                  >
                    <span className="font-medium">{item.question}</span>
                    <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && <div className="px-5 sm:px-6 pb-5 text-sm text-on-surface-variant">{item.answer}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Faq;
