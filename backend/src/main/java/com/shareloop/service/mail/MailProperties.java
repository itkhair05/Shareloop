package com.shareloop.service.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {

    /**
     * Mail provider implementation: 'mock' (default) or 'brevo'.
     */
    private String provider = "mock";

    /**
     * Frontend base URL for constructing reset links (e.g. http://localhost:5173).
     */
    private String frontendBaseUrl = "http://localhost:5173";

    private Brevo brevo = new Brevo();

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider != null ? provider.trim().toLowerCase() : "mock";
    }

    public String getFrontendBaseUrl() {
        return frontendBaseUrl;
    }

    public void setFrontendBaseUrl(String frontendBaseUrl) {
        this.frontendBaseUrl = frontendBaseUrl != null ? frontendBaseUrl.trim() : "http://localhost:5173";
    }

    public Brevo getBrevo() {
        return brevo;
    }

    public void setBrevo(Brevo brevo) {
        this.brevo = brevo;
    }

    public static class Brevo {
        private String apiKey = "";
        private String senderEmail = "no-reply@shareloop.vn";
        private String senderName = "ShareLoop";
        private String apiUrl = "https://api.brevo.com/v3/smtp/email";
        private int timeoutSeconds = 5;

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey != null ? apiKey.trim() : "";
        }

        public String getSenderEmail() {
            return senderEmail;
        }

        public void setSenderEmail(String senderEmail) {
            this.senderEmail = senderEmail != null ? senderEmail.trim() : "no-reply@shareloop.vn";
        }

        public String getSenderName() {
            return senderName;
        }

        public void setSenderName(String senderName) {
            this.senderName = senderName != null ? senderName.trim() : "ShareLoop";
        }

        public String getApiUrl() {
            return apiUrl;
        }

        public void setApiUrl(String apiUrl) {
            this.apiUrl = apiUrl != null ? apiUrl.trim() : "https://api.brevo.com/v3/smtp/email";
        }

        public int getTimeoutSeconds() {
            return timeoutSeconds;
        }

        public void setTimeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
        }
    }
}
