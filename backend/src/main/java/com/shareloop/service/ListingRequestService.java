package com.shareloop.service;

import com.shareloop.dto.request.CreateListingRequestDto;
import com.shareloop.dto.request.ListingRequestResponse;
import com.shareloop.dto.request.UpdateListingRequestStatusRequest;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.DuplicateRequestException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ListingRequestService {

    private final ListingRequestRepository listingRequestRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationService notificationService;

    public ListingRequestService(
            ListingRequestRepository listingRequestRepository,
            ListingRepository listingRepository,
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            NotificationService notificationService
    ) {
        this.listingRequestRepository = listingRequestRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.notificationService = notificationService;
    }

    /**
     * Submit a request for an eligible GIVEAWAY or SALE listing.
     * Enforces:
     * - Authentication & requester derivation from security principal.
     * - Only GIVEAWAY or SALE listings (WANTED listings cannot receive requests on this endpoint).
     * - Listing must be in ACTIVE status.
     * - Users cannot request their own listings.
     * - Prevents duplicate pending requests from the same user for the same listing.
     */
    @Transactional
    public ListingRequestResponse createRequest(UUID listingId, CreateListingRequestDto dto, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to submit a listing request");
        }

        Listing listing = listingRepository.findWithDetailsById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));

        if (listing.getListingType() == ListingType.WANTED) {
            throw new IllegalArgumentException("Requests can only be submitted for GIVEAWAY or SALE listings");
        }

        if (listing.getStatus() != ListingStatus.ACTIVE) {
            throw new IllegalArgumentException("Listing is not active and cannot receive requests");
        }

        if (listing.getOwner().getId().equals(principal.getId())) {
            throw new IllegalArgumentException("Users cannot request their own listings");
        }

        if (listingRequestRepository.existsByListingIdAndRequesterIdAndStatus(listingId, principal.getId(), ListingRequestStatus.PENDING)) {
            throw new DuplicateRequestException("You already have an active pending request for this listing");
        }

        User requester = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + principal.getId()));

        String message = dto != null && dto.getMessage() != null && !dto.getMessage().isBlank()
                ? dto.getMessage().trim()
                : null;

        ListingRequest request = new ListingRequest(
                listing,
                requester,
                message,
                ListingRequestStatus.PENDING
        );

        ListingRequest saved = listingRequestRepository.save(request);

        notificationService.createNotification(
                listing.getOwner(),
                NotificationType.REQUEST_RECEIVED,
                "New Request Received",
                requester.getDisplayName() + " requested your listing \"" + listing.getTitle() + "\"",
                "LISTING_REQUEST",
                saved.getId()
        );

        return ListingRequestResponse.fromEntity(saved);
    }

    /**
     * View requests submitted for a listing.
     * Restricted to the listing owner (or ADMIN).
     */
    @Transactional(readOnly = true)
    public Page<ListingRequestResponse> getRequestsForListing(
            UUID listingId,
            ListingRequestStatus status,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view listing requests");
        }

        validatePagination(page, size);

        Listing listing = listingRepository.findWithDetailsById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));

        boolean isOwner = listing.getOwner().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Only the listing owner may view requests for this listing");
        }

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ListingRequest> requests;
        if (status != null) {
            requests = listingRequestRepository.findByListingIdAndStatus(listingId, status, pageable);
        } else {
            requests = listingRequestRepository.findByListingId(listingId, pageable);
        }

        return requests.map(ListingRequestResponse::fromEntity);
    }

    /**
     * View the authenticated user's own requests.
     */
    @Transactional(readOnly = true)
    public Page<ListingRequestResponse> getMyRequests(
            ListingRequestStatus status,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view your requests");
        }

        validatePagination(page, size);

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ListingRequest> requests;
        if (status != null) {
            requests = listingRequestRepository.findByRequesterIdAndStatus(principal.getId(), status, pageable);
        } else {
            requests = listingRequestRepository.findByRequesterId(principal.getId(), pageable);
        }

        return requests.map(ListingRequestResponse::fromEntity);
    }

    /**
     * Listing owner accepts or rejects a pending listing request.
     * Transitions:
     * - Only PENDING requests may be accepted or rejected.
     * - Accepting a request:
     *   1. Transitions request to ACCEPTED.
     *   2. Creates a Transaction linked to the accepted request (status: PENDING).
     *   3. Transitions the Listing to RESERVED.
     * - Rejecting a request:
     *   1. Transitions request to REJECTED.
     *   2. Listing remains ACTIVE.
     */
    @Transactional
    public ListingRequestResponse updateRequestStatus(
            UUID requestId,
            UpdateListingRequestStatusRequest requestDto,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to update request status");
        }

        ListingRequest request = listingRequestRepository.findWithDetailsById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing request not found with id: " + requestId));

        boolean isOwner = request.getListing().getOwner().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Only the listing owner may accept or reject requests");
        }

        ListingRequestStatus targetStatus = requestDto.getStatus();
        if (targetStatus != ListingRequestStatus.ACCEPTED && targetStatus != ListingRequestStatus.REJECTED) {
            throw new IllegalArgumentException("Only ACCEPTED or REJECTED status transitions are allowed");
        }

        if (request.getStatus() != ListingRequestStatus.PENDING) {
            throw new IllegalArgumentException("Only PENDING requests can be accepted or rejected");
        }

        if (targetStatus == ListingRequestStatus.ACCEPTED) {
            // Lock listing row to serialize concurrent acceptance requests for the same listing
            Listing lockedListing = listingRepository.findByIdForUpdate(request.getListing().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + request.getListing().getId()));

            if (lockedListing.getStatus() != ListingStatus.ACTIVE) {
                throw new IllegalArgumentException("Cannot accept request: listing is currently " + lockedListing.getStatus());
            }

            boolean hasActiveTx = transactionRepository.findByListingIdAndStatusIn(
                    lockedListing.getId(),
                    List.of(TransactionStatus.PENDING, TransactionStatus.IN_PROGRESS, TransactionStatus.COMPLETED)
            ).isPresent();

            if (hasActiveTx) {
                throw new IllegalArgumentException("Cannot accept request: listing already has an active transaction");
            }

            request.setStatus(ListingRequestStatus.ACCEPTED);
            ListingRequest savedRequest = listingRequestRepository.saveAndFlush(request);

            Transaction transaction = new Transaction(
                    savedRequest,
                    lockedListing,
                    lockedListing.getOwner(),
                    request.getRequester(),
                    TransactionStatus.PENDING
            );
            transactionRepository.saveAndFlush(transaction);

            lockedListing.setStatus(ListingStatus.RESERVED);
            listingRepository.saveAndFlush(lockedListing);

            notificationService.createNotification(
                    request.getRequester(),
                    NotificationType.REQUEST_ACCEPTED,
                    "Request Accepted",
                    "Your request for \"" + lockedListing.getTitle() + "\" was accepted",
                    "TRANSACTION",
                    transaction.getId()
            );

            return ListingRequestResponse.fromEntity(savedRequest);
        } else {
            request.setStatus(ListingRequestStatus.REJECTED);
            ListingRequest savedRequest = listingRequestRepository.save(request);

            notificationService.createNotification(
                    request.getRequester(),
                    NotificationType.REQUEST_REJECTED,
                    "Request Declined",
                    "Your request for \"" + request.getListing().getTitle() + "\" was declined",
                    "LISTING_REQUEST",
                    savedRequest.getId()
            );

            return ListingRequestResponse.fromEntity(savedRequest);
        }
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 100) {
            throw new IllegalArgumentException("Page size must be between 1 and 100");
        }
    }
}
