package com.shareloop.dto.listing;

import com.shareloop.entity.enums.ListingType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class CreateListingRequest {

    @NotNull(message = "Listing type is required")
    private ListingType listingType;

    @NotBlank(message = "Title is required")
    @Size(min = 2, max = 200, message = "Title must be between 2 and 200 characters")
    private String title;

    @NotBlank(message = "Description is required")
    @Size(max = 5000, message = "Description must not exceed 5000 characters")
    private String description;

    @NotNull(message = "Category ID is required")
    private UUID categoryId;

    private BigDecimal price;

    @Size(max = 3, message = "Currency code must be 3 characters")
    private String currency;

    @Size(max = 100, message = "Neighborhood must not exceed 100 characters")
    private String neighborhood;

    @NotBlank(message = "City is required")
    @Size(max = 100, message = "City must not exceed 100 characters")
    private String city;

    @Size(max = 100, message = "State/Province must not exceed 100 characters")
    private String stateProvince;

    @Size(max = 20, message = "Postal code must not exceed 20 characters")
    private String postalCode;

    @Size(max = 100, message = "Country must not exceed 100 characters")
    private String country = "VN";

    @Valid
    @Size(max = 10, message = "A listing may contain up to 10 images")
    private List<ListingImageDto> images;

    public CreateListingRequest() {
    }

    public CreateListingRequest(ListingType listingType, String title, String description, UUID categoryId, String city) {
        this.listingType = listingType;
        this.title = title;
        this.description = description;
        this.categoryId = categoryId;
        this.city = city;
        this.country = "VN";
    }

    public CreateListingRequest(ListingType listingType, UUID categoryId, String title, String description, String city) {
        this(listingType, title, description, categoryId, city);
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
        this.title = title != null ? title.trim() : null;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description != null ? description.trim() : null;
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(UUID categoryId) {
        this.categoryId = categoryId;
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
        this.currency = currency != null ? currency.trim().toUpperCase() : null;
    }

    public String getNeighborhood() {
        return neighborhood;
    }

    public void setNeighborhood(String neighborhood) {
        this.neighborhood = neighborhood != null ? neighborhood.trim() : null;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city != null ? city.trim() : null;
    }

    public String getStateProvince() {
        return stateProvince;
    }

    public void setStateProvince(String stateProvince) {
        this.stateProvince = stateProvince != null ? stateProvince.trim() : null;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode != null ? postalCode.trim() : null;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country != null ? country.trim() : "VN";
    }

    public List<ListingImageDto> getImages() {
        return images;
    }

    public void setImages(List<ListingImageDto> images) {
        this.images = images;
    }
}
