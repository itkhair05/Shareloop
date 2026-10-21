package com.shareloop.repository;

import com.shareloop.entity.Conversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    @EntityGraph(attributePaths = {"listing", "owner", "requester"})
    Optional<Conversation> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"listing", "owner", "requester"})
    Optional<Conversation> findByListingIdAndRequesterId(UUID listingId, UUID requesterId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Conversation c WHERE c.id = :id")
    Optional<Conversation> findByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"listing", "owner", "requester"})
    @Query("SELECT c FROM Conversation c WHERE c.owner.id = :userId OR c.requester.id = :userId")
    Page<Conversation> findByUserId(@Param("userId") UUID userId, Pageable pageable);
}
