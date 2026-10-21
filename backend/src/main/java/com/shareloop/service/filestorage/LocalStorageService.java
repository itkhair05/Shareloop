package com.shareloop.service.filestorage;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.exception.StorageException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private static final Pattern SAFE_FILENAME_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.(jpg|jpeg|png)$");

    private final Path rootPath;
    private final String baseUrl;

    public LocalStorageService(
            @Value("${app.storage.local.root-dir:./uploads}") String rootDir,
            @Value("${app.storage.local.base-url:/api/v1/files}") String baseUrl
    ) {
        this.rootPath = Paths.get(rootDir).toAbsolutePath().normalize();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.rootPath);
            log.info("Initialized local file storage directory at: {}", this.rootPath);
        } catch (IOException e) {
            throw new StorageException("Failed to initialize storage directory", e);
        }
    }

    @Override
    public FileUploadResponse store(byte[] bytes, String extension, String contentType) {
        String cleanExtension = extension.startsWith(".") ? extension : "." + extension;
        UUID fileId = UUID.randomUUID();
        String filename = fileId + cleanExtension;

        Path targetLocation = this.rootPath.resolve(filename).normalize();

        // Enforce path containment
        if (!targetLocation.startsWith(this.rootPath)) {
            throw new StorageException("Path traversal attempt detected: " + filename);
        }

        try {
            Files.write(targetLocation, bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        } catch (IOException e) {
            try {
                Files.deleteIfExists(targetLocation);
            } catch (IOException ignored) {
            }
            throw new StorageException("Failed to store file: " + e.getMessage(), e);
        }

        String url = this.baseUrl + "/" + filename;
        return new FileUploadResponse(fileId.toString(), filename, contentType, bytes.length, url);
    }

    @Override
    public Resource loadAsResource(String filename) {
        if (filename == null || !SAFE_FILENAME_PATTERN.matcher(filename).matches()) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }

        Path targetLocation = this.rootPath.resolve(filename).normalize();

        if (!targetLocation.startsWith(this.rootPath) || !Files.exists(targetLocation) || !Files.isRegularFile(targetLocation)) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }

        try {
            Resource resource = new UrlResource(targetLocation.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new ResourceNotFoundException("File not found: " + filename);
            }
        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }
    }

    public Path getRootPath() {
        return this.rootPath;
    }
}
