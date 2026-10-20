package com.shareloop.dto.request;

import com.shareloop.dto.listing.OwnerSummaryDto;
import com.shareloop.entity.Listing;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;

import java.math.BigDecimal;
import java.util.UUID;

public class ListingReferenceDto {

    private UUID id;
    private String title;
    private ListingType listingType;
    private ListingStatus status;
    private BigDecimal price;
    private String currency;
    private String city;
    private OwnerSummaryDto owner;

    public ListingReferenceDto() {
    }

    public ListingReferenceDto(UUID id, String title, ListingType listingType, ListingStatus status, BigDecimal price, String currency, String city, OwnerSummaryDto owner) {
        this.id = id;
        this.title = title;
        this.listingType = listingType;
        this.status = status;
        this.price = price;
        this.currency = currency;
        this.city = city;
        this.owner = owner;
    }

    public static ListingReferenceDto fromEntity(Listing listing) {
        if (listing == null) {
            return null;
        }
        return new ListingReferenceDto(
                listing.getId(),
                listing.getTitle(),
                listing.getListingType(),
                listing.getStatus(),
                listing.getPrice(),
                listing.getCurrency(),
                listing.getCity(),
                OwnerSummaryDto.fromEntity(listing.getOwner())
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public ListingType getListingType() {
        return listingType;
    }

    public void setListingType(ListingType listingType) {
        this.listingType = listingType;
    }

    public ListingStatus getStatus() {
        return status;
    }

    public void setStatus(ListingStatus status) {
        this.status = status;
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

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public OwnerSummaryDto getOwner() {
        return owner;
    }

    public void setOwner(OwnerSummaryDto owner) {
        this.owner = owner;
    }
}
