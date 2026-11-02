package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.UserRole;

public interface UserRoleCountProjection {

    UserRole getRole();

    Long getCount();
}
