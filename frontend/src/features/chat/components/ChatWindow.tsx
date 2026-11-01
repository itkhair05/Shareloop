import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Package,
  ExternalLink,
  MessageSquare,
  ImagePlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import {
  useConversationDetails,
  useMessages,
  useSendMessage,
} from '../hooks/use-chat';
import {
  useImageAttachment,
  type ChatImageSelection,
} from '../hooks/use-image-attachment';
import { chatApi, chatKeys } from '../api/chat-api';
import { ChatImageLightboxProvider } from './ChatImageLightboxProvider';
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

const CHAT_IMAGE_URL_PREFIX = '/api/v1/chat-images/';

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface FailureShape {
  status?: number;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  response?: { status?: number };
}

function getFailureStatus(error: unknown): number | undefined {
  const failure = error as FailureShape;
  if (typeof failure?.status === 'number') return failure.status;
  return failure?.response?.status;
}

function isAmbiguousFailure(error: unknown): boolean {
  const failure = error as FailureShape;
  if (failure?.isNetworkError || failure?.isTimeout) return true;
  const status = getFailureStatus(error);
  return status === 0 || status === 408;
}

async function hasSentChatImage(conversationId: string, imageId: string): Promise<boolean> {
  try {
    const page = await chatApi.getMessageHistory(conversationId, { page: 0, size: 50 });
    const expectedUrl = `${CHAT_IMAGE_URL_PREFIX}${imageId}`;
    return page.content.some((message) => message.imageUrl === expectedUrl);
  } catch {
    return false;
  }
}

function getImageUploadErrorMessage(error: unknown): string {
  if (isAmbiguousFailure(error)) {
    return 'Không thể kết nối với máy chủ nên ảnh chưa được tải lên. Ảnh và chú thích vẫn được giữ. Vui lòng thử lại.';
  }
  const status = getFailureStatus(error);
  if (status === 400) {
    return 'Ảnh không hợp lệ hoặc không được hỗ trợ. Vui lòng chọn ảnh JPEG hoặc PNG khác.';
  }
  if (status === 401 || status === 403) {
    return 'Bạn không có quyền tải ảnh lên. Vui lòng đăng nhập lại hoặc liên hệ Ban quản trị.';
  }
  if (status === 413) {
    return 'Ảnh vượt quá dung lượng cho phép (5 MB). Vui lòng chọn ảnh nhỏ hơn.';
  }
  if (status && status >= 500) {
    return `Không thể tải ảnh lên do lỗi hệ thống (mã ${status}). Vui lòng thử lại sau.`;
  }
  return 'Không thể tải ảnh lên. Vui lòng thử lại.';
}

function getImageMessageErrorMessage(error: unknown): string {
  if (isAmbiguousFailure(error)) {
    return 'Không thể xác nhận kết nối với máy chủ. Tin nhắn ảnh có thể đã được gửi hoặc chưa. Ảnh và chú thích vẫn được giữ; vui lòng kiểm tra lịch sử trò chuyện trước khi gửi lại.';
  }
  const status = getFailureStatus(error);
  if (status === 400) {
    return 'Không thể gửi ảnh. Ảnh có thể đã được sử dụng trong một tin nhắn khác hoặc chú thích không hợp lệ.';
  }
  if (status === 401 || status === 403) {
    return 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này.';
  }
  if (status === 404) {
    return 'Cuộc trò chuyện này không còn tồn tại.';
  }
  if (status === 429) {
    return 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ trong giây lát rồi thử lại.';
  }
  if (status && status >= 500) {
    return `Không thể gửi tin nhắn do lỗi hệ thống (mã ${status}). Ảnh và chú thích vẫn được giữ. Vui lòng thử lại sau.`;
  }
  return 'Không thể gửi tin nhắn ảnh. Ảnh và chú thích vẫn được giữ. Vui lòng thử lại.';
}

