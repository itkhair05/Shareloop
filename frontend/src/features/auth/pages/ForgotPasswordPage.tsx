import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../schemas/auth-schemas';
import { authApi } from '../api/auth-api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ApiError } from '@/lib/api-error';

export function ForgotPasswordPage() {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setGeneralError(null);
    try {
      await authApi.forgotPassword({ email: data.email });
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setGeneralError(
            err.message || 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.'
          );
        } else if (err.isNetworkError) {
          setGeneralError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.');
        } else {
          setGeneralError(err.message || 'Đã xảy ra lỗi ngoài ý muốn. Vui lòng thử lại.');
        }
      } else {
        setGeneralError('Đã xảy ra lỗi ngoài ý muốn. Vui lòng thử lại.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <div className="w-full max-w-md space-y-6">
        {/* Page Header (Đã bỏ Logo và tên ShareLoop) */}
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quên mật khẩu?</h1>
          <p className="text-sm text-slate-600">
            Đừng lo lắng, chúng tôi sẽ hỗ trợ gửi liên kết đặt lại mật khẩu về email của bạn.
          </p>
        </div>

        {/* Card Body */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              {isSuccess ? 'Yêu cầu đã được tiếp nhận' : 'Đặt lại mật khẩu'}
            </h2>
            <p className="text-xs text-slate-500">
              {isSuccess
                ? 'Vui lòng kiểm tra hộp thư điện tử của bạn'
                : 'Nhập địa chỉ email đăng ký tài khoản của bạn để tiếp tục'}
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
                      Đã gửi hướng dẫn đặt lại mật khẩu!
                    </p>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Nếu địa chỉ <strong>{submittedEmail}</strong> được liên kết với một tài khoản ShareLoop,
                      chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến (và thư mục rác).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                  <p className="font-medium text-slate-800">Lưu ý bảo mật:</p>
                  <p>• Liên kết đặt lại mật khẩu chỉ có hiệu lực trong vòng <strong>15 phút</strong>.</p>
                  <p>• Nếu không nhận được thư, hãy kiểm tra lại địa chỉ email hoặc thử lại sau.</p>
                </div>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại trang Đăng nhập
                  </Link>
                </div>
              </div>
            ) : (
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
                  label="Địa chỉ email tài khoản"
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  error={errors.email?.message}
                  {...register('email')}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  leftIcon={<Mail className="w-4 h-4" />}
                  className="w-full mt-2"
                >
                  Gửi liên kết đặt lại mật khẩu
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <p className="text-center text-sm text-slate-600">
          Nhớ lại mật khẩu của bạn?{' '}
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

export default ForgotPasswordPage;