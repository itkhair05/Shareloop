import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  BookOpen,
  ShieldCheck,
  HeartHandshake,
  MessageSquare,
  Star,
  ArrowRight,
  Compass,
  Plus,
  User,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Package,
  LifeBuoy,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth';
import { CreateSupportRequestModal } from '@/features/support';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_CATEGORIES = [
  'Tất cả',
  'Tài khoản & hồ sơ',
  'Tin đăng',
  'Yêu cầu trao đổi',
  'Nhắn tin & giao dịch',
  'Đánh giá & uy tín',
  'An toàn cộng đồng',
] as const;

type FAQCategory = (typeof FAQ_CATEGORIES)[number];

const FAQ_DATA: FAQItem[] = [
  {
    id: 'faq-profile-edit',
    category: 'Tài khoản & hồ sơ',
    question: 'Làm cách nào để cập nhật thông tin cá nhân trên ShareLoop?',
    answer:
      'Bạn hãy đăng nhập và truy cập trang Hồ sơ cá nhân (/profile), sau đó bấm nút "Chỉnh sửa hồ sơ". Tại đây, bạn có thể thay đổi Tên hiển thị (2 - 50 ký tự) và Số điện thoại liên lạc (10 - 15 số). Lưu ý rằng địa chỉ Email đăng ký được cố định làm tài khoản định danh bảo mật và không thể thay đổi.',
  },
  {
    id: 'faq-profile-public',
    category: 'Tài khoản & hồ sơ',
    question: 'Hồ sơ công khai của tôi hiển thị những thông tin gì với người khác?',
    answer:
      'Khi thành viên khác xem trang cá nhân công khai của bạn (/users/:id), họ chỉ thấy Tên hiển thị, vai trò thành viên, ngày gia nhập, tổng điểm đánh giá uy tín và danh sách các tin đăng đang mở (ACTIVE). Địa chỉ email và số điện thoại cá nhân của bạn được bảo mật tuyệt đối, không bao giờ lộ trên trang công khai.',
  },
  {
    id: 'faq-listing-types',
    category: 'Tin đăng',
    question: 'ShareLoop hỗ trợ những hình thức đăng tin nào?',
    answer:
      'Nền tảng hỗ trợ 4 loại tin đăng: Tặng miễn phí (GIVEAWAY) dành cho đồ dùng muốn tặng người cần; Trao đổi (EXCHANGE) để đổi lấy vật phẩm khác; Cần tìm/xin (WANTED) khi bạn cần trợ giúp một món đồ cụ thể; và Bán lại rẻ (SALE) với giá tượng trưng tính bằng VNĐ.',
  },
  {
    id: 'faq-listing-manage',
    category: 'Tin đăng',
    question: 'Làm cách nào để chỉnh sửa hoặc kiểm tra tin đăng của tôi?',
    answer:
      'Truy cập mục "Bài đăng của tôi" (/my-listings) từ thanh điều hướng. Bạn có thể lọc danh sách theo trạng thái (Tất cả, Đang hiển thị, Đang giữ chỗ, Đã hoàn thành), bấm vào từng tin để chỉnh sửa thông tin, cập nhật hình ảnh hoặc theo dõi các yêu cầu nhận đồ gửi đến.',
  },
  {
    id: 'faq-request-send',
    category: 'Yêu cầu trao đổi',
    question: 'Làm thế nào để gửi yêu cầu nhận hoặc trao đổi một món đồ?',
    answer:
      'Khi xem chi tiết món đồ (/listings/:id), bạn bấm nút "Gửi yêu cầu nhận món đồ". Một biểu mẫu sẽ mở ra để bạn nhập lời nhắn gửi đến chủ tin (giải thích lý do cần nhận đồ hoặc phương án trao đổi) cùng số điện thoại và địa chỉ nhận để tiện liên hệ.',
  },
  {
    id: 'faq-request-process',
    category: 'Yêu cầu trao đổi',
    question: 'Quy trình duyệt yêu cầu diễn ra như thế nào?',
    answer:
      'Chủ tin đăng sẽ nhận thông báo khi có yêu cầu mới. Trong phần quản lý yêu cầu của tin đăng, chủ tin có thể xem danh sách và bấm "Chấp nhận" người phù hợp nhất. Khi một yêu cầu được chấp nhận, tin đăng tự động chuyển sang trạng thái "Đang giữ chỗ" (RESERVED) và hệ thống tạo ngay một giao dịch trao đổi giữa hai bên. Các yêu cầu khác sẽ tạm khóa để tránh trùng lặp.',
  },
  {
    id: 'faq-chat-feature',
    category: 'Nhắn tin & giao dịch',
    question: 'Tôi có thể trò chuyện trực tiếp với đối tác trao đổi không?',
    answer:
      'Hoàn toàn được. Bạn có thể bấm "Nhắn tin cho người đăng" ngay trên trang chi tiết món đồ hoặc truy cập trang "Tin nhắn" (/messages) để trao đổi chi tiết về tình trạng món đồ, hẹn lịch gặp mặt và thống nhất địa điểm giao nhận thuận lợi cho cả hai bên.',
  },
  {
    id: 'faq-transaction-finish',
    category: 'Nhắn tin & giao dịch',
    question: 'Làm thế nào để xác nhận hoàn tất một giao dịch trao đổi?',
    answer:
      'Sau khi hai bên đã gặp mặt trực tiếp, bàn giao đồ và kiểm tra hài lòng, chủ tin đăng sẽ truy cập mục "Giao dịch" (/transactions) và bấm nút "Xác nhận hoàn tất giao dịch". Ngay sau đó, tin đăng sẽ chuyển sang trạng thái "Đã xong" (COMPLETED).',
  },
  {
    id: 'faq-reviews-when',
    category: 'Đánh giá & uy tín',
    question: 'Khi nào tôi có thể viết đánh giá cho người dùng khác?',
    answer:
      'Tính năng đánh giá chỉ mở ra sau khi giao dịch giữa hai bên đã được "Xác nhận hoàn tất". Bạn có thể đánh giá đối tác từ 1 đến 5 sao kèm nhận xét phản hồi thực tế. Hệ thống ngăn chặn việc đánh giá trùng lặp trên cùng một giao dịch để đảm bảo tính khách quan.',
  },
  {
    id: 'faq-reviews-score',
    category: 'Đánh giá & uy tín',
    question: 'Điểm uy tín cộng đồng được tính như thế nào?',
    answer:
      'Điểm uy tín là trung bình cộng số sao từ tất cả các đánh giá hoàn tất mà bạn nhận được. Điểm số này cùng số lượt đánh giá và biểu đồ phân bổ mức sao được hiển thị công khai trên hồ sơ của bạn, giúp xây dựng sự tin cậy trong cộng đồng.',
  },
  {
    id: 'faq-safety-meeting',
    category: 'An toàn cộng đồng',
    question: 'Tôi nên chuẩn bị gì khi hẹn gặp nhận đồ trực tiếp?',
    answer:
      'Luôn ưu tiên hẹn gặp vào ban ngày tại các địa điểm công cộng đông người qua lại (quán cà phê, sảnh chung cư, cổng trường học hoặc cửa hàng tiện lợi). Hãy đi cùng người thân nếu có thể, kiểm tra kỹ món đồ trước khi nhận và tuyệt đối không bao giờ chuyển tiền cọc trước cho các tin tặng miễn phí.',
  },
  {
    id: 'faq-safety-reporting',
    category: 'An toàn cộng đồng',
    question: 'ShareLoop có tính năng báo cáo hoặc chặn người dùng khả nghi không?',
    answer:
      'Hiện tại ShareLoop chưa có tính năng tự động báo cáo hoặc chặn tài khoản trực tiếp trong hệ thống. Nếu gặp người dùng có hành vi gian lận, khiếm nhã hoặc yêu cầu tài chính bất thường, bạn hãy chủ động từ chối yêu cầu, hủy giao dịch và dừng mọi cuộc trò chuyện ngay lập tức. Tuyệt đối không chia sẻ mã OTP, thông tin thẻ hay mật khẩu cá nhân.',
  },
];

