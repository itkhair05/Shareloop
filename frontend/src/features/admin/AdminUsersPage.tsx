import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ListFilter,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth';
import { formatDateTime } from '@/lib/utils';
import {
  useAdminUsers,
  useUpdateUserRole,
  useUpdateUserStatus,
} from './hooks/use-admin-users';
import { UserDetailModal } from './components/UserDetailModal';
import type { AdminUserResponse } from '@/types/admin-user';
import type { UserRole, UserStatus } from '@/types/auth';

type RoleFilter = 'ALL' | UserRole;
type StatusFilter = 'ALL' | UserStatus;

type PendingAction =
  | { type: 'PROMOTE'; user: AdminUserResponse }
  | { type: 'DEMOTE'; user: AdminUserResponse }
  | { type: 'SUSPEND'; user: AdminUserResponse }
  | { type: 'ACTIVATE'; user: AdminUserResponse }
  | { type: 'DEACTIVATE'; user: AdminUserResponse };

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  // Search & Filter state
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  // Debounce search input by 350ms to avoid firing unnecessary requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Query parameters for the backend API
  const queryParams = useMemo(() => {
    return {
      search: activeSearch || undefined,
      role: roleFilter === 'ALL' ? undefined : roleFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      size,
      sortBy: 'createdAt',
      sortDirection: 'desc' as const,
    };
  }, [activeSearch, roleFilter, statusFilter, page, size]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAdminUsers(queryParams);

  const updateRoleMutation = useUpdateUserRole();
  const updateStatusMutation = useUpdateUserStatus();

  // Modal & Action states
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Dismissible Feedback Banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Reset pagination when role or status filter changes
  const handleRoleFilterChange = (role: RoleFilter) => {
    setRoleFilter(role);
    setPage(0);
  };

  const handleStatusFilterChange = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setActiveSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setPage(0);
  };

  const handleOpenDetail = (userId: string) => {
    setDetailUserId(userId);
    setIsDetailModalOpen(true);
  };

  const isSubmittingMutation =
    updateRoleMutation.isPending || updateStatusMutation.isPending;

  // Confirm and execute action
  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    const { type, user } = pendingAction;
    try {
      if (type === 'PROMOTE') {
        await updateRoleMutation.mutateAsync({
          id: user.id,
          payload: { role: 'ADMIN' },
        });
        setFeedback({
          type: 'success',
          text: `Đã nâng cấp quyền Quản trị viên (ADMIN) cho "${user.displayName}" thành công.`,
        });
      } else if (type === 'DEMOTE') {
        await updateRoleMutation.mutateAsync({
          id: user.id,
          payload: { role: 'USER' },
        });
        setFeedback({
          type: 'success',
          text: `Đã hạ quyền tài khoản "${user.displayName}" về Người dùng thông thường (USER).`,
        });
      } else if (type === 'SUSPEND') {
        await updateStatusMutation.mutateAsync({
          id: user.id,
          payload: { status: 'SUSPENDED' },
        });
        setFeedback({
          type: 'success',
          text: `Đã tạm khóa tài khoản "${user.displayName}".`,
        });
      } else if (type === 'ACTIVATE') {
        await updateStatusMutation.mutateAsync({
          id: user.id,
          payload: { status: 'ACTIVE' },
        });
        setFeedback({
          type: 'success',
          text: `Đã mở khóa và kích hoạt tài khoản "${user.displayName}" thành công.`,
        });
      } else if (type === 'DEACTIVATE') {
        await updateStatusMutation.mutateAsync({
          id: user.id,
          payload: { status: 'DEACTIVATED' },
        });
        setFeedback({
          type: 'success',
          text: `Đã vô hiệu hóa vĩnh viễn tài khoản "${user.displayName}".`,
        });
      }

      setPendingAction(null);
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ||
        'Không thể thực hiện thao tác. Vui lòng thử lại sau.';
      setFeedback({
        type: 'error',
        text: message,
      });
      setPendingAction(null);
    }
  };

  // Pagination derived data
  const users = pageData?.content ?? [];
  const totalElements = pageData?.totalElements ?? 0;
  const totalPages = pageData?.totalPages ?? 0;
  const isFiltered = Boolean(activeSearch || roleFilter !== 'ALL' || statusFilter !== 'ALL');

  // Dialog configuration generator
  const getDialogConfig = () => {
    if (!pendingAction) {
      return {
        title: '',
        message: '',
        confirmText: 'Xác nhận',
        variant: 'primary' as const,
      };
    }

    const { type, user } = pendingAction;
    switch (type) {
      case 'PROMOTE':
        return {
          title: 'Nâng cấp quyền Quản trị viên (ADMIN)',
          message: (
            <span>
              Bạn có chắc chắn muốn nâng cấp tài khoản{' '}
              <strong className="text-slate-900">{user.displayName}</strong> ({user.email}) lên vai trò{' '}
              <strong className="text-emerald-700">Quản trị viên (ADMIN)</strong>? Tài khoản này sẽ có
              quyền truy cập toàn bộ bảng quản trị hệ thống ShareLoop.
            </span>
          ),
          confirmText: 'Nâng cấp Admin',
          variant: 'primary' as const,
        };
      case 'DEMOTE':
        return {
          title: 'Gỡ quyền Quản trị viên',
          message: (
            <span>
              Bạn có chắc chắn muốn hạ quyền tài khoản{' '}
              <strong className="text-slate-900">{user.displayName}</strong> ({user.email}) xuống{' '}
              <strong className="text-amber-700">Người dùng thông thường (USER)</strong>? Tài khoản này sẽ mất
              toàn bộ quyền truy cập bảng quản trị.
            </span>
          ),
          confirmText: 'Hạ quyền',
          variant: 'warning' as const,
        };
      case 'SUSPEND':
        return {
          title: 'Khóa tài khoản người dùng',
          message: (
            <span>
              Bạn có chắc chắn muốn <strong className="text-amber-700">tạm khóa</strong> tài khoản của{' '}
              <strong className="text-slate-900">{user.displayName}</strong> ({user.email})? Người dùng này sẽ không
              thể đăng nhập, đăng tin hoặc thực hiện giao dịch cho đến khi được mở khóa.
            </span>
          ),
          confirmText: 'Khóa tài khoản',
          variant: 'warning' as const,
        };
      case 'ACTIVATE':
        return {
          title: 'Mở khóa tài khoản',
          message: (
            <span>
              Bạn có chắc chắn muốn <strong className="text-emerald-700">mở khóa</strong> tài khoản cho{' '}
              <strong className="text-slate-900">{user.displayName}</strong> ({user.email})? Tài khoản sẽ có thể
              đăng nhập và giao dịch bình thường trở lại.
            </span>
          ),
          confirmText: 'Mở khóa',
          variant: 'primary' as const,
        };
      case 'DEACTIVATE':
        return {
          title: 'Vô hiệu hóa tài khoản vĩnh viễn',
          message: (
            <div className="space-y-2">
              <p>
                Bạn có chắc chắn muốn <strong className="text-red-700">vô hiệu hóa vĩnh viễn</strong> tài khoản{' '}
                <strong className="text-slate-900">{user.displayName}</strong> ({user.email})?
              </p>
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                <strong>CẢNH BÁO QUAN TRỌNG:</strong> Trạng thái vô hiệu hóa là vĩnh viễn và không thể khôi phục
                hoặc đảo ngược theo quy định an toàn hệ thống.
              </p>
            </div>
          ),
          confirmText: 'Vô hiệu hóa vĩnh viễn',
          variant: 'danger' as const,
        };
    }
  };

  const dialogConfig = getDialogConfig();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              Quản lý người dùng
            </h1>
            <Badge variant="default" className="text-xs shrink-0 whitespace-nowrap">
              {totalElements} người dùng
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản trị danh sách tài khoản, phân quyền quản trị và kiểm soát trạng thái hoạt động trên hệ thống ShareLoop.
          </p>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex flex-row items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs self-start sm:self-auto disabled:opacity-50"
          aria-label="Tải lại danh sách người dùng"
        >
          <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 cursor-pointer text-slate-500"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Search, Filters & Counters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm theo tên hoặc email..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 rounded-lg transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-emerald-500 focus:ring-emerald-400 text-slate-900"
              aria-label="Tìm kiếm người dùng"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Group: Role & Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter Select */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium whitespace-nowrap">Vai trò:</span>
              <select
                value={roleFilter}
                onChange={(e) => handleRoleFilterChange(e.target.value as RoleFilter)}
                className="py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                aria-label="Lọc theo vai trò"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="USER">Người dùng (USER)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
              </select>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => handleStatusFilterChange('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => handleStatusFilterChange('ACTIVE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Hoạt động
              </button>
              <button
                type="button"
                onClick={() => handleStatusFilterChange('SUSPENDED')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'SUSPENDED'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                Bị khóa
              </button>
              <button
                type="button"
                onClick={() => handleStatusFilterChange('DEACTIVATED')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'DEACTIVATED'
                    ? 'bg-white text-red-800 shadow-xs'
                    : 'text-slate-600 hover:text-red-700'
                }`}
              >
                Vô hiệu hóa
              </button>
            </div>
          </div>
        </div>

        {/* Filter Feedback indicator */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Tìm thấy <strong className="text-slate-900">{totalElements}</strong> người dùng phù hợp
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4" role="status" aria-label="Đang tải danh sách người dùng">
              <div className="h-6 bg-slate-200/80 rounded w-1/4 animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : isError ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Không thể tải danh sách người dùng</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {error?.message || 'Đã có sự cố khi kết nối tới máy chủ. Vui lòng thử lại sau.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex flex-row items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Thử lại</span>
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                {isFiltered ? (
                  <ListFilter className="w-6 h-6" />
                ) : (
                  <Users className="w-6 h-6" />
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {isFiltered
                  ? 'Không tìm thấy người dùng phù hợp'
                  : 'Chưa có người dùng nào trong hệ thống'}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isFiltered
                  ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc vai trò, trạng thái để xem đầy đủ danh sách.'
                  : 'Hiện chưa có tài khoản người dùng nào được tạo trên hệ thống.'}
              </p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex flex-row items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Xóa bộ lọc tìm kiếm</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto" role="region" aria-label="Bảng quản lý người dùng">
              <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                    <th scope="col" className="py-3 px-4 whitespace-nowrap">Người dùng</th>
                    <th scope="col" className="py-3 px-4 whitespace-nowrap">Số điện thoại</th>
                    <th scope="col" className="py-3 px-4 text-center whitespace-nowrap">Vai trò</th>
                    <th scope="col" className="py-3 px-4 text-center whitespace-nowrap">Trạng thái</th>
                    <th scope="col" className="py-3 px-4 hidden lg:table-cell whitespace-nowrap">Ngày tham gia</th>
                    <th scope="col" className="py-3 px-4 text-right whitespace-nowrap w-[260px] min-w-[260px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((row) => {
                    const isSelf = currentUser?.id === row.id;

                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          row.status === 'DEACTIVATED'
                            ? 'bg-slate-50/60 text-slate-500 opacity-80'
                            : row.status === 'SUSPENDED'
                            ? 'bg-amber-50/30'
                            : ''
                        }`}
                      >
                        {/* Name and Email */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-600/10 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 uppercase">
                              {row.displayName ? row.displayName.charAt(0) : 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 truncate">
                                  {row.displayName}
                                </span>
                                {isSelf && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-normal text-slate-500 block truncate">
                                {row.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Phone Number */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {row.phoneNumber ? (
                            <span className="font-mono text-slate-700">{row.phoneNumber}</span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {row.role === 'ADMIN' ? (
                            <Badge variant="default" className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                              <Shield className="w-3 h-3 mr-1 shrink-0" />
                              Quản trị viên
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                              Người dùng
                            </Badge>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {row.status === 'ACTIVE' && (
                            <Badge variant="success" withDot className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                              Hoạt động
                            </Badge>
                          )}
                          {row.status === 'SUSPENDED' && (
                            <Badge variant="warning" withDot className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                              Bị khóa
                            </Badge>
                          )}
                          {row.status === 'DEACTIVATED' && (
                            <Badge variant="destructive" withDot className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                              Vô hiệu hóa
                            </Badge>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 hidden lg:table-cell text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(row.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap w-[260px] min-w-[260px]">
                          <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(row.id)}
                              className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0"
                              title="Xem chi tiết người dùng"
                              aria-label={`Xem chi tiết ${row.displayName}`}
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              <span className="hidden sm:inline">Chi tiết</span>
                            </button>

                            {/* Role Actions */}
                            {!isSelf && row.status !== 'DEACTIVATED' && (
                              <>
                                {row.role === 'USER' ? (
                                  <button
                                    type="button"
                                    onClick={() => setPendingAction({ type: 'PROMOTE', user: row })}
                                    disabled={isSubmittingMutation}
                                    className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                    title="Nâng cấp lên Quản trị viên"
                                    aria-label={`Cấp Admin cho ${row.displayName}`}
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>Cấp Admin</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPendingAction({ type: 'DEMOTE', user: row })}
                                    disabled={isSubmittingMutation}
                                    className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                    title="Hạ quyền xuống Người dùng"
                                    aria-label={`Hạ quyền Admin của ${row.displayName}`}
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                    <span>Hạ quyền</span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* Status Actions */}
                            {!isSelf && row.status !== 'DEACTIVATED' && (
                              <>
                                {row.status === 'ACTIVE' && (
                                  <button
                                    type="button"
                                    onClick={() => setPendingAction({ type: 'SUSPEND', user: row })}
                                    disabled={isSubmittingMutation}
                                    className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                    title="Khóa tài khoản tạm thời"
                                    aria-label={`Khóa tài khoản ${row.displayName}`}
                                  >
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Khóa</span>
                                  </button>
                                )}

                                {row.status === 'SUSPENDED' && (
                                  <button
                                    type="button"
                                    onClick={() => setPendingAction({ type: 'ACTIVATE', user: row })}
                                    disabled={isSubmittingMutation}
                                    className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                    title="Mở khóa tài khoản"
                                    aria-label={`Mở khóa tài khoản ${row.displayName}`}
                                  >
                                    <Unlock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Mở khóa</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setPendingAction({ type: 'DEACTIVATE', user: row })}
                                  disabled={isSubmittingMutation}
                                  className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                  title="Vô hiệu hóa vĩnh viễn"
                                  aria-label={`Vô hiệu hóa tài khoản ${row.displayName}`}
                                >
                                  <UserX className="w-3.5 h-3.5 shrink-0" />
                                  <span>Vô hiệu hóa</span>
                                </button>
                              </>
                            )}

                            {/* Self user safeguard label */}
                            {isSelf && (
                              <span className="text-[11px] text-slate-400 italic px-2">
                                (Tài khoản hiện tại)
                              </span>
                            )}

                            {/* Deactivated account terminal state notice */}
                            {!isSelf && row.status === 'DEACTIVATED' && (
                              <span className="text-[11px] text-slate-400 italic px-2">
                                Đã vô hiệu hóa
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && !isError && totalPages > 0 && (
            <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-slate-600">
                <span>
                  Trang <strong className="text-slate-900">{page + 1}</strong> / {totalPages || 1}
                  {' '}(Tổng số <strong className="text-slate-900">{totalElements}</strong> người dùng)
                </span>

                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                  <span className="text-slate-500">Hiển thị:</span>
                  <select
                    value={size}
                    onChange={(e) => {
                      setSize(Number(e.target.value));
                      setPage(0);
                    }}
                    className="py-1 px-2 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    aria-label="Chọn số lượng hiển thị trên trang"
                  >
                    <option value={10}>10 / trang</option>
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                  </select>
                </div>
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0 || isFetching}
                  className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Trang trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || isFetching}
                  className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Trang sau"
                >
                  <span className="whitespace-nowrap">Trang sau</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailUserId(null);
        }}
        userId={detailUserId}
      />

      {/* Confirmation Dialog for Role & Status Mutations */}
      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        onClose={() => {
          if (!isSubmittingMutation) {
            setPendingAction(null);
          }
        }}
        onConfirm={handleConfirmAction}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmText={dialogConfig.confirmText}
        cancelText="Hủy bỏ"
        variant={dialogConfig.variant}
        isLoading={isSubmittingMutation}
      />
    </div>
  );
}

export default AdminUsersPage;