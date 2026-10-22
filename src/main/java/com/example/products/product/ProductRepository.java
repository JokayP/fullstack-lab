package com.example.products.product;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
    // Spring Data derives the query from the method name.
    List<Product> findByNameContainingIgnoreCaseOrderByIdAsc(String name);
}
