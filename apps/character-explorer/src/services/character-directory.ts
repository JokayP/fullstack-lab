import type { CharacterDirectoryPage, SearchFilters } from '../types/character';
import { getResourceId } from './api-client';
import { fetchCharacters } from './characters-api';
import { fetchEpisodes, fetchLocations } from './related-resources-api';

export async function fetchCharacterDirectory(
  filters: SearchFilters,
  signal: AbortSignal,
): Promise<CharacterDirectoryPage> {
  const page = await fetchCharacters(filters, signal);
  signal.throwIfAborted();
  const references = page.results.map((character) => ({
    character,
    originId: character.origin.url ? getResourceId(character.origin.url, 'location') : null,
    locationId: character.location.url ? getResourceId(character.location.url, 'location') : null,
    episodeIds: character.episode.map((url) => getResourceId(url, 'episode')),
  }));

  const locationIds = references.flatMap(({ originId, locationId }) =>
    [originId, locationId].filter((id): id is number => id !== null),
  );
  const episodeIds = references.flatMap(({ episodeIds }) => episodeIds);
  const [locations, episodes] = await Promise.all([
    fetchLocations(locationIds, signal),
    fetchEpisodes(episodeIds, signal),
  ]);
  signal.throwIfAborted();

  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const episodesById = new Map(episodes.map((episode) => [episode.id, episode]));
  return {
    info: page.info,
    results: references.map(({ character, originId, locationId, episodeIds }) => ({
      ...character,
      // Missing location URLs are valid unknowns; keep the character like a LEFT JOIN.
      originDetails: originId === null ? null : locationsById.get(originId)!,
      locationDetails: locationId === null ? null : locationsById.get(locationId)!,
      // The batch response is validated as complete before this ID-based join.
      episodes: episodeIds.map((id) => episodesById.get(id)!),
    })),
  };
}
