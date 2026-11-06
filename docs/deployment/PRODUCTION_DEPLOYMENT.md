# ShareLoop — Hướng dẫn triển khai production

Tài liệu này mô tả quy trình triển khai ShareLoop lên môi trường production với kiến trúc:

- **Backend:** Spring Boot 3.5 (Java 17), chạy bằng Docker trên **Render**.
- **Frontend:** React 19 + Vite, build tĩnh trên **Cloudflare Pages**.
- **Database:** PostgreSQL 16 trên **Neon**.
- **Object storage:** **Cloudflare R2** (bucket private).
- **Email giao dịch:** **Brevo**.

> Mọi giá trị trong tài liệu dùng placeholder dạng `<...>`. Không đưa mật khẩu, API key,
> connection string thật hoặc nội dung file `.env` vào tài liệu, commit, log hay ảnh chụp màn hình.

---

## 1. Kiến trúc triển khai

```
Người dùng
   │  HTTPS
   ▼
Cloudflare Pages (frontend tĩnh)
   │  HTTPS + CORS
   ▼
Render Web Service (Docker, Spring Boot)
   ├── Neon PostgreSQL 16 (pooled endpoint cho ứng dụng)
   ├── Neon PostgreSQL 16 (direct endpoint cho Flyway — khuyến nghị)
   ├── Cloudflare R2 (bucket private, backend stream file)
   └── Brevo API (email đặt lại mật khẩu)
```

Đặc điểm quan trọng:

- Render cung cấp HTTPS và chuyển tiếp request qua proxy, nhưng backend **không** để Spring tự
  đọc header chuyển tiếp: production đặt `server.forward-headers-strategy: none`. Địa chỉ client
  được phân giải tường minh bởi `ClientIpResolver` theo `CLIENT_IP_MODE` (xem mục 3.5).
- Filesystem của Render là **ephemeral**. Production bắt buộc `STORAGE_PROVIDER=r2`;
  không dùng local storage.
- Ảnh/attachment riêng tư (chat, review, report, support) **luôn** được tải qua backend
  có kiểm tra quyền, không dùng public URL hay presigned URL không giới hạn.
- `GET /api/v1/files/*` chỉ phục vụ file công khai (ảnh listing/avatar). Attachment riêng tư
  đi qua endpoint domain tương ứng và yêu cầu xác thực.

---

## 2. Yêu cầu trước khi triển khai

| Hạng mục | Yêu cầu |
|---|---|
| Tài khoản Render | Đã liên kết GitHub, có quyền tạo Web Service (blueprint dùng plan `starter`). |
| Tài khoản Cloudflare | Quyền tạo Pages project và R2 bucket. |
| Neon | Project PostgreSQL 16; lấy được pooled host và direct host. |
| Brevo | Tài khoản đã xác minh sender domain/email; có API key gửi transactional email. |
| Repo | Nhánh `main` sạch, build được; `render.yaml`, `backend/Dockerfile`, `frontend/public/_redirects`, `frontend/public/_headers` tồn tại. |
| Công cụ local (tuỳ chọn) | Docker Desktop, Node.js 22+, Java 17, `psql`/`pg_dump`. |

Kiểm tra nhanh trước khi triển khai:

```bash
# Backend build + test (cần PostgreSQL test đang chạy)
cd backend && ./mvnw test

# Frontend build
cd frontend && npm ci && npm run build

# Docker image
docker build -t shareloop-backend:local backend
```

---

## 3. Triển khai backend trên Render

### 3.1. Tạo service từ blueprint

1. Trong Render Dashboard, chọn **New → Blueprint** và trỏ tới repo ShareLoop.
2. Render đọc `render.yaml` ở thư mục gốc. Cấu hình hiện tại:
   - Runtime: Docker
   - Region: `singapore`
   - Plan: `starter`
   - Instances: `1`
   - Docker context: `./backend`
   - Dockerfile: `./backend/Dockerfile`
   - Health check path: `/actuator/health`
   - Auto deploy: `false` (triển khai thủ công)
3. Nhập các biến `sync: false` khi Render yêu cầu (xem mục 8).

### 3.2. Docker image

Dockerfile dùng multi-stage:

- Build stage: `maven:3.9.9-eclipse-temurin-17`, chạy `mvn -Dmaven.test.skip=true package`.
  Build image **không** chạy test và **không** cần PostgreSQL localhost.
- Runtime stage: `eclipse-temurin:17-jre`, chạy bằng user không phải root `10001:10001`.
- `JAVA_OPTS` mặc định: `-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError`.
- Entrypoint: `exec java $JAVA_OPTS -jar /app/app.jar`.
- `PORT` được Spring Boot đọc qua `server.port: ${PORT:8080}`.

`.dockerignore` loại trừ `target/`, `uploads/`, `storage/`, `media/`, log, `.env*`, `.git`,
IDE files — không đưa secret hoặc dữ liệu upload vào image.

### 3.3. Kiểm tra sau deploy (safe start)

Thứ tự bắt buộc trong log khi container khởi động:

1. `Running early production configuration validation before context startup...`
   — kiểm tra cấu hình production chạy trong `EnvironmentPostProcessor`, **trước** khi
   application context, Flyway và web server được tạo.
2. `Production configuration validation passed successfully.`
3. `Successfully validated 24 migrations` / `Schema "public" is up to date`.
4. `Started ShareLoopApplication` và `Tomcat started on port <PORT>`.
5. `GET https://<render-service>.onrender.com/actuator/health` trả `200` với `{"status":"UP"}`.

Nếu bước 1–2 thất bại, ứng dụng **không** chạy Flyway, **không** khởi động web server và
**không** chạy bootstrap admin. Đọc message lỗi (không chứa secret), sửa biến môi trường rồi
deploy lại. Không tắt validation để "cho chạy".

### 3.4. Lưu ý multi-instance

- `numInstances` mặc định là `1`. Nếu tăng số instance:
  - Flyway có lock nên migration không chạy trùng, nhưng thời điểm deploy có thể khiến
    instance mới chờ lock.
  - Các scheduler (`UPLOAD_CLEANUP_CRON`, `PASSWORD_RESET_CLEANUP_CRON`) chạy trên **mọi**
    instance. Chỉ tăng instance khi đã có cơ chế khóa phân tán hoặc chấp nhận chạy trùng
    (các tác vụ hiện được thiết kế idempotent nhưng vẫn tốn tài nguyên).
  - Tổng connection = số instance × `DB_POOL_MAX_SIZE` + Flyway. Xem mục 5.3.
  - Rate limit, khóa đăng nhập, backoff tài khoản và quota upload đều dùng PostgreSQL
    advisory lock/aggregate trong DB nên nhất quán giữa các instance; không có bộ đếm
    in-memory làm nguồn thực thi duy nhất.

