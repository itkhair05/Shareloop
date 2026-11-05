package com.shareloop.service;

import com.shareloop.dto.chat.ChatMessagePreview;
import com.shareloop.dto.chat.ChatMessageResponse;
import com.shareloop.dto.chat.ConversationResponse;
import com.shareloop.dto.chat.CreateConversationRequest;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.entity.ChatMessage;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.exception.RateLimitExceededException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ChatMessageRepository;
import com.shareloop.repository.ConversationRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.security.ratelimit.RateLimitProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ListingRepository listingRepository;
    private final ListingRequestRepository listingRequestRepository;
    private final UserRepository userRepository;
    private final UploadedFileRepository uploadedFileRepository;
    private final NotificationService notificationService;
    private final RateLimitProperties rateLimitProperties;
    private final Clock clock;

    @Autowired
    @Lazy
    private ChatService self;

    public ChatService(
            ConversationRepository conversationRepository,
            ChatMessageRepository chatMessageRepository,
            ListingRepository listingRepository,
            ListingRequestRepository listingRequestRepository,
            UserRepository userRepository,
            UploadedFileRepository uploadedFileRepository,
            NotificationService notificationService,
            RateLimitProperties rateLimitProperties,
            Clock clock
    ) {
        this.conversationRepository = conversationRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.listingRepository = listingRepository;
        this.listingRequestRepository = listingRequestRepository;
        this.userRepository = userRepository;
        this.uploadedFileRepository = uploadedFileRepository;
        this.notificationService = notificationService;
        this.rateLimitProperties = rateLimitProperties;
        this.clock = clock;
    }

    /**
     * Create or retrieve a canonical conversation between the authenticated requester and listing owner.
     * Enforces:
     * - Authentication.
     * - Rejection of self-conversations (owner cannot chat with themselves on their own listing).
     * - Idempotency: if a conversation already exists for (listingId, requesterId), return it.
     * - If conversation already exists, return it even if the listing has become unavailable.
     * - If conversation is new, listing must be in ACTIVE status.
     * - Optional initial message persisted atomically on creation only; never re-inserted on existing conversations.
     * - Safe concurrent creation handled via isolated transaction and fallback retrieval.
     */
    public ConversationResponse getOrCreateConversation(
            UUID listingId,
            CreateConversationRequest request,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to start a conversation");
        }

        Listing listing = listingRepository.findWithDetailsById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));

        if (listing.getOwner().getId().equals(principal.getId())) {
            throw new IllegalArgumentException("Users cannot start conversations on their own listings");
        }

        // 1. Check if conversation already exists for this listing and requester
        Optional<Conversation> existingOpt = conversationRepository.findByListingIdAndRequesterId(listingId, principal.getId());
        if (existingOpt.isPresent()) {
            Conversation existing = existingOpt.get();
            String preview = chatMessageRepository.findFirstByConversationIdOrderByCreatedAtDescIdDesc(existing.getId())
                    .map(ChatMessagePreview::from)
                    .orElse(null);
            return ConversationResponse.fromEntity(existing, principal.getId(), preview);
        }

        // 2. New conversation requires an ACTIVE listing
        if (listing.getStatus() != ListingStatus.ACTIVE) {
            throw new IllegalArgumentException("Cannot create conversation: listing is not active");
        }

        // 3. Validate optional listingRequestId
        UUID validRequestId = null;
        if (request != null && request.getListingRequestId() != null) {
            ListingRequest listingRequest = listingRequestRepository.findById(request.getListingRequestId())
                    .orElseThrow(() -> new ResourceNotFoundException("Listing request not found with id: " + request.getListingRequestId()));

            if (!listingRequest.getListing().getId().equals(listingId)) {
                throw new IllegalArgumentException("Listing request does not belong to the specified listing");
            }
            if (!listingRequest.getRequester().getId().equals(principal.getId())) {
                throw new IllegalArgumentException("Listing request does not belong to the authenticated user");
            }
            validRequestId = listingRequest.getId();
        }

        String initialMessage = request != null && request.getInitialMessage() != null && !request.getInitialMessage().isBlank()
                ? request.getInitialMessage().trim()
                : null;

        // 4. Attempt isolated creation with fallback on concurrent duplicate constraint violation
        try {
            return self.createConversationInternal(listingId, principal.getId(), initialMessage, validRequestId);
        } catch (DataIntegrityViolationException ex) {
            // A concurrent request won the race; retrieve canonical conversation
            Conversation canonical = conversationRepository.findByListingIdAndRequesterId(listingId, principal.getId())
                    .orElseThrow(() -> ex);
            String preview = chatMessageRepository.findFirstByConversationIdOrderByCreatedAtDescIdDesc(canonical.getId())
                    .map(ChatMessagePreview::from)
                    .orElse(null);
            return ConversationResponse.fromEntity(canonical, principal.getId(), preview);
        }
    }

    /**
     * Isolated transaction for inserting a new conversation and optional initial message atomically.
     * Uses REQUIRES_NEW so that any unique constraint violation rolls back only this transaction,
     * leaving the calling transaction able to query and return the canonical winner.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ConversationResponse createConversationInternal(
            UUID listingId,
            UUID requesterId,
            String initialMessage,
            UUID listingRequestId
    ) {
        Listing listing = listingRepository.findWithDetailsById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + requesterId));

        ListingRequest listingRequest = null;
        if (listingRequestId != null) {
            listingRequest = listingRequestRepository.findById(listingRequestId).orElse(null);
        }

        Conversation conversation = new Conversation(listing, listing.getOwner(), requester, listingRequest);
        Conversation savedConversation = conversationRepository.saveAndFlush(conversation);

        String messagePreview = null;
        if (initialMessage != null && !initialMessage.isBlank()) {
            User lockedRequester = userRepository.findByIdForUpdate(requesterId).orElse(requester);

            Instant now = clock.instant();
            int windowSeconds = rateLimitProperties != null && rateLimitProperties.getChatWindowSeconds() > 0
                    ? rateLimitProperties.getChatWindowSeconds()
                    : 60;
            int maxLimit = rateLimitProperties != null && rateLimitProperties.getChatMessageLimit() > 0
                    ? rateLimitProperties.getChatMessageLimit()
                    : 20;

            Instant windowStart = now.minus(windowSeconds, ChronoUnit.SECONDS);
            long recentCount = chatMessageRepository.countBySenderIdAndCreatedAtAfter(lockedRequester.getId(), windowStart);
            if (recentCount >= maxLimit) {
                throw new RateLimitExceededException("Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ trong giây lát.");
            }

            ChatMessage message = new ChatMessage(savedConversation, lockedRequester, initialMessage);
            ChatMessage savedMessage = chatMessageRepository.saveAndFlush(message);
            savedConversation.setLastMessageAt(savedMessage.getCreatedAt());
            savedConversation = conversationRepository.saveAndFlush(savedConversation);
            messagePreview = ChatMessagePreview.from(savedMessage);

            String senderName = (requester != null && requester.getDisplayName() != null && !requester.getDisplayName().isBlank())
                    ? requester.getDisplayName().trim()
                    : null;
            String notifMessage = (senderName != null)
                    ? "Bạn có tin nhắn mới từ " + senderName
                    : "Bạn có tin nhắn mới";

            notificationService.createNotification(
                    listing.getOwner(),
                    NotificationType.CHAT_MESSAGE,
                    "Tin nhắn mới",
                    notifMessage,
                    "CONVERSATION",
                    savedConversation.getId()
            );
        }

        return ConversationResponse.fromEntity(savedConversation, requesterId, messagePreview);
    }

    /**
     * List all conversations for the authenticated user (as owner or requester).
     * Ordered deterministically: most recently messaged first (lastMessageAt DESC NULLS LAST),
     * with createdAt DESC, id DESC as tie-breaker.
     * Batch-fetches message previews in one query to avoid N+1 queries.
     */
    @Transactional(readOnly = true)
    public Page<ConversationResponse> getUserConversations(int page, int size, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view conversations");
        }

        validatePagination(page, size);

        Sort sort = Sort.by(
                new Sort.Order(Sort.Direction.DESC, "lastMessageAt", Sort.NullHandling.NULLS_LAST),
                Sort.Order.desc("createdAt"),
                Sort.Order.desc("id")
        );
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Conversation> conversations = conversationRepository.findByUserId(principal.getId(), pageable);

        List<UUID> convIds = conversations.getContent().stream().map(Conversation::getId).toList();
        Map<UUID, String> previewMap = new HashMap<>();
        if (!convIds.isEmpty()) {
            List<ChatMessage> latestMessages = chatMessageRepository.findLatestMessagesForConversations(convIds);
            for (ChatMessage m : latestMessages) {
                previewMap.put(m.getConversation().getId(), ChatMessagePreview.from(m));
            }
        }

        return conversations.map(c -> ConversationResponse.fromEntity(c, principal.getId(), previewMap.get(c.getId())));
    }

    /**
     * Get conversation details by ID.
     * Enforces strict participant authorization (only owner or requester may view; non-participant admins denied).
     */
    @Transactional(readOnly = true)
    public ConversationResponse getConversationDetails(UUID conversationId, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to access this conversation");
        }

        Conversation conversation = conversationRepository.findWithDetailsById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (!conversation.isParticipant(principal.getId())) {
            throw new AccessDeniedException("You are not authorized to access this conversation");
        }

        String preview = chatMessageRepository.findFirstByConversationIdOrderByCreatedAtDescIdDesc(conversationId)
                .map(ChatMessagePreview::from)
                .orElse(null);

        return ConversationResponse.fromEntity(conversation, principal.getId(), preview);
    }

    /**
     * Send a message in a conversation.
     * Enforces:
     * - Authentication.
     * - Participant authorization (only owner or requester).
     * - Text and/or a single owned, unbound CHAT upload <= 2000 characters of caption.
     * - Listing status: messages cannot be sent if listing has been REMOVED.
     * - Pessimistic row locking on Conversation to serialize concurrent sends and maintain atomic lastMessageAt.
     * - Pessimistic row locking on the upload so a file can only be attached once; the attachment
     *   binding is committed atomically with the message.
     */
    @Transactional
    public ChatMessageResponse sendMessage(UUID conversationId, SendMessageRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to send a message");
        }

        // 1. Lock sender user row for update to serialize concurrent rate limit checks across all conversations
        User sender = userRepository.findByIdForUpdate(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + principal.getId()));

        // 2. Enforce chat message rate limit (default 20 messages per 60 seconds rolling window)
        Instant now = clock.instant();
        int windowSeconds = rateLimitProperties != null && rateLimitProperties.getChatWindowSeconds() > 0
                ? rateLimitProperties.getChatWindowSeconds()
                : 60;
        int maxLimit = rateLimitProperties != null && rateLimitProperties.getChatMessageLimit() > 0
                ? rateLimitProperties.getChatMessageLimit()
                : 20;

        Instant windowStart = now.minus(windowSeconds, ChronoUnit.SECONDS);
        long recentMessageCount = chatMessageRepository.countBySenderIdAndCreatedAtAfter(sender.getId(), windowStart);
        if (recentMessageCount >= maxLimit) {
            throw new RateLimitExceededException("Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ trong giây lát.");
        }

        // 3. Lock conversation row for update to serialize concurrent messages and update lastMessageAt atomically
        Conversation conversation = conversationRepository.findByIdForUpdate(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (!conversation.isParticipant(principal.getId())) {
            throw new AccessDeniedException("You are not authorized to send messages in this conversation");
        }

        if (conversation.getListing().getStatus() == ListingStatus.REMOVED) {
            throw new IllegalArgumentException("Cannot send message: listing has been removed");
        }

        String content = request != null && request.getContent() != null ? request.getContent().trim() : "";
        UUID imageId = request != null ? request.getImageId() : null;

        if (content.isEmpty() && imageId == null) {
            throw new IllegalArgumentException("Message must contain text or an image");
        }
        if (content.length() > 2000) {
            throw new IllegalArgumentException("Message content cannot exceed 2000 characters");
        }
        if (content.isEmpty()) {
            content = null;
        }

        UploadedFile upload = null;
        if (imageId != null) {
            upload = uploadedFileRepository.findByIdForUpdate(imageId)
                    .orElseThrow(() -> new ResourceNotFoundException("Uploaded image not found with id: " + imageId));

            if (!upload.getOwner().getId().equals(sender.getId())) {
                throw new AccessDeniedException("You are not authorized to attach this image");
            }
            if (upload.getPurpose() != UploadPurpose.CHAT) {
                throw new IllegalArgumentException("Uploaded file is not a chat attachment");
            }
            if (upload.isPendingDeletion()) {
                throw new IllegalArgumentException("Hình ảnh không còn khả dụng. Vui lòng tải lên lại.");
            }
            if (upload.isBound()) {
                throw new IllegalArgumentException("Uploaded image has already been attached to a message");
            }
        }

        ChatMessage message = new ChatMessage(conversation, sender, content, imageId);
        ChatMessage savedMessage = chatMessageRepository.saveAndFlush(message);

        if (upload != null) {
            upload.bindTo(savedMessage);
            uploadedFileRepository.saveAndFlush(upload);
        }

        Instant messageTime = savedMessage.getCreatedAt();
        if (conversation.getLastMessageAt() != null && messageTime.isBefore(conversation.getLastMessageAt())) {
            messageTime = conversation.getLastMessageAt();
        }
        conversation.setLastMessageAt(messageTime);
        conversationRepository.saveAndFlush(conversation);

        User recipient = conversation.getOwner().getId().equals(sender.getId())
                ? conversation.getRequester()
                : conversation.getOwner();

        String senderName = (sender != null && sender.getDisplayName() != null && !sender.getDisplayName().isBlank())
                ? sender.getDisplayName().trim()
                : null;
        String notifMessage = (senderName != null)
                ? "Bạn có tin nhắn mới từ " + senderName
                : "Bạn có tin nhắn mới";

        notificationService.createNotification(
                recipient,
                NotificationType.CHAT_MESSAGE,
                "Tin nhắn mới",
                notifMessage,
                "CONVERSATION",
                conversation.getId()
        );

        return ChatMessageResponse.fromEntity(savedMessage);
    }

    /**
     * Retrieve paginated message history for a conversation.
     * Enforces strict participant authorization.
     * Sorted deterministically by createdAt DESC, id DESC.
     */
    @Transactional(readOnly = true)
    public Page<ChatMessageResponse> getMessageHistory(UUID conversationId, int page, int size, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view message history");
        }

        validatePagination(page, size);

        Conversation conversation = conversationRepository.findWithDetailsById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (!conversation.isParticipant(principal.getId())) {
            throw new AccessDeniedException("You are not authorized to access messages in this conversation");
        }

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ChatMessage> messages = chatMessageRepository.findByConversationId(conversationId, pageable);
        return messages.map(ChatMessageResponse::fromEntity);
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
