import type { Product, ProductInput } from '../types/product';

export function filterProducts(products: Product[], query: string): Product[] {
  const normalized = query.trim().toLowerCase();
  return products.filter((product) => product.name.toLowerCase().includes(normalized));
}

export const formatPrice = (price: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

export function parseProductInput(name: string, price: string, stock: string): ProductInput {
  const input = { name: name.trim(), price: Number(price), stock: Number(stock) };
  if (!input.name || input.name.length > 100)
    throw new Error('Enter a name between 1 and 100 characters.');
  if (
    !price.trim() ||
    !Number.isFinite(input.price) ||
    input.price < 0.01 ||
    input.price > 99999999.99 ||
    Math.abs(input.price * 100 - Math.round(input.price * 100)) >= 0.00001
  ) {
    throw new Error('Enter a price from 0.01 to 99999999.99 with up to two decimal places.');
  }
  if (
    !stock.trim() ||
    !Number.isInteger(input.stock) ||
    input.stock < 0 ||
    input.stock > 2147483647
  ) {
    throw new Error('Enter a whole stock quantity from 0 to 2147483647.');
  }
  return input;
}