### 3.5. Mô hình tin cậy header chuyển tiếp trên Render

Production **không** dùng cơ chế `ForwardedHeaderFilter`/framework của Spring
(`server.forward-headers-strategy: none`). Địa chỉ client dùng cho rate limit được phân giải
bởi `ClientIpResolver`:

| `CLIENT_IP_MODE` | Hành vi | Khi nào dùng |
|---|---|---|
| `DIRECT` (mặc định) | Bỏ qua toàn bộ `X-Forwarded-For`, `Forwarded`, `X-Real-IP`; dùng địa chỉ peer của kết nối. | Mặc định an toàn khi chưa xác minh được dải proxy của Render. |
| `TRUSTED_CIDR` | Đọc `X-Forwarded-For` từ phải sang trái, dừng ở địa chỉ đầu tiên không thuộc `TRUSTED_PROXIES`; yêu cầu peer hiện tại là proxy tin cậy. | Chỉ khi có danh sách CIDR proxy tin cậy đã được xác minh độc lập. |

> **`TRUSTED_HOPS` đã bị gỡ bỏ (Phase 0.9.1).** Mode này đếm hop mà không xác minh địa chỉ
> proxy, cho phép client tự chèn `X-Forwarded-For` để vượt rate limit. Từ Phase 0.9.1, các mode
> được hỗ trợ chỉ còn `DIRECT` và `TRUSTED_CIDR`. Nếu `TRUSTED_PROXY_HOPS` còn trong cấu hình,
> hãy xoá biến này. Nếu `CLIENT_IP_MODE=TRUSTED_HOPS`, ứng dụng **từ chối khởi động** với thông
> báo hướng dẫn chuyển sang `DIRECT` (an toàn mặc định) hoặc `TRUSTED_CIDR` kèm danh sách
> `TRUSTED_PROXIES` đã xác minh độc lập — không có fallback âm thầm.

Quy tắc an toàn:

- Chỉ chấp nhận địa chỉ IPv4/IPv6 **literal**. Hostname, ký tự lạ, IPv4 sai định dạng,
  chuỗi rỗng hoặc nhiều dòng header `X-Forwarded-For` bị từ chối; không có truy vấn DNS.
- `TRUSTED_PROXIES` chỉ dùng với mode `TRUSTED_CIDR`. Cấu hình sai
  (mode tin cậy nhưng thiếu danh sách, hoặc CIDR không hợp lệ) làm ứng dụng **dừng khởi động**.
- Với Render, nếu chưa có bằng chứng xác minh dải proxy, giữ `CLIENT_IP_MODE=DIRECT`.
  Hạn chế đã biết: mọi request đi qua proxy Render dùng chung một bucket rate limit theo
  địa chỉ peer; điều này an toàn hơn tin header do client kiểm soát nhưng có thể làm giới hạn
  chung chặt hơn. Chỉ chuyển sang `TRUSTED_CIDR` sau khi đối chiếu hành vi proxy
  với dữ liệu quan sát/log thực tế của Render (ví dụ dải IP xuất bản của Cloudflare được
  xác minh độc lập từ tài liệu chính thức, không tự suy diễn).

---

## 4. Triển khai frontend trên Cloudflare Pages

> **Thứ tự phụ thuộc:** backend production yêu cầu `FRONTEND_BASE_URL` và
> `CORS_ALLOWED_ORIGINS` **ngay lần khởi động đầu tiên** (validation fail-fast). Vì vậy phải
> tạo Pages project và biết trước domain Pages (`https://<project>.pages.dev` hoặc custom
> domain) **trước khi** deploy backend lần đầu. Pages project được tạo trước nhưng deployment
> frontend có thể thực hiện sau khi backend đã `UP`.

1. **Workers & Pages → Create → Pages → Connect to Git**, chọn repo ShareLoop.
2. Cấu hình build:
   - Framework preset: `Vite` (hoặc None)
   - Root directory: `frontend`
   - Build command: `npm ci && npm run build`
   - Build output directory: `dist`
   - Node version: 22 (repo có `frontend/.nvmrc` = `22`; có thể đặt `NODE_VERSION=22`).
3. Ghi lại domain Pages ngay sau khi tạo project:
   `https://<project>.pages.dev` (hoặc custom domain đã gắn). Dùng đúng domain này cho
   `FRONTEND_BASE_URL` và `CORS_ALLOWED_ORIGINS` của backend.
4. Biến môi trường production của Pages:
   - `VITE_API_BASE_URL=https://<render-service>.onrender.com`
   - Không đặt giá trị này vào file `.env` được commit.
5. Deploy frontend (có thể sau khi backend đã `UP` vì đã biết URL Render từ bước tạo service).
6. Pages phục vụ SPA với `frontend/public/_redirects`:
   ```
   /* /index.html 200
   ```
7. `frontend/public/_headers` thêm các header bảo mật (CSP, HSTS, `X-Frame-Options`,
   `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`).

Lưu ý:

- Frontend production **bắt buộc** có `VITE_API_BASE_URL` là URL HTTPS tuyệt đối; build sẽ
  fail nếu thiếu hoặc dùng HTTP.
- `FRONTEND_BASE_URL` (backend, dùng tạo link email) và origin trong `CORS_ALLOWED_ORIGINS`
  phải trùng chính xác domain Pages: HTTPS, không dấu `/` cuối, không thêm path.
- Nếu dùng custom domain, gắn domain vào Pages **trước** khi deploy backend lần đầu, hoặc
  cập nhật cả `FRONTEND_BASE_URL` lẫn `CORS_ALLOWED_ORIGINS` rồi redeploy backend.

---

## 5. Cấu hình Neon PostgreSQL

### 5.1. Tạo project và database

1. Tạo Neon project với PostgreSQL 16 ở region gần Render Singapore (ví dụ `ap-southeast-1`).
2. Tạo database `shareloop` và role ứng dụng.
3. Lấy hai connection string:
   - **Pooled** (có hậu tố `-pooler`): dùng cho ứng dụng.
   - **Direct** (không có `-pooler`): dùng cho Flyway và các tác vụ quản trị.

