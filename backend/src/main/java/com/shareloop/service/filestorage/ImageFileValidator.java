package com.shareloop.service.filestorage;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Set;

@Component
public class ImageFileValidator {

    public static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MiB
    public static final int MAX_DIMENSION = 4_096; // 4,096 px defense against decompression bombs
    public static final long MAX_TOTAL_PIXELS = 16_000_000L; // 16 Megapixels maximum raster size

    // Magic bytes
    private static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = new byte[]{(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47, (byte) 0x0D, (byte) 0x0A, (byte) 0x1A, (byte) 0x0A};

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png");

    public record ValidationResult(byte[] bytes, String extension, String contentType) {}

    public ValidationResult validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file cannot be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum permitted limit of 5 MiB");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read uploaded file content");
        }

        if (bytes.length == 0) {
            throw new IllegalArgumentException("Uploaded file content is empty");
        }

        if (bytes.length > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum permitted limit of 5 MiB");
        }

        // Magic byte validation
        String detectedExtension = detectFormatBySignature(bytes);
        if (detectedExtension == null) {
            throw new IllegalArgumentException("Unsupported file type. Only JPEG and PNG images are accepted");
        }

        String detectedContentType = detectedExtension.equals("jpg") ? "image/jpeg" : "image/png";

        // Check declared Content-Type if present
        String declaredContentType = file.getContentType();
        if (declaredContentType != null && !declaredContentType.isBlank()) {
            String normalizedDeclared = declaredContentType.toLowerCase().split(";")[0].trim();
            if (!ALLOWED_MIME_TYPES.contains(normalizedDeclared)) {
                throw new IllegalArgumentException("Declared content type is not supported: " + declaredContentType);
            }
            if (!normalizedDeclared.equals(detectedContentType)) {
                throw new IllegalArgumentException("Declared content type (" + declaredContentType + ") does not match detected format (" + detectedContentType + ")");
            }
        }

        // Actual image decoding using ImageIO
        verifyImageDecode(bytes, detectedContentType);

        return new ValidationResult(bytes, detectedExtension, detectedContentType);
    }

    private String detectFormatBySignature(byte[] bytes) {
        if (bytes.length >= 3 && bytes[0] == JPEG_MAGIC[0] && bytes[1] == JPEG_MAGIC[1] && bytes[2] == JPEG_MAGIC[2]) {
            return "jpg";
        }
        if (bytes.length >= 8) {
            boolean isPng = true;
            for (int i = 0; i < PNG_MAGIC.length; i++) {
                if (bytes[i] != PNG_MAGIC[i]) {
                    isPng = false;
                    break;
                }
            }
            if (isPng) {
                return "png";
            }
        }
        return null;
    }

    private void verifyImageDecode(byte[] bytes, String format) {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
             ImageInputStream iis = ImageIO.createImageInputStream(bais)) {

            if (iis == null) {
                throw new IllegalArgumentException("Unable to process image data stream");
            }

            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Corrupted or unsupported image data");
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);

                // Bounded dimension inspection to protect against decompression bombs
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);

                if (width <= 0 || height <= 0) {
                    throw new IllegalArgumentException("Image has invalid dimensions");
                }

                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    throw new IllegalArgumentException("Image dimensions (" + width + "x" + height + ") exceed the maximum permitted limit of " + MAX_DIMENSION + "x" + MAX_DIMENSION + " pixels");
                }

                long totalPixels = (long) width * height;
                if (totalPixels > MAX_TOTAL_PIXELS) {
                    throw new IllegalArgumentException("Total image pixels (" + totalPixels + ") exceed the maximum permitted limit of " + MAX_TOTAL_PIXELS + " pixels");
                }

                // Verify actual decode
                BufferedImage image = reader.read(0);
                if (image == null) {
                    throw new IllegalArgumentException("Image content is undecodable or malformed");
                }
            } finally {
                reader.dispose();
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Corrupted or undecodable image file: " + e.getMessage());
        }
    }
}
