import type { Product } from '../types/product';

export const products: Product[] = [
  { id: 1, name: 'Notebook', price: 2.5, stock: 20 },
  { id: 2, name: 'Pencil', price: 0.5, stock: 50 },
  { id: 3, name: 'Backpack', price: 18.9, stock: 8 },
];

export function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