### 5.2. Biến môi trường

Ứng dụng dùng pooled endpoint:

```
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-pooled-host>/shareloop?sslmode=require
SPRING_DATASOURCE_USERNAME=<neon-app-user>
SPRING_DATASOURCE_PASSWORD=<neon-app-password>
DB_SSL_MODE=require
```

Flyway có thể dùng direct endpoint (khuyến nghị cho production):

```
SPRING_FLYWAY_URL=jdbc:postgresql://<neon-direct-host>/shareloop?sslmode=require
SPRING_FLYWAY_USER=<migration-user>
SPRING_FLYWAY_PASSWORD=<migration-password>
```

Nếu ba biến `SPRING_FLYWAY_*` không được đặt, Flyway dùng lại datasource của ứng dụng
(pooled endpoint). Với PgBouncer transaction mode, chạy migration qua direct endpoint an toàn hơn.
Validation production chạy **trước** Flyway; nếu `SPRING_FLYWAY_URL` được đặt nhưng thiếu
user/password hoặc URL không an toàn, ứng dụng dừng trước khi migration bắt đầu. Không đặt
`SPRING_FLYWAY_URL` bằng HTTP/không SSL hoặc trỏ localhost ở production.

### 5.3. SSL và giới hạn connection

- Production validator từ chối URL localhost và `sslmode` không an toàn. Chỉ chấp nhận
  `require`, `verify-ca`, `verify-full`. Khuyến nghị `require` với Neon; nếu dùng
  `verify-ca`/`verify-full`, phải cấu hình trust store/root certificate ở cấp JVM.
- Hikari được giới hạn:
  - `DB_POOL_MAX_SIZE=5`
  - `DB_POOL_MIN_IDLE=1`
- Công thức: `số_instance_Render × DB_POOL_MAX_SIZE + 1 (Flyway) ≤ max_connections của Neon`.
  Kiểm tra giới hạn trong Neon Console trước khi tăng pool hoặc số instance.
- Không đặt `DB_SSL_MODE=disable` hoặc `sslmode=disable` ở production.

### 5.4. Migration lần đầu và database đã tồn tại

- Database mới: chỉ cần deploy backend, Flyway tự chạy V1–V24.
- Database đã có schema nhưng **chưa có** bảng `flyway_schema_history`: không để Flyway
  chạy mù. Quy trình:
  1. Sao lưu database.
  2. So sánh schema hiện tại với V1–V24 (chạy thử trên Neon branch).
  3. Nếu khớp, baseline đúng version hiện tại (ví dụ `flyway baseline -baselineVersion=24`)
     bằng direct endpoint, rồi deploy.
  4. Nếu không khớp, dừng lại và xử lý thủ công; **không sửa V1–V24** và không thêm migration
     để che giấu khác biệt.
- Mọi thay đổi schema mới phải là migration mới (V25+).

### 5.5. Backup / PITR

- Bật tính năng backup/PITR theo plan của Neon; thời gian lưu phụ thuộc plan — kiểm tra
  Neon Console.
- Trước thay đổi lớn: tạo **branch** từ dữ liệu production để thử migration/restore.
- Kiểm tra restore định kỳ bằng cách restore sang branch/database riêng, chạy health check
  và đối chiếu số lượng bản ghi.

---

## 6. Cấu hình Cloudflare R2

1. Tạo bucket, ví dụ `shareloop-production`. **Giữ bucket private**.
2. Tạo API token R2 giới hạn cho bucket này với quyền **Object Read & Write**.
3. Lấy S3 endpoint: `https://<account-id>.r2.cloudflarestorage.com`.
4. Cấu hình Render:
   ```
   STORAGE_PROVIDER=r2
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_BUCKET_NAME=shareloop-production
   R2_ACCESS_KEY_ID=<r2-access-key-id>
   R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
   ```
5. **Không đặt** `R2_PUBLIC_URL_PREFIX` cho bucket chứa attachment riêng tư. Biến này chỉ
   dùng khi chủ động có CDN công khai cho ảnh công khai; đặt sai có thể làm lộ file.
6. Không cần cấu hình CORS cho R2 vì backend proxy/stream file.
7. Object key do backend sinh (UUID), không dùng tên file người dùng làm key.
8. Kiểm tra sau deploy: upload avatar/ảnh listing, xem file xuất hiện trong bucket; tải
   attachment riêng tư qua UI khi đã đăng nhập và bị từ chối khi không có quyền.

---

## 7. Cấu hình Brevo

1. Xác minh sender domain/email trong Brevo.
2. Tạo API key transactional email; dán vào Render, không commit.
3. Cấu hình:
   ```
   MAIL_PROVIDER=brevo
   BREVO_API_KEY=<brevo-api-key>
   BREVO_SENDER_EMAIL=no-reply@<your-domain>
   BREVO_SENDER_NAME=ShareLoop
   FRONTEND_BASE_URL=https://<pages-domain>
   ```
4. `MAIL_PROVIDER=mock` bị production validator từ chối; không có fallback im lặng sang mock.
5. Email đặt lại mật khẩu chứa link:
   `https://<pages-domain>/reset-password?token=<token>`.
   Token được URL-encode, hết hạn theo `app.security.rate-limit.reset-token-expiration-minutes`
   (mặc định 15 phút), chỉ dùng một lần.
6. Kiểm thử: gửi yêu cầu quên mật khẩu với email thật, xác nhận nhận mail, link mở đúng
   trang, đặt lại mật khẩu thành công, dùng lại link cũ bị từ chối.
7. Log không chứa token hay URL đầy đủ; chỉ log domain người nhận.

---

## 8. Bảng biến môi trường