const HOW_TO_STEPS = [
  {
    step: '01',
    title: 'Đăng tin hoặc Tìm kiếm',
    description:
      'Chụp ảnh món đồ bạn không còn dùng đến và đăng lên hệ thống (/listings/new), hoặc dạo tìm món đồ bạn đang cần trên trang Khám phá (/explore).',
    icon: Package,
    color: 'emerald',
  },
  {
    step: '02',
    title: 'Gửi & Tiếp nhận yêu cầu',
    description:
      'Người cần gửi lời nhắn lịch sự giới thiệu mục đích sử dụng. Chủ tin xem danh sách và bấm "Chấp nhận" để giữ chỗ cho người phù hợp.',
    icon: HeartHandshake,
    color: 'blue',
  },
  {
    step: '03',
    title: 'Nhắn tin & Hẹn gặp nhận đồ',
    description:
      'Hai bên trao đổi qua hộp thư trò chuyện (/messages) để thống nhất điểm hẹn công cộng. Gặp mặt kiểm tra đồ và bấm xác nhận hoàn tất giao dịch.',
    icon: MessageSquare,
    color: 'teal',
  },
  {
    step: '04',
    title: 'Đánh giá & Xây dựng uy tín',
    description:
      'Gửi phản hồi và số sao chân thật sau khi hoàn thành trao đổi. Điểm đánh giá giúp lan tỏa lối sống xanh và sự tin cậy trong cộng đồng.',
    icon: Star,
    color: 'amber',
  },
];

