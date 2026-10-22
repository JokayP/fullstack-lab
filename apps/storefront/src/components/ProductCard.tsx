import { Pencil, Trash2 } from 'lucide-react';
import type { Product } from '../types/product';
import { formatPrice } from '../utils/products';
import { ProductArtwork } from './ProductArtwork';

export function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <article
      data-testid="product-card"
      className="overflow-hidden rounded-2xl border border-line bg-white"
    >
      <div className="relative h-52 bg-sand">
        <ProductArtwork name={product.name} />
        <span
          className={`absolute left-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.stock > 0 ? 'bg-white/90 text-forest' : 'bg-white/90 text-stone-500'}`}
        >
          {product.stock > 0 ? 'In stock' : 'Out of stock'}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight">
            {product.name}
          </h3>
          <span className="shrink-0 pt-0.5 text-sm font-semibold">
            {formatPrice(product.price)}
          </span>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {product.stock} {product.stock === 1 ? 'unit' : 'units'} available
        </p>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <span className="font-mono text-[10px] text-stone-400">
            PRODUCT / {String(product.id).padStart(3, '0')}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(product)}
              aria-label={`Edit ${product.name}`}
              className="icon-button"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onDelete(product)}
              aria-label={`Delete ${product.name}`}
              className="icon-button hover:text-red-700"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
