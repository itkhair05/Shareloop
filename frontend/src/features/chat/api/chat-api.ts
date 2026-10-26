import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  ConversationQueryParams,
  ConversationResponse,
  ChatMessageResponse,
  CreateConversationRequest,
  MessageQueryParams,
  SendMessageRequest,
} from '@/types/chat';

/**
 * Service for Chat & Messaging operations.
 * Encapsulates network operations for all verified backend endpoints in ChatController.
 */
export const chatApi = {
  /**
   * Create or retrieve a canonical conversation between the authenticated requester and listing owner.
   * POST /api/v1/listings/{listingId}/conversations
   */
  async getOrCreateConversation(
    listingId: string,
    payload?: CreateConversationRequest
  ): Promise<ConversationResponse> {
    return apiClient.post<ConversationResponse, CreateConversationRequest | undefined>(
      `/api/v1/listings/${encodeURIComponent(listingId)}/conversations`,
      payload
    );
  },

  /**
   * List all conversations for the authenticated user.
   * GET /api/v1/conversations
   */
  async getUserConversations(
    params?: ConversationQueryParams
  ): Promise<PageResponse<ConversationResponse>> {
    return apiClient.get<PageResponse<ConversationResponse>>('/api/v1/conversations', {
      params,
    });
  },

  /**
   * Get conversation details by ID.
   * GET /api/v1/conversations/{conversationId}
   */
  async getConversationDetails(conversationId: string): Promise<ConversationResponse> {
    return apiClient.get<ConversationResponse>(
      `/api/v1/conversations/${encodeURIComponent(conversationId)}`
    );
  },

  /**
   * Send a message in a conversation.
   * POST /api/v1/conversations/{conversationId}/messages
   */
  async sendMessage(
    conversationId: string,
    payload: SendMessageRequest
  ): Promise<ChatMessageResponse> {
    return apiClient.post<ChatMessageResponse, SendMessageRequest>(
      `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      payload
    );
  },

  /**
   * Retrieve paginated message history for a conversation.
   * GET /api/v1/conversations/{conversationId}/messages
   */
  async getMessageHistory(
    conversationId: string,
    params?: MessageQueryParams
  ): Promise<PageResponse<ChatMessageResponse>> {
    return apiClient.get<PageResponse<ChatMessageResponse>>(
      `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      { params }
    );
  },
};

/**
 * Centralized React Query Keys for Chat & Messages
 */
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversationList: (params?: ConversationQueryParams) =>
    [...chatKeys.conversations(), 'list', params] as const,
  conversationDetails: () => [...chatKeys.conversations(), 'detail'] as const,
  conversationDetail: (id: string) => [...chatKeys.conversationDetails(), id] as const,
  messages: () => [...chatKeys.all, 'messages'] as const,
  messageList: (conversationId: string, params?: MessageQueryParams) =>
    [...chatKeys.messages(), conversationId, params] as const,
};

export default chatApi;
