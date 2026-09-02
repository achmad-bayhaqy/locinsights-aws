-- New MAP/MAA portfolio brands referenced by OSM outlets
INSERT INTO brands (id, name, parent, category, origin_country, format, location_preference, typical_size_m2, target_audience, brand_strength, notes, city, source, is_active) VALUES
('BR001', 'Starbucks', 'MAP'::brand_parent_enum, 'food_beverage'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('BR101', 'Sports Station', 'MAA'::brand_parent_enum, 'sports'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('BR102', 'Planet Sports', 'MAA'::brand_parent_enum, 'sports'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('BR201', 'Sogo', 'MAP'::brand_parent_enum, 'department_store'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('BR202', 'SEIBU', 'MAP'::brand_parent_enum, 'department_store'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('BR307', 'Sephora', 'MAP'::brand_parent_enum, 'beauty'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('BR204', 'Zara', 'MAP'::brand_parent_enum, 'fashion'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('bershka', 'Bershka', 'MAP'::brand_parent_enum, 'fashion'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('stradivarius', 'Stradivarius', 'MAP'::brand_parent_enum, 'fashion'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('massimodutti', 'Massimo Dutti', 'MAA'::brand_parent_enum, 'fashion'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('galeries_lafayette', 'Galeries Lafayette', 'MAP'::brand_parent_enum, 'department_store'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('kidz_station', 'Kidz Station', 'MAA'::brand_parent_enum, 'kids'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('the_body_shop', 'The Body Shop', 'MAP'::brand_parent_enum, 'beauty'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('muji', 'MUJI', 'MAP'::brand_parent_enum, 'lifestyle'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true),
('cotton_on', 'Cotton On', 'MAP'::brand_parent_enum, 'fashion'::brand_category_enum, 'Indonesia', NULL, 'both'::location_format_enum, 0, '', 0.5, '', 'Jabodetabek', 'OpenStreetMap/brand audit', true)
ON CONFLICT (id) DO NOTHING;