### 8.1. Backend (Render)

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `APP_ENV` | Khuyến nghị | Khai báo môi trường: `production`/`prod` (Render), `staging`, hoặc `development`/`dev`/`local`. Nếu đặt `production`/`prod`/`staging` thì bắt buộc `SPRING_PROFILES_ACTIVE=prod`; nếu đặt `development`/`dev`/`local` thì **không** được bật profile `prod`. Xem mục 8.3. |
| `SPRING_PROFILES_ACTIVE` | Có | `prod` (production/staging). |
| `PORT` | Render tự inject | Spring Boot đọc qua `server.port` |
| `JAVA_OPTS` | Không | Mặc định trong Dockerfile; có thể giảm heap nếu plan nhỏ |
| `CLIENT_IP_MODE` | Có | `DIRECT` mặc định; chỉ đổi sang `TRUSTED_CIDR` khi đã xác minh proxy (mục 3.5). `TRUSTED_HOPS` không còn được hỗ trợ và làm dừng khởi động |
| `TRUSTED_PROXIES` | Không* | Danh sách CIDR/IP literal, phân tách bằng dấu phẩy; bắt buộc khi `CLIENT_IP_MODE=TRUSTED_CIDR` |
| `LOGIN_RATE_LIMIT` | Không | Mặc định `5` lần/IP/cửa sổ |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | Không | Mặc định `60` |
| `REGISTRATION_IP_LIMIT` | Không | Mặc định `5` lần/IP/cửa sổ |
| `REGISTRATION_WINDOW_SECONDS` | Không | Mặc định `3600` |
| `ACCOUNT_BACKOFF_ENABLED` | Không | Mặc định `true` |
| `ACCOUNT_FAILURE_LIMIT` | Không | Số lần sai mật khẩu trước khi backoff; mặc định `5` |
| `ACCOUNT_WINDOW_SECONDS` | Không | Cửa sổ đếm lỗi tài khoản; mặc định `900` |
| `ACCOUNT_BACKOFF_BASE_SECONDS` | Không | Delay cơ sở; mặc định `30` |
| `ACCOUNT_BACKOFF_MAX_SECONDS` | Không | Delay tối đa; mặc định `900` |
| `UPLOAD_QUOTA_ENABLED` | Không | Mặc định `true` |
| `UPLOAD_QUOTA_USER_PERIOD_BYTES` | Không | Hạn mức rolling mỗi user; mặc định `52428800` (50 MiB) |
| `UPLOAD_QUOTA_USER_PERIOD_HOURS` | Không | Cửa sổ rolling; mặc định `24`. Bất biến production: phải **≤** `UPLOAD_CLEANUP_TTL_HOURS` (mục 8.2) |
| `SPRING_DATASOURCE_URL` | Có | Pooled Neon JDBC URL, `sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | Có | Role ứng dụng |
| `SPRING_DATASOURCE_PASSWORD` | Có | Secret |
| `DB_POOL_MAX_SIZE` | Không | Mặc định `5` |
| `DB_POOL_MIN_IDLE` | Không | Mặc định `1` |
| `DB_SSL_MODE` | Không | Mặc định `require`; không dùng `disable` |
| `SPRING_FLYWAY_URL` | Không | Direct Neon JDBC URL, `sslmode=require` |
| `SPRING_FLYWAY_USER` | Không* | Bắt buộc nếu đặt `SPRING_FLYWAY_URL` |
| `SPRING_FLYWAY_PASSWORD` | Không* | Bắt buộc nếu đặt `SPRING_FLYWAY_URL` |
| `JWT_SECRET` | Có | Render generate; không dùng giá trị mặc định/yếu |
| `FORGOT_PASSWORD_SECRET` | Có | ≥ 32 ký tự, ngẫu nhiên; validator từ chối giá trị mặc định |
| `ACCOUNT_BACKOFF_HMAC_SECRET` | Khuyến nghị | Secret HMAC riêng cho account backoff (≥ 32 ký tự). Nếu để trống, tạm thời dùng lại `FORGOT_PASSWORD_SECRET` kèm cảnh báo WARN một lần trong log; nên cấu hình secret riêng để hai chức năng không dùng chung khóa |
| `FRONTEND_BASE_URL` | Có | URL HTTPS của Pages/custom domain, biết trước lần boot đầu |
| `CORS_ALLOWED_ORIGINS` | Có | Danh sách origin HTTPS, phân tách bằng dấu phẩy; không wildcard |
| `CORS_ALLOWED_ORIGIN_PATTERNS` | Không | Chỉ dùng pattern giới hạn như `https://*.shareloop.pages.dev` |
| `CORS_ALLOW_CREDENTIALS` | Không | `false` |
| `MAIL_PROVIDER` | Có | `brevo` |
| `BREVO_API_KEY` | Có | Secret |
| `BREVO_SENDER_EMAIL` | Có | Email đã xác minh |
| `BREVO_SENDER_NAME` | Không | `ShareLoop` |
| `BREVO_API_URL` | Không | Mặc định `https://api.brevo.com/v3/smtp/email` |
| `BREVO_TIMEOUT_SECONDS` | Không | Mặc định `5` |
| `STORAGE_PROVIDER` | Có | `r2` |
| `R2_ENDPOINT` | Có | HTTPS S3 endpoint |
| `R2_BUCKET_NAME` | Có | Bucket private |
| `R2_ACCESS_KEY_ID` | Có | Secret |
| `R2_SECRET_ACCESS_KEY` | Có | Secret |
| `R2_PUBLIC_URL_PREFIX` | Không | Để trống với bucket private |
| `GOOGLE_LOGIN_ENABLED` | Không | `false` mặc định |
| `GOOGLE_CLIENT_ID` | Không | Bắt buộc nếu bật Google login |
| `APP_SEED_ENABLED` | Không | `false` ở production |
| `APP_ADMIN_BOOTSTRAP_ENABLED` | Không | Chỉ bật tạm thời khi tạo admin đầu tiên |
| `APP_ADMIN_BOOTSTRAP_PRODUCTION_CONFIRMED` | Không | Phải là `true` để bootstrap chạy trong profile `prod` |
| `ADMIN_BOOTSTRAP_EMAIL` | Không* | Bắt buộc khi bootstrap bật |
| `ADMIN_BOOTSTRAP_PASSWORD` | Không* | Bắt buộc khi bootstrap bật; ≥ 12 ký tự |
| `ADMIN_BOOTSTRAP_NAME` | Không | Mặc định `Admin ShareLoop` |
| `SHUTDOWN_TIMEOUT_PER_PHASE` | Không | Mặc định `30s` |
| `RESET_TOKEN_EXPIRATION_MINUTES` | Không | Mặc định `15`; thời hạn token đặt lại mật khẩu |
| `UPLOAD_CLEANUP_CRON` | Không | Mặc định mỗi giờ |
| `UPLOAD_CLEANUP_TTL_HOURS` | Không | Mặc định `24`. Bất biến production: phải **≥** `UPLOAD_QUOTA_USER_PERIOD_HOURS`; vi phạm làm dừng khởi động (mục 8.2) |
| `UPLOAD_LISTING_CLEANUP_TTL_HOURS` | Không | Mặc định `168` (7 ngày) |
| `UPLOAD_CLEANUP_BATCH_SIZE` | Không | Mặc định `100` mỗi lượt quét |

