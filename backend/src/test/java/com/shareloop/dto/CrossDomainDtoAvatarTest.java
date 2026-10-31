package com.shareloop.dto;

import com.shareloop.dto.chat.ChatMessageResponse;
import com.shareloop.dto.chat.ConversationResponse;
import com.shareloop.dto.chat.UserSummaryDto;
import com.shareloop.dto.listing.ListingResponse;
import com.shareloop.dto.listing.ListingSummaryResponse;
import com.shareloop.dto.listing.OwnerSummaryDto;
import com.shareloop.dto.request.ListingRequestResponse;
import com.shareloop.dto.request.RequesterSummaryDto;
import com.shareloop.dto.review.AdminReviewResponse;
import com.shareloop.dto.review.ReviewResponse;
import com.shareloop.dto.transaction.AdminTransactionResponse;
import com.shareloop.dto.transaction.TransactionResponse;
import com.shareloop.dto.user.AdminUserResponse;
import com.shareloop.dto.user.PublicUserProfileResponse;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class CrossDomainDtoAvatarTest {

    private static final String CUSTOM_URL = "/api/v1/files/b4959146-57df-4221-a3f1-7917ec7886ee.png";
    private static final String GOOGLE_URL = "https://lh3.googleusercontent.com/a/google-avatar-123";

    static Stream<Arguments> avatarCombinations() {
        return Stream.of(
                // customAvatar, googleAvatar, expectedEffective
                Arguments.of(CUSTOM_URL, GOOGLE_URL, CUSTOM_URL),
                Arguments.of(CUSTOM_URL, null, CUSTOM_URL),
                Arguments.of(null, GOOGLE_URL, GOOGLE_URL),
                Arguments.of(null, null, null)
        );
    }

    private User createUser(String customAvatar, String googleAvatar) {
        User user = new User("Nguyen Van A", "a@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setId(UUID.randomUUID());
        user.setAvatarUrl(customAvatar);
        user.setGoogleAvatarUrl(googleAvatar);
        return user;
    }

    @ParameterizedTest(name = "UserSummaryDto: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void userSummaryDto_mapsEffectiveAvatar(String custom, String google, String expected) {
        User user = createUser(custom, google);
        UserSummaryDto dto = UserSummaryDto.fromEntity(user);

        assertThat(dto).isNotNull();
        assertThat(dto.getAvatarUrl()).isEqualTo(expected);
        assertThat(dto.getId()).isEqualTo(user.getId());
        assertThat(dto.getDisplayName()).isEqualTo(user.getDisplayName());
    }

    @ParameterizedTest(name = "RequesterSummaryDto: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void requesterSummaryDto_mapsEffectiveAvatar(String custom, String google, String expected) {
        User user = createUser(custom, google);
        RequesterSummaryDto dto = RequesterSummaryDto.fromEntity(user);

        assertThat(dto).isNotNull();
        assertThat(dto.getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "OwnerSummaryDto: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void ownerSummaryDto_mapsEffectiveAvatar(String custom, String google, String expected) {
        User user = createUser(custom, google);
        OwnerSummaryDto dto = OwnerSummaryDto.fromEntity(user);

        assertThat(dto).isNotNull();
        assertThat(dto.getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "PublicUserProfileResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void publicUserProfileResponse_mapsEffectiveAvatar(String custom, String google, String expected) {
        User user = createUser(custom, google);
        PublicUserProfileResponse dto = PublicUserProfileResponse.fromEntity(user);

        assertThat(dto).isNotNull();
        assertThat(dto.getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "AdminUserResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void adminUserResponse_mapsAllAvatarFields(String custom, String google, String expected) {
        User user = createUser(custom, google);
        AdminUserResponse dto = AdminUserResponse.fromEntity(user);

        assertThat(dto).isNotNull();
        assertThat(dto.getAvatarUrl()).isEqualTo(expected);
        assertThat(dto.getCustomAvatarUrl()).isEqualTo(custom);
        assertThat(dto.getGoogleAvatarUrl()).isEqualTo(google);
    }

    @ParameterizedTest(name = "ConversationResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void conversationResponse_propagatesOtherParticipantAvatar(String custom, String google, String expected) {
        User otherUser = createUser(custom, google);
        User currentUser = createUser(null, null);

        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(currentUser, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");
        Conversation conversation = new Conversation(listing, currentUser, otherUser, null);
        conversation.setId(UUID.randomUUID());

        ConversationResponse response = ConversationResponse.fromEntity(conversation, currentUser.getId(), "Hello");

        assertThat(response).isNotNull();
        assertThat(response.getOtherParticipant()).isNotNull();
        assertThat(response.getOtherParticipant().getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "ChatMessageResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void chatMessageResponse_propagatesSenderAvatar(String custom, String google, String expected) {
        User sender = createUser(custom, google);
        User recipient = createUser(null, null);

        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(sender, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");
        Conversation conversation = new Conversation(listing, sender, recipient, null);
        conversation.setId(UUID.randomUUID());

        ChatMessage message = new ChatMessage(conversation, sender, "Test message");
        message.setId(UUID.randomUUID());

        ChatMessageResponse response = ChatMessageResponse.fromEntity(message);

        assertThat(response).isNotNull();
        assertThat(response.getSender()).isNotNull();
        assertThat(response.getSender().getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "ReviewResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void reviewResponse_propagatesReviewerAndRevieweeAvatar(String custom, String google, String expected) {
        User reviewer = createUser(custom, google);
        User reviewee = createUser(null, null);

        Review review = new Review();
        review.setId(UUID.randomUUID());
        review.setReviewer(reviewer);
        review.setReviewee(reviewee);
        review.setRating(5);
        review.setComment("Great item!");

        ReviewResponse response = ReviewResponse.fromEntity(review);

        assertThat(response).isNotNull();
        assertThat(response.getReviewer()).isNotNull();
        assertThat(response.getReviewer().getAvatarUrl()).isEqualTo(expected);
        assertThat(response.getReviewee().getAvatarUrl()).isNull();
    }

    @ParameterizedTest(name = "AdminReviewResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void adminReviewResponse_propagatesReviewerAndRevieweeAvatar(String custom, String google, String expected) {
        User reviewer = createUser(custom, google);
        User reviewee = createUser(null, null);

        Review review = new Review();
        review.setId(UUID.randomUUID());
        review.setReviewer(reviewer);
        review.setReviewee(reviewee);
        review.setRating(4);

        AdminReviewResponse response = AdminReviewResponse.fromEntity(review);

        assertThat(response).isNotNull();
        assertThat(response.getReviewerAvatarUrl()).isEqualTo(expected);
        assertThat(response.getRevieweeAvatarUrl()).isNull();
    }

    @ParameterizedTest(name = "TransactionResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void transactionResponse_propagatesOwnerAndRequesterAvatar(String custom, String google, String expected) {
        User owner = createUser(custom, google);
        User requester = createUser(null, null);

        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");
        Transaction transaction = new Transaction(null, listing, owner, requester, com.shareloop.entity.enums.TransactionStatus.PENDING);
        transaction.setId(UUID.randomUUID());

        TransactionResponse response = TransactionResponse.fromEntity(transaction, null);

        assertThat(response).isNotNull();
        assertThat(response.getOwner()).isNotNull();
        assertThat(response.getOwner().getAvatarUrl()).isEqualTo(expected);
        assertThat(response.getRequester().getAvatarUrl()).isNull();
    }

    @ParameterizedTest(name = "AdminTransactionResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void adminTransactionResponse_propagatesNestedAndFlatAvatars(String custom, String google, String expected) {
        User owner = createUser(custom, google);
        User requester = createUser(null, null);

        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");
        Transaction transaction = new Transaction(null, listing, owner, requester, com.shareloop.entity.enums.TransactionStatus.PENDING);
        transaction.setId(UUID.randomUUID());

        AdminTransactionResponse response = AdminTransactionResponse.fromEntity(transaction);

        assertThat(response).isNotNull();
        assertThat(response.getOwnerAvatarUrl()).isEqualTo(expected);
        assertThat(response.getOwner().getAvatarUrl()).isEqualTo(expected);
        assertThat(response.getRequesterAvatarUrl()).isNull();
        assertThat(response.getRequester().getAvatarUrl()).isNull();
    }

    @ParameterizedTest(name = "ListingResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void listingResponse_propagatesOwnerAvatar(String custom, String google, String expected) {
        User owner = createUser(custom, google);
        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");

        ListingResponse response = ListingResponse.fromEntity(listing);

        assertThat(response).isNotNull();
        assertThat(response.getOwner()).isNotNull();
        assertThat(response.getOwner().getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "ListingSummaryResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void listingSummaryResponse_propagatesOwnerAvatar(String custom, String google, String expected) {
        User owner = createUser(custom, google);
        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");

        ListingSummaryResponse response = ListingSummaryResponse.fromEntity(listing);

        assertThat(response).isNotNull();
        assertThat(response.getOwner()).isNotNull();
        assertThat(response.getOwner().getAvatarUrl()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "ListingRequestResponse: custom={0}, google={1} -> effective={2}")
    @MethodSource("avatarCombinations")
    void listingRequestResponse_propagatesRequesterAvatar(String custom, String google, String expected) {
        User requester = createUser(custom, google);
        User owner = createUser(null, null);
        Category category = new Category("Category", "cat-slug", "desc", true);
        Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Item", "Desc", "Ha Noi");
        ListingRequest request = new ListingRequest(listing, requester, "Interested", com.shareloop.entity.enums.ListingRequestStatus.PENDING);

        ListingRequestResponse response = ListingRequestResponse.fromEntity(request);

        assertThat(response).isNotNull();
        assertThat(response.getRequester()).isNotNull();
        assertThat(response.getRequester().getAvatarUrl()).isEqualTo(expected);
    }
}
