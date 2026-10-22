import { Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/Feedback';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ExplorePlaceholderPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Explore Community Listings</h1>
          <Badge variant="neutral">Phase 3 Planned</Badge>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Browse local items for gifting, trading, or requested items across active neighborhoods.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketplace Exploration Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Search}
            title="Listings Module Scheduled for Phase 3"
            description="The frontend foundation is established in Phase 1. Real marketplace catalog browsing connecting to GET /api/v1/listings will be activated in Phase 3 following Authentication in Phase 2."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default ExplorePlaceholderPage;
