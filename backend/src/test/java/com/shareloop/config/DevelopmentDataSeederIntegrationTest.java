package com.shareloop.config;

import com.shareloop.dto.listing.ListingSummaryResponse;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.service.ListingService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.seed.enabled=true",
        "spring.datasource.url=jdbc:postgresql://localhost:5432/shareloop_test_db"
})
@ActiveProfiles("dev")
@Transactional
class DevelopmentDataSeederIntegrationTest {

    @Autowired
    private DevelopmentDataSeeder developmentDataSeeder;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ListingService listingService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Verify Flyway V8 migration localizes all 9 categories to Vietnamese with stable slugs")
    void flywayV8LocalizesAllDefaultCategories() {
        Map<String, String> expectedCategories = Map.of(
                "tools-diy", "Dụng cụ & Đồ sửa chữa",
                "electronics-appliances", "Điện tử & Đồ gia dụng",
                "books-media", "Sách & Văn hóa phẩm",
                "home-furniture", "Nhà cửa & Nội thất",
                "clothing-accessories", "Quần áo & Phụ kiện",
                "baby-kids", "Mẹ & Bé",
                "sports-outdoors", "Thể thao & Ngoài trời",
                "food-pantry", "Thực phẩm & Đồ khô",
                "other", "Khác"
        );

        for (Map.Entry<String, String> entry : expectedCategories.entrySet()) {
            Optional<Category> opt = categoryRepository.findBySlug(entry.getKey());
            assertThat(opt).as("Category '%s' must exist", entry.getKey()).isPresent();
            Category cat = opt.get();
            assertThat(cat.getName()).as("Category '%s' name", entry.getKey()).isEqualTo(entry.getValue());
            assertThat(cat.getIsActive()).isTrue();
            assertThat(cat.getDescription()).isNotBlank();
        }
    }

    @Test
    @DisplayName("Verify development data seeder inserts 12 listings across categories and is idempotent")
    void developmentDataSeederIsIdempotentAndValid() {
        // Run seed
        int firstRunCount = developmentDataSeeder.seed();
        assertThat(firstRunCount).isGreaterThanOrEqualTo(0); // If run on start it was already seeded, or seeds now

        // Check that all 12 demo listings exist in DB
        for (DevelopmentDataSeeder.DemoListingDefinition def : DevelopmentDataSeeder.DEMO_LISTINGS) {
            Optional<Listing> opt = listingRepository.findById(def.id());
            assertThat(opt).as("Listing '%s' must exist", def.title()).isPresent();
            Listing listing = opt.get();

            assertThat(listing.getTitle()).isEqualTo(def.title());
            assertThat(listing.getListingType()).isEqualTo(def.listingType());
            assertThat(listing.getCategory().getSlug()).isEqualTo(def.categorySlug());
            assertThat(listing.getCity()).isEqualTo(def.city());
            assertThat(listing.getCountry()).isEqualTo("VN");
            assertThat(listing.getStatus()).isEqualTo(ListingStatus.ACTIVE);

            if (def.listingType() == ListingType.GIVEAWAY) {
                assertThat(listing.getPrice()).isNull();
                assertThat(listing.getCurrency()).isNull();
            } else if (def.listingType() == ListingType.SALE) {
                assertThat(listing.getPrice()).isNotNull().isGreaterThan(BigDecimal.ZERO);
                assertThat(listing.getCurrency()).isEqualTo("VND");
            } else if (def.listingType() == ListingType.WANTED && def.price() != null) {
                assertThat(listing.getPrice()).isGreaterThan(BigDecimal.ZERO);
                assertThat(listing.getCurrency()).isEqualTo("VND");
            }
        }

        // Idempotency check: running seed again should return 0 new listings and not fail
        int secondRunCount = developmentDataSeeder.seed();
        assertThat(secondRunCount).isEqualTo(0);
    }

