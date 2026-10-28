package com.shareloop.service;

import com.shareloop.dto.user.AdminUserResponse;
import com.shareloop.dto.user.UpdateUserRoleAdminRequest;
import com.shareloop.dto.user.UpdateUserStatusAdminRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.UserRepository;
import com.shareloop.repository.specification.UserSpecification;
import com.shareloop.security.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminUserService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "createdat",
            "displayname",
            "email",
            "role",
            "status"
    );

    private final UserRepository userRepository;

    public AdminUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> getAdminUsers(
            String search,
            UserRole role,
            UserStatus status,
            int page,
            int size,
            String sortBy,
            String sortDirection,
            UserPrincipal principal
    ) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Yêu cầu quyền quản trị viên để xem danh sách người dùng");
        }

        validatePagination(page, size);

        String property = resolveSortProperty(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(direction, property).and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<User> spec = UserSpecification.filterAdminUsers(search, role, status);
        Page<User> users = userRepository.findAll(spec, pageable);

        return users.map(AdminUserResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getAdminUserDetails(UUID userId, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Yêu cầu quyền quản trị viên để xem chi tiết người dùng");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        return AdminUserResponse.fromEntity(user);
    }

    @Transactional
    public AdminUserResponse updateUserStatus(UUID userId, UpdateUserStatusAdminRequest request, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Yêu cầu quyền quản trị viên để thay đổi trạng thái người dùng");
        }

        if (request == null || request.getStatus() == null) {
            throw new IllegalArgumentException("Trạng thái người dùng không được để trống");
        }

        if (principal.getId().equals(userId) && request.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("Quản trị viên không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (targetUser.getStatus() == request.getStatus()) {
            return AdminUserResponse.fromEntity(targetUser);
        }

        if (targetUser.getStatus() == UserStatus.DEACTIVATED) {
            throw new IllegalArgumentException("Tài khoản đã bị vô hiệu hóa và không thể thay đổi trạng thái");
        }

        // If suspending or deactivating an ADMIN, protect the last-admin invariant under pessimistic lock
        if (targetUser.getRole() == UserRole.ADMIN && request.getStatus() != UserStatus.ACTIVE) {
            List<User> admins = userRepository.findAdminsForUpdate(UserRole.ADMIN);
            User lockedTarget = admins.stream()
                    .filter(u -> u.getId().equals(userId))
                    .findFirst()
                    .orElse(targetUser);

            long activeAdminCount = admins.stream()
                    .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                    .count();
            if (lockedTarget.getStatus() == UserStatus.ACTIVE && activeAdminCount <= 1) {
                throw new IllegalArgumentException("Không thể khóa hoặc vô hiệu hóa quản trị viên cuối cùng của hệ thống");
            }
            targetUser = lockedTarget;
        }

        targetUser.setStatus(request.getStatus());
        User savedUser = userRepository.save(targetUser);
        return AdminUserResponse.fromEntity(savedUser);
    }

    @Transactional
    public AdminUserResponse updateUserRole(UUID userId, UpdateUserRoleAdminRequest request, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Yêu cầu quyền quản trị viên để thay đổi vai trò người dùng");
        }

        if (request == null || request.getRole() == null) {
            throw new IllegalArgumentException("Vai trò người dùng không được để trống");
        }

        if (principal.getId().equals(userId) && request.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Quản trị viên không thể tự hạ quyền quản trị của chính mình");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (targetUser.getRole() == request.getRole()) {
            return AdminUserResponse.fromEntity(targetUser);
        }

        // If demoting an ADMIN to USER, protect the last-admin invariant under pessimistic lock
        if (targetUser.getRole() == UserRole.ADMIN && request.getRole() == UserRole.USER) {
            List<User> admins = userRepository.findAdminsForUpdate(UserRole.ADMIN);
            if (admins.size() <= 1) {
                throw new IllegalArgumentException("Không thể hạ quyền quản trị viên cuối cùng của hệ thống");
            }

            User lockedTarget = admins.stream()
                    .filter(u -> u.getId().equals(userId))
                    .findFirst()
                    .orElse(targetUser);

            long activeAdminCount = admins.stream()
                    .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                    .count();
            if (lockedTarget.getStatus() == UserStatus.ACTIVE && activeAdminCount <= 1) {
                throw new IllegalArgumentException("Không thể hạ quyền quản trị viên cuối cùng của hệ thống");
            }
            targetUser = lockedTarget;
        }

        targetUser.setRole(request.getRole());
        User savedUser = userRepository.save(targetUser);
        return AdminUserResponse.fromEntity(savedUser);
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("Page size must be between 1 and 100");
        }
    }

    private String resolveSortProperty(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "createdAt";
        }
        String normalized = sortBy.trim().toLowerCase(java.util.Locale.ROOT);
        if (!ALLOWED_SORT_FIELDS.contains(normalized)) {
            throw new IllegalArgumentException("Trường sắp xếp không hợp lệ: " + sortBy);
        }
        return switch (normalized) {
            case "displayname" -> "displayName";
            case "email" -> "email";
            case "role" -> "role";
            case "status" -> "status";
            default -> "createdAt";
        };
    }
}
