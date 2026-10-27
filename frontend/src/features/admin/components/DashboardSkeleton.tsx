export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Đang tải dữ liệu tổng quan quản trị...">
      {/* Alert Banner Skeleton */}
      <div className="h-16 bg-slate-200/80 rounded-xl" />

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-slate-200/90 rounded-xl p-5 space-y-3">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-8 w-20 bg-slate-200 rounded" />
            <div className="h-3 w-36 bg-slate-100 rounded" />
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <div className="h-5 w-24 bg-slate-100 rounded" />
              <div className="h-5 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Operational Queue Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-slate-200/90 rounded-xl p-5 space-y-3">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-56 bg-slate-100 rounded" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-16 bg-slate-100 rounded-lg" />
              <div className="h-16 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
            <div className="h-52 bg-slate-100 rounded-lg flex items-center justify-center">
              <div className="w-28 h-28 rounded-full border-4 border-slate-200 border-t-slate-300" />
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="h-3 w-full bg-slate-100 rounded" />
              <div className="h-3 w-3/4 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu tổng quan quản trị...</span>
    </div>
  );
};

export default DashboardSkeleton;
