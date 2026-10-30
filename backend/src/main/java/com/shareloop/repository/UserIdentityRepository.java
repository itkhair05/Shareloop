package com.shareloop.repository;

import com.shareloop.entity.User;
import com.shareloop.entity.UserIdentity;
import com.shareloop.entity.enums.IdentityProvider;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

    // Thêm @EntityGraph để fetch luôn User, tránh LazyInitializationException
    @EntityGraph(attributePaths = {"user"})
    Optional<UserIdentity> findByProviderAndProviderSubject(IdentityProvider provider, String providerSubject);

    Optional<UserIdentity> findByUserAndProvider(User user, IdentityProvider provider);

    // Thêm @EntityGraph cho phương thức này nếu cần dùng sau này (tùy chọn)
    @EntityGraph(attributePaths = {"user"})
    Optional<UserIdentity> findByUserIdAndProvider(UUID userId, IdentityProvider provider);

    boolean existsByProviderAndProviderSubject(IdentityProvider provider, String providerSubject);

    boolean existsByUserIdAndProvider(UUID userId, IdentityProvider provider);

    List<UserIdentity> findByUserId(UUID userId);
}