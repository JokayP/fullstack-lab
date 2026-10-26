import { describe, expect, it, vi } from 'vitest';
import { episodes, jsonResponse, locations, morty, rick } from '../test/fixtures';
import { fetchCharacterDirectory } from './character-directory';

const filters = { name: 'Rick', status: '' as const, page: 1 };
const characterPage = { info: { count: 2, pages: 1 }, results: [rick, morty] };

describe('character, location and episode join', () => {
  it('joins by ID, batches shared references once and preserves episode order', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(characterPage))
      .mockResolvedValueOnce(jsonResponse([...locations].reverse()))
      .mockResolvedValueOnce(jsonResponse([...episodes].reverse()));
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    const result = await fetchCharacterDirectory(filters, signal);
    expect(fetchMock.mock.calls.map(([url]) => (url as URL).pathname)).toEqual([
      '/api/character',
      '/api/location/1,20',
      '/api/episode/1,2',
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options.signal === signal)).toBe(true);
    expect(result.info).toEqual(characterPage.info);
    expect(result.results[0]).toMatchObject({
      id: 1,
      originDetails: { id: 1, dimension: 'Dimension C-137' },
      locationDetails: { id: 20, dimension: 'Replacement Dimension' },
      episodes: [
        { id: 1, name: 'Pilot' },
        { id: 2, name: 'Lawnmower Dog' },
      ],
    });
    expect(result.results[1]).toMatchObject({
      id: 2,
      originDetails: null,
      locationDetails: { id: 20 },
      episodes: [{ id: 2 }],
    });
  });

  it('normalizes single-object endpoints and keeps characters with an unknown origin', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ...characterPage, results: [morty] }))
      .mockResolvedValueOnce(jsonResponse(locations[1]))
      .mockResolvedValueOnce(jsonResponse(episodes[1]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchCharacterDirectory(filters, new AbortController().signal);
    expect(result.results[0]).toMatchObject({
      originDetails: null,
      locationDetails: { id: 20 },
      episodes: [{ id: 2 }],
    });
    expect((fetchMock.mock.calls[1]![0] as URL).pathname).toBe('/api/location/20');
  });

  it('does not invent relationships or request whole collections for absent references', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...characterPage,
        results: [{ ...morty, location: { name: 'unknown', url: '' }, episode: [] }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchCharacterDirectory(filters, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.results[0]).toMatchObject({
      originDetails: null,
      locationDetails: null,
      episodes: [],
    });
  });

  it('stops after an empty character search', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCharacterDirectory(filters, new AbortController().signal)).resolves.toEqual({
      info: { count: 0, pages: 0 },
      results: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['location', 'episode'])(
    'reports a failed %s relationship instead of an empty search',
    async (resource) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: URL) => {
          if (url.pathname === '/api/character') return jsonResponse(characterPage);
          if (url.pathname.includes(`/${resource}/`)) return { ok: false, status: 404 };
          return jsonResponse(resource === 'location' ? episodes : locations);
        }),
      );
      await expect(fetchCharacterDirectory(filters, new AbortController().signal)).rejects.toThrow(
        `The ${resource} service returned HTTP 404`,
      );
    },
  );

  it.each([
    ['missing record', [episodes[0]]],
    ['duplicate ID', [episodes[0], episodes[0]]],
    ['wrong ID', [episodes[0], { ...episodes[1], id: 99 }]],
    ['invalid fields', [episodes[0], { ...episodes[1], air_date: null }]],
  ])('rejects an incomplete or malformed join: %s', async (_label, response) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(characterPage))
        .mockResolvedValueOnce(jsonResponse(locations))
        .mockResolvedValueOnce(jsonResponse(response)),
    );
    await expect(fetchCharacterDirectory(filters, new AbortController().signal)).rejects.toThrow(
      'episode service returned an unexpected response',
    );
  });

  it('rejects an invalid reference without following an arbitrary URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...characterPage,
        results: [{ ...rick, episode: ['https://example.com/private'] }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCharacterDirectory(filters, new AbortController().signal)).rejects.toThrow(
      'invalid episode reference',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not start related requests after cancellation of the character query', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      return jsonResponse(characterPage);
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCharacterDirectory(filters, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
