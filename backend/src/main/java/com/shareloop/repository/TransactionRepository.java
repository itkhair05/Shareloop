package com.shareloop.repository;

import com.shareloop.entity.Transaction;
import com.shareloop.entity.enums.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Optional<Transaction> findByListingRequestId(UUID listingRequestId);

    List<Transaction> findByListingId(UUID listingId);

    boolean existsByListingId(UUID listingId);

    List<Transaction> findByOwnerIdOrRequesterId(UUID ownerId, UUID requesterId);

    Optional<Transaction> findByListingIdAndStatusIn(UUID listingId, Collection<TransactionStatus> statuses);
}
