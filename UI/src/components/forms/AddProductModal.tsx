import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import Button from '../Button';

const AddProductModal = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  isSubmitting: boolean;
}) => {
  const [category, setCategory] = useState('Shirts');
  const [price, setPrice] = useState(500);
  const [stock, setStock] = useState(1);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isShirts = useMemo(() => category.toLowerCase().includes('shirt'), [category]);

  const sizeHint = useMemo(() => {
    const normalized = category.toLowerCase();
    if (normalized.includes('shoe')) return 'e.g. 41, 42.5, 43';
    if (normalized.includes('jean') || normalized.includes('trouser')) return 'e.g. 30, 32, 34 (waist)';
    if (normalized.includes('vest') || normalized.includes('sweater') || normalized.includes('shirt')) return 'e.g. Small, Medium, Large, XL, 2XL';
    return 'Comma-separated sizes';
  }, [category]);

  const resetForm = () => {
    setCategory('Shirts');
    setPrice(500);
    setStock(1);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value;
    setCategory(newCat);
    if (newCat.toLowerCase().includes('shirt')) {
      setPrice(500);
      setStock(1);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    const files = e.target.files ? Array.from(e.target.files) : [];
    const previews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const finalPrice = isShirts ? 500 : Number(formData.get('price'));
    formData.set('price', String(finalPrice));
    formData.set('stock', String(isShirts ? 1 : Number(formData.get('stock'))));

    await onSubmit(formData);
    e.currentTarget.reset();
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface p-4 sm:p-6 rounded-3xl shadow-xl w-full max-w-lg my-4 sm:my-8 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold font-headline">Add New Product</h2>
              <button onClick={() => { resetForm(); onClose(); }} className="p-2 hover:bg-surface-container-low rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="w-20 h-20 rounded-xl bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreviews[0] ? (
                    <img src={imagePreviews[0]} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-on-surface-variant text-center px-2">No Image</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Product Images</label>
                  <input
                    ref={fileInputRef}
                    name="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  {imagePreviews.length > 1 && (
                    <p className="text-xs text-on-surface-variant mt-1">{imagePreviews.length} images selected</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input name="name" required type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" required rows={3} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select name="category" value={category} onChange={handleCategoryChange} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                    <option value="Shirts">Shirts</option>
                    <option value="Shoe Hub">Shoe Hub</option>
                    <option value="Vests">Vests</option>
                    <option value="Trousers">Trousers</option>
                    <option value="Sweaters">Sweaters</option>
                    <option value="Jeans">Jeans</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sizes (comma separated)</label>
                  <input name="sizes" placeholder={sizeHint} type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <p className="text-xs text-on-surface-variant mt-1">{sizeHint}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price (Ksh)</label>
                  <input
                    name="price"
                    required
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    disabled={isShirts}
                    className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  />
                  {isShirts && <p className="text-xs text-on-surface-variant mt-1">Shirts have a fixed price of 500 Ksh</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Original Price (Ksh)</label>
                  <input
                    type="number"
                    value={Math.round(price * 1.2)}
                    disabled
                    className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none opacity-50"
                  />
                  <p className="text-xs text-on-surface-variant mt-1">Automatically calculated (+20%)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                  <input name="tags" placeholder="e.g. Cotton, Casual" required type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Initial Stock</label>
                  <input
                    name="stock"
                    required
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    disabled={isShirts}
                    className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  />
                  {isShirts && <p className="text-xs text-on-surface-variant mt-1">Shirts are unique, stock is always 1.</p>}
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button type="button" variant="ghost" className="w-full sm:flex-1" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
                <Button type="submit" className="w-full sm:flex-1">{isSubmitting ? 'Adding...' : 'Add Product'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddProductModal;
