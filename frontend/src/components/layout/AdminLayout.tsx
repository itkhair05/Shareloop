import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  FolderTree,
  MessageSquareWarning,
  LayoutDashboard,
  Users,
  LifeBuoy,
  ArrowLeftRight,
  ArrowLeft,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminNavItems = [
    {
      to: '/admin',
      label: 'Tổng quan quản trị',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/admin/transactions',
      label: 'Quản lý giao dịch',
      icon: ArrowLeftRight,
      end: false,
    },
    {
      to: '/admin/users',
      label: 'Quản lý người dùng',
      icon: Users,
      end: false,
    },
    {
      to: '/admin/categories',
      label: 'Danh mục ngành hàng',
      icon: FolderTree,
      end: false,
    },
    {
      to: '/admin/reviews',
      label: 'Kiểm duyệt đánh giá',
      icon: MessageSquareWarning,
      end: false,
    },
    {
      to: '/admin/reports',
      label: 'Báo cáo vi phạm',
      icon: ShieldAlert,
      end: false,
    },
    {
      to: '/admin/support-requests',
      label: 'Hỗ trợ người dùng',
      icon: LifeBuoy,
      end: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 text-slate-900 antialiased">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-sm tracking-wide">Quản trị ShareLoop</span>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 cursor-pointer"
          aria-label={isSidebarOpen ? 'Đóng thanh điều hướng quản trị' : 'Mở thanh điều hướng quản trị'}
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* SIDEBAR - Cố định (Fixed) trên màn hình Desktop */}
      <aside
        className={cn(
          'bg-slate-900 text-slate-100 w-full md:w-64 shrink-0 flex-col border-r border-slate-800 transition-all z-40',
          'md:fixed md:inset-y-0 md:left-0 md:h-screen md:flex', // Cố định sidebar trên desktop
          isSidebarOpen ? 'flex fixed inset-0 h-screen z-50' : 'hidden md:flex'
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Bảng quản trị
              </h2>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Nội bộ ShareLoop
              </span>
            </div>
          </div>
          {/* Nút đóng menu trên Mobile */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Có thể cuộn nếu quá dài) */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer — CỐ ĐỊNH DƯỚI CÙNG, KHÔNG BỊ TRÔI */}
        <div className="p-4 border-t border-slate-800 shrink-0 space-y-3 bg-slate-900">
          <Badge variant="warning" className="w-full justify-center">
            Vai trò: Quản trị viên
          </Badge>
          
          {/* Nút Đăng xuất nhanh */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất tài khoản</span>
          </button>

          {/* Nút Quay lại ứng dụng chính */}
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/50"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Quay lại ứng dụng chính</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Bảng điều khiển quản trị</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống giám sát dữ liệu, kiểm duyệt nội dung và hỗ trợ cộng đồng
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900">{user.displayName}</div>
                <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
              </div>
            )}
            <Badge variant="warning" className="text-xs">
              Quản trị viên
            </Badge>
          </div>
        </header>

        <main className="p-6 flex-1 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;