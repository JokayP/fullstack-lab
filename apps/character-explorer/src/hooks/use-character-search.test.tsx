import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS, useCharacterSearch } from './use-character-search';

const emptyResponse = {
  ok: true,
  json: async () => ({ info: { count: 0, pages: 0 }, results: [] }),
};

describe('search lifecycle', () => {
  it('keeps loading for four seconds and passes pagination and filters', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCharacterSearch());
    await act(() => vi.advanceTimersByTimeAsync(3999));
    expect(result.current.state.phase).toBe('loading');
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.state.phase).toBe('success');
    act(() => result.current.search({ name: 'Rick', status: 'alive', page: 2 }));
    expect(result.current.state.phase).toBe('loading');
    expect((fetchMock.mock.calls.at(-1)![0] as URL).searchParams.get('page')).toBe('2');
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(result.current.state.phase).toBe('success');
  });

  it('aborts the previous request and ignores a late response even if a transport ignores cancellation', async () => {
    vi.useFakeTimers();
    let resolveOld!: (value: typeof emptyResponse) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue(emptyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useCharacterSearch());
    const firstSignal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.search({ name: 'Morty', status: '', page: 1 }));
    expect(firstSignal.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(result.current.state.phase).toBe('success');
    await act(async () => {
      resolveOld({ ok: true, json: async () => ({ info: { count: 99, pages: 5 }, results: [] }) });
    });
    expect(result.current.state).toMatchObject({ phase: 'success', data: { info: { count: 0 } } });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a stuck request and supports retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCharacterSearch());
    await act(() => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS));
    expect(result.current.state).toMatchObject({
      phase: 'error',
      message: expect.stringContaining('too long'),
    });
    fetchMock.mockResolvedValue(emptyResponse);
    act(() => result.current.retry());
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(result.current.state.phase).toBe('success');
  });
});
