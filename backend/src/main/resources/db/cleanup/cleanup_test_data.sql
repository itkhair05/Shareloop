-- ==============================================================================
-- ShareLoop Database Cleanup Script (Test Data Removal)
-- ==============================================================================
-- Purpose: Remove all orphaned test and mock records created by integration tests
-- while preserving authentic application data (real users, seeder data, official categories).
-- Safe execution order respecting all foreign key constraints.
-- ==============================================================================

BEGIN;

-- 1. Xóa thông báo gửi tới các user test
DELETE FROM notifications 
WHERE recipient_id IN (
    SELECT id FROM users 
    WHERE email ILIKE '%.sup.%' 
       OR ((email ILIKE '%test%' OR email ILIKE '%example%' OR email ILIKE '%demo%')
           AND email NOT IN ('admin@example.com', 'demo.community@shareloop.local', 'duongthekhai.work@gmail.com', 'duongthekhai.dev@gmail.com'))
);

-- 2. Xóa các yêu cầu hỗ trợ của user test
DELETE FROM support_requests 
WHERE requester_id IN (
    SELECT id FROM users 
    WHERE email ILIKE '%.sup.%' 
       OR ((email ILIKE '%test%' OR email ILIKE '%example%' OR email ILIKE '%demo%')
           AND email NOT IN ('admin@example.com', 'demo.community@shareloop.local', 'duongthekhai.work@gmail.com', 'duongthekhai.dev@gmail.com'))
);

-- 3. Xóa các đánh giá liên quan đến transaction test (nếu có)
DELETE FROM reviews 
WHERE transaction_id IN (
    SELECT id FROM transactions 
    WHERE listing_id IN (
        SELECT id FROM listings 
        WHERE title ILIKE '%test%' 
           OR category_id IN (SELECT id FROM categories WHERE name LIKE 'Cat-%')
    )
    OR owner_id IN (SELECT id FROM users WHERE email ILIKE '%.sup.%')
    OR requester_id IN (SELECT id FROM users WHERE email ILIKE '%.sup.%')
);

-- 4. Xóa các giao dịch phát sinh từ bài đăng test hoặc user test
DELETE FROM transactions 
WHERE listing_id IN (
    SELECT id FROM listings 
    WHERE title ILIKE '%test%' 
       OR category_id IN (SELECT id FROM categories WHERE name LIKE 'Cat-%')
)
OR owner_id IN (SELECT id FROM users WHERE email ILIKE '%.sup.%') 
OR requester_id IN (SELECT id FROM users WHERE email ILIKE '%.sup.%');

-- 5. Xóa các yêu cầu nhận đồ phát sinh từ bài đăng test hoặc user test
DELETE FROM listing_requests 
WHERE listing_id IN (
    SELECT id FROM listings 
    WHERE title ILIKE '%test%' 
       OR category_id IN (SELECT id FROM categories WHERE name LIKE 'Cat-%')
)
OR requester_id IN (SELECT id FROM users WHERE email ILIKE '%.sup.%');

-- 6. Xóa hình ảnh của các bài đăng test (nếu có)
DELETE FROM listing_images 
WHERE listing_id IN (
    SELECT id FROM listings 
    WHERE title ILIKE '%test%' 
       OR category_id IN (SELECT id FROM categories WHERE name LIKE 'Cat-%')
);

-- 7. Xóa các bài đăng test
DELETE FROM listings 
WHERE title ILIKE '%test%' 
   OR category_id IN (SELECT id FROM categories WHERE name LIKE 'Cat-%')
   OR owner_id IN (SELECT id FROM users WHERE email ILIKE '%.sup.%');

-- 8. Xóa các danh mục rác (bắt đầu bằng 'Cat-' hoặc không nằm trong danh sách danh mục chính thức)
DELETE FROM categories 
WHERE name LIKE 'Cat-%' 
   OR name NOT IN (
       'Cá Cảnh', 
       'Dụng cụ & Đồ sửa chữa', 
       'Khác', 
       'Mẹ & Bé', 
       'Nhà cửa & Nội thất', 
       'Quần áo & Phụ kiện', 
       'Sách & Văn hóa phẩm', 
       'Thể thao & Ngoài trời', 
       'Thực phẩm & Đồ khô', 
       'Điện tử & Đồ gia dụng'
   );

-- 9. Xóa các tài khoản người dùng test
DELETE FROM users 
WHERE email ILIKE '%.sup.%' 
   OR ((email ILIKE '%test%' OR email ILIKE '%example%' OR email ILIKE '%demo%')
       AND email NOT IN ('admin@example.com', 'demo.community@shareloop.local', 'duongthekhai.work@gmail.com', 'duongthekhai.dev@gmail.com'));

COMMIT;
