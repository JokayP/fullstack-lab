import { useEffect, useState } from 'react';
import { fetchCharacterDirectory } from '../services/character-directory';
import type { SearchFilters, SearchState } from '../types/character';
import { SEARCH_DELAY_MS, wait, withMinimumDuration } from '../utils/minimum-duration';

export const REQUEST_TIMEOUT_MS = 15000;
export const SEARCH_DEBOUNCE_MS = 300;
export const initialFilters: SearchFilters = { name: '', status: '', page: 1 };

export function useCharacterSearch() {
  const [request, setRequest] = useState({ filters: initialFilters, debounce: false });
  const { filters } = request;
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
      async () => {
        if (request.debounce) await wait(SEARCH_DEBOUNCE_MS, controller.signal);
        return fetchCharacterDirectory(filters, controller.signal);
      },
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
      .finally(() => {
        clearTimeout(timeout);
        // A failed relationship must not leave its sibling request running.
        controller.abort();
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [request]);

  function search(nextFilters: SearchFilters, options: { debounce?: boolean } = {}) {
    setState({ phase: 'loading' });
    setRequest({
      filters: { ...nextFilters, name: nextFilters.name.trim() },
      debounce: options.debounce ?? false,
    });
  }

  return { state, filters, search, retry: () => search(filters) };
}
