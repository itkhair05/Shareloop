package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.SupportRequestStatus;

public interface SupportStatusCountProjection {

    SupportRequestStatus getStatus();

    Long getCount();
}
