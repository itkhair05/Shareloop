import { ApiError } from '@/lib/api-error';

/**
 * Maps proof download failures to user-facing Vietnamese messages.
 * Raw backend messages are never displayed.
 */
export function getTransactionProofErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền tải tài liệu của giao dịch này.';
      case 404:
        return 'Giao dịch không tồn tại hoặc đã bị xóa.';
      case 409:
        return 'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.';
      default:
        return 'Không thể tải tài liệu giao dịch lúc này. Vui lòng thử lại.';
    }
  }
  return 'Không thể tải tài liệu giao dịch lúc này. Vui lòng thử lại.';
}
