package com.shareloop.service;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

/**
 * Loads the Noto Sans font binaries once at startup so each PDF request only
 * creates document-scoped font instances. Missing font resources fail fast.
 */
@Component
public class ProofFontProvider {

    static final String REGULAR_FONT_PATH = "fonts/NotoSans-Regular.ttf";
    static final String BOLD_FONT_PATH = "fonts/NotoSans-Bold.ttf";

    private final byte[] regularFontBytes;
    private final byte[] boldFontBytes;

    public ProofFontProvider() {
        this(REGULAR_FONT_PATH, BOLD_FONT_PATH);
    }

    ProofFontProvider(String regularFontPath, String boldFontPath) {
        this.regularFontBytes = loadRequired(regularFontPath);
        this.boldFontBytes = loadRequired(boldFontPath);
    }

    private static byte[] loadRequired(String path) {
        try (InputStream input = new ClassPathResource(path).getInputStream()) {
            return input.readAllBytes();
        } catch (IOException | IllegalArgumentException | NullPointerException ex) {
            throw new IllegalStateException("Required proof font resource is missing or unreadable: " + path, ex);
        }
    }

    public byte[] getRegularFontBytes() {
        return regularFontBytes;
    }

    public byte[] getBoldFontBytes() {
        return boldFontBytes;
    }
}
