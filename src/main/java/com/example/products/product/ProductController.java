package com.example.products.product;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductService service;

    public ProductController(ProductService service) { this.service = service; }

    @GetMapping
    public List<Product> list(@RequestParam(required = false) String name) {
        return service.list(name);
    }

    @GetMapping("/{id}")
    public Product find(@PathVariable Long id) { return service.find(id); }

    @PostMapping
    public ResponseEntity<Product> create(@Valid @RequestBody ProductRequest data) {
        Product product = service.create(data);
        return ResponseEntity.created(URI.create("/api/products/" + product.getId())).body(product);
    }

    @PutMapping("/{id}")
    public Product update(@PathVariable Long id, @Valid @RequestBody ProductRequest data) {
        return service.update(id, data);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
