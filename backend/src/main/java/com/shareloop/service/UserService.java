package com.shareloop.service;

import com.shareloop.dto.listing.ListingSummaryResponse;
import com.shareloop.dto.user.PublicUserProfileResponse;
import com.shareloop.entity.Listing;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ListingRepository listingRepository;

    public UserService(UserRepository userRepository, ListingRepository listingRepository) {
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
    }

    @Transactional(readOnly = true)
    public PublicUserProfileResponse getPublicUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        return PublicUserProfileResponse.fromEntity(user);
    }

    @Transactional(readOnly = true)
    public Page<ListingSummaryResponse> getUserActiveListings(UUID userId, int page, int size) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found with id: " + userId);
        }

        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 50) {
            throw new IllegalArgumentException("Page size must be between 1 and 50");
        }

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Listing> listings = listingRepository.findByOwnerIdAndStatus(userId, ListingStatus.ACTIVE, pageable);
        return listings.map(ListingSummaryResponse::fromEntity);
    }
}
