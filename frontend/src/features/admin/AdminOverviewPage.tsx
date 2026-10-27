import { Link } from 'react-router-dom';
import {
  FolderTree,
  MessageSquareWarning,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAdminDashboardStats } from './hooks/use-admin-dashboard';
import { KpiMetricCard } from './components/KpiMetricCard';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { UserStatusDonutChart } from './components/UserStatusDonutChart';
import { ListingStatusBarChart } from './components/ListingStatusBarChart';
import { TransactionFulfillmentChart } from './components/TransactionFulfillmentChart';
import { OperationalQueueChart } from './components/OperationalQueueChart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/Feedback';

export function AdminOverviewPage() {
  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminDashboardStats();

  // Safe fallback if data object is nullish
  const data = stats || {
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    totalListings: 0,
    activeListings: 0,
    totalTransactions: 0,
    completedTransactions: 0,
    totalCategories: 0,
    pendingSupportRequests: 0,
    inProgressSupportRequests: 0,
    pendingReports: 0,
    investigatingReports: 0,
  };

  const totalUrgentQueue = data.pendingSupportRequests + data.pendingReports;
  const otherListingsCount = Math.max(0, data.totalListings - data.activeListings);
  const pendingTransactionsCount = Math.max(0, data.totalTransactions - data.completedTransactions);

  return (
    <div className="space-y-6">
      {/* Page Header with Real-time Refresh Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
            <span>Trang chủ</span>
            <span>/</span>
            <span>Khu vực quản trị</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Tổng quan</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Tổng quan quản trị hệ thống
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Số liệu thống kê thời gian thực từ máy chủ máy trạm ShareLoop và các hàng đợi điều hành cần xử lý
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
            className="cursor-pointer bg-white hover:bg-slate-50"
            aria-label="Làm mới dữ liệu thống kê quản trị"
          >
            Làm mới dữ liệu
          </Button>
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <div className="py-4">
          <ErrorAlert
            title="Không thể tải dữ liệu thống kê quản trị"
            message={
              error instanceof Error
                ? error.message
                : 'Đã xảy ra lỗi khi kết nối với máy chủ quản trị. Vui lòng kiểm tra quyền truy cập và thử lại.'
            }
            onRetry={() => refetch()}
            retryLabel="Thử tải lại"
            isRetrying={isFetching}
          />
        </div>
      ) : (
        <>
          {/* Urgent Operational Alert (if any pending support or reports require intervention) */}
          {totalUrgentQueue > 0 && (
            <div
              role="region"
              aria-label="Cảnh báo hàng đợi tồn đọng"
              className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-amber-950">
                    Có {totalUrgentQueue} mục trong hàng đợi vận hành đang chờ xử lý
                  </h2>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    Bao gồm {data.pendingSupportRequests} yêu cầu trợ giúp và {data.pendingReports} báo cáo vi phạm cần ban quản trị kiểm tra và phản hồi sớm.
                  </p>
                </div>
              </div>
              <Link to="/admin/reviews" className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/70 text-xs w-full sm:w-auto"
                >
                  Kiểm duyệt đánh giá & báo cáo
                </Button>
              </Link>
            </div>
          )}

          {/* Core Platform Scale KPI Grid */}
          <section aria-labelledby="core-metrics-heading">
            <h2 id="core-metrics-heading" className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Chỉ số nền tảng cốt lõi
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiMetricCard
                title="Tổng người dùng"
                value={data.totalUsers}
                subtitle="Tài khoản thành viên đã đăng ký"
                breakdowns={[
                  { label: 'Hoạt động', value: data.activeUsers, variant: 'success' },
                  { label: 'Tạm khóa', value: data.suspendedUsers, variant: 'error' },
                ]}
              />

              <KpiMetricCard
                title="Tổng bài đăng"
                value={data.totalListings}
                subtitle="Đồ dùng và vật phẩm trao đổi"
                breakdowns={[
                  { label: 'Đang hiển thị', value: data.activeListings, variant: 'info' },
                  { label: 'Khác', value: otherListingsCount, variant: 'default' },
                ]}
              />

              <KpiMetricCard
                title="Giao dịch cộng đồng"
                value={data.totalTransactions}
                subtitle="Lượt kết nối trao đổi vật phẩm"
                breakdowns={[
                  { label: 'Hoàn tất', value: data.completedTransactions, variant: 'success' },
                  { label: 'Chờ/Khác', value: pendingTransactionsCount, variant: 'warning' },
                ]}
              />

              <KpiMetricCard
                title="Danh mục ngành hàng"
                value={data.totalCategories}
                subtitle="Phân loại vật phẩm đang áp dụng"
                breakdowns={[
                  { label: 'Hệ thống cơ sở', value: data.totalCategories, variant: 'default' },
                ]}
              />
            </div>
          </section>

          {/* Visual Analytics 2x2 Grid */}
          <section aria-labelledby="visual-analytics-heading" className="space-y-3">
            <h2 id="visual-analytics-heading" className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Phân tích trực quan & hàng đợi điều hành
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UserStatusDonutChart
                totalUsers={data.totalUsers}
                activeUsers={data.activeUsers}
                suspendedUsers={data.suspendedUsers}
              />

              <ListingStatusBarChart
                totalListings={data.totalListings}
                activeListings={data.activeListings}
              />

              <TransactionFulfillmentChart
                totalTransactions={data.totalTransactions}
                completedTransactions={data.completedTransactions}
              />

              <OperationalQueueChart
                pendingSupportRequests={data.pendingSupportRequests}
                inProgressSupportRequests={data.inProgressSupportRequests}
                pendingReports={data.pendingReports}
                investigatingReports={data.investigatingReports}
              />
            </div>
          </section>
        </>
      )}

      {/* Quick Administrative Shortcuts */}
      <section aria-labelledby="quick-actions-heading" className="pt-2">
        <h2 id="quick-actions-heading" className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
          Lối tắt điều hướng quản trị
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <FolderTree className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base text-slate-900">
                    Quản lý phân cấp danh mục
                  </CardTitle>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {data.totalCategories} danh mục
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Xem danh sách phân loại đồ dùng, cấu hình thứ tự hiển thị và kiểm tra trạng thái kích hoạt của từng danh mục.
              </p>
              <Link to="/admin/categories" className="inline-block w-full">
                <Button variant="outline" size="sm" className="w-full justify-between group cursor-pointer">
                  <span>Mở giao diện quản trị danh mục</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <MessageSquareWarning className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base text-slate-900">
                    Kiểm duyệt phản hồi đánh giá
                  </CardTitle>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {data.pendingReports} báo cáo
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Kiểm tra các đánh giá giao dịch bị cộng đồng phản ánh vi phạm, áp dụng biện pháp ẩn đánh giá hoặc khôi phục an toàn.
              </p>
              <Link to="/admin/reviews" className="inline-block w-full">
                <Button variant="outline" size="sm" className="w-full justify-between group cursor-pointer">
                  <span>Mở hàng đợi kiểm duyệt</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
      {/* Security Context Notice */}
      <Card className="border-slate-200/90 bg-slate-50/70">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Bảo mật phân quyền phiên làm việc:</span>{' '}
            Tất cả các số liệu trên được truy xuất bảo mật từ máy chủ Spring Boot thông qua JWT của Quản trị viên. Các yêu cầu không hợp lệ sẽ tự động bị từ chối với mã HTTP 401 hoặc 403.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminOverviewPage;
