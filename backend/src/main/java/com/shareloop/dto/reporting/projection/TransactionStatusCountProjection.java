package com.shareloop.dto.reporting.projection;

import com.shareloop.entity.enums.TransactionStatus;

public interface TransactionStatusCountProjection {

    TransactionStatus getStatus();

    Long getCount();
}
