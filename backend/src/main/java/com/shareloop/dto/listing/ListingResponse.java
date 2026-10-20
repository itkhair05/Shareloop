package com.shareloop.dto.listing;

import com.shareloop.entity.Listing;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public class ListingResponse {

    private UUID id;
    private OwnerSummaryDto owner;
    private CategorySummaryDto category;
    private ListingType listingType;
    private String title;
    private String description;
    private BigDecimal price;
    private String currency;
    private ListingStatus status;
    private String neighborhood;
    private String city;
    private String stateProvince;
    private String postalCode;
    private String country;
    private List<ListingImageDto> images;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant expiresAt;

    public ListingResponse() {
    }

    public static ListingResponse fromEntity(Listing listing) {
        if (listing == null) {
            return null;
        }

        ListingResponse response = new ListingResponse();
        response.setId(listing.getId());
        response.setOwner(OwnerSummaryDto.fromEntity(listing.getOwner()));
        response.setCategory(CategorySummaryDto.fromEntity(listing.getCategory()));
        response.setListingType(listing.getListingType());
        response.setTitle(listing.getTitle());
        response.setDescription(listing.getDescription());
        response.setPrice(listing.getPrice());
        response.setCurrency(listing.getCurrency());
        response.setStatus(listing.getStatus());
        response.setNeighborhood(listing.getNeighborhood());
        response.setCity(listing.getCity());
        response.setStateProvince(listing.getStateProvince());
        response.setPostalCode(listing.getPostalCode());
        response.setCountry(listing.getCountry());
        response.setCreatedAt(listing.getCreatedAt());
        response.setUpdatedAt(listing.getUpdatedAt());
        response.setExpiresAt(listing.getExpiresAt());

        if (listing.getImages() != null) {
            List<ListingImageDto> imageDtos = listing.getImages().stream()
                    .sorted(Comparator.comparing(img -> img.getSortOrder() != null ? img.getSortOrder() : 0))
                    .map(ListingImageDto::fromEntity)
                    .toList();
            response.setImages(imageDtos);
        } else {
            response.setImages(Collections.emptyList());
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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

    public String getNeighborhood() {
        return neighborhood;
    }

    public void setNeighborhood(String neighborhood) {
        this.neighborhood = neighborhood;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getStateProvince() {
        return stateProvince;
    }

    public void setStateProvince(String stateProvince) {
        this.stateProvince = stateProvince;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public List<ListingImageDto> getImages() {
        return images;
    }

    public void setImages(List<ListingImageDto> images) {
        this.images = images;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
