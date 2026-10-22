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
        message="Admin Dashboard Foundation: The endpoints documented below represent genuine administrative operations implemented in the backend."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base">Category Hierarchy Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Manage item category taxonomy, ordering, active status, and slugs.
            </p>
            <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-md border border-slate-200 text-slate-700 space-y-1">
              <div>POST /api/v1/admin/categories</div>
              <div>PUT /api/v1/admin/categories/{'{id}'}</div>
              <div>PATCH /api/v1/admin/categories/{'{id}'}/status</div>
            </div>
            <Link to="/admin/categories">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Manage Categories
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-base">Review Soft Moderation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Review reported participant ratings, apply soft-hide moderation, and audit logs.
            </p>
            <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-md border border-slate-200 text-slate-700 space-y-1">
              <div>DELETE /api/v1/admin/reviews/{'{reviewId}'}</div>
            </div>
            <Link to="/admin/reviews">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Inspect Moderation
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-base">Backend Authorization Security Note</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 leading-relaxed">
            All administrative routes are protected at the Spring Security filter layer with{' '}
            <code>.hasRole('ADMIN')</code> and <code>@PreAuthorize(&quot;hasRole('ADMIN')&quot;)</code>. In Phase 2,
            client-side route guards will verify the active user profile role, but backend enforcement remains authoritative.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminOverviewPage;
