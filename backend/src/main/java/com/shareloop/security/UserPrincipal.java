package com.shareloop.security;

import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class UserPrincipal implements UserDetails {

    private final UUID id;
    private final String displayName;
    private final String email;
    private final String passwordHash;
    private final UserRole role;
    private final UserStatus status;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(UUID id, String displayName, String email, String passwordHash, UserRole role, UserStatus status, Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.displayName = displayName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.status = status;
        this.authorities = authorities;
    }

    public static UserPrincipal create(User user) {
        List<GrantedAuthority> authorities = Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().name())
        );

        return new UserPrincipal(
                user.getId(),
                user.getDisplayName(),
                user.getEmail(),
                user.getPasswordHash(),
                user.getRole(),
                user.getStatus(),
                authorities
        );
    }

    public UUID getId() {
        return id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEmail() {
        return email;
    }

    public UserRole getRole() {
        return role;
    }

    public UserStatus getStatus() {
        return status;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return status != UserStatus.DEACTIVATED;
    }

    @Override
    public boolean isAccountNonLocked() {
        return status != UserStatus.SUSPENDED;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status == UserStatus.ACTIVE;
    }
}
