package com.shareloop.testsupport;

import org.springframework.test.context.DynamicPropertyRegistry;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Supplies the isolated storage root used by integration tests and refuses to run when that root
 * overlaps the development upload directory.
 */
public final class TestStorageSupport {

    public static final String ROOT_DIR_PROPERTY = "app.storage.local.root-dir";

    private static final Pattern SAFE_FILENAME_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.(jpg|jpeg|png)$");

    private TestStorageSupport() {
    }

    public static Path isolatedRoot() {
        return Paths.get("target", "test-uploads").toAbsolutePath().normalize();
    }

    /**
     * Registers the isolated root before the Spring context is refreshed. Also fails fast when the
     * configured location overlaps the development upload directory.
     */
    public static void registerIsolatedRoot(DynamicPropertyRegistry registry) {
        Path root = isolatedRoot();
        assertNotDevelopmentStorage(root);
        registry.add(ROOT_DIR_PROPERTY, root::toString);
    }

    /**
     * Verifies the storage root actually resolved by {@code LocalStorageService}, not just the
     * configured value.
     */
    public static void assertEffectiveRootIsIsolated(Path effectiveRoot) {
        Path actual = canonical(effectiveRoot);
        Path expected = canonical(isolatedRoot());
        if (!actual.equals(expected)) {
            throw new IllegalStateException("Integration tests must use the isolated test storage root "
                    + expected + " but resolved " + actual);
        }
        assertNotDevelopmentStorage(actual);
    }

    /**
     * Fails when {@code candidate} is, contains, or is contained by a development storage root.
     */
    public static void assertNotDevelopmentStorage(Path candidate) {
        Path normalized = canonical(candidate);
        for (Path developmentRoot : developmentStorageCandidates()) {
            if (normalized.startsWith(developmentRoot) || developmentRoot.startsWith(normalized)) {
                throw new IllegalStateException("Test storage root " + normalized
                        + " overlaps the development upload directory " + developmentRoot
                        + ". Refusing to run storage tests against development data.");
            }
        }
    }

    /**
     * Deletes only the explicitly owned files, never every file in the storage root.
     */
    public static void deleteOwnedFiles(Path root, Collection<String> filenames) {
        Path normalizedRoot = canonical(root);
        assertNotDevelopmentStorage(normalizedRoot);

        for (String filename : filenames) {
            if (filename == null || !SAFE_FILENAME_PATTERN.matcher(filename).matches()) {
                throw new IllegalStateException("Refusing to delete unexpected test filename: " + filename);
            }
            Path target = normalizedRoot.resolve(filename).normalize();
            if (!target.startsWith(normalizedRoot)) {
                throw new IllegalStateException("Refusing to delete file outside the test storage root: " + target);
            }
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
                // Leftover test files are harmless because the root is isolated.
            }
        }
    }

    private static List<Path> developmentStorageCandidates() {
        List<Path> candidates = new ArrayList<>();

        String baseDir = System.getProperty("basedir");
        Path projectDir = (baseDir != null && !baseDir.isBlank())
                ? Paths.get(baseDir)
                : Paths.get("").toAbsolutePath();
        candidates.add(canonical(projectDir.resolve("uploads")));

        // Resolved by LocalStorageService when app.storage.local.root-dir is a relative default.
        candidates.add(canonical(Paths.get("uploads")));

        String configuredRoot = System.getenv("STORAGE_LOCAL_ROOT");
        if (configuredRoot != null && !configuredRoot.isBlank()) {
            candidates.add(canonical(Paths.get(configuredRoot)));
        }

        String systemPropertyRoot = System.getProperty(ROOT_DIR_PROPERTY);
        if (systemPropertyRoot != null && !systemPropertyRoot.isBlank()) {
            candidates.add(canonical(Paths.get(systemPropertyRoot)));
        }

        return candidates;
    }

    private static Path canonical(Path path) {
        Path absolute = path.toAbsolutePath().normalize();
        try {
            return absolute.toRealPath();
        } catch (IOException e) {
            return absolute;
        }
    }
}
