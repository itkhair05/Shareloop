import { FolderTree } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Badge';

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
        <Badge variant="neutral">Kế hoạch Giai đoạn 8</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giao diện quản lý danh mục</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FolderTree}
            title="Giao diện quản trị danh mục"
            description="Các thao tác CRUD và sắp xếp lại danh mục tương tác đầy đủ sẽ được tích hợp trong Giai đoạn 8 (Trang quản trị) sau khi hoàn tất quy trình người dùng công khai."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminCategoriesPage;
