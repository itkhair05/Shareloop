import { MessageSquareWarning } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Badge';

export function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Review Moderation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Backend endpoint: <code>DELETE /api/v1/admin/reviews/{'{reviewId}'}</code> (Soft-hide moderation)
          </p>
        </div>
        <Badge variant="neutral">Phase 8 Planned</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={MessageSquareWarning}
            title="Review Moderation Queue"
            description="Moderation queue allowing administrators to soft-hide inappropriate ratings and review feedback will be connected in Phase 8."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminReviewsPage;
