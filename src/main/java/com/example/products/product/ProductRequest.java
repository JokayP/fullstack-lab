package com.example.products.product;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

// DTO: only fields accepted from the client. The database generates the ID.
public record ProductRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must contain at most 100 characters")
    String name,

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.01", message = "Price must be at least 0.01")
    @Digits(integer = 8, fraction = 2, message = "Price allows up to 8 integer digits and 2 decimal places")
    BigDecimal price,

    @NotNull(message = "Stock is required")
    @Min(value = 0, message = "Stock must not be negative")
    Integer stock
) { }
