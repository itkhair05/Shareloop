import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export interface TransactionFulfillmentChartProps {
  totalTransactions: number;
  completedTransactions: number;
}

export function TransactionFulfillmentChart({
  totalTransactions,
  completedTransactions,
}: TransactionFulfillmentChartProps) {
  const pendingOrOther = Math.max(0, totalTransactions - completedTransactions);
  const completionRate =
    totalTransactions > 0 ? Math.round((completedTransactions / totalTransactions) * 100) : 0;
  const pendingRate = totalTransactions > 0 ? 100 - completionRate : 0;

  // Semi-donut gauge calculations
  const radius = 56;
  const arcLength = Math.PI * radius; // Half circumference
  const strokeDash = (completionRate / 100) * arcLength;

  return (
    <Card className="flex flex-col h-full border-slate-200/90 shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-slate-900 font-semibold">
            Hiệu quả giao dịch cộng đồng
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Tỷ lệ hoàn tất trao đổi thành công giữa người tặng và người nhận
          </p>
        </div>
        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          Tổng: {totalTransactions.toLocaleString('vi-VN')}
        </span>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between">
        {totalTransactions === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            Chưa có giao dịch trao đổi nào phát sinh trên nền tảng
          </div>
        ) : (
          <div className="space-y-5">
            {/* Semicircle Gauge Visual */}
            <div className="flex flex-col items-center justify-center pt-1">
              <div className="relative w-44 h-24 overflow-hidden">
                <svg
                  className="w-full h-44"
                  viewBox="0 0 140 140"
                  role="img"
                  aria-label={`Tỷ lệ hoàn tất giao dịch: ${completionRate}% (${completedTransactions}/${totalTransactions} giao dịch)`}
                >
                  {/* Background Arc */}
                  <path
                    d="M 14 70 A 56 56 0 0 1 126 70"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  {/* Progress Arc */}
                  {completionRate > 0 && (
                    <path
                      d="M 14 70 A 56 56 0 0 1 126 70"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="16"
                      strokeDasharray={`${strokeDash} ${arcLength}`}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  )}
                </svg>

                {/* Gauge Metric Text */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end text-center">
                  <span className="text-3xl font-bold font-mono tabular-nums text-emerald-800 leading-none">
                    {completionRate}%
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1">
                    Hoàn tất thành công
                  </span>
                </div>
              </div>
            </div>

            {/* Structured Stats Row */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/40">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
                  <span>Đã hoàn tất</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-bold font-mono tabular-nums text-emerald-950">
                    {completedTransactions.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-xs font-mono font-medium text-emerald-700">
                    {completionRate}%
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  Xác nhận hai chiều đầy đủ
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/40">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                  <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                  <span>Đang xử lý / Khác</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-bold font-mono tabular-nums text-amber-950">
                    {pendingOrOther.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-xs font-mono font-medium text-amber-800">
                    {pendingRate}%
                  </span>
                </div>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Chờ hẹn trao đổi hoặc hủy
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionFulfillmentChart;
