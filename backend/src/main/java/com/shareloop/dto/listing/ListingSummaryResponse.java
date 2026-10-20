package com.shareloop.dto.listing;

import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingImage;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.UUID;

public class ListingSummaryResponse {

    private UUID id;
    private OwnerSummaryDto owner;
    private CategorySummaryDto category;
    private ListingType listingType;
    private String title;
    private BigDecimal price;
    private String currency;
    private ListingStatus status;
    private String city;
    private String country;
    private String primaryImageUrl;
    private Instant createdAt;

    public ListingSummaryResponse() {
    }

    public static ListingSummaryResponse fromEntity(Listing listing) {
        if (listing == null) {
            return null;
        }

        ListingSummaryResponse response = new ListingSummaryResponse();
        response.setId(listing.getId());
        response.setOwner(OwnerSummaryDto.fromEntity(listing.getOwner()));
        response.setCategory(CategorySummaryDto.fromEntity(listing.getCategory()));
        response.setListingType(listing.getListingType());
        response.setTitle(listing.getTitle());
        response.setPrice(listing.getPrice());
        response.setCurrency(listing.getCurrency());
        response.setStatus(listing.getStatus());
        response.setCity(listing.getCity());
        response.setCountry(listing.getCountry());
        response.setCreatedAt(listing.getCreatedAt());

        if (listing.getImages() != null && !listing.getImages().isEmpty()) {
            String primaryUrl = listing.getImages().stream()
                    .min(Comparator.comparing(img -> img.getSortOrder() != null ? img.getSortOrder() : 0))
                    .map(ListingImage::getImageUrl)
                    .orElse(null);
            response.setPrimaryImageUrl(primaryUrl);
        }

        return response;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public OwnerSummaryDto getOwner() {
        return owner;
    }

    public void setOwner(OwnerSummaryDto owner) {
        this.owner = owner;
    }

    public CategorySummaryDto getCategory() {
        return category;
    }

    public void setCategory(CategorySummaryDto category) {
        this.category = category;
    }

    public ListingType getListingType() {
        return listingType;
    }

    public void setListingType(ListingType listingType) {
        this.listingType = listingType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public ListingStatus getStatus() {
        return status;
    }

    public void setStatus(ListingStatus status) {
        this.status = status;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getPrimaryImageUrl() {
        return primaryImageUrl;
    }

    public void setPrimaryImageUrl(String primaryImageUrl) {
        this.primaryImageUrl = primaryImageUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
