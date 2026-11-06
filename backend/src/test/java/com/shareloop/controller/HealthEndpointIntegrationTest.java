package com.shareloop.controller;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.actuate.health.Status;
import org.springframework.boot.actuate.jdbc.DataSourceHealthIndicator;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class HealthEndpointIntegrationTest {

    @Autowired
    private HealthEndpoint healthEndpoint;

    @Test
    @DisplayName("Health endpoint reports UP and exposes the database indicator")
    void healthIncludesDatabaseComponent() {
        HealthComponent health = healthEndpoint.health();
        assertThat(health.getStatus()).isEqualTo(Status.UP);

        HealthComponent database = healthEndpoint.healthForPath("db");
        assertThat(database).isNotNull();
        assertThat(database.getStatus()).isEqualTo(Status.UP);
    }

    @Test
    @DisplayName("Database health indicator reports DOWN when the database is unreachable")
    void databaseIndicatorDetectsUnreachableDatabase() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://127.0.0.1:65534/shareloop");
        config.setUsername("health-check");
        config.setPassword("health-check");
        config.setConnectionTimeout(1000);
        config.setValidationTimeout(1000);
        config.setInitializationFailTimeout(-1);
        config.setMaximumPoolSize(1);

        try (HikariDataSource dataSource = new HikariDataSource(config)) {
            Health health = new DataSourceHealthIndicator(dataSource).health();
            assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        }
    }
}
