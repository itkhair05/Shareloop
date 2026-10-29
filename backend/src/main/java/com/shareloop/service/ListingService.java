package com.shareloop.service;

import com.shareloop.dto.listing.*;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingImage;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.repository.specification.ListingSpecification;
import com.shareloop.security.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ListingService {

    private static final Set<TransactionStatus> QUALIFYING_TRANSACTION_STATUSES = Set.of(
            TransactionStatus.PENDING,
            TransactionStatus.IN_PROGRESS,
            TransactionStatus.COMPLETED
    );

    private final ListingRepository listingRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final ListingRequestRepository listingRequestRepository;

    public ListingService(
            ListingRepository listingRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            ListingRequestRepository listingRequestRepository
    ) {
        this.listingRepository = listingRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.listingRequestRepository = listingRequestRepository;
    }

    @Transactional(readOnly = true)
    public Page<ListingSummaryResponse> getPublicListings(
            String keyword,
            ListingType type,
            UUID categoryId,
            String city,
            ListingStatus status,
            int page,
            int size
    ) {
        validatePagination(page, size);

        // Public browsing must only allow active, publicly visible listings
        if (status != null && status != ListingStatus.ACTIVE) {
            throw new IllegalArgumentException("Only ACTIVE listings are publicly visible");
        }

        if (categoryId != null && !categoryRepository.existsById(categoryId)) {
            throw new ResourceNotFoundException("Category not found with id: " + categoryId);
        }

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<Listing> spec = ListingSpecification.filterPublicListings(
                keyword,
                type,
                categoryId,
                city,
                ListingStatus.ACTIVE
        );

        return listingRepository.findAll(spec, pageable).map(ListingSummaryResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public ListingResponse getPublicListingById(UUID id, UserPrincipal principal) {
        Listing listing = listingRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + id));

        // If listing is not active, allow access only when user is:
        // 1. The listing owner
        // 2. An authenticated ADMIN
        // 3. The requester of a qualifying transaction (PENDING, IN_PROGRESS, COMPLETED)
        if (listing.getStatus() != ListingStatus.ACTIVE) {
            boolean isOwner = principal != null && listing.getOwner().getId().equals(principal.getId());
            boolean isAdmin = principal != null && principal.getRole() == UserRole.ADMIN;
            boolean isQualifyingRequester = principal != null && transactionRepository.existsByListingIdAndRequesterIdAndStatusIn(
                    id,
                    principal.getId(),
                    QUALIFYING_TRANSACTION_STATUSES
            );
            if (!isOwner && !isAdmin && !isQualifyingRequester) {
                throw new ResourceNotFoundException("Listing not found with id: " + id);
            }
        }

        return ListingResponse.fromEntity(listing);
    }

    @Transactional
    public ListingResponse createListing(CreateListingRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to create a listing");
        }

        User owner = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + principal.getId()));

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + request.getCategoryId()));

        if (!category.getIsActive()) {
            throw new IllegalArgumentException("Category '" + category.getName() + "' is currently inactive");
        }

        PriceAndCurrency priceAndCurrency = validateAndNormalizePriceAndCurrency(
                request.getListingType(),
                request.getPrice(),
                request.getCurrency()
        );

        Listing listing = new Listing(
                owner,
                category,
                request.getListingType(),
                request.getTitle(),
                request.getDescription(),
                request.getCity()
        );

        listing.setPrice(priceAndCurrency.price());
        listing.setCurrency(priceAndCurrency.currency());
        listing.setNeighborhood(request.getNeighborhood());
        listing.setStateProvince(request.getStateProvince());
        listing.setPostalCode(request.getPostalCode());
        if (request.getCountry() != null && !request.getCountry().isBlank()) {
            listing.setCountry(request.getCountry().trim());
        }
        listing.setStatus(ListingStatus.ACTIVE);

        if (request.getImages() != null) {
            for (ListingImageDto imgDto : request.getImages()) {
                if (imgDto.getImageUrl() != null && !imgDto.getImageUrl().isBlank()) {
                    ListingImage image = new ListingImage(
                            listing,
                            imgDto.getImageUrl().trim(),
                            imgDto.getSortOrder()
                    );
                    listing.addImage(image);
                }
            }
        }

        Listing saved = listingRepository.save(listing);
        return ListingResponse.fromEntity(saved);
    }

    /**
     * Updates an existing listing.
     *
     * Authorization Policy:
     * - Only the listing owner may update their listing.
     * - An ADMIN role override is permitted for administrative moderation (e.g. sanitizing abusive
     *   or prohibited listings). Normal users cannot modify another user's listing.
     *
     * Lifecycle & Integrity Constraints:
     * - REMOVED or COMPLETED listings cannot be edited.
     * - Protected statuses (RESERVED, COMPLETED, REMOVED) cannot be set manually via this endpoint.
     * - RESERVED listings cannot have their type or price altered while an exchange is pending.
     */
    @Transactional
    public ListingResponse updateListing(UUID id, UpdateListingRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to update a listing");
        }

        Listing listing = listingRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + id));

        boolean isOwner = listing.getOwner().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You do not have permission to update this listing");
        }

        // Lifecycle check: concluded listings cannot be edited
        if (listing.getStatus() == ListingStatus.REMOVED || listing.getStatus() == ListingStatus.COMPLETED) {
            throw new IllegalArgumentException("Cannot update a listing that has been " + listing.getStatus().name().toLowerCase(Locale.ROOT));
        }

        // Protected status validation: clients cannot manually set RESERVED, COMPLETED, or REMOVED
        if (request.hasStatus() && request.getStatus() != null) {
            ListingStatus targetStatus = request.getStatus();
            if (targetStatus == ListingStatus.RESERVED || targetStatus == ListingStatus.COMPLETED || targetStatus == ListingStatus.REMOVED) {
                throw new IllegalArgumentException("Cannot manually transition listing to protected status: " + targetStatus);
            }
        }

        // Reserved listing invariant: cannot alter listing type or price while an exchange is pending/reserved
        if (listing.getStatus() == ListingStatus.RESERVED) {
            if (request.hasListingType() && request.getListingType() != null && request.getListingType() != listing.getListingType()) {
                throw new IllegalArgumentException("Cannot change listing type while listing is RESERVED");
            }
            if (request.hasPrice() && request.getPrice() != null && listing.getPrice() != null && request.getPrice().compareTo(listing.getPrice()) != 0) {
                throw new IllegalArgumentException("Cannot change listing price while listing is RESERVED");
            }
        }

        // 1. Category update (selective)
        if (request.hasCategoryId() && request.getCategoryId() != null) {
            if (!request.getCategoryId().equals(listing.getCategory().getId())) {
                Category newCategory = categoryRepository.findById(request.getCategoryId())
                        .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + request.getCategoryId()));
                if (!newCategory.getIsActive()) {
                    throw new IllegalArgumentException("Category '" + newCategory.getName() + "' is currently inactive");
                }
                listing.setCategory(newCategory);
            }
        }

        // 2. Type, price, and currency updates (selective & validated against database check constraints)
        ListingType effectiveType = request.hasListingType() && request.getListingType() != null
                ? request.getListingType()
                : listing.getListingType();

        BigDecimal effectivePrice;
        String effectiveCurrency;

        if (effectiveType == ListingType.GIVEAWAY) {
            effectivePrice = null;
            effectiveCurrency = null;
        } else {
            if (request.hasPrice()) {
                effectivePrice = request.getPrice();
            } else if (effectiveType != listing.getListingType() && effectiveType == ListingType.WANTED) {
                effectivePrice = null;
            } else {
                effectivePrice = listing.getPrice();
            }

            if (request.hasCurrency()) {
                effectiveCurrency = request.getCurrency();
            } else {
                effectiveCurrency = listing.getCurrency();
            }
        }

        PriceAndCurrency priceAndCurrency = validateAndNormalizePriceAndCurrency(
                effectiveType,
                effectivePrice,
                effectiveCurrency
        );

        listing.setListingType(effectiveType);
        listing.setPrice(priceAndCurrency.price());
        listing.setCurrency(priceAndCurrency.currency());

        // 3. Mandatory textual fields: if present, cannot be blank
        if (request.hasTitle()) {
            if (request.getTitle() == null || request.getTitle().isBlank()) {
                throw new IllegalArgumentException("Title must not be blank");
            }
            listing.setTitle(request.getTitle().trim());
        }
        if (request.hasDescription()) {
            if (request.getDescription() == null || request.getDescription().isBlank()) {
                throw new IllegalArgumentException("Description must not be blank");
            }
            listing.setDescription(request.getDescription().trim());
        }
        if (request.hasCity()) {
            if (request.getCity() == null || request.getCity().isBlank()) {
                throw new IllegalArgumentException("City must not be blank");
            }
            listing.setCity(request.getCity().trim());
        }

        // 4. Optional attributes: explicit null clears, non-null updates, omitted preserves
        if (request.hasNeighborhood()) {
            listing.setNeighborhood(request.getNeighborhood() != null ? request.getNeighborhood().trim() : null);
        }
        if (request.hasStateProvince()) {
            listing.setStateProvince(request.getStateProvince() != null ? request.getStateProvince().trim() : null);
        }
        if (request.hasPostalCode()) {
            listing.setPostalCode(request.getPostalCode() != null ? request.getPostalCode().trim() : null);
        }
        if (request.hasCountry() && request.getCountry() != null && !request.getCountry().isBlank()) {
            listing.setCountry(request.getCountry().trim());
        }
        if (request.hasStatus() && request.getStatus() != null) {
            listing.setStatus(request.getStatus());
        }

        // 5. Images update: if present in payload, replace with new collection
        if (request.hasImages() && request.getImages() != null) {
            listing.getImages().clear();
            for (ListingImageDto imgDto : request.getImages()) {
                if (imgDto.getImageUrl() != null && !imgDto.getImageUrl().isBlank()) {
                    ListingImage image = new ListingImage(
                            listing,
                            imgDto.getImageUrl().trim(),
                            imgDto.getSortOrder()
                    );
                    listing.addImage(image);
                }
            }
        }

        Listing updated = listingRepository.save(listing);
        return ListingResponse.fromEntity(updated);
    }

    /**
     * Deletes an existing listing.
     *
     * Authorization Policy:
     * - Only the listing owner may delete their listing.
     * - An ADMIN role override is permitted for administrative moderation (e.g. removing
     *   fraudulent or violating listings).
     *
     * Referential Integrity:
     * - In the database schema, both `listing_requests` and `transactions` reference `listings.id`
     *   with `ON DELETE RESTRICT`.
     * - If any requests or transactions exist, hard deletion would cause a foreign-key violation.
     * - The service safely transitions the listing to `ListingStatus.REMOVED` instead of failing,
     *   preserving user history and ledger integrity.
     */
    @Transactional
    public void deleteListing(UUID id, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to delete a listing");
        }

        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + id));

        boolean isOwner = listing.getOwner().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You do not have permission to delete this listing");
        }

        // Safe status-based removal if referenced by existing requests or transactions (ON DELETE RESTRICT)
        boolean hasRequests = listingRequestRepository.existsByListingId(listing.getId());
        boolean hasTransactions = transactionRepository.existsByListingId(listing.getId());

        if (hasRequests || hasTransactions) {
            listing.setStatus(ListingStatus.REMOVED);
            listingRepository.save(listing);
        } else {
            listingRepository.delete(listing);
        }
    }

    @Transactional(readOnly = true)
    public Page<ListingSummaryResponse> getMyListings(
            ListingStatus status,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view personal listings");
        }

        validatePagination(page, size);
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Listing> listings;
        if (status != null) {
            listings = listingRepository.findByOwnerIdAndStatus(principal.getId(), status, pageable);
        } else {
            listings = listingRepository.findByOwnerId(principal.getId(), pageable);
        }

        return listings.map(ListingSummaryResponse::fromEntity);
    }

    private static final Set<String> ALLOWED_ADMIN_SORT_FIELDS = Set.of(
            "createdat",
            "updatedat",
            "title",
            "price",
            "status",
            "listingtype"
    );

    /**
     * List all platform listings across all owners for administrator inspection,
     * supporting filtering by status, keyword, type, category, owner, deterministic sorting, and pagination.
     */
    @Transactional(readOnly = true)
    public Page<ListingResponse> getAdminListings(
            String keyword,
            ListingStatus status,
            ListingType type,
            UUID categoryId,
            UUID ownerId,
            int page,
            int size,
            String sortParam,
            String sortByParam,
            String sortDirectionParam,
            UserPrincipal principal
    ) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to list platform listings");
        }

        validatePagination(page, size);

        Sort sort = resolveAdminSort(sortParam, sortByParam, sortDirectionParam);
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<Listing> spec = ListingSpecification.filterAdminListings(
                keyword,
                status,
                type,
                categoryId,
                ownerId
        );

        return listingRepository.findAll(spec, pageable).map(ListingResponse::fromEntity);
    }

    private Sort resolveAdminSort(String sortParam, String sortByParam, String sortDirectionParam) {
        String property = "createdAt";
        Sort.Direction direction = Sort.Direction.DESC;

        if (StringUtils.hasText(sortParam)) {
            String[] parts = sortParam.split(",");
            property = parts[0].trim();
            if (parts.length > 1 && StringUtils.hasText(parts[1])) {
                direction = parseSortDirection(parts[1].trim());
            }
        } else if (StringUtils.hasText(sortByParam)) {
            property = sortByParam.trim();
            if (StringUtils.hasText(sortDirectionParam)) {
                direction = parseSortDirection(sortDirectionParam.trim());
            }
        }

        String normalized = property.toLowerCase(Locale.ROOT);
        if (!ALLOWED_ADMIN_SORT_FIELDS.contains(normalized)) {
            throw new IllegalArgumentException("Invalid sort field: " + property);
        }

        String entityProperty = switch (normalized) {
            case "updatedat" -> "updatedAt";
            case "title" -> "title";
            case "price" -> "price";
            case "status" -> "status";
            case "listingtype" -> "listingType";
            default -> "createdAt";
        };

        return Sort.by(direction, entityProperty).and(Sort.by(Sort.Direction.DESC, "id"));
    }

    private Sort.Direction parseSortDirection(String direction) {
        if ("asc".equalsIgnoreCase(direction)) {
            return Sort.Direction.ASC;
        } else if ("desc".equalsIgnoreCase(direction)) {
            return Sort.Direction.DESC;
        }
        throw new IllegalArgumentException("Invalid sort direction: " + direction + ". Expected 'asc' or 'desc'");
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 100) {
            throw new IllegalArgumentException("Page size must be between 1 and 100");
        }
    }

    private PriceAndCurrency validateAndNormalizePriceAndCurrency(
            ListingType type,
            BigDecimal price,
            String currency
    ) {
        if (type == ListingType.GIVEAWAY) {
            if (price != null) {
                throw new IllegalArgumentException("Price must not be provided for GIVEAWAY listings");
            }
            return new PriceAndCurrency(null, null);
        }

        if (type == ListingType.SALE) {
            if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("SALE listings require a positive price");
            }
            String normalizedCurrency = (currency != null && !currency.isBlank())
                    ? currency.trim().toUpperCase(Locale.ROOT)
                    : "VND";
            if (normalizedCurrency.length() != 3) {
                throw new IllegalArgumentException("Currency must be a 3-letter ISO code");
            }
            return new PriceAndCurrency(price, normalizedCurrency);
        }

        if (type == ListingType.WANTED) {
            if (price != null) {
                if (price.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Budget for WANTED listings must be positive if specified");
                }
                String normalizedCurrency = (currency != null && !currency.isBlank())
                    ? currency.trim().toUpperCase(Locale.ROOT)
                    : "VND";
                if (normalizedCurrency.length() != 3) {
                    throw new IllegalArgumentException("Currency must be a 3-letter ISO code");
                }
                return new PriceAndCurrency(price, normalizedCurrency);
            }
            return new PriceAndCurrency(null, null);
        }

        throw new IllegalArgumentException("Unsupported listing type: " + type);
    }

    private record PriceAndCurrency(BigDecimal price, String currency) {}
}
