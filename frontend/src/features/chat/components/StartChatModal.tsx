import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, X, Loader2, AlertCircle, Send } from 'lucide-react';
import { useGetOrCreateConversation } from '../hooks/use-chat';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface StartChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  ownerName: string;
  listingRequestId?: string | null;
}

export function StartChatModal({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  ownerName,
  listingRequestId,
}: StartChatModalProps) {
  const navigate = useNavigate();
  const [initialMessage, setInitialMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const getOrCreateMutation = useGetOrCreateConversation();

  const handleClose = useCallback(() => {
    if (getOrCreateMutation.isPending) return;
    setInitialMessage('');
    setErrorMessage(null);
    onClose();
  }, [getOrCreateMutation.isPending, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !getOrCreateMutation.isPending) {
        handleClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, getOrCreateMutation.isPending, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getOrCreateMutation.isPending) return;

    const trimmed = initialMessage.trim();
    if (trimmed.length > 2000) {
      setErrorMessage('Tin nhắn không được vượt quá 2.000 ký tự.');
      return;
    }

    setErrorMessage(null);

    try {
      const conversation = await getOrCreateMutation.mutateAsync({
        listingId,
        payload: {
          initialMessage: trimmed ? trimmed : null,
          listingRequestId: listingRequestId || null,
        },
      });

      onClose();
      navigate(`/messages/${conversation.id}`);
    } catch {
      setErrorMessage('Không thể bắt đầu cuộc trò chuyện. Vui lòng thử lại sau.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-chat-title"
    >
      {/* Backdrop click dismiss */}
      <div
        className="fixed inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="start-chat-title" className="text-base font-bold text-slate-900">
                Nhắn tin cho người đăng
              </h2>
              <p className="text-xs text-slate-500">
                Trò chuyện với {ownerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={getOrCreateMutation.isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Listing summary context */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-slate-700 space-y-1">
            <span className="font-semibold text-emerald-900">Bài đăng liên quan:</span>
            <p className="font-medium text-slate-900 truncate">{listingTitle}</p>
          </div>

          {/* Initial Message Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="initial-message-input"
              className="block text-xs font-semibold text-slate-800"
            >
              Tin nhắn đầu tiên (không bắt buộc)
            </label>
            <textarea
              id="initial-message-input"
              rows={4}
              maxLength={2000}
              value={initialMessage}
              onChange={(e) => {
                setInitialMessage(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Xin chào, tôi quan tâm đến món đồ này..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all placeholder:text-slate-400 text-slate-900 resize-none"
            />
            <div className="flex justify-end text-[11px] text-slate-400">
              <span className={cn(initialMessage.length > 1900 ? 'text-amber-600 font-bold' : '')}>
                {initialMessage.length} / 2.000 ký tự
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={getOrCreateMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={getOrCreateMutation.isPending}
              className="flex flex-row items-center justify-center gap-2 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5"
            >
              {getOrCreateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang kết nối...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Bắt đầu trò chuyện</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StartChatModal;
