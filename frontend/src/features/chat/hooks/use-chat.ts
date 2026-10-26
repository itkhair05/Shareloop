import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi, chatKeys } from '../api/chat-api';
import type { PageResponse } from '@/types/api';
import type {
  ConversationQueryParams,
  ConversationResponse,
  ChatMessageResponse,
  CreateConversationRequest,
  MessageQueryParams,
  SendMessageRequest,
} from '@/types/chat';
import { isValidUuid } from '@/lib/utils';
import { appConfig } from '@/lib/config';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve conversations for the authenticated user.
 */
export function useConversations(
  params?: ConversationQueryParams,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery<PageResponse<ConversationResponse>, ApiError>({
    queryKey: chatKeys.conversationList(params),
    queryFn: () => chatApi.getUserConversations(params),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 1000 * 30, // 30 seconds
    retry: (failureCount, error) => {
      if (appConfig.isTest) return false;
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve conversation details by ID.
 * Validates the conversation UUID before executing network request.
 */
export function useConversationDetails(
  conversationId?: string,
  options?: { enabled?: boolean }
) {
  const isIdValid = Boolean(conversationId && isValidUuid(conversationId));

  return useQuery<ConversationResponse, ApiError>({
    queryKey: chatKeys.conversationDetail(conversationId ?? ''),
    queryFn: () => chatApi.getConversationDetails(conversationId!),
    enabled: (options?.enabled ?? true) && isIdValid,
    staleTime: 1000 * 30,
    retry: (failureCount, error) => {
      if (appConfig.isTest) return false;
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve message history for a conversation.
 * Validates the conversation UUID before executing network request.
 */
export function useMessages(
  conversationId?: string,
  params?: MessageQueryParams,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  const isIdValid = Boolean(conversationId && isValidUuid(conversationId));

  return useQuery<PageResponse<ChatMessageResponse>, ApiError>({
    queryKey: chatKeys.messageList(conversationId ?? '', params),
    queryFn: () => chatApi.getMessageHistory(conversationId!, params),
    enabled: (options?.enabled ?? true) && isIdValid,
    refetchInterval: options?.refetchInterval,
    staleTime: 1000 * 10, // 10 seconds
    retry: (failureCount, error) => {
      if (appConfig.isTest) return false;
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export interface GetOrCreateConversationVariables {
  listingId: string;
  payload?: CreateConversationRequest;
}

/**
 * Mutation hook to create or retrieve a conversation for a listing.
 * On success, refreshes conversation lists and populates conversation detail cache.
 */
export function useGetOrCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<ConversationResponse, ApiError, GetOrCreateConversationVariables>({
    mutationFn: ({ listingId, payload }) =>
      chatApi.getOrCreateConversation(listingId, payload),
    onSuccess: (conversation) => {
      // Invalidate conversation lists so new or updated conversation appears
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });

      // Cache conversation details immediately
      queryClient.setQueryData(
        chatKeys.conversationDetail(conversation.id),
        conversation
      );
    },
  });
}

export interface SendMessageVariables {
  conversationId: string;
  payload: SendMessageRequest;
}

/**
 * Mutation hook to send a message in an existing conversation.
 * On success, invalidates the message list for the conversation, the conversation detail,
 * and the conversation list to keep preview and lastMessageAt ordering in sync.
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<ChatMessageResponse, ApiError, SendMessageVariables>({
    mutationFn: ({ conversationId, payload }) =>
      chatApi.sendMessage(conversationId, payload),
    onSuccess: (_message, variables) => {
      // Invalidate messages for this specific conversation
      queryClient.invalidateQueries({
        queryKey: [...chatKeys.messages(), variables.conversationId],
      });

      // Invalidate conversation details
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationDetail(variables.conversationId),
      });

      // Invalidate conversation list so preview and ordering (lastMessageAt) refresh
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(),
      });
    },
  });
}
