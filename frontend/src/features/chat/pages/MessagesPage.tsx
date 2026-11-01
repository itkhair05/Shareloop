import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, ShieldCheck, HeartHandshake } from 'lucide-react';
import { ConversationList } from '../components/ConversationList';
import { ChatWindow } from '../components/ChatWindow';

export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  return (
    // Sử dụng h-[calc(100dvh-4rem)] để khung không bao giờ bị tràn ra ngoài màn hình
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[calc(100dvh-4rem)] flex flex-col">
      <div className="flex-1 py-4 sm:py-6 min-h-0">
        <div className="h-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex">
          {/* Left Column: Conversation List */}
          <div
            className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
              conversationId ? 'hidden md:flex' : 'flex'
            }`}
          >
            <ConversationList
              selectedConversationId={conversationId}
              onSelectConversation={(id) => navigate(`/messages/${id}`)}
              className="w-full h-full"
            />
          </div>

          {/* Right Column: Chat Window or Empty Placeholder */}
          <div
            className={`flex-1 h-full min-w-0 ${
              conversationId ? 'flex' : 'hidden md:flex'
            }`}
          >
            {conversationId ? (
              <ChatWindow
                key={conversationId}
                conversationId={conversationId}
                onBack={() => navigate('/messages')}
                className="w-full h-full"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
                  <MessageSquare className="w-8 h-8" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Hộp thư trao đổi ShareLoop
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                  Chọn một cuộc trò chuyện từ danh sách bên trái để xem nội dung và tiếp tục trao đổi với người dùng khác.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full text-left">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Lịch sự & An toàn</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Luôn giao tiếp tôn trọng, hẹn gặp tại nơi công cộng khi trao nhận đồ.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                      <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Hỗ trợ nhanh chóng</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Phản hồi kịp thời để người nhận hoặc người cho dễ dàng sắp xếp thời gian.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessagesPage;