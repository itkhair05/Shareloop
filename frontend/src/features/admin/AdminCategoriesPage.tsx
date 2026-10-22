import { FolderTree } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';

export function AdminCategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Quản trị danh mục ngành hàng</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Các điểm cuối máy chủ: <code>POST/PUT/PATCH /api/v1/admin/categories</code>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giao diện quản lý danh mục</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FolderTree}
            title="Giao diện quản trị danh mục"
            description="Các thao tác quản lý danh mục và điều chỉnh sắp xếp sẽ sẵn sàng cho quản trị viên sau khi hệ thống hoàn tất cấu hình danh mục cơ sở."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminCategoriesPage;
