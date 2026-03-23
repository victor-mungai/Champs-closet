import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Filter, MoreHorizontal, Plus, Search, Trash2, CheckCircle2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import Button from '../../components/Button';
import AddProductModal from '../../components/forms/AddProductModal';
import { deleteProduct, fetchProducts, createProduct } from '../../services/api';
import type { Product } from '../../types';
import type { AdminOutletContext } from './AdminLayout';

const getProductImage = (product: Product) => {
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return product.image_url || undefined;
};

const Products = () => {
  const { user } = useOutletContext<AdminOutletContext>();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setActionError('Unable to load products right now.');
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = setTimeout(() => setActionSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

  const filteredProducts = products.filter((prod) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      query.length === 0 ||
      prod.name.toLowerCase().includes(query) ||
      prod.category.toLowerCase().includes(query) ||
      String(prod.id).includes(query);
    const stock = prod.stock ?? 0;
    const matchesStock = !showLowStockOnly || (stock > 0 && stock <= 50);
    return matchesQuery && matchesStock;
  });

  const handleDelete = async () => {
    if (!productToDelete) return;
    if (!user) {
      setActionError('Please sign in to delete products.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const token = await user.getIdToken();
      await deleteProduct(productToDelete, token);
      setProductToDelete(null);
      await loadProducts();
      setActionSuccess('Product deleted successfully.');
    } catch {
      setActionError('Unable to delete product right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdd = async (formData: FormData) => {
    if (!user) {
      setActionError('Please sign in to add products.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const token = await user.getIdToken();
      await createProduct(formData, token);
      await loadProducts();
      setActionSuccess('Product created successfully.');
    } catch {
      setActionError('Unable to add product right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold mb-2">Inventory</h1>
          <p className="text-on-surface-variant">Manage your product catalog.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> New Product</Button>
      </div>

      {actionError && (
        <div className="mb-6 bg-error-container text-on-error-container p-4 rounded-xl text-sm">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="mb-6 bg-success-container text-on-success-container p-4 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {actionSuccess}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${showLowStockOnly ? 'bg-primary/10 text-primary' : 'bg-surface-container-low'}`}
            onClick={() => setShowLowStockOnly(prev => !prev)}
          >
            <Filter className="w-4 h-4"/> {showLowStockOnly ? 'Low Stock' : 'Filter'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low/50 text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 font-medium">Product</th>
                <th className="px-6 py-4 font-medium">SKU</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium">Stock</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-on-surface-variant" colSpan={7}>No products found.</td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const stock = prod.stock ?? 0;
                  const status = stock > 50 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock';
                  return (
                    <tr key={prod.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3 min-w-[200px]">
                        <img src={getProductImage(prod) || 'https://picsum.photos/seed/admin/100/100'} alt={prod.name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <span className="font-medium">{prod.name}</span>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{prod.sku || `PRD-${prod.id}`}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{prod.category}</td>
                      <td className="px-6 py-4 font-medium">{prod.price} Ksh</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-8">{stock}</span>
                          <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div className={`h-full ${stock > 50 ? 'bg-[#4CAF50]' : stock > 0 ? 'bg-[#FF9800]' : 'bg-error'}`} style={{ width: `${Math.min(100, (stock / 200) * 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${status === 'In Stock' ? 'bg-[#4CAF50]/10 text-[#4CAF50]' : status === 'Low Stock' ? 'bg-[#FF9800]/10 text-[#FF9800]' : 'bg-error/10 text-error'}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1 hover:bg-surface-container rounded text-on-surface-variant" onClick={() => alert('More actions coming soon.') }>
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          <button onClick={() => setProductToDelete(prod.id)} className="p-1 hover:bg-error/10 text-error rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-sm"
            >
              <h2 className="text-xl font-bold font-headline mb-4">Delete Product</h2>
              <p className="text-on-surface-variant mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setProductToDelete(null)}>Cancel</Button>
                <Button className="flex-1 bg-error hover:shadow-error/20 text-white" onClick={handleDelete}>
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddProductModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleAdd}
        isSubmitting={isSubmitting}
      />
    </motion.div>
  );
};

export default Products;