const COMMUNITY_GUIDELINES = [
  {
    title: 'Giao tiếp văn minh & Đúng hẹn',
    description:
      'Gửi lời nhắn chân thành, lịch sự khi xin đồ. Luôn giữ đúng giờ hẹn gặp và chủ động thông báo sớm nếu có việc đột xuất.',
    icon: HeartHandshake,
  },
  {
    title: 'Mô tả trung thực & Ảnh chụp rõ ràng',
    description:
      'Chụp ảnh thật của món đồ và mô tả chân thực tình trạng sử dụng (mới, cũ, có vết xước hoặc thiếu phụ kiện) để người nhận nắm rõ.',
    icon: BookOpen,
  },
  {
    title: 'Gặp gỡ an toàn tại nơi công cộng',
    description:
      'Chỉ hẹn giao nhận đồ tại nơi công cộng, nhiều ánh sáng và có người qua lại như quán cà phê, cửa hàng tiện lợi, nhà văn hóa.',
    icon: ShieldCheck,
  },
  {
    title: 'Cảnh giác lừa đảo & Không chuyển cọc',
    description:
      'Tuyệt đối không chuyển tiền cọc hoặc thanh toán phí gửi trước cho đồ tặng miễn phí (GIVEAWAY). Không cung cấp mã OTP hay thông tin thẻ ngân hàng.',
    icon: AlertTriangle,
  },
];

