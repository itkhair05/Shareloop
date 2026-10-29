import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordFormData } from '../schemas/auth-schemas';
import { authApi } from '../api/auth-api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ApiError } from '@/lib/api-error';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // In-memory token storage (never persisted to localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [isTokenMissing, setIsTokenMissing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isExpiredToken, setIsExpiredToken] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Track initialization to strip query parameter once
  const tokenInitializedRef = useRef(false);

  useEffect(() => {
    if (tokenInitializedRef.current) return;
    tokenInitializedRef.current = true;

    // 1. Extract token from URL search parameter or navigation state
    const queryToken = searchParams.get('token');
    const stateToken = (location.state as { token?: string })?.token;
    const extractedToken = queryToken || stateToken;

    if (!extractedToken || extractedToken.trim() === '') {
      setIsTokenMissing(true);
      return;
    }

    const cleanToken = extractedToken.trim();
    setToken(cleanToken);

    // 2. Token URL Safety: Strip token from visible browser URL immediately
    // to prevent leakage via browser history, shoulder surfing, or referrer headers
    if (queryToken) {
      // Using window.history.replaceState preserves in-memory React state while updating the address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams, location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setIsTokenMissing(true);
      return;
    }

    setGeneralError(null);
    setIsExpiredToken(false);

    try {
      // Send ONLY token and newPassword. Never send confirmPassword to backend.
      await authApi.resetPassword({
        token,
        newPassword: data.password,
      });

      // Clear in-memory token on success
      setToken(null);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setIsExpiredToken(true);
          setGeneralError(
            err.message || 'Liên kết đặt lại mật khẩu không hợp lệ, đã được sử dụng hoặc đã hết hạn.'
          );
        } else if (err.status === 429) {
          setGeneralError(
            err.message || 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.'
          );
        } else if (err.isNetworkError) {
          setGeneralError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.');
        } else {
          setGeneralError(err.message || 'Đã xảy ra lỗi ngoài ý muốn khi đặt lại mật khẩu.');
        }
      } else {
        setGeneralError('Đã xảy ra lỗi ngoài ý muốn. Vui lòng thử lại.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
                <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                <path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-slate-950 tracking-tight">ShareLoop</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tạo mật khẩu mới</h1>
          <p className="text-sm text-slate-600">
            Thiết lập mật khẩu mới an toàn cho tài khoản ShareLoop của bạn.
          </p>
        </div>

        {/* Main Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              {isSuccess
                ? 'Thành công!'
                : isTokenMissing || isExpiredToken
                ? 'Liên kết không hợp lệ'
                : 'Đặt lại mật khẩu'}
            </h2>
            <p className="text-xs text-slate-500">
              {isSuccess
                ? 'Mật khẩu của bạn đã được cập nhật'
                : isTokenMissing || isExpiredToken
                ? 'Vui lòng kiểm tra lại liên kết hoặc yêu cầu mã mới'
                : 'Nhập mật khẩu mới của bạn có độ dài từ 8 đến 100 ký tự'}
            </p>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-4">
                <div
                  role="status"
                  className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 text-sm"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium text-emerald-950">
                      Đặt lại mật khẩu thành công!
                    </p>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Mật khẩu của bạn đã được cập nhật an toàn. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới của mình.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/login')}
                    className="w-full"
                  >
                    Đăng nhập ngay
                  </Button>
                </div>
              </div>
            ) : isTokenMissing ? (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-sm"
                >
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium text-amber-950">
                      Thiếu mã xác thực đặt lại mật khẩu
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Liên kết bạn vừa truy cập không chứa mã xác thực hợp lệ hoặc trang đã được tải lại sau khi mã được bảo mật.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Link
                    to="/forgot-password"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Yêu cầu liên kết đặt lại mật khẩu mới
                  </Link>
                  <Link
                    to="/login"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại trang Đăng nhập
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                {/* General or Expired API Error Banner */}
                {generalError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="leading-snug">{generalError}</p>
                      {isExpiredToken && (
                        <Link
                          to="/forgot-password"
                          className="inline-block text-xs font-semibold underline text-red-700 hover:text-red-900 mt-1"
                        >
                          Bấm vào đây để yêu cầu liên kết mới
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* New Password Field */}
                <Input
                  label="Mật khẩu mới"
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  error={errors.password?.message}
                  helperText="Tối thiểu 8 ký tự, tối đa 100 ký tự"
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-1 cursor-pointer"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  }
                  {...register('password')}
                />

                {/* Confirm Password Field */}
                <Input
                  label="Xác nhận mật khẩu mới"
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  error={errors.confirmPassword?.message}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-1 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  }
                  {...register('confirmPassword')}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  leftIcon={<KeyRound className="w-4 h-4" />}
                  className="w-full mt-2"
                >
                  Lưu mật khẩu mới
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <p className="text-center text-sm text-slate-600">
          Nhớ lại mật khẩu hiện tại?{' '}
          <Link
            to="/login"
            className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
