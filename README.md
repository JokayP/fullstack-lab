# Fullstack Lab

Two independent React + TypeScript + Tailwind CSS applications, with the original Spring Boot Products API:

| Application  | Folder                  | Data                                                    | Search                                                                   |
| ------------ | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Paper & Form | apps/storefront         | Our Spring Boot backend and PostgreSQL or file-based H2 | Immediate filtering while typing, without Enter                          |
| Portal       | apps/character-explorer | Rick and Morty characters, locations and episodes       | Automatic search while typing, with a four-second minimum loading period |

Paper & Form is a small product catalog: cards, search, create, edit and confirmed deletion. Product names, prices and stock are saved to the database. There is no cart, checkout or payment flow. Portal stays independent of the local database and does not advertise its loading duration in the interface.

Portal joins three REST resources in the frontend: it searches `/character`, retrieves the referenced `/location/{ids}` and `/episode/{ids}` records, then combines them by ID. Cards show location and first-episode details; the character dialog shows origin, dimension and all episode appearances. See the [Portal README](apps/character-explorer/README.md) for the request flow and timing contract.

## Start locally

Use Node.js 22.12+ and npm 10+ for the frontends, and JDK 21 for the backend. Configure JAVA_HOME to point to JDK 21 and add its bin directory to PATH. The Maven Wrapper downloads Maven automatically.

After cloning or downloading the repository, open a terminal in `fullstack-lab` and build the backend:

```powershell
java -version
.\mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

On Linux/macOS, use `bash ./mvnw --batch-mode --no-transfer-progress clean verify`. The first build requires internet to download dependencies.

Terminal 1, from the project root:

```powershell
java -jar ./target/products-crud-1.0.0.jar --spring.profiles.active=h2
```

Wait for Started ProductsApplication. Spring Boot uses persistent H2 in data/products. On Windows, `start-demo.cmd` is also available: it prefers a locally built target JAR and falls back to a prepared dist JAR.

Terminal 2:

```sh
npm ci
npm run dev:store
```

Terminal 3:

```sh
npm run dev:characters
```

Open http://127.0.0.1:5173 for the store and http://127.0.0.1:5174 for Portal. The Products API runs at http://localhost:8080/api/products. The store requires the backend; Portal requires internet. After dependencies are installed, the store can work offline with the local backend because its artwork is local SVG.

The java/ runtime, local database and JAR files are not tracked in Git. A fresh checkout on another computer needs Java 21 and a Maven build. The backend keeps its products-crud artifact name for compatibility with the existing launcher and pipeline.

## Verification and documentation

Run `npm run verify` for frontend formatting, strict types, tests and builds. Run `npm run format` to apply formatting. Each frontend builds to its own dist/ folder.

With Java 21 configured, run `.\mvnw.cmd --batch-mode --no-transfer-progress clean verify` for the backend. The GitHub Actions workflows verify both parts and upload build artifacts; they do not deploy.

Read the [verification record](docs/FRONTEND_VERIFICATION.md) and each app's README for implementation details and validation results. Code, comments and UI text are in English.

## Backend documentation

English-language backend built with Java 21, Spring Boot 3.5.16, Spring Data JPA and PostgreSQL. Includes a persistent H2 alternative, input validation, JSON errors, CORS, integration tests, a GitHub Actions pipeline and frontend examples.

All source code, identifiers, comments, database names, API fields, response messages, sample data and executable examples are in English. A Spanish explanation of frontend integration is available in `docs/CONNECT_FRONTEND_ES.md`.

## Quick start

After building from source, open a terminal in `fullstack-lab` and run:

```powershell
java -version
java -jar .\target\products-crud-1.0.0.jar --spring.profiles.active=h2
```

Use Java 21 or a compatible newer JDK. Java 8 and Java 17 cannot execute application classes compiled for Java 21. Wait for `Started ProductsApplication`, then open:

```text
http://localhost:8080/api/products
```

The initial products are Notebook, Pencil and Backpack. Keep the terminal open; press Ctrl+C to stop the application.

### Portable Java on Windows

Copy a complete Windows x64 Java 21 runtime/JDK into a folder named `java` inside `fullstack-lab`:

```text
fullstack-lab/
  java/
    bin/java.exe
    ...the rest of the Java distribution
  target/products-crud-1.0.0.jar
  start-demo.cmd
