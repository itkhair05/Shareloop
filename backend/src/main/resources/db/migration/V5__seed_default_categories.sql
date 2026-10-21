-- ==============================================================================
-- ShareLoop Default Categories Seed (Flyway Migration V5)
-- ==============================================================================
-- Seeds the initial community-oriented categories for item sharing,
-- second-hand trading, and wanted requests.
-- Uses deterministic UUIDs (v5/v4-format) and kebab-case slugs.
-- ==============================================================================

INSERT INTO categories (id, name, slug, description, is_active, created_at, updated_at)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Tools & DIY', 'tools-diy', 'Hand tools, power equipment, gardening, and DIY materials for home improvement', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000002', 'Electronics & Appliances', 'electronics-appliances', 'Kitchen appliances, computers, audio-visual gadgets, and mobile tech', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000003', 'Books & Media', 'books-media', 'Novels, textbooks, magazines, board games, vinyl, CDs, and video games', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000004', 'Home & Furniture', 'home-furniture', 'Living, bedroom, and kitchen furniture, decor, lighting, and kitchenware', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000005', 'Clothing & Accessories', 'clothing-accessories', 'Men, women, and unisex clothing, shoes, bags, and daily accessories', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000006', 'Baby & Kids', 'baby-kids', 'Baby gear, strollers, toys, children clothing, and maternity items', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000007', 'Sports & Outdoors', 'sports-outdoors', 'Fitness equipment, bicycles, camping, hiking gear, and outdoor sports', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000008', 'Food & Pantry', 'food-pantry', 'Non-perishable food, surplus garden produce, and unopened pantry goods', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000009', 'Other', 'other', 'Miscellaneous community items, supplies, and unique finds', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;
