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
          setGeneralError('Invalid email or password. Please check your credentials.');
        } else if (err.isForbidden) {
          setGeneralError(err.message || 'Your account is suspended or deactivated. Please contact support.');
        } else if (err.isNetworkError) {
          setGeneralError('Unable to reach the server. Please check your internet connection.');
        } else {
          setGeneralError(err.message || 'An unexpected error occurred during login. Please try again.');
        }
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-600">
            Sign in to your account to share items, chat, and connect with your local community.
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-slate-900">Sign In</h2>
            <p className="text-xs text-slate-500">Enter your email and password below</p>
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
                label="Email address"
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
                label="Password"
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
                    className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account yet?{' '}
          <Link
            to="/register"
            className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
