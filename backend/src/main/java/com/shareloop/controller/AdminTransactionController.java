package com.shareloop.controller;

import com.shareloop.dto.transaction.AdminTransactionResponse;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.TransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin Transactions", description = "Administrative overview, filtering, and search of platform transactions")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/transactions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminTransactionController {

    private final TransactionService transactionService;

    public AdminTransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @Operation(summary = "List all platform transactions with optional status filter, keyword search, and pagination (Admin only)")
    @GetMapping
    public ResponseEntity<Page<AdminTransactionResponse>> getAdminTransactions(
            @RequestParam(required = false) TransactionStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<AdminTransactionResponse> response = transactionService.getAdminTransactions(
                status,
                search,
                page,
                size,
                principal
        );
        return ResponseEntity.ok(response);
    }
}
