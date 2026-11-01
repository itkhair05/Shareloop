import { apiClient } from '@/lib/api-client';
import { isValidUuid } from '@/lib/utils';
import type { PageResponse } from '@/types/api';
import type { FileUploadResponse } from '@/types/file';
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

  /**
   * Upload a private chat attachment.
   * POST /api/v1/files/upload (multipart, purpose=CHAT)
   */
  async uploadChatImage(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'CHAT');

    // The shared API client strips the default JSON Content-Type for FormData
    // so the browser can set multipart/form-data with the correct boundary.
    const response = await apiClient.post<FileUploadResponse, FormData>(
      '/api/v1/files/upload',
      formData
    );

    if (!response || !isValidUuid(response.id)) {
      throw new Error('Uploaded file response is missing a valid id');
    }

    return response;
  },

  /**
   * Download a private chat image through the authenticated API client.
   * Only the participant-restricted endpoint returned by the backend is allowed;
   * public file URLs are rejected so access checks cannot be bypassed.
   * GET /api/v1/chat-images/{imageId}
   */
  async getChatImage(imageUrl: string, signal?: AbortSignal): Promise<Blob> {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/api/v1/chat-images/')) {
      throw new Error('Unsupported chat image URL');
    }

    const blob = await apiClient.get<Blob>(imageUrl, {
      responseType: 'blob',
      signal,
    });

    if (!(blob instanceof Blob) || blob.size === 0 || !blob.type.startsWith('image/')) {
      throw new Error('Chat image response is not a valid image');
    }

    return blob;
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
