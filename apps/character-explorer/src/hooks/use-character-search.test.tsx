import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS, useCharacterSearch } from './use-character-search';
import { episodes, jsonResponse, locations, rick } from '../test/fixtures';

const emptyResponse = {
  ok: true,
  json: async () => ({ info: { count: 0, pages: 0 }, results: [] }),
};

describe('search lifecycle', () => {
  it('aborts an in-flight join and ignores its late episode response after a new query', async () => {
    vi.useFakeTimers();
    let resolveEpisodes!: (response: ReturnType<typeof jsonResponse>) => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ info: { count: 1, pages: 1 }, results: [rick] }))
      .mockResolvedValueOnce(jsonResponse(locations))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveEpisodes = resolve;
          }),
      )
      .mockResolvedValue(emptyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCharacterSearch());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    const oldSignal = fetchMock.mock.calls[2]![1].signal as AbortSignal;
    expect(oldSignal.aborted).toBe(false);
    act(() => result.current.search({ name: 'Summer', status: '', page: 1 }, { debounce: true }));
    expect(oldSignal.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(result.current.state).toMatchObject({ phase: 'success', data: { results: [] } });
    await act(async () => {
      resolveEpisodes(jsonResponse(episodes));
    });
    expect(result.current.state).toMatchObject({ phase: 'success', data: { results: [] } });
  });

  it('debounces typing, resets the four-second clock and only requests the latest name', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCharacterSearch());
    await act(() => vi.advanceTimersByTimeAsync(4000));
    fetchMock.mockClear();
    act(() => result.current.search({ name: 'R', status: '', page: 1 }, { debounce: true }));
    await act(() => vi.advanceTimersByTimeAsync(200));
    act(() => result.current.search({ name: 'Rick', status: '', page: 1 }, { debounce: true }));
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![0] as URL).searchParams.get('name')).toBe('Rick');
    await act(() => vi.advanceTimersByTimeAsync(3699));
    expect(result.current.state.phase).toBe('loading');
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.state.phase).toBe('success');
  });

  it('waits for slow episode data after four seconds and cancels related requests on a new search', async () => {
    vi.useFakeTimers();
    let resolveEpisodes!: (response: ReturnType<typeof jsonResponse>) => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ info: { count: 1, pages: 1 }, results: [rick] }))
      .mockResolvedValueOnce(jsonResponse(locations))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveEpisodes = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useCharacterSearch());
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.state.phase).toBe('loading');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(async () => {
      resolveEpisodes(jsonResponse(episodes));
    });
    expect(result.current.state.phase).toBe('success');
    const relationSignal = fetchMock.mock.calls[2]![1].signal as AbortSignal;
    fetchMock.mockResolvedValue(emptyResponse);
    act(() => result.current.search({ name: 'Summer', status: '', page: 1 }, { debounce: true }));
    expect(relationSignal.aborted).toBe(true);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(vi.getTimerCount()).toBe(0);
  });

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
