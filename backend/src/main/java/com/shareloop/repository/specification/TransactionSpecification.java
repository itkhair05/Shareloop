package com.shareloop.repository.specification;

import com.shareloop.entity.Listing;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.TransactionStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class TransactionSpecification {

    private static final char ESCAPE_CHAR = '\\';

    public static Specification<Transaction> filterAdminTransactions(
            TransactionStatus status,
            String search
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Status filter (optional)
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            // 2. Keyword search (optional)
            if (StringUtils.hasText(search)) {
                String trimmed = search.trim();
                List<Predicate> searchPredicates = new ArrayList<>();

                // If valid UUID, match by transaction id
                UUID searchUuid = tryParseUuid(trimmed);
                if (searchUuid != null) {
                    searchPredicates.add(cb.equal(root.get("id"), searchUuid));
                }

                String escaped = escapeLikeWildcards(trimmed.toLowerCase(Locale.ROOT));
                String pattern = "%" + escaped + "%";

                Join<Transaction, Listing> listingJoin = root.join("listing", JoinType.LEFT);
                Join<Transaction, User> ownerJoin = root.join("owner", JoinType.LEFT);
                Join<Transaction, User> requesterJoin = root.join("requester", JoinType.LEFT);

                searchPredicates.add(cb.like(cb.lower(listingJoin.get("title")), pattern, ESCAPE_CHAR));
                searchPredicates.add(cb.like(cb.lower(ownerJoin.get("displayName")), pattern, ESCAPE_CHAR));
                searchPredicates.add(cb.like(cb.lower(requesterJoin.get("displayName")), pattern, ESCAPE_CHAR));

                predicates.add(cb.or(searchPredicates.toArray(new Predicate[0])));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static UUID tryParseUuid(String value) {
        if (value == null) {
            return null;
        }
        String s = value.trim();
        if (s.length() != 36) {
            return null;
        }
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
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
