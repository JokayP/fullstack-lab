package com.example.products;

import com.example.products.product.ProductRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:tests;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "app.seed=false"
})
@AutoConfigureMockMvc
class ProductApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProductRepository repository;

    @BeforeEach void cleanUp() { repository.deleteAll(); }

    @Test void completeCrudLifecycle() throws Exception {
        String body = """
            {"name":"Notebook","price":2.50,"stock":20}
            """;
        String response = mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(header().exists("Location"))
            .andReturn().getResponse().getContentAsString();
        JsonNode product = mapper.readTree(response);
        long id = product.get("id").asLong();
        mvc.perform(get("/api/products/" + id)).andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Notebook"));
        mvc.perform(put("/api/products/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Large notebook\",\"price\":3.75,\"stock\":15}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(15));
        mvc.perform(get("/api/products/" + id)).andExpect(jsonPath("$.price").value(3.75));
        mvc.perform(delete("/api/products/" + id)).andExpect(status().isNoContent())
            .andExpect(content().string(""));
        mvc.perform(get("/api/products/" + id)).andExpect(status().isNotFound());
        assertThat(repository.count()).isZero();
    }

    @Test void emptyListAndCaseInsensitiveSearch() throws Exception {
        mvc.perform(get("/api/products")).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Backpack\",\"price\":18.90,\"stock\":8}"))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/products").param("name", "BACK"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/products").param("name", "missing"))
            .andExpect(content().json("[]"));
    }

    @Test void rejectsInvalidFieldsWithoutSaving() throws Exception {
        mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\" \",\"price\":0,\"stock\":-1}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.name").exists())
            .andExpect(jsonPath("$.errors.price").exists()).andExpect(jsonPath("$.errors.stock").exists());
        assertThat(repository.count()).isZero();
    }

    @Test void rejectsMissingFields() throws Exception {
        mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.price").exists());
    }

    @Test void rejectsFractionalStockAndInvalidJson() throws Exception {
        mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Pencil\",\"price\":0.50,\"stock\":1.5}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content("{invalid"))
            .andExpect(status().isBadRequest());
    }

    @Test void updateOrDeleteMissingProductReturns404() throws Exception {
        mvc.perform(put("/api/products/999999").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Pencil\",\"price\":0.50,\"stock\":1}"))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/products/999999")).andExpect(status().isNotFound());
    }

    @Test void allowsFrontendPreflight() throws Exception {
        mvc.perform(options("/api/products").header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "POST")
            .header("Access-Control-Request-Headers", "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test void rejectsUnconfiguredOrigin() throws Exception {
        mvc.perform(options("/api/products").header("Origin", "https://other.example")
            .header("Access-Control-Request-Method", "POST"))
            .andExpect(status().isForbidden());
    }
}
