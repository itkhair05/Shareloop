package com.shareloop.service;

import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.UploadedFileBinding;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.DeletionState;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.exception.ConcurrentBindingException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.UploadedFileBindingRepository;
import com.shareloop.repository.UploadedFileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Infrastructure service providing atomic, globally exclusive file binding.
 *
 * <p>It enforces only infrastructure-level guarantees:</p>
 * <ol>
 *   <li>Existence of the uploaded file.</li>
 *   <li>Pessimistic row lock on uploaded_files to serialize concurrent binding attempts.</li>
 *   <li>File ownership: the caller must own the uploaded file.</li>
 *   <li>Purpose matching: the file purpose must match the expected domain purpose.</li>
 *   <li>Deletion state: files pending physical deletion cannot be bound.</li>
 *   <li>Global exclusivity: the file must not already be bound to any domain record.</li>
 * </ol>
 *
 * <p><b>This service does NOT verify domain authorization.</b> It cannot check that
 * the target domain entity exists, that the caller may modify that entity, or that
 * the entity is in a state that permits attachment changes. Those checks belong to
 * the domain service, which must execute the mandatory contract below inside the
 * same transaction that calls {@link #bindFile} or {@link #bindFiles}:</p>
 * <ol>
 *   <li>Authenticate the caller.</li>
 *   <li>Load the target domain entity.</li>
 *   <li>Verify the entity exists.</li>
 *   <li>Verify the caller has permission to modify or create attachments for that entity.</li>
 *   <li>Verify the entity is in a state that permits attachment changes.</li>
 *   <li>Validate the submitted image count.</li>
 *   <li>Verify file ownership and purpose.</li>
 *   <li>Verify all file IDs are unique.</li>
 *   <li>Bind all files through this service.</li>
 *   <li>Create the domain attachment records.</li>
 *   <li>Commit all database changes atomically.</li>
 * </ol>
 *
 * <p><b>Lifecycle:</b> this phase deliberately exposes no generic unbind operation.
 * Evidence bindings must never be released by an arbitrary caller, and Chat bindings
 * are owned by the legacy {@code bound_message_id} synchronization. Future domain
 * phases must add explicit, domain-authorized release operations instead of calling a
 * generic delete.</p>
 */
@Service
public class FileBindingService {

    private static final Logger log = LoggerFactory.getLogger(FileBindingService.class);

    private final UploadedFileRepository uploadedFileRepository;
    private final UploadedFileBindingRepository uploadedFileBindingRepository;

    public FileBindingService(
            UploadedFileRepository uploadedFileRepository,
            UploadedFileBindingRepository uploadedFileBindingRepository
    ) {
        this.uploadedFileRepository = uploadedFileRepository;
        this.uploadedFileBindingRepository = uploadedFileBindingRepository;
    }

    /**
     * Atomically validates and binds an uploaded file to a domain record.
     *
     * <p>The caller (a domain service) is responsible for the authorization and
     * entity-existence contract documented on this class. This method only validates
     * file-level invariants.</p>
     *
     * @param fileId UUID of the uploaded file
     * @param expectedPurpose Expected upload purpose (e.g. REVIEW, REPORT, SUPPORT)
     * @param boundDomain Domain name (e.g. "REVIEW", "REPORT", "SUPPORT")
     * @param boundEntityId UUID of the parent domain record
     * @param caller User attempting to attach the file
     * @return The persisted UploadedFileBinding
     */
    @Transactional
    public UploadedFileBinding bindFile(
            UUID fileId,
            UploadPurpose expectedPurpose,
            String boundDomain,
            UUID boundEntityId,
            User caller
    ) {
        if (fileId == null) {
            throw new IllegalArgumentException("File ID cannot be null");
        }
        if (expectedPurpose == null) {
            throw new IllegalArgumentException("Expected purpose cannot be null");
        }
        if (boundDomain == null || boundDomain.isBlank()) {
            throw new IllegalArgumentException("Bound domain cannot be blank");
        }
        if (boundEntityId == null) {
            throw new IllegalArgumentException("Bound entity ID cannot be null");
        }
        if (caller == null || caller.getId() == null) {
            throw new AccessDeniedException("Authenticated caller is required to bind files");
        }

        UploadedFile file = lockFile(fileId);

        // Ownership check: caller must be the owner of the uploaded file
        if (!file.getOwner().getId().equals(caller.getId())) {
            throw new AccessDeniedException("You are not authorized to attach this file: not owner");
        }

        // Purpose check: file purpose must match the expected domain purpose
        if (file.getPurpose() != expectedPurpose) {
            throw new IllegalArgumentException("Uploaded file purpose " + file.getPurpose()
                    + " does not match required purpose " + expectedPurpose);
        }

        // Files pending physical deletion are unavailable for new bindings
        if (file.getDeletionState() != DeletionState.ACTIVE) {
            throw new IllegalStateException("Uploaded file " + fileId + " is pending deletion and cannot be bound");
        }

        // Global exclusivity check: file must not already be bound
        if (file.isBound() || uploadedFileBindingRepository.existsById(fileId)) {
            throw new IllegalStateException("Uploaded file " + fileId + " is already bound to a domain record");
        }

        UploadedFileBinding binding = new UploadedFileBinding(file, boundDomain, boundEntityId, caller);
        UploadedFileBinding saved = uploadedFileBindingRepository.saveAndFlush(binding);
        file.setBinding(saved);

        log.debug("Globally bound file {} to domain {} entity {} by user {}",
                fileId, boundDomain, boundEntityId, caller.getId());

        return saved;
    }

    /**
     * Atomically validates and binds multiple uploaded files to a domain record.
     *
     * <p>Locks are always acquired in deterministic UUID order regardless of the
     * caller's list order, preventing deadlocks between concurrent requests that
     * submit the same files in different orders. The returned list preserves the
     * caller's requested attachment order.</p>
     */
    @Transactional
    public List<UploadedFileBinding> bindFiles(
            List<UUID> fileIds,
            UploadPurpose expectedPurpose,
            String boundDomain,
            UUID boundEntityId,
            User caller
    ) {
        if (fileIds == null || fileIds.isEmpty()) {
            return Collections.emptyList();
        }

        // Validate no duplicate or null file IDs within the submitted list
        Set<UUID> seen = new HashSet<>();
        for (UUID id : fileIds) {
            if (id == null) {
                throw new IllegalArgumentException("File ID list cannot contain null entries");
            }
            if (!seen.add(id)) {
                throw new IllegalArgumentException("Duplicate file ID in attachment list: " + id);
            }
        }

        List<UUID> lockOrder = new ArrayList<>(fileIds);
        lockOrder.sort(Comparator.naturalOrder());

        Map<UUID, UploadedFileBinding> bindingsById = new LinkedHashMap<>();
        for (UUID fileId : lockOrder) {
            bindingsById.put(fileId,
                    bindFile(fileId, expectedPurpose, boundDomain, boundEntityId, caller));
        }

        List<UploadedFileBinding> bindings = new ArrayList<>(fileIds.size());
        for (UUID fileId : fileIds) {
            bindings.add(bindingsById.get(fileId));
        }
        return bindings;
    }

    /**
     * Returns all bindings for a domain record, oldest first.
     * Read-only lifecycle inspection; it does not authorize the caller.
     */
    @Transactional(readOnly = true)
    public List<UploadedFileBinding> findBindingsByDomainAndEntity(String boundDomain, UUID boundEntityId) {
        if (boundDomain == null || boundDomain.isBlank()) {
            throw new IllegalArgumentException("Bound domain cannot be blank");
        }
        if (boundEntityId == null) {
            throw new IllegalArgumentException("Bound entity ID cannot be null");
        }
        return uploadedFileBindingRepository
                .findByBoundDomainAndBoundEntityIdOrderByCreatedAtAsc(boundDomain, boundEntityId);
    }

    /**
     * Validates that a file is bound to the expected domain record.
     * Read-only; it does not authorize the caller and never removes evidence.
     */
    @Transactional(readOnly = true)
    public UploadedFileBinding requireBinding(UUID fileId, String boundDomain, UUID boundEntityId) {
        if (fileId == null) {
            throw new IllegalArgumentException("File ID cannot be null");
        }
        if (boundDomain == null || boundDomain.isBlank()) {
            throw new IllegalArgumentException("Bound domain cannot be blank");
        }
        if (boundEntityId == null) {
            throw new IllegalArgumentException("Bound entity ID cannot be null");
        }

        return uploadedFileBindingRepository.findByFileId(fileId)
                .filter(binding -> boundDomain.equals(binding.getBoundDomain())
                        && boundEntityId.equals(binding.getBoundEntityId()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No binding found for uploaded file " + fileId + " in domain " + boundDomain));
    }

    private UploadedFile lockFile(UUID fileId) {
        try {
            return uploadedFileRepository.findByIdForUpdate(fileId)
                    .orElseThrow(() -> new ResourceNotFoundException("Uploaded file not found with id: " + fileId));
        } catch (PessimisticLockingFailureException ex) {
            log.warn("Lock conflict while binding uploaded file {}: {}", fileId, ex.getMessage());
            throw new ConcurrentBindingException(
                    "Không thể gắn tệp do xung đột đồng thời. Vui lòng thử lại.", ex);
        }
    }
}
