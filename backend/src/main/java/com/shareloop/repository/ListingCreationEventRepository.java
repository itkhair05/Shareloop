package com.shareloop.repository;

import com.shareloop.entity.ListingCreationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface ListingCreationEventRepository extends JpaRepository<ListingCreationEvent, UUID> {

    @Query("SELECT COUNT(e) FROM ListingCreationEvent e WHERE e.user.id = :userId AND e.createdAt >= :since")
    long countByUserIdAndCreatedAtAfter(@Param("userId") UUID userId, @Param("since") Instant since);
}