```

Double-click `start-demo.cmd` or run:

```powershell
.\java\bin\java.exe -jar .\target\products-crud-1.0.0.jar --spring.profiles.active=h2
```

The launcher prefers the `java` folder, then falls back to JAVA_HOME or PATH. To build with a portable JDK, set JAVA_HOME to that folder before running Maven. The repository does not include Java or compiled JAR files. Once built, the executable JAR with H2 needs Java but no separate database installation.

## H2 database

The H2 profile stores records in `data/products`, relative to the directory where you start the application. It does not load data from the previous Spanish database.

While the application is running, visit `http://localhost:8080/h2-console` with:

- JDBC URL: `jdbc:h2:file:./data/products`
- User: `sa`
- Password: empty

Seed data is inserted only when the table is empty at startup. Add `--app.seed=false` to disable seeding.

## PostgreSQL

PostgreSQL is the default profile. If Docker Desktop is installed and running:

```powershell
docker compose up -d --wait
java -jar .\target\products-crud-1.0.0.jar
```

Alternatively, use an existing PostgreSQL server and run `docs/create-postgresql-database.sql` as an administrator. Run each statement with autocommit enabled.

| Setting                 | Default          |
| ----------------------- | ---------------- |
| Host                    | localhost        |
| Port                    | 5432             |
| Database                | products_db      |
| User                    | student          |
| Local practice password | local_class_2026 |

Override the connection through environment variables if necessary:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/products_db"
$env:DB_USER = "student"
$env:DB_PASSWORD = "local_class_2026"
java -jar .\target\products-crud-1.0.0.jar
```

This version uses new database, user and table names. Prepare the new database rather than assuming the previous Spanish database has been migrated. Stop any previous PostgreSQL container using port 5432 before starting this project's Compose service. `docker compose down` stops this project's database and preserves its volume.

## Database table

Table: `products`. Hibernate creates the table on startup using `ddl-auto=update`.

| Column | Database type               | API rule                                             |
| ------ | --------------------------- | ---------------------------------------------------- |
| id     | BIGINT identity primary key | Generated by the database                            |
| name   | VARCHAR(100), NOT NULL      | Required and not blank; at most 100 characters       |
| price  | NUMERIC(10,2), NOT NULL     | At least 0.01; up to 8 integer digits and 2 decimals |
| stock  | INTEGER, NOT NULL           | Required, integer, zero or greater                   |

The API's minimum-value rules are not database CHECK constraints. Direct SQL writes can bypass those API validations.

```sql
SELECT id, name, price, stock FROM products ORDER BY id;
SELECT * FROM products WHERE LOWER(name) LIKE '%back%';
```

## API contract

| Operation      | HTTP request                | Success                              |
| -------------- | --------------------------- | ------------------------------------ |
| List           | GET /api/products           | 200, JSON array                      |
| Search by name | GET /api/products?name=back | 200, JSON array                      |
| Get one        | GET /api/products/{id}      | 200, JSON object                     |
| Create         | POST /api/products          | 201, JSON object and Location header |
| Update         | PUT /api/products/{id}      | 200, JSON object                     |
| Delete         | DELETE /api/products/{id}   | 204, no response body                |

POST and PUT accept every editable field, without an ID:

```json
{ "name": "Ruler", "price": 1.25, "stock": 10 }
```

Example list response:

```json
[{ "id": 1, "name": "Notebook", "price": 2.5, "stock": 20 }]
```

An empty search returns `[]`. A missing ID returns 404. Invalid input returns 400:

```json
{
  "status": 400,
  "message": "Check the submitted data",
  "errors": { "stock": "Stock must not be negative" }
}
```

PUT updates all editable fields of an existing product. PATCH is not implemented. The previous Spanish endpoint and field names are not aliases in this version.

## Test with Postman or PowerShell

Import `examples/Products.postman_collection.json` into Postman and run requests in order. The create request stores `productId` automatically. `examples/products.http` offers equivalent requests for compatible HTTP clients; update its `productId` variable after creating a product.

```powershell
$baseUrl = "http://localhost:8080/api/products"
Invoke-RestMethod $baseUrl
$product = Invoke-RestMethod -Method Post -Uri $baseUrl -ContentType "application/json" -Body '{"name":"Ruler","price":1.25,"stock":10}'
Invoke-RestMethod "$baseUrl/$($product.id)"
Invoke-RestMethod -Method Put -Uri "$baseUrl/$($product.id)" -ContentType "application/json" -Body '{"name":"Large ruler","price":1.75,"stock":12}'
Invoke-RestMethod -Method Delete -Uri "$baseUrl/$($product.id)"
```

## Source structure

```text
src/main/java/com/example/products/
  ProductsApplication.java
  product/
    Product.java
    ProductRequest.java
    ProductController.java
    ProductService.java
    ProductRepository.java
  config/
    WebConfig.java
    SeedData.java
    ApiExceptionHandler.java
