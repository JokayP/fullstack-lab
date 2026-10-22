package com.example.products.product;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ProductService {
    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public List<Product> list(String name) {
        return name == null || name.isBlank()
            ? repository.findAll(Sort.by("id"))
            : repository.findByNameContainingIgnoreCaseOrderByIdAsc(name.trim());
    }

    public Product find(Long id) {
        return repository.findById(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    @Transactional
    public Product create(ProductRequest data) {
        return repository.save(new Product(data.name(), data.price(), data.stock()));
    }

    @Transactional
    public Product update(Long id, ProductRequest data) {
        Product product = find(id);
        product.update(data.name(), data.price(), data.stock());
        return repository.save(product);
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }
}
