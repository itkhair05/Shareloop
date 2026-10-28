import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderTree,
  ListFilter,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdminCategories, useUpdateCategoryStatus } from '@/features/categories';
import { CategoryFormModal } from './components/CategoryFormModal';
import { formatDateTime } from '@/lib/utils';
import type { CategoryDetailResponse } from '@/types/category';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function AdminCategoriesPage() {
  const { data: categories = [], isLoading, isError, error, refetch } = useAdminCategories();
  const updateStatusMutation = useUpdateCategoryStatus();

  // Search & Status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<CategoryDetailResponse | null>(null);

  // Status toggle confirmation dialog
  const [categoryToToggle, setCategoryToToggle] = useState<CategoryDetailResponse | null>(null);

  // Toast / Banner feedback state
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && !cat.isActive) return false;
      if (statusFilter === 'INACTIVE' && cat.isActive) return false;

      // Search term filter (matches name or slug)
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchesName = cat.name.toLowerCase().includes(query);
        const matchesSlug = cat.slug.toLowerCase().includes(query);
        return matchesName || matchesSlug;
      }

      return true;
    });
  }, [categories, statusFilter, searchTerm]);

  // Statistics counters
  const totalCount = categories.length;
  const activeCount = useMemo(() => categories.filter((c) => c.isActive).length, [categories]);
  const inactiveCount = totalCount - activeCount;

  // Handlers
  const handleOpenCreateModal = () => {
    setCategoryToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (category: CategoryDetailResponse) => {
    setCategoryToEdit(category);
    setIsFormModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!categoryToToggle) return;

    const newStatus = !categoryToToggle.isActive;
    try {
      await updateStatusMutation.mutateAsync({
        id: categoryToToggle.id,
        payload: { isActive: newStatus },
      });

      setFeedbackMessage({
        type: 'success',
        text: newStatus
          ? `Đã kích hoạt danh mục "${categoryToToggle.name}" thành công.`
          : `Đã tạm ngưng danh mục "${categoryToToggle.name}".`,
      });
      setCategoryToToggle(null);
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Không thể thay đổi trạng thái danh mục. Vui lòng thử lại.',
      });
      setCategoryToToggle(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              Quản trị danh mục ngành hàng
            </h1>
            <Badge variant="default" className="text-xs shrink-0 whitespace-nowrap">
              {totalCount} danh mục
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hệ thống phân loại sản phẩm trao đổi và mua bán. Quản trị viên có thể thêm mới, cập nhật thông tin và kiểm soát trạng thái hiển thị.
          </p>
        </div>

        {/* Dùng thẻ button thuần thay vì component Button để tránh lỗi xung đột class của tailwind-merge */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex flex-row items-center justify-center gap-2 h-10 px-4 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Thêm danh mục mới</span>
        </button>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedbackMessage && (
        <div
          role="status"
          className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:opacity-75 cursor-pointer text-slate-500"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Search, Filters & Counters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên hoặc đường dẫn slug..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 rounded-lg transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-emerald-500 focus:ring-emerald-400 text-slate-900"
              aria-label="Tìm kiếm danh mục"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Đang hoạt động ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'INACTIVE'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạm ngưng ({inactiveCount})
            </button>
          </div>
        </div>

        {/* Filter Feedback indicator */}
        {(searchTerm || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Tìm thấy <strong className="text-slate-900">{filteredCategories.length}</strong> danh mục phù hợp
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4" role="status" aria-label="Đang tải danh sách danh mục">
              <div className="h-6 bg-slate-200/80 rounded w-1/4 animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : isError ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Không thể tải danh sách danh mục</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {error?.message || 'Đã có sự cố khi kết nối tới máy chủ. Vui lòng thử lại sau.'}
              </p>
              <Button type="button" variant="outline" onClick={() => refetch()} className="cursor-pointer">
                <RotateCcw className="w-4 h-4 mr-1.5 shrink-0" />
                <span>Thử lại</span>
              </Button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                {searchTerm || statusFilter !== 'ALL' ? (
                  <ListFilter className="w-6 h-6" />
                ) : (
                  <FolderTree className="w-6 h-6" />
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {searchTerm || statusFilter !== 'ALL'
                  ? 'Không tìm thấy danh mục phù hợp'
                  : 'Chưa có danh mục nào trong hệ thống'}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'ALL'
                  ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc trạng thái để xem đầy đủ danh mục.'
                  : 'Hãy tạo danh mục đầu tiên để bắt đầu phân loại hàng hóa trên nền tảng ShareLoop.'}
              </p>
              {searchTerm || statusFilter !== 'ALL' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                  }}
                  className="cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5 shrink-0" />
                  <span>Xóa bộ lọc tìm kiếm</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleOpenCreateModal}
                  className="cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                  <span>Tạo danh mục đầu tiên</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto" role="region" aria-label="Bảng danh mục ngành hàng">
              {/* Ép bảng có chiều rộng tối thiểu 1000px để chống ép hẹp cột */}
              <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                    <th scope="col" className="py-3 px-4 whitespace-nowrap">Tên danh mục</th>
                    <th scope="col" className="py-3 px-4 whitespace-nowrap">Đường dẫn slug</th>
                    <th scope="col" className="py-3 px-4 hidden md:table-cell whitespace-nowrap">Mô tả</th>
                    <th scope="col" className="py-3 px-4 text-right whitespace-nowrap">Bài đăng</th>
                    <th scope="col" className="py-3 px-4 text-center whitespace-nowrap">Trạng thái</th>
                    <th scope="col" className="py-3 px-4 hidden lg:table-cell whitespace-nowrap">Cập nhật</th>
                    <th scope="col" className="py-3 px-4 text-right whitespace-nowrap w-[200px] min-w-[200px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !cat.isActive ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FolderTree
                            className={`w-4 h-4 shrink-0 ${
                              cat.isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                          <span className={`whitespace-nowrap ${cat.isActive ? '' : 'text-slate-600'}`}>{cat.name}</span>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                          {cat.slug}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 hidden md:table-cell max-w-xs text-slate-500">
                        {cat.description ? (
                          <span className="line-clamp-1" title={cat.description}>
                            {cat.description}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">Chưa có mô tả</span>
                        )}
                      </td>

                      {/* Active Listing Count */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium whitespace-nowrap">
                        {cat.activeListingCount > 0 ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            {cat.activeListingCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {cat.isActive ? (
                          <Badge variant="success" withDot className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                            Đang hoạt động
                          </Badge>
                        ) : (
                          <Badge variant="neutral" withDot className="text-[11px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center">
                            Tạm ngưng
                          </Badge>
                        )}
                      </td>

                      {/* Updated Date */}
                      <td className="py-3.5 px-4 hidden lg:table-cell text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {formatDateTime(cat.updatedAt)}
                      </td>

                      {/* Actions - Dùng thẻ button thuần để không bị cn() ghi đè class */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap w-[200px] min-w-[200px]">
                        <div className="flex flex-row flex-nowrap items-center justify-end gap-2">
                          
                          {/* Nút Sửa */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cat)}
                            className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            aria-label={`Chỉnh sửa danh mục ${cat.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none pt-[1px]">Sửa</span>
                          </button>

                          {/* Nút Tạm ngưng / Kích hoạt */}
                          <button
                            type="button"
                            onClick={() => setCategoryToToggle(cat)}
                            className={`inline-flex flex-row items-center justify-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                              cat.isActive
                                ? 'text-amber-700 hover:text-amber-800 hover:bg-amber-50'
                                : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border border-emerald-300'
                            }`}
                            aria-label={
                              cat.isActive
                                ? `Tạm ngưng danh mục ${cat.name}`
                                : `Kích hoạt danh mục ${cat.name}`
                            }
                          >
                            <Power className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none pt-[1px]">
                              {cat.isActive ? 'Tạm ngưng' : 'Kích hoạt'}
                            </span>
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal for Creating & Editing Categories */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        categoryToEdit={categoryToEdit}
        onSuccess={(saved) => {
          setFeedbackMessage({
            type: 'success',
            text: categoryToEdit
              ? `Đã cập nhật thông tin danh mục "${saved.name}" thành công.`
              : `Đã thêm danh mục mới "${saved.name}" thành công.`,
          });
        }}
      />

      {/* Confirmation Dialog for Status Toggle */}
      <ConfirmDialog
        isOpen={Boolean(categoryToToggle)}
        onClose={() => setCategoryToToggle(null)}
        onConfirm={handleConfirmToggleStatus}
        isLoading={updateStatusMutation.isPending}
        title={categoryToToggle?.isActive ? 'Tạm ngưng hoạt động danh mục' : 'Kích hoạt lại danh mục'}
        variant={categoryToToggle?.isActive ? 'warning' : 'primary'}
        confirmText={categoryToToggle?.isActive ? 'Tạm ngưng' : 'Kích hoạt'}
        cancelText="Hủy bỏ"
        message={
          categoryToToggle?.isActive ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc chắn muốn tạm ngưng danh mục{' '}
                <strong className="text-slate-900">{categoryToToggle.name}</strong>?
              </p>
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                {categoryToToggle.activeListingCount > 0 ? (
                  <>
                    Hiện có{' '}
                    <strong className="font-semibold">
                      {categoryToToggle.activeListingCount} bài đăng
                    </strong>{' '}
                    đang liên kết với danh mục này. Các bài đăng cũ vẫn giữ nguyên trạng thái hoạt động bình thường, nhưng thành viên sẽ không thể chọn danh mục này khi tạo bài đăng mới.
                  </>
                ) : (
                  <>
                    Danh mục này sẽ bị ẩn khỏi các bộ lọc công khai và thành viên sẽ không thể chọn danh mục này khi tạo bài đăng mới.
                  </>
                )}
              </div>
            </div>
          ) : (
            <p>
              Bạn có chắc chắn muốn kích hoạt lại danh mục{' '}
              <strong className="text-slate-900">{categoryToToggle?.name}</strong>? Danh mục sẽ xuất hiện trở lại trên toàn hệ thống và cho phép thành viên đăng bài.
            </p>
          )
        }
      />
    </div>
  );
}

export default AdminCategoriesPage;