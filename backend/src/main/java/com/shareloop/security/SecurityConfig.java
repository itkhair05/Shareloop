package com.shareloop.security;

import com.shareloop.config.CorsProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security configuration for ShareLoop REST API.
 *
 * Architecture decisions:
 * 1. CSRF is disabled because this is a stateless REST API using Bearer token authentication
 *    via the HTTP Authorization header. Cross-Site Request Forgery (CSRF) relies on ambient
 *    credentials (such as session cookies) automatically attached by browsers. Since Bearer
 *    tokens are never sent automatically by browsers, CSRF vulnerabilities do not apply.
 * 2. Session management is set to STATELESS: no HttpSession is created or used for security context.
 * 3. CORS is explicitly restricted to configured trusted origins (e.g. Vite frontend on localhost:5173).
 * 4. Password hashing uses BCrypt with strength 10.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;
    private final CorsProperties corsProperties;

    public SecurityConfig(
            JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
            JwtAccessDeniedHandler jwtAccessDeniedHandler,
            CorsProperties corsProperties
    ) {
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
        this.jwtAccessDeniedHandler = jwtAccessDeniedHandler;
        this.corsProperties = corsProperties;
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(
            JwtService jwtService,
            CustomUserDetailsService customUserDetailsService
    ) {
        return new JwtAuthenticationFilter(jwtService, customUserDetailsService);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) throws Exception {
        http
                // Disable CSRF for stateless token-based API
                .csrf(AbstractHttpConfigurer::disable)
                // Configure CORS
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Stateless session management
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Custom JSON handlers for unauthorized and forbidden responses
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler(jwtAccessDeniedHandler)
                )
                // Authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Public authentication endpoints
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/auth/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password",
                                "/api/v1/auth/google"
                        ).permitAll()
                        // Public health and monitoring endpoints
                        .requestMatchers("/api/health", "/actuator/health", "/actuator/info").permitAll()
                        // OpenAPI 3 documentation and Swagger UI
                        .requestMatchers(
                                "/v3/api-docs",
                                "/v3/api-docs/**",
                                "/swagger-ui.html",
                                "/swagger-ui/**"
                        ).permitAll()
                        // Error handling endpoint
                        .requestMatchers("/error").permitAll()
                        // Listing requests require authentication
                        .requestMatchers("/api/v1/listings/*/requests", "/api/v1/listing-requests/**").authenticated()
                        // Chat conversations and messages require authentication
                        .requestMatchers("/api/v1/listings/*/conversations", "/api/v1/conversations/**").authenticated()
                        // Private chat image attachments require authentication (participant check happens in the service)
                        .requestMatchers("/api/v1/chat-images/**").authenticated()
                        // Transactions require authentication
                        .requestMatchers("/api/v1/listings/*/transaction", "/api/v1/transactions/**").authenticated()
                        // Notifications require authentication
                        .requestMatchers("/api/v1/notifications/**").authenticated()
                        // File upload requires authentication
                        .requestMatchers(HttpMethod.POST, "/api/v1/files/upload").authenticated()
                        // Public file serving for images
                        .requestMatchers(HttpMethod.GET, "/api/v1/files/*").permitAll()
                        // Public review images; hidden review images are rejected in the service
                        .requestMatchers(HttpMethod.GET, "/api/v1/review-images/**").permitAll()
                        // Listing endpoints: GET /mine must require authentication before public listing matchers
                        .requestMatchers(HttpMethod.GET, "/api/v1/listings/mine").authenticated()
                        // Category endpoints: public retrieval
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories", "/api/v1/categories/{slug}").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/listings", "/api/v1/listings/{id}").permitAll()
                        // Public user profile, user listings, reviews, and rating summaries
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/users/{userId}",
                                "/api/v1/users/{userId}/listings",
                                "/api/v1/users/{userId}/reviews",
                                "/api/v1/users/{userId}/rating-summary"
                        ).permitAll()
                        // Support requests and violation reports require authentication
                        .requestMatchers("/api/v1/support-requests/**", "/api/v1/reports/**").authenticated()
                        // Admin endpoints restricted to ADMIN role
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        // All other endpoints require authentication
                        .anyRequest().authenticated()
                )
                // Integrate JWT filter before standard username/password filter
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = corsProperties.getAllowedOrigins();
        List<String> originPatterns = corsProperties.getAllowedOriginPatterns();
        boolean allowCredentials = corsProperties.isAllowCredentials();

        if (allowCredentials && (origins.contains("*") || originPatterns.contains("*"))) {
            throw new IllegalStateException(
                    "CORS wildcard '*' cannot be combined with allowCredentials=true. " +
                    "Configure explicit origins or restricted origin patterns."
            );
        }

        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedOriginPatterns(originPatterns);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "Origin"));
        configuration.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        configuration.setAllowCredentials(allowCredentials);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
