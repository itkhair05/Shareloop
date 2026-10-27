import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export interface UserStatusDonutChartProps {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
}

export function UserStatusDonutChart({
  totalUsers,
  activeUsers,
  suspendedUsers,
}: UserStatusDonutChartProps) {
  const otherUsers = Math.max(0, totalUsers - activeUsers - suspendedUsers);

  // Percentages with fallback for zero total
  const activePct = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
  const suspendedPct = totalUsers > 0 ? Math.round((suspendedUsers / totalUsers) * 100) : 0;
  const otherPct = totalUsers > 0 ? Math.max(0, 100 - activePct - suspendedPct) : 0;

  // SVG Donut calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.29

  const slices = [
    {
      label: 'Đang hoạt động',
      count: activeUsers,
      pct: activePct,
      color: '#059669', // Emerald 600
      tailwindBadge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    {
      label: 'Tài khoản tạm khóa',
      count: suspendedUsers,
      pct: suspendedPct,
      color: '#e11d48', // Rose 600
      tailwindBadge: 'bg-rose-50 text-rose-800 border-rose-200',
    },
    {
      label: 'Đã hủy kích hoạt / Khác',
      count: otherUsers,
      pct: otherPct,
      color: '#94a3b8', // Slate 400
      tailwindBadge: 'bg-slate-50 text-slate-700 border-slate-200',
    },
  ];

  let accumulatedOffset = 0;

  return (
    <Card className="flex flex-col h-full border-slate-200/90 shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-slate-900 font-semibold">
            Tình hình tài khoản người dùng
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân bổ trạng thái thành viên trên toàn bộ nền tảng
          </p>
        </div>
        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          Tổng: {totalUsers.toLocaleString('vi-VN')}
        </span>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between">
        {totalUsers === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            Chưa có tài khoản người dùng nào được ghi nhận
          </div>
        ) : (
          <div className="space-y-5">
            {/* Donut Chart Visual */}
            <div className="flex items-center justify-center pt-2">
              <div className="relative w-40 h-40">
                <svg
                  className="w-full h-full -rotate-90 transform"
                  viewBox="0 0 140 140"
                  role="img"
                  aria-label={`Biểu đồ tình hình người dùng: ${activeUsers} hoạt động, ${suspendedUsers} tạm khóa, ${otherUsers} khác`}
                >
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="18"
                  />
                  {slices.map((slice, index) => {
                    const sliceLength = (slice.count / totalUsers) * circumference;
                    const strokeDasharray = `${sliceLength} ${circumference}`;
                    const strokeDashoffset = -accumulatedOffset;
                    accumulatedOffset += sliceLength;

                    if (slice.count === 0) return null;

                    return (
                      <circle
                        key={index}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="18"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 leading-none">
                    {totalUsers.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1">
                    Thành viên
                  </span>
                </div>
              </div>
            </div>

            {/* Structured Legend & Percentages */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {slices.map((slice, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-slate-50/60"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="text-slate-700 font-medium">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {slice.count.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-slate-400 text-[11px] w-9 text-right">
                      ({slice.pct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserStatusDonutChart;
