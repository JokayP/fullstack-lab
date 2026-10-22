# Fullstack Lab verification record

Date: 2026-10-22 (America/Guayaquil).

## Automated checks

`npm run verify` passed: Prettier, strict TypeScript, **26 tests across 8 files**, and production builds for both `storefront` and `character-explorer`.

With the portable Java 21 runtime, `mvnw.cmd --batch-mode --no-transfer-progress clean verify` also passed: **8 backend tests**, no failures or errors, and an executable Spring Boot JAR. The verified JAR was copied to `dist/products-crud-1.0.0.jar` for the local launcher.

The frontend tests cover:

- Immediate product filtering without Enter or another HTTP request.
- Numeric form parsing, decimal price limits and integer stock validation.
- GET/POST/PUT/DELETE contracts, generated IDs, malformed responses and duplicate IDs.
- DELETE 204 without parsing a JSON body.
- Creating, reloading, editing and deleting through a controlled backend mock.
- Failed writes preserve existing catalog data and entered form values.
- Request cancellation, timeout, reload and recovery from an unavailable backend.
- Portal's existing minimum-duration, slow response, fast error, stale response, filters, pagination, timeout and retry behavior.
- No visible seconds announcement in Portal.

The Java tests cover CRUD, case-insensitive search, input validation, missing IDs and CORS. They use a separate in-memory H2 database and do not operate on the user's persisted products.

## Real backend and browser verification

The prepared Java runtime is Eclipse Temurin 21.0.12.1, downloaded from the official Adoptium release metadata and checked against its SHA-256 digest. It lives in the ignored `java/` directory; no system Java or PATH setting was changed.

Browser QA used the real Spring Boot JAR on port 8080 with a separate file database at `.npm-cache/qa-products`. The normal `data/products` database was not modified by the QA flow.

Verified:

- Initial GET displayed the three backend seed products: Notebook, Pencil and Backpack.
- Typing `NOTE` without Enter immediately displayed only Notebook.
- The browser created `Persistence demo` with POST, then edited its price to 5.75 and stock to 0 with PUT.
- Reloading the browser retained the product and showed its out-of-stock state.
- The Java process was stopped and restarted with the same QA database file. A fresh browser reload still displayed product ID 4, price 5.75 and stock 0, proving persistence beyond React state and beyond the original Java process.
- The deletion dialog and its Cancel action were checked in the browser. The disposable QA record was then removed through the real DELETE API, and GET confirmed only the three seed records remained. The full confirmation-to-deletion UI flow is covered by automated tests.
- Portal still uses its unchanged Rick and Morty implementation. A submitted `rick` query showed generic loading feedback without a seconds message and returned real results.
- Both mobile documents were reviewed inside 390 px frames (375 px content width after scrollbars). Their client and scroll widths matched, without horizontal overflow. The store's search and product form were inspected at that width.

Screenshots:

- [Storefront](screenshots/storefront.jpg)
- [Portal](screenshots/character-explorer.jpg)
- [Mobile review](screenshots/mobile-review.jpg)

The temporary mobile review page was removed and is not shipped. Browser checks are not a complete device or accessibility certification.

## Boundaries

- Rick and Morty application source and its timing contract were preserved.
- Product persistence was verified with file-based H2. The PostgreSQL configuration remains available but no live PostgreSQL test was performed in this update.
- The store has product CRUD, not carts, orders, payments or inventory reservations. It is a local teaching application without authentication.
- A write timeout may occur after the backend committed; the interface asks users to refresh before retrying. Writes are not automatically retried.
- This record describes local verification before the GitHub upload. Remote workflow results are recorded separately in the repository's Actions tab. The workflows do not deploy the applications.

## Repeat locally

On a fresh checkout, first build with JDK 21 using `mvnw.cmd --batch-mode --no-transfer-progress clean verify`. Then, in separate terminals from the project root:

```powershell
.\start-demo.cmd
```

```sh
npm ci
npm run dev:store
```

```sh
npm run dev:characters
```

See the root [README](../README.md) and each application's README for setup and implementation details.
