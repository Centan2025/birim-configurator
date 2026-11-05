# V4.1 Module catalog audit

92/92 seeds were independently instantiated, schema-validated, generated into geometry and BOM, and checked for finite positive geometry, unique component IDs, and consistency with four-space front dimensions. Evidence: `tests/v41-independent-audit.test.ts`, test `independently inventories every template...`; machine-readable output `test-results/v41/catalog.json`.

This is **computational** validation at default sizes, not individual visual or physical acceptance. Every row uses `packages/catalog/src/v4-module-taxonomy.ts:buildTemplateFromSeed`, `packages/geometry/src/mesh-generator.ts:generateModuleGeometry`, `packages/core/src/v4-profiles.ts:calculateFourSpaceDimensions`, and `packages/manufacturing/src/bom-generator.ts:generateBOMForProject`. Reproduce each row by calling `createInstance(templateId)` for that row and running the above regression test.

Three templates explicitly require bespoke factory geometry. Appliance openings, real corner panel shapes, frames, leveling feet and accessory meshes are not proven merely by passing the positive-dimension check. Unknown technical rules remain unverified. No new duplicate templates were added.

| Template ID | Family | Name | W × H × D mm | Mesh parts | Cut parts | Status | Front dimensions match |
|---|---|---|---|---:|---:|---|---|
| tpl_kb_01_single_door | fam_kitchen_base | Tek Kapaklı Alt Dolap | 450 × 720 × 580 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kb_02_double_door | fam_kitchen_base | Çift Kapaklı Alt Dolap | 800 × 720 × 580 | 15 | 9 | UNVERIFIED | Yes |
| tpl_kb_03_single_drawer | fam_kitchen_base | Tek Derin Çekmeceli Alt Dolap | 600 × 720 × 580 | 13 | 11 | UNVERIFIED | Yes |
| tpl_kb_04_two_drawers | fam_kitchen_base | İki Çekmeceli Alt Dolap (2 Derin) | 800 × 720 × 580 | 20 | 16 | UNVERIFIED | Yes |
| tpl_kb_05_three_drawers | fam_kitchen_base | Üç Çekmeceli Alt Dolap (1+2) | 800 × 720 × 580 | 27 | 21 | UNVERIFIED | Yes |
| tpl_kb_06_four_drawers | fam_kitchen_base | Dört Çekmeceli Alt Dolap | 600 × 720 × 580 | 34 | 26 | UNVERIFIED | Yes |
| tpl_kb_07_door_internal_drawer | fam_kitchen_base | Kapak + İç Çekmeceli Alt Dolap | 600 × 720 × 580 | 25 | 18 | UNVERIFIED | Yes |
| tpl_kb_08_sink_base | fam_kitchen_base | Evye Alt Dolabı | 800 × 720 × 580 | 14 | 8 | UNVERIFIED | Yes |
| tpl_kb_09_oven_housing | fam_kitchen_base | Ankastre Fırın Alt Dolabı | 600 × 720 × 580 | 14 | 12 | UNVERIFIED | Yes |
| tpl_kb_10_dishwasher_front | fam_kitchen_base | Bulaşık Makinesi Entegrasyon Cephesi | 600 × 720 × 580 | 10 | 7 | UNVERIFIED | Yes |
| tpl_kb_11_narrow_spice | fam_kitchen_base | Dar Baharatlık Modülü | 200 × 720 × 580 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kb_12_waste_sorting | fam_kitchen_base | Çöp Ayrıştırma Dolabı | 600 × 720 × 580 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kb_13_blind_corner | fam_kitchen_base | Kör Köşe Alt Dolabı (LeMans) | 1050 × 720 × 580 | 12 | 9 | UNVERIFIED | Yes |
| tpl_kb_14_l_corner | fam_kitchen_base | L Köşe Alt Dolabı (90° Katlanır) | 900 × 720 × 900 | 15 | 9 | UNVERIFIED | Yes |
| tpl_kb_15_diagonal_corner | fam_kitchen_base | Diyagonal (45°) Köşe Alt Dolabı | 900 × 720 × 900 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kb_16_open_shelf | fam_kitchen_base | Açık Raflı Alt Modül | 450 × 720 × 580 | 8 | 8 | UNVERIFIED | Yes |
| tpl_kb_17_bottle_rack | fam_kitchen_base | Şaraplık / Şişelik Modülü | 300 × 720 × 580 | 10 | 10 | UNVERIFIED | Yes |
| tpl_kb_18_cooktop_base | fam_kitchen_base | Ocak Altı Modülü | 900 × 720 × 580 | 27 | 21 | UNVERIFIED | Yes |
| tpl_kb_19_drawer_door_combo | fam_kitchen_base | Çekmece + Kapak Kombinasyonu | 600 × 720 × 580 | 21 | 13 | UNVERIFIED | Yes |
| tpl_kb_20_custom_base | fam_kitchen_base | Özel Ölçü Alt Modül | 600 × 720 × 580 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kw_01_single_door | fam_kitchen_wall | Tek Kapaklı Üst Dolap | 450 × 720 × 350 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kw_02_double_door | fam_kitchen_wall | Çift Kapaklı Üst Dolap | 800 × 720 × 350 | 15 | 9 | UNVERIFIED | Yes |
| tpl_kw_03_open_shelf | fam_kitchen_wall | Açık Raflı Üst Modül | 600 × 720 × 350 | 7 | 7 | UNVERIFIED | Yes |
| tpl_kw_04_glass_door | fam_kitchen_wall | Cam Kapaklı Vitrin Üst Dolap | 800 × 720 × 350 | 15 | 9 | UNVERIFIED | Yes |
| tpl_kw_05_lift_stay_single | fam_kitchen_wall | Yukarı Kalkar Tek Kapak (HK top) | 800 × 450 × 350 | 10 | 7 | UNVERIFIED | Yes |
| tpl_kw_06_lift_bifold | fam_kitchen_wall | İki Parçalı Katlanır Kalkar (HF top) | 900 × 780 × 350 | 15 | 9 | UNVERIFIED | Yes |
| tpl_kw_07_lift_parallel | fam_kitchen_wall | Paralel Yukarı Kalkar (HL top) | 900 × 500 × 350 | 10 | 7 | UNVERIFIED | Yes |
| tpl_kw_08_lift_up_over | fam_kitchen_wall | Üstten Döner Kalkar (HS top) | 900 × 720 × 350 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kw_09_hood_cabinet | fam_kitchen_wall | Davlumbaz Üst Dolabı | 600 × 720 × 350 | 10 | 7 | UNVERIFIED | Yes |
| tpl_kw_10_microwave_wall | fam_kitchen_wall | Mikrodalga Nişli Üst Dolap | 600 × 720 × 380 | 10 | 7 | UNVERIFIED | Yes |
| tpl_kw_11_corner_wall | fam_kitchen_wall | Köşe Üst Dolabı | 650 × 720 × 650 | 15 | 9 | UNVERIFIED | Yes |
| tpl_kw_12_horizontal_wide | fam_kitchen_wall | Yatay Geniş Üst Dolap | 1200 × 360 × 350 | 14 | 8 | UNVERIFIED | Yes |
| tpl_kw_13_narrow_wall | fam_kitchen_wall | Dar Üst Dolap | 300 × 720 × 350 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kw_14_led_shelf_unit | fam_kitchen_wall | Aydınlatmalı Üst Dolap | 900 × 720 × 350 | 16 | 10 | UNVERIFIED | Yes |
| tpl_kw_15_custom_wall | fam_kitchen_wall | Özel Ölçü Üst Modül | 600 × 720 × 350 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kt_01_pantry_shelved | fam_kitchen_tall | Raflı Boy Kiler Dolabı | 600 × 2150 × 580 | 15 | 12 | UNVERIFIED | Yes |
| tpl_kt_02_pantry_pullout | fam_kitchen_tall | Çekmeceli / Tandem Kiler Dolabı | 450 × 2150 × 580 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kt_03_pantry_internal_drawers | fam_kitchen_tall | İç Çekmeceli Boy Kiler (SPACE TOWER) | 600 × 2150 × 580 | 40 | 29 | UNVERIFIED | Yes |
| tpl_kt_04_oven_tower | fam_kitchen_tall | Ankastre Fırın Kulesi | 600 × 2150 × 580 | 32 | 19 | UNVERIFIED | Yes |
| tpl_kt_05_oven_microwave_tower | fam_kitchen_tall | Fırın + Mikrodalga Kulesi | 600 × 2150 × 580 | 33 | 20 | UNVERIFIED | Yes |
| tpl_kt_06_builtin_fridge | fam_kitchen_tall | Ankastre Buzdolabı Boy Dolabı | 600 × 2150 × 580 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kt_07_fridge_surround | fam_kitchen_tall | Solo Buzdolabı Çevresi Ünitesi | 950 × 2150 × 650 | 11 | 8 | UNVERIFIED | Yes |
| tpl_kt_08_utility_cleaning | fam_kitchen_tall | Temizlik Dolabı | 600 × 2150 × 600 | 13 | 10 | UNVERIFIED | Yes |
| tpl_kt_09_broom_vacuum | fam_kitchen_tall | Süpürge & Şarj İstasyonu Dolabı | 500 × 2150 × 580 | 12 | 9 | UNVERIFIED | Yes |
| tpl_kt_10_open_niche_tall | fam_kitchen_tall | Açık Kahve Nişli Boy Dolap | 800 × 2150 × 580 | 23 | 19 | UNVERIFIED | Yes |
| tpl_kt_11_pocket_appliance | fam_kitchen_tall | Pocket Kapaklı Cihaz Dolabı (REVEGO) | 1300 × 2200 × 650 | 47 | 33 | UNVERIFIED | Yes |
| tpl_kt_12_custom_tall | fam_kitchen_tall | Özel Ölçü Boy Dolap | 600 × 2150 × 580 | 14 | 11 | UNVERIFIED | Yes |
| tpl_wd_01_single_door | fam_wardrobe | Tek Kapaklı Gardırop | 500 × 2200 × 600 | 13 | 9 | UNVERIFIED | Yes |
| tpl_wd_02_two_door | fam_wardrobe | Çift Kapaklı Gardırop | 1000 × 2200 × 600 | 17 | 10 | UNVERIFIED | Yes |
| tpl_wd_03_three_door | fam_wardrobe | Üç Kapaklı Gardırop | 1500 × 2200 × 600 | 57 | 35 | UNVERIFIED | Yes |
| tpl_wd_04_four_door | fam_wardrobe | Dört Kapaklı Gardırop | 2000 × 2200 × 600 | 29 | 15 | UNVERIFIED | Yes |
| tpl_wd_05_sliding_2door | fam_wardrobe | Sürgülü İki Kapaklı Gardırop | 1800 × 2200 × 650 | 23 | 13 | UNVERIFIED | Yes |
| tpl_wd_06_sliding_3door | fam_wardrobe | Sürgülü Üç Kapaklı Gardırop | 2700 × 2200 × 650 | 32 | 17 | UNVERIFIED | Yes |
| tpl_wd_07_sliding_4door | fam_wardrobe | Sürgülü Dört Kapaklı Gardırop | 3200 × 2200 × 650 | 41 | 21 | UNVERIFIED | Yes |
| tpl_wd_08_open_walkin | fam_wardrobe | Açık Gövde Giyinme Modülü | 1000 × 2300 × 550 | 24 | 18 | UNVERIFIED | Yes |
| tpl_wd_09_hanging_heavy | fam_wardrobe | Askılık Ağırlıklı Gardırop (Asansörlü) | 1000 × 2300 × 600 | 18 | 10 | UNVERIFIED | Yes |
| tpl_wd_10_shelf_heavy | fam_wardrobe | Raf Ağırlıklı Gardırop | 800 × 2200 × 600 | 19 | 13 | UNVERIFIED | Yes |
| tpl_wd_11_drawer_heavy | fam_wardrobe | Çekmece Ağırlıklı Gardırop | 900 × 2200 × 600 | 37 | 29 | UNVERIFIED | Yes |
| tpl_wd_12_mixed_organizer | fam_wardrobe | Karma İç Düzenli Gardırop | 1200 × 2300 × 600 | 57 | 35 | UNVERIFIED | Yes |
| tpl_wd_13_corner_wardrobe | fam_wardrobe | Köşe Gardırop Modülü | 1050 × 2200 × 1050 | 17 | 10 | UNVERIFIED | Yes |
| tpl_wd_14_walkin_l_unit | fam_wardrobe | L Giyinme Odası Modülü | 1000 × 2300 × 550 | 10 | 9 | UNVERIFIED | Yes |
| tpl_wd_15_walkin_u_unit | fam_wardrobe | U Giyinme Odası Merkez Modülü | 1200 × 2300 × 550 | 24 | 19 | UNVERIFIED | Yes |
| tpl_wd_16_island_dresser | fam_wardrobe | Ada Çekmece & Takı Ünitesi | 1200 × 900 × 800 | 51 | 39 | UNVERIFIED | Yes |
| tpl_wd_17_trouser_unit | fam_wardrobe | Pantolonluk Ünitesi | 900 × 2200 × 600 | 17 | 10 | UNVERIFIED | Yes |
| tpl_wd_18_shoe_tower | fam_wardrobe | Ayakkabılık Ünitesi | 800 × 2200 × 450 | 19 | 13 | UNVERIFIED | Yes |
| tpl_wd_19_glass_showcase | fam_wardrobe | Cam Kapaklı Vitrin Gardırop | 1000 × 2300 × 600 | 18 | 12 | UNVERIFIED | Yes |
| tpl_wd_20_builtin_niche | fam_wardrobe | Özel Ölçü / Gömme Dolap | 1600 × 2500 × 600 | 29 | 15 | UNVERIFIED | Yes |
| tpl_sc_01_inner_corner | fam_special_corner | İç Köşe Dönüş Modülü (90°) | 900 × 2200 × 900 | 17 | 11 | UNVERIFIED | Yes |
| tpl_sc_02_outer_corner | fam_special_corner | Dış Köşe Kolon Sarma Modülü | 600 × 2200 × 600 | 14 | 11 | UNVERIFIED | Yes |
| tpl_sc_03_blind_corner_tall | fam_special_corner | Kör Köşe Boy Modül | 1100 × 2200 × 600 | 13 | 10 | UNVERIFIED | Yes |
| tpl_sc_04_diagonal_tall | fam_special_corner | Diyagonal (45°) Köşe Dolabı | 1000 × 2200 × 1000 | 13 | 9 | UNVERIFIED | Yes |
| tpl_sc_05_sloped_ceiling | fam_special_corner | Eğimli Tavan (Çatı Arası) Modülü | 900 × 2100 × 600 | 17 | 11 | PARTIALLY WORKING | Yes |
| tpl_sc_06_under_stairs | fam_special_corner | Merdiven Altı Kademeli Modül | 1200 × 1800 × 600 | 27 | 15 | PARTIALLY WORKING | Yes |
| tpl_sc_07_narrow_niche | fam_special_corner | Dar Niş Dolabı (250mm) | 250 × 2150 × 580 | 15 | 12 | UNVERIFIED | Yes |
| tpl_sc_08_stepped_depth | fam_special_corner | Kademeli Derinlik Geçiş Modülü | 600 × 2200 × 450 | 14 | 11 | UNVERIFIED | Yes |
| tpl_sc_09_terminal_end | fam_special_corner | Serbest Biçimli Açık Bitiş Modülü | 350 × 2200 × 600 | 11 | 11 | UNVERIFIED | Yes |
| tpl_sc_10_custom_geometry | fam_special_corner | Özel Üretim Geometrisi (Bespoke) | 800 × 2200 × 600 | 17 | 11 | PARTIALLY WORKING | Yes |
| tpl_cm_01_plinth_strip | fam_complementary | Baza Ön Boy Bandı | 2400 × 100 × 18 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_02_leveling_feet | fam_complementary | Ayarlanabilir Baza Ayağı Seti | 600 × 100 × 500 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_03_skirting | fam_complementary | Süpürgelik / Yan Baza Dönüşü | 580 × 100 × 18 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_04_wall_filler | fam_complementary | Duvar Bitiş Dolgu Paneli (Kör Parça) | 50 × 2200 × 100 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_05_end_panel | fam_complementary | Görünür Yan Bitiş Paneli | 18 × 2200 × 600 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_06_top_infill | fam_complementary | Üst Tavan Kapama Paneli | 2400 × 150 × 18 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_07_fascia_panel | fam_complementary | Cihaz / Evye Alın Paneli | 600 × 110 × 18 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_08_back_cladding | fam_complementary | Dekoratif Arkalık / Duvar Lambri | 1200 × 2200 × 18 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_09_countertop | fam_complementary | Mutfak Tezgâhı (Countertop) | 2400 × 40 × 600 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_10_waterfall_edge | fam_complementary | Tezgâh Yan Düşey Bitişi (Waterfall) | 40 × 860 × 600 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_11_backsplash | fam_complementary | Tezgâh Arası Paneli (Backsplash) | 2400 × 600 × 18 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_12_crown_molding | fam_complementary | Üst Taç / Işık Bandı Profili | 2400 × 60 × 40 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_13_led_channel | fam_complementary | Gömme LED Aydınlatma Profili | 1000 × 16 × 16 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_14_wall_bracket | fam_complementary | Duvar Askı Rayı & Devrilme Önleyici | 2400 × 45 × 16 | 1 | 1 | UNVERIFIED | Yes |
| tpl_cm_15_service_spacer | fam_complementary | Montaj / Tesisat Servis Boşluğu Elemanı | 600 × 2150 × 50 | 1 | 1 | UNVERIFIED | Yes |

## Repairs and limits

- Mixed-height drawer elevations now sum preceding heights rather than multiplying the current height by its index.
- Template dimension limits are applied by store dimension updates, with fixed-width preservation and finite-input checks. Thin complementary modules retain their existing minimum height/depth.
- Sliding door width now agrees with four-space dimensions. This does not certify track overlap, loading or manufacturer clearances.
- Global height changes reposition shelves and rails proportionally within the new inner space; drawers remain subject to explicit overflow validation rather than silently changing their sizes.
- `requiresFactoryValidation` is preserved. Kitchen, wardrobe and complementary catalogs are still generic representations where no bespoke mesh generator exists.
