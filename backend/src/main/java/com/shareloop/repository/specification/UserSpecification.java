package com.shareloop.repository.specification;

import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class UserSpecification {

    private static final char ESCAPE_CHAR = '\\';

    public static Specification<User> filterAdminUsers(
            String search,
            UserRole role,
            UserStatus status
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Case-insensitive substring search in displayName or email with wildcard escaping
            if (StringUtils.hasText(search)) {
                String escaped = escapeLikeWildcards(search.trim().toLowerCase(Locale.ROOT));
                String searchPattern = "%" + escaped + "%";
                Predicate displayNameMatch = cb.like(cb.lower(root.get("displayName")), searchPattern, ESCAPE_CHAR);
                Predicate emailMatch = cb.like(cb.lower(root.get("email")), searchPattern, ESCAPE_CHAR);
                predicates.add(cb.or(displayNameMatch, emailMatch));
            }

            // Optional role filter
            if (role != null) {
                predicates.add(cb.equal(root.get("role"), role));
            }

            // Optional status filter
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static String escapeLikeWildcards(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
