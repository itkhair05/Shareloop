import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context';
import { loginSchema, type LoginFormData } from '../schemas/auth-schemas';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ApiError } from '@/lib/api-error';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Intended destination after successful login
  const fromLocation = (location.state as { from?: Location })?.from;
  const fromPath = fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search || ''}` : '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // If already authenticated, redirect to target destination
  useEffect(() => {
    if (isAuthenticated) {
      navigate(fromPath, { replace: true });
    }
  }, [isAuthenticated, navigate, fromPath]);

  if (isAuthenticated) {
    return null;
  }

  const onSubmit = async (data: LoginFormData) => {
    setGeneralError(null);
    try {
      await login(data);
      navigate(fromPath, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized) {
          setGeneralError('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin.');
        } else if (err.isForbidden) {
          setGeneralError(err.message || 'Tài khoản của bạn đã bị tạm khóa hoặc vô hiệu hóa. Vui lòng liên hệ hỗ trợ.');
        } else if (err.isNetworkError) {
          setGeneralError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.');
        } else {
          setGeneralError(err.message || 'Đã xảy ra lỗi ngoài ý muốn khi đăng nhập. Vui lòng thử lại.');
        }
      } else {
        setGeneralError('Đã xảy ra lỗi ngoài ý muốn. Vui lòng thử lại.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <div className="w-full max-w-md space-y-6">
        {/* Brand & Page Header */}
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chào mừng trở lại</h1>
          <p className="text-sm text-slate-600">
            Đăng nhập vào tài khoản của bạn để chia sẻ đồ dùng và kết nối cùng cộng đồng dân cư.
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-slate-900">Đăng nhập</h2>
            <p className="text-xs text-slate-500">Nhập địa chỉ email và mật khẩu của bạn bên dưới</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* General API Error Banner */}
              {generalError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5 text-sm"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-snug">{generalError}</span>
                </div>
              )}

              {/* Email Field */}
              <Input
                label="Địa chỉ email"
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                disabled={isSubmitting}
                error={errors.email?.message}
                {...register('email')}
              />

              {/* Password Field with Show/Hide Toggle */}
              <Input
                label="Mật khẩu"
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                error={errors.password?.message}
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

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                leftIcon={<LogIn className="w-4 h-4" />}
                className="w-full mt-2"
              >
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <p className="text-center text-sm text-slate-600">
          Chưa có tài khoản?{' '}
          <Link
            to="/register"
            className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
          >
            Đăng ký tài khoản mới
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