    @Test
    @DisplayName("Verify seeded listings can be searched and filtered via public ListingService")
    void publicListingServiceCanQuerySeededListings() {
        developmentDataSeeder.seed();

        // 1. Browse public listings (all active)
        Page<ListingSummaryResponse> allListings = listingService.getPublicListings(
                null, null, null, null, null, 0, 20);
        assertThat(allListings.getTotalElements()).isGreaterThanOrEqualTo(12);

        // 2. Filter by city: 'Hà Nội'
        Page<ListingSummaryResponse> hanoiListings = listingService.getPublicListings(
                null, null, null, "Hà Nội", null, 0, 20);
        assertThat(hanoiListings.getContent()).isNotEmpty();
        assertThat(hanoiListings.getContent()).allMatch(l -> l.getCity().equalsIgnoreCase("Hà Nội"));

        // 3. Filter by type: 'GIVEAWAY'
        Page<ListingSummaryResponse> giveawayListings = listingService.getPublicListings(
                null, ListingType.GIVEAWAY, null, null, null, 0, 20);
        assertThat(giveawayListings.getContent()).isNotEmpty();
        assertThat(giveawayListings.getContent()).allMatch(l -> l.getListingType() == ListingType.GIVEAWAY);

        // 4. Keyword search: 'khoan'
        Page<ListingSummaryResponse> keywordSearch = listingService.getPublicListings(
                "khoan", null, null, null, null, 0, 20);
        assertThat(keywordSearch.getContent()).isNotEmpty();
        assertThat(keywordSearch.getContent().get(0).getTitle()).containsIgnoringCase("khoan");
    }

    @Test
    @DisplayName("Verify seeder rejects execution under prod, production, and staging profiles even if app.seed.enabled=true")
    void environmentGuardBlocksProdProductionAndStagingEvenIfSeedPropertyIsEnabled() {
        for (String restrictedProfile : List.of("prod", "production", "staging")) {
            MockEnvironment env = new MockEnvironment();
            env.setActiveProfiles(restrictedProfile);
            env.setProperty("app.seed.enabled", "true");

            DevelopmentDataSeeder seeder = new DevelopmentDataSeeder(
                    userRepository,
                    categoryRepository,
                    listingRepository,
                    passwordEncoder,
                    env,
                    jdbcTemplate
            );

            int result = seeder.seed();
            assertThat(result)
                    .as("Seeder must strictly return 0 under profile '%s'", restrictedProfile)
                    .isEqualTo(0);
        }
    }

    @Test
    @DisplayName("Verify seeder rejects execution when app.seed.enabled is false or missing (default-disabled behavior)")
    void defaultDisabledBehaviorBlocksSeedingWhenPropertyIsFalseOrMissing() {
        // Case 1: Property is explicitly false in dev
        MockEnvironment envFalse = new MockEnvironment();
        envFalse.setActiveProfiles("dev");
        envFalse.setProperty("app.seed.enabled", "false");

        DevelopmentDataSeeder seederFalse = new DevelopmentDataSeeder(
                userRepository,
                categoryRepository,
                listingRepository,
                passwordEncoder,
                envFalse,
                jdbcTemplate
        );
        assertThat(seederFalse.seed())
                .as("Seeder must return 0 when app.seed.enabled=false")
                .isEqualTo(0);

        // Case 2: Property is missing in dev
        MockEnvironment envMissing = new MockEnvironment();
        envMissing.setActiveProfiles("dev");

        DevelopmentDataSeeder seederMissing = new DevelopmentDataSeeder(
                userRepository,
                categoryRepository,
                listingRepository,
                passwordEncoder,
                envMissing,
                jdbcTemplate
        );
        assertThat(seederMissing.seed())
                .as("Seeder must return 0 when app.seed.enabled is not configured")
                .isEqualTo(0);
    }

    @Test
    @DisplayName("Verify seeder rejects execution when active profile is not a recognized development environment")
    void rejectionWhenProfileIsNotDevOrLocal() {
        MockEnvironment unapprovedEnv = new MockEnvironment();
        unapprovedEnv.setActiveProfiles("default");
        unapprovedEnv.setProperty("app.seed.enabled", "true");

        DevelopmentDataSeeder seeder = new DevelopmentDataSeeder(
                userRepository,
                categoryRepository,
                listingRepository,
                passwordEncoder,
                unapprovedEnv,
                jdbcTemplate
        );
        assertThat(seeder.seed())
                .as("Seeder must return 0 when profile is not dev, local, or test")
                .isEqualTo(0);
    }

    @AfterAll
    static void tearDownSeededData(
            @Autowired ListingRepository listingRepository,
            @Autowired UserRepository userRepository
    ) {
        for (DevelopmentDataSeeder.DemoListingDefinition def : DevelopmentDataSeeder.DEMO_LISTINGS) {
            listingRepository.findById(def.id()).ifPresent(listingRepository::delete);
        }
        userRepository.findById(DevelopmentDataSeeder.DEV_OWNER_ID).ifPresent(userRepository::delete);
    }
}
