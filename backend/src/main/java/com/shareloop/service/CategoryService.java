package com.shareloop.service;

import com.shareloop.dto.category.*;
import com.shareloop.entity.Category;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.exception.DuplicateSlugException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class CategoryService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    private final CategoryRepository categoryRepository;
    private final ListingRepository listingRepository;

    public CategoryService(CategoryRepository categoryRepository, ListingRepository listingRepository) {
        this.categoryRepository = categoryRepository;
        this.listingRepository = listingRepository;
    }

    /**
     * Retrieve all active categories ordered deterministically by name ascending.
     * Public endpoint helper.
     */
    @Transactional(readOnly = true)
    public List<CategoryResponse> getActiveCategories() {
        return categoryRepository.findByIsActiveTrueOrderByNameAsc().stream()
                .map(CategoryResponse::fromEntity)
                .toList();
    }

    /**
     * Retrieve single category detail by slug, including the count of active listings.
     * Only active categories are discoverable publicly.
     */
    @Transactional(readOnly = true)
    public CategoryDetailResponse getCategoryBySlug(String slug) {
        if (slug == null || slug.isBlank()) {
            throw new ResourceNotFoundException("Category not found with slug: " + slug);
        }

        String normalizedSlug = normalizeSlug(slug);

        Category category = categoryRepository.findBySlug(normalizedSlug)
                .filter(Category::getIsActive)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found with slug: " + normalizedSlug));

        long activeListingCount = listingRepository.countByCategoryIdAndStatus(category.getId(), ListingStatus.ACTIVE);

        return CategoryDetailResponse.fromEntity(category, activeListingCount);
    }

    /**
     * Admin: Create a new category.
     */
    @Transactional
    public CategoryResponse createCategory(CreateCategoryRequest request) {
        String name = request.getName() != null ? request.getName().trim() : "";
        String normalizedSlug = normalizeSlug(request.getSlug());
        validateSlugFormat(normalizedSlug);

        if (categoryRepository.existsBySlug(normalizedSlug)) {
            throw new DuplicateSlugException("Category slug '" + normalizedSlug + "' already exists");
        }

        String description = request.getDescription() != null ? request.getDescription().trim() : null;
        Boolean isActive = request.getIsActive() != null ? request.getIsActive() : true;

        Category category = new Category(name, normalizedSlug, description, isActive);
        Category saved = categoryRepository.save(category);

        return CategoryResponse.fromEntity(saved);
    }

    /**
     * Admin: Update an existing category by ID.
     */
    @Transactional
    public CategoryResponse updateCategory(UUID id, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + id));

        String name = request.getName() != null ? request.getName().trim() : "";
        String normalizedSlug = normalizeSlug(request.getSlug());
        validateSlugFormat(normalizedSlug);

        if (!normalizedSlug.equals(category.getSlug()) && categoryRepository.existsBySlug(normalizedSlug)) {
            throw new DuplicateSlugException("Category slug '" + normalizedSlug + "' already exists");
        }

        category.setName(name);
        category.setSlug(normalizedSlug);
        if (request.getDescription() != null) {
            category.setDescription(request.getDescription().trim());
        }
        if (request.getIsActive() != null) {
            category.setIsActive(request.getIsActive());
        }

        Category updated = categoryRepository.save(category);
        return CategoryResponse.fromEntity(updated);
    }

    /**
     * Admin: Activate or deactivate an existing category.
     * Note: Existing listings reference remains intact; deactivation prevents future listings from selecting it.
     */
    @Transactional
    public CategoryResponse updateCategoryStatus(UUID id, UpdateCategoryStatusRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + id));

        category.setIsActive(request.getIsActive());
        Category updated = categoryRepository.save(category);

        return CategoryResponse.fromEntity(updated);
    }

    private String normalizeSlug(String slug) {
        return slug != null ? slug.trim().toLowerCase(Locale.ROOT) : "";
    }

    private void validateSlugFormat(String slug) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new IllegalArgumentException("Slug must be lowercase alphanumeric with hyphens (e.g. tools-diy)");
        }
    }
}
