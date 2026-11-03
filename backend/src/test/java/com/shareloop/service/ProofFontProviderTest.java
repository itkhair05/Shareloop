package com.shareloop.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProofFontProviderTest {

    @Test
    @DisplayName("Both Noto Sans font files load from the classpath")
    void loadsFontsFromClasspath() {
        ProofFontProvider provider = new ProofFontProvider();

        assertThat(provider.getRegularFontBytes()).isNotEmpty();
        assertThat(provider.getBoldFontBytes()).isNotEmpty();
    }

    @Test
    @DisplayName("Missing font resource fails fast with a controlled error")
    void missingFontFailsFast() {
        assertThatThrownBy(() -> new ProofFontProvider("fonts/missing-regular.ttf", "fonts/missing-bold.ttf"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing-regular.ttf");
    }
}
