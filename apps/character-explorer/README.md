# Portal

An independent Rick and Morty character explorer built with React, TypeScript and Tailwind CSS. Start from the repository root:

```sh
npm ci
npm run dev:characters
```

Open http://127.0.0.1:5174. This app uses the public [Rick and Morty REST API](https://rickandmortyapi.com/documentation), without a key or a local backend. Internet access is required.

## Search contract

- Type a name to search automatically. No Enter key or submit button is required. Clearing the name also starts a search.
- Typing starts the loading state and the four-second clock immediately. A cancellable 300 ms debounce waits for a brief typing pause before making HTTP requests; it is included in the minimum duration, not added after it. Each edit resets the clock.
- Selecting a life-status filter applies the current name and restarts at page 1.
- Initial loading, searches, filter changes, retries and pagination show loading for **at least 4,000 ms**.
- The interface uses a generic loading message; it does not display the duration or announce an artificial wait.
- The complete data operation and timer start together. For typing, result time is approximately `max(300 ms + character request + max(location request, episode request) + validation, 4000 ms)`. Initial loading, status changes, pagination and retries skip the debounce.
- Fast failures and empty results also respect the delay. A slow network can exceed four seconds; no browser can guarantee an exact wall-clock completion time.
- A new search aborts the previous requests, debounce and minimum-duration timer. An effect cleanup guard prevents stale results from updating the current screen even if a transport ignores cancellation.
- A search has a 15-second total timeout, including debounce and all three endpoints. Unmounting clears timers and cancels requests. A failed search also cancels any remaining sibling request.
- Only a character-search `404` is treated as an empty result. A location or episode failure is reported as an error with retry, rather than displaying an incomplete join as successful.

The API handles filtering and pagination. Each page contains up to 20 characters. Name/status filters are preserved when changing pages, and editing either filter resets to page 1. JSON is validated before rendering. Failed portraits have a visible fallback.

## Three related endpoints

| Endpoint                      | Purpose                     | Relationship                                                     |
| ----------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `/character?page=1&name=rick` | Search a page of characters | Provides `origin.url`, `location.url` and `episode[]` references |
| `/location/1,3`               | Fetch referenced locations  | Location ID matches the ID in each origin/current-location URL   |
| `/episode/1,2`                | Fetch referenced episodes   | Episode ID matches the IDs in each character's episode URLs      |

The IDs above are examples; requests always use the references returned by the current character search. Both origin and last-known location use the same location endpoint.

`services/character-directory.ts` orchestrates the join:

1. `characters-api.ts` searches and validates the character page.
2. Extract the location and episode IDs from the response references. Requests are built against the configured API base; response URLs are not fetched directly.
3. `related-resources-api.ts` deduplicates and batches each resource's IDs. Location and episode batches run in parallel, normally producing three HTTP requests per search instead of requests per card.
4. Validate related responses, including their IDs and completeness. Normalize a single-record object or a multiple-record array.
5. Create `Map` indexes and attach the matching records to each character by ID, preserving the character's episode order. Array positions are not join keys.

Unknown locations have an empty reference URL and become `null`; the character remains visible, similar to a left join. Empty searches and absent references skip unnecessary related requests. An API failure is not treated as an unknown location. There is no SQL query or local persistence in Portal: this is an in-memory frontend join over three external REST resources.

Cards show the location's dimension and the first episode's code/name. The dialog uses the already joined data to show both locations, their type/dimension/resident count, and each episode's name, code and air date; opening it makes no extra API request.

## Configuration and production

The default API base is `https://rickandmortyapi.com/api`. To override it, copy `.env.example` to `.env.local` inside this app, edit `VITE_RICK_AND_MORTY_API_URL` and restart Vite. This replaces the former character-only `VITE_CHARACTERS_API_URL` setting. The configured service must support all three resources. Public browser variables must never contain secrets.

```sh
npm run build --workspace @fullstack-lab/character-explorer
npm run preview --workspace @fullstack-lab/character-explorer
```

Output: `apps/character-explorer/dist/`. Preview: http://127.0.0.1:4174.

This is an unofficial educational project. Character names, artwork and data come from The Rick and Morty API; no ownership or affiliation is claimed.
