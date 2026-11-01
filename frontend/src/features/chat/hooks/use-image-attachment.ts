import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

export const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

export interface ChatImageSelection {
  file: File;
  previewUrl: string;
}

/**
 * Quản lý ảnh đính kèm đã chọn trong ô soạn tin nhắn: kiểm tra tệp,
 * tạo/giải phóng URL xem trước cục bộ và đồng bộ giá trị input.
 */
export function useImageAttachment() {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<ChatImageSelection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const resetInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const rejectFile = useCallback(
    (message: string) => {
      setError(message);
      resetInput();
    },
    [resetInput]
  );

  const selectFile = useCallback(
    (file?: File | null) => {
      if (!file) return;

      setError(null);

      // Every rejection stops before a preview URL is created.
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
        rejectFile('Chỉ hỗ trợ ảnh JPEG và PNG.');
        return;
      }

      if (file.size === 0) {
        rejectFile('Tệp ảnh không hợp lệ.');
        return;
      }

      if (file.size > MAX_CHAT_IMAGE_BYTES) {
        rejectFile('Ảnh không được vượt quá 5 MB.');
        return;
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setSelection({ file, previewUrl });
    },
    [rejectFile]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      selectFile(event.target.files?.[0]);
    },
    [selectFile]
  );

  const openPicker = useCallback(() => {
    // Clearing the value lets the user pick the same file again.
    resetInput();
    inputRef.current?.click();
  }, [resetInput]);

  const removeSelectedImage = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelection(null);
    setError(null);
    resetInput();
  }, [resetInput]);

  return {
    inputRef,
    selection,
    error,
    selectFile,
    handleInputChange,
    openPicker,
    removeSelectedImage,
  };
}
