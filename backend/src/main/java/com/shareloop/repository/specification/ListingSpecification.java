package com.shareloop.repository.specification;

import com.shareloop.entity.Listing;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class ListingSpecification {

    private static final char ESCAPE_CHAR = '\\';

    public static Specification<Listing> filterPublicListings(
            String keyword,
            ListingType type,
            UUID categoryId,
            String city,
            ListingStatus status
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Public visibility: only ACTIVE listings are publicly visible
            ListingStatus activeStatus = status != null ? status : ListingStatus.ACTIVE;
            predicates.add(cb.equal(root.get("status"), activeStatus));

            // Optional keyword search in title or description with pattern escaping
            if (StringUtils.hasText(keyword)) {
                String escaped = escapeLikeWildcards(keyword.trim().toLowerCase(Locale.ROOT));
                String searchPattern = "%" + escaped + "%";
                Predicate titleMatch = cb.like(cb.lower(root.get("title")), searchPattern, ESCAPE_CHAR);
                Predicate descMatch = cb.like(cb.lower(root.get("description")), searchPattern, ESCAPE_CHAR);
                predicates.add(cb.or(titleMatch, descMatch));
            }

            // Optional listing type filter
            if (type != null) {
                predicates.add(cb.equal(root.get("listingType"), type));
            }

            // Optional category filter
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            // Optional city filter
            if (StringUtils.hasText(city)) {
                predicates.add(cb.equal(cb.lower(root.get("city")), city.trim().toLowerCase(Locale.ROOT)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
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
