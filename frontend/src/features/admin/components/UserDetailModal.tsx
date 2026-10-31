import { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  Mail,
  Phone,
  RotateCcw,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { useAdminUserDetail } from '../hooks/use-admin-users';

export interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

export function UserDetailModal({ isOpen, onClose, userId }: UserDetailModalProps) {
  const titleId = useId();
  const descId = useId();
  const [copied, setCopied] = useState(false);

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminUserDetail(isOpen ? userId : null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is not available
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                Chi tiết tài khoản người dùng
              </h2>
              <p id={descId} className="text-xs text-slate-500">
                Thông tin hồ sơ, vai trò quản trị và trạng thái tài khoản
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="space-y-4" role="status" aria-label="Đang tải chi tiết người dùng">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-full animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Không thể tải thông tin người dùng</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {error?.message || 'Đã xảy ra lỗi khi truy xuất dữ liệu từ máy chủ.'}
              </p>
              <Button type="button" variant="outline" onClick={() => refetch()} className="cursor-pointer">
                <RotateCcw className="w-4 h-4 mr-1.5 shrink-0" />
                <span>Thử lại</span>
              </Button>
            </div>
          ) : user ? (
            <div className="space-y-4 text-xs">
              {/* User Identity Banner */}
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <Avatar
                  avatarUrl={user.avatarUrl}
                  name={user.displayName}
                  size="lg"
                  alt={`Ảnh đại diện của ${user.displayName}`}
                  className="shadow-xs"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {user.displayName}
                    </h3>
                    {user.role === 'ADMIN' && (
                      <Badge variant="default" className="text-[10px] font-semibold shrink-0">
                        Quản trị viên
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-500 truncate text-[11px] mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ID */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200 sm:col-span-2">
                  <div className="text-[11px] font-medium text-slate-500 mb-1">Mã định danh (ID)</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-800 break-all select-all">
                      {user.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(user.id)}
                      className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded transition-colors shrink-0 cursor-pointer"
                      title="Sao chép ID"
                      aria-label="Sao chép ID"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>Địa chỉ email</span>
                  </div>
                  <div className="font-medium text-slate-900 truncate" title={user.email}>
                    {user.email}
                  </div>
                </div>

                {/* Phone */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Số điện thoại</span>
                  </div>
                  <div className="font-medium text-slate-900">
                    {user.phoneNumber ? (
                      <span className="font-mono">{user.phoneNumber}</span>
                    ) : (
                      <span className="text-slate-400 italic">Chưa cập nhật</span>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                    <Shield className="w-3 h-3 text-slate-400" />
                    <span>Vai trò hệ thống</span>
                  </div>
                  <div>
                    {user.role === 'ADMIN' ? (
                      <Badge variant="default" className="text-[11px] font-semibold">
                        Quản trị viên (ADMIN)
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[11px] font-semibold">
                        Người dùng (USER)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 mb-1">Trạng thái tài khoản</div>
                  <div>
                    {user.status === 'ACTIVE' && (
                      <Badge variant="success" withDot className="text-[11px] font-semibold">
                        Đang hoạt động (ACTIVE)
                      </Badge>
                    )}
                    {user.status === 'SUSPENDED' && (
                      <Badge variant="warning" withDot className="text-[11px] font-semibold">
                        Bị khóa tạm thời (SUSPENDED)
                      </Badge>
                    )}
                    {user.status === 'DEACTIVATED' && (
                      <Badge variant="destructive" withDot className="text-[11px] font-semibold">
                        Vô hiệu hóa vĩnh viễn (DEACTIVATED)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Created At */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Ngày tham gia</span>
                  </div>
                  <div className="font-mono text-slate-700">
                    {formatDateTime(user.createdAt)}
                  </div>
                </div>

                {/* Updated At */}
                <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Cập nhật lần cuối</span>
                  </div>
                  <div className="font-mono text-slate-700">
                    {formatDateTime(user.updatedAt)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UserDetailModal;
