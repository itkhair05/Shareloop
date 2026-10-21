package com.shareloop.dto.review;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public class UserRatingSummaryResponse {

    private UUID userId;
    private Double averageRating;
    private Long totalReviews;
    private Map<Integer, Long> starBreakdown;

    public UserRatingSummaryResponse() {
        this.starBreakdown = createDefaultStarBreakdown();
    }

    public UserRatingSummaryResponse(UUID userId, Double averageRating, Long totalReviews, Map<Integer, Long> starBreakdown) {
        this.userId = userId;
        this.averageRating = averageRating;
        this.totalReviews = totalReviews;
        this.starBreakdown = starBreakdown != null ? starBreakdown : createDefaultStarBreakdown();
    }

    public static Map<Integer, Long> createDefaultStarBreakdown() {
        Map<Integer, Long> breakdown = new LinkedHashMap<>();
        for (int star = 1; star <= 5; star++) {
            breakdown.put(star, 0L);
        }
        return breakdown;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public Double getAverageRating() {
        return averageRating;
    }

    public void setAverageRating(Double averageRating) {
        this.averageRating = averageRating;
    }

    public Long getTotalReviews() {
        return totalReviews;
    }

    public void setTotalReviews(Long totalReviews) {
        this.totalReviews = totalReviews;
    }

    public Map<Integer, Long> getStarBreakdown() {
        return starBreakdown;
    }

    public void setStarBreakdown(Map<Integer, Long> starBreakdown) {
        this.starBreakdown = starBreakdown;
    }
}
