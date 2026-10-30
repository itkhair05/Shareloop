import { useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ChangePasswordModal } from './ChangePasswordModal';
import { SetPasswordModal } from './SetPasswordModal';
import type { UserProfile } from '@/types/auth';

export interface PasswordManagementCardProps {
  user: UserProfile;
  onSuccess?: (message: string) => void;
}

export function PasswordManagementCard({
  user,
  onSuccess,
}: PasswordManagementCardProps) {
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [isSetModalOpen, setIsSetModalOpen] = useState(false);

  const shouldShowPasswordManagement =
    user.role === 'ADMIN' || Boolean(user.hasPassword);

  if (!shouldShowPasswordManagement) {
    return null;
  }

  const hasPassword = Boolean(user.hasPassword);

  const handlePasswordSuccess = (message: string) => {
    onSuccess?.(message);
  };

  return (
    <>
      <Card
        className="border border-slate-200 shadow-xs bg-white"
        data-testid="password-management-card"
      >
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Mật khẩu & Bảo mật tài khoản
                </h2>
                <p className="text-xs text-slate-500">
                  Quản lý mật khẩu đăng nhập email và bảo vệ tài khoản ShareLoop
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/60">
            {/* Left: Password status icon & description */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 text-slate-700">
                {hasPassword ? (
                  <Lock className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-amber-600" aria-hidden="true" />
                )}
              </div>

              <div className="space-y-1">
                {/* Thêm flex-wrap để Badge tự xuống dòng khi thiếu chỗ */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Mật khẩu đăng nhập</span>
                  {hasPassword ? (
                    <Badge variant="success" withDot className="font-medium text-xs whitespace-nowrap">
                      Đã có mật khẩu
                    </Badge>
                  ) : (
                    <Badge variant="warning" withDot className="font-medium text-xs whitespace-nowrap">
                      Chưa thiết lập mật khẩu
                    </Badge>
                  )}
                </div>

                {hasPassword ? (
                  <p className="text-xs text-slate-500">
                    Tài khoản của bạn đã được thiết lập mật khẩu. Bạn có thể thay đổi mật khẩu định kỳ để nâng cao bảo mật.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Tài khoản Quản trị viên chưa có mật khẩu đăng nhập qua email. Hãy thiết lập mật khẩu ban đầu để đảm bảo an toàn truy cập.
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="shrink-0 self-start sm:self-center">
              {hasPassword ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangeModalOpen(true)}
                  leftIcon={<Lock className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  className="shadow-2xs whitespace-nowrap"
                  data-testid="change-password-button"
                >
                  Đổi mật khẩu
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsSetModalOpen(true)}
                  leftIcon={<KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  className="shadow-xs whitespace-nowrap"
                  data-testid="set-password-button"
                >
                  Thiết lập mật khẩu
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Modal */}
      {hasPassword && (
        <ChangePasswordModal
          isOpen={isChangeModalOpen}
          onClose={() => setIsChangeModalOpen(false)}
          onSuccess={(msg) => handlePasswordSuccess(msg)}
        />
      )}

      {/* Set Password Modal for ADMIN without password */}
      {!hasPassword && user.role === 'ADMIN' && (
        <SetPasswordModal
          isOpen={isSetModalOpen}
          onClose={() => setIsSetModalOpen(false)}
          onSuccess={(msg) => handlePasswordSuccess(msg)}
        />
      )}
    </>
  );
}

export default PasswordManagementCard;