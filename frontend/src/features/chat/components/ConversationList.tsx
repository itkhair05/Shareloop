import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useConversations } from '../hooks/use-chat';
import { formatDateTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/common/Avatar';

export interface ConversationListProps {
  selectedConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  className?: string;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
  className,
}: ConversationListProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { isAuthenticated } = useAuth();

  // Poll conversations every 15 seconds while active and authenticated
  const {
    data: conversationsPage,
    isLoading,
    isError,
    refetch,
  } = useConversations(
    { page, size: pageSize },
    { enabled: Boolean(isAuthenticated), refetchInterval: 15000 }
  );

  const conversations = conversationsPage?.content ?? [];
  const totalPages = conversationsPage?.totalPages ?? 0;
  const totalElements = conversationsPage?.totalElements ?? 0;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Tin nhắn</h1>
          </div>
          {totalElements > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {totalElements} hội thoại
            </span>
          )}
        </div>
      </div>

      {/* Conversation List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2.5">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" aria-hidden="true" />
            <span className="text-xs font-medium">Đang tải danh sách tin nhắn...</span>
          </div>
        ) : isError ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold text-slate-900">
              Không thể tải danh sách cuộc trò chuyện
            </p>
            <p className="text-[11px] text-slate-500">
              Đã có lỗi xảy ra. Vui lòng thử lại sau giây lát.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs h-7"
            >
              Thử lại
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">
              Bạn chưa có cuộc trò chuyện nào
            </h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Bạn có thể bắt đầu nhắn tin với người đăng bài từ bất kỳ món đồ nào trên trang Khám phá.
            </p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            const otherName = conversation.otherParticipant.displayName || 'Người dùng';

            return (
              <Link
                key={conversation.id}
                to={`/messages/${conversation.id}`}
                onClick={() => onSelectConversation?.(conversation.id)}
                className={cn(
                  'flex items-start gap-3 p-3.5 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 hover:bg-slate-50',
                  isSelected
                    ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600 text-slate-900'
                    : 'bg-white text-slate-700'
                )}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`Cuộc trò chuyện với ${otherName} về ${conversation.listing.title}`}
              >
                {/* Participant Avatar */}
                <Avatar
                  avatarUrl={conversation.otherParticipant.avatarUrl}
                  name={otherName}
                  size="md"
                  alt={`Ảnh đại diện của ${otherName}`}
                  className={cn(
                    'shrink-0 shadow-xs',
                    isSelected && 'ring-2 ring-emerald-600 ring-offset-1'
                  )}
                />

                {/* Content details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={cn(
                        'text-xs leading-none truncate',
                        isSelected ? 'font-bold text-slate-950' : 'font-semibold text-slate-900'
                      )}
                    >
                      {otherName}
                    </span>
                    {conversation.lastMessageAt && (
                      <time
                        dateTime={conversation.lastMessageAt}
                        className="text-[10px] text-slate-400 whitespace-nowrap shrink-0"
                      >
                        {formatDateTime(conversation.lastMessageAt)}
                      </time>
                    )}
                  </div>

                  {/* Listing context pill */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                    <Package className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">{conversation.listing.title}</span>
                  </div>

                  {/* Last message preview */}
                  <p
                    className={cn(
                      'text-xs truncate',
                      conversation.lastMessagePreview
                        ? isSelected
                          ? 'text-slate-800'
                          : 'text-slate-600'
                        : 'text-slate-400 italic'
                    )}
                  >
                    {conversation.lastMessagePreview || 'Chưa có tin nhắn nào'}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination Footer if multiple pages */}
      {totalPages > 1 && (
        <div className="p-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <span>
            Trang {page + 1} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="h-7 px-2"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
              className="h-7 px-2"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationList;
