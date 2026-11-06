import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, RefreshCw, Server } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner, ErrorAlert } from '@/components/ui/Feedback';
import type { HealthResponse } from '@/types/api';
import { formatDateTime } from '@/lib/utils';
import { appConfig } from '@/lib/config';

function resolveApiHost(): string {
  try {
    return new URL(appConfig.apiBaseUrl).host;
  } catch {
    return appConfig.apiBaseUrl;
  }
}

export function HealthStatusCard() {
  const apiHost = resolveApiHost();
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
            <CardTitle>Kết nối dịch vụ máy chủ</CardTitle>
          </div>
          <CardDescription>
            Kiểm tra trạng thái giao tiếp HTTP với máy chủ Spring Boot thông qua <code>/api/health</code>
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isLoading={isFetching}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Kiểm tra ngay
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="py-6 flex justify-center">
            <LoadingSpinner size="md" label="Đang kiểm tra kết nối máy chủ ShareLoop..." />
          </div>
        )}

        {error && (
          <ErrorAlert
            title="Không thể kết nối máy chủ"
            message={`${error.message}. Vui lòng kiểm tra kết nối mạng và trạng thái dịch vụ máy chủ.`}
            onRetry={() => refetch()}
            retryLabel="Thử lại"
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
                    Trạng thái: {data.status}
                  </span>
                  <Badge variant="success" withDot>
                    Trực tuyến
                  </Badge>
                </div>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Dịch vụ: <strong>{data.service || 'shareloop-backend'}</strong>
                </p>
              </div>
            </div>

            <div className="text-xs text-emerald-800/80 sm:text-right">
              <div>Thời gian máy chủ:</div>
              <div className="font-mono text-emerald-950 font-medium">
                {formatDateTime(data.timestamp)}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            Máy chủ API: <code>{apiHost}</code>
          </span>
          <span className="font-mono">HTTP 200 OK</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default HealthStatusCard;
