package com.shareloop.service.filestorage;

import com.shareloop.dto.file.FileUploadResponse;
import org.springframework.core.io.Resource;

public interface FileStorageService {

    /**
     * Store validated file bytes.
     *
     * @param bytes       binary content
     * @param extension   file extension (without or with dot, e.g. "jpg" or ".png")
     * @param contentType canonical MIME type
     * @return FileUploadResponse
     */
    FileUploadResponse store(byte[] bytes, String extension, String contentType);

    /**
     * Load stored file as a Resource.
     *
     * @param filename server-generated filename
     * @return Resource representing the file
     */
    Resource loadAsResource(String filename);
}
