package com.shareloop.config;

import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Development-only database seeder for ShareLoop marketplace.
 *
 * Populates realistic, fictional listings across various categories, cities,
 * and listing types (GIVEAWAY, SALE, WANTED) for local UI/UX testing and development.
 *
 * Environment isolation:
 * - Requires spring profile 'dev'.
 * - Requires 'app.seed.enabled=true' (configured in application-dev.yml).
 * - Guarded against production and staging environments at runtime.
 * - Idempotent: uses deterministic UUIDs and checks existing records before insertion.
 */
@Component
@Profile("dev")
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DevelopmentDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevelopmentDataSeeder.class);

    public static final UUID DEV_OWNER_ID = UUID.fromString("e0000000-0000-0000-0000-000000000001");
    public static final String DEV_OWNER_EMAIL = "demo.community@shareloop.local";

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ListingRepository listingRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;
    private final JdbcTemplate jdbcTemplate;

    public record DemoListingDefinition(
            UUID id,
            String categorySlug,
            ListingType listingType,
            String title,
            String description,
            BigDecimal price,
            String currency,
            String city,
            String neighborhood,
            int hoursAgo
    ) {}

    public static final List<DemoListingDefinition> DEMO_LISTINGS = List.of(
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000001"),
                    "books-media",
                    ListingType.GIVEAWAY,
                    "Tặng bộ sách giáo trình tiếng Anh giao tiếp và từ điển Oxford",
                    "Mình vừa hoàn thành chứng chỉ nên muốn tặng lại trọn bộ 3 cuốn sách tiếng Anh giao tiếp còn mới 90% kèm đĩa nghe cho bạn nào cần ôn tập.",
                    null,
                    null,
                    "Hồ Chí Minh",
                    "Quận 1",
                    2
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000002"),
                    "tools-diy",
                    ListingType.SALE,
                    "Bộ máy khoan và vặn vít không dây 12V kèm 2 pin sạc",
                    "Máy khoan cầm tay gia đình ít sử dụng, lực vặn tốt, kèm hộp đựng và 2 viên pin dự phòng còn rất khỏe. Thích hợp sửa chữa đồ dùng trong nhà.",
                    new BigDecimal("450000.00"),
                    "VND",
                    "Hà Nội",
                    "Cầu Giấy",
                    4
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000003"),
                    "home-furniture",
                    ListingType.GIVEAWAY,
                    "Tặng bàn làm việc gỗ thông mini cho sinh viên",
                    "Bàn gỗ tự nhiên kích thước 80x50cm chắc chắn, hơi trầy nhẹ ở góc nhưng dùng làm việc hoặc học tập rất tiện lợi. Ưu tiên các bạn sinh viên tự đến chở.",
                    null,
                    null,
                    "Đà Nẵng",
                    "Hải Châu",
                    7
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000004"),
                    "baby-kids",
                    ListingType.SALE,
                    "Xe đẩy gấp gọn du lịch cho bé dưới 3 tuổi",
                    "Xe đẩy du lịch siêu nhẹ chỉ 4.5kg, gấp gọn có thể mang lên máy bay, khung nhôm chắc chắn, đệm vải thoáng khí đã giặt sạch sẽ.",
                    new BigDecimal("350000.00"),
                    "VND",
                    "Hồ Chí Minh",
                    "Bình Thạnh",
                    12
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000005"),
                    "electronics-appliances",
                    ListingType.WANTED,
                    "Cần tìm nồi chiên không dầu dung tích 4L - 6L còn hoạt động tốt",
                    "Gia đình mình đang cần tìm một chiếc nồi chiên không dầu cơ hoặc điện tử để phục vụ bữa ăn hàng ngày, ngoại hình còn tương đối tốt.",
                    new BigDecimal("500000.00"),
                    "VND",
                    "Hà Nội",
                    "Đống Đa",
                    18
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000006"),
                    "sports-outdoors",
                    ListingType.SALE,
                    "Vợt cầu lông Yonex dòng công thủ toàn diện kèm bao đựng",
                    "Vợt đã căng cước Yonex 10.5kg, quấn cán mới thay, thân vợt bằng sợi carbon nhẹ linh hoạt, thích hợp cho người mới bắt đầu hoặc chơi phong trào.",
                    new BigDecimal("280000.00"),
                    "VND",
                    "Đà Nẵng",
                    "Sơn Trà",
                    24
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000007"),
                    "clothing-accessories",
                    ListingType.GIVEAWAY,
                    "Tặng áo khoác gió mùa đông size L lót nỉ ấm áp",
                    "Áo khoác gió 2 lớp chống nước nhẹ, bên trong có lớp nỉ ấm, khóa kéo trơn tru, mình mặc hơi rộng nên muốn chia sẻ lại cho người cần.",
                    null,
                    null,
                    "Hà Nội",
                    "Hà Đông",
                    30
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000008"),
                    "food-pantry",
                    ListingType.GIVEAWAY,
                    "Tặng rau sạch trồng sân thượng và bí ngô vườn nhà",
                    "Vườn nhà thu hoạch nhiều rau cải xanh và 2 quả bí ngô không dùng hết, muốn gửi tặng các bạn hàng xóm gần khu vực Ninh Kiều.",
                    null,
                    null,
                    "Cần Thơ",
                    "Ninh Kiều",
                    36
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000009"),
                    "electronics-appliances",
                    ListingType.SALE,
                    "Màn hình máy tính 24 inch Full HD cổng HDMI/VGA",
                    "Màn hình viền mỏng IPS góc nhìn rộng, hiển thị màu sắc đẹp, không điểm chết, đầy đủ dây nguồn và cáp HDMI đi kèm.",
                    new BigDecimal("1200000.00"),
                    "VND",
                    "Hồ Chí Minh",
                    "Thủ Đức",
                    42
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000010"),
                    "sports-outdoors",
                    ListingType.WANTED,
                    "Tìm xe đạp thể thao cũ cho học sinh cấp 2 đi học",
                    "Mình đang tìm một chiếc xe đạp thể thao hoặc mini cũ còn đi êm cho cháu đi học hàng ngày, không quan trọng hình thức miễn là phanh và xích còn tốt.",
                    null,
                    null,
                    "Hải Phòng",
                    "Ngô Quyền",
                    48
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000011"),
                    "home-furniture",
                    ListingType.SALE,
                    "Đèn cây đứng trang trí phòng khách bóng LED ánh sáng vàng",
                    "Đèn sàn phong cách Bắc Âu tối giản, thân kim loại sơn tĩnh điện, chao vải chống lóa mắt, có công tắc dậm chân rất tiện.",
                    new BigDecimal("220000.00"),
                    "VND",
                    "Hà Nội",
                    "Tây Hồ",
                    56
            ),
            new DemoListingDefinition(
                    UUID.fromString("d0000000-0000-0000-0000-000000000012"),
                    "other",
                    ListingType.GIVEAWAY,
                    "Tặng chậu cây cảnh lưỡi hổ và trầu bà thanh lọc không khí",
                    "Nhà mình nhân giống được vài chậu trầu bà và lưỡi hổ để bàn rất dễ chăm sóc, muốn tặng cho bạn nào thích không gian xanh.",
                    null,
                    null,
                    "Hồ Chí Minh",
                    "Quận 7",
                    64
            )
    );

    public DevelopmentDataSeeder(
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            ListingRepository listingRepository,
            PasswordEncoder passwordEncoder,
            Environment environment,
            JdbcTemplate jdbcTemplate
    ) {
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.listingRepository = listingRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        seed();
    }

    @Transactional
    public int seed() {
        // 1. Strict guard against running in production or staging environments
        if (environment.acceptsProfiles(Profiles.of("prod", "production", "staging"))) {
            log.warn("DevelopmentDataSeeder execution blocked: Environment is production or staging. Seeding aborted.");
            return 0;
        }

        // 2. Strict guard requiring recognized development/local environment
        if (!environment.acceptsProfiles(Profiles.of("dev", "local", "test"))) {
            log.warn("DevelopmentDataSeeder execution blocked: Active profile is not a recognized development environment. Seeding aborted.");
            return 0;
        }

        // 3. Strict guard requiring explicit opt-in property app.seed.enabled=true
        boolean seedEnabled = Boolean.parseBoolean(environment.getProperty("app.seed.enabled", "false"));
        if (!seedEnabled) {
            log.warn("DevelopmentDataSeeder execution blocked: app.seed.enabled is false or not set. Explicit opt-in required. Seeding aborted.");
            return 0;
        }

        log.info("Starting development data seeding for ShareLoop marketplace...");

        User owner = getOrCreateDevOwner();
        int seededCount = seedListings(owner);

        log.info("Development data seeding complete. {} new demo listings seeded (total definitions: {}).",
                seededCount, DEMO_LISTINGS.size());
        return seededCount;
    }

    private User getOrCreateDevOwner() {
        Optional<User> existing = userRepository.findByEmail(DEV_OWNER_EMAIL);
        if (existing.isPresent()) {
            return existing.get();
        }

        log.info("Provisioning development demo owner user '{}'", DEV_OWNER_EMAIL);
        String randomPassword = UUID.randomUUID().toString();
        jdbcTemplate.update(
                "INSERT INTO users (id, display_name, email, password_hash, role, status, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, 'USER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                "ON CONFLICT (email) DO NOTHING",
                DEV_OWNER_ID, "Cộng đồng ShareLoop", DEV_OWNER_EMAIL, passwordEncoder.encode(randomPassword)
        );

        return userRepository.findByEmail(DEV_OWNER_EMAIL)
                .orElseThrow(() -> new IllegalStateException("Failed to load dev owner user after insertion"));
    }

    private int seedListings(User owner) {
        Instant now = Instant.now();
        int created = 0;

        for (DemoListingDefinition def : DEMO_LISTINGS) {
            if (listingRepository.existsById(def.id())) {
                log.debug("Demo listing '{}' (ID: {}) already exists, skipping.", def.title(), def.id());
                continue;
            }

            Category category = categoryRepository.findBySlug(def.categorySlug())
                    .orElseThrow(() -> new IllegalStateException(
                            "Required category with slug '" + def.categorySlug() + "' not found. " +
                            "Please ensure Flyway migrations V5 & V8 have been applied."));

            Instant staggeredCreatedAt = now.minus(Duration.ofHours(def.hoursAgo()));
            Timestamp timestamp = Timestamp.from(staggeredCreatedAt);

            int rows = jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, status, neighborhood, city, country, created_at, updated_at) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 'VN', ?, ?) " +
                    "ON CONFLICT (id) DO NOTHING",
                    def.id(), owner.getId(), category.getId(), def.listingType().name(), def.title(), def.description(),
                    def.price(), def.currency(), def.neighborhood(), def.city(), timestamp, timestamp
            );

            if (rows > 0) {
                created++;
                log.debug("Seeded listing: [{}] '{}' ({})", def.listingType(), def.title(), def.city());
            }
        }

        return created;
    }
}
