package com.shareloop.security.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;

@Component
public class ClientIpResolver {

    private static final Logger log = LoggerFactory.getLogger(ClientIpResolver.class);
    private static final String DEFAULT_FALLBACK_IP = "127.0.0.1";

    private final RateLimitProperties properties;

    public ClientIpResolver(RateLimitProperties properties) {
        this.properties = properties;
    }

    /**
     * Resolves the real client IP address from the request.
     *
     * Policy:
     * 1. By default, use direct remote address.
     * 2. Trust X-Forwarded-For only when the immediate remote address is a configured trusted proxy.
     * 3. When trusted, parse right-to-left and pick the first untrusted IP.
     * 4. Never blindly trust leftmost X-Forwarded-For.
     * 5. Validate malformed IPs and normalize IPv4/IPv6 loopback.
     */
    public String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return DEFAULT_FALLBACK_IP;
        }

        String rawRemoteAddr = request.getRemoteAddr();
        String normalizedRemote = normalizeIp(rawRemoteAddr);
        if (normalizedRemote == null || normalizedRemote.isBlank()) {
            return DEFAULT_FALLBACK_IP;
        }

        List<String> trustedProxies = properties.getTrustedProxies();
        if (trustedProxies == null || trustedProxies.isEmpty() || !isTrustedProxy(normalizedRemote)) {
            // Direct connection or untrusted immediate proxy -> ignore any forwarded headers
            return normalizedRemote;
        }

        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor == null || xForwardedFor.isBlank()) {
            return normalizedRemote;
        }

        String[] parts = xForwardedFor.split(",");
        // Walk right-to-left
        for (int i = parts.length - 1; i >= 0; i--) {
            String candidate = parts[i].trim();
            if (candidate.isEmpty()) {
                continue;
            }
            String normalizedCandidate = normalizeIp(candidate);
            if (normalizedCandidate == null || normalizedCandidate.isBlank()) {
                // Malformed IP in forwarding chain: stop and fall back safely to remote address
                log.debug("Encountered malformed IP in X-Forwarded-For header, falling back to remote address");
                return normalizedRemote;
            }
            if (!isTrustedProxy(normalizedCandidate)) {
                // First untrusted IP encountered from right to left is the true client IP
                return normalizedCandidate;
            }
        }

        // If all IPs in chain are trusted proxies, fall back to remote address
        return normalizedRemote;
    }

    public boolean isTrustedProxy(String ipAddress) {
        List<String> trustedList = properties.getTrustedProxies();
        if (trustedList == null || trustedList.isEmpty() || ipAddress == null || ipAddress.isBlank()) {
            return false;
        }

        InetAddress target;
        try {
            target = InetAddress.getByName(ipAddress.trim());
        } catch (UnknownHostException e) {
            return false;
        }

        for (String rule : trustedList) {
            if (rule == null || rule.isBlank()) {
                continue;
            }
            if (matchesRule(target, rule.trim())) {
                return true;
            }
        }
        return false;
    }

    public String normalizeIp(String rawIp) {
        if (rawIp == null) {
            return null;
        }
        String trimmed = rawIp.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        // Handle IPv4 with port, e.g. 192.168.1.1:8080
        if (trimmed.indexOf(':') > 0 && trimmed.indexOf(':') == trimmed.lastIndexOf(':')) {
            trimmed = trimmed.substring(0, trimmed.indexOf(':'));
        }

        // Handle bracketed IPv6, e.g. [::1]
        if (trimmed.startsWith("[") && trimmed.contains("]")) {
            trimmed = trimmed.substring(1, trimmed.indexOf(']'));
        }

        try {
            InetAddress addr = InetAddress.getByName(trimmed);
            if (addr.isLoopbackAddress()) {
                return DEFAULT_FALLBACK_IP;
            }
            if (addr instanceof Inet4Address) {
                return addr.getHostAddress();
            }
            if (addr instanceof Inet6Address) {
                // Check IPv4-mapped IPv6 (::ffff:192.0.2.128)
                byte[] bytes = addr.getAddress();
                if (isIpv4Mapped(bytes)) {
                    return String.format("%d.%d.%d.%d",
                            bytes[12] & 0xFF, bytes[13] & 0xFF, bytes[14] & 0xFF, bytes[15] & 0xFF);
                }
                return addr.getHostAddress().toLowerCase();
            }
            return addr.getHostAddress();
        } catch (UnknownHostException e) {
            return null;
        }
    }

    private boolean isIpv4Mapped(byte[] bytes) {
        if (bytes == null || bytes.length != 16) {
            return false;
        }
        for (int i = 0; i < 10; i++) {
            if (bytes[i] != 0) return false;
        }
        return (bytes[10] & 0xFF) == 0xFF && (bytes[11] & 0xFF) == 0xFF;
    }

    private boolean matchesRule(InetAddress target, String rule) {
        if (!rule.contains("/")) {
            try {
                InetAddress ruleAddr = InetAddress.getByName(rule);
                return ruleAddr.equals(target);
            } catch (UnknownHostException e) {
                return false;
            }
        }

        // CIDR notation (e.g. 10.0.0.0/8 or 192.168.0.0/16)
        String[] parts = rule.split("/", 2);
        try {
            InetAddress subnet = InetAddress.getByName(parts[0].trim());
            int prefixLength = Integer.parseInt(parts[1].trim());

            byte[] targetBytes = target.getAddress();
            byte[] subnetBytes = subnet.getAddress();

            if (targetBytes.length != subnetBytes.length) {
                return false;
            }

            int fullBytes = prefixLength / 8;
            int remainderBits = prefixLength % 8;

            for (int i = 0; i < fullBytes; i++) {
                if (targetBytes[i] != subnetBytes[i]) {
                    return false;
                }
            }

            if (remainderBits > 0 && fullBytes < targetBytes.length) {
                int mask = (0xFF << (8 - remainderBits)) & 0xFF;
                return (targetBytes[fullBytes] & mask) == (subnetBytes[fullBytes] & mask);
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
