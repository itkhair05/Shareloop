package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.UserStatus;

public interface UserStatusCountProjection {

    UserStatus getStatus();

    Long getCount();
}
