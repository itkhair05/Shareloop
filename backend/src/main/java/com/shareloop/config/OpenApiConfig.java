package com.shareloop.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    public static final String SECURITY_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI shareLoopOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("ShareLoop REST API")
                        .version("1.0.0")
                        .description("Comprehensive REST API documentation for ShareLoop — a community-driven item sharing, giving, and trading platform. Features include secure JWT authentication, listings with multi-image support, listing requests and offers, direct chat messaging, double-confirmed transaction lifecycle, user ratings and reviews, in-app notifications, and secure bounded image uploads.")
                        .contact(new Contact()
                                .name("ShareLoop Engineering Team")
                                .url("https://github.com/itkhair05/Shareloop"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .tags(List.of(
                        new Tag().name("Authentication").description("User registration, login, and current user profile"),
                        new Tag().name("Categories").description("Item category catalog and hierarchical lookup"),
                        new Tag().name("Listings").description("Item listings creation, retrieval, updates, status transitions, and images"),
                        new Tag().name("Listing Requests").description("Item requests, offers, and lifecycle transitions"),
                        new Tag().name("Chat").description("Direct conversations, messaging between users, and unread counters"),
                        new Tag().name("Transactions").description("Escrow/handoff dual confirmation lifecycle and status management"),
                        new Tag().name("Reviews").description("Participant ratings, reputation feedback, and moderation"),
                        new Tag().name("Notifications").description("In-app notifications and read status updates"),
                        new Tag().name("File Storage").description("Secure image upload (JPEG/PNG max 5 MiB) and public resource delivery"),
                        new Tag().name("Health & Monitoring").description("System liveness and health checks")
                ))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME, new SecurityScheme()
                                .name(SECURITY_SCHEME_NAME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Enter your JWT token obtained from POST /api/v1/auth/login or POST /api/v1/auth/register.")));
    }
}
