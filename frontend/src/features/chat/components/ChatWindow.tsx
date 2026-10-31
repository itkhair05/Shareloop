import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Package,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import {
  useConversationDetails,
  useMessages,
  useSendMessage,
} from '../hooks/use-chat';
import { chatApi } from '../api/chat-api';
import { MessageBubble } from './MessageBubble';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/Button';
import { cn, isValidUuid } from '@/lib/utils';
import type { ChatMessageResponse } from '@/types/chat';

export interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
  className?: string;
}

export function ChatWindow({ conversationId, onBack, className }: ChatWindowProps) {
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [olderMessages, setOlderMessages] = useState<ChatMessageResponse[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [currentOlderPage, setCurrentOlderPage] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScrollRef = useRef(true);

  const isIdValid = Boolean(conversationId && isValidUuid(conversationId));

  // Conversation detail query (scoped to authenticated user and valid UUID)
  const {
    data: conversation,
    isLoading: isConversationLoading,
    isError: isConversationError,
    refetch: refetchConversation,
  } = useConversationDetails(conversationId, {
    enabled: Boolean(isAuthenticated && isIdValid),
  });

  // Poll latest messages (page 0) every 4 seconds only while active & authenticated
  const {
    data: messagesPage,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    refetch: refetchMessages,
  } = useMessages(
    conversationId,
    { page: 0, size: 50 },
    {
      enabled: Boolean(isAuthenticated && isIdValid),
      refetchInterval: 4000,
    }
  );

  const sendMessageMutation = useSendMessage();

  const totalPages = messagesPage?.totalPages ?? 1;
  const hasOlderMessages = totalPages > currentOlderPage + 1;

  // Load older message pages and merge them without losing history
  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasOlderMessages || !isIdValid) return;

    setIsLoadingOlder(true);
    try {
      const nextPage = currentOlderPage + 1;
      const olderPageRes = await chatApi.getMessageHistory(conversationId, {
        page: nextPage,
        size: 50,
      });

      // Prepend older messages into state
      setOlderMessages((prev) => [...prev, ...olderPageRes.content]);
      setCurrentOlderPage(nextPage);
    } catch {
      // Keep existing loaded messages on error
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Merge older accumulated messages with the latest polled page 0 messages.
  // Deduplicate by message ID and sort chronologically: oldest at top, newest at bottom.
  const chronologicalMessages = useMemo(() => {
    const messageMap = new Map<string, ChatMessageResponse>();

    // 1. Add older messages
    olderMessages.forEach((msg) => {
      messageMap.set(msg.id, msg);
    });

    // 2. Add latest page 0 messages (overwriting any duplicates with newest state)
    const page0Messages = messagesPage?.content ?? [];
    page0Messages.forEach((msg) => {
      messageMap.set(msg.id, msg);
    });

    const merged = Array.from(messageMap.values());

    // 3. Sort chronologically: oldest first, newest last
    merged.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    return merged;
  }, [messagesPage?.content, olderMessages]);

  // Determine whether the user is near the bottom of the scroll container
  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 120; // 120px threshold
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  // Auto-scroll management:
  // - Initial open: scrolls down to the latest message.
  // - Subsequent messages: only scrolls down if the user is already near the bottom.
  // - If the user is reading older messages, polling does NOT force-jump to the bottom.
  useEffect(() => {
    if (chronologicalMessages.length === 0) return;

    if (isInitialScrollRef.current) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'auto' });
      isInitialScrollRef.current = false;
      return;
    }

    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [chronologicalMessages.length, conversationId]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sendMessageMutation.isPending) {
      return;
    }

    if (trimmed.length > 2000) {
      setSendError('Tin nhắn không được vượt quá 2.000 ký tự.');
      return;
    }

    setSendError(null);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        payload: { content: trimmed },
      });
      // Clear input only upon confirmed success
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.blur();
      }
      // Force scroll to bottom when the user sends a message
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    } catch (err: unknown) {
      // Preserve unsent content in state and provide accurate error feedback
      const apiError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = apiError?.response?.status;

      if (!apiError?.response) {
        // Network timeout / lost response: outcome is ambiguous.
        // Background-refresh history and inform the user without claiming definite delivery failure.
        refetchMessages();
        setSendError(
          'Không thể xác nhận kết nối với máy chủ. Tin nhắn có thể đã được gửi hoặc chưa. Vui lòng kiểm tra lại lịch sử trò chuyện trước khi gửi lại để tránh tin nhắn trùng lặp.'
        );
      } else if (status === 400) {
        setSendError('Nội dung tin nhắn không hợp lệ hoặc đã vượt quá giới hạn 2.000 ký tự.');
      } else if (status === 403 || status === 401) {
        setSendError('Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này.');
      } else if (status === 404) {
        setSendError('Cuộc trò chuyện này không còn tồn tại.');
      } else {
        setSendError(
          `Không thể gửi tin nhắn do lỗi hệ thống (mã ${status || 'không xác định'}). Vui lòng thử lại sau.`
        );
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isConversationLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-8 text-slate-400 gap-3', className)}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-medium">Đang tải cuộc trò chuyện...</p>
      </div>
    );
  }

  if (isConversationError || !conversation) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-8 text-center space-y-4', className)}>
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Không thể tải cuộc trò chuyện
          </h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Cuộc trò chuyện này có thể không tồn tại hoặc bạn không có quyền truy cập.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Quay lại
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => refetchConversation()}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  const otherName = conversation.otherParticipant.displayName || 'Người dùng';

  return (
    <div className={cn('flex flex-col h-full bg-slate-50 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors md:hidden cursor-pointer"
              aria-label="Quay lại danh sách tin nhắn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <Avatar
            avatarUrl={conversation.otherParticipant.avatarUrl}
            name={otherName}
            size="md"
            alt={`Ảnh đại diện của ${otherName}`}
            className="shadow-xs shrink-0"
          />

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              {otherName}
            </h2>
            <Link
              to={`/listings/${conversation.listing.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 truncate transition-colors"
              title={conversation.listing.title}
            >
              <Package className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[200px] sm:max-w-[320px]">
                {conversation.listing.title}
              </span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        role="log"
        aria-live="polite"
        aria-label="Lịch sử tin nhắn"
      >
        {/* Load older messages button */}
        {hasOlderMessages && (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadOlder}
              disabled={isLoadingOlder}
              className="text-xs h-7 px-3 text-slate-600 hover:text-slate-900 border-slate-200 cursor-pointer"
              aria-label="Tải thêm tin nhắn cũ hơn"
            >
              {isLoadingOlder ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Đang tải tin nhắn cũ...</span>
                </>
              ) : (
                <span>Tải tin nhắn cũ hơn</span>
              )}
            </Button>
          </div>
        )}

        {isMessagesLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" aria-hidden="true" />
            <span className="text-xs">Đang tải lịch sử tin nhắn...</span>
          </div>
        ) : isMessagesError ? (
          <div className="p-6 text-center space-y-3 bg-white rounded-2xl border border-rose-100 max-w-sm mx-auto my-8">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" aria-hidden="true" />
            <p className="text-xs text-rose-700 font-medium">
              Không thể tải lịch sử tin nhắn.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchMessages()}
              className="text-xs h-7"
            >
              Thử lại
            </Button>
          </div>
        ) : chronologicalMessages.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Chưa có tin nhắn nào trong cuộc trò chuyện này
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Hãy gửi tin nhắn đầu tiên để trao đổi về món đồ nhé!
            </p>
          </div>
        ) : (
          chronologicalMessages.map((msg, idx) => {
            const isOwn = Boolean(user?.id && msg.sender.id === user.id);
            const prevMsg = chronologicalMessages[idx - 1];
            const nextMsg = chronologicalMessages[idx + 1];
            const isFirstOfGroup = !prevMsg || prevMsg.sender.id !== msg.sender.id;
            const isLastOfGroup = !nextMsg || nextMsg.sender.id !== msg.sender.id;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                showAvatar={isLastOfGroup}
                showSenderName={isFirstOfGroup}
              />
            );
          })
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Send Error Feedback Banner */}
      {sendError && (
        <div
          role="alert"
          className="mx-4 mb-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 animate-in fade-in"
        >
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
            <span>{sendError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Message Composer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="space-y-2"
        >
          <div className="relative flex items-end gap-2 border border-slate-200 rounded-xl p-2 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:bg-white transition-all">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (sendError) setSendError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              rows={1}
              maxLength={2000}
              className="flex-1 bg-transparent border-0 outline-none focus:ring-0 focus:outline-none focus:border-0 resize-none max-h-32 min-h-[38px] p-1.5 text-sm text-slate-900 placeholder:text-slate-400"
              aria-label="Nội dung tin nhắn"
            />

            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!content.trim() || sendMessageMutation.isPending}
              className="rounded-xl h-9 w-9 p-0 shrink-0 flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
              aria-label="Gửi tin nhắn"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between px-2 text-[10px] text-slate-400">
            <span>Enter để gửi · Shift+Enter để xuống dòng</span>
            <span
              className={cn(
                content.length > 1900 ? 'text-amber-600 font-bold' : ''
              )}
            >
              {content.length} / 2.000
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatWindow;
