package com.shareloop.testsupport;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Paths;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TestStorageSupportTest {

    @Test
    @DisplayName("Isolated test storage root is accepted")
    void isolatedRootAccepted() {
        assertThatCode(() -> TestStorageSupport.assertNotDevelopmentStorage(TestStorageSupport.isolatedRoot()))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Development uploads root is rejected")
    void developmentRootRejected() {
        assertThatThrownBy(() -> TestStorageSupport.assertNotDevelopmentStorage(Paths.get("uploads")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("overlaps the development upload directory");
    }

    @Test
    @DisplayName("Path nested inside the development uploads root is rejected")
    void nestedDevelopmentPathRejected() {
        assertThatThrownBy(() -> TestStorageSupport.assertNotDevelopmentStorage(Paths.get("uploads", "nested")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("overlaps the development upload directory");
    }

    @Test
    @DisplayName("Cleanup refuses filenames that are not owned test uploads")
    void cleanupRejectsUnexpectedFilename() {
        assertThatThrownBy(() -> TestStorageSupport.deleteOwnedFiles(
                TestStorageSupport.isolatedRoot(), List.of("../escape.jpg")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("unexpected test filename");
    }
}
