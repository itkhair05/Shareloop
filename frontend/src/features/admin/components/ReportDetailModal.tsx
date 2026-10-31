import { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  RotateCcw,
  ShieldAlert,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { useAdminReportDetail } from '../hooks/use-admin-reports';
import {
  formatReportCategory,
  formatReportStatus,
  formatTargetType,
} from '../utils/report-formatters';

export interface ReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string | null;
  onOpenStatusDialog?: (reportId: string) => void;
  onViewReviewTarget?: (reviewId: string) => void;
}

export function ReportDetailModal({
  isOpen,
  onClose,
  reportId,
  onOpenStatusDialog,
  onViewReviewTarget,
}: ReportDetailModalProps) {
  const titleId = useId();
  const descId = useId();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminReportDetail(isOpen ? reportId : null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 id={titleId} className="text-base font-bold text-white truncate">
                Hồ sơ báo cáo vi phạm
              </h3>
              <p id={descId} className="text-xs text-slate-400 truncate">
                Mã báo cáo: <span className="font-mono text-slate-300">{reportId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng cửa sổ chi tiết"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500">Đang tải hồ sơ báo cáo...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex flex-col items-center text-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <p className="text-sm font-semibold">Không thể tải thông tin báo cáo</p>
              <p className="text-xs text-red-600">{error?.message || 'Lỗi kết nối máy chủ'}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2 text-red-700 border-red-300 hover:bg-red-100"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Thử lại
              </Button>
            </div>
          )}

          {report && (
            <>
              {/* Status and Category Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={formatReportStatus(report.status).variant} className="text-xs px-2.5 py-1">
                    Trạng thái: {formatReportStatus(report.status).label}
                  </Badge>
                  <Badge variant={formatTargetType(report.targetType).variant} className="text-xs px-2.5 py-1">
                    Đối tượng: {formatTargetType(report.targetType).label}
                  </Badge>
                </div>
                <div className="text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  Danh mục: <strong className="text-slate-800">{formatReportCategory(report.category)}</strong>
                </div>
              </div>

              {/* Reporter and Target Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reporter */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-600" />
                      Người gửi báo cáo
                    </span>
                    {report.reporterId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(report.reporterId!, 'reporter')}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                        title="Sao chép User ID"
                      >
                        {copiedField === 'reporter' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar
                      avatarUrl={report.reporterAvatarUrl}
                      name={report.reporterDisplayName}
                      size="md"
                      alt={
                        report.reporterDisplayName
                          ? `Ảnh đại diện của ${report.reporterDisplayName}`
                          : 'Ảnh đại diện người gửi báo cáo'
                      }
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm">
                        {report.reporterDisplayName || 'Chưa cập nhật'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {report.reporterEmail || '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target ID and Link */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                      Đối tượng bị báo cáo ({report.targetType})
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(report.targetId, 'target')}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded"
                      title="Sao chép Target ID"
                    >
                      {copiedField === 'target' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {report.targetType === 'USER' ? (
                    <div className="flex items-center gap-3">
                      <Avatar
                        avatarUrl={report.targetUserAvatarUrl}
                        name={report.targetUserDisplayName}
                        size="md"
                        alt={
                          report.targetUserDisplayName
                            ? `Ảnh đại diện của ${report.targetUserDisplayName}`
                            : 'Ảnh đại diện người dùng bị báo cáo'
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm">
                          {report.targetUserDisplayName || 'Người dùng bị báo cáo'}
                        </div>
                        <div className="font-mono text-xs text-slate-700 break-all select-all mt-0.5">
                          {report.targetId}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-mono text-xs text-slate-700 break-all select-all">
                        {report.targetId}
                      </div>
                      {report.targetType === 'REVIEW' && (
                        <div className="mt-2">
                          {onViewReviewTarget ? (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onViewReviewTarget(report.targetId);
                              }}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              Xem và kiểm duyệt đánh giá này
                            </button>
                          ) : (
                            <Link
                              to="/admin/reviews"
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              Mở trang kiểm duyệt đánh giá
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Mô tả chi tiết từ người gửi
                </label>
                <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {report.description || <span className="italic text-slate-400">Không có nội dung mô tả.</span>}
                </div>
              </div>

              {/* Internal Staff Resolution Notes (Admin Only) */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    Ghi chú xử lý nội bộ (Dành riêng cho Quản trị viên)
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Bảo mật nội bộ
                  </span>
                </div>

                <div className="text-xs text-slate-200 leading-relaxed bg-slate-800/80 p-3 rounded-lg border border-slate-700 whitespace-pre-wrap">
                  {report.resolutionNotes ? (
                    report.resolutionNotes
                  ) : (
                    <span className="italic text-slate-400">Chưa có ghi chú xử lý nội bộ cho báo cáo này.</span>
                  )}
                </div>

                {(report.resolvedById || report.resolvedAt) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                    <div>
                      <span>Người xử lý: </span>
                      <strong className="text-white">
                        {report.resolvedByDisplayName || 'Quản trị viên'}
                      </strong>
                    </div>
                    <div>
                      <span>Thời điểm giải quyết: </span>
                      <strong className="text-white">{formatDateTime(report.resolvedAt)}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Decoupling Warning Notice */}
              <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex gap-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Lưu ý nghiệp vụ kiểm duyệt:</strong> Việc chuyển trạng thái báo cáo sang <em>Đã giải quyết</em> chỉ thay đổi quy trình khiếu nại. Nó <strong>không tự động khóa tài khoản, không tự động hủy tin đăng và không tự động ẩn đánh giá</strong>. Mọi tác vụ chế tài đối tượng phải được quản trị viên chủ động xác nhận riêng biệt.
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Ngày báo cáo: {formatDateTime(report.createdAt)}
                </span>
                <span>Cập nhật: {formatDateTime(report.updatedAt)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {report && onOpenStatusDialog && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenStatusDialog(report.id);
                }}
                className="gap-1.5"
              >
                Cập nhật trạng thái xử lý
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
