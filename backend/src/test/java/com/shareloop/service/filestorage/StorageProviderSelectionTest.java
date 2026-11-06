package com.shareloop.service.filestorage;

import com.shareloop.config.StorageProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class StorageProviderSelectionTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
            .withUserConfiguration(StorageProperties.class, LocalStorageService.class, R2StorageService.class)
            .withPropertyValues("app.storage.local.root-dir=target/test-uploads-provider");

    @Test
    @DisplayName("Local storage is selected when no provider is configured")
    void localProviderIsDefault() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(FileStorageService.class);
            assertThat(context.getBean(FileStorageService.class)).isInstanceOf(LocalStorageService.class);
            assertThat(context).doesNotHaveBean(R2StorageService.class);
        });
    }

    @Test
    @DisplayName("The r2 provider replaces local storage with the R2 implementation")
    void r2ProviderSelectsR2StorageService() {
        runner.withPropertyValues(
                        "app.storage.provider=r2",
                        "app.storage.r2.endpoint=https://account.r2.cloudflarestorage.com",
                        "app.storage.r2.bucket-name=shareloop-private",
                        "app.storage.r2.access-key-id=test-access-key",
                        "app.storage.r2.secret-access-key=test-secret-key")
                .run(context -> {
                    assertThat(context).hasSingleBean(FileStorageService.class);
                    assertThat(context.getBean(FileStorageService.class)).isInstanceOf(R2StorageService.class);
                    assertThat(context).doesNotHaveBean(LocalStorageService.class);
                });
    }

    @Test
    @DisplayName("The r2 provider fails fast when credentials are missing")
    void r2ProviderFailsFastWithoutConfiguration() {
        runner.withPropertyValues("app.storage.provider=r2")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .rootCause()
                            .hasMessageContaining("R2_ENDPOINT");
                });
    }

    @Test
    @DisplayName("The r2 provider rejects a non-HTTPS endpoint")
    void r2ProviderRejectsNonHttpsEndpoint() {
        runner.withPropertyValues(
                        "app.storage.provider=r2",
                        "app.storage.r2.endpoint=http://account.r2.cloudflarestorage.com",
                        "app.storage.r2.bucket-name=shareloop-private",
                        "app.storage.r2.access-key-id=test-access-key",
                        "app.storage.r2.secret-access-key=test-secret-key")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .rootCause()
                            .hasMessageContaining("HTTPS");
                });
    }
}