```

Request flow: frontend → ProductController → ProductService → ProductRepository → database. The response travels back as HTTP status plus JSON.

- Controller handles HTTP and validates request DTOs.
- Service performs application operations and checks whether products exist.
- Repository uses Spring Data JPA to access the database.
- Product maps to a database row; ProductRequest defines allowed input fields.
- WebConfig allows configured frontend origins through CORS.

## Frontend examples

These are files to integrate into an existing React frontend, not a standalone frontend project. Copy:

| Included file            | Frontend destination                    |
| ------------------------ | --------------------------------------- |
| examples/products-api.js | src/services/products-api.js            |
| examples/ProductList.jsx | src/components/ProductList.jsx          |
| examples/App.jsx         | src/App.jsx, or adapt your existing App |

The API module exports `listProducts`, `getProduct`, `createProduct`, `updateProduct` and `deleteProduct`. ProductList demonstrates listing with loading/error handling. App renders ProductList. The examples do not implement a full create/edit/delete UI.

```javascript
import { createProduct, updateProduct, deleteProduct } from './services/products-api';

const product = await createProduct({ name: 'Ruler', price: 1.25, stock: 10 });
await updateProduct(product.id, { name: 'Large ruler', price: 1.75, stock: 12 });
await deleteProduct(product.id);
```

The snippet is an ES module example. Inside a React event handler, place awaited operations in an async function and handle errors. Convert form input strings to numbers and validate empty inputs before creating a request body.

Allowed origins include localhost and 127.0.0.1 on ports 5173 and 3000. To use another frontend port:

```powershell
$env:CORS_ORIGINS = "http://localhost:5174,http://127.0.0.1:5174"
java -jar .\target\products-crud-1.0.0.jar --spring.profiles.active=h2
```

Do not use `mode: "no-cors"` to work around configuration errors. Check the browser console, API URL and exact frontend origin.

## Build and CI pipeline

With JDK 21 installed, run:

```powershell
.\mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

On Linux/macOS: `bash ./mvnw --batch-mode --no-transfer-progress clean verify`.

The first source build needs dependency downloads. The Maven Wrapper manages Maven. Tests use a separate in-memory H2 database. The newly built JAR appears in `target/products-crud-1.0.0.jar`. Build outputs and local database files are excluded from Git.

The workflow in `.github/workflows/ci.yml` performs checkout → Java setup → compile/test/package → artifact upload. The frontend workflow verifies and builds both React applications. Both workflows run on pushes and pull requests; their status and downloadable artifacts appear in the repository's Actions tab. They do not deploy the application.

## Troubleshooting

| Symptom                      | Check                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------- |
| java command not found       | Use the portable Java folder or configure Java 21                               |
| UnsupportedClassVersionError | Use Java 21; an older Java may be selected by PATH                              |
| Port 8080 is in use          | Stop the previous backend or use --server.port=8081 and update the frontend URL |
| / returns 404                | Open /api/products                                                              |
| Old Spanish URL returns 404  | This version uses /api/products                                                 |
| POST or PUT returns 400      | Check English field names, numeric values and Content-Type                      |
| DELETE returns an empty body | Expected for HTTP 204                                                           |
| PostgreSQL connection fails  | Check server, database and credentials; H2 is available for offline practice    |

This is a local teaching project without authentication, pagination or production migrations. It listens on localhost and uses practice credentials.
