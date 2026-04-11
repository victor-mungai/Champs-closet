import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Filter, Pencil, Plus, Search, Trash2, CheckCircle2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import Button from '../../components/Button';
import AddProductModal from '../../components/forms/AddProductModal';
import EditProductModal from '../../components/forms/EditProductModal';
import { deleteProduct, fetchProducts, createProduct, updateProduct } from '../../services/api';
import type { Product } from '../../types';
import { getErrorMessage } from '../../utils/error';
import type { AdminOutletContext } from './AdminLayout';

const getProductImage = (product: Product) => {
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return product.image_url || undefined;
};

const getAvailableStock = (product: Product) => {
  if (typeof product.available_stock === 'number') return product.available_stock;
  const stock = product.stock ?? 0;
  const reserved = product.reserved_stock ?? 0;
  return Math.max(0, stock - reserved);
};

const Products = () => {
  const { user } = useOutletContext<AdminOutletContext>();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
    const available = getAvailableStock(prod);
    const tagsText = (prod.tags || []).map((tag) => tag.name).join(' ').toLowerCase();
    const colorsText = (prod.colors || []).join(' ').toLowerCase();
    const matchesQuery =
      query.length === 0 ||
      prod.name.toLowerCase().includes(query) ||
      prod.category.toLowerCase().includes(query) ||
      String(prod.id).includes(query) ||
      tagsText.includes(query) ||
      colorsText.includes(query);
    const matchesStock = !showLowStockOnly || (available > 0 && available <= 10);
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
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Unable to delete product right now.'));
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
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Unable to add product right now.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (formData: FormData) => {
    if (!user || !productToEdit) {
      setActionError('Please sign in to edit products.');
      return;
    }
    setIsUpdating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const token = await user.getIdToken();
      await updateProduct(productToEdit.id, formData, token);
      setProductToEdit(null);
      await loadProducts();
      setActionSuccess('Product updated successfully.');
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Unable to update product right now.'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold mb-2">Inventory</h1>
          <p className="text-on-surface-variant">Manage your product catalog and available stock.</p>
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
              placeholder="Search products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${showLowStockOnly ? 'bg-primary/10 text-primary' : 'bg-surface-container-low'}`}
            onClick={() => setShowLowStockOnly(prev => !prev)}
          >
            <Filter className="w-4 h-4"/> {showLowStockOnly ? 'Low Stock Only' : 'All Stock'}
          </button>
        </div>

        <div className="md:hidden p-4 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="text-on-surface-variant text-sm">No products found.</div>
          ) : (
            filteredProducts.map((prod) => {
              const available = getAvailableStock(prod);
              return (
                <div key={prod.id} className="rounded-2xl border border-outline-variant/15 p-4 bg-surface">
                  <div className="flex gap-3">
                    <img src={getProductImage(prod) || 'https://picsum.photos/seed/admin/100/100'} alt={prod.name} className="w-14 h-14 rounded-lg object-cover" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{prod.name}</p>
                      <p className="text-xs text-on-surface-variant">{prod.category} - {prod.price} Ksh</p>
                      <p className="text-xs text-on-surface-variant mt-1">Available: {available}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setProductToEdit(prod)} className="p-2 hover:bg-primary/10 text-primary rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setProductToDelete(prod.id)} className="p-2 hover:bg-error/10 text-error rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low/50 text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 font-medium">Product</th>
                <th className="px-6 py-4 font-medium">SKU</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium">Stock</th>
                <th className="px-6 py-4 font-medium">Reserved</th>
                <th className="px-6 py-4 font-medium">Available</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-on-surface-variant" colSpan={8}>No products found.</td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const available = getAvailableStock(prod);
                  return (
                    <tr key={prod.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3 min-w-[220px]">
                        <img src={getProductImage(prod) || 'https://picsum.photos/seed/admin/100/100'} alt={prod.name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <span className="font-medium">{prod.name}</span>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{prod.sku || `PRD-${prod.id}`}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{prod.category}</td>
                      <td className="px-6 py-4 font-medium">{prod.price} Ksh</td>
                      <td className="px-6 py-4">{prod.stock ?? 0}</td>
                      <td className="px-6 py-4">{prod.reserved_stock ?? 0}</td>
                      <td className="px-6 py-4 font-semibold">{available}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => setProductToEdit(prod)} className="p-1.5 hover:bg-primary/10 text-primary rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setProductToDelete(prod.id)} className="p-1.5 hover:bg-error/10 text-error rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setProductToDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-sm"
              onClick={(event) => event.stopPropagation()}
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

      <EditProductModal
        open={Boolean(productToEdit)}
        product={productToEdit}
        onClose={() => setProductToEdit(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
      />
    </motion.div>
  );
};

export default Products;
