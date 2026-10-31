import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2, Upload, X, AlertCircle } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth';
import { profileApi } from '../api/profile-api';
import { ApiError } from '@/lib/api-error';
import type { UserProfile } from '@/types/auth';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export interface AvatarManagementCardProps {
  user: UserProfile;
  onSuccess?: (message: string) => void;
}

export function AvatarManagementCard({ user, onSuccess }: AvatarManagementCardProps) {
  const queryClient = useQueryClient();
  const { updateUser, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clean up object URL when component unmounts or previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const hasCustomAvatar = Boolean(user.customAvatarUrl);
  const hasGoogleAvatar = Boolean(user.googleAvatarUrl);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // Validate MIME type and extension
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isValidType = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extension);

    if (!isValidType) {
      setErrorMessage('Chỉ hỗ trợ tệp ảnh định dạng JPEG hoặc PNG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate empty file
    if (file.size === 0) {
      setErrorMessage('Tệp ảnh không hợp lệ hoặc rỗng.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Dung lượng ảnh vượt quá giới hạn tối đa 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clean up previous preview URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const updatedProfile = await profileApi.uploadAvatar(selectedFile);

      // Synchronize AuthContext
      if (updateUser) {
        updateUser(updatedProfile);
      } else {
        await refreshUser();
      }

      // Update React Query caches
      queryClient.setQueryData(['users', updatedProfile.id], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ['users'] });

      // Clean up local preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onSuccess?.('Cập nhật ảnh đại diện thành công!');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Tải lên ảnh đại diện thất bại. Vui lòng thử lại.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCustomAvatar = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const updatedProfile = await profileApi.deleteAvatar();

      // Synchronize AuthContext
      if (updateUser) {
        updateUser(updatedProfile);
      } else {
        await refreshUser();
      }

      // Update React Query caches
      queryClient.setQueryData(['users', updatedProfile.id], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ['users'] });

      setIsDeleteDialogOpen(false);
      onSuccess?.('Đã xóa ảnh đại diện tùy chỉnh thành công!');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Xóa ảnh đại diện thất bại. Vui lòng thử lại.';
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const effectiveAvatarDisplayUrl = previewUrl || user.avatarUrl;

  return (
    <>
      <Card className="border border-slate-200 shadow-xs bg-white" data-testid="avatar-management-card">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Ảnh đại diện tài khoản
                </h2>
                <p className="text-xs text-slate-500">
                  Quản lý ảnh đại diện tùy chỉnh hoặc đồng bộ với ảnh hồ sơ Google
                </p>
              </div>
            </div>

            {previewUrl ? (
              <Badge variant="warning" withDot className="font-medium shrink-0">
                Đang xem trước
              </Badge>
            ) : hasCustomAvatar ? (
              <Badge variant="success" withDot className="font-medium shrink-0">
                Ảnh tùy chỉnh
              </Badge>
            ) : hasGoogleAvatar ? (
              <Badge variant="neutral" withDot className="font-medium shrink-0">
                Đồng bộ từ Google
              </Badge>
            ) : (
              <Badge variant="neutral" className="font-medium shrink-0">
                Chưa thiết lập
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          {/* Error alert */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs sm:text-sm text-red-700 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-100 cursor-pointer"
                aria-label="Đóng thông báo lỗi"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 rounded-xl border border-slate-100 bg-slate-50/60">
            {/* Avatar display / preview */}
            <div className="shrink-0">
              <Avatar
                avatarUrl={effectiveAvatarDisplayUrl}
                name={user.displayName}
                size="2xl"
                alt={previewUrl ? 'Xem trước ảnh đại diện mới' : `Ảnh đại diện của ${user.displayName}`}
                className="w-24 h-24 shadow-xs ring-4 ring-white"
              />
            </div>

            {/* Information and Action Buttons */}
            <div className="flex-1 space-y-3 text-center sm:text-left min-w-0">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {previewUrl
                    ? 'Xem trước ảnh mới được chọn'
                    : hasCustomAvatar
                    ? 'Ảnh đại diện tùy chỉnh đang hoạt động'
                    : hasGoogleAvatar
                    ? 'Đang sử dụng ảnh đại diện từ tài khoản Google'
                    : 'Chưa có ảnh đại diện (Hiển thị chữ cái viết tắt)'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewUrl
                    ? 'Nhấn "Lưu ảnh đại diện" để hoàn tất cập nhật hoặc "Hủy" để quay lại.'
                    : hasCustomAvatar
                    ? 'Bạn có thể thay đổi bằng ảnh mới hoặc xóa ảnh để sử dụng lại ảnh từ Google.'
                    : hasGoogleAvatar
                    ? 'Bạn có thể tải lên ảnh tùy chỉnh để thay thế ảnh đại diện Google bất cứ lúc nào.'
                    : 'Tải lên ảnh JPEG hoặc PNG để bạn bè dễ dàng nhận diện bạn trên ShareLoop.'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                {/* Hidden native file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png"
                  className="hidden"
                  aria-label="Chọn tệp ảnh đại diện"
                  disabled={isUploading || isDeleting}
                />

                {previewUrl ? (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleUpload}
                      isLoading={isUploading}
                      disabled={isUploading}
                      leftIcon={<Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      className="shadow-2xs"
                    >
                      Lưu ảnh đại diện
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelPreview}
                      disabled={isUploading}
                      className="shadow-2xs"
                    >
                      Hủy xem trước
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isDeleting}
                      leftIcon={<Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      className="shadow-2xs"
                    >
                      {hasCustomAvatar ? 'Thay đổi ảnh' : 'Tải lên ảnh mới'}
                    </Button>

                    {hasCustomAvatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        disabled={isUploading || isDeleting}
                        leftIcon={<Trash2 className="w-3.5 h-3.5 shrink-0 text-red-500" aria-hidden="true" />}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 shadow-none"
                      >
                        Xóa ảnh tùy chỉnh
                      </Button>
                    )}
                  </>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Định dạng hỗ trợ: JPEG, PNG. Dung lượng tối đa: 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Deleting Custom Avatar */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteCustomAvatar}
        title="Xóa ảnh đại diện tùy chỉnh?"
        message={
          hasGoogleAvatar
            ? 'Ảnh đại diện tùy chỉnh của bạn sẽ bị xóa vĩnh viễn. Hệ thống sẽ tự động khôi phục và hiển thị ảnh đại diện từ tài khoản Google của bạn.'
            : 'Ảnh đại diện tùy chỉnh của bạn sẽ bị xóa vĩnh viễn. Hệ thống sẽ hiển thị ảnh đại diện mặc định bằng chữ cái viết tắt từ tên của bạn.'
        }
        confirmText="Xóa ảnh"
        cancelText="Hủy"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}

export default AvatarManagementCard;