\* Bắt buộc có điều kiện như mô tả.

### 8.2. Bất biến upload: TTL dọn dẹp vs hạn mức quota

Hạn mức upload mỗi user được tính bằng SUM trên các dòng `uploaded_files` trong cửa sổ
`UPLOAD_QUOTA_USER_PERIOD_HOURS`. Dọn dẹp (`UPLOAD_CLEANUP_TTL_HOURS`) **xoá cứng dòng** này.
Vì vậy, production bắt buộc bất biến:

```
UPLOAD_CLEANUP_TTL_HOURS >= UPLOAD_QUOTA_USER_PERIOD_HOURS
```

Nếu vi phạm (ví dụ TTL=12, quota period=24), các dòng upload đã bị xoá sẽ không còn được đếm,
làm user vượt hạn mức. Validator production kiểm tra bất biến này trước khi Flyway và web
server khởi động; cấu hình sai làm ứng dụng **dừng khởi động** với thông báo nêu rõ cả hai
biến. Giá trị hợp lệ ví dụ: 24/24, 48/24.

Hạn chế đã biết: **avatar không đi qua quota/registry** (`AvatarService` lưu trực tiếp,
không tạo dòng `uploaded_files`), nên hạn mức upload không bao phủ ảnh đại diện. Đây là
hành vi hiện tại, chưa thay đổi trong Phase 0.9.1.

Đánh giá ledger `upload_quota_events` (append-only): với mặc định TTL=period=24h và bất biến
được validator ép buộc, ledger chưa cần thiết; **không tạo migration V25** trong Phase 0.9.1.
Nếu sau này cần quota chính xác tuyệt đối độc lập với vòng đời xoá dòng, có thể bổ sung
ledger append-only ghi mỗi sự kiện upload (kèm tổng tiền tính từ ledger thay vì từ
`uploaded_files`) — khi đó sẽ cần migration mới được duyệt riêng.

### 8.3. Ma trận `APP_ENV` và Spring profile

Bảng dưới đây là hành vi **fail-closed** ở giai đoạn `EnvironmentPostProcessor`:

| `APP_ENV` | `SPRING_PROFILES_ACTIVE` | Kết quả |
|---|---|---|
| `production` / `prod` | `prod` | Hợp lệ; chạy validation production. |
| `production` / `prod` | (không có `prod`) | **Dừng khởi động**: thiếu profile `prod`. |
| `staging` | `prod` | Hợp lệ; staging dùng cấu hình production. |
| `staging` | (không có `prod`) | **Dừng khởi động**: staging là production-like, cần `prod`. |
| `development` / `dev` / `local` | không có `prod` | Hợp lệ cho local dev; dùng cấu hình dev, không cần secret production. |
| `development` / `dev` / `local` | `prod` | **Dừng khởi động**: khai báo xung đột. |
| giá trị khác | bất kỳ | **Dừng khởi động**: `APP_ENV` không được hỗ trợ. |
| (không đặt hoặc rỗng) | `prod` | Hợp lệ; coi như production do profile `prod`, chạy validation. |
| (không đặt hoặc rỗng) | không có `prod`, có marker Render (`RENDER=true` hoặc `RENDER_SERVICE_ID`) | **Dừng khởi động**: Render production-like nhưng thiếu `prod`. |
| (không đặt hoặc rỗng) | không có `prod`, không có marker Render | Local dev bình thường. |

Lưu ý:

- Không suy ra production chỉ vì "đang chạy trong Docker": container local không có marker
  Render và không có `APP_ENV` vẫn chạy cấu hình dev. Ngược lại, marker Render **không** được
  phép âm thầm chạy cấu hình dev.
- Message lỗi chỉ nêu tên biến/profile thiếu; không in giá trị secret, mật khẩu, API key
  hay JWT secret.
- Validation production kiểm tra: mail provider Brevo + API key/sender, `FORGOT_PASSWORD_SECRET`
  đủ mạnh và không mặc định, `FRONTEND_BASE_URL` HTTPS, CORS origin HTTPS không wildcard,
  storage R2 + endpoint/bucket/key, datasource không phải localhost và `sslmode` an toàn,
  Flyway URL an toàn, `server.forward-headers-strategy=none`, và cấu hình `CLIENT_IP_MODE`.

### 8.4. Checklist biến môi trường trước khi deploy

Điền và xác nhận **trước** lần boot đầu tiên (không ghi secret vào file được commit):

- [ ] `SPRING_PROFILES_ACTIVE=prod` và (khuyến nghị) `APP_ENV=production`.
- [ ] `SPRING_DATASOURCE_*` trỏ Neon pooled, `sslmode=require`; `DB_SSL_MODE=require`.
- [ ] `SPRING_FLYWAY_*` (nếu dùng) trỏ Neon direct, `sslmode=require`; nếu không, Flyway
      dùng datasource pooled.
- [ ] `JWT_SECRET`, `FORGOT_PASSWORD_SECRET` và `ACCOUNT_BACKOFF_HMAC_SECRET` đã được Render
      generate hoặc tự sinh đủ mạnh (≥ 32 ký tự), chưa từng commit.
- [ ] `FRONTEND_BASE_URL` và `CORS_ALLOWED_ORIGINS` trùng đúng domain Pages HTTPS đã biết trước.
- [ ] `MAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` đã xác minh.
- [ ] `STORAGE_PROVIDER=r2`, đủ 4 biến R2; `R2_PUBLIC_URL_PREFIX` để trống.
- [ ] `CLIENT_IP_MODE=DIRECT` (hoặc cấu hình trusted proxy đã xác minh kèm
      `TRUSTED_PROXIES`; `TRUSTED_HOPS`/`TRUSTED_PROXY_HOPS` không còn được hỗ trợ).
