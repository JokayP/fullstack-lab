# Paper & Form

A small React, TypeScript and Tailwind CSS product storefront connected to the existing Spring Boot Products API. Products are persisted in PostgreSQL or the file-based H2 database; the browser does not replace an unavailable backend with sample data.

## Run locally

From the repository root, start the backend in one terminal:

```powershell
.\start-demo.cmd
```

Then start the frontend in another terminal:

```sh
npm ci
npm run dev:store
```

Open http://127.0.0.1:5173. The backend listens at http://localhost:8080/api/products. This checkout includes a portable Java 21 runtime in the ignored `java/` folder; other machines need Java 21 and a built backend JAR. The storefront needs the backend, but does not need an external character API or remote images.

## Behavior

- Load products with GET, then filter names immediately on input without Enter, debounce or per-keystroke requests.
- Create with POST, edit with PUT and delete with DELETE after confirmation.
- Publish changes only after successful, validated backend responses.
- Preserve form inputs on errors; support catalog refresh and recoverable load errors.
- Validate required names, decimal prices and integer stock before submission; the backend validates independently.
- Keep the interface small: product cards, search and a product form, without cart, payments or orders.

Products survive page reloads and backend restarts when using the same database storage. Search text and unsaved form inputs are temporary React state. Illustrations are decorative local SVGs selected by name; the database stores `id`, `name`, `price` and `stock`, not artwork.

Requests time out after 15 seconds. A write timeout can leave an uncertain outcome, so refresh before retrying; writes are not automatically repeated. Other clients' changes require Refresh. The local exercise has no authentication or purchase/inventory reservation logic.

## Configuration and structure

Copy `.env.example` to `.env.local` and set `VITE_PRODUCTS_API_URL` to override the endpoint. Restart Vite. `VITE_` values are public and must not contain database credentials. The backend's CORS configuration must allow the frontend's exact origin.

`components/` contains cards and dialogs, `hooks/use-products.ts` manages the catalog lifecycle, `services/products-api.ts` handles HTTP and runtime validation, `types/product.ts` defines contracts, and `utils/products.ts` implements filtering, formatting and form parsing. Test fixtures are never used as live data.

```sh
npm run build --workspace @fullstack-lab/storefront
npm run preview --workspace @fullstack-lab/storefront
```

Build output: `apps/storefront/dist/`. Preview: http://127.0.0.1:4173. If testing this preview against Spring Boot, add its exact origin to `CORS_ORIGINS`; the default backend origins include port 5173, not 4173.
