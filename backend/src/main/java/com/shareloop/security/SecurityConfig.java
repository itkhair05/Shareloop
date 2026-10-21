package com.shareloop.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

import java.util.Arrays;
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

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String allowedOrigins;

    public SecurityConfig(
            JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
            JwtAccessDeniedHandler jwtAccessDeniedHandler
    ) {
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
        this.jwtAccessDeniedHandler = jwtAccessDeniedHandler;
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
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
                        // Public health and monitoring endpoints
                        .requestMatchers("/api/health", "/actuator/health", "/actuator/info").permitAll()
                        // Error handling endpoint
                        .requestMatchers("/error").permitAll()
                        // Listing requests require authentication
                        .requestMatchers("/api/v1/listings/*/requests", "/api/v1/listing-requests/**").authenticated()
                        // Chat conversations and messages require authentication
                        .requestMatchers("/api/v1/listings/*/conversations", "/api/v1/conversations/**").authenticated()
                        // Transactions require authentication
                        .requestMatchers("/api/v1/listings/*/transaction", "/api/v1/transactions/**").authenticated()
                        // Listing endpoints: GET /mine must require authentication before public listing matchers
                        .requestMatchers(HttpMethod.GET, "/api/v1/listings/mine").authenticated()
                        // Category endpoints: public retrieval
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories", "/api/v1/categories/{slug}").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/listings", "/api/v1/listings/{id}").permitAll()
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
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "Origin"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
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
