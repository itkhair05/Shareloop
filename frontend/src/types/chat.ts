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
  /** Null for image-only messages. */
  content: string | null;
  createdAt: string;
  /** TEXT or IMAGE; optional for compatibility with cached fixtures. */
  type?: 'TEXT' | 'IMAGE';
  /** Private chat image path (e.g. /api/v1/chat-images/{fileId}) for IMAGE messages. */
  imageUrl?: string | null;
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
  /** Optional caption, max 2000 chars. Omit or send null for image-only messages. */
  content?: string | null;
  /** Uploaded CHAT image file ID; required when content is empty. */
  imageId?: string | null;
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
