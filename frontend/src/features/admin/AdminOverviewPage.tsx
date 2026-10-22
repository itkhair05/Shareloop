import { Link } from 'react-router-dom';
import { FolderTree, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/Feedback';

export function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <StatusBanner
        type="info"
        message="Nền tảng trang quản trị: Các điểm cuối bên dưới đại diện cho các thao tác quản trị thực tế đã được xây dựng ở máy chủ."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base">Quản lý phân cấp danh mục</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Quản lý phân loại danh mục sản phẩm, thứ tự hiển thị, trạng thái hoạt động và đường dẫn tĩnh.
            </p>
            <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-md border border-slate-200 text-slate-700 space-y-1">
              <div>POST /api/v1/admin/categories</div>
              <div>PUT /api/v1/admin/categories/{'{id}'}</div>
              <div>PATCH /api/v1/admin/categories/{'{id}'}/status</div>
            </div>
            <Link to="/admin/categories">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Quản lý danh mục
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-base">Kiểm duyệt phản hồi đánh giá</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Kiểm tra đánh giá thành viên bị báo cáo, áp dụng ẩn đánh giá nhẹ và kiểm tra nhật ký.
            </p>
            <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-md border border-slate-200 text-slate-700 space-y-1">
              <div>DELETE /api/v1/admin/reviews/{'{reviewId}'}</div>
            </div>
            <Link to="/admin/reviews">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Kiểm tra kiểm duyệt
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-base">Lưu ý bảo mật phân quyền máy chủ</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 leading-relaxed">
            Mọi tuyến đường quản trị đều được bảo vệ tại tầng bộ lọc Spring Security với{' '}
            <code>.hasRole(&apos;ADMIN&apos;)</code> và <code>@PreAuthorize(&quot;hasRole(&apos;ADMIN&apos;)&quot;)</code>. Ở phía giao diện người dùng,
            bộ định tuyến sẽ xác minh vai trò hồ sơ người dùng, nhưng máy chủ phụ trợ vẫn là nơi quyết định quyền hạn tuyệt đối.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminOverviewPage;
