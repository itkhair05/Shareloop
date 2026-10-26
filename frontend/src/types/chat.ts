import type { ListingReferenceDto, UserSummaryDto } from './review';

/**
 * Conversation DTO returned by chat endpoints.
 * Backend DTO: com.shareloop.dto.chat.ConversationResponse
 */
export interface ConversationResponse {
  id: string;
  listing: ListingReferenceDto;
  otherParticipant: UserSummaryDto;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  listingRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat message DTO returned by message endpoints.
 * Backend DTO: com.shareloop.dto.chat.ChatMessageResponse
 */
export interface ChatMessageResponse {
  id: string;
  conversationId: string;
  sender: UserSummaryDto;
  content: string;
  createdAt: string;
}

/**
 * Request payload for creating or retrieving a conversation.
 * POST /api/v1/listings/{listingId}/conversations
 * Backend DTO: com.shareloop.dto.chat.CreateConversationRequest
 */
export interface CreateConversationRequest {
  /** Optional initial message, max 2000 chars */
  initialMessage?: string | null;
  /** Optional linked listing request UUID */
  listingRequestId?: string | null;
}

/**
 * Request payload for sending a chat message.
 * POST /api/v1/conversations/{conversationId}/messages
 * Backend DTO: com.shareloop.dto.chat.SendMessageRequest
 */
export interface SendMessageRequest {
  /** Required message content, non-blank, max 2000 chars */
  content: string;
}

/**
 * Query parameters for fetching conversations.
 * GET /api/v1/conversations
 */
export interface ConversationQueryParams {
  page?: number;
  size?: number;
}

/**
 * Query parameters for fetching messages in a conversation.
 * GET /api/v1/conversations/{conversationId}/messages
 */
export interface MessageQueryParams {
  page?: number;
  size?: number;
}
