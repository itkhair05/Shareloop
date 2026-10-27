import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export interface ListingStatusBarChartProps {
  totalListings: number;
  activeListings: number;
}

export function ListingStatusBarChart({
  totalListings,
  activeListings,
}: ListingStatusBarChartProps) {
  const otherListings = Math.max(0, totalListings - activeListings);
  const activePct = totalListings > 0 ? Math.round((activeListings / totalListings) * 100) : 0;
  const otherPct = totalListings > 0 ? 100 - activePct : 0;

  return (
    <Card className="flex flex-col h-full border-slate-200/90 shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-slate-900 font-semibold">
            Tình trạng bài đăng trên hệ thống
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Tỷ lệ bài đăng đang hoạt động công khai so với các trạng thái khác
          </p>
        </div>
        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          Tổng: {totalListings.toLocaleString('vi-VN')}
        </span>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between">
        {totalListings === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            Chưa có bài đăng nào được khởi tạo trên thị trường
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Ratio Metric */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-bold font-mono tabular-nums text-sky-700">
                  {activePct}%
                </span>
                <span className="text-xs font-medium text-slate-500 ml-2">
                  đang sẵn sàng giao dịch
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {activeListings.toLocaleString('vi-VN')} / {totalListings.toLocaleString('vi-VN')} bài đăng
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div
              className="w-full h-4 rounded-full bg-slate-100 overflow-hidden flex shadow-inner"
              role="progressbar"
              aria-valuenow={activePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tỷ lệ bài đăng hoạt động: ${activePct}%`}
            >
              <div
                className="h-full bg-sky-600 transition-all duration-300 rounded-l-full"
                style={{ width: `${activePct}%` }}
              />
              <div
                className="h-full bg-slate-300 transition-all duration-300 rounded-r-full"
                style={{ width: `${otherPct}%` }}
              />
            </div>

            {/* Breakdown Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="p-3 rounded-lg border border-sky-100 bg-sky-50/50">
                <div className="flex items-center gap-1.5 text-xs font-medium text-sky-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" aria-hidden="true" />
                  <span>Đang hoạt động (ACTIVE)</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono tabular-nums text-sky-950">
                    {activeListings.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-xs font-mono font-medium text-sky-700">
                    {activePct}%
                  </span>
                </div>
                <p className="text-[11px] text-sky-700 mt-1">
                  Đang hiển thị cho cộng đồng trao đổi và quyên góp
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
                  <span>Trạng thái khác</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {otherListings.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-600">
                    {otherPct}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bao gồm bài đăng nháp, đã giao dịch xong hoặc đã đóng
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ListingStatusBarChart;
