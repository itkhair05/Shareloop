package com.shareloop.security.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;

/**
 * Resolves the client IP used for rate limiting.
 *
 * <p>The resolver never performs DNS resolution. Only IPv4 and IPv6 literals are
 * accepted; hostnames, zone identifiers and malformed chains are rejected and the
 * connection remote address is used instead (fail-safe, never the attacker value).</p>
 *
 * <p>Trust model, selected explicitly through {@code app.security.rate-limit.client-ip-mode}:</p>
 * <ul>
 *     <li>{@code DIRECT} (default): ignore every forwarding header, use the connection remote address.</li>
 *     <li>{@code TRUSTED_CIDR}: only trust {@code X-Forwarded-For} when the immediate peer matches a
 *     configured CIDR; walk right-to-left and return the first address that is not a trusted proxy.
 *     The leftmost value is never trusted.</li>
 * </ul>
 *
 * <p>{@code TRUSTED_HOPS} was removed: hop counting alone cannot verify that the connection peer
 * belongs to a trusted proxy boundary, so a direct attacker could forge an X-Forwarded-For chain
 * of the configured length and escape rate-limit buckets. A configuration still naming it fails
 * startup with an actionable error; it never falls back silently.</p>
 *
 * <p>{@code Forwarded} and {@code X-Real-IP} are intentionally ignored so only one header grammar is
 * interpreted. Duplicate {@code X-Forwarded-For} header lines are treated as ambiguous and rejected.</p>
 */
@Component
public class ClientIpResolver {

    private static final Logger log = LoggerFactory.getLogger(ClientIpResolver.class);
    static final String DEFAULT_FALLBACK_IP = "127.0.0.1";
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";

    private final RateLimitProperties properties;
    private final Object trustedRulesLock = new Object();
    private volatile List<CidrRule> trustedRules;
    private volatile List<String> trustedRulesSource;

    public ClientIpResolver(RateLimitProperties properties) {
        this.properties = properties;
        List<String> configured = properties != null ? properties.getTrustedProxies() : null;
        this.trustedRules = parseTrustedRules(configured);
        this.trustedRulesSource = snapshot(configured);
        validateMode(properties, trustedRules.isEmpty());
    }

    /**
     * Validates the forwarding configuration without creating a Spring bean.
     * Used by early production validation before the application context exists.
     */
    public static void validateConfiguration(RateLimitProperties properties) {
        if (properties == null) {
            return;
        }
        List<CidrRule> rules = parseTrustedRules(properties.getTrustedProxies());
        validateMode(properties, rules.isEmpty());
    }

