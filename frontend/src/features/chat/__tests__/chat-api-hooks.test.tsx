import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { chatApi, chatKeys } from '@/features/chat/api/chat-api';
import {
  useConversations,
  useConversationDetails,
  useMessages,
  useGetOrCreateConversation,
  useSendMessage,
} from '@/features/chat/hooks/use-chat';
import { apiClient } from '@/lib/api-client';
import type {
  ConversationResponse,
  ChatMessageResponse,
  CreateConversationRequest,
  SendMessageRequest,
} from '@/types/chat';
import type { PageResponse } from '@/types/api';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockConversation: ConversationResponse = {
  id: 'c1111111-1111-1111-1111-111111111111',
  listing: {
    id: 'l1111111-1111-1111-1111-111111111111',
    title: 'Bàn gỗ sồi tự nhiên',
    listingType: 'GIVEAWAY',
    status: 'ACTIVE',
    price: null,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: 'u1111111-1111-1111-1111-111111111111',
      displayName: 'Chủ bài đăng Alice',
    },
  },
  otherParticipant: {
    id: 'u2222222-2222-2222-2222-222222222222',
    displayName: 'Người hỏi Bob',
  },
  lastMessagePreview: 'Chào bạn, bàn này còn không ạ?',
  lastMessageAt: '2026-10-26T10:00:00Z',
  listingRequestId: 'r1111111-1111-1111-1111-111111111111',
  createdAt: '2026-10-26T09:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
};

const mockMessage: ChatMessageResponse = {
  id: 'm1111111-1111-1111-1111-111111111111',
  conversationId: 'c1111111-1111-1111-1111-111111111111',
  sender: {
    id: 'u2222222-2222-2222-2222-222222222222',
    displayName: 'Người hỏi Bob',
  },
  content: 'Chào bạn, bàn này còn không ạ?',
  createdAt: '2026-10-26T10:00:00Z',
};

const mockConversationsPage: PageResponse<ConversationResponse> = {
  content: [mockConversation],
  totalElements: 1,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockMessagesPage: PageResponse<ChatMessageResponse> = {
  content: [mockMessage],
  totalElements: 1,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('Chat API and Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('chatApi direct calls', () => {
    it('getUserConversations calls GET /api/v1/conversations with params', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockConversationsPage);

      const params = { page: 0, size: 20 };
      const result = await chatApi.getUserConversations(params);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/conversations', {
        params: { page: 0, size: 20 },
      });
      expect(result).toEqual(mockConversationsPage);
    });

    it('getConversationDetails calls GET /api/v1/conversations/{id}', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockConversation);

      const result = await chatApi.getConversationDetails('c1111111-1111-1111-1111-111111111111');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/conversations/c1111111-1111-1111-1111-111111111111'
      );
      expect(result).toEqual(mockConversation);
    });

    it('getMessageHistory calls GET /api/v1/conversations/{id}/messages with params', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockMessagesPage);

      const params = { page: 0, size: 20 };
      const result = await chatApi.getMessageHistory('c1111111-1111-1111-1111-111111111111', params);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/conversations/c1111111-1111-1111-1111-111111111111/messages',
        { params }
      );
      expect(result).toEqual(mockMessagesPage);
    });

    it('getOrCreateConversation calls POST /api/v1/listings/{id}/conversations with payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockConversation);

      const payload: CreateConversationRequest = {
        initialMessage: 'Tôi muốn hỏi về món đồ',
        listingRequestId: 'r1111111-1111-1111-1111-111111111111',
      };
      const result = await chatApi.getOrCreateConversation('l1111111-1111-1111-1111-111111111111', payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/listings/l1111111-1111-1111-1111-111111111111/conversations',
        payload
      );
      expect(result).toEqual(mockConversation);
    });

    it('sendMessage calls POST /api/v1/conversations/{id}/messages with payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessage);

      const payload: SendMessageRequest = { content: 'Bàn còn mới không bạn?' };
      const result = await chatApi.sendMessage('c1111111-1111-1111-1111-111111111111', payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/conversations/c1111111-1111-1111-1111-111111111111/messages',
        payload
      );
      expect(result).toEqual(mockMessage);
    });
  });

  describe('useConversations hook', () => {
    it('fetches paginated conversations successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockConversationsPage);

      const { result } = renderHook(() => useConversations({ page: 0, size: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockConversationsPage);
    });

    it('respects enabled option when false', async () => {
      const { result } = renderHook(
        () => useConversations({ page: 0, size: 20 }, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useConversationDetails hook', () => {
    it('fetches conversation details when valid UUID provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockConversation);

      const { result } = renderHook(
        () => useConversationDetails('c1111111-1111-1111-1111-111111111111'),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockConversation);
    });

    it('stays disabled when conversationId is undefined or invalid UUID', () => {
      const { result: r1 } = renderHook(() => useConversationDetails(undefined), {
        wrapper: createWrapper(queryClient),
      });
      expect(r1.current.fetchStatus).toBe('idle');

      const { result: r2 } = renderHook(() => useConversationDetails('invalid-id'), {
        wrapper: createWrapper(queryClient),
      });
      expect(r2.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useMessages hook', () => {
    it('fetches paginated messages when valid UUID provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockMessagesPage);

      const { result } = renderHook(
        () => useMessages('c1111111-1111-1111-1111-111111111111', { page: 0, size: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockMessagesPage);
    });

    it('stays disabled when conversationId is invalid', () => {
      const { result } = renderHook(() => useMessages('not-a-uuid'), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useGetOrCreateConversation mutation', () => {
    it('creates or retrieves conversation and updates cache', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockConversation);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      const { result } = renderHook(() => useGetOrCreateConversation(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({
        listingId: 'l1111111-1111-1111-1111-111111111111',
        payload: { initialMessage: 'Xin chào' },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockConversation);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: chatKeys.conversations(),
      });
      expect(setQueryDataSpy).toHaveBeenCalledWith(
        chatKeys.conversationDetail(mockConversation.id),
        mockConversation
      );
    });
  });

  describe('useSendMessage mutation', () => {
    it('sends message and invalidates messages, conversation detail, and conversations list', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessage);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSendMessage(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({
        conversationId: 'c1111111-1111-1111-1111-111111111111',
        payload: { content: 'Tin nhắn test' },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockMessage);

      // Invalidate message list for this conversation
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [...chatKeys.messages(), 'c1111111-1111-1111-1111-111111111111'],
      });

      // Invalidate conversation details
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: chatKeys.conversationDetail('c1111111-1111-1111-1111-111111111111'),
      });

      // Invalidate conversation lists
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: chatKeys.conversations(),
      });
    });
  });
});
