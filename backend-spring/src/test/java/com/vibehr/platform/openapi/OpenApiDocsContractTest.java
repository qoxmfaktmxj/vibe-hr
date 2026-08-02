package com.vibehr.platform.openapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.VibeHrApplication;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(
        classes = VibeHrApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("flyway-cutover")
class OpenApiDocsContractTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_openapi")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("vibehr.migration.owner", () -> "flyway");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void exposesFastApiCompatiblePublicDocumentationEndpoints() throws Exception {
        mockMvc.perform(get("/openapi.json"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
        mockMvc.perform(head("/openapi.json"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
        mockMvc.perform(get("/docs"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("SwaggerUIBundle")));
        mockMvc.perform(head("/docs"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/docs/oauth2-redirect"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("oauth2")));
        mockMvc.perform(head("/docs/oauth2-redirect"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/redoc"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/openapi.json")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/webjars/redoc/2.5.1/")))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("http://"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("https://"))))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("script-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("script-src 'self' 'unsafe-inline'"))));
        mockMvc.perform(head("/redoc"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
        mockMvc.perform(get("/webjars/redoc/2.5.1/redoc.standalone.js"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("text/javascript")));
    }

    @Test
    void openapiDocumentsEveryApplicationOperation() throws Exception {
        String body = mockMvc.perform(get("/openapi.json"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode document = objectMapper.readTree(body);
        Set<String> documented = documentedOperations(document.path("paths"));
        JsonNode manifest = objectMapper.readTree(Files.readString(Path.of("..", "docs", "spring-migration", "endpoint-manifest.json")));
        Set<String> missing = new HashSet<>();
        for (JsonNode route : manifest.path("canonical_routes")) {
            if (!"source_decorator".equals(route.path("effective_handler").path("record_kind").asText())) continue;
            String key = route.path("method").asText() + " " + normalizePath(route.path("normalized_path").asText());
            if (!documented.contains(key)) missing.add(key);
        }
        assertThat(missing).isEmpty();
    }

    private Set<String> documentedOperations(JsonNode paths) {
        Set<String> result = new HashSet<>();
        for (Map.Entry<String, JsonNode> pathEntry : paths.properties()) {
            for (Map.Entry<String, JsonNode> methodEntry : pathEntry.getValue().properties()) {
                String method = methodEntry.getKey().toUpperCase();
                if (Set.of("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE").contains(method)) {
                    result.add(method + " " + normalizePath(pathEntry.getKey()));
                }
            }
        }
        return result;
    }

    private String normalizePath(String path) {
        return path.replaceAll("\\{[^}]+}", "{param}");
    }
}
