package com.shareloop.service.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

@Service
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "brevo")
public class BrevoEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(BrevoEmailService.class);
    private static final String RESET_PASSWORD_SUBJECT = "ShareLoop - Đặt lại mật khẩu của bạn";

    private final MailProperties mailProperties;
    private final RestClient restClient;

    // Constructor 1: Dành cho Spring Boot (chỉ cần MailProperties)
    @Autowired
    public BrevoEmailService(MailProperties mailProperties) {
        this.mailProperties = mailProperties;
        this.restClient = createDefaultRestClient(mailProperties);
    }

    // Constructor 2: Dành riêng cho Unit Test (package-private, không public)
    BrevoEmailService(MailProperties mailProperties, RestClient restClient) {
        this.mailProperties = mailProperties;
        this.restClient = restClient;
    }

    private static RestClient createDefaultRestClient(MailProperties mailProperties) {
        int timeoutSeconds = Math.max(1, mailProperties.getBrevo().getTimeoutSeconds());
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(timeoutSeconds));
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));

        String apiUrl = mailProperties.getBrevo().getApiUrl();
        return RestClient.builder()
                .baseUrl(apiUrl != null && !apiUrl.isBlank() ? apiUrl : "https://api.brevo.com/v3/smtp/email")
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String recipientName, String resetToken) {
        String safeDomain = getDomain(toEmail);
        String apiKey = mailProperties.getBrevo().getApiKey();

        if (apiKey == null || apiKey.isBlank()) {
            log.error("Brevo API key is not configured. Cannot dispatch email for domain {}", safeDomain);
            throw new IllegalStateException("Brevo API key is missing or unconfigured");
        }

        String encodedToken = URLEncoder.encode(resetToken, StandardCharsets.UTF_8);
        String resetUrl = mailProperties.getFrontendBaseUrl() + "/reset-password?token=" + encodedToken;

        String safeName = recipientName != null && !recipientName.isBlank() ? recipientName.trim() : "bạn";
        String htmlContent = buildHtmlTemplate(safeName, resetUrl);
        String textContent = buildPlainTextTemplate(safeName, resetUrl);

        BrevoEmailPayload payload = new BrevoEmailPayload(
                new BrevoSender(mailProperties.getBrevo().getSenderName(), mailProperties.getBrevo().getSenderEmail()),
                List.of(new BrevoRecipient(safeName, toEmail)),
                RESET_PASSWORD_SUBJECT,
                htmlContent,
                textContent);

        try {
            restClient.post()
                    .header("api-key", apiKey)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        int status = response.getStatusCode().value();
                        log.error("Brevo transactional email API returned error status: {} for recipient domain {}",
                                status, safeDomain);
                        throw new RuntimeException("Brevo API returned error HTTP status: " + status);
                    })
                    .toBodilessEntity();

            log.info("Successfully dispatched password reset email via Brevo API for recipient domain {}", safeDomain);
        } catch (Exception e) {
            log.error("Failed to deliver transactional password reset email via Brevo for domain {}: {}", safeDomain,
                    e.getMessage());
            throw new RuntimeException("Email delivery failed via Brevo", e);
        }
    }

    String buildHtmlTemplate(String recipientName, String resetUrl) {
        String escapedName = escapeHtml(recipientName);
        String escapedUrl = escapeHtml(resetUrl);

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>ShareLoop - Đặt lại mật khẩu</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: center; }
                        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
                        .header span { color: #10b981; }
                        .content { padding: 40px; line-height: 1.6; }
                        .content h2 { font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
                        .btn-container { text-align: center; margin: 32px 0; }
                        .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none; transition: background-color 0.2s ease; }
                        .btn:hover { background-color: #059669; }
                        .notice-box { background-color: #f1f5f9; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 24px 0; font-size: 14px; color: #475569; }
                        .link-fallback { word-break: break-all; font-size: 13px; color: #64748b; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px dashed #cbd5e1; }
                        .footer { background-color: #f8fafc; padding: 24px 40px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Share<span>Loop</span></h1>
                        </div>
                        <div class="content">
                            <h2>Yêu cầu đặt lại mật khẩu</h2>
                            <p>Xin chào <strong>{{RECIPIENT_NAME}}</strong>,</p>
                            <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản ShareLoop của bạn. Vui lòng bấm vào nút bên dưới để tiến hành tạo mật khẩu mới:</p>
                            <div class="btn-container">
                                <a href="{{RESET_URL}}" class="btn" target="_blank">Đặt lại mật khẩu</a>
                            </div>
                            <div class="notice-box">
                                <strong>Lưu ý bảo mật:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>15 phút</strong>. Sau thời gian này, bạn sẽ cần gửi lại yêu cầu mới.
                            </div>
                            <p style="font-size: 14px; color: #64748b;">Nếu nút trên không hoạt động, bạn có thể sao chép và dán liên kết sau vào trình duyệt:</p>
                            <div class="link-fallback">
                                <a href="{{RESET_URL}}" style="color: #059669; text-decoration: none;">{{RESET_URL}}</a>
                            </div>
                            <p style="margin-top: 32px; font-size: 14px; color: #64748b;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu của bạn vẫn sẽ được giữ an toàn tuyệt đối.</p>
                        </div>
                        <div class="footer">
                            <p>© 2026 ShareLoop. Nền tảng chia sẻ đồ dùng học tập sinh viên bền vững.</p>
                            <p>Đây là email tự động, vui lòng không phản hồi trực tiếp vào địa chỉ này.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                .replace("{{RECIPIENT_NAME}}", escapedName)
                .replace("{{RESET_URL}}", escapedUrl);
    }

    String buildPlainTextTemplate(String recipientName, String resetUrl) {
        return """
                Xin chào {{RECIPIENT_NAME}},

                Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản ShareLoop của bạn.
                Vui lòng truy cập liên kết sau để tạo mật khẩu mới:
                {{RESET_URL}}

                Lưu ý: Liên kết chỉ có hiệu lực trong vòng 15 phút.
                Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn.

                Trân trọng,
                Đội ngũ ShareLoop
                """
                .replace("{{RECIPIENT_NAME}}", recipientName)
                .replace("{{RESET_URL}}", resetUrl);
    }

    private String escapeHtml(String input) {
        if (input == null)
            return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }

    private String getDomain(String email) {
        if (email == null || !email.contains("@")) {
            return "unknown";
        }
        return email.substring(email.indexOf("@"));
    }

    // Records for Brevo JSON payload
    record BrevoEmailPayload(
            BrevoSender sender,
            List<BrevoRecipient> to,
            String subject,
            String htmlContent,
            String textContent) {
    }

    record BrevoSender(String name, String email) {
    }

    record BrevoRecipient(String name, String email) {
    }
}