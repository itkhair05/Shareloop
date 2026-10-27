package com.shareloop.controller;

import com.shareloop.dto.category.*;
import com.shareloop.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Categories", description = "Item category catalog and hierarchical lookup")
@RestController
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    /**
     * Public: Retrieve all active categories ordered alphabetically.
     */
    @GetMapping("/api/v1/categories")
    public ResponseEntity<List<CategoryResponse>> getActiveCategories() {
        List<CategoryResponse> categories = categoryService.getActiveCategories();
        return ResponseEntity.ok(categories);
    }

    /**
     * Public: Retrieve active category details by slug, including active listing count.
     */
    @GetMapping("/api/v1/categories/{slug}")
    public ResponseEntity<CategoryDetailResponse> getCategoryBySlug(@PathVariable String slug) {
        CategoryDetailResponse category = categoryService.getCategoryBySlug(slug);
        return ResponseEntity.ok(category);
    }

    /**
     * Admin: Retrieve all categories (both active and inactive) ordered alphabetically with active listing counts.
     */
    @Operation(summary = "Retrieve all categories including inactive categories (Admin only)")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/api/v1/admin/categories")
    public ResponseEntity<List<CategoryDetailResponse>> getAllCategoriesForAdmin() {
        List<CategoryDetailResponse> categories = categoryService.getAllCategoriesForAdmin();
        return ResponseEntity.ok(categories);
    }

    /**
     * Admin: Create a new category.
     */
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/api/v1/admin/categories")
    public ResponseEntity<CategoryResponse> createCategory(@Valid @RequestBody CreateCategoryRequest request) {
        CategoryResponse response = categoryService.createCategory(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Admin: Update category details by ID.
     */
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/api/v1/admin/categories/{id}")
    public ResponseEntity<CategoryResponse> updateCategory(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCategoryRequest request
    ) {
        CategoryResponse response = categoryService.updateCategory(id, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Activate or deactivate a category.
     */
    @SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/api/v1/admin/categories/{id}/status")
    public ResponseEntity<CategoryResponse> updateCategoryStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCategoryStatusRequest request
    ) {
        CategoryResponse response = categoryService.updateCategoryStatus(id, request);
        return ResponseEntity.ok(response);
    }
}
