package com.shareloop.dto.listing;

import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Request payload for PUT /api/v1/listings/{id}.
 *
 * PUT Semantics Documentation:
 * In accordance with Phase 5 requirements ("Do not silently reset fields omitted from an update request"),
 * this endpoint implements selective update semantics:
 * 1. Omitted fields are not altered and retain their current persisted values.
 * 2. Explicitly supplied fields (tracked via presentFields) update the target resource.
 * 3. Explicit null values for optional attributes (neighborhood, stateProvince, postalCode, images,
 *    or price on WANTED listings) clear those attributes.
 * 4. Explicit null or blank values for mandatory attributes (title, description, city, categoryId,
 *    or price on SALE listings) are rejected with validation errors.
 * 5. Lifecycle status transitions are validated: clients cannot set protected statuses (RESERVED,
 *    COMPLETED, REMOVED).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateListingRequest {

    private final Set<String> presentFields = new HashSet<>();

    private ListingType listingType;

    @Size(min = 2, max = 200, message = "Title must be between 2 and 200 characters")
    private String title;

    @Size(max = 5000, message = "Description must not exceed 5000 characters")
    private String description;

    private UUID categoryId;

    private BigDecimal price;

    @Size(max = 3, message = "Currency code must be 3 characters")
    private String currency;

    private ListingStatus status;

    @Size(max = 100, message = "Neighborhood must not exceed 100 characters")
    private String neighborhood;

    @Size(max = 100, message = "City must not exceed 100 characters")
    private String city;

    @Size(max = 100, message = "State/Province must not exceed 100 characters")
    private String stateProvince;

    @Size(max = 20, message = "Postal code must not exceed 20 characters")
    private String postalCode;

    @Size(max = 100, message = "Country must not exceed 100 characters")
    private String country;

    @Valid
    @Size(max = 10, message = "A listing may contain up to 10 images")
    private List<ListingImageDto> images;

    public UpdateListingRequest() {
    }

    public boolean hasListingType() {
        return presentFields.contains("listingType");
    }

    public ListingType getListingType() {
        return listingType;
    }

    public void setListingType(ListingType listingType) {
        this.listingType = listingType;
        this.presentFields.add("listingType");
    }

    public boolean hasTitle() {
        return presentFields.contains("title");
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title != null ? title.trim() : null;
        this.presentFields.add("title");
    }

    public boolean hasDescription() {
        return presentFields.contains("description");
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description != null ? description.trim() : null;
        this.presentFields.add("description");
    }

    public boolean hasCategoryId() {
        return presentFields.contains("categoryId");
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(UUID categoryId) {
        this.categoryId = categoryId;
        this.presentFields.add("categoryId");
    }

    public boolean hasPrice() {
        return presentFields.contains("price");
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
        this.presentFields.add("price");
    }

    public boolean hasCurrency() {
        return presentFields.contains("currency");
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency != null ? currency.trim().toUpperCase() : null;
        this.presentFields.add("currency");
    }

    public boolean hasStatus() {
        return presentFields.contains("status");
    }

    public ListingStatus getStatus() {
        return status;
    }

    public void setStatus(ListingStatus status) {
        this.status = status;
        this.presentFields.add("status");
    }

    public boolean hasNeighborhood() {
        return presentFields.contains("neighborhood");
    }

    public String getNeighborhood() {
        return neighborhood;
    }

    public void setNeighborhood(String neighborhood) {
        this.neighborhood = neighborhood != null ? neighborhood.trim() : null;
        this.presentFields.add("neighborhood");
    }

    public boolean hasCity() {
        return presentFields.contains("city");
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city != null ? city.trim() : null;
        this.presentFields.add("city");
    }

    public boolean hasStateProvince() {
        return presentFields.contains("stateProvince");
    }

    public String getStateProvince() {
        return stateProvince;
    }

    public void setStateProvince(String stateProvince) {
        this.stateProvince = stateProvince != null ? stateProvince.trim() : null;
        this.presentFields.add("stateProvince");
    }

    public boolean hasPostalCode() {
        return presentFields.contains("postalCode");
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode != null ? postalCode.trim() : null;
        this.presentFields.add("postalCode");
    }

    public boolean hasCountry() {
        return presentFields.contains("country");
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country != null ? country.trim() : null;
        this.presentFields.add("country");
    }

    public boolean hasImages() {
        return presentFields.contains("images");
    }

    public List<ListingImageDto> getImages() {
        return images;
    }

    public void setImages(List<ListingImageDto> images) {
        this.images = images;
        this.presentFields.add("images");
    }
}
