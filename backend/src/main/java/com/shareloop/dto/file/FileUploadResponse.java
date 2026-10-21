package com.shareloop.dto.file;

public class FileUploadResponse {

    private String id;
    private String filename;
    private String contentType;
    private long size;
    private String url;

    public FileUploadResponse() {
    }

    public FileUploadResponse(String id, String filename, String contentType, long size, String url) {
        this.id = id;
        this.filename = filename;
        this.contentType = contentType;
        this.size = size;
        this.url = url;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
