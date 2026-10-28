import { useEffect, useId, useState } from 'react';
import { CheckCircle2, ShieldAlert, X } from 'lucide-react';
import type { ReportStatus } from '@/types/report';
import type { AdminReportResponse } from '@/types/admin-report';
import {
  getPermittedStatusTransitions,
  getStatusLabel,
} from '../utils/report-formatters';

export interface UpdateReportStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  report: AdminReportResponse | null;
  onConfirm: (status: ReportStatus, notes: string) => void;
  isLoading?: boolean;
}

export function UpdateReportStatusDialog({
  isOpen,
  onClose,
  report,
  onConfirm,
  isLoading = false,
}: UpdateReportStatusDialogProps) {
  const titleId = useId();
  const descId = useId();

  const permittedTransitions = report ? getPermittedStatusTransitions(report.status) : [];
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | ''>(() => {
    if (!report) return '';
    const transitions = getPermittedStatusTransitions(report.status);
    return transitions[0] || '';
  });
  const [notes, setNotes] = useState(() => report?.resolutionNotes || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) {
      setError('Vui lòng chọn trạng thái tiếp theo hợp lệ.');
      return;
    }
    if (notes.length > 1000) {
      setError('Ghi chú xử lý không được vượt quá 1000 ký tự.');
      return;
    }
    setError(null);
    onConfirm(selectedStatus, notes.trim());
  };

  if (!isOpen || !report) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 id={titleId} className="text-base font-bold text-white">
                Chuyển trạng thái xử lý báo cáo
              </h3>
              <p id={descId} className="text-[11px] text-slate-400">
                Mã hồ sơ: {report.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center">
              <span className="text-slate-500">Trạng thái hiện tại:</span>
              <strong className="text-slate-900">{getStatusLabel(report.status)}</strong>
            </div>

            {permittedTransitions.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Hồ sơ báo cáo hiện tại không có bước chuyển trạng thái hợp lệ nào tiếp theo.
              </div>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="next-status-select"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Chọn trạng thái mới <span className="text-red-500">*</span>
                </label>
                <select
                  id="next-status-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as ReportStatus)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                >
                  {permittedTransitions.map((st) => (
                    <option key={st} value={st}>
                      {getStatusLabel(st)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="resolution-notes"
                className="text-xs font-semibold text-slate-700 block"
              >
                Ghi chú xử lý nội bộ (Nội bộ BQT)
              </label>
              <textarea
                id="resolution-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
                placeholder="Ghi lại nhận định điều tra, kết quả xác minh hoặc lý do đóng/bác bỏ khiếu nại..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none transition-colors"
                maxLength={1000}
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>{error ? <span className="text-red-600 font-medium">{error}</span> : 'Tối đa 1000 ký tự'}</span>
                <span>{notes.length} / 1000</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-lg text-blue-900 text-xs">
              <strong>Lưu ý:</strong> Chuyển sang <em>Đã giải quyết</em> hoặc <em>Bác bỏ</em> sẽ tự động ghi nhận tài khoản quản trị của bạn và mốc thời gian hoàn tất. Mở lại (INVESTIGATING) sẽ xóa mốc này để tiếp tục thụ lý.
            </div>
          </div>

          {/* Footer - Dùng thẻ button thuần */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-row flex-nowrap items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="inline-flex flex-row items-center justify-center h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="whitespace-nowrap">Hủy bỏ</span>
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedStatus || permittedTransitions.length === 0}
              className="inline-flex flex-row items-center justify-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isLoading ? 'Đang lưu...' : 'Lưu thay đổi trạng thái'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateReportStatusDialog;