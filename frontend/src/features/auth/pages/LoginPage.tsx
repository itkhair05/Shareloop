import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Eye, EyeOff, LogIn, AlertCircle, Mail, ExternalLink } from 'lucide-react';
import { useAuth } from '../context';
import { loginSchema, type LoginFormData } from '../schemas/auth-schemas';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ApiError } from '@/lib/api-error';
import { resolvePostLoginDestination } from '../utils/auth-redirect';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

// Địa chỉ email hỗ trợ duy nhất
const SUPPORT_EMAIL = 'duongthekhai.work@gmail.com';

// Câu thông báo lỗi khi tài khoản bị khóa (dùng chung cho cả 2 luồng)
const ACCOUNT_LOCKED_MESSAGE = 
  'Tài khoản của bạn hiện không thể sử dụng do đã bị tạm khóa hoặc vô hiệu hóa. Vui lòng liên hệ Ban quản trị để được hỗ trợ thêm.';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, isAuthenticated, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [linkingRequiredInfo, setLinkingRequiredInfo] = useState<{ message: string } | null>(null);
  // State quản lý Modal gửi email
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Intended destination after successful login
  const fromLocation = (location.state as { from?: Location })?.from;

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

  // If already authenticated, redirect based on role or intended destination
  useEffect(() => {
    if (isAuthenticated) {
      const destination = resolvePostLoginDestination(fromLocation, user?.role);
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, fromLocation, user?.role]);

  if (isAuthenticated) {
    return null;
  }

  const handleGoogleSignIn = async (idToken: string) => {
    setGeneralError(null);
    setLinkingRequiredInfo(null);
    setIsGoogleLoading(true);
    try {
      if (!loginWithGoogle) {
        throw new Error('Đăng nhập Google chưa sẵn sàng');
      }
      const response = await loginWithGoogle(idToken);
      const destination = resolvePostLoginDestination(fromLocation, response.role);
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // AccountLinkingRequiredException
          setLinkingRequiredInfo({
            message:
              'Tài khoản với email này đã được đăng ký bằng mật khẩu. Vui lòng nhập email và mật khẩu bên dưới để đăng nhập, sau đó liên kết tài khoản Google trong phần Hồ sơ.',
          });
        } else if (err.isForbidden) {
          // Dùng câu thông báo mới
          setGeneralError(ACCOUNT_LOCKED_MESSAGE);
        } else if (err.isUnauthorized) {
          setGeneralError('Xác thực với Google không thành công hoặc phiên đăng nhập đã hết hạn.');
        } else if (err.status === 503) {
          setGeneralError('Đăng nhập Google hiện đang bảo trì hoặc chưa được kích hoạt trên hệ thống.');
        } else if (err.status === 429) {
          setGeneralError(err.message || 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 1 phút.');
        } else if (err.isNetworkError) {
          setGeneralError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.');
        } else {
          setGeneralError(err.message || 'Đã xảy ra lỗi ngoài ý muốn khi đăng nhập bằng Google.');
        }
      } else {
        setGeneralError('Đã xảy ra lỗi ngoài ý muốn khi đăng nhập bằng Google.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setGeneralError(null);
    setLinkingRequiredInfo(null);
    try {
      const response = await login(data);
      const destination = resolvePostLoginDestination(fromLocation, response.role);
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized) {
          setGeneralError('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin.');
        } else if (err.isForbidden) {
          // Dùng câu thông báo mới
          setGeneralError(ACCOUNT_LOCKED_MESSAGE);
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

  // Xác định xem lỗi hiện tại có phải là lỗi khóa tài khoản không (để hiện nút email)
  const isAccountLockedError = 
    generalError?.includes('không thể sử dụng') || 
    generalError?.includes('tạm khóa') || 
    generalError?.includes('vô hiệu hóa');

  // Nội dung email soạn sẵn
  const emailSubject = encodeURIComponent('Yêu cầu hỗ trợ mở khóa tài khoản ShareLoop');
  const emailBody = encodeURIComponent(
    'Xin chào Ban quản trị,\n\nTài khoản của tôi đã bị tạm khóa/vô hiệu hóa. Tôi mong muốn được hỗ trợ để khôi phục tài khoản.\n\nEmail đăng nhập: [Điền email của bạn]\nLý do (nếu có): '
  );

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <div className="w-full max-w-md space-y-6">
        {/* Page Header (Đã bỏ Logo và tên ShareLoop) */}
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chào mừng trở lại</h1>
          <p className="text-sm text-slate-600">
            Đăng nhập vào tài khoản của bạn để chia sẻ đồ dùng và kết nối cùng cộng đồng dân cư.
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-slate-900">Đăng nhập</h2>
            <p className="text-xs text-slate-500">Chọn phương thức đăng nhập tiện lợi nhất cho bạn</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Account Linking Required Alert (HTTP 409) */}
            {linkingRequiredInfo && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-sm"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950">Yêu cầu đăng nhập bằng mật khẩu</p>
                  <p className="leading-snug text-xs text-amber-800">{linkingRequiredInfo.message}</p>
                </div>
              </div>
            )}

            {/* General API Error Banner */}
            {generalError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 flex flex-col gap-2.5 text-sm"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-snug">{generalError}</span>
                </div>

                {/* Nút mở Modal gửi email hỗ trợ */}
                {isAccountLockedError && (
                  <div className="ml-7">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 font-medium text-xs rounded-md border border-red-200 hover:bg-red-50 transition-colors w-max"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Gửi email hỗ trợ
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Google Sign-In Option */}
            <div className="space-y-2">
              <GoogleSignInButton
                mode="signin"
                onSuccess={handleGoogleSignIn}
                onError={(err) => setGeneralError(err.message)}
                disabled={isSubmitting || isGoogleLoading}
                width="100%"
              />
            </div>

            {/* Visual Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium tracking-wider">
                  hoặc đăng nhập với email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

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

              {/* Forgot Password Link */}
              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                >
                  Quên mật khẩu?
                </Link>
              </div>

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

      {/* Modal chọn cách gửi email */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Gửi email hỗ trợ</h3>
              <p className="text-xs text-slate-500 mt-1">Chọn cách thức bạn muốn liên hệ với Ban quản trị.</p>
            </div>

            <div className="space-y-2">
              {/* Lựa chọn 1: Mở App Email */}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`}
                onClick={() => setShowEmailModal(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Mở ứng dụng Email
              </a>

              {/* Lựa chọn 2: Mở Gmail Web */}
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${emailSubject}&body=${emailBody}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowEmailModal(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Mở Gmail trên Web
              </a>
            </div>

            {/* Nút Hủy */}
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 py-1"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;