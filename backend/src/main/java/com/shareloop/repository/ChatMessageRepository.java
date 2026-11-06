package com.shareloop.repository;

import com.shareloop.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    @EntityGraph(attributePaths = {"sender"})
    Page<ChatMessage> findByConversationId(UUID conversationId, Pageable pageable);

    Optional<ChatMessage> findFirstByConversationIdOrderByCreatedAtDescIdDesc(UUID conversationId);

    @Query("SELECT m FROM ChatMessage m WHERE m.id IN (" +
           "  SELECT m2.id FROM ChatMessage m2 WHERE m2.conversation.id IN :conversationIds AND m2.createdAt = (" +
           "    SELECT MAX(m3.createdAt) FROM ChatMessage m3 WHERE m3.conversation.id = m2.conversation.id" +
           "  )" +
           ")")
    List<ChatMessage> findLatestMessagesForConversations(@Param("conversationIds") List<UUID> conversationIds);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.sender.id = :senderId AND m.createdAt >= :since")
    long countBySenderIdAndCreatedAtAfter(@Param("senderId") UUID senderId, @Param("since") java.time.Instant since);

    long countByConversationId(UUID conversationId);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM ChatMessage m WHERE m.conversation.id IN :conversationIds")
    int deleteByConversationIds(@Param("conversationIds") java.util.Collection<UUID> conversationIds);
}
