# Verification

This historical record describes the original English-language backend verification. See [FRONTEND_VERIFICATION.md](FRONTEND_VERIFICATION.md) for the current Fullstack Lab applications and local verification results.

- Java 21 / Spring Boot 3.5.16: `clean verify` completed successfully.
- Eight integration tests passed with no failures, errors or skipped tests.
- A separate PostgreSQL 17.6 instance was initialized for this version. The application connected using the new `student` credentials and `products_db` database.
- Real HTTP requests verified seed data, the exact `id`, `name`, `price`, `stock` JSON fields, case-insensitive name search, creation, retrieval, update and deletion.
- The included Fetch module was executed against PostgreSQL-backed HTTP endpoints, including error handling and empty 204 responses.
- All eight Postman request payloads were executed in order through HTTP. This verified request contents and expected statuses; the Postman desktop UI itself was not used.
- CORS preflight was checked for the configured frontend origin.
- The previous Spanish endpoint and input field names were confirmed to be unsupported.

The React JSX examples were reviewed but not built as a standalone React application. They are intended to be copied into an existing React project. GitHub Actions and Docker Compose were not run remotely or through Docker; the equivalent Maven build was run locally and PostgreSQL was tested directly.

The original local delivery included a compiled JAR in `dist/`. The Git repository excludes JAR files, Java runtimes and database files. Build from source with JDK 21 as described in the root README.
