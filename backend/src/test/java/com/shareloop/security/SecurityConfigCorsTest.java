package com.shareloop.security;

import com.shareloop.config.CorsProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityConfigCorsTest {

    private final MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/listings");

    @Test
    @DisplayName("CORS configuration uses explicit origins without credentials by default")
    void corsUsesExplicitOriginsWithoutCredentials() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOrigins(List.of("https://shareloop.vn", "https://www.shareloop.vn"));

        CorsConfiguration configuration = configurationFor(properties);

        assertThat(configuration.getAllowedOrigins())
                .containsExactly("https://shareloop.vn", "https://www.shareloop.vn");
        assertThat(configuration.getAllowedOriginPatterns()).isEmpty();
        assertThat(configuration.getAllowCredentials()).isFalse();
    }

    @Test
    @DisplayName("CORS configuration supports restricted origin patterns")
    void corsSupportsRestrictedOriginPatterns() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOrigins(List.of("https://shareloop.vn"));
        properties.setAllowedOriginPatterns(List.of("https://*.shareloop.pages.dev"));

        CorsConfiguration configuration = configurationFor(properties);

        assertThat(configuration.getAllowedOriginPatterns())
                .containsExactly("https://*.shareloop.pages.dev");
    }

    @Test
    @DisplayName("Blank CORS entries are removed during binding")
    void blankCorsEntriesAreRemoved() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOrigins(List.of("https://shareloop.vn", " ", ""));
        properties.setAllowedOriginPatterns(List.of(" "));

        CorsConfiguration configuration = configurationFor(properties);

        assertThat(configuration.getAllowedOrigins()).containsExactly("https://shareloop.vn");
        assertThat(configuration.getAllowedOriginPatterns()).isEmpty();
    }

    @Test
    @DisplayName("Wildcard origin combined with credentials is rejected")
    void wildcardWithCredentialsIsRejected() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOrigins(List.of("*"));
        properties.setAllowCredentials(true);

        assertThatThrownBy(() -> new SecurityConfig(null, null, properties).corsConfigurationSource())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cannot be combined with allowCredentials=true");
    }

    private CorsConfiguration configurationFor(CorsProperties properties) {
        CorsConfigurationSource source = new SecurityConfig(null, null, properties).corsConfigurationSource();
        return source.getCorsConfiguration(request);
    }
}
