import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export interface OperationalQueueChartProps {
  pendingSupportRequests: number;
  inProgressSupportRequests: number;
  pendingReports: number;
  investigatingReports: number;
}

export function OperationalQueueChart({
  pendingSupportRequests,
  inProgressSupportRequests,
  pendingReports,
  investigatingReports,
}: OperationalQueueChartProps) {
  const totalActiveSupport = pendingSupportRequests + inProgressSupportRequests;
  const totalActiveReports = pendingReports + investigatingReports;
  const totalUrgent = pendingSupportRequests + pendingReports;
  const grandTotal = totalActiveSupport + totalActiveReports;

  // Maximum value for scaling bar widths (at least 1 to avoid / 0)
  const maxQueue = Math.max(1, totalActiveSupport, totalActiveReports);

  return (
    <Card className="flex flex-col h-full border-slate-200/90 shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-slate-900 font-semibold">
            Hàng đợi hỗ trợ & kiểm duyệt vi phạm
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Khối lượng yêu cầu trợ giúp và báo cáo đang cần ban quản trị giải quyết
          </p>
        </div>
        {totalUrgent > 0 ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {totalUrgent} mục cần xử lý
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Hàng đợi trống
          </span>
        )}
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between">
        {grandTotal === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            Hiện không có yêu cầu hỗ trợ hoặc báo cáo nào tồn đọng trong hệ thống
          </div>
        ) : (
          <div className="space-y-5">
            {/* Legend for Status Semantics */}
            <div className="flex items-center gap-4 text-xs text-slate-600 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" aria-hidden="true" />
                <span>Chờ xử lý / Tiếp nhận (PENDING)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 shrink-0" aria-hidden="true" />
                <span>Đang điều tra / Xử lý (IN_PROGRESS)</span>
              </div>
            </div>

            {/* Queue 1: Support Requests */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-800">Yêu cầu hỗ trợ (Support Requests)</span>
                <span className="font-mono tabular-nums text-slate-600">
                  Tổng: <strong>{totalActiveSupport}</strong>
                </span>
              </div>

              <div
                className="w-full h-5 rounded-md bg-slate-100 overflow-hidden flex"
                role="img"
                aria-label={`Yêu cầu hỗ trợ: ${pendingSupportRequests} chờ xử lý, ${inProgressSupportRequests} đang giải quyết`}
              >
                {pendingSupportRequests > 0 && (
                  <div
                    className="h-full bg-amber-500 transition-all duration-300 flex items-center justify-center text-[10px] text-white font-mono font-bold"
                    style={{
                      width: `${(pendingSupportRequests / maxQueue) * 100}%`,
                    }}
                    title={`Chờ xử lý: ${pendingSupportRequests}`}
                  >
                    {pendingSupportRequests}
                  </div>
                )}
                {inProgressSupportRequests > 0 && (
                  <div
                    className="h-full bg-sky-500 transition-all duration-300 flex items-center justify-center text-[10px] text-white font-mono font-bold"
                    style={{
                      width: `${(inProgressSupportRequests / maxQueue) * 100}%`,
                    }}
                    title={`Đang giải quyết: ${inProgressSupportRequests}`}
                  >
                    {inProgressSupportRequests}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Chờ xử lý: <strong className="font-mono text-amber-700">{pendingSupportRequests}</strong></span>
                <span>Đang giải quyết: <strong className="font-mono text-sky-700">{inProgressSupportRequests}</strong></span>
              </div>
            </div>

            {/* Queue 2: Violation Reports */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-800">Báo cáo vi phạm (Violation Reports)</span>
                <span className="font-mono tabular-nums text-slate-600">
                  Tổng: <strong>{totalActiveReports}</strong>
                </span>
              </div>

              <div
                className="w-full h-5 rounded-md bg-slate-100 overflow-hidden flex"
                role="img"
                aria-label={`Báo cáo vi phạm: ${pendingReports} chờ tiếp nhận, ${investigatingReports} đang điều tra`}
              >
                {pendingReports > 0 && (
                  <div
                    className="h-full bg-amber-500 transition-all duration-300 flex items-center justify-center text-[10px] text-white font-mono font-bold"
                    style={{
                      width: `${(pendingReports / maxQueue) * 100}%`,
                    }}
                    title={`Chờ tiếp nhận: ${pendingReports}`}
                  >
                    {pendingReports}
                  </div>
                )}
                {investigatingReports > 0 && (
                  <div
                    className="h-full bg-sky-500 transition-all duration-300 flex items-center justify-center text-[10px] text-white font-mono font-bold"
                    style={{
                      width: `${(investigatingReports / maxQueue) * 100}%`,
                    }}
                    title={`Đang điều tra: ${investigatingReports}`}
                  >
                    {investigatingReports}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Chờ tiếp nhận: <strong className="font-mono text-amber-700">{pendingReports}</strong></span>
                <span>Đang điều tra: <strong className="font-mono text-sky-700">{investigatingReports}</strong></span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OperationalQueueChart;
