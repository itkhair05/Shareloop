import { Link } from 'react-router-dom';
import {
  Gift,
  ArrowLeftRight,
  Search,
  ArrowRight,
  Sparkles,
  Leaf,
  Users,
  ShieldCheck,
  Tag,
  MessageSquare,
  HeartHandshake,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth';

export function HomePage() {
  const { isAuthenticated } = useAuth();

  // 1. Core Marketplace Activities
  const activityTypes = [
    {
      icon: Gift,
      title: 'Cho tặng miễn phí',
      badge: 'Tiết kiệm & Giảm rác',
      badgeVariant: 'success' as const,
      image:
        'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80',
      imageAlt: 'Đồ dùng gia đình, sách vở được phân loại để trao tặng láng giềng',
      description:
        'Tặng lại sách vở, đồ chơi trẻ em, đồ làm bếp, thiết bị gia đình cũ hoặc cây cảnh còn dùng tốt cho những người hàng xóm thật sự cần.',
      examples: 'Sách giáo khoa, đồ chơi, gia dụng, quần áo, cây xanh',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      icon: ArrowLeftRight,
      title: 'Mua bán & Trao đổi đồ cũ',
      badge: 'Chi phí tiết kiệm',
      badgeVariant: 'neutral' as const,
      image:
        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80',
      imageAlt: 'Vật dụng và thiết bị gia đình đã qua sử dụng còn chất lượng tốt',
      description:
        'Chuyển nhượng vật dụng đã qua sử dụng với mức giá hợp lý. Người mua kiểm tra đồ trực tiếp, người bán thu hồi một phần chi phí minh bạch.',
      examples: 'Đồ điện tử, xe đạp, nội thất nhỏ, dụng cụ sửa chữa',
      iconBg: 'bg-teal-100 text-teal-700',
    },
    {
      icon: Search,
      title: 'Tìm kiếm đồ cần thiết',
      badge: 'Tương trợ láng giềng',
      badgeVariant: 'warning' as const,
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=600&q=80',
      imageAlt: 'Bộ dụng cụ sửa chữa và thiết bị sinh hoạt gia đình',
      description:
        'Bạn đang cần mượn đồ dùng cho một dịp đặc biệt hoặc tìm mua phụ kiện khó kiếm? Hãy phát tín hiệu đến cộng đồng xung quanh để nhận hỗ trợ.',
      examples: 'Bộ dụng cụ cơ khí, vali kéo, giáo trình, đồ cắm trại',
      iconBg: 'bg-sky-100 text-sky-700',
    },
  ];

  // 2. How ShareLoop Works Steps
  const workflowSteps = [
    {
      step: '01',
      icon: Search,
      title: 'Đăng tin hoặc tìm kiếm',
      description:
        'Duyệt danh mục theo khu vực sinh sống hoặc chụp ảnh đăng món đồ bạn muốn sẻ chia với thông tin và hình ảnh trung thực.',
    },
    {
      step: '02',
      icon: MessageSquare,
      title: 'Nhắn tin & thống nhất',
      description:
        'Trao đổi trực tiếp qua tin nhắn để hỏi kỹ tình trạng, thống nhất thời gian và địa điểm gặp mặt thuận tiện nhất.',
    },
    {
      step: '03',
      icon: HeartHandshake,
      title: 'Gặp mặt & trao nhận',
      description:
        'Gặp nhau trực tiếp tại khu phố, tự tay kiểm tra tình trạng thực tế của món đồ trước khi nhận và thanh toán nếu có.',
    },
    {
      step: '04',
      icon: CheckCircle2,
      title: 'Xác nhận & gửi đánh giá',
      description:
        'Xác nhận hoàn tất giao dịch và để lại nhận xét công tâm, giúp xây dựng cộng đồng láng giềng ngày càng uy tín, tin cậy.',
    },
  ];

  // 3. Practical Community Values
  const communityBenefits = [
    {
      icon: Leaf,
      title: 'Giảm thiểu rác thải sinh hoạt',
      description:
        'Mỗi món đồ được trao tay là một vật dụng không bị lãng phí ra môi trường, góp phần xây dựng lối sống xanh và bền vững trong từng khu dân cư.',
    },
    {
      icon: Tag,
      title: 'Tiết kiệm chi phí thực chất',
      description:
        'Giúp các gia đình, bạn trẻ và sinh viên tiếp cận các vật dụng thiết yếu với mức chi phí tiết kiệm hoặc hoàn toàn miễn phí từ những người xung quanh.',
    },
    {
      icon: Users,
      title: 'Gắn kết tình làng nghĩa xóm',
      description:
        'Biến những người sống gần nhau nhưng chưa từng trò chuyện trở thành những người hàng xóm thân tình qua những lần gặp gỡ trao tặng đồ dùng.',
    },
    {
      icon: ShieldCheck,
      title: 'Giao dịch trực tiếp, an tâm',
      description:
        'Tận mắt nhìn thấy và kiểm tra chất lượng đồ dùng trước khi nhận tại địa phương, hoàn toàn không lo lắng rủi ro chuyển tiền từ xa hay thông tin sai lệch.',
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8">
      {/* 1. Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
          <span>Cộng đồng sẻ chia đồ dùng bền vững</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.18]">
          Chia sẻ đồ dùng, kéo dài vòng đời vật dụng cùng{' '}
          <span className="text-emerald-600">ShareLoop</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Nền tảng kết nối cư dân trong cùng khu vực để cho tặng đồ không dùng tới, trao đổi đồ cũ chất lượng và tìm kiếm vật dụng cần thiết — tiết kiệm chi phí, giảm rác thải và gắn kết cộng đồng.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Link to="/explore" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto px-7 shadow-sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Khám phá đồ dùng
            </Button>
          </Link>
          {!isAuthenticated ? (
            <Link to="/register" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto px-6 border-slate-300 hover:bg-slate-100"
              >
                Đăng ký thành viên
              </Button>
            </Link>
          ) : (
            <Link to="/explore" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto px-6 border-slate-300 hover:bg-slate-100"
              >
                Xem bảng tin trao đổi
              </Button>
            </Link>
          )}
        </div>

        {/* Local Community Trust Markers */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 pt-4 text-xs font-medium text-slate-600 border-t border-slate-200/60 mt-8">
          <div className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Trao nhận trực tiếp trong khu phố</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Cho tặng đồ hoàn toàn miễn phí</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Đánh giá thành viên minh bạch</span>
          </div>
        </div>
      </section>

      {/* 2. Core Marketplace Activities Preview */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
            Hình thức trao đổi
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Ba cách lan tỏa giá trị đồ dùng tại ShareLoop
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Mỗi món đồ không còn dùng đến đều có thể trở thành giải pháp thiết thực cho một người hàng xóm quanh bạn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activityTypes.map((activity) => (
            <Card key={activity.title} className="hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden">
              <div className="aspect-16/10 w-full overflow-hidden bg-slate-100">
                <img
                  src={activity.image}
                  alt={activity.imageAlt}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  onError={(e) => {
                    // Graceful fallback to hide broken image container
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <CardHeader className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs ${activity.iconBg}`}
                  >
                    <activity.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <Badge variant={activity.badgeVariant}>{activity.badge}</Badge>
                </div>
                <CardTitle className="text-lg font-bold text-slate-900">{activity.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <p className="text-sm text-slate-600 leading-relaxed">{activity.description}</p>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Ví dụ phổ biến: </span>
                  <span>{activity.examples}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. How ShareLoop Works */}
      <section className="space-y-10 rounded-2xl bg-slate-100/70 border border-slate-200/80 p-6 sm:p-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
            Quy trình thực tế
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Cách thức hoạt động tại ShareLoop
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Trao đổi trực tiếp, đơn giản và minh bạch giữa các thành viên trong cộng đồng dân cư.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((step) => (
            <div
              key={step.step}
              className="relative p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <step.icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="text-xs font-extrabold text-slate-400 tracking-wider">
                  BƯỚC {step.step}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Practical Community Benefits */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
            Lợi ích cộng đồng
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Vì sao nên sẻ chia cùng ShareLoop?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Một hành động nhỏ trao gửi đồ dùng cũ mang lại những thay đổi tích cực lớn cho môi trường và cuộc sống hàng ngày.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {communityBenefits.map((benefit) => (
            <div
              key={benefit.title}
              className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <benefit.icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">{benefit.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Final Call To Action */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-white p-8 sm:p-12 text-center shadow-md">
        <div className="max-w-2xl mx-auto space-y-5 relative z-10">
          <span className="inline-block text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-white/15 text-emerald-100 border border-white/20">
            Cộng đồng láng giềng xanh
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Sẵn sàng kết nối và sẻ chia cùng hàng xóm của bạn?
          </h2>
          <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
            Bắt đầu dọn dẹp không gian sống hoặc tìm kiếm những món đồ hữu ích ngay trong khu phố của bạn hôm nay.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link to="/explore" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white text-emerald-900 hover:bg-gray-100 border-0 font-bold px-7 shadow-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900 transition-colors"
                rightIcon={<ArrowRight className="w-4 h-4 text-emerald-900" />}
              >
                Khám phá đồ dùng
              </Button>
            </Link>
            {!isAuthenticated ? (
              <Link to="/register" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border border-white text-white hover:bg-white/10 hover:text-white px-6 font-semibold focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900 transition-colors"
                >
                  Đăng ký tài khoản miễn phí
                </Button>
              </Link>
            ) : (
              <Link to="/about" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border border-white text-white hover:bg-white/10 hover:text-white px-6 font-semibold focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900 transition-colors"
                >
                  Tìm hiểu thêm
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
