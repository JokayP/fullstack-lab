import { describe, expect, it, vi } from 'vitest';
import { fetchCharacters } from './characters-api';

describe('Rick and Morty HTTP boundary', () => {
  it('encodes names and sends both filters and the requested page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ info: { count: 0, pages: 0 }, results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    await fetchCharacters({ name: ' Rick & Morty ', status: 'alive', page: 2 }, signal);
    const url = fetchMock.mock.calls[0]![0] as URL;
    expect(url.searchParams.get('name')).toBe('Rick & Morty');
    expect(url.searchParams.get('status')).toBe('alive');
    expect(url.searchParams.get('page')).toBe('2');
    expect(fetchMock.mock.calls[0]![1]).toEqual({ signal });
  });

  it('treats 404 as an empty search, not a connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(
      fetchCharacters({ name: 'no-match', status: '', page: 1 }, new AbortController().signal),
    ).resolves.toEqual({ info: { count: 0, pages: 0 }, results: [] });
  });

  it('reports server failures separately from empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(
      fetchCharacters({ name: '', status: '', page: 1 }, new AbortController().signal),
    ).rejects.toThrow('HTTP 503');
  });

  it('rejects an invalid response shape at the service boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ name: 'Rick' }] }) }),
    );
    await expect(
      fetchCharacters({ name: '', status: '', page: 1 }, new AbortController().signal),
    ).rejects.toThrow('unexpected response');
  });
});
