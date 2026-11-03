import { useCallback, useRef, useState } from 'react';
import { transactionApi } from '../api/transaction-api';
import { getTransactionProofErrorMessage } from '../utils/transaction-proof';
import { downloadBlobFile } from '@/lib/file-download';

/**
 * Downloads the PDF confirmation document for a COMPLETED transaction.
 *
 * Returns `downloadProof`, which resolves to the Vietnamese error message on
 * failure (and records it in `error`), or null on success. Concurrent calls
 * are guarded so a double click only triggers one request.
 */
export function useTransactionProof() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const downloadProof = useCallback(async (id: string): Promise<string | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setIsDownloading(true);
    setError(null);

    try {
      const { blob, filename } = await transactionApi.downloadTransactionProof(id);
      downloadBlobFile(blob, filename);
      return null;
    } catch (caught) {
      const message = getTransactionProofErrorMessage(caught);
      setError(message);
      return message;
    } finally {
      inFlight.current = false;
      setIsDownloading(false);
    }
  }, []);

  return { isDownloading, error, downloadProof, clearError };
}
