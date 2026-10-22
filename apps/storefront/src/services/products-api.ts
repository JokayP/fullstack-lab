import type { Product, ProductInput } from '../types/product';

const apiUrl = (
  import.meta.env.VITE_PRODUCTS_API_URL || 'http://localhost:8080/api/products'
).replace(/\/$/, '');
export const REQUEST_TIMEOUT_MS = 15000;
const invalidResponse =
  'The product service returned invalid data. Refresh the catalog and try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    value.name.length <= 100 &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    value.price >= 0.01 &&
    value.price <= 99999999.99 &&
    Math.abs(value.price * 100 - Math.round(value.price * 100)) < 0.00001 &&
    typeof value.stock === 'number' &&
    Number.isInteger(value.stock) &&
    value.stock >= 0 &&
    value.stock <= 2147483647
  );
}

async function request(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(apiUrl + path, { ...options, signal: controller.signal });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const fields =
        isRecord(body) && isRecord(body.errors)
          ? Object.values(body.errors).filter((value): value is string => typeof value === 'string')
          : [];
      const message =
        fields.join(' ') ||
        (isRecord(body) && typeof body.message === 'string' ? body.message : '');
      throw new Error(
        message || `The product service returned HTTP ${response.status}. Please try again.`,
      );
    }
    if (response.status === 204) return null;
    return await response.json();
  } catch (error: unknown) {
    if (controller.signal.reason?.name === 'TimeoutError') {
      throw new Error('The request timed out. Refresh the catalog before trying again.');
    }
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof TypeError) {
      throw new Error('Cannot connect to the Products API. Start the backend and try again.');
    }
    if (error instanceof SyntaxError) throw new Error(invalidResponse);
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function listProducts(signal: AbortSignal): Promise<Product[]> {
  const data = await request('', {}, signal);
  if (
    !Array.isArray(data) ||
    !data.every(isProduct) ||
    new Set(data.map((product) => product.id)).size !== data.length
  ) {
    throw new Error(invalidResponse);
  }
  return data;
}

export async function saveProduct(input: ProductInput, id?: number): Promise<Product> {
  const data = await request(id === undefined ? '' : `/${id}`, {
    method: id === undefined ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!isProduct(data) || (id !== undefined && data.id !== id)) throw new Error(invalidResponse);
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await request(`/${id}`, { method: 'DELETE' });
}
