-- Run once as a PostgreSQL administrator, using autocommit.
-- CREATE DATABASE cannot run inside a transaction.
CREATE USER student WITH PASSWORD 'local_class_2026';
CREATE DATABASE products_db OWNER student;

-- Connect to products_db as student after starting Spring Boot.
-- Spring Boot creates the products table automatically.
-- SELECT id, name, price, stock FROM products ORDER BY id;
-- SELECT * FROM products WHERE LOWER(name) LIKE '%back%';