- [ ] `UPLOAD_CLEANUP_TTL_HOURS >= UPLOAD_QUOTA_USER_PERIOD_HOURS` (mặc định 24/24 thoả mãn).
- [ ] `APP_ADMIN_BOOTSTRAP_ENABLED=false` (chỉ bật tạm khi bootstrap admin).
- [ ] `APP_SEED_ENABLED=false`.
- [ ] `GOOGLE_LOGIN_ENABLED` khớp với việc có `GOOGLE_CLIENT_ID` hay không.
- [ ] Các biến rate limit/quota dùng giá trị mặc định trừ khi có lý do và đã ghi lại.

### 8.2. Frontend (Cloudflare Pages)

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `VITE_API_BASE_URL` | Có | URL HTTPS tuyệt đối của Render, không có dấu `/` cuối |
| `NODE_VERSION` | Không | `22` (hoặc dùng `.nvmrc`) |

---

## 9. Bootstrap quản trị viên

Cơ chế bootstrap được thiết kế để chạy **một lần**, không có tài khoản/mật khẩu mặc định.

1. Chọn email admin riêng và mật khẩu mạnh (tối thiểu 12 ký tự, khuyến nghị ≥ 16 ký tự,
   có chữ hoa/thường/số/ký tự đặc biệt). Không dùng email của user hiện có.
2. Trong Render, đặt tạm:
   ```
   APP_ADMIN_BOOTSTRAP_ENABLED=true
   APP_ADMIN_BOOTSTRAP_PRODUCTION_CONFIRMED=true
   ADMIN_BOOTSTRAP_EMAIL=<admin-email>
   ADMIN_BOOTSTRAP_PASSWORD=<strong-password>
   ADMIN_BOOTSTRAP_NAME=<Admin Name>
   ```
3. Deploy và theo dõi log. Thành công có dòng:
   `Initial Administrator account successfully bootstrapped for 'xx***@domain'`.
4. Đăng nhập bằng tài khoản admin để xác nhận.
5. **Tắt ngay sau khi tạo:**
   - `APP_ADMIN_BOOTSTRAP_ENABLED=false`
   - Xoá `ADMIN_BOOTSTRAP_PASSWORD` (và email/name nếu không cần)
   - Deploy lại.

Hành vi an toàn:

- Validation production và kiểm tra `APP_ENV`/profile chạy trong giai đoạn
  `EnvironmentPostProcessor`, **trước** khi context/Flyway/web server/bootstrap admin tồn tại.
  Cấu hình sai thì bootstrap không bao giờ chạy.
- Nếu đã có bất kỳ tài khoản `ADMIN`, bootstrap bỏ qua.
- Nếu email đã thuộc user hiện có, bootstrap **từ chối** và không nâng quyền tự động.
- Mật khẩu được hash bằng BCrypt, không bao giờ ghi log.
- Trong profile production, thiếu `APP_ADMIN_BOOTSTRAP_PRODUCTION_CONFIRMED=true` sẽ bị chặn.
- Chạy lại nhiều lần an toàn (idempotent).
- Sau khi tạo admin: tắt `APP_ADMIN_BOOTSTRAP_ENABLED`, xoá mật khẩu bootstrap và redeploy
  ngay trong cùng ngày vận hành; không để cờ bootstrap bật lâu dài.

---

## 10. Flyway migrations

- Migrations nằm trong `backend/src/main/resources/db/migration`, phiên bản hiện tại **V1–V24**.
- Không sửa migration đã phát hành. Thay đổi schema mới dùng migration mới (V25+).
- Flyway chạy tự động khi ứng dụng khởi động; kiểm tra log:
  `Successfully applied N migrations ... now at version v24`.
- Database mới: không cần thao tác thủ công.
- Database đã tồn tại: xem mục 5.4. Không chạy `flyway clean` trên production.
- Nếu migration fail, ứng dụng dừng khởi động (fail-fast). Sửa nguyên nhân (quyền, kết nối,
  DDL) rồi deploy lại; không bỏ qua bằng cách tắt Flyway.
- Với Neon: ưu tiên direct endpoint cho Flyway để tránh hạn chế của PgBouncer transaction mode.

---

## 11. Health checks

- Endpoint: `GET /actuator/health`.
- Health bao gồm DataSource health indicator (`db`). Khi database không kết nối được,
  endpoint trả `503` với `{"status":"DOWN"}`; khi kết nối được trả `200` `{"status":"UP"}`.
  Đây không phải liveness luôn-UP.
- Production không hiển thị chi tiết (`show-details: never`, `show-components: never`).
- Render dùng endpoint này làm health check; service chỉ được coi là healthy khi DB OK.
- Không đổi health check path nếu chưa cập nhật `render.yaml`.
- Theo dõi thêm: log lỗi 5xx, thời gian khởi động, số migration, độ trễ DB trong Neon Console.

---

## 12. Trình tự triển khai đề xuất (theo thứ tự phụ thuộc)

Thứ tự dưới đây đảm bảo mọi biến bắt buộc đã có **trước** lần boot đầu tiên, vì validation
production chạy trước Flyway và trước khi web server nhận request.

1. **Chuẩn bị hạ tầng dữ liệu:** tạo Neon project/database/role; lấy pooled + direct
   connection string.
2. **Chuẩn bị storage/email:** tạo R2 bucket private + API token; xác minh Brevo sender +
   tạo API key.
3. **Tạo Pages project trước:** tạo project Pages, ghi lại domain `<project>.pages.dev`
   (hoặc gắn custom domain ngay). Chưa cần deploy frontend ở bước này — chỉ cần domain để
   cấu hình backend.
4. **Tạo Render Web Service** (Blueprint). Chưa deploy.
5. **Nhập đầy đủ biến môi trường** theo checklist mục 8.4, bao gồm:
   - `SPRING_PROFILES_ACTIVE=prod`, `APP_ENV=production` (khuyến nghị);
   - datasource Neon pooled + SSL; Flyway direct nếu dùng;
   - `FRONTEND_BASE_URL` và `CORS_ALLOWED_ORIGINS` đúng domain Pages ở bước 3;
   - Brevo + R2 + JWT/Forgot secret.
6. **Deploy backend lần đầu.** Theo dõi log theo mục 3.3: validation → Flyway → Tomcat →
   health `UP`. Nếu validation fail, bổ sung biến rồi deploy lại; **không** tắt validation.
7. **Deploy frontend Pages** với `VITE_API_BASE_URL=https://<render-service>.onrender.com`
   (URL Render đã biết từ bước 4–6).
8. **Kiểm tra CORS/email thật:** mở frontend, đăng nhập; gửi thử quên mật khẩu và xác nhận
   link trong email trỏ đúng domain Pages.
