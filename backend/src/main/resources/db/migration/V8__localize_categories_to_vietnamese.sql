-- ==============================================================================
-- ShareLoop Localize Categories to Vietnamese (Flyway Migration V8)
-- ==============================================================================
-- Updates default community categories to natural Vietnamese display names and descriptions,
-- preserving original UUIDs, slugs, active statuses, and referential integrity.
-- ==============================================================================

UPDATE categories
SET name = 'Dụng cụ & Đồ sửa chữa',
    description = 'Dụng cụ cầm tay, máy móc sửa chữa, làm vườn và vật phẩm DIY gia đình',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'tools-diy';

UPDATE categories
SET name = 'Điện tử & Đồ gia dụng',
    description = 'Thiết bị gia dụng, máy tính, thiết bị nghe nhìn và công nghệ số',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'electronics-appliances';

UPDATE categories
SET name = 'Sách & Văn hóa phẩm',
    description = 'Sách, giáo trình, tạp chí, board game, băng đĩa và văn hóa phẩm',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'books-media';

UPDATE categories
SET name = 'Nhà cửa & Nội thất',
    description = 'Bàn ghế, đồ trang trí nhà cửa, chiếu sáng và đồ gia dụng phòng bếp',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'home-furniture';

UPDATE categories
SET name = 'Quần áo & Phụ kiện',
    description = 'Quần áo nam nữ, giày dép, túi xách và phụ kiện cá nhân',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'clothing-accessories';

UPDATE categories
SET name = 'Mẹ & Bé',
    description = 'Đồ dùng cho bé, xe đẩy, đồ chơi trẻ em, quần áo và đồ dùng mẹ bầu',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'baby-kids';

UPDATE categories
SET name = 'Thể thao & Ngoài trời',
    description = 'Dụng cụ tập luyện, xe đạp, thiết bị cắm trại và đồ dã ngoại',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'sports-outdoors';

UPDATE categories
SET name = 'Thực phẩm & Đồ khô',
    description = 'Nông sản sạch, thực phẩm khô đóng gói và nguyên liệu nhà bếp',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'food-pantry';

UPDATE categories
SET name = 'Khác',
    description = 'Các đồ dùng, vật phẩm hữu ích khác được chia sẻ trong cộng đồng',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'other';
