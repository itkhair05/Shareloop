import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileDown,
  Layers,
  RotateCcw,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { useAdminTransactionDetail } from '../hooks/use-admin-transactions';
import { useTransactionProof } from '@/features/transactions/hooks/use-transaction-proof';
import type { AdminTransactionResponse } from '@/types/admin-transaction';

export interface TransactionDetailModalProps {
  transactionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCancelModal?: (tx: AdminTransactionResponse) => void;
}

export function TransactionDetailModal({
  transactionId,
  isOpen,
  onClose,
  onOpenCancelModal,
}: TransactionDetailModalProps) {
  const { data: detail, isLoading, isError, error, refetch } = useAdminTransactionDetail(
    isOpen ? transactionId : null
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const proofDownload = useTransactionProof();

  const handleDownloadProof = async () => {
    if (!detail) return;
    await proofDownload.downloadProof(detail.id);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  const canCancel = detail?.status === 'PENDING' || detail?.status === 'IN_PROGRESS';

  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'default';
      case 'CANCELLED':
        return 'destructive';
      case 'PENDING':
      default:
        return 'warning';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Hoàn tất';
      case 'IN_PROGRESS':
        return 'Đang diễn ra';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'PENDING':
      default:
        return 'Chờ xử lý';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-detail-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Layers className="w-5 h-5 shrink-0" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="transaction-detail-modal-title"
                  className="text-base font-bold text-slate-900 tracking-tight"
                >
                  Chi tiết giao dịch trao đổi
                </h2>
                {detail && (
                  <Badge variant={getStatusBadgeVariant(detail.status)} withDot>
                    {getStatusLabel(detail.status)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra thông tin hợp đồng trao đổi, tiến độ xác nhận hai chiều và nhật ký can thiệp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng chi tiết"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 bg-slate-100 rounded-lg" />
              <div className="h-32 bg-slate-100 rounded-lg" />
              <div className="h-28 bg-slate-100 rounded-lg" />
            </div>
          ) : isError || !detail ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-900">
                Không thể tải chi tiết giao dịch
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {error?.message || 'Có lỗi xảy ra khi truy vấn dữ liệu từ máy chủ.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-1.5 text-xs mt-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Section 1: Thông tin giao dịch */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Thông tin giao dịch</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px] mb-0.5">Mã giao dịch (UUID)</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-900 break-all select-all font-semibold">
                        {detail.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(detail.id, 'txId')}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                        title="Sao chép mã giao dịch"
                        aria-label="Sao chép mã giao dịch"
                      >
                        {copiedField === 'txId' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] mb-0.5">Thời gian khởi tạo</span>
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(detail.createdAt)}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] mb-0.5">Cập nhật lần cuối</span>
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(detail.updatedAt)}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] mb-0.5">Mã yêu cầu (Request ID)</span>
                    <span className="font-mono text-slate-700 break-all">
                      {detail.listingRequestId || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Bài đăng liên quan */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bài đăng liên quan</span>
                </h3>
                <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/70 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">Tiêu đề bài đăng</span>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {detail.listing?.title || 'Không có tiêu đề'}
                      </h4>
                    </div>
                    {detail.listing?.id && (
                      <Link
                        to={`/listings/${detail.listing.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                      >
                        <span>Xem bài đăng</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Mã bài đăng:</span>
                    <span className="font-mono text-slate-700">{detail.listing?.id || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Các bên tham gia */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Các bên tham gia</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Owner */}
                  <div className="p-3.5 rounded-lg border border-emerald-100 bg-emerald-50/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                        Người tặng / Chủ sở hữu
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        avatarUrl={detail.owner?.avatarUrl}
                        name={detail.owner?.displayName}
                        size="md"
                        alt={
                          detail.owner?.displayName
                            ? `Ảnh đại diện của ${detail.owner.displayName}`
                            : 'Ảnh đại diện người tặng'
                        }
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">
                          {detail.owner?.displayName || 'Chưa cập nhật'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {detail.owner?.id || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Requester */}
                  <div className="p-3.5 rounded-lg border border-blue-100 bg-blue-50/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
                        Người nhận / Yêu cầu
                      </span>
                      <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        avatarUrl={detail.requester?.avatarUrl}
                        name={detail.requester?.displayName}
                        size="md"
                        alt={
                          detail.requester?.displayName
                            ? `Ảnh đại diện của ${detail.requester.displayName}`
                            : 'Ảnh đại diện người nhận'
                        }
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">
                          {detail.requester?.displayName || 'Chưa cập nhật'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {detail.requester?.id || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Xác nhận hoàn tất hai chiều */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tiến độ xác nhận hai chiều (Dual-Party Confirmation)</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Owner Confirmation */}
                  <div
                    className={`p-3.5 rounded-lg border space-y-1.5 ${
                      detail.ownerCompleted
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Chủ sở hữu xác nhận
                      </span>
                      {detail.ownerCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Đã xác nhận
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> Chờ xác nhận
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {detail.ownerCompletedAt
                        ? `Xác nhận lúc: ${formatDateTime(detail.ownerCompletedAt)}`
                        : 'Chưa có xác nhận hoàn tất từ chủ sở hữu'}
                    </div>
                  </div>

                  {/* Requester Confirmation */}
                  <div
                    className={`p-3.5 rounded-lg border space-y-1.5 ${
                      detail.requesterCompleted
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Người nhận xác nhận
                      </span>
                      {detail.requesterCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Đã xác nhận
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> Chờ xác nhận
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {detail.requesterCompletedAt
                        ? `Xác nhận lúc: ${formatDateTime(detail.requesterCompletedAt)}`
                        : 'Chưa có xác nhận hoàn tất từ người nhận'}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  * Quy định nền tảng: Giao dịch chỉ tự động đạt trạng thái HOÀN TẤT khi cả hai bên tham gia đều đã xác nhận trao đổi thành công. Quản trị viên không thể xác nhận thay thế.
                </p>
              </div>

              {/* Section 5: Lịch sử hủy / Can thiệp (if CANCELLED) */}
              {detail.status === 'CANCELLED' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    <span>Lịch sử hủy giao dịch</span>
                  </h3>
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50/60 space-y-2.5 text-xs text-red-950">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-red-700 font-medium">Người thực hiện hủy:</span>{' '}
                        <span className="inline-flex items-center gap-1.5 font-semibold align-middle">
                          {detail.cancelledBy && (
                            <Avatar
                              avatarUrl={detail.cancelledBy.avatarUrl}
                              name={detail.cancelledBy.displayName}
                              size="xs"
                              alt={`Ảnh đại diện của ${detail.cancelledBy.displayName}`}
                            />
                          )}
                          <span>{detail.cancelledBy?.displayName || 'Hệ thống / Ẩn danh'}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-red-700 font-medium">Thời gian hủy:</span>{' '}
                        <span className="font-semibold">{detail.cancelledAt ? formatDateTime(detail.cancelledAt) : '—'}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-red-200/60">
                      <span className="text-[11px] text-red-700 font-medium block mb-1">
                        Lý do hủy:
                      </span>
                      <p className="p-2.5 bg-white/90 rounded border border-red-200 text-xs text-red-950 font-normal leading-relaxed whitespace-pre-wrap">
                        {detail.cancellationReason || '(Không có lý do văn bản)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex items-center gap-2">
              {detail && detail.status === 'COMPLETED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownloadProof()}
                  isLoading={proofDownload.isDownloading}
                  disabled={proofDownload.isDownloading}
                  className="gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Tải tài liệu xác nhận</span>
                </Button>
              )}
              {detail && canCancel && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (onOpenCancelModal && detail) {
                      // Convert TransactionResponse to AdminTransactionResponse compatible structure
                      const adminTx: AdminTransactionResponse = {
                        id: detail.id,
                        listingId: detail.listing?.id || '',
                        listingTitle: detail.listing?.title || '',
                        listingRequestId: detail.listingRequestId,
                        ownerId: detail.owner?.id || '',
                        ownerDisplayName: detail.owner?.displayName || '',
                        owner: detail.owner,
                        requesterId: detail.requester?.id || '',
                        requesterDisplayName: detail.requester?.displayName || '',
                        requester: detail.requester,
                        status: detail.status,
                        ownerCompleted: detail.ownerCompleted,
                        requesterCompleted: detail.requesterCompleted,
                        ownerCompletedAt: detail.ownerCompletedAt,
                        requesterCompletedAt: detail.requesterCompletedAt,
                        cancelledById: detail.cancelledBy?.id || null,
                        cancelledByDisplayName: detail.cancelledBy?.displayName || null,
                        cancelledBy: detail.cancelledBy,
                        cancelledAt: detail.cancelledAt,
                        cancellationReason: detail.cancellationReason,
                        createdAt: detail.createdAt,
                        updatedAt: detail.updatedAt,
                      };
                      onOpenCancelModal(adminTx);
                    }
                  }}
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Hủy giao dịch (Can thiệp)</span>
                </Button>
              )}
            </div>
            {proofDownload.error && (
              <p className="text-[11px] text-red-600" role="alert">
                {proofDownload.error}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TransactionDetailModal;
