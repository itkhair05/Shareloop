package com.shareloop.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.storage")
public class StorageProperties {

    /**
     * Storage provider: 'local' for development/tests, 'r2' for Cloudflare R2.
     */
    private String provider = "local";

    private Local local = new Local();

    private R2 r2 = new R2();

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider != null ? provider.trim().toLowerCase() : "local";
    }

    public Local getLocal() {
        return local;
    }

    public void setLocal(Local local) {
        this.local = local != null ? local : new Local();
    }

    public R2 getR2() {
        return r2;
    }

    public void setR2(R2 r2) {
        this.r2 = r2 != null ? r2 : new R2();
    }

    public static class Local {
        private String rootDir = "./uploads";
        private String baseUrl = "/api/v1/files";

        public String getRootDir() {
            return rootDir;
        }

        public void setRootDir(String rootDir) {
            this.rootDir = rootDir != null ? rootDir.trim() : "./uploads";
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl != null ? baseUrl.trim() : "/api/v1/files";
        }
    }

    public static class R2 {
        private String endpoint = "";
        private String bucketName = "";
        private String accessKeyId = "";
        private String secretAccessKey = "";
        private String publicUrlPrefix = "";

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint != null ? endpoint.trim() : "";
        }

        public String getBucketName() {
            return bucketName;
        }

        public void setBucketName(String bucketName) {
            this.bucketName = bucketName != null ? bucketName.trim() : "";
        }

        public String getAccessKeyId() {
            return accessKeyId;
        }

        public void setAccessKeyId(String accessKeyId) {
            this.accessKeyId = accessKeyId != null ? accessKeyId.trim() : "";
        }

        public String getSecretAccessKey() {
            return secretAccessKey;
        }

        public void setSecretAccessKey(String secretAccessKey) {
            this.secretAccessKey = secretAccessKey != null ? secretAccessKey.trim() : "";
        }

        public String getPublicUrlPrefix() {
            return publicUrlPrefix;
        }

        public void setPublicUrlPrefix(String publicUrlPrefix) {
            this.publicUrlPrefix = publicUrlPrefix != null ? publicUrlPrefix.trim() : "";
        }
    }
}
