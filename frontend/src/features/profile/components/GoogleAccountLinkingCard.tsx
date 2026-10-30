import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Link2, ShieldCheck, X } from 'lucide-react';
import { authApi } from '@/features/auth/api/auth-api';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/Feedback';
import { ApiError } from '@/lib/api-error';
import type { GoogleAccountStatusResponse } from '@/types/auth';

function formatLinkedDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function GoogleAccountLinkingCard() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery<GoogleAccountStatusResponse, ApiError>({
    queryKey: ['google-account-status'],
    queryFn: () => authApi.getGoogleAccountStatus(),
  });

  const linkMutation = useMutation({
    mutationFn: (idToken: string) => authApi.linkGoogleAccount({ idToken }),
    onSuccess: (data) => {
      setErrorMessage(null);
      setSuccessMessage('Liên kết tài khoản Google thành công!');
      queryClient.setQueryData(['google-account-status'], data);
      queryClient.invalidateQueries({ queryKey: ['google-account-status'] });
    },
    onError: (err: unknown) => {
      setSuccessMessage(null);
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const msg = (err.message || '').toLowerCase();
          if (msg.includes('another') || msg.includes('in use')) {
            setErrorMessage('Tài khoản Google này đã được liên kết với một tài khoản ShareLoop khác.');
          } else if (msg.includes('already linked')) {
            setErrorMessage('Tài khoản ShareLoop của bạn đã được liên kết với một tài khoản Google.');
          } else {
            setErrorMessage('Tài khoản đã được liên kết hoặc xảy ra xung đột dữ liệu.');
          }
        } else if (err.status === 429) {
          setErrorMessage('Quá nhiều yêu cầu liên kết. Vui lòng thử lại sau 1 phút.');
        } else if (err.isUnauthorized) {
          setErrorMessage('Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.');
        } else {
          setErrorMessage('Không thể liên kết tài khoản Google. Vui lòng thử lại.');
        }
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định khi liên kết tài khoản.');
      }
    },
  });

  const handleLinkSuccess = async (idToken: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await linkMutation.mutateAsync(idToken);
    } catch {
      // Error is gracefully formatted and displayed by linkMutation.onError
    }
  };

  return (
    <Card className="border border-slate-200 shadow-xs bg-white">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Link2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Liên kết tài khoản mạng xã hội</h2>
              <p className="text-xs text-slate-500">Quản lý các tài khoản bên ngoài dùng để đăng nhập nhanh</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-medium animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center justify-between text-xs font-medium animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800 p-0.5 rounded cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-6 text-center">
            <LoadingSpinner size="sm" label="Đang kiểm tra trạng thái liên kết Google..." />
          </div>
        )}

        {/* Query Error State */}
        {isError && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-600">Không thể kiểm tra trạng thái liên kết tài khoản.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
            >
              Thử tải lại
            </button>
          </div>
        )}

        {/* Status Display and Actions */}
        {!isLoading && !isError && status && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 sm:p-4 rounded-xl border border-slate-100 bg-slate-50/60 overflow-hidden">
            {/* Left: Google branding & user metadata */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">Google</span>
                  {status.linked ? (
                    <Badge variant="success" withDot className="font-medium text-xs">
                      Đã liên kết
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="font-medium text-xs">
                      Chưa liên kết
                    </Badge>
                  )}
                </div>

                {status.linked ? (
                  <div className="space-y-0.5 text-xs text-slate-500">
                    <p className="text-slate-700 font-medium">{status.email}</p>
                    <p>Liên kết vào: {formatLinkedDate(status.linkedAt)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Liên kết tài khoản Google để đăng nhập an toàn, nhanh chóng bằng một chạm.
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="w-full min-w-0 sm:w-auto sm:min-w-[280px] self-start sm:self-center">
              {status.linked ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Bảo mật liên kết đang hoạt động</span>
                </div>
              ) : (
                <GoogleSignInButton
                  mode="link"
                  onSuccess={handleLinkSuccess}
                  onError={(err) => setErrorMessage(err.message)}
                  disabled={linkMutation.isPending}
                  width="100%"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}