    public String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return DEFAULT_FALLBACK_IP;
        }

        String remote = normalizeIp(request.getRemoteAddr());
        if (remote == null) {
            remote = DEFAULT_FALLBACK_IP;
        }

        RateLimitProperties.ClientIpMode mode = properties.getClientIpMode();
        if (mode == null || mode == RateLimitProperties.ClientIpMode.DIRECT) {
            return remote;
        }

        String header = singleForwardedHeader(request);
        if (header == null || header.isBlank()) {
            return remote;
        }

        String[] parts = header.split(",", -1);
        if (mode == RateLimitProperties.ClientIpMode.TRUSTED_CIDR) {
            if (!isTrustedProxy(remote)) {
                log.debug("Ignoring X-Forwarded-For from untrusted peer '{}'", remote);
                return remote;
            }
            for (int i = parts.length - 1; i >= 0; i--) {
                String candidate = normalizeIp(parts[i]);
                if (candidate == null) {
                    log.debug("Rejecting ambiguous X-Forwarded-For chain from trusted peer '{}'", remote);
                    return remote;
                }
                if (!isTrustedProxy(candidate)) {
                    return candidate;
                }
            }
            return remote;
        }

        // Legacy TRUSTED_HOPS can never reach here: validateMode rejects it at
        // construction and during early production validation.
        return remote;
    }

    public boolean isTrustedProxy(String ipAddress) {
        List<CidrRule> rules = rules();
        if (rules.isEmpty()) {
            return false;
        }
        byte[] bytes = literalBytes(ipAddress);
        if (bytes == null) {
            return false;
        }
        for (CidrRule rule : rules) {
            if (rule.matches(bytes)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Normalizes an IPv4 or IPv6 literal into a canonical string.
     * Returns {@code null} for hostnames, malformed values and anything that would require DNS.
     */
    public String normalizeIp(String rawIp) {
        byte[] parsed = parseAddressLiteral(rawIp);
        if (parsed == null) {
            return null;
        }
        if (parsed.length == 4) {
            return canonicalIpv4(parsed);
        }
        if (isIpv4Mapped(parsed)) {
            return canonicalIpv4(new byte[]{parsed[12], parsed[13], parsed[14], parsed[15]});
        }
        if (isIpv6Loopback(parsed)) {
            return DEFAULT_FALLBACK_IP;
        }
        return canonicalIpv6(parsed);
    }

    private static List<String> snapshot(List<String> configured) {
        return configured == null ? List.of() : List.copyOf(configured);
    }

    /**
     * Returns the parsed trusted-proxy rules, re-parsing when the configured list has changed.
     * The list is read on each call so configuration refresh (or test mutation) is honoured,
     * while the parsed result is cached to keep the per-request path cheap.
     */
    private List<CidrRule> rules() {
        List<String> configured = snapshot(properties != null ? properties.getTrustedProxies() : null);
        if (configured.equals(trustedRulesSource)) {
            return trustedRules;
        }
        synchronized (trustedRulesLock) {
            if (!configured.equals(trustedRulesSource)) {
                List<CidrRule> parsed = parseTrustedRules(configured);
                trustedRules = parsed;
                trustedRulesSource = configured;
            }
            return trustedRules;
        }
    }

    private static void validateMode(RateLimitProperties properties, boolean noRulesConfigured) {
        if (properties == null) {
            return;
        }
        RateLimitProperties.ClientIpMode mode = properties.getClientIpMode();
        if (mode == RateLimitProperties.ClientIpMode.TRUSTED_CIDR && noRulesConfigured) {
            throw new IllegalStateException(
                    "CLIENT_IP_MODE=TRUSTED_CIDR requires at least one valid TRUSTED_PROXIES entry " +
                            "(for example the Render load-balancer CIDR)."
            );
        }
        if (mode == RateLimitProperties.ClientIpMode.TRUSTED_HOPS) {
            throw new IllegalStateException(
                    "CLIENT_IP_MODE=TRUSTED_HOPS is no longer supported. Hop counting alone cannot verify " +
                            "the connection peer against a trusted proxy boundary, so it allowed direct attackers " +
                            "to forge X-Forwarded-For chains and escape rate-limit buckets. " +
                            "Use CLIENT_IP_MODE=DIRECT (safe default), or CLIENT_IP_MODE=TRUSTED_CIDR with an " +
                            "independently verified TRUSTED_PROXIES list. Remove TRUSTED_PROXY_HOPS if present."
            );
        }
    }

    private static String singleForwardedHeader(HttpServletRequest request) {
        Enumeration<String> values = request.getHeaders(X_FORWARDED_FOR);
        if (values == null || !values.hasMoreElements()) {
            return null;
        }
        String first = values.nextElement();
        if (values.hasMoreElements()) {
            return null;
        }
        return first;
    }

    /**
     * Parses a complete request address literal, including the bracketed IPv6 + port form.
     * Accepted syntax: {@code 192.0.2.1}, {@code 192.0.2.1:443}, {@code 2001:db8::1},
     * {@code [2001:db8::1]}, {@code [2001:db8::1]:443}.
     */
    private static byte[] parseAddressLiteral(String rawIp) {
        if (rawIp == null) {
            return null;
        }
        String value = rawIp.trim();
        if (value.isEmpty() || value.indexOf(',') >= 0 || value.indexOf('"') >= 0
                || value.indexOf(' ') >= 0 || value.indexOf('\t') >= 0) {
            return null;
        }

        if (value.startsWith("[")) {
            int close = value.indexOf(']');
            if (close <= 1) {
                return null;
            }
            String inner = value.substring(1, close);
            String suffix = value.substring(close + 1);
            if (!suffix.isEmpty()) {
                if (!suffix.startsWith(":") || suffix.length() == 1 || !isAsciiDigits(suffix.substring(1))) {
                    return null;
                }
            }
            byte[] parsed = parseIpv6(inner);
            return parsed != null ? parsed : null;
        }

        int firstColon = value.indexOf(':');
        int lastColon = value.lastIndexOf(':');
        if (firstColon > 0 && firstColon == lastColon) {
            byte[] host = parseIpv4(value.substring(0, firstColon));
            if (host != null) {
                String port = value.substring(firstColon + 1);
                if (!isAsciiDigits(port)) {
                    return null;
                }
                return host;
            }
        }

        byte[] parsed = parseIpv4(value);
        if (parsed != null) {
            return parsed;
        }
        return parseIpv6(value);
    }

    private static byte[] literalBytes(String rawIp) {
        return parseAddressLiteral(rawIp);
    }

    private static byte[] parseIpv4(String value) {
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) {
            return null;
        }
        byte[] bytes = new byte[4];
        for (int i = 0; i < 4; i++) {
            String part = parts[i];
            if (part.isEmpty() || part.length() > 3 || !isAsciiDigits(part)) {
                return null;
            }
            if (part.length() > 1 && part.charAt(0) == '0') {
                // Reject leading zeros: they are ambiguous (octal) across parsers.
                return null;
            }
            int octet = Integer.parseInt(part);
            if (octet > 255) {
                return null;
            }
            bytes[i] = (byte) octet;
        }
        return bytes;
    }

    private static byte[] parseIpv6(String value) {
        if (value.isEmpty() || value.indexOf(':') < 0 || value.indexOf('%') >= 0) {
            return null;
        }

        List<Integer> groups;
        int doubleColon = value.indexOf("::");
        if (doubleColon >= 0 && value.indexOf("::", doubleColon + 1) >= 0) {
            return null;
        }

        if (doubleColon >= 0) {
            List<Integer> left = parseIpv6Part(value.substring(0, doubleColon), false);
            List<Integer> right = parseIpv6Part(value.substring(doubleColon + 2), true);
            if (left == null || right == null) {
                return null;
            }
            int known = left.size() + right.size();
            if (known >= 8) {
                return null;
            }
            groups = new ArrayList<>(left);
            for (int i = known; i < 8; i++) {
                groups.add(0);
            }
            groups.addAll(right);
        } else {
            List<Integer> all = parseIpv6Part(value, true);
            if (all == null || all.size() != 8) {
                return null;
            }
            groups = all;
        }

        byte[] bytes = new byte[16];
        for (int i = 0; i < 8; i++) {
            int group = groups.get(i);
            bytes[i * 2] = (byte) (group >> 8);
            bytes[i * 2 + 1] = (byte) (group & 0xFF);
        }
        return bytes;
    }

    private static List<Integer> parseIpv6Part(String part, boolean allowIpv4Tail) {
        List<Integer> groups = new ArrayList<>();
        if (part.isEmpty()) {
            return groups;
        }
        String[] tokens = part.split(":", -1);
        for (int i = 0; i < tokens.length; i++) {
            String token = tokens[i];
            if (token.isEmpty()) {
                return null;
            }
            boolean last = i == tokens.length - 1;
            if (token.indexOf('.') >= 0) {
                if (!last || !allowIpv4Tail) {
                    return null;
                }
                byte[] ipv4 = parseIpv4(token);
                if (ipv4 == null) {
                    return null;
                }
                groups.add(((ipv4[0] & 0xFF) << 8) | (ipv4[1] & 0xFF));
                groups.add(((ipv4[2] & 0xFF) << 8) | (ipv4[3] & 0xFF));
                continue;
            }
            if (token.length() > 4) {
                return null;
            }
            int group = 0;
            for (int c = 0; c < token.length(); c++) {
                int digit = Character.digit(token.charAt(c), 16);
                if (digit < 0) {
                    return null;
                }
                group = (group << 4) | digit;
            }
            groups.add(group);
        }
        return groups;
    }

    private static String canonicalIpv4(byte[] bytes) {
        if ((bytes[0] & 0xFF) == 127) {
            return DEFAULT_FALLBACK_IP;
        }
        return (bytes[0] & 0xFF) + "." + (bytes[1] & 0xFF) + "." + (bytes[2] & 0xFF) + "." + (bytes[3] & 0xFF);
    }

    private static String canonicalIpv6(byte[] bytes) {
        int[] groups = new int[8];
        for (int i = 0; i < 8; i++) {
            groups[i] = ((bytes[i * 2] & 0xFF) << 8) | (bytes[i * 2 + 1] & 0xFF);
        }

        int bestStart = -1;
        int bestLength = 0;
        for (int i = 0; i < 8; ) {
            if (groups[i] != 0) {
                i++;
                continue;
            }
            int start = i;
            while (i < 8 && groups[i] == 0) {
                i++;
            }
            int length = i - start;
            if (length > bestLength) {
                bestStart = start;
                bestLength = length;
            }
        }
        if (bestLength < 2) {
            bestStart = -1;
        }

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            if (i == bestStart) {
                builder.append("::");
                i += bestLength - 1;
                continue;
            }
            if (builder.length() > 0 && builder.charAt(builder.length() - 1) != ':') {
                builder.append(':');
            }
            builder.append(Integer.toHexString(groups[i]));
        }
        return builder.length() == 0 ? "::" : builder.toString();
    }

    private static boolean isIpv4Mapped(byte[] bytes) {
        if (bytes == null || bytes.length != 16) {
            return false;
        }
        for (int i = 0; i < 10; i++) {
            if (bytes[i] != 0) {
                return false;
            }
        }
        return (bytes[10] & 0xFF) == 0xFF && (bytes[11] & 0xFF) == 0xFF;
    }

    private static boolean isIpv6Loopback(byte[] bytes) {
        if (bytes == null || bytes.length != 16) {
            return false;
        }
        for (int i = 0; i < 15; i++) {
            if (bytes[i] != 0) {
                return false;
            }
        }
        return bytes[15] == 1;
    }

    private static boolean isAsciiDigits(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return true;
    }

    private static List<CidrRule> parseTrustedRules(List<String> rawRules) {
        if (rawRules == null || rawRules.isEmpty()) {
            return List.of();
        }
        List<CidrRule> rules = new ArrayList<>();
        for (String rawRule : rawRules) {
            if (rawRule == null || rawRule.isBlank()) {
                continue;
            }
            String rule = rawRule.trim();
            String addressPart = rule;
            Integer prefixLength = null;
            int slash = rule.indexOf('/');
            if (slash >= 0) {
                addressPart = rule.substring(0, slash).trim();
                String prefixPart = rule.substring(slash + 1).trim();
                try {
                    prefixLength = Integer.parseInt(prefixPart);
                } catch (NumberFormatException e) {
                    throw new IllegalStateException(
                            "Invalid trusted proxy rule '" + rule + "': prefix length must be an integer.");
                }
            }

            byte[] network = parseAddressLiteral(addressPart);
            if (network == null) {
                throw new IllegalStateException(
                        "Invalid trusted proxy rule '" + rule + "': expected an IPv4 or IPv6 literal.");
            }

            int familyBits = network.length * 8;
            if (network.length == 16 && isIpv4Mapped(network)) {
                byte[] mapped = new byte[]{network[12], network[13], network[14], network[15]};
                if (prefixLength != null) {
                    if (prefixLength < 96 || prefixLength > 128) {
                        throw new IllegalStateException(
                                "Invalid trusted proxy rule '" + rule + "': IPv4-mapped prefix must be between 96 and 128.");
                    }
                    prefixLength -= 96;
                }
                network = mapped;
                familyBits = 32;
            }

            int prefix = prefixLength != null ? prefixLength : familyBits;
            if (prefix < 0 || prefix > familyBits) {
                throw new IllegalStateException(
                        "Invalid trusted proxy rule '" + rule + "': prefix length must be between 0 and " + familyBits + ".");
            }
            rules.add(new CidrRule(network, prefix));
        }
        return List.copyOf(rules);
    }

    private record CidrRule(byte[] network, int prefixLength) {

        boolean matches(byte[] address) {
            if (address == null || address.length != network.length) {
                return false;
            }
            int fullBytes = prefixLength / 8;
            int remainderBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (address[i] != network[i]) {
                    return false;
                }
            }
            if (remainderBits == 0) {
                return true;
            }
            int mask = (0xFF << (8 - remainderBits)) & 0xFF;
            return (address[fullBytes] & mask) == (network[fullBytes] & mask);
        }
    }
}
