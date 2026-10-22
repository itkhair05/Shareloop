import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../context';
import { registerSchema, type RegisterFormData } from '../schemas/auth-schemas';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ApiError } from '@/lib/api-error';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  const onSubmit = async (data: RegisterFormData) => {
    setGeneralError(null);
    try {
      await registerUser({
        displayName: data.displayName,
        email: data.email,
        password: data.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('email', {
            type: 'manual',
            message: 'Địa chỉ email này đã được sử dụng.',
          });
          setGeneralError('Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng email khác.');
        } else if (err.isValidationError && err.fieldErrors) {
          Object.entries(err.fieldErrors).forEach(([field, msg]) => {
            if (field === 'displayName' || field === 'email' || field === 'password') {
              setError(field as keyof RegisterFormData, {
                type: 'server',
                message: msg,
              });
            }
          });
          setGeneralError(err.message || 'Vui lòng kiểm tra lại các trường được đánh dấu.');
        } else if (err.isNetworkError) {
          setGeneralError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.');
        } else {
          setGeneralError(err.message || 'Đăng ký không thành công. Vui lòng thử lại.');
        }
      } else {
        setGeneralError('Đã xảy ra lỗi ngoài ý muốn khi đăng ký. Vui lòng thử lại.');
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tạo tài khoản mới</h1>
          <p className="text-sm text-slate-600">
            Tham gia ShareLoop để chia sẻ, cho tặng và trao đổi đồ dùng gia đình cùng hàng xóm.
          </p>
        </div>

        {/* Register Form Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-slate-900">Đăng ký</h2>
            <p className="text-xs text-slate-500">Vui lòng điền đầy đủ các thông tin bên dưới</p>
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

              {/* Display Name Field */}
              <Input
                label="Họ và tên hoặc tên hiển thị"
                id="register-displayName"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                disabled={isSubmitting}
                error={errors.displayName?.message}
                {...register('displayName')}
              />

              {/* Email Field */}
              <Input
                label="Địa chỉ email"
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                disabled={isSubmitting}
                error={errors.email?.message}
                {...register('email')}
              />

              {/* Password Field */}
              <Input
                label="Mật khẩu (tối thiểu 8 ký tự)"
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

              {/* Confirm Password Field */}
              <Input
                label="Xác nhận mật khẩu"
                id="register-confirmPassword"
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
                    aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
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
                leftIcon={<UserPlus className="w-4 h-4" />}
                className="w-full mt-2"
              >
                Tạo tài khoản
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <p className="text-center text-sm text-slate-600">
          Đã có tài khoản?{' '}
          <Link
            to="/login"
            className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
