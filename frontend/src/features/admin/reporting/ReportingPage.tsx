import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReportingFilterBar, type ReportingFilterDraft } from './components/ReportingFilterBar';
import { reportingKeys } from './hooks/use-reporting';
import { OverviewSection } from './sections/OverviewSection';
import { UsersSection } from './sections/UsersSection';
import { ListingsSection } from './sections/ListingsSection';
import { TransactionsSection } from './sections/TransactionsSection';
import { ModerationSection } from './sections/ModerationSection';
import { ReviewsSection } from './sections/ReviewsSection';
import { SupportSection } from './sections/SupportSection';
import {
  formatPeriodDateRange,
  getDefaultReportingRange,
  REPORTING_TIMEZONE,
  validateReportingRange,
} from './utils/reporting-format';
import type { ReportingRangeQuery } from '@/types/reporting';

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'users', label: 'Người dùng' },
  { id: 'listings', label: 'Tin đăng' },
  { id: 'transactions', label: 'Giao dịch' },
  { id: 'moderation', label: 'Báo cáo vi phạm' },
  { id: 'reviews', label: 'Đánh giá' },
  { id: 'support', label: 'Yêu cầu hỗ trợ' },
] as const;

type ReportingTabId = (typeof TABS)[number]['id'];

function isReportingTab(value: string | null): value is ReportingTabId {
  return TABS.some((tab) => tab.id === value);
}

export function ReportingPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: ReportingTabId = isReportingTab(rawTab) ? rawTab : 'overview';

  const initialRange = useMemo(() => getDefaultReportingRange(), []);
  const [draft, setDraft] = useState<ReportingFilterDraft>({
    ...initialRange,
    granularity: 'DAY',
  });
  const [applied, setApplied] = useState<ReportingFilterDraft>({
    ...initialRange,
    granularity: 'DAY',
  });

  const fetchingCount = useIsFetching({ queryKey: reportingKeys.all });
  const isFetching = fetchingCount > 0;

  const range: ReportingRangeQuery = {
    from: applied.from,
    to: applied.to,
    timezone: REPORTING_TIMEZONE,
  };

  const handleApply = () => {
    if (!validateReportingRange(draft.from, draft.to, draft.granularity).valid) return;
    setApplied({ ...draft });
  };

  const handleReset = () => {
    const defaults = getDefaultReportingRange();
    const next: ReportingFilterDraft = { ...defaults, granularity: 'DAY' };
    setDraft(next);
    setApplied(next);
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: reportingKeys.all });
  };

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTab = (tabId: ReportingTabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = TABS.length - 1;
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    selectTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  const renderSection = () => {
    switch (activeTab) {
      case 'users':
        return <UsersSection range={range} granularity={applied.granularity} />;
      case 'listings':
        return <ListingsSection range={range} granularity={applied.granularity} />;
      case 'transactions':
        return <TransactionsSection range={range} granularity={applied.granularity} />;
      case 'moderation':
        return <ModerationSection range={range} granularity={applied.granularity} />;
      case 'reviews':
        return <ReviewsSection range={range} granularity={applied.granularity} />;
      case 'support':
        return <SupportSection range={range} granularity={applied.granularity} />;
      case 'overview':
      default:
        return <OverviewSection range={range} granularity={applied.granularity} />;
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* HEADER PHONG CÁCH ĐƠN GIẢN (GIỐNG TRANG QUẢN LÝ NGƯỜI DÙNG) */}
      <header className="flex flex-col gap-3 pb-4 border-b border-slate-200">
        {/* Hàng 1: Title + Tags + Nút Làm mới */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Báo cáo &amp; Thống kê
              </h1>
              
              {/* Các Tag thông tin được đưa lên ngang hàng với Title */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-xs font-medium text-emerald-700 border border-emerald-200">
                  {formatPeriodDateRange(applied.from, applied.to)}
                </span>
                <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {REPORTING_TIMEZONE}
                </span>
              </div>
            </div>
            
            {/* Dòng mô tả nhỏ ở dưới */}
            <p className="text-sm text-slate-600 mt-1.5 max-w-4xl">
              Số liệu tổng hợp phục vụ vận hành hệ thống ShareLoop theo khoảng thời gian và bộ lọc của từng lĩnh vực.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
            className="cursor-pointer bg-white hover:bg-slate-50 self-start shrink-0 shadow-sm"
            aria-label="Làm mới toàn bộ số liệu báo cáo"
          >
            Làm mới
          </Button>
        </div>
      </header>

      <ReportingFilterBar
        draft={draft}
        applied={applied}
        onChange={setDraft}
        onApply={handleApply}
        onReset={handleReset}
        isFetching={isFetching}
      />

      <div className="border-b border-slate-200">
        <div
          role="tablist"
          aria-label="Các lĩnh vực báo cáo"
          className="flex items-center gap-1 overflow-x-auto -mb-px"
        >
          {TABS.map((tab, index) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`reporting-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`reporting-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                onClick={() => selectTab(tab.id)}
                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`reporting-panel-${activeTab}`}
        aria-labelledby={`reporting-tab-${activeTab}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {renderSection()}
      </div>
    </div>
  );
}

export default ReportingPage;