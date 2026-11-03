import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { getTransactionProofErrorMessage } from '../utils/transaction-proof';

function apiError(status: number): ApiError {
  return new ApiError({ message: 'raw backend message', status, error: 'Error' });
}

describe('getTransactionProofErrorMessage', () => {
  it('ánh xạ 401 sang thông báo hết phiên đăng nhập', () => {
    expect(getTransactionProofErrorMessage(apiError(401))).toBe(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    );
  });

  it('ánh xạ 403 sang thông báo không có quyền', () => {
    expect(getTransactionProofErrorMessage(apiError(403))).toBe(
      'Bạn không có quyền tải tài liệu của giao dịch này.'
    );
  });

  it('ánh xạ 404 sang thông báo không tồn tại', () => {
    expect(getTransactionProofErrorMessage(apiError(404))).toBe(
      'Giao dịch không tồn tại hoặc đã bị xóa.'
    );
  });

  it('ánh xạ 409 sang thông báo giao dịch chưa hoàn tất', () => {
    expect(getTransactionProofErrorMessage(apiError(409))).toBe(
      'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.'
    );
  });

  it('ánh xạ lỗi khác (5xx, 0) sang thông báo chung', () => {
    expect(getTransactionProofErrorMessage(apiError(500))).toBe(
      'Không thể tải tài liệu giao dịch lúc này. Vui lòng thử lại.'
    );
    expect(getTransactionProofErrorMessage(apiError(0))).toBe(
      'Không thể tải tài liệu giao dịch lúc này. Vui lòng thử lại.'
    );
  });

  it('không bao giờ lộ thông báo lỗi thô của backend', () => {
    const message = getTransactionProofErrorMessage(apiError(409));
    expect(message).not.toContain('raw backend message');
  });

  it('ánh xạ lỗi không phải ApiError sang thông báo chung', () => {
    expect(getTransactionProofErrorMessage(new Error('boom'))).toBe(
      'Không thể tải tài liệu giao dịch lúc này. Vui lòng thử lại.'
    );
    expect(getTransactionProofErrorMessage(undefined)).toBe(
      'Không thể tải tài liệu giao dịch lúc này. Vui lòng thử lại.'
    );
  });
});
