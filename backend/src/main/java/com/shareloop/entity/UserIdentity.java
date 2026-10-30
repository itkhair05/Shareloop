package com.shareloop.entity;

import com.shareloop.entity.enums.IdentityProvider;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "user_identities",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_user_identities_provider_subject", columnNames = {"provider", "provider_subject"}),
                @UniqueConstraint(name = "uq_user_identities_user_provider", columnNames = {"user_id", "provider"})
        }
)
public class UserIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_identities_user"))
    private User user;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 20, nullable = false)
    private IdentityProvider provider;

    @NotBlank
    @Size(max = 255)
    @Column(name = "provider_subject", length = 255, nullable = false)
    private String providerSubject;

    @NotBlank
    @Size(max = 255)
    @Column(name = "provider_email", length = 255, nullable = false)
    private String providerEmail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public UserIdentity() {
    }

    public UserIdentity(User user, IdentityProvider provider, String providerSubject, String providerEmail) {
        this.user = user;
        this.provider = provider;
        this.providerSubject = providerSubject != null ? providerSubject.trim() : null;
        this.providerEmail = providerEmail != null ? providerEmail.trim().toLowerCase(java.util.Locale.ROOT) : null;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public IdentityProvider getProvider() {
        return provider;
    }

    public void setProvider(IdentityProvider provider) {
        this.provider = provider;
    }

    public String getProviderSubject() {
        return providerSubject;
    }

    public void setProviderSubject(String providerSubject) {
        this.providerSubject = providerSubject != null ? providerSubject.trim() : null;
    }

    public String getProviderEmail() {
        return providerEmail;
    }

    public void setProviderEmail(String providerEmail) {
        this.providerEmail = providerEmail != null ? providerEmail.trim().toLowerCase(java.util.Locale.ROOT) : null;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserIdentity that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
