# Portal

An independent Rick and Morty character explorer built with React, TypeScript and Tailwind CSS. Start from the repository root:

```sh
npm ci
npm run dev:characters
```

Open http://127.0.0.1:5174. This app uses the public [Rick and Morty REST API](https://rickandmortyapi.com/documentation), without a key or a local backend. Internet access is required.

## Search contract

- Type a name and press Enter or **Open portal** to search. Typing alone edits the draft.
- Selecting a life-status filter applies the current name and restarts at page 1.
- Initial loading, searches, filter changes, retries and pagination show loading for **at least 4,000 ms**.
- The interface uses a generic loading message; it does not display the duration or announce an artificial wait.
- The HTTP request and timer start together. Result time is approximately `max(network duration, 4000 ms)`, not `network duration + 4000 ms`.
- Fast failures and empty results also respect the delay. A slow network can exceed four seconds; no browser can guarantee an exact wall-clock completion time.
- A new search aborts the previous request and timer. An effect cleanup guard prevents stale results from updating the current screen even if a transport ignores cancellation.
- Requests time out after 15 seconds. Unmounting clears timers and cancels requests.
- `404` is interpreted as an empty result for this API. Other unsuccessful HTTP responses are shown as errors with retry.

The API handles filtering and pagination. Each page contains up to 20 characters. Name/status filters are preserved when changing pages, and a new search starts on page 1. JSON is validated before rendering. A character dialog shows existing response data without an extra request. Failed portraits have a visible fallback.

## Configuration and production

The default endpoint is `https://rickandmortyapi.com/api/character`. To override it, copy `.env.example` to `.env.local` inside this app, edit `VITE_CHARACTERS_API_URL` and restart Vite. Public browser variables must never contain secrets.

```sh
npm run build --workspace @fullstack-lab/character-explorer
npm run preview --workspace @fullstack-lab/character-explorer
```

Output: `apps/character-explorer/dist/`. Preview: http://127.0.0.1:4174.

This is an unofficial educational project. Character names, artwork and data come from The Rick and Morty API; no ownership or affiliation is claimed.
