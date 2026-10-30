package com.shareloop.dto.auth;

import java.time.Instant;

public record GoogleAccountStatusResponse(
        boolean linked,
        String provider,
        String email,
        Instant linkedAt
) {
}
