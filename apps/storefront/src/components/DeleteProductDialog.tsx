import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types/product';

export function DeleteProductDialog({
  product,
  onDelete,
  onClose,
}: {
  product: Product;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await onDelete(product.id);
      onClose();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'The product could not be deleted.');
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-title"
      className="modal p-8"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <p className="eyebrow">Manage collection</p>
      <h2 id="delete-title" className="mt-2 text-2xl font-semibold">
        Delete product?
      </h2>
      <p className="mt-4 break-words text-sm leading-6 text-stone-600">
        “{product.name}” will be permanently removed from the catalog.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-7 flex justify-end gap-3">
        <button autoFocus onClick={onClose} disabled={pending} className="secondary-button">
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={pending}
          className="primary-button bg-red-800 hover:bg-red-900"
        >
          {pending ? 'Deleting…' : 'Delete product'}
        </button>
      </div>
    </dialog>
  );
}
