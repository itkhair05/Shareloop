package com.shareloop.security.ratelimit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientIpResolverTest {

    private static final String REMOTE = "198.51.100.10";
    private static final String TRUSTED_PROXY = "10.0.0.1";
    private static final String CLIENT = "203.0.113.195";

    private static RateLimitProperties props(RateLimitProperties.ClientIpMode mode) {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setClientIpMode(mode);
        return properties;
    }

    private static MockHttpServletRequest request(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private static ClientIpResolver directResolver() {
        return new ClientIpResolver(props(RateLimitProperties.ClientIpMode.DIRECT));
    }

    @Nested
    @DisplayName("DIRECT mode")
    class DirectMode {

        @Test
        @DisplayName("Ignoring X-Forwarded-For prevents bucket escape")
        void ignoresForwardedFor() {
            MockHttpServletRequest request = request(REMOTE);
            request.addHeader("X-Forwarded-For", "1.2.3.4");

            assertThat(directResolver().resolveClientIp(request)).isEqualTo(REMOTE);
        }

        @Test
        @DisplayName("Ignores Forwarded, X-Real-IP and X-Forwarded-Host headers")
        void ignoresOtherForwardingHeaders() {
            MockHttpServletRequest request = request(REMOTE);
            request.addHeader("Forwarded", "for=1.2.3.4;proto=https");
            request.addHeader("X-Real-IP", "1.2.3.4");
            request.addHeader("X-Forwarded-Host", "evil.example");

            assertThat(directResolver().resolveClientIp(request)).isEqualTo(REMOTE);
        }

        @Test
        @DisplayName("Uses the remote address when no headers are present")
        void noHeadersUsesRemote() {
            assertThat(directResolver().resolveClientIp(request(REMOTE))).isEqualTo(REMOTE);
        }

        @Test
        @DisplayName("Falls back to loopback when the request remote address is missing")
        void nullRequestFallsBack() {
            assertThat(directResolver().resolveClientIp(null)).isEqualTo(ClientIpResolver.DEFAULT_FALLBACK_IP);
        }
    }

    @Nested
    @DisplayName("TRUSTED_CIDR mode")
    class TrustedCidrMode {

        private ClientIpResolver resolverWith(String... trusted) {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);
            properties.setTrustedProxies(List.of(trusted));
            return new ClientIpResolver(properties);
        }

        @Test
        @DisplayName("Resolves the client address from a trusted single-hop proxy")
        void singleHop() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", CLIENT);

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(CLIENT);
        }

        @Test
        @DisplayName("Walks right-to-left and ignores an attacker-prepended leftmost value")
        void ignoresLeftmostAttackerValue() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            // "6.6.6.6" was prepended by the client, CLIENT was appended by the trusted proxy.
            request.addHeader("X-Forwarded-For", "6.6.6.6, " + CLIENT);

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(CLIENT);
        }

        @Test
        @DisplayName("Skips multiple trusted proxies on the right")
        void multipleTrustedHops() {
            MockHttpServletRequest request = request("10.0.0.1");
            request.addHeader("X-Forwarded-For", "6.6.6.6, " + CLIENT + ", 10.0.0.2");

            assertThat(resolverWith("10.0.0.0/24").resolveClientIp(request)).isEqualTo(CLIENT);
        }

        @Test
        @DisplayName("Uses the remote address when the immediate peer is not trusted")
        void untrustedPeerIgnored() {
            MockHttpServletRequest request = request(REMOTE);
            request.addHeader("X-Forwarded-For", CLIENT);

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(REMOTE);
        }

        @Test
        @DisplayName("Uses the remote address when the chain is entirely trusted proxies")
        void allTrustedFallsBackToRemote() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "10.0.0.2, 10.0.0.3");

            assertThat(resolverWith("10.0.0.0/24").resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);
        }

        @Test
        @DisplayName("Falls back to remote when the proxy-appended entry is malformed")
        void malformedEntryRejected() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            // The malformed value is the rightmost entry, i.e. the one the trusted proxy appended.
            request.addHeader("X-Forwarded-For", CLIENT + ", not-an-ip");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);
        }

        @Test
        @DisplayName("Ignores a malformed attacker-prepended leftmost entry")
        void malformedLeftmostEntryIgnored() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "not-an-ip, " + CLIENT);

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(CLIENT);
        }

        @Test
        @DisplayName("Rejects a hostname and never performs DNS resolution")
        void hostnameNeverResolved() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "evil.example.com");

            assertThatCode(() -> assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request))
                    .isEqualTo(TRUSTED_PROXY)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Rejects a malformed IPv4 literal")
        void malformedIpv4Rejected() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "999.0.0.1");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);
        }

        @Test
        @DisplayName("Accepts a valid IPv6 client and normalizes it")
        void validIpv6Accepted() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "2001:0db8:0000:0000:0000:0000:0000:0001");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo("2001:db8::1");
        }

        @Test
        @DisplayName("Collapses an IPv4-mapped IPv6 address to IPv4")
        void ipv4MappedCollapsed() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "::ffff:203.0.113.5");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo("203.0.113.5");
        }

        @Test
        @DisplayName("Accepts an IPv4 address with a port")
        void ipv4WithPort() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "203.0.113.9:4567");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo("203.0.113.9");
        }

        @Test
        @DisplayName("Accepts a bracketed IPv6 address with a port")
        void bracketedIpv6WithPort() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "[2001:db8::2]:443");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo("2001:db8::2");
        }

        @Test
        @DisplayName("Rejects duplicate X-Forwarded-For header lines as ambiguous")
        void duplicateHeaderLinesRejected() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", CLIENT);
            request.addHeader("X-Forwarded-For", "6.6.6.6");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);
        }

        @Test
        @DisplayName("Falls back to remote for an empty header value")
        void emptyHeaderFallsBack() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", "   ");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);
        }

        @Test
        @DisplayName("Conflicting Forwarded and X-Forwarded-For: only X-Forwarded-For is interpreted")
        void conflictingHeadersUseForwardedForOnly() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("Forwarded", "for=6.6.6.6");
            request.addHeader("X-Forwarded-For", CLIENT);

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(CLIENT);
        }

        @Test
        @DisplayName("Ignores an arbitrary Forwarded header entirely")
        void arbitraryForwardedHeaderIgnored() {
            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("Forwarded", "for=6.6.6.6;proto=https;by=10.0.0.1");

            assertThat(resolverWith(TRUSTED_PROXY).resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);
        }

        @Test
        @DisplayName("Honours trusted proxy list changes without recreating the resolver")
        void trustedListChangesAreHonoured() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);
            properties.setTrustedProxies(List.of("10.0.0.99"));
            ClientIpResolver resolver = new ClientIpResolver(properties);

            MockHttpServletRequest request = request(TRUSTED_PROXY);
            request.addHeader("X-Forwarded-For", CLIENT);
            assertThat(resolver.resolveClientIp(request)).isEqualTo(TRUSTED_PROXY);

            properties.setTrustedProxies(List.of(TRUSTED_PROXY));
            assertThat(resolver.resolveClientIp(request)).isEqualTo(CLIENT);
        }
    }

    @Nested
    @DisplayName("Legacy TRUSTED_HOPS is rejected")
    class LegacyTrustedHopsRejected {

        @Test
        @DisplayName("Constructing the resolver with TRUSTED_HOPS fails with an actionable error")
        void constructorFails() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_HOPS);

            assertThatThrownBy(() -> new ClientIpResolver(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("TRUSTED_HOPS is no longer supported")
                    .hasMessageContaining("TRUSTED_CIDR");
        }

        @Test
        @DisplayName("Early production validation rejects TRUSTED_HOPS")
        void validateConfigurationFails() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_HOPS);

            assertThatThrownBy(() -> ClientIpResolver.validateConfiguration(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("TRUSTED_HOPS is no longer supported");
        }

        @Test
        @DisplayName("Error explains the migration path")
        void errorMessageExplainsMigration() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_HOPS);

            assertThatThrownBy(() -> ClientIpResolver.validateConfiguration(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("TRUSTED_PROXY_HOPS");
        }
    }

    @Nested
    @DisplayName("Configuration validation")
    class ConfigurationValidation {

        @Test
        @DisplayName("TRUSTED_CIDR without trusted proxies fails fast")
        void trustedCidrRequiresProxies() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);

            assertThatThrownBy(() -> new ClientIpResolver(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("TRUSTED_PROXIES");
        }

        @Test
        @DisplayName("TRUSTED_HOPS without hops fails fast")
        void trustedHopsRequiresHops() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_HOPS);

            assertThatThrownBy(() -> new ClientIpResolver(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("TRUSTED_PROXY_HOPS");
        }

        @Test
        @DisplayName("Invalid CIDR literal fails fast")
        void invalidCidrFailsFast() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);
            properties.setTrustedProxies(List.of("not-an-ip"));

            assertThatThrownBy(() -> ClientIpResolver.validateConfiguration(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("IPv4 or IPv6 literal");
        }

        @Test
        @DisplayName("Out-of-range prefix fails fast")
        void invalidPrefixFailsFast() {
            RateLimitProperties properties = props(RateLimitProperties.ClientIpMode.TRUSTED_CIDR);
            properties.setTrustedProxies(List.of("10.0.0.0/33"));

            assertThatThrownBy(() -> ClientIpResolver.validateConfiguration(properties))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("prefix length");
        }

        @Test
        @DisplayName("DIRECT requires no trusted proxy configuration")
        void directRequiresNothing() {
            assertThatCode(() -> ClientIpResolver.validateConfiguration(props(RateLimitProperties.ClientIpMode.DIRECT)))
                    .doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("Literal normalization")
    class LiteralNormalization {

        private final ClientIpResolver resolver = directResolver();

        @Test
        @DisplayName("Rejects IPv4 with leading zeros and out-of-range octets")
        void rejectsAmbiguousIpv4() {
            assertThat(resolver.normalizeIp("01.2.3.4")).isNull();
            assertThat(resolver.normalizeIp("256.1.1.1")).isNull();
            assertThat(resolver.normalizeIp("1.2.3")).isNull();
            assertThat(resolver.normalizeIp("1.2.3.4.5")).isNull();
        }

        @Test
        @DisplayName("Rejects hostnames")
        void rejectsHostnames() {
            assertThat(resolver.normalizeIp("localhost")).isNull();
            assertThat(resolver.normalizeIp("example.com")).isNull();
        }

        @Test
        @DisplayName("Rejects zone identifiers and empty values")
        void rejectsZoneAndEmpty() {
            assertThat(resolver.normalizeIp("fe80::1%eth0")).isNull();
            assertThat(resolver.normalizeIp("")).isNull();
            assertThat(resolver.normalizeIp(null)).isNull();
        }

        @Test
        @DisplayName("Rejects comma-joined chains")
        void rejectsChains() {
            assertThat(resolver.normalizeIp("1.2.3.4, 5.6.7.8")).isNull();
        }

        @Test
        @DisplayName("Canonicalizes valid addresses")
        void canonicalizes() {
            assertThat(resolver.normalizeIp("203.0.113.9")).isEqualTo("203.0.113.9");
            assertThat(resolver.normalizeIp("::1")).isEqualTo(ClientIpResolver.DEFAULT_FALLBACK_IP);
            assertThat(resolver.normalizeIp("2001:db8::0:1")).isEqualTo("2001:db8::1");
            assertThat(resolver.normalizeIp("::")).isEqualTo("::");
        }
    }
}
