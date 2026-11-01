import { AlertCircle, Loader2 } from 'lucide-react';
import type { ChatMessageResponse } from '@/types/chat';
import { formatDateTime, cn } from '@/lib/utils';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/Button';
import {
  useChatImage,
  type ChatImageErrorKind,
} from '../hooks/use-chat-image';

export interface MessageBubbleProps {
  message: ChatMessageResponse;
  isOwn: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
}

function getChatImageErrorMessage(errorKind: ChatImageErrorKind): string {
  switch (errorKind) {
    case 'forbidden':
      return 'Bạn không có quyền xem ảnh này.';
    case 'unavailable':
      return 'Ảnh không còn khả dụng.';
    case 'unauthorized':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 'network':
      return 'Không thể tải ảnh. Kiểm tra kết nối và thử lại.';
    case 'invalid':
      return 'Ảnh không hợp lệ hoặc không thể hiển thị.';
    case 'session':
      return 'Phiên làm việc đã thay đổi. Vui lòng thử lại.';
    default:
      return 'Không thể tải ảnh. Vui lòng thử lại.';
  }
}

function ChatImageContent({
  imageUrl,
  senderName,
}: {
  imageUrl: string;
  senderName: string;
}) {
  const { status, objectUrl, errorKind, canRetry, retry } = useChatImage(imageUrl);

  if (status === 'ready' && objectUrl) {
    return (
      <img
        src={objectUrl}
        alt={`Ảnh đính kèm từ ${senderName}`}
        className="block h-auto max-h-[320px] w-auto max-w-full bg-slate-100 object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (status === 'error' && errorKind) {
    return (
      <div
        role="alert"
        className="flex w-[220px] max-w-full flex-col items-center justify-center gap-2 bg-slate-50 px-4 py-5 text-center sm:w-[260px]"
      >
        <AlertCircle className="h-5 w-5 text-rose-500" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          {getChatImageErrorMessage(errorKind)}
        </p>
        {canRetry && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={retry}
            className="text-emerald-700 hover:bg-emerald-50"
          >
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex h-[160px] w-[220px] max-w-full items-center justify-center gap-2 bg-slate-100 px-4 text-slate-500 sm:h-[180px] sm:w-[260px]"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span className="text-xs">Đang tải ảnh...</span>
    </div>
  );
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  showSenderName = true,
}: MessageBubbleProps) {
  const imageUrl = message.imageUrl?.trim() || null;
  const hasImage = imageUrl !== null;
  const hasCaption = Boolean(message.content && message.content.trim().length > 0);

  return (
    <div
      className={cn(
        'flex items-end gap-2.5 transition-opacity',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      data-message-id={message.id}
    >
      {!isOwn && (
        showAvatar ? (
          <Avatar
            avatarUrl={message.sender.avatarUrl}
            name={message.sender.displayName}
            size="sm"
            alt={`Ảnh đại diện của ${message.sender.displayName}`}
            title={message.sender.displayName}
            className="shadow-xs shrink-0"
          />
        ) : (
          <div className="w-8 h-8 shrink-0" aria-hidden="true" />
        )
      )}

      <div
        className={cn(
          'flex flex-col max-w-[85%] sm:max-w-[70%]',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {!isOwn && showSenderName && (
          <span className="text-[11px] font-semibold text-slate-500 mb-1 ml-1 truncate max-w-[200px]">
            {message.sender.displayName}
          </span>
        )}

        {hasImage ? (
          <div
            className={cn(
              'w-fit max-w-[min(320px,100%)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs',
              isOwn ? 'rounded-br-xs' : 'rounded-bl-xs'
            )}
          >
            <ChatImageContent
              imageUrl={imageUrl}
              senderName={message.sender.displayName}
            />
            {hasCaption && (
              <p className="px-3 pt-2 pb-2.5 text-sm leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'px-4 py-2.5 rounded-2xl shadow-xs break-words text-sm leading-relaxed whitespace-pre-wrap',
              isOwn
                ? 'bg-emerald-600 text-white rounded-br-xs'
                : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs'
            )}
          >
            {message.content}
          </div>
        )}

        <time
          dateTime={message.createdAt}
          className={cn(
            'text-[10px] mt-1 px-1',
            isOwn ? 'text-slate-400' : 'text-slate-400'
          )}
        >
          {formatDateTime(message.createdAt)}
        </time>
      </div>
    </div>
  );
}

export default MessageBubble;
