package com.shareloop.repository;

import com.shareloop.entity.Transaction;
import com.shareloop.entity.enums.TransactionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID>, JpaSpecificationExecutor<Transaction> {

    @Override
    @EntityGraph(attributePaths = {"listing", "owner", "requester", "listingRequest", "cancelledBy"})
    Page<Transaction> findAll(Specification<Transaction> spec, Pageable pageable);

    Optional<Transaction> findByListingRequestId(UUID listingRequestId);

    List<Transaction> findByListingId(UUID listingId);

    boolean existsByListingId(UUID listingId);

    List<Transaction> findByOwnerIdOrRequesterId(UUID ownerId, UUID requesterId);

    Optional<Transaction> findByListingIdAndStatusIn(UUID listingId, Collection<TransactionStatus> statuses);

    boolean existsByListingIdAndRequesterIdAndStatusIn(UUID listingId, UUID requesterId, Collection<TransactionStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Transaction t WHERE t.id = :id")
    Optional<Transaction> findByIdForUpdate(@Param("id") UUID id);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.listing l JOIN FETCH t.owner o JOIN FETCH t.requester r LEFT JOIN FETCH t.listingRequest lr LEFT JOIN FETCH t.cancelledBy cb WHERE t.id = :id")
    Optional<Transaction> findWithDetailsById(@Param("id") UUID id);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.listing l JOIN FETCH t.owner o JOIN FETCH t.requester r LEFT JOIN FETCH t.listingRequest lr LEFT JOIN FETCH t.cancelledBy cb WHERE l.id = :listingId AND t.status IN :statuses")
    Optional<Transaction> findActiveByListingId(@Param("listingId") UUID listingId, @Param("statuses") Collection<TransactionStatus> statuses);

    @Query(value = "SELECT t FROM Transaction t JOIN FETCH t.listing l JOIN FETCH t.owner o JOIN FETCH t.requester r LEFT JOIN FETCH t.cancelledBy cb WHERE (o.id = :userId OR r.id = :userId) AND (:status IS NULL OR t.status = :status)",
            countQuery = "SELECT count(t) FROM Transaction t WHERE (t.owner.id = :userId OR t.requester.id = :userId) AND (:status IS NULL OR t.status = :status)")
    Page<Transaction> findByUserIdAndOptionalStatus(@Param("userId") UUID userId, @Param("status") TransactionStatus status, Pageable pageable);

    @Query(value = "SELECT t FROM Transaction t JOIN FETCH t.listing l JOIN FETCH t.owner o JOIN FETCH t.requester r LEFT JOIN FETCH t.cancelledBy cb WHERE o.id = :userId AND (:status IS NULL OR t.status = :status)",
            countQuery = "SELECT count(t) FROM Transaction t WHERE t.owner.id = :userId AND (:status IS NULL OR t.status = :status)")
    Page<Transaction> findByOwnerIdAndOptionalStatus(@Param("userId") UUID userId, @Param("status") TransactionStatus status, Pageable pageable);

    @Query(value = "SELECT t FROM Transaction t JOIN FETCH t.listing l JOIN FETCH t.owner o JOIN FETCH t.requester r LEFT JOIN FETCH t.cancelledBy cb WHERE r.id = :userId AND (:status IS NULL OR t.status = :status)",
            countQuery = "SELECT count(t) FROM Transaction t WHERE t.requester.id = :userId AND (:status IS NULL OR t.status = :status)")
    Page<Transaction> findByRequesterIdAndOptionalStatus(@Param("userId") UUID userId, @Param("status") TransactionStatus status, Pageable pageable);

    long countByStatus(TransactionStatus status);
}
