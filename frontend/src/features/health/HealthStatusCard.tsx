import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, RefreshCw, Server } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner, ErrorAlert } from '@/components/ui/Feedback';
import type { HealthResponse } from '@/types/api';
import { formatDateTime } from '@/lib/utils';

export function HealthStatusCard() {
  const { data, error, isLoading, isFetching, refetch } = useQuery<HealthResponse>({
    queryKey: ['backend-health'],
    queryFn: () => apiClient.get<HealthResponse>('/api/health'),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            <CardTitle>Backend Service Connectivity</CardTitle>
          </div>
          <CardDescription>
            Validates active HTTP communication with Spring Boot backend via <code>/api/health</code>
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isLoading={isFetching}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Check Now
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="py-6 flex justify-center">
            <LoadingSpinner size="md" label="Pinging ShareLoop backend..." />
          </div>
        )}

        {error && (
          <ErrorAlert
            title="Backend Unreachable"
            message={`${error.message}. Ensure the Spring Boot backend service is running on port 8080.`}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        )}

        {data && !isLoading && (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-950 text-sm">
                    Status: {data.status}
                  </span>
                  <Badge variant="success" withDot>
                    Online
                  </Badge>
                </div>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Service: <strong>{data.service || 'shareloop-backend'}</strong>
                </p>
              </div>
            </div>

            <div className="text-xs text-emerald-800/80 sm:text-right">
              <div>Server Timestamp:</div>
              <div className="font-mono text-emerald-950 font-medium">
                {formatDateTime(data.timestamp)}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            Vite Proxy: <code>/api/*</code> &rarr; <code>http://localhost:8080</code>
          </span>
          <span className="font-mono">HTTP 200 OK</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default HealthStatusCard;
