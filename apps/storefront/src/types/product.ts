export interface ProductInput {
  name: string;
  price: number;
  stock: number;
}

export interface Product extends ProductInput {
  id: number;
}

export type CatalogState =
  | { phase: 'loading' }
  | { phase: 'success'; products: Product[] }
  | { phase: 'error'; message: string };
