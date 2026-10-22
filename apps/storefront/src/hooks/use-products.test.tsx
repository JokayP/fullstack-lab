import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { products, jsonResponse } from '../test/fixtures';
import { useProducts } from './use-products';

describe('product catalog lifecycle', () => {
  it('aborts a load on unmount and ignores a late response', async () => {
    let resolve!: (response: ReturnType<typeof jsonResponse>) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useProducts());
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(jsonResponse(products)));
    expect(result.current.state.phase).toBe('loading');
  });

  it('keeps confirmed data after a failed write and reloads the latest backend catalog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(products));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useProducts());
    await waitFor(() => expect(result.current.state.phase).toBe('success'));
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Product not found' }, 404));
    await act(async () => {
      await expect(result.current.remove(1)).rejects.toThrow('Product not found');
    });
    expect(result.current.state).toEqual({ phase: 'success', products });
    fetchMock.mockResolvedValue(jsonResponse([products[1]]));
    act(() => result.current.reload());
    await waitFor(() =>
      expect(result.current.state).toEqual({ phase: 'success', products: [products[1]] }),
    );
  });
});
