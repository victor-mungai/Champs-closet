import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import Button from '../Button';
import type { Product } from '../../types';

type EditProductModalProps = {
  open: boolean;
  product: Product | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
};

const formatTags = (product: Product | null) => (product?.tags || []).map((tag) => tag.name).join(', ');
const formatList = (values?: string[] | null) => (values || []).join(', ');

const EditProductModal = ({ open, product, isSubmitting, onClose, onSubmit }: EditProductModalProps) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Shirts');
  const [price, setPrice] = useState(500);
  const [stock, setStock] = useState(1);
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [replaceImages, setReplaceImages] = useState(false);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !product) return;
    setName(product.name || '');
    setCategory(product.category || 'Shirts');
    setPrice(product.price || 0);
    setStock(product.stock ?? 0);
    setSku(product.sku || '');
    setDescription(product.description || '');
    setSizes(formatList(product.sizes));
    setColors(formatList(product.colors));
    setTags(formatTags(product));
    setImageUrls(formatList(product.image_urls));
    setReplaceImages(false);
    setNewImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [open, product]);

  const cleanupPreviewUrls = () => {
    newImagePreviews.forEach((url) => URL.revokeObjectURL(url));
  };

  const handleClose = () => {
    cleanupPreviewUrls();
    setNewImagePreviews([]);
    onClose();
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    cleanupPreviewUrls();
    const files = event.target.files ? Array.from(event.target.files) : [];
    const previews = files.map((file) => URL.createObjectURL(file));
    setNewImagePreviews(previews);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) return;

    const formData = new FormData();
    formData.set('name', name.trim());
    formData.set('category', category.trim());
    formData.set('price', String(price));
    formData.set('stock', String(stock));
    formData.set('sku', sku.trim());
    formData.set('description', description);
    formData.set('sizes', sizes);
    formData.set('colors', colors);
    formData.set('tags', tags);
    formData.set('image_urls', imageUrls);
    formData.set('replace_images', String(replaceImages));

    const files = fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : [];
    files.forEach((file) => formData.append('images', file));

    await onSubmit(formData);
    handleClose();
  };

  return (
    <AnimatePresence>
      {open && product && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface p-4 sm:p-6 rounded-3xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold font-headline">Edit Product</h2>
              <button onClick={handleClose} className="p-2 hover:bg-surface-container-low rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none">
                    <option value="Shirts">Shirts</option>
                    <option value="Shoe Hub">Shoe Hub</option>
                    <option value="Vests">Vests</option>
                    <option value="Trousers">Trousers</option>
                    <option value="Sweaters">Sweaters</option>
                    <option value="Jeans">Jeans</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price (Ksh)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SKU</label>
                  <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Sizes (comma separated)</label>
                  <input value={sizes} onChange={(e) => setSizes(e.target.value)} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Colors (comma separated)</label>
                  <input value={colors} onChange={(e) => setColors(e.target.value)} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image URLs (comma separated)</label>
                <input value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none" />
              </div>

              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={replaceImages} onChange={(e) => setReplaceImages(e.target.checked)} />
                  Replace existing images with values above / uploads
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary"
                />
                {newImagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {newImagePreviews.map((preview) => (
                      <img key={preview} src={preview} alt="preview" className="w-full h-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button type="button" variant="ghost" className="w-full sm:flex-1" onClick={handleClose}>Cancel</Button>
                <Button type="submit" className="w-full sm:flex-1">{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditProductModal;
