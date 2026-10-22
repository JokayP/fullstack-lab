import { describe, expect, it, vi } from 'vitest';
import { products, jsonResponse } from '../test/fixtures';
import { deleteProduct, listProducts, REQUEST_TIMEOUT_MS, saveProduct } from './products-api';

describe('Products API', () => {
  it('loads validated products from the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(products));
    vi.stubGlobal('fetch', fetchMock);
    expect(await listProducts(new AbortController().signal)).toEqual(products);
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8080/api/products');
  });

  it('sends POST and PUT with numeric fields and accepts the backend-generated ID', async () => {
    const input = { name: 'Ruler', price: 1.25, stock: 10 };
    const saved = { ...input, id: 12 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(saved, 201));
    vi.stubGlobal('fetch', fetchMock);
    expect(await saveProduct(input)).toEqual(saved);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await saveProduct(input, 12);
    expect(fetchMock.mock.calls[1]![0]).toBe('http://localhost:8080/api/products/12');
    expect(fetchMock.mock.calls[1]![1].method).toBe('PUT');
  });

  it('handles DELETE 204 without reading a nonexistent JSON body', async () => {
    const json = vi.fn().mockRejectedValue(new Error('No body'));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json });
    vi.stubGlobal('fetch', fetchMock);
    await deleteProduct(3);
    expect(fetchMock.mock.calls[0]![0]).toContain('/3');
    expect(fetchMock.mock.calls[0]![1].method).toBe('DELETE');
    expect(json).not.toHaveBeenCalled();
  });

  it('surfaces field validation and HTTP failures without fabricated data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ errors: { stock: 'Stock must not be negative' } }, 400));
    vi.stubGlobal('fetch', fetchMock);
    await expect(saveProduct({ name: 'Ruler', price: 1, stock: -1 })).rejects.toThrow(
      'Stock must not be negative',
    );
    fetchMock.mockResolvedValue(jsonResponse({}, 503));
    await expect(listProducts(new AbortController().signal)).rejects.toThrow('503');
  });

  it('rejects malformed data, duplicate IDs and mismatched update responses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const body of [
      { items: products },
      [{ ...products[0], price: '2.50' }],
      [products[0], products[0]],
      [{ ...products[0], stock: -1 }],
    ]) {
      fetchMock.mockResolvedValue(jsonResponse(body));
      await expect(listProducts(new AbortController().signal)).rejects.toThrow('invalid data');
    }
    fetchMock.mockResolvedValue(jsonResponse(products[0]));
    await expect(saveProduct({ name: 'Pencil', price: 1, stock: 1 }, 2)).rejects.toThrow(
      'invalid data',
    );
  });

  it('cancels requests and removes its timeout on cleanup', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(
        (_url, { signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
          ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const pending = listProducts(controller.signal);
    const result = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a stalled request and tells users to refresh before retrying a write', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(
          (_url, { signal }: { signal: AbortSignal }) =>
            new Promise((_resolve, reject) =>
              signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
            ),
        ),
    );
    const result = expect(saveProduct({ name: 'Ruler', price: 1, stock: 1 })).rejects.toThrow(
      'Refresh the catalog',
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
