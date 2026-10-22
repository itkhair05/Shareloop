import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  ShieldAlert,
  FolderTree,
  MessageSquareWarning,
  LayoutDashboard,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const adminNavItems = [
    {
      to: '/admin',
      label: 'Tổng quan quản trị',
      icon: LayoutDashboard,
      end: true,
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
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 text-slate-900 antialiased">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
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

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'bg-slate-900 text-slate-100 w-full md:w-64 shrink-0 flex flex-col border-r border-slate-800 transition-all',
          isSidebarOpen ? 'block' : 'hidden md:flex'
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
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
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 flex-1">
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
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer — Return to Public Application */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <Badge variant="warning" className="w-full justify-center">
            Vai trò: Quản trị viên
          </Badge>
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors p-1 rounded-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại ứng dụng chính</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Bảng điều khiển quản trị</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Khu vực quản lý dành riêng cho kiểm duyệt danh mục và đánh giá cộng đồng
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">Hệ thống: Spring Boot 3</span>
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
