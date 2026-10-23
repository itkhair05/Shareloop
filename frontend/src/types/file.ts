/**
 * File upload response from backend POST /api/v1/files/upload
 */
export interface FileUploadResponse {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}
