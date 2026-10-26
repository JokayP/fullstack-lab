import type { Character, CharacterPage, SearchFilters } from '../types/character';
import { createApiUrl, isRecord } from './api-client';

const emptyPage: CharacterPage = { info: { count: 0, pages: 0 }, results: [] };

function isCharacter(value: unknown): value is Character {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.name === 'string' &&
    ['Alive', 'Dead', 'unknown'].includes(String(value.status)) &&
    typeof value.species === 'string' &&
    typeof value.gender === 'string' &&
    typeof value.image === 'string' &&
    value.image.startsWith('https://') &&
    isRecord(value.origin) &&
    typeof value.origin.name === 'string' &&
    typeof value.origin.url === 'string' &&
    isRecord(value.location) &&
    typeof value.location.name === 'string' &&
    typeof value.location.url === 'string' &&
    Array.isArray(value.episode) &&
    value.episode.every((episode) => typeof episode === 'string')
  );
}

export async function fetchCharacters(
  filters: SearchFilters,
  signal: AbortSignal,
): Promise<CharacterPage> {
  const url = createApiUrl('character');
  url.searchParams.set('page', String(filters.page));
  if (filters.name.trim()) url.searchParams.set('name', filters.name.trim());
  if (filters.status) url.searchParams.set('status', filters.status);
  const response = await fetch(url, { signal });
  if (response.status === 404) return emptyPage;
  if (!response.ok)
    throw new Error(`The character service returned HTTP ${response.status}. Please try again.`);
  const data: unknown = await response.json();
  if (
    !isRecord(data) ||
    !isRecord(data.info) ||
    typeof data.info.count !== 'number' ||
    !Number.isSafeInteger(data.info.count) ||
    data.info.count < 0 ||
    typeof data.info.pages !== 'number' ||
    !Number.isSafeInteger(data.info.pages) ||
    data.info.pages < 0 ||
    !Array.isArray(data.results) ||
    !data.results.every(isCharacter) ||
    new Set(data.results.map((character) => character.id)).size !== data.results.length
  ) {
    throw new Error(
      'The character service returned an unexpected response. Please try again later.',
    );
  }
  return { info: { count: data.info.count, pages: data.info.pages }, results: data.results };
}
