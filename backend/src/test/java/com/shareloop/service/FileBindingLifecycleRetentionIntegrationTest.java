package com.shareloop.service;

import com.shareloop.dto.report.UpdateReportAdminRequest;
import com.shareloop.dto.review.ModerateReviewRequest;
import com.shareloop.dto.support.UpdateSupportRequestAdminRequest;
import com.shareloop.dto.user.UpdateUserStatusAdminRequest;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.Report;
import com.shareloop.entity.Review;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.ReportRepository;
import com.shareloop.repository.ReviewRepository;
import com.shareloop.repository.SupportRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UploadedFileBindingRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.filestorage.LocalStorageService;
import com.shareloop.testsupport.TestStorageSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that domain status changes never release or delete evidence bindings.
 * Account deletion/anonymization does not exist in the current codebase; the
 * account test therefore verifies that an administrative status change does not
 * affect retained evidence.
 */
@SpringBootTest
@ActiveProfiles("test")
class FileBindingLifecycleRetentionIntegrationTest {

    private static final byte[] FILE_BYTES = "retention-image-bytes".getBytes();

    @Autowired
    private FileBindingService fileBindingService;

    @Autowired
    private ReviewService reviewService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private SupportRequestService supportRequestService;

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private UploadedFileBindingRepository uploadedFileBindingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private LocalStorageService localStorageService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User owner;
    private User requester;
    private Category category;
    private Listing listing;
    private final Set<String> trackedFilenames = new HashSet<>();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        TestStorageSupport.registerIsolatedRoot(registry);
    }

    @BeforeEach
    void setUp() {
        TestStorageSupport.assertEffectiveRootIsIsolated(localStorageService.getRootPath());

        admin = userRepository.saveAndFlush(new User(
                "Retention Admin",
                "retention.admin." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));
        owner = userRepository.saveAndFlush(new User(
                "Retention Owner",
                "retention.owner." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        requester = userRepository.saveAndFlush(new User(
                "Retention Requester",
                "retention.requester." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        category = categoryRepository.saveAndFlush(new Category(
                "RetentionCategory-" + UUID.randomUUID().toString().substring(0, 8),
                "retention-cat-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
        listing = new Listing(owner, category, ListingType.GIVEAWAY, "Retention Item", "Description", "Hanoi");
        listing.setStatus(ListingStatus.ACTIVE);
        listing = listingRepository.saveAndFlush(listing);
    }

    @AfterEach
    void tearDown() {
        // Delete files only after the physical objects are gone; bindings first so
        // the bound-file delete guard is satisfied.
        uploadedFileBindingRepository.deleteAll();
        uploadedFileRepository.deleteAll();
        reportRepository.deleteAll();
        supportRequestRepository.deleteAll();
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.delete(listing);
        categoryRepository.delete(category);
        userRepository.delete(admin);
        userRepository.delete(owner);
        userRepository.delete(requester);

        Path root = localStorageService.getRootPath();
        for (String filename : trackedFilenames) {
            try {
                Files.deleteIfExists(root.resolve(filename));
            } catch (IOException ignored) {
            }
        }
    }

    private UploadedFile createFile(User fileOwner, UploadPurpose purpose) {
        UUID id = UUID.randomUUID();
        String filename = id + ".png";
        trackedFilenames.add(filename);
        try {
            Files.write(localStorageService.getRootPath().resolve(filename), FILE_BYTES);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to create test file", e);
        }
        UploadedFile file = new UploadedFile(id, filename, fileOwner, "image/png", FILE_BYTES.length, purpose);
        return uploadedFileRepository.saveAndFlush(file);
    }

    private Review createReview() {
        ListingRequest listingRequest = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing, requester, "Retention request", ListingRequestStatus.ACCEPTED));
        Transaction transaction = new Transaction(
                listingRequest, listing, owner, requester, TransactionStatus.COMPLETED);
        Instant completedAt = Instant.now();
        transaction.setOwnerCompleted(true);
        transaction.setRequesterCompleted(true);
        transaction.setOwnerCompletedAt(completedAt);
        transaction.setRequesterCompletedAt(completedAt);
        transaction = transactionRepository.saveAndFlush(transaction);
        return reviewRepository.saveAndFlush(
                new Review(transaction, requester, owner, 5, "Great exchange"));
    }

    @Test
    @DisplayName("Hiding a review keeps its bound image evidence")
    void hiddenReviewKeepsEvidence() {
        Review review = createReview();
        UploadedFile file = createFile(owner, UploadPurpose.REVIEW);
        fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", review.getId(), owner);

        reviewService.moderateReview(
                review.getId(),
                new ModerateReviewRequest("Nội dung không phù hợp"),
                UserPrincipal.create(admin));

        assertThat(reviewRepository.findById(review.getId()).orElseThrow().getIsHidden()).isTrue();
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();

        List<?> bindings = fileBindingService.findBindingsByDomainAndEntity("REVIEW", review.getId());
        assertThat(bindings).hasSize(1);
        assertThat(fileBindingService.requireBinding(file.getId(), "REVIEW", review.getId()).getFileId())
                .isEqualTo(file.getId());
    }

    @Test
    @DisplayName("Resolving and dismissing a moderation report keeps its evidence")
    void resolvedAndDismissedReportKeepEvidence() {
        Report report = reportRepository.saveAndFlush(new Report(
                requester, ReportTargetType.LISTING, listing.getId(), ReportCategory.OTHER, "Report description"));
        UploadedFile file = createFile(requester, UploadPurpose.REPORT);
        fileBindingService.bindFile(file.getId(), UploadPurpose.REPORT, "REPORT", report.getId(), requester);
        UserPrincipal adminPrincipal = UserPrincipal.create(admin);

        reportService.updateReportAdmin(
                report.getId(),
                new UpdateReportAdminRequest(ReportStatus.RESOLVED, "Đã xử lý"),
                adminPrincipal);

        assertThat(reportRepository.findById(report.getId()).orElseThrow().getStatus())
                .isEqualTo(ReportStatus.RESOLVED);
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();

        reportService.updateReportAdmin(
                report.getId(),
                new UpdateReportAdminRequest(ReportStatus.DISMISSED, "Không đủ căn cứ"),
                adminPrincipal);

        assertThat(reportRepository.findById(report.getId()).orElseThrow().getStatus())
                .isEqualTo(ReportStatus.DISMISSED);
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
    }

    @Test
    @DisplayName("Support request status changes keep their evidence")
    void supportStatusChangesKeepEvidence() {
        SupportRequest supportRequest = supportRequestRepository.saveAndFlush(new SupportRequest(
                requester, null, SupportCategory.OTHER, "Cần hỗ trợ", "Mô tả vấn đề"));
        UploadedFile file = createFile(requester, UploadPurpose.SUPPORT);
        fileBindingService.bindFile(file.getId(), UploadPurpose.SUPPORT, "SUPPORT", supportRequest.getId(), requester);
        UserPrincipal adminPrincipal = UserPrincipal.create(admin);

        supportRequestService.updateSupportRequestAdmin(
                supportRequest.getId(),
                new UpdateSupportRequestAdminRequest(SupportRequestStatus.IN_PROGRESS, null, null),
                adminPrincipal);

        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();

        supportRequestService.updateSupportRequestAdmin(
                supportRequest.getId(),
                new UpdateSupportRequestAdminRequest(SupportRequestStatus.RESOLVED, "Đã hỗ trợ", "Ghi chú"),
                adminPrincipal);

        assertThat(supportRequestRepository.findById(supportRequest.getId()).orElseThrow().getStatus())
                .isEqualTo(SupportRequestStatus.RESOLVED);
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
    }

    @Test
    @DisplayName("An uploader account status change does not delete retained evidence")
    void accountStatusChangeKeepsEvidence() {
        Review review = createReview();
        UploadedFile file = createFile(owner, UploadPurpose.REVIEW);
        fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", review.getId(), owner);

        adminUserService.updateUserStatus(
                owner.getId(),
                new UpdateUserStatusAdminRequest(UserStatus.SUSPENDED),
                UserPrincipal.create(admin));

        assertThat(userRepository.findById(owner.getId()).orElseThrow().getStatus())
                .isEqualTo(UserStatus.SUSPENDED);
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
    }
}
