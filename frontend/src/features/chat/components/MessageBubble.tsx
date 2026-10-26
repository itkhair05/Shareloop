import type { ChatMessageResponse } from '@/types/chat';
import { formatDateTime, cn } from '@/lib/utils';
import { User } from 'lucide-react';

export interface MessageBubbleProps {
  message: ChatMessageResponse;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderInitial = message.sender.displayName?.charAt(0).toUpperCase() || 'U';

  return (
    <div
      className={cn(
        'flex items-end gap-2.5 transition-opacity',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      data-message-id={message.id}
    >
      {!isOwn && (
        <div
          className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 border border-slate-300 shadow-xs"
          title={message.sender.displayName}
          aria-hidden="true"
        >
          {senderInitial || <User className="w-4 h-4" />}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col max-w-[85%] sm:max-w-[70%]',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {!isOwn && (
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
