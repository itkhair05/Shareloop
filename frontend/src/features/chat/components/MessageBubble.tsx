import type { ChatMessageResponse } from '@/types/chat';
import { formatDateTime, cn } from '@/lib/utils';
import { Avatar } from '@/components/common/Avatar';

export interface MessageBubbleProps {
  message: ChatMessageResponse;
  isOwn: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  showSenderName = true,
}: MessageBubbleProps) {
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