export function AboutPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory>('Tất cả');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'faq-profile-edit': true, // Expand first FAQ by default
  });
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Trung tâm trợ giúp | ShareLoop';
  }, []);

  const handleOpenSupport = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/about' } } });
      return;
    }
    setIsSupportModalOpen(true);
  };

  const toggleAccordion = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return FAQ_DATA.filter((faq) => {
      // Category filter
      if (selectedCategory !== 'Tất cả' && faq.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (!query) return true;

      const questionMatch = faq.question.toLowerCase().includes(query);
      const answerMatch = faq.answer.toLowerCase().includes(query);
      const categoryMatch = faq.category.toLowerCase().includes(query);

      return questionMatch || answerMatch || categoryMatch;
    });
  }, [searchQuery, selectedCategory]);

  const handleResetSearch = () => {
    setSearchQuery('');
    setSelectedCategory('Tất cả');
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-12">
      {/* SECTION A: Hero & Search */}
      <section
        aria-labelledby="help-center-heading"
        className="text-center rounded-3xl bg-gradient-to-b from-emerald-50/70 via-white to-white border border-emerald-100/60 p-8 sm:p-12 shadow-xs"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Hướng dẫn & Giải đáp thắc mắc</span>
        </div>

        <h1
          id="help-center-heading"
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
        >
          Trung tâm trợ giúp
        </h1>

        <p className="text-base sm:text-lg text-slate-600 mt-4 max-w-2xl mx-auto leading-relaxed">
          Tìm hiểu cách đăng tin, gửi yêu cầu trao đổi, nhận đồ và các quy tắc giữ an toàn khi tham
          gia cộng đồng ShareLoop.
        </p>

        {/* Live Search Input */}
        <div className="mt-8 max-w-xl mx-auto relative">
          <label htmlFor="faq-search" className="sr-only">
            Tìm kiếm câu hỏi trợ giúp
          </label>
          <div className="relative flex items-center">
            <Search
              className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="faq-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Bạn đang cần tìm câu trả lời nào? (Ví dụ: đăng tin, đánh giá, an toàn...)"
              className="w-full pl-12 pr-10 py-3.5 bg-white rounded-2xl border border-slate-300 text-slate-900 placeholder-slate-400 text-sm sm:text-base shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 text-xs font-medium cursor-pointer"
                aria-label="Xóa nội dung tìm kiếm"
              >
                Xóa
              </button>
            )}
          </div>

          {searchQuery && (
            <p className="text-xs text-slate-500 mt-2 text-left px-1">
              Tìm thấy <strong className="text-emerald-700">{filteredFaqs.length}</strong> kết quả
              phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;
            </p>
          )}
        </div>
      </section>

      {/* SECTION B: Frequently Asked Questions (FAQ) */}
      <section aria-labelledby="faq-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="faq-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
              Câu hỏi thường gặp (FAQ)
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Câu trả lời chi tiết cho các thao tác và thắc mắc phổ biến nhất trên ShareLoop.
            </p>
          </div>

          {/* Category Filter Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1 sm:pt-0">
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List or Empty State */}
        {filteredFaqs.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                Không tìm thấy câu hỏi phù hợp
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Không có câu trả lời nào khớp với từ khóa &ldquo;{searchQuery}&rdquo; trong danh mục{' '}
                {selectedCategory !== 'Tất cả' ? `"${selectedCategory}"` : 'được chọn'}.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSearch}
              leftIcon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
            >
              Đặt lại bộ lọc
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isExpanded = !!expandedIds[faq.id];
              const buttonId = `faq-btn-${faq.id}`;
              const regionId = `faq-region-${faq.id}`;

              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-200 hover:border-slate-300"
                >
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isExpanded}
                    aria-controls={regionId}
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full px-5 py-4 text-left flex items-start sm:items-center justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
                  >
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {faq.category}
                      </span>
                      <h3 className="text-base font-semibold text-slate-900">{faq.question}</h3>
                    </div>
                    <span
                      className={cn(
                        'p-1.5 rounded-lg text-slate-400 transition-transform duration-200 shrink-0 mt-1 sm:mt-0',
                        isExpanded ? 'rotate-180 text-emerald-600 bg-emerald-50' : 'bg-slate-50'
                      )}
                    >
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </button>

                  {isExpanded && (
                    <div
                      id={regionId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40"
                    >
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION C: Step-by-Step How-To Guides */}
      <section aria-labelledby="how-to-heading" className="space-y-6">
        <div>
          <h2 id="how-to-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
            Quy trình trao đổi trên ShareLoop
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            4 bước cơ bản để bạn tự tin chia sẻ hoặc nhận đồ dùng an toàn, thuận tiện.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HOW_TO_STEPS.map((item) => (
            <Card key={item.step} className="border-slate-200 relative overflow-hidden bg-white">
              <div className="absolute top-3 right-4 text-2xl font-black text-slate-100 select-none">
                {item.step}
              </div>
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <CardTitle className="text-base text-slate-900">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* SECTION D: Community Guidelines & Safety */}
      <section aria-labelledby="guidelines-heading" className="space-y-6">
        <div>
          <h2 id="guidelines-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
            Quy tắc cộng đồng & An toàn giao dịch
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cùng nhau xây dựng một không gian sẻ chia văn minh, trung thực và an toàn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {COMMUNITY_GUIDELINES.map((guide) => (
            <div
              key={guide.title}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <guide.icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">{guide.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{guide.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Safety & Moderation Reporting Guidance */}
        <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="text-sm leading-relaxed space-y-1">
            <strong className="font-semibold text-emerald-950">Lưu ý quan trọng về an toàn:</strong>
            <p>
              Hệ thống ShareLoop hiện chưa có tính năng tự động chặn tài khoản. Nếu phát hiện dấu hiệu lừa đảo, quấy rối hoặc vi phạm, bạn hãy bấm{' '}
              <strong>&ldquo;Báo cáo vi phạm&rdquo;</strong> trực tiếp trên tin đăng, tài khoản hoặc giao dịch để Ban quản trị nhanh chóng tiếp nhận và điều tra xử lý.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION E: Direct Admin Support Request Entry Point */}
      <section
        aria-labelledby="contact-support-heading"
        className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 text-white shadow-md relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-xs">
              <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hỗ trợ trực tiếp 24/7</span>
            </div>
            <h2 id="contact-support-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Cần liên hệ với Ban quản trị?
            </h2>
            <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
              Nếu câu hỏi của bạn chưa có trong danh mục FAQ hoặc bạn cần trợ giúp xử lý giao dịch, tài khoản hay an toàn, hãy gửi yêu cầu để đội ngũ ShareLoop hỗ trợ bạn.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleOpenSupport}
              leftIcon={<LifeBuoy className="w-5 h-5 text-emerald-700" aria-hidden="true" />}
              className="bg-white text-emerald-800 hover:bg-emerald-50 border-0 font-bold shadow-md cursor-pointer"
            >
              Gửi yêu cầu hỗ trợ
            </Button>
            {isAuthenticated && (
              <Link
                to="/profile?tab=support"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors text-center"
              >
                Yêu cầu của tôi
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* SECTION F: Useful Quick Navigation */}
      <section
        aria-labelledby="quick-nav-heading"
        className="p-8 rounded-3xl bg-slate-900 text-white space-y-6"
      >
        <div>
          <h2 id="quick-nav-heading" className="text-2xl font-bold tracking-tight text-white">
            Bạn đã sẵn sàng tham gia ShareLoop?
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Khám phá ngay các món đồ hữu ích từ hàng xóm hoặc đăng tặng món đồ bạn không còn dùng đến.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/explore"
            className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">Khám phá đồ dùng</span>
            </div>
            <ArrowRight
              className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-400 transition-all"
              aria-hidden="true"
            />
          </Link>

          <Link
            to="/listings/new"
            className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">Đăng món đồ mới</span>
            </div>
            <ArrowRight
              className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-400 transition-all"
              aria-hidden="true"
            />
          </Link>

          <Link
            to="/messages"
            className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">Hộp thư tin nhắn</span>
            </div>
            <ArrowRight
              className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-400 transition-all"
              aria-hidden="true"
            />
          </Link>

          <Link
            to="/profile"
            className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">Hồ sơ của bạn</span>
            </div>
            <ArrowRight
              className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-400 transition-all"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      {/* Support Request Modal */}
      <CreateSupportRequestModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
}

export default AboutPage;
