package com.shareloop.dto.reporting.projection;

import java.sql.Date;

public interface ReportBucketCountProjection {

    Date getBucket();

    Long getCount();
}
