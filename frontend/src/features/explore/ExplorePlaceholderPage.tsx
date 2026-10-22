import { Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/Feedback';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ExplorePlaceholderPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Khám phá đồ dùng cộng đồng</h1>
          <Badge variant="neutral">Kế hoạch Giai đoạn 3</Badge>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Duyệt tìm đồ dùng cho tặng, trao đổi hoặc các món đồ đang cần tìm trong khu dân cư.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bảng tin khám phá cộng đồng</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Search}
            title="Tính năng Khám phá sẽ kích hoạt trong Giai đoạn 3"
            description="Nền tảng giao diện đã được thiết lập. Tính năng duyệt bảng tin thực tế kết nối trực tiếp với GET /api/v1/listings sẽ được hoàn thiện trong Giai đoạn 3 sau khi hoàn tất xác thực ở Giai đoạn 2."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default ExplorePlaceholderPage;
