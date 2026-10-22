import { useEffect, useState } from 'react';
import { deleteProduct, listProducts, saveProduct } from '../services/products-api';
import type { CatalogState, ProductInput } from '../types/product';

export function useProducts() {
  const [state, setState] = useState<CatalogState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ phase: 'loading' });
    listProducts(controller.signal)
      .then((products) => {
        if (active) setState({ phase: 'success', products });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            phase: 'error',
            message: error instanceof Error ? error.message : 'Unable to load products.',
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  async function save(input: ProductInput, id?: number) {
    const saved = await saveProduct(input, id);
    // Only publish changes after the backend confirms the write.
    setState((current) =>
      current.phase !== 'success'
        ? current
        : {
            phase: 'success',
            products: (id === undefined
              ? [...current.products, saved]
              : current.products.map((product) => (product.id === saved.id ? saved : product))
            ).sort((a, b) => a.id - b.id),
          },
    );
    return saved;
  }

  async function remove(id: number) {
    await deleteProduct(id);
    setState((current) =>
      current.phase !== 'success'
        ? current
        : {
            phase: 'success',
            products: current.products.filter((product) => product.id !== id),
          },
    );
  }

  return { state, save, remove, reload: () => setAttempt((value) => value + 1) };
}
