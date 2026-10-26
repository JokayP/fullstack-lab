import type { Episode, LocationRecord } from '../types/character';
import { createApiUrl, isPositiveId, isRecord } from './api-client';

function isLocation(value: unknown): value is LocationRecord {
  return (
    isRecord(value) &&
    isPositiveId(value.id) &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.dimension === 'string' &&
    Array.isArray(value.residents) &&
    value.residents.every((resident) => typeof resident === 'string')
  );
}

function isEpisode(value: unknown): value is Episode {
  return (
    isRecord(value) &&
    isPositiveId(value.id) &&
    typeof value.name === 'string' &&
    typeof value.episode === 'string' &&
    typeof value.air_date === 'string'
  );
}

async function fetchRelatedRecords<T extends { id: number }>(
  resource: 'location' | 'episode',
  ids: number[],
  validate: (value: unknown) => value is T,
  signal: AbortSignal,
): Promise<T[]> {
  signal.throwIfAborted();
  const uniqueIds = [...new Set(ids)].sort((left, right) => left - right);
  if (uniqueIds.length === 0) return [];

  const response = await fetch(createApiUrl(`${resource}/${uniqueIds.join(',')}`), { signal });
  if (!response.ok) {
    throw new Error(`The ${resource} service returned HTTP ${response.status}. Please try again.`);
  }
  const payload: unknown = await response.json();
  // The API returns an object for one ID and an array for multiple IDs.
  const records = Array.isArray(payload) ? payload : [payload];
  if (
    !records.every(validate) ||
    records.length !== uniqueIds.length ||
    new Set(records.map((record) => record.id)).size !== uniqueIds.length ||
    records.some((record) => !uniqueIds.includes(record.id))
  ) {
    throw new Error(`The ${resource} service returned an unexpected response. Please try again.`);
  }
  return records;
}

export function fetchLocations(ids: number[], signal: AbortSignal): Promise<LocationRecord[]> {
  return fetchRelatedRecords('location', ids, isLocation, signal);
}

export function fetchEpisodes(ids: number[], signal: AbortSignal): Promise<Episode[]> {
  return fetchRelatedRecords('episode', ids, isEpisode, signal);
}