export function ChatWindow({ conversationId, onBack, className }: ChatWindowProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [olderMessages, setOlderMessages] = useState<ChatMessageResponse[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [currentOlderPage, setCurrentOlderPage] = useState(0);
  const {
    inputRef: imageInputRef,
    selection: selectedImage,
    error: imageError,
    handleInputChange: handleImageInputChange,
    openPicker: openImagePicker,
    removeSelectedImage,
  } = useImageAttachment();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScrollRef = useRef(true);
  // Synchronous guard: React state alone can lag behind rapid Enter/submit events.
  const isSubmittingRef = useRef(false);
  // Keeps a successfully uploaded CHAT file ID so a failed message submission
  // can retry without uploading the same image again.
  const pendingUploadRef = useRef<{ file: File; imageId: string } | null>(null);

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
  const isSendingMessage = sendMessageMutation.isPending;
  const isComposerBusy = isUploadingImage || isSendingMessage;

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

  // Cuộn khung chat xuống đáy — chỉ tác động lên scrollContainer, không cuộn body/trang
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Determine whether the user is near the bottom of the scroll container
  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 120; // 120px threshold
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  // 1. Reset trạng thái khi đổi cuộc hội thoại
  useEffect(() => {
    // Khi đổi hội thoại, bật lại cờ initial scroll để nó tự động cuộn xuống đáy
    isInitialScrollRef.current = true;

    // Xóa sạch các state cũ để tránh bị lẫn dữ liệu giữa 2 cuộc hội thoại
    setOlderMessages([]);
    setCurrentOlderPage(0);
    setSendError(null);
    setSuccessNotice(null);
    setContent('');
    removeSelectedImage();
    pendingUploadRef.current = null;
  }, [conversationId, removeSelectedImage]);

  // 2. Quản lý Auto-scroll — dùng scrollTo trên container, KHÔNG dùng scrollIntoView
  useEffect(() => {
    if (chronologicalMessages.length === 0) return;

    // Nếu là lần đầu load (hoặc vừa đổi hội thoại): cuộn ngay xuống đáy
    if (isInitialScrollRef.current) {
      const timer = setTimeout(() => {
        scrollToBottom('auto');
        isInitialScrollRef.current = false;
      }, 0);
      return () => clearTimeout(timer);
    }

    // Nếu không phải lần đầu, chỉ cuộn nếu người dùng đang ở gần cuối
    if (isNearBottom()) {
      scrollToBottom('smooth');
    }
  }, [chronologicalMessages.length, conversationId]);

  const invalidateConversationQueries = () => {
    queryClient.invalidateQueries({
      queryKey: [...chatKeys.messages(), conversationId],
    });
    queryClient.invalidateQueries({
      queryKey: chatKeys.conversationDetail(conversationId),
    });
    queryClient.invalidateQueries({
      queryKey: chatKeys.conversations(),
    });
  };

  const finalizeImageSend = () => {
    pendingUploadRef.current = null;
    removeSelectedImage();
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }
    setSendError(null);
    setSuccessNotice('Đã gửi ảnh thành công.');
    scrollToBottom('smooth');
  };

  const sendTextMessage = async (trimmed: string) => {
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
      scrollToBottom('smooth');
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

  const sendImageMessage = async (attachment: ChatImageSelection, caption: string) => {
    const cached = pendingUploadRef.current;
    let imageId = cached?.file === attachment.file ? cached.imageId : null;

    if (!imageId) {
      setIsUploadingImage(true);
      try {
        const uploaded = await chatApi.uploadChatImage(attachment.file);
        if (!isValidUuid(uploaded.id)) {
          throw new Error('Uploaded file response is missing a valid id');
        }
        imageId = uploaded.id;
        pendingUploadRef.current = { file: attachment.file, imageId };
      } catch (error) {
        setSendError(getImageUploadErrorMessage(error));
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    if (!imageId) return;

    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        payload: caption ? { content: caption, imageId } : { imageId },
      });
      finalizeImageSend();
    } catch (error) {
      const status = getFailureStatus(error);
      const ambiguous = isAmbiguousFailure(error);

      // A lost response or an "already attached" rejection may mean a previous
      // attempt actually committed. Reconcile against history before reporting
      // failure, so we never blind-retry an already-bound file ID.
      if (ambiguous || status === 400) {
        const alreadySent = await hasSentChatImage(conversationId, imageId);
        if (alreadySent) {
          invalidateConversationQueries();
          finalizeImageSend();
          return;
        }
      }

      if (ambiguous) {
        refetchMessages();
        refetchConversation();
      }
      setSendError(getImageMessageErrorMessage(error));
    }
  };

  const handleSend = async () => {
    // Synchronous re-entry guard: covers Enter key repeats and duplicate submits.
    if (isSubmittingRef.current || isComposerBusy) return;

    const trimmed = content.trim();
    if (!trimmed && !selectedImage) {
      return;
    }

    if (trimmed.length > 2000) {
      setSendError('Tin nhắn không được vượt quá 2.000 ký tự.');
      return;
    }

    isSubmittingRef.current = true;
    setSendError(null);
    setSuccessNotice(null);

    try {
      if (selectedImage) {
        await sendImageMessage(selectedImage, trimmed);
      } else {
        await sendTextMessage(trimmed);
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessNotice(null);
    // A different file invalidates any previously uploaded chat file ID.
    pendingUploadRef.current = null;
    handleImageInputChange(event);
  };

  const handleRemoveImage = () => {
    setSuccessNotice(null);
    pendingUploadRef.current = null;
    removeSelectedImage();
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

  const chatWindowContent = (
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

      {/* Messages Scroll Area — overscroll-contain ngăn scroll chaining ra body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
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
          {selectedImage && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2">
              <img
                src={selectedImage.previewUrl}
                alt="Xem trước ảnh đính kèm"
                className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-lg object-cover border border-white shadow-2xs"
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-semibold text-slate-800 truncate"
                  title={selectedImage.file.name}
                >
                  {selectedImage.file.name}
                </p>
                <p className="text-[11px] text-slate-500" aria-live="polite">
                  {isUploadingImage
                    ? 'Đang tải ảnh lên...'
                    : isSendingMessage
                      ? 'Đang gửi tin nhắn ảnh...'
                      : `${formatFileSize(selectedImage.file.size)} · Ảnh đã chọn`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={isComposerBusy}
                className="p-1.5 shrink-0 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Xóa ảnh đính kèm"
                title="Xóa ảnh đính kèm"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="relative flex items-end gap-2 border border-slate-200 rounded-xl p-2 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:bg-white transition-all">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleImageSelection}
              disabled={isComposerBusy}
              className="hidden"
              aria-label="Chọn ảnh đính kèm"
            />

            <button
              type="button"
              onClick={openImagePicker}
              disabled={isComposerBusy}
              className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Đính kèm ảnh"
              title="Đính kèm ảnh"
            >
              <ImagePlus className="w-4 h-4" aria-hidden="true" />
            </button>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (sendError) setSendError(null);
                if (successNotice) setSuccessNotice(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={Boolean(selectedImage) && isComposerBusy}
              placeholder={
                selectedImage
                  ? 'Thêm chú thích cho ảnh (không bắt buộc)...'
                  : 'Nhập tin nhắn...'
              }
              rows={1}
              maxLength={2000}
              className="flex-1 bg-transparent border-0 outline-none focus:ring-0 focus:outline-none focus:border-0 resize-none max-h-32 min-h-[38px] p-1.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Nội dung tin nhắn"
            />

            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={(!content.trim() && !selectedImage) || isComposerBusy}
              className="rounded-xl h-9 w-9 p-0 shrink-0 flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
              aria-label="Gửi tin nhắn"
            >
              {isComposerBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {imageError && (
            <p
              role="alert"
              className="flex items-center gap-1.5 px-1 text-xs font-medium text-rose-700"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" aria-hidden="true" />
              <span>{imageError}</span>
            </p>
          )}

          {successNotice && (
            <p
              role="status"
              className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-emerald-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{successNotice}</span>
            </p>
          )}

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

  return (
    <ChatImageLightboxProvider>{chatWindowContent}</ChatImageLightboxProvider>
  );
}

export default ChatWindow;