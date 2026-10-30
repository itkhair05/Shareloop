package com.shareloop.security.google;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.shareloop.exception.GoogleAuthConfigurationException;
import com.shareloop.exception.InvalidGoogleIdTokenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.security.GeneralSecurityException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class GoogleIdTokenVerifierServiceTest {

    private static final String CONFIGURED_CLIENT_ID = "test-client-id-12345.apps.googleusercontent.com";
    private static final String SAMPLE_RAW_TOKEN = "header.payload.signature";

    private GoogleSecurityProperties properties;
    private GoogleIdTokenVerifier mockVerifier;
    private GoogleIdTokenVerifierService service;

    @BeforeEach
    void setUp() {
        properties = new GoogleSecurityProperties();
        properties.setEnabled(true);
        properties.setClientId(CONFIGURED_CLIENT_ID);
        mockVerifier = mock(GoogleIdTokenVerifier.class);
        service = new GoogleIdTokenVerifierService(properties, mockVerifier);
    }

    private GoogleIdToken.Payload createValidPayload() {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject("google-user-sub-001");
        payload.setEmail("User.Test@ShareLoop.vn");
        payload.setEmailVerified(true);
        payload.set("name", "Nguyen Van A");
        payload.set("picture", "https://lh3.googleusercontent.com/avatar.jpg");
        return payload;
    }

    private GoogleIdToken createGoogleIdToken(GoogleIdToken.Payload payload) {
        GoogleIdToken token = mock(GoogleIdToken.class);
        when(token.getPayload()).thenReturn(payload);
        return token;
    }

    @Test
    @DisplayName("Case 1: Valid Google ID Token with expected audience returns verified claims")
    void validGoogleIdTokenReturnsVerifiedClaims() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        GoogleUserClaims claims = service.verify(SAMPLE_RAW_TOKEN);

        assertThat(claims).isNotNull();
        assertThat(claims.subject()).isEqualTo("google-user-sub-001");
        assertThat(claims.email()).isEqualTo("user.test@shareloop.vn");
        assertThat(claims.emailVerified()).isTrue();
        assertThat(claims.displayName()).isEqualTo("Nguyen Van A");
        assertThat(claims.pictureUrl()).isEqualTo("https://lh3.googleusercontent.com/avatar.jpg");
    }

    @Test
    @DisplayName("Valid token without optional name and picture returns claims with nulls safely")
    void validTokenWithoutOptionalClaimsReturnsSafely() throws Exception {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject("google-sub-2");
        payload.setEmail("simple@shareloop.vn");
        payload.setEmailVerified(true);
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        GoogleUserClaims claims = service.verify(SAMPLE_RAW_TOKEN);

        assertThat(claims).isNotNull();
        assertThat(claims.subject()).isEqualTo("google-sub-2");
        assertThat(claims.email()).isEqualTo("simple@shareloop.vn");
        assertThat(claims.emailVerified()).isTrue();
        assertThat(claims.displayName()).isNull();
        assertThat(claims.pictureUrl()).isNull();
    }

    @Test
    @DisplayName("Case 2: Invalid signature causes verifier to return null and throws InvalidGoogleIdTokenException")
    void invalidSignatureThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(null);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Invalid or expired Google ID Token");
    }

    @Test
    @DisplayName("Case 3: Wrong audience causes verifier to return null and throws InvalidGoogleIdTokenException")
    void wrongAudienceThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(null);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Invalid or expired Google ID Token");
    }

    @Test
    @DisplayName("Case 4: Invalid issuer causes verifier to return null and throws InvalidGoogleIdTokenException")
    void invalidIssuerThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(null);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Invalid or expired Google ID Token");
    }

    @Test
    @DisplayName("Case 5: Expired token causes verifier to return null and throws InvalidGoogleIdTokenException")
    void expiredTokenThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(null);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Invalid or expired Google ID Token");
    }

    @Test
    @DisplayName("Case 6: Missing subject in token payload throws InvalidGoogleIdTokenException")
    void missingSubjectThrowsInvalidGoogleIdTokenException() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        payload.setSubject(null);
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google ID Token missing subject claim");
    }

    @Test
    @DisplayName("Case 6b: Blank subject in token payload throws InvalidGoogleIdTokenException")
    void blankSubjectThrowsInvalidGoogleIdTokenException() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        payload.setSubject("   ");
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google ID Token missing subject claim");
    }

    @Test
    @DisplayName("Case 7: Missing email in token payload throws InvalidGoogleIdTokenException")
    void missingEmailThrowsInvalidGoogleIdTokenException() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        payload.setEmail(null);
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google ID Token missing email claim");
    }

    @Test
    @DisplayName("Case 7b: Blank email in token payload throws InvalidGoogleIdTokenException")
    void blankEmailThrowsInvalidGoogleIdTokenException() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        payload.setEmail("   ");
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google ID Token missing email claim");
    }

    @Test
    @DisplayName("Case 8: email_verified == false throws InvalidGoogleIdTokenException")
    void unverifiedEmailThrowsInvalidGoogleIdTokenException() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        payload.setEmailVerified(false);
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google account email is not verified");
    }

    @Test
    @DisplayName("Case 8b: email_verified == null throws InvalidGoogleIdTokenException")
    void nullEmailVerifiedThrowsInvalidGoogleIdTokenException() throws Exception {
        GoogleIdToken.Payload payload = createValidPayload();
        payload.setEmailVerified(null);
        GoogleIdToken idToken = createGoogleIdToken(payload);
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenReturn(idToken);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google account email is not verified");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  ", "\t", "\n"})
    @DisplayName("Case 9: Null, empty, or whitespace raw token throws InvalidGoogleIdTokenException without invoking verifier")
    void emptyOrWhitespaceTokenThrowsInvalidGoogleIdTokenException(String blankToken) {
        assertThatThrownBy(() -> service.verify(blankToken))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Google ID Token must not be null or empty");

        verifyNoInteractions(mockVerifier);
    }

    @Test
    @DisplayName("Case 9b: Malformed token causing verifier IllegalArgumentException throws InvalidGoogleIdTokenException")
    void malformedTokenThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenThrow(new IllegalArgumentException("Invalid JWT compact serialization"));

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Malformed Google ID Token format");
    }

    @Test
    @DisplayName("Case 10: Missing Google Client ID configuration throws GoogleAuthConfigurationException")
    void missingClientIdThrowsGoogleAuthConfigurationException() {
        properties.setClientId("");

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(GoogleAuthConfigurationException.class)
                .hasMessage("Google Sign-In is not configured or is disabled on this server");

        verifyNoInteractions(mockVerifier);
    }

    @Test
    @DisplayName("Case 10b: Disabled Google Sign-In throws GoogleAuthConfigurationException")
    void disabledGoogleLoginThrowsGoogleAuthConfigurationException() {
        properties.setEnabled(false);

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(GoogleAuthConfigurationException.class)
                .hasMessage("Google Sign-In is not configured or is disabled on this server");

        verifyNoInteractions(mockVerifier);
    }

    @Test
    @DisplayName("Case 11: Google signing key retrieval failure (IOException) safely throws InvalidGoogleIdTokenException without leaking details")
    void googleSigningKeyRetrievalFailureSafelyThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenThrow(new IOException("Failed to fetch Google certs at https://www.googleapis.com/oauth2/v3/certs"));

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Failed to verify Google ID Token signature");
    }

    @Test
    @DisplayName("Case 11b: GeneralSecurityException safely throws InvalidGoogleIdTokenException")
    void generalSecurityExceptionSafelyThrowsInvalidGoogleIdTokenException() throws Exception {
        when(mockVerifier.verify(SAMPLE_RAW_TOKEN)).thenThrow(new GeneralSecurityException("Crypto failure"));

        assertThatThrownBy(() -> service.verify(SAMPLE_RAW_TOKEN))
                .isInstanceOf(InvalidGoogleIdTokenException.class)
                .hasMessage("Failed to verify Google ID Token signature");
    }

    @Test
    @DisplayName("isEnabled returns true only when enabled and client-id is present")
    void isEnabledChecksBothFlagAndClientId() {
        assertThat(service.isEnabled()).isTrue();

        properties.setEnabled(false);
        assertThat(service.isEnabled()).isFalse();

        properties.setEnabled(true);
        properties.setClientId("   ");
        assertThat(service.isEnabled()).isFalse();
    }
}
