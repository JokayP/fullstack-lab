const apiBaseUrl = (
  import.meta.env.VITE_RICK_AND_MORTY_API_URL || 'https://rickandmortyapi.com/api'
).replace(/\/+$/, '');

export function createApiUrl(path: string): URL {
  return new URL(`${apiBaseUrl}/${path}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

// Read the foreign key from a reference; never fetch an arbitrary response URL.
export function getResourceId(reference: string, resource: 'location' | 'episode'): number {
  try {
    const path = new URL(reference).pathname;
    const match = path.match(new RegExp(`/${resource}/([1-9]\\d*)/?$`));
    const id = Number(match?.[1]);
    if (isPositiveId(id)) return id;
  } catch {
    // Invalid URLs are reported with the same response-validation message below.
  }
  throw new Error(`The character service returned an invalid ${resource} reference.`);
}
