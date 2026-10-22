import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Product, ProductInput } from '../types/product';
import { parseProductInput } from '../utils/products';

export function ProductForm({
  product,
  onSave,
  onClose,
}: {
  product: Product | null;
  onSave: (input: ProductInput, id?: number) => Promise<unknown>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product?.price.toFixed(2) ?? '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      await onSave(parseProductInput(name, price, stock), product?.id);
      onClose();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'The product could not be saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="product-form-title"
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <form onSubmit={submit} className="p-6 sm:p-8" aria-busy={pending}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2 id="product-form-title" className="mt-2 text-2xl font-semibold">
              {product ? 'Edit product' : 'New product'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close product form"
            className="icon-button"
          >
            <X size={20} />
          </button>
        </div>
        <fieldset disabled={pending} className="space-y-5">
          <label className="field-label">
            Product name
            <input
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Notebook"
              className="field-input"
            />
          </label>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="field-label">
              Price (USD)
              <input
                required
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                className="field-input"
              />
            </label>
            <label className="field-label">
              Stock
              <input
                required
                type="number"
                min="0"
                max="2147483647"
                step="1"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                placeholder="0"
                className="field-input"
              />
            </label>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-8 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="secondary-button">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="primary-button">
            {pending ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
