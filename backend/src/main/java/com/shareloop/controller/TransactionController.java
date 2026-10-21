package com.shareloop.controller;

import com.shareloop.dto.transaction.CancelTransactionRequest;
import com.shareloop.dto.transaction.TransactionResponse;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.TransactionService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Transactions", description = "Escrow/handoff dual confirmation lifecycle and status management")
@SecurityRequirement(name = "bearerAuth")
@RestController
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    /**
     * List transactions for the authenticated user with optional status and role filtering.
     */
    @GetMapping("/api/v1/transactions")
    public ResponseEntity<Page<TransactionResponse>> getUserTransactions(
            @RequestParam(required = false) TransactionStatus status,
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<TransactionResponse> response = transactionService.getUserTransactions(status, role, page, size, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Get transaction details by ID.
     */
    @GetMapping("/api/v1/transactions/{id}")
    public ResponseEntity<TransactionResponse> getTransactionDetails(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TransactionResponse response = transactionService.getTransactionDetails(id, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Get active or latest transaction for a listing.
     */
    @GetMapping("/api/v1/listings/{listingId}/transaction")
    public ResponseEntity<TransactionResponse> getListingTransaction(
            @PathVariable UUID listingId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TransactionResponse response = transactionService.getListingTransaction(listingId, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Confirm transaction completion.
     */
    @PostMapping("/api/v1/transactions/{id}/complete")
    public ResponseEntity<TransactionResponse> completeTransaction(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TransactionResponse response = transactionService.completeTransaction(id, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Cancel an ongoing transaction.
     */
    @PostMapping("/api/v1/transactions/{id}/cancel")
    public ResponseEntity<TransactionResponse> cancelTransaction(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) CancelTransactionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TransactionResponse response = transactionService.cancelTransaction(id, request, principal);
        return ResponseEntity.ok(response);
    }
}