9. **Bootstrap admin một lần** theo mục 9, sau đó **tắt ngay** bootstrap và xoá
   `ADMIN_BOOTSTRAP_PASSWORD`, rồi redeploy.
10. **Smoke test:**
    - Đăng ký/đăng nhập; thử vượt rate limit đăng nhập/đăng ký để xác nhận 429.
    - Upload avatar và ảnh listing; kiểm tra file trên R2.
    - Upload vượt quota và xác nhận bị từ chối (không mất file registry cũ).
    - Gửi/nhận attachment riêng tư khi có quyền; xác nhận người ngoài bị từ chối.
    - Quên mật khẩu → nhận email Brevo → đặt lại → token cũ không dùng lại được.
    - Trang admin hoạt động; CORS không lỗi trên browser.
11. **Bật backup/PITR** và ghi lại quy trình restore.

Không chạy migration, upload hay thao tác xoá dữ liệu production từ môi trường local trừ khi
được phê duyệt rõ ràng.

---

## 13. Rollback

### Backend (Render)

- Vào **Service → Deploys**, chọn bản deploy ổn định trước đó → **Rollback**.
- Hoặc redeploy commit/image đã biết tốt.
- Không rollback schema bằng cách xoá migration. Flyway là forward-only.
- Nếu migration mới gây lỗi:
  1. Dừng deploy.
  2. Đánh giá migration có backward-compatible không.
  3. Khôi phục dữ liệu từ PITR/branch nếu cần (thao tác phá huỷ — phải được phê duyệt).
  4. Sửa bằng migration mới, không sửa migration cũ.

### Frontend (Cloudflare Pages)

- Vào **Deployments**, chọn deployment ổn định trước đó → **Rollback**.
- Giữ nguyên `VITE_API_BASE_URL` tương ứng backend.

### Cấu hình

- Lưu lại giá trị biến môi trường trước mỗi lần đổi (không lưu secret vào git).
- Khi rollback code, kiểm tra lại contract API với frontend đang chạy.

---

## 14. Backup và restore

- **Neon:** dùng PITR/branch theo plan; tạo branch trước thay đổi lớn. Thời gian lưu tùy plan.
- **pg_dump định kỳ (tuỳ chọn):**
  ```bash
  pg_dump "postgresql://<user>:<password>@<neon-direct-host>/shareloop?sslmode=require" \
    --format=custom --file=shareloop-<date>.dump
  ```
  Lưu file ở nơi an toàn, mã hoá; không commit.
- **Restore thử nghiệm:**
  1. Tạo database/branch riêng.
  2. Restore dump hoặc PITR vào đó.
  3. Chạy backend trỏ vào bản restore (môi trường tạm) và kiểm tra `/actuator/health`.
  4. Đối chiếu số bản ghi các bảng chính.
- **R2:** database là nguồn tham chiếu chính; object mồ côi được dọn bằng cơ chế lifecycle.
  Nếu cần backup object, dùng công cụ đồng bộ (ví dụ rclone) theo chính sách của bạn.
- Không restore đè production khi chưa có phê duyệt và chưa xác nhận bản backup.

---

## 15. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Ứng dụng dừng trước khi có log Flyway | Validation production fail (mail, CORS, R2, secret, datasource, forwarding) | Đọc message validator; sửa biến môi trường; không tắt validation |
| `Production deployment detected ... 'prod' profile is not active` | `APP_ENV=production` hoặc marker Render nhưng thiếu `SPRING_PROFILES_ACTIVE=prod` | Đặt `SPRING_PROFILES_ACTIVE=prod`; bỏ profile dev nếu có |
| `Conflicting environment declarations` | `APP_ENV` dev/local/staging mâu thuẫn với profile `prod` (hoặc ngược lại) | Chọn một khai báo: production dùng `APP_ENV=production` + profile `prod`; local bỏ `APP_ENV` hoặc dùng `development` không kèm `prod` |
| `Unsupported APP_ENV value` | Giá trị `APP_ENV` ngoài danh sách hỗ trợ | Dùng `production`/`prod`/`staging`/`development`/`dev`/`local` hoặc bỏ biến |
| Health `503 DOWN` | Sai URL/credential, Neon suspend, SSL sai | Kiểm tra `SPRING_DATASOURCE_*`, `sslmode`, trạng thái compute Neon |
| Ứng dụng không khởi động, lỗi validator | Thiếu `FRONTEND_BASE_URL`, CORS, R2, Brevo, secret yếu | Đọc message validator; bổ sung đúng biến |
| Flyway fail | Sai direct endpoint/quyền; DB có schema nhưng thiếu history | Kiểm tra log, quyền DDL; baseline theo mục 5.4 |
| Flyway lỗi prepared statement qua pooler | PgBouncer transaction mode | Dùng direct endpoint cho Flyway; hoặc thêm `prepareThreshold=0` cho URL ứng dụng |
| CORS error trên browser | Origin không khớp, có dấu `/` cuối, dùng HTTP, thiếu domain preview | Cập nhật `CORS_ALLOWED_ORIGINS` chính xác; pattern chỉ cho preview |
| Upload lỗi 5xx | R2 endpoint/key/bucket sai | Kiểm tra 4 biến R2; xác nhận bucket private và token đúng quyền |
| Upload trả lỗi quota | Vượt `UPLOAD_QUOTA_USER_PERIOD_BYTES` trong cửa sổ rolling | Hành vi đúng; kiểm tra quota, xoá file không cần thiết hoặc chờ cửa sổ trôi qua |
| Ảnh riêng tư không tải được | Chưa đăng nhập/không có quyền | Đây là hành vi đúng; kiểm tra phiên đăng nhập và quyền domain |
| Email không gửi | Brevo key/sender chưa xác minh | Kiểm tra log (không có token), xác minh sender, thử gửi test |
| Bootstrap admin bị chặn | Thiếu production confirmation | Đặt `APP_ADMIN_BOOTSTRAP_PRODUCTION_CONFIRMED=true` tạm thời |
| Bootstrap không tạo admin | Đã có ADMIN hoặc email thuộc user khác | Kiểm tra log; dùng email admin mới |
| Rate limit áp dụng chung cho nhiều người | `CLIENT_IP_MODE=DIRECT` sau proxy Render: mọi request cùng peer address | Hành vi an toàn mặc định. Chỉ chuyển sang `TRUSTED_CIDR` kèm `TRUSTED_PROXIES` đã xác minh; `TRUSTED_HOPS` không còn được hỗ trợ và làm app dừng khởi động |
| Rate limit không chặn được kẻ đổi header | Đang dùng mode tin cậy nhưng cấu hình proxy sai | Kiểm tra `TRUSTED_PROXIES`; nếu chưa xác minh, quay lại `DIRECT` |
| OOM / restart | Heap vượt RAM plan | Giảm `-XX:MaxRAMPercentage`, tăng plan, kiểm tra memory leak |
| Port không đúng | Ghi đè `PORT` hoặc sửa `server.port` | Để Render inject `PORT`; không hardcode |

