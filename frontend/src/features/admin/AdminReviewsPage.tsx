import { MessageSquareWarning } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';

export function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Kiểm duyệt đánh giá</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Điểm cuối máy chủ: <code>DELETE /api/v1/admin/reviews/{'{reviewId}'}</code> (Kiểm duyệt ẩn nhẹ)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hàng đợi kiểm duyệt</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={MessageSquareWarning}
            title="Hàng đợi kiểm duyệt đánh giá"
            description="Hàng đợi kiểm duyệt cho phép ban quản trị xem xét và xử lý các đánh giá hoặc phản hồi vi phạm quy chuẩn cộng đồng."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminReviewsPage;
