package com.shareloop.repository.specification;

import com.shareloop.entity.Review;
import com.shareloop.entity.User;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class ReviewSpecification {

    private static final char ESCAPE_CHAR = '\\';

    public static Specification<Review> filterAdminReviews(
            Boolean isHidden,
            Integer rating,
            String search
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Visibility filter (optional)
            if (isHidden != null) {
                predicates.add(cb.equal(root.get("isHidden"), isHidden));
            }

            // Rating filter (optional)
            if (rating != null) {
                predicates.add(cb.equal(root.get("rating"), rating));
            }

            // Keyword search across comment, reviewer name/email, reviewee name/email
            if (StringUtils.hasText(search)) {
                String escaped = escapeLikeWildcards(search.trim().toLowerCase(Locale.ROOT));
                String searchPattern = "%" + escaped + "%";

                Join<Review, User> reviewerJoin = root.join("reviewer", JoinType.LEFT);
                Join<Review, User> revieweeJoin = root.join("reviewee", JoinType.LEFT);

                Predicate commentMatch = cb.like(cb.lower(root.get("comment")), searchPattern, ESCAPE_CHAR);
                Predicate reviewerNameMatch = cb.like(cb.lower(reviewerJoin.get("displayName")), searchPattern, ESCAPE_CHAR);
                Predicate reviewerEmailMatch = cb.like(cb.lower(reviewerJoin.get("email")), searchPattern, ESCAPE_CHAR);
                Predicate revieweeNameMatch = cb.like(cb.lower(revieweeJoin.get("displayName")), searchPattern, ESCAPE_CHAR);
                Predicate revieweeEmailMatch = cb.like(cb.lower(revieweeJoin.get("email")), searchPattern, ESCAPE_CHAR);

                predicates.add(cb.or(
                        commentMatch,
                        reviewerNameMatch,
                        reviewerEmailMatch,
                        revieweeNameMatch,
                        revieweeEmailMatch
                ));
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