---

## 16. Security checklist

- [ ] Không có secret trong git, `render.yaml`, Dockerfile, image hay tài liệu.
- [ ] `render.yaml` dùng `sync: false` cho secret và `generateValue: true` cho JWT/Forgot secret.
- [ ] `SPRING_PROFILES_ACTIVE=prod`; `APP_ENV` (nếu đặt) nhất quán với profile; validator
      production chạy thành công **trước** Flyway và web server.
- [ ] `server.forward-headers-strategy=none`; `CLIENT_IP_MODE` được chọn có chủ đích.
      `DIRECT` nếu chưa xác minh dải proxy Render; nếu dùng `TRUSTED_CIDR` thì
      `TRUSTED_PROXIES` đã được xác minh và cấu hình đúng (`TRUSTED_HOPS` không còn hỗ trợ).
- [ ] `FRONTEND_BASE_URL` và `CORS_ALLOWED_ORIGINS` trùng đúng domain Pages, đã đặt trước
      lần boot đầu tiên.
- [ ] Database dùng SSL (`sslmode=require`), không dùng `disable`.
- [ ] Neon role ứng dụng có quyền tối thiểu; role migration tách biệt nếu có thể.
- [ ] `JWT_SECRET`, `FORGOT_PASSWORD_SECRET`, `ACCOUNT_BACKOFF_HMAC_SECRET` ngẫu nhiên, đủ mạnh; có kế hoạch xoay vòng.
      Lưu ý chuyển tiếp: nếu chưa cấu hình `ACCOUNT_BACKOFF_HMAC_SECRET`, khóa HMAC của account backoff
      tạm thời suy ra từ `FORGOT_PASSWORD_SECRET`; xoay `FORGOT_PASSWORD_SECRET` khi chưa có secret riêng
      sẽ đặt lại trạng thái backoff đang hiệu lực trong tối đa một cửa sổ backoff.
- [ ] R2 bucket private; `R2_PUBLIC_URL_PREFIX` để trống; attachment riêng tư chỉ qua backend.
- [ ] `MAIL_PROVIDER=brevo`; không có mock fallback ở production.
- [ ] Rate limit đăng nhập/đăng ký, account backoff và upload quota đang bật với giá trị
      mặc định hoặc giá trị đã ghi lại; không tắt để "dễ test" trên production.
- [ ] `APP_ADMIN_BOOTSTRAP_ENABLED=false` sau khi tạo admin; mật khẩu bootstrap đã xoá.
- [ ] Không tồn tại tài khoản/mật khẩu admin mặc định.
- [ ] CORS chỉ gồm domain HTTPS cụ thể; không `*`; credentials `false` nếu không cần.
- [ ] Swagger/OpenAPI tắt ở production (`springdoc.*.enabled=false`).
- [ ] Health endpoint không lộ chi tiết.
- [ ] Log không chứa token, mật khẩu, API key hay connection string.
- [ ] Backup/PITR đã bật; đã thử restore ở môi trường tách biệt.
- [ ] Flyway V1–V24 không bị sửa; migration mới dùng version tiếp theo.
- [ ] `numInstances=1` hoặc đã xử lý scheduler/multi-instance an toàn; rate limit/quota/backoff
      dựa trên DB nên vẫn nhất quán khi tăng instance.
- [ ] Đã smoke test luồng đăng nhập, upload, attachment riêng tư, quên mật khẩu, admin.
- [ ] Theo dõi health, log lỗi và cảnh báo từ Render/Neon/Cloudflare.

---

## Phụ lục — Kiểm tra cấu hình local trước khi deploy

Có thể kiểm tra image production locally với PostgreSQL có SSL (không dùng dữ liệu thật):

```bash
docker build -t shareloop-backend:local backend
docker run --rm -p 18080:9090 \
  -e PORT=9090 \
  -e APP_ENV=production \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e CLIENT_IP_MODE=DIRECT \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://<non-localhost-host>:5432/shareloop?sslmode=require' \
  -e SPRING_DATASOURCE_USERNAME=<user> \
  -e SPRING_DATASOURCE_PASSWORD=<password> \
  -e DB_SSL_MODE=require \
  -e JWT_SECRET=<random-64-chars> \
  -e FORGOT_PASSWORD_SECRET=<random-48-chars> \n  -e ACCOUNT_BACKOFF_HMAC_SECRET=<random-48-chars> \
  -e FRONTEND_BASE_URL=https://<pages-domain> \
  -e CORS_ALLOWED_ORIGINS=https://<pages-domain> \
  -e BREVO_API_KEY=<dummy-for-boot> \
  -e BREVO_SENDER_EMAIL=no-reply@<domain> \
  -e STORAGE_PROVIDER=r2 \
  -e R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
  -e R2_BUCKET_NAME=<bucket> \
  -e R2_ACCESS_KEY_ID=<dummy> \
  -e R2_SECRET_ACCESS_KEY=<dummy> \
  shareloop-backend:local

curl -i http://localhost:18080/actuator/health
```

Kỳ vọng: container chạy user `10001`; log có
`Running early production configuration validation...` → `validation passed` → Flyway V1–V24
→ health `200 UP`; khi dừng database, health chuyển `503 DOWN`.

Có thể kiểm tra fail-closed mà không cần database: chạy lại lệnh trên nhưng bỏ
`SPRING_PROFILES_ACTIVE=prod` (giữ `APP_ENV=production`) — container phải dừng **trước** khi
Flyway/web server khởi động với message yêu cầu `SPRING_PROFILES_ACTIVE=prod`. Tương tự, đổi
`APP_ENV=development` cùng `SPRING_PROFILES_ACTIVE=prod` phải bị từ chối là xung đột.
