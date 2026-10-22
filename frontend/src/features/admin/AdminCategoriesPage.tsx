import { FolderTree } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Badge';

export function AdminCategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Category Catalog Administration</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Backend endpoints: <code>POST/PUT/PATCH /api/v1/admin/categories</code>
          </p>
        </div>
        <Badge variant="neutral">Phase 8 Planned</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog Management Interface</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FolderTree}
            title="Category Administration Interface"
            description="Full interactive category CRUD and reordering will be integrated in Phase 8 (Admin Dashboard) following completion of public user workflows."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminCategoriesPage;
