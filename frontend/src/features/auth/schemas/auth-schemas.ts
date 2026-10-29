import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập địa chỉ email')
    .email('Vui lòng nhập địa chỉ email hợp lệ')
    .max(255, 'Email không được vượt quá 255 ký tự'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(1, 'Vui lòng nhập tên hiển thị')
      .min(2, 'Tên hiển thị phải có ít nhất 2 ký tự')
      .max(100, 'Tên hiển thị không được vượt quá 100 ký tự'),
    email: z
      .string()
      .min(1, 'Vui lòng nhập địa chỉ email')
      .email('Vui lòng nhập địa chỉ email hợp lệ')
      .max(255, 'Email không được vượt quá 255 ký tự'),
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu')
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .max(100, 'Mật khẩu không được vượt quá 100 ký tự'),
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập địa chỉ email')
    .email('Vui lòng nhập địa chỉ email hợp lệ')
    .max(255, 'Email không được vượt quá 255 ký tự'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu mới')
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .max(100, 'Mật khẩu không được vượt quá 100 ký tự'),
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
