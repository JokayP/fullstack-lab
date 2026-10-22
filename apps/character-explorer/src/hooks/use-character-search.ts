import { useEffect, useState } from 'react';
import { fetchCharacters } from '../services/characters-api';
import type { SearchFilters, SearchState } from '../types/character';
import { SEARCH_DELAY_MS, withMinimumDuration } from '../utils/minimum-duration';

export const REQUEST_TIMEOUT_MS = 15000;
export const initialFilters: SearchFilters = { name: '', status: '', page: 1 };

export function useCharacterSearch() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [state, setState] = useState<SearchState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ phase: 'loading' });
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
      REQUEST_TIMEOUT_MS,
    );

    withMinimumDuration(
      () => fetchCharacters(filters, controller.signal),
      SEARCH_DELAY_MS,
      controller.signal,
    )
      .then((data) => {
        if (active) setState({ phase: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          controller.signal.reason?.name === 'TimeoutError'
            ? 'The portal took too long to respond. Please try again.'
            : error instanceof Error && error.name !== 'TypeError'
              ? error.message
              : 'We could not reach the multiverse. Check your internet connection and try again.';
        setState({ phase: 'error', message });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [filters]);

  function search(nextFilters: SearchFilters) {
    setState({ phase: 'loading' });
    setFilters({ ...nextFilters, name: nextFilters.name.trim() });
  }

  return { state, filters, search, retry: () => search(filters) };
}
