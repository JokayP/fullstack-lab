package com.example.products.config;

import com.example.products.product.Product;
import com.example.products.product.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SeedData {
    @Bean
    @ConditionalOnProperty(name = "app.seed", havingValue = "true")
    CommandLineRunner seedProducts(ProductRepository repository) {
        return args -> {
            if (repository.count() == 0) {
                repository.saveAll(List.of(
                    new Product("Notebook", new BigDecimal("2.50"), 20),
                    new Product("Pencil", new BigDecimal("0.50"), 50),
                    new Product("Backpack", new BigDecimal("18.90"), 8)
                ));
            }
        };
    }
}
