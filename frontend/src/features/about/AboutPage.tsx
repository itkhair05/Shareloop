import { Shield, Database, Lock, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export function AboutPage() {
  const architectures = [
    {
      icon: Lock,
      title: 'Xác thực & Bảo mật',
      description:
        'Xác thực mã thông báo Bearer JWT không lưu phiên trạng thái trên từng yêu cầu. Mật khẩu được mã hóa an toàn với BCrypt. Phân quyền vai trò nghiêm ngặt bảo vệ các khu vực quản trị.',
    },
    {
      icon: Database,
      title: 'Toàn vẹn giao dịch',
      description:
        'Cơ sở dữ liệu PostgreSQL với các ràng buộc kiểm tra nghiêm ngặt, trigger và khóa bi quan giúp ngăn ngừa xung đột dữ liệu trong các giao dịch và đánh giá.',
    },
    {
      icon: Globe,
      title: 'Kiến trúc giao diện độc lập',
      description:
        'Ứng dụng đơn trang React 19 phát triển trên Vite 8, sử dụng TanStack Query để quản lý bộ nhớ đệm và Tailwind CSS cho giao diện thích ứng, dễ tiếp cận.',
    },
    {
      icon: Shield,
      title: 'Tài liệu OpenAPI 3',
      description:
        'Hệ thống REST API được ghi nhận đầy đủ với Swagger UI tại /swagger-ui.html với tài liệu bảo mật chi tiết cho từng tác vụ.',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Về ShareLoop</h1>
        <p className="text-base text-slate-600 mt-2 leading-relaxed">
          ShareLoop là nền tảng chia sẻ và trao đổi đồ dùng cộng đồng mã nguồn mở, được xây dựng theo các tiêu chuẩn kỹ thuật chuyên nghiệp.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {architectures.map((arch) => (
          <Card key={arch.title}>
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <arch.icon className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">{arch.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{arch.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default AboutPage;
