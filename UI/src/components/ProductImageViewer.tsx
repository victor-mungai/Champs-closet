import { useMemo, useState } from 'react';

const ProductImageViewer = ({ images }: { images: string[] }) => {
  const validImages = useMemo(() => images.filter(Boolean), [images]);
  const [activeIndex, setActiveIndex] = useState(0);

  const mainImage = validImages[activeIndex] || 'https://picsum.photos/seed/product/800/1000';

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-surface-container-low">
        <img src={mainImage} alt={`Product image ${activeIndex + 1}`} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
      {validImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {validImages.map((img, index) => (
            <button
              key={`${img}-${index}`}
              className={`flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 ${index === activeIndex ? 'border-primary' : 'border-transparent'}`}
              onClick={() => setActiveIndex(index)}
            >
              <img src={img} alt={`Thumbnail ${index + 1}`} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageViewer;
