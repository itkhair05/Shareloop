import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Shield, LogIn, LogOut, User as UserIcon, Plus, Bell, MessageSquare, Home, Compass, List, ArrowLeftRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth';
import { NotificationBell, useUnreadNotificationCount } from '@/features/notifications';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { data: unreadData } = useUnreadNotificationCount({ enabled: isAuthenticated });
  const unreadCount = unreadData?.unreadCount ?? 0;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'text-xs xl:text-sm font-medium transition-colors px-2 xl:px-2.5 py-1.5 rounded-md whitespace-nowrap shrink-0 inline-flex items-center',
      isActive
        ? 'text-emerald-700 bg-emerald-50 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    );

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    // 1. Thẻ header: z-50, KHÔNG có overflow-x-hidden ở đây
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xs border-b border-slate-200">
      {/* 2. Thẻ bọc nội dung: Dùng overflow-x-auto để chặn cuộn ngang nhưng vẫn cho dropdown tràn xuống */}
      <div className="w-full overflow-x-auto overflow-y-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-1 xl:gap-2 flex-nowrap">
            
            {/* Brand Logo & Title */}
            <Link
              to="/"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1 shrink-0 whitespace-nowrap"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 shrink-0">
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                  <path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
                </svg>
              </div>
              <div className="flex flex-col shrink-0">
                <span className="text-lg font-bold text-slate-950 tracking-tight leading-none whitespace-nowrap">
                  ShareLoop
                </span>
                <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mt-0.5 whitespace-nowrap">
                  Sẻ chia cộng đồng
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Menu ở giữa */}
            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 shrink-0 flex-nowrap">
              <NavLink to="/" end className={navLinkClass}>Trang chủ</NavLink>
              <NavLink to="/explore" className={navLinkClass}>Khám phá</NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/my-listings" className={navLinkClass}>Bài đăng của tôi</NavLink>
                  <NavLink to="/transactions" className={navLinkClass}>Giao dịch</NavLink>
                  <NavLink to="/messages" className={navLinkClass}>Tin nhắn</NavLink>
                </>
              )}
              <NavLink to="/about" className={navLinkClass}>Trợ giúp</NavLink>
            </nav>

            {/* Desktop Right Action - Các nút bên phải */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-2 shrink-0 flex-nowrap">
              {isAuthenticated ? (
                <div className="flex items-center gap-1 xl:gap-2 shrink-0 flex-nowrap">
                  
                  {/* Nút Đăng bài: CHỈ HIỂN THỊ VỚI USER THƯỜNG, ẨN VỚI ADMIN */}
                  {!isAdmin && (
                    <Link
                      to="/listings/new"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 xl:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap hidden 2xl:inline">Đăng bài</span>
                    </Link>
                  )}

                  {/* Chuông thông báo */}
                  <div className="shrink-0 flex items-center justify-center">
                    <NotificationBell />
                  </div>

                  {/* Nút Bảng quản trị: Thu gọn Icon trên màn hình vừa, hiện text trên màn hình rất lớn */}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 xl:px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shrink-0 whitespace-nowrap"
                      title="Bảng quản trị"
                    >
                      <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="whitespace-nowrap hidden 2xl:inline">Bảng quản trị</span>
                    </Link>
                  )}

                  {/* Khối User Profile */}
                  <Link
                    to="/profile"
                    aria-label="Xem hồ sơ cá nhân"
                    className="inline-flex items-center gap-1.5 xl:gap-2 px-2 xl:px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0 whitespace-nowrap"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <UserIcon className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    
                    {/* Tên User: Ẩn trên màn hình vừa, hiện trên màn hình lớn */}
                    <span className="text-xs font-semibold text-slate-800 max-w-[120px] truncate whitespace-nowrap hidden xl:inline">
                      {user?.displayName}
                    </span>
                    
                    {/* Huy hiệu Admin: Chỉ hiện trên màn hình rất lớn */}
                    {isAdmin && (
                      <Badge variant="warning" className="text-[10px] px-1.5 py-0 shrink-0 whitespace-nowrap hidden 2xl:inline-flex">
                        Quản trị viên
                      </Badge>
                    )}
                  </Link>

                  {/* Nút Đăng xuất: Thu gọn thành Icon ở màn hình vừa */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 xl:px-3 py-1.5 rounded-lg transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="whitespace-nowrap hidden xl:inline">Đăng xuất</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 whitespace-nowrap"
                  >
                    <LogIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="whitespace-nowrap">Đăng nhập</span>
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0 whitespace-nowrap"
                  >
                    <span className="whitespace-nowrap">Đăng ký</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Right Action / Bell + Hamburger */}
            <div className="flex items-center gap-1 lg:hidden shrink-0">
              {isAuthenticated && <NotificationBell />}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shrink-0"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6 shrink-0" aria-hidden="true" />
                ) : (
                  <Menu className="w-6 h-6 shrink-0" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-1">
          <NavLink
            to="/"
            end
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                isActive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Trang chủ</span>
          </NavLink>
          <NavLink
            to="/explore"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                isActive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Khám phá</span>
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink
                to="/my-listings"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                    isActive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  )
                }
              >
                <List className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Bài đăng của tôi</span>
              </NavLink>
              <NavLink
                to="/transactions"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                    isActive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  )
                }
              >
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Giao dịch</span>
              </NavLink>
              <NavLink
                to="/messages"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                    isActive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  )
                }
              >
                <MessageSquare className="w-5 h-5 text-slate-500 shrink-0" />
                <span className="whitespace-nowrap">Tin nhắn</span>
              </NavLink>
              <NavLink
                to="/notifications"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                    isActive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  )
                }
              >
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Bell className="w-5 h-5 text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">Thông báo</span>
                </div>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-rose-600 rounded-full shrink-0">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            </>
          )}
          <NavLink
            to="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium whitespace-nowrap',
                isActive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Trợ giúp</span>
          </NavLink>

          <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
            {isAuthenticated ? (
              <>
                {!isAdmin && (
                  <Link
                    to="/listings/new"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Đăng bài mới</span>
                  </Link>
                )}

                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Xem hồ sơ cá nhân"
                  className="px-3 py-2 flex items-center justify-between rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <UserIcon className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 truncate whitespace-nowrap">
                      {user?.displayName}
                    </span>
                  </div>
                  {isAdmin && (
                    <Badge variant="warning" className="text-xs shrink-0 whitespace-nowrap">
                      Quản trị viên
                    </Badge>
                  )}
                </Link>

                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="whitespace-nowrap">Bảng quản trị</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50 text-left cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="whitespace-nowrap">Đăng xuất</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">Đăng nhập</span>
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">Đăng ký</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;