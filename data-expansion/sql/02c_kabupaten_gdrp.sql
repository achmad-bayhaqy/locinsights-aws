-- Kabupaten GDRP per kapita enrichment (BPS ADHB, juta rupiah, seri s.d. 2024)
-- Optional: backfills kabupaten.gdrp_per_capita_juta so migration-0009-style
-- logic has real parent data. Load AFTER 02b_kabupaten_codes_fix.sql.

BEGIN;
UPDATE kabupaten SET gdrp_per_capita_juta = 32.87, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1101';  -- Kab. Aceh Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 30.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1102';  -- Kab. Aceh Tenggara
UPDATE kabupaten SET gdrp_per_capita_juta = 35.01, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1103';  -- Kab. Aceh Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 50.1, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1104';  -- Kab. Aceh Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 71.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1105';  -- Kab. Aceh Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 45.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1106';  -- Kab. Aceh Besar
UPDATE kabupaten SET gdrp_per_capita_juta = 34.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1107';  -- Kab. Pidie
UPDATE kabupaten SET gdrp_per_capita_juta = 48.22, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1108';  -- Kab. Aceh Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 34.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1109';  -- Kab. Simeulue
UPDATE kabupaten SET gdrp_per_capita_juta = 27.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1110';  -- Kab. Aceh Singkil
UPDATE kabupaten SET gdrp_per_capita_juta = 42.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1111';  -- Kab. Bireun
UPDATE kabupaten SET gdrp_per_capita_juta = 35.88, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1112';  -- Kab. Aceh Barat Daya
UPDATE kabupaten SET gdrp_per_capita_juta = 34.97, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1113';  -- Kab. Gayo Lues
UPDATE kabupaten SET gdrp_per_capita_juta = 38.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1114';  -- Kab. Aceh Jaya
UPDATE kabupaten SET gdrp_per_capita_juta = 74.57, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1115';  -- Kab. Nagan Raya
UPDATE kabupaten SET gdrp_per_capita_juta = 38.38, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1116';  -- Kab. Aceh Tamiang
UPDATE kabupaten SET gdrp_per_capita_juta = 40.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1117';  -- Kab. Bener Meriah
UPDATE kabupaten SET gdrp_per_capita_juta = 29.75, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1118';  -- Kab. Pidie Jaya
UPDATE kabupaten SET gdrp_per_capita_juta = 104.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1171';  -- Kota Banda Aceh
UPDATE kabupaten SET gdrp_per_capita_juta = 44.82, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1172';  -- Kota Sabang
UPDATE kabupaten SET gdrp_per_capita_juta = 62.54, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1173';  -- Kota Lhokseumawe
UPDATE kabupaten SET gdrp_per_capita_juta = 38.41, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1174';  -- Kota Langsa
UPDATE kabupaten SET gdrp_per_capita_juta = 29.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1175';  -- Kota Subulussalam
UPDATE kabupaten SET gdrp_per_capita_juta = 36.14, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1201';  -- Kab. Tapanuli Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 36.43, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1202';  -- Kab. Tapanuli Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 73.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1203';  -- Kab. Tapanuli Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 35.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1204';  -- Kab. Nias
UPDATE kabupaten SET gdrp_per_capita_juta = 62.53, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1205';  -- Kab. Langkat
UPDATE kabupaten SET gdrp_per_capita_juta = 70.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1206';  -- Kab. Karo
UPDATE kabupaten SET gdrp_per_capita_juta = 78.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1207';  -- Kab. Deli Serdang
UPDATE kabupaten SET gdrp_per_capita_juta = 60.71, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1208';  -- Kab. Simalungun
UPDATE kabupaten SET gdrp_per_capita_juta = 76.58, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1209';  -- Kab. Asahan
UPDATE kabupaten SET gdrp_per_capita_juta = 104.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1210';  -- Kab. Labuhan Batu
UPDATE kabupaten SET gdrp_per_capita_juta = 40.48, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1211';  -- Kab. Dairi
UPDATE kabupaten SET gdrp_per_capita_juta = 49.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1212';  -- Kab. Toba Samosir
UPDATE kabupaten SET gdrp_per_capita_juta = 42.93, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1213';  -- Kab. Mandailing Natal
UPDATE kabupaten SET gdrp_per_capita_juta = 24.24, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1214';  -- Kab. Nias Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 32.7, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1215';  -- Kab. Pakpak Bharat
UPDATE kabupaten SET gdrp_per_capita_juta = 42.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1216';  -- Kab. Humbang Hasundutan
UPDATE kabupaten SET gdrp_per_capita_juta = 44.95, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1217';  -- Kab. Samosir
UPDATE kabupaten SET gdrp_per_capita_juta = 66.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1218';  -- Kab. Serdang Bedagai
UPDATE kabupaten SET gdrp_per_capita_juta = 115.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1219';  -- Kab. Batu Bara
UPDATE kabupaten SET gdrp_per_capita_juta = 68.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1220';  -- Kab. Padang Lawas Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 71.95, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1221';  -- Kab. Padang Lawas
UPDATE kabupaten SET gdrp_per_capita_juta = 134.91, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1222';  -- Kab. Labuhan Batu Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 95.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1223';  -- Kab. Labuhan Batu Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 31.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1224';  -- Kab. Nias Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 26.95, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1225';  -- Kab. Nias Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 141.41, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1271';  -- Kota Medan
UPDATE kabupaten SET gdrp_per_capita_juta = 66.09, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1272';  -- Kota Pematang Siantar
UPDATE kabupaten SET gdrp_per_capita_juta = 82.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1273';  -- Kota Sibolga
UPDATE kabupaten SET gdrp_per_capita_juta = 69.88, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1274';  -- Kota Tanjung Balai
UPDATE kabupaten SET gdrp_per_capita_juta = 53.53, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1275';  -- Kota Binjai
UPDATE kabupaten SET gdrp_per_capita_juta = 45.17, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1276';  -- Kota Tebing Tinggi
UPDATE kabupaten SET gdrp_per_capita_juta = 37.45, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1277';  -- Kota Padang Sidempuan
UPDATE kabupaten SET gdrp_per_capita_juta = 51.84, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1278';  -- Kota Gunungsitoli
UPDATE kabupaten SET gdrp_per_capita_juta = 37.67, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1301';  -- Kab. Pesisir Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 46.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1302';  -- Kab. Solok
UPDATE kabupaten SET gdrp_per_capita_juta = 54.19, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1303';  -- Kab. Sijunjung
UPDATE kabupaten SET gdrp_per_capita_juta = 47.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1304';  -- Kab. Tanah Datar
UPDATE kabupaten SET gdrp_per_capita_juta = 59.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1305';  -- Kab. Padang Pariaman
UPDATE kabupaten SET gdrp_per_capita_juta = 52.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1306';  -- Kab. Agam
UPDATE kabupaten SET gdrp_per_capita_juta = 55.42, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1307';  -- Kab. Lima Puluh Kota
UPDATE kabupaten SET gdrp_per_capita_juta = 39.98, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1308';  -- Kab. Pasaman
UPDATE kabupaten SET gdrp_per_capita_juta = 70.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1309';  -- Kab. Kepulauan Mentawai
UPDATE kabupaten SET gdrp_per_capita_juta = 62.07, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1310';  -- Kab. Dharmasraya
UPDATE kabupaten SET gdrp_per_capita_juta = 41.09, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1311';  -- Kab. Solok Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 49.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1312';  -- Kab. Pasaman Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 92.21, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1371';  -- Kota Padang
UPDATE kabupaten SET gdrp_per_capita_juta = 72.53, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1372';  -- Kota Solok
UPDATE kabupaten SET gdrp_per_capita_juta = 78.07, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1373';  -- Kota Sawah Lunto
UPDATE kabupaten SET gdrp_per_capita_juta = 84.09, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1374';  -- Kota Padang Panjang
UPDATE kabupaten SET gdrp_per_capita_juta = 98.63, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1375';  -- Kota Bukittinggi
UPDATE kabupaten SET gdrp_per_capita_juta = 66.04, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1376';  -- Kota Payakumbuh
UPDATE kabupaten SET gdrp_per_capita_juta = 73.25, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1377';  -- Kota Pariaman
UPDATE kabupaten SET gdrp_per_capita_juta = 139.24, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1401';  -- Kab. Kampar
UPDATE kabupaten SET gdrp_per_capita_juta = 138.34, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1402';  -- Kab.indragiri Hulu
UPDATE kabupaten SET gdrp_per_capita_juta = 292.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1403';  -- Kab. Bengkalis
UPDATE kabupaten SET gdrp_per_capita_juta = 151.25, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1404';  -- Kab.indragiri Hilir
UPDATE kabupaten SET gdrp_per_capita_juta = 201.84, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1405';  -- Kab. Pelalawan
UPDATE kabupaten SET gdrp_per_capita_juta = 108.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1406';  -- Kab. Rokan Hulu
UPDATE kabupaten SET gdrp_per_capita_juta = 158.4, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1407';  -- Kab. Rokan Hilir
UPDATE kabupaten SET gdrp_per_capita_juta = 268.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1408';  -- Kab. Siak
UPDATE kabupaten SET gdrp_per_capita_juta = 165.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1409';  -- Kab. Kuantan Singingi
UPDATE kabupaten SET gdrp_per_capita_juta = 137.26, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1410';  -- Kab. Kepulauan Meranti
UPDATE kabupaten SET gdrp_per_capita_juta = 178.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1471';  -- Kota Pekan Baru
UPDATE kabupaten SET gdrp_per_capita_juta = 171.17, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1472';  -- Kota Dumai
UPDATE kabupaten SET gdrp_per_capita_juta = 61.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1501';  -- Kab. Kerinci
UPDATE kabupaten SET gdrp_per_capita_juta = 73.67, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1502';  -- Kab. Merangin
UPDATE kabupaten SET gdrp_per_capita_juta = 79.34, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1503';  -- Kab. Sarolangun
UPDATE kabupaten SET gdrp_per_capita_juta = 89.31, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1504';  -- Kab. Batanghari
UPDATE kabupaten SET gdrp_per_capita_juta = 102.14, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1505';  -- Kab. Muaro Jambi
UPDATE kabupaten SET gdrp_per_capita_juta = 182.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1506';  -- Kab. Tanjung Jabung Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 127.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1507';  -- Kab. Tanjung Jabung Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 75.85, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1508';  -- Kab. Bungo
UPDATE kabupaten SET gdrp_per_capita_juta = 69.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1509';  -- Kab. Tebo
UPDATE kabupaten SET gdrp_per_capita_juta = 73.34, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1571';  -- Kota Jambi
UPDATE kabupaten SET gdrp_per_capita_juta = 108.71, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1572';  -- Kota Sungai Penuh
UPDATE kabupaten SET gdrp_per_capita_juta = 57.54, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1601';  -- Kab. Ogan Komering Ulu
UPDATE kabupaten SET gdrp_per_capita_juta = 62.41, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1602';  -- Kab. Ogan Komering Ilir
UPDATE kabupaten SET gdrp_per_capita_juta = 197.85, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1603';  -- Kab. Muara Enim
UPDATE kabupaten SET gdrp_per_capita_juta = 71.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1604';  -- Kab. Lahat
UPDATE kabupaten SET gdrp_per_capita_juta = 65.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1605';  -- Kab. Musi Rawas
UPDATE kabupaten SET gdrp_per_capita_juta = 150.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1606';  -- Kab. Musi Banyuasin
UPDATE kabupaten SET gdrp_per_capita_juta = 48.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1607';  -- Kab. Banyuasin
UPDATE kabupaten SET gdrp_per_capita_juta = 33.15, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1608';  -- Kab. Ogan Komering Ulu Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 29.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1609';  -- Kab. Ogan Komering Ulu Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 37.0, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1610';  -- Kab. Ogan Ilir
UPDATE kabupaten SET gdrp_per_capita_juta = 21.15, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1611';  -- Kab. Empat Lawang
UPDATE kabupaten SET gdrp_per_capita_juta = 49.7, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1612';  -- Kab. Penukal Abab Lematang Ilir
UPDATE kabupaten SET gdrp_per_capita_juta = 50.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1613';  -- Kab. Musi Rawas Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 130.92, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1671';  -- Kota Palembang
UPDATE kabupaten SET gdrp_per_capita_juta = 27.71, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1672';  -- Kota Pagar Alam
UPDATE kabupaten SET gdrp_per_capita_juta = 37.69, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1673';  -- Kota Lubuk Linggau
UPDATE kabupaten SET gdrp_per_capita_juta = 55.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1674';  -- Kota Prabumulih
UPDATE kabupaten SET gdrp_per_capita_juta = 48.58, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1701';  -- Kab. Bengkulu Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 48.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1702';  -- Kab. Rejang Lebong
UPDATE kabupaten SET gdrp_per_capita_juta = 43.62, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1703';  -- Kab. Bengkulu Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 40.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1704';  -- Kab. Kaur
UPDATE kabupaten SET gdrp_per_capita_juta = 31.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1705';  -- Kab. Seluma
UPDATE kabupaten SET gdrp_per_capita_juta = 40.61, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1706';  -- Kab. Mukomuko
UPDATE kabupaten SET gdrp_per_capita_juta = 43.59, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1707';  -- Kab. Lebong
UPDATE kabupaten SET gdrp_per_capita_juta = 43.4, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1708';  -- Kab. Kepahiang
UPDATE kabupaten SET gdrp_per_capita_juta = 57.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1709';  -- Kab. Bengkulu Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 88.54, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1771';  -- Kota Bengkulu
UPDATE kabupaten SET gdrp_per_capita_juta = 57.93, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1801';  -- Kab. Lampung Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 68.41, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1802';  -- Kab. Lampung Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 51.76, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1803';  -- Kab. Lampung Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 33.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1804';  -- Kab. Lampung Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 72.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1805';  -- Kab. Tulang Bawang
UPDATE kabupaten SET gdrp_per_capita_juta = 33.52, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1806';  -- Kab. Tanggamus
UPDATE kabupaten SET gdrp_per_capita_juta = 52.32, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1807';  -- Kab. Lampung Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 41.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1808';  -- Kab. Way Kanan
UPDATE kabupaten SET gdrp_per_capita_juta = 46.31, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1809';  -- Kab. Pesawaran
UPDATE kabupaten SET gdrp_per_capita_juta = 38.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1810';  -- Kab. Pringsewu
UPDATE kabupaten SET gdrp_per_capita_juta = 62.95, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1811';  -- Kab. Mesuji
UPDATE kabupaten SET gdrp_per_capita_juta = 55.87, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1812';  -- Kab. Tulang Bawang Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 38.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1813';  -- Kab. Pesisir Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 70.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1871';  -- Kota Bandar Lampung
UPDATE kabupaten SET gdrp_per_capita_juta = 51.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1872';  -- Kota Metro
UPDATE kabupaten SET gdrp_per_capita_juta = 63.27, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1901';  -- Kab. Bangka
UPDATE kabupaten SET gdrp_per_capita_juta = 78.75, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1902';  -- Kab. Belitung
UPDATE kabupaten SET gdrp_per_capita_juta = 61.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1903';  -- Kab. Bangka Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 60.59, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1904';  -- Kab. Bangka Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 97.86, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1905';  -- Kab. Bangka Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 89.14, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1906';  -- Kab. Belitung Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 87.21, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '1971';  -- Kota Pangkal Pinang
UPDATE kabupaten SET gdrp_per_capita_juta = 193.68, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2101';  -- Kab. Bintan
UPDATE kabupaten SET gdrp_per_capita_juta = 74.98, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2102';  -- Kab. Karimun
UPDATE kabupaten SET gdrp_per_capita_juta = 281.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2103';  -- Kab. Natuna
UPDATE kabupaten SET gdrp_per_capita_juta = 57.83, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2104';  -- Kab. Lingga
UPDATE kabupaten SET gdrp_per_capita_juta = 399.58, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2105';  -- Kab. Kep. Anambas
UPDATE kabupaten SET gdrp_per_capita_juta = 195.56, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2171';  -- Kota Batam
UPDATE kabupaten SET gdrp_per_capita_juta = 111.01, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '2172';  -- Kota Tanjung Pinang
UPDATE kabupaten SET gdrp_per_capita_juta = 256.17, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3101';  -- Kab. Kepulauan Seribu
UPDATE kabupaten SET gdrp_per_capita_juta = 949.18, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3171';  -- Kota Jakarta Pusat
UPDATE kabupaten SET gdrp_per_capita_juta = 392.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3172';  -- Kota Jakarta Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 269.43, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3173';  -- Kota Jakarta Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 409.07, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3174';  -- Kota Jakarta Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 218.52, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3175';  -- Kota Jakarta Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 58.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3201';  -- Kab. Bogor
UPDATE kabupaten SET gdrp_per_capita_juta = 33.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3202';  -- Kab. Sukabumi
UPDATE kabupaten SET gdrp_per_capita_juta = 26.55, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3203';  -- Kab. Cianjur
UPDATE kabupaten SET gdrp_per_capita_juta = 47.56, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3204';  -- Kab. Bandung
UPDATE kabupaten SET gdrp_per_capita_juta = 31.29, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3205';  -- Kab. Garut
UPDATE kabupaten SET gdrp_per_capita_juta = 28.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3206';  -- Kab. Tasikmalaya
UPDATE kabupaten SET gdrp_per_capita_juta = 36.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3207';  -- Kab. Ciamis
UPDATE kabupaten SET gdrp_per_capita_juta = 34.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3208';  -- Kab. Kuningan
UPDATE kabupaten SET gdrp_per_capita_juta = 30.64, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3209';  -- Kab. Cirebon
UPDATE kabupaten SET gdrp_per_capita_juta = 37.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3210';  -- Kab. Majalengka
UPDATE kabupaten SET gdrp_per_capita_juta = 42.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3211';  -- Kab. Sumedang
UPDATE kabupaten SET gdrp_per_capita_juta = 59.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3212';  -- Kab.indramayu
UPDATE kabupaten SET gdrp_per_capita_juta = 34.96, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3213';  -- Kab. Subang
UPDATE kabupaten SET gdrp_per_capita_juta = 89.22, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3214';  -- Kab. Purwakarta
UPDATE kabupaten SET gdrp_per_capita_juta = 130.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3215';  -- Kab. Karawang
UPDATE kabupaten SET gdrp_per_capita_juta = 136.7, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3216';  -- Kab. Bekasi
UPDATE kabupaten SET gdrp_per_capita_juta = 34.55, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3217';  -- Kab. Bandung Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 38.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3218';  -- Kab. Pangandaran
UPDATE kabupaten SET gdrp_per_capita_juta = 60.7, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3271';  -- Kota Bogor
UPDATE kabupaten SET gdrp_per_capita_juta = 47.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3272';  -- Kota Sukabumi
UPDATE kabupaten SET gdrp_per_capita_juta = 158.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3273';  -- Kota Bandung
UPDATE kabupaten SET gdrp_per_capita_juta = 95.18, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3274';  -- Kota Cirebon
UPDATE kabupaten SET gdrp_per_capita_juta = 52.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3275';  -- Kota Bekasi
UPDATE kabupaten SET gdrp_per_capita_juta = 46.69, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3276';  -- Kota Depok
UPDATE kabupaten SET gdrp_per_capita_juta = 76.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3277';  -- Kota Cimahi
UPDATE kabupaten SET gdrp_per_capita_juta = 42.13, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3278';  -- Kota Tasikmalaya
UPDATE kabupaten SET gdrp_per_capita_juta = 28.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3279';  -- Kota Banjar
UPDATE kabupaten SET gdrp_per_capita_juta = 69.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3301';  -- Kab. Cilacap
UPDATE kabupaten SET gdrp_per_capita_juta = 42.78, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3302';  -- Kab. Banyumas
UPDATE kabupaten SET gdrp_per_capita_juta = 34.43, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3303';  -- Kab. Purbalingga
UPDATE kabupaten SET gdrp_per_capita_juta = 29.37, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3304';  -- Kab. Banjarnegara
UPDATE kabupaten SET gdrp_per_capita_juta = 29.0, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3305';  -- Kab. Kebumen
UPDATE kabupaten SET gdrp_per_capita_juta = 33.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3306';  -- Kab. Purworejo
UPDATE kabupaten SET gdrp_per_capita_juta = 28.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3307';  -- Kab. Wonosobo
UPDATE kabupaten SET gdrp_per_capita_juta = 34.75, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3308';  -- Kab. Magelang
UPDATE kabupaten SET gdrp_per_capita_juta = 44.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3309';  -- Kab. Boyolali
UPDATE kabupaten SET gdrp_per_capita_juta = 44.92, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3310';  -- Kab. Klaten
UPDATE kabupaten SET gdrp_per_capita_juta = 56.28, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3311';  -- Kab. Sukoharjo
UPDATE kabupaten SET gdrp_per_capita_juta = 40.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3312';  -- Kab. Wonogiri
UPDATE kabupaten SET gdrp_per_capita_juta = 56.88, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3313';  -- Kab. Karanganyar
UPDATE kabupaten SET gdrp_per_capita_juta = 55.52, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3314';  -- Kab. Sragen
UPDATE kabupaten SET gdrp_per_capita_juta = 26.42, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3315';  -- Kab. Grobogan
UPDATE kabupaten SET gdrp_per_capita_juta = 38.55, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3316';  -- Kab. Blora
UPDATE kabupaten SET gdrp_per_capita_juta = 41.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3317';  -- Kab. Rembang
UPDATE kabupaten SET gdrp_per_capita_juta = 46.04, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3318';  -- Kab. Pati
UPDATE kabupaten SET gdrp_per_capita_juta = 148.38, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3319';  -- Kab. Kudus
UPDATE kabupaten SET gdrp_per_capita_juta = 34.92, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3320';  -- Kab. Jepara
UPDATE kabupaten SET gdrp_per_capita_juta = 30.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3321';  -- Kab. Demak
UPDATE kabupaten SET gdrp_per_capita_juta = 64.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3322';  -- Kab. Semarang
UPDATE kabupaten SET gdrp_per_capita_juta = 38.0, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3323';  -- Kab. Temanggung
UPDATE kabupaten SET gdrp_per_capita_juta = 60.0, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3324';  -- Kab. Kendal
UPDATE kabupaten SET gdrp_per_capita_juta = 39.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3325';  -- Kab. Batang
UPDATE kabupaten SET gdrp_per_capita_juta = 31.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3326';  -- Kab. Pekalongan
UPDATE kabupaten SET gdrp_per_capita_juta = 24.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3327';  -- Kab. Pemalang
UPDATE kabupaten SET gdrp_per_capita_juta = 30.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3328';  -- Kab. Tegal
UPDATE kabupaten SET gdrp_per_capita_juta = 31.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3329';  -- Kab. Brebes
UPDATE kabupaten SET gdrp_per_capita_juta = 103.58, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3371';  -- Kota Magelang
UPDATE kabupaten SET gdrp_per_capita_juta = 130.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3372';  -- Kota Surakarta
UPDATE kabupaten SET gdrp_per_capita_juta = 95.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3373';  -- Kota Salatiga
UPDATE kabupaten SET gdrp_per_capita_juta = 167.24, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3374';  -- Kota Semarang
UPDATE kabupaten SET gdrp_per_capita_juta = 48.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3375';  -- Kota Pekalongan
UPDATE kabupaten SET gdrp_per_capita_juta = 77.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3376';  -- Kota Tegal
UPDATE kabupaten SET gdrp_per_capita_juta = 40.07, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3401';  -- Kab. Kulon Progo
UPDATE kabupaten SET gdrp_per_capita_juta = 38.19, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3402';  -- Kab. Bantul
UPDATE kabupaten SET gdrp_per_capita_juta = 38.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3403';  -- Kab. Gunung Kidul
UPDATE kabupaten SET gdrp_per_capita_juta = 58.6, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3404';  -- Kab. Sleman
UPDATE kabupaten SET gdrp_per_capita_juta = 140.64, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3471';  -- Kota Yogyakarta
UPDATE kabupaten SET gdrp_per_capita_juta = 38.22, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3501';  -- Kab. Pacitan
UPDATE kabupaten SET gdrp_per_capita_juta = 30.01, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3502';  -- Kab. Ponorogo
UPDATE kabupaten SET gdrp_per_capita_juta = 35.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3503';  -- Kab. Trenggalek
UPDATE kabupaten SET gdrp_per_capita_juta = 49.48, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3504';  -- Kab. Tulungagung
UPDATE kabupaten SET gdrp_per_capita_juta = 40.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3505';  -- Kab. Blitar
UPDATE kabupaten SET gdrp_per_capita_juta = 34.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3506';  -- Kab. Kediri
UPDATE kabupaten SET gdrp_per_capita_juta = 54.52, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3507';  -- Kab. Malang
UPDATE kabupaten SET gdrp_per_capita_juta = 40.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3508';  -- Kab. Lumajang
UPDATE kabupaten SET gdrp_per_capita_juta = 42.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3509';  -- Kab. Jember
UPDATE kabupaten SET gdrp_per_capita_juta = 67.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3510';  -- Kab. Banyuwangi
UPDATE kabupaten SET gdrp_per_capita_juta = 35.87, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3511';  -- Kab. Bondowoso
UPDATE kabupaten SET gdrp_per_capita_juta = 41.14, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3512';  -- Kab. Situbondo
UPDATE kabupaten SET gdrp_per_capita_juta = 41.41, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3513';  -- Kab. Probolinggo
UPDATE kabupaten SET gdrp_per_capita_juta = 131.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3514';  -- Kab. Pasuruan
UPDATE kabupaten SET gdrp_per_capita_juta = 145.53, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3515';  -- Kab. Sidoarjo
UPDATE kabupaten SET gdrp_per_capita_juta = 105.45, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3516';  -- Kab. Mojokerto
UPDATE kabupaten SET gdrp_per_capita_juta = 42.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3517';  -- Kab. Jombang
UPDATE kabupaten SET gdrp_per_capita_juta = 34.31, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3518';  -- Kab. Nganjuk
UPDATE kabupaten SET gdrp_per_capita_juta = 36.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3519';  -- Kab. Madiun
UPDATE kabupaten SET gdrp_per_capita_juta = 38.26, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3520';  -- Kab. Magetan
UPDATE kabupaten SET gdrp_per_capita_juta = 31.28, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3521';  -- Kab. Ngawi
UPDATE kabupaten SET gdrp_per_capita_juta = 78.89, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3522';  -- Kab. Bojonegoro
UPDATE kabupaten SET gdrp_per_capita_juta = 75.15, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3523';  -- Kab. Tuban
UPDATE kabupaten SET gdrp_per_capita_juta = 40.47, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3524';  -- Kab. Lamongan
UPDATE kabupaten SET gdrp_per_capita_juta = 146.67, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3525';  -- Kab. Gresik
UPDATE kabupaten SET gdrp_per_capita_juta = 27.59, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3526';  -- Kab. Bangkalan
UPDATE kabupaten SET gdrp_per_capita_juta = 25.53, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3527';  -- Kab. Sampang
UPDATE kabupaten SET gdrp_per_capita_juta = 27.21, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3528';  -- Kab. Pamekasan
UPDATE kabupaten SET gdrp_per_capita_juta = 42.09, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3529';  -- Kab. Sumenep
UPDATE kabupaten SET gdrp_per_capita_juta = 581.56, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3571';  -- Kota Kediri
UPDATE kabupaten SET gdrp_per_capita_juta = 63.15, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3572';  -- Kota Blitar
UPDATE kabupaten SET gdrp_per_capita_juta = 122.92, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3573';  -- Kota Malang
UPDATE kabupaten SET gdrp_per_capita_juta = 65.48, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3574';  -- Kota Probolinggo
UPDATE kabupaten SET gdrp_per_capita_juta = 54.01, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3575';  -- Kota Pasuruan
UPDATE kabupaten SET gdrp_per_capita_juta = 66.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3576';  -- Kota Mojokerto
UPDATE kabupaten SET gdrp_per_capita_juta = 98.08, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3577';  -- Kota Madiun
UPDATE kabupaten SET gdrp_per_capita_juta = 283.31, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3578';  -- Kota Surabaya
UPDATE kabupaten SET gdrp_per_capita_juta = 105.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3579';  -- Kota Batu
UPDATE kabupaten SET gdrp_per_capita_juta = 28.96, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3601';  -- Kab. Pandeglang
UPDATE kabupaten SET gdrp_per_capita_juta = 27.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3602';  -- Kab. Lebak
UPDATE kabupaten SET gdrp_per_capita_juta = 58.17, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3603';  -- Kab. Tangerang
UPDATE kabupaten SET gdrp_per_capita_juta = 63.28, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3604';  -- Kab. Serang
UPDATE kabupaten SET gdrp_per_capita_juta = 122.82, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3671';  -- Kota Tangerang
UPDATE kabupaten SET gdrp_per_capita_juta = 322.68, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3672';  -- Kota Cilegon
UPDATE kabupaten SET gdrp_per_capita_juta = 61.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3673';  -- Kota Serang
UPDATE kabupaten SET gdrp_per_capita_juta = 85.48, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '3674';  -- Kota Tangerang Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 55.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5101';  -- Kab. Jembrana
UPDATE kabupaten SET gdrp_per_capita_juta = 63.91, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5102';  -- Kab. Tabanan
UPDATE kabupaten SET gdrp_per_capita_juta = 142.34, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5103';  -- Kab. Badung
UPDATE kabupaten SET gdrp_per_capita_juta = 68.13, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5104';  -- Kab. Gianyar
UPDATE kabupaten SET gdrp_per_capita_juta = 57.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5105';  -- Kab. Klungkung
UPDATE kabupaten SET gdrp_per_capita_juta = 34.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5106';  -- Kab. Bangli
UPDATE kabupaten SET gdrp_per_capita_juta = 43.21, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5107';  -- Kab. Karangasem
UPDATE kabupaten SET gdrp_per_capita_juta = 54.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5108';  -- Kab. Buleleng
UPDATE kabupaten SET gdrp_per_capita_juta = 93.25, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5171';  -- Kota Denpasar
UPDATE kabupaten SET gdrp_per_capita_juta = 26.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5201';  -- Kab. Lombok Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 21.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5202';  -- Kab. Lombok Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 19.64, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5203';  -- Kab. Lombok Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 36.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5204';  -- Kab. Sumbawa
UPDATE kabupaten SET gdrp_per_capita_juta = 38.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5205';  -- Kab. Dompu
UPDATE kabupaten SET gdrp_per_capita_juta = 28.32, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5206';  -- Kab. Bima
UPDATE kabupaten SET gdrp_per_capita_juta = 236.19, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5207';  -- Kab. Sumbawa Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 24.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5208';  -- Kab. Lombok Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 58.09, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5271';  -- Kota Mataram
UPDATE kabupaten SET gdrp_per_capita_juta = 34.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5272';  -- Kota Bima
UPDATE kabupaten SET gdrp_per_capita_juta = 28.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5301';  -- Kab. Kupang
UPDATE kabupaten SET gdrp_per_capita_juta = 22.46, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5302';  -- Kab. Timor Tengah Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 19.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5303';  -- Kab. Timor Tengah Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 26.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5304';  -- Kab. Belu
UPDATE kabupaten SET gdrp_per_capita_juta = 18.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5305';  -- Kab. Alor
UPDATE kabupaten SET gdrp_per_capita_juta = 23.51, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5306';  -- Kab. Flores Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 21.14, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5307';  -- Kab. Sikka
UPDATE kabupaten SET gdrp_per_capita_juta = 30.22, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5308';  -- Kab. Ende
UPDATE kabupaten SET gdrp_per_capita_juta = 27.07, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5309';  -- Kab. Ngada
UPDATE kabupaten SET gdrp_per_capita_juta = 18.76, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5310';  -- Kab. Manggarai
UPDATE kabupaten SET gdrp_per_capita_juta = 32.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5311';  -- Kab. Sumba Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 20.62, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5312';  -- Kab. Sumba Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 16.95, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5313';  -- Kab. Lembata
UPDATE kabupaten SET gdrp_per_capita_juta = 27.9, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5314';  -- Kab. Rote Ndao
UPDATE kabupaten SET gdrp_per_capita_juta = 17.76, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5315';  -- Kab. Manggarai Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 17.88, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5316';  -- Kab. Nagekeo
UPDATE kabupaten SET gdrp_per_capita_juta = 17.67, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5317';  -- Kab. Sumba Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 15.76, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5318';  -- Kab. Sumba Barat Daya
UPDATE kabupaten SET gdrp_per_capita_juta = 15.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5319';  -- Kab. Manggarai Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 19.97, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5320';  -- Kab. Sabu Raijua
UPDATE kabupaten SET gdrp_per_capita_juta = 20.66, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5321';  -- Kab. Malaka
UPDATE kabupaten SET gdrp_per_capita_juta = 69.46, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '5371';  -- Kota Kupang
UPDATE kabupaten SET gdrp_per_capita_juta = 46.82, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6101';  -- Kab. Sambas
UPDATE kabupaten SET gdrp_per_capita_juta = 43.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6102';  -- Kab. Mempawah
UPDATE kabupaten SET gdrp_per_capita_juta = 56.95, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6103';  -- Kab. Sanggau
UPDATE kabupaten SET gdrp_per_capita_juta = 73.6, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6104';  -- Kab. Ketapang
UPDATE kabupaten SET gdrp_per_capita_juta = 50.21, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6105';  -- Kab. Sintang
UPDATE kabupaten SET gdrp_per_capita_juta = 57.84, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6106';  -- Kab. Kapuas Hulu
UPDATE kabupaten SET gdrp_per_capita_juta = 43.29, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6107';  -- Kab. Bengkayang
UPDATE kabupaten SET gdrp_per_capita_juta = 38.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6108';  -- Kab. Landak
UPDATE kabupaten SET gdrp_per_capita_juta = 45.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6109';  -- Kab. Sekadau
UPDATE kabupaten SET gdrp_per_capita_juta = 31.66, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6110';  -- Kab. Melawi
UPDATE kabupaten SET gdrp_per_capita_juta = 46.49, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6111';  -- Kab. Kayong Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 68.0, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6112';  -- Kab. Kubu Raya
UPDATE kabupaten SET gdrp_per_capita_juta = 80.8, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6171';  -- Kota Pontianak
UPDATE kabupaten SET gdrp_per_capita_juta = 59.8, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6172';  -- Kota Singkawang
UPDATE kabupaten SET gdrp_per_capita_juta = 121.22, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6201';  -- Kab. Kotawaringin Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 92.97, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6202';  -- Kab. Kotawaringin Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 62.15, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6203';  -- Kab. Kapuas
UPDATE kabupaten SET gdrp_per_capita_juta = 68.43, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6204';  -- Kab. Barito Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 88.61, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6205';  -- Kab. Barito Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 73.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6206';  -- Kab. Katingan
UPDATE kabupaten SET gdrp_per_capita_juta = 77.17, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6207';  -- Kab. Seruyan
UPDATE kabupaten SET gdrp_per_capita_juta = 102.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6208';  -- Kab. Sukamara
UPDATE kabupaten SET gdrp_per_capita_juta = 84.14, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6209';  -- Kab. Lamandau
UPDATE kabupaten SET gdrp_per_capita_juta = 72.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6210';  -- Kab. Gunung Mas
UPDATE kabupaten SET gdrp_per_capita_juta = 58.66, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6211';  -- Kab. Pulang Pisau
UPDATE kabupaten SET gdrp_per_capita_juta = 102.96, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6212';  -- Kab. Murung Raya
UPDATE kabupaten SET gdrp_per_capita_juta = 94.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6213';  -- Kab. Barito Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 89.94, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6271';  -- Kota Palangka Raya
UPDATE kabupaten SET gdrp_per_capita_juta = 61.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6301';  -- Kab. Tanah Laut
UPDATE kabupaten SET gdrp_per_capita_juta = 115.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6302';  -- Kab. Kota Baru
UPDATE kabupaten SET gdrp_per_capita_juta = 41.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6303';  -- Kab. Banjar
UPDATE kabupaten SET gdrp_per_capita_juta = 36.34, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6304';  -- Kab. Barito Kuala
UPDATE kabupaten SET gdrp_per_capita_juta = 76.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6305';  -- Kab. Tapin
UPDATE kabupaten SET gdrp_per_capita_juta = 43.97, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6306';  -- Kab. Hulu Sungai Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 37.59, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6307';  -- Kab. Hulu Sungai Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 29.88, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6308';  -- Kab. Hulu Sungai Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 126.52, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6309';  -- Kab. Tabalong
UPDATE kabupaten SET gdrp_per_capita_juta = 110.38, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6310';  -- Kab. Tanah Bumbu
UPDATE kabupaten SET gdrp_per_capita_juta = 163.76, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6311';  -- Kab. Balangan
UPDATE kabupaten SET gdrp_per_capita_juta = 73.75, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6371';  -- Kota Banjarmasin
UPDATE kabupaten SET gdrp_per_capita_juta = 55.62, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6372';  -- Kota Banjar Baru
UPDATE kabupaten SET gdrp_per_capita_juta = 196.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6401';  -- Kab. Paser
UPDATE kabupaten SET gdrp_per_capita_juta = 249.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6402';  -- Kab. Kutai Kartanegara
UPDATE kabupaten SET gdrp_per_capita_juta = 193.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6403';  -- Kab. Berau
UPDATE kabupaten SET gdrp_per_capita_juta = 229.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6407';  -- Kab. Kutai Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 325.07, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6408';  -- Kab. Kutai Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 63.81, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6409';  -- Kab. Penajam Paser Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 118.65, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6411';  -- Kab. Mahakam Ulu
UPDATE kabupaten SET gdrp_per_capita_juta = 233.4, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6471';  -- Kota Balikpapan
UPDATE kabupaten SET gdrp_per_capita_juta = 123.22, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6472';  -- Kota Samarinda
UPDATE kabupaten SET gdrp_per_capita_juta = 371.19, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6474';  -- Kota Bontang
UPDATE kabupaten SET gdrp_per_capita_juta = 169.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6501';  -- Kab. Bulungan
UPDATE kabupaten SET gdrp_per_capita_juta = 215.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6502';  -- Kab. Malinau
UPDATE kabupaten SET gdrp_per_capita_juta = 199.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6503';  -- Kab. Nunukan
UPDATE kabupaten SET gdrp_per_capita_juta = 338.61, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6504';  -- Kab. Tana Tidung
UPDATE kabupaten SET gdrp_per_capita_juta = 233.1, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '6571';  -- Kota Tarakan
UPDATE kabupaten SET gdrp_per_capita_juta = 48.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7101';  -- Kab. Bolaang Mongondow
UPDATE kabupaten SET gdrp_per_capita_juta = 73.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7102';  -- Kab. Minahasa
UPDATE kabupaten SET gdrp_per_capita_juta = 47.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7103';  -- Kab. Kepulauan Sangihe
UPDATE kabupaten SET gdrp_per_capita_juta = 34.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7104';  -- Kab. Kepulauan Talaud
UPDATE kabupaten SET gdrp_per_capita_juta = 56.62, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7105';  -- Kab. Minahasa Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 94.92, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7106';  -- Kab. Minahasa Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 65.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7107';  -- Kab. Minahasa Tenggara
UPDATE kabupaten SET gdrp_per_capita_juta = 43.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7108';  -- Kab. Bolaang Mongondow Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 49.78, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7109';  -- Kab. Siau Tagulandang Biaro
UPDATE kabupaten SET gdrp_per_capita_juta = 49.81, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7110';  -- Kab. Bolaang Mongondow Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 43.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7111';  -- Kab. Bolaang Mongondow Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 124.43, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7171';  -- Kota Manado
UPDATE kabupaten SET gdrp_per_capita_juta = 115.42, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7172';  -- Kota Bitung
UPDATE kabupaten SET gdrp_per_capita_juta = 60.93, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7173';  -- Kota Tomohon
UPDATE kabupaten SET gdrp_per_capita_juta = 43.3, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7174';  -- Kota Kotamobagu
UPDATE kabupaten SET gdrp_per_capita_juta = 116.75, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7201';  -- Kab. Banggai
UPDATE kabupaten SET gdrp_per_capita_juta = 53.88, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7202';  -- Kab. Poso
UPDATE kabupaten SET gdrp_per_capita_juta = 58.1, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7203';  -- Kab. Donggala
UPDATE kabupaten SET gdrp_per_capita_juta = 50.42, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7204';  -- Kab. Toli-Toli
UPDATE kabupaten SET gdrp_per_capita_juta = 56.13, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7205';  -- Kab. Buol
UPDATE kabupaten SET gdrp_per_capita_juta = 1072.57, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7206';  -- Kab. Morowali
UPDATE kabupaten SET gdrp_per_capita_juta = 46.83, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7207';  -- Kab. Banggai Kepulauan
UPDATE kabupaten SET gdrp_per_capita_juta = 54.89, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7208';  -- Kab. Parigi Moutong
UPDATE kabupaten SET gdrp_per_capita_juta = 46.55, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7209';  -- Kab. Tojo Una-Una
UPDATE kabupaten SET gdrp_per_capita_juta = 49.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7210';  -- Kab. Sigi
UPDATE kabupaten SET gdrp_per_capita_juta = 47.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7211';  -- Kab. Banggai Laut
UPDATE kabupaten SET gdrp_per_capita_juta = 292.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7212';  -- Kab. Morowali Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 88.38, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7271';  -- Kota Palu
UPDATE kabupaten SET gdrp_per_capita_juta = 62.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7301';  -- Kab. Kepulauan Selayar
UPDATE kabupaten SET gdrp_per_capita_juta = 47.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7302';  -- Kab. Bulukumba
UPDATE kabupaten SET gdrp_per_capita_juta = 68.61, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7303';  -- Kab. Bantaeng
UPDATE kabupaten SET gdrp_per_capita_juta = 34.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7304';  -- Kab. Jeneponto
UPDATE kabupaten SET gdrp_per_capita_juta = 44.81, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7305';  -- Kab. Takalar
UPDATE kabupaten SET gdrp_per_capita_juta = 41.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7306';  -- Kab. Gowa
UPDATE kabupaten SET gdrp_per_capita_juta = 64.46, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7307';  -- Kab. Sinjai
UPDATE kabupaten SET gdrp_per_capita_juta = 64.76, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7308';  -- Kab. Bone
UPDATE kabupaten SET gdrp_per_capita_juta = 71.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7309';  -- Kab. Maros
UPDATE kabupaten SET gdrp_per_capita_juta = 104.7, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7310';  -- Kab. Pangkajene dan Kepulauan
UPDATE kabupaten SET gdrp_per_capita_juta = 56.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7311';  -- Kab. Barru
UPDATE kabupaten SET gdrp_per_capita_juta = 72.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7312';  -- Kab. Soppeng
UPDATE kabupaten SET gdrp_per_capita_juta = 73.46, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7313';  -- Kab. Wajo
UPDATE kabupaten SET gdrp_per_capita_juta = 65.15, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7314';  -- Kab. Sidenreng Rappang
UPDATE kabupaten SET gdrp_per_capita_juta = 66.89, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7315';  -- Kab. Pinrang
UPDATE kabupaten SET gdrp_per_capita_juta = 46.93, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7316';  -- Kab. Enrekang
UPDATE kabupaten SET gdrp_per_capita_juta = 63.45, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7317';  -- Kab. Luwu
UPDATE kabupaten SET gdrp_per_capita_juta = 36.98, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7318';  -- Kab. Tana Toraja
UPDATE kabupaten SET gdrp_per_capita_juta = 64.54, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7322';  -- Kab. Luwu Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 99.87, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7324';  -- Kab. Luwu Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 50.63, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7326';  -- Kab. Toraja Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 177.34, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7371';  -- Kota Makassar
UPDATE kabupaten SET gdrp_per_capita_juta = 65.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7372';  -- Kota Parepare
UPDATE kabupaten SET gdrp_per_capita_juta = 59.37, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7373';  -- Kota Palopo
UPDATE kabupaten SET gdrp_per_capita_juta = 162.54, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7401';  -- Kab. Kolaka
UPDATE kabupaten SET gdrp_per_capita_juta = 86.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7402';  -- Kab. Konawe
UPDATE kabupaten SET gdrp_per_capita_juta = 43.63, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7403';  -- Kab. Muna
UPDATE kabupaten SET gdrp_per_capita_juta = 45.02, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7404';  -- Kab. Buton
UPDATE kabupaten SET gdrp_per_capita_juta = 57.45, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7405';  -- Kab. Konawe Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 59.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7406';  -- Kab. Bombana
UPDATE kabupaten SET gdrp_per_capita_juta = 54.1, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7407';  -- Kab. Wakatobi
UPDATE kabupaten SET gdrp_per_capita_juta = 87.5, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7408';  -- Kab. Kolaka Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 81.77, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7409';  -- Kab. Konawe Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 64.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7410';  -- Kab. Buton Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 50.59, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7411';  -- Kab. Kolaka Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 53.97, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7412';  -- Kab. Konawe Kepulauan
UPDATE kabupaten SET gdrp_per_capita_juta = 40.66, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7413';  -- Kab. Muna Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 27.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7414';  -- Kab. Buton Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 39.99, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7415';  -- Kab. Buton Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 85.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7471';  -- Kota Kendari
UPDATE kabupaten SET gdrp_per_capita_juta = 75.9, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7472';  -- Kota Baubau
UPDATE kabupaten SET gdrp_per_capita_juta = 44.74, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7501';  -- Kab. Gorontalo
UPDATE kabupaten SET gdrp_per_capita_juta = 48.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7502';  -- Kab. Boalemo
UPDATE kabupaten SET gdrp_per_capita_juta = 37.57, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7503';  -- Kab. Bone Bolango
UPDATE kabupaten SET gdrp_per_capita_juta = 61.03, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7504';  -- Kab. Pohuwato
UPDATE kabupaten SET gdrp_per_capita_juta = 35.47, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7505';  -- Kab. Gorontalo Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 57.69, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7571';  -- Kota Gorontalo
UPDATE kabupaten SET gdrp_per_capita_juta = 89.16, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7601';  -- Kab. Pasang Kayu
UPDATE kabupaten SET gdrp_per_capita_juta = 58.09, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7602';  -- Kab. Mamuju
UPDATE kabupaten SET gdrp_per_capita_juta = 23.3, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7603';  -- Kab. Mamasa
UPDATE kabupaten SET gdrp_per_capita_juta = 38.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7604';  -- Kab. Polewali Mandar
UPDATE kabupaten SET gdrp_per_capita_juta = 37.83, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7605';  -- Kab. Majene
UPDATE kabupaten SET gdrp_per_capita_juta = 35.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '7606';  -- Kab. Mamuju Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 27.36, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8101';  -- Kab. Maluku Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 36.62, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8102';  -- Kab. Maluku Tenggara
UPDATE kabupaten SET gdrp_per_capita_juta = 29.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8103';  -- Kab. Kepulauan Tanimbar
UPDATE kabupaten SET gdrp_per_capita_juta = 23.23, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8104';  -- Kab. Buru
UPDATE kabupaten SET gdrp_per_capita_juta = 25.24, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8105';  -- Kab. Seram Bagian Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 18.86, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8106';  -- Kab. Seram Bagian Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 46.19, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8107';  -- Kab. Kepulauan Aru
UPDATE kabupaten SET gdrp_per_capita_juta = 38.81, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8108';  -- Kab. Maluku Barat Daya
UPDATE kabupaten SET gdrp_per_capita_juta = 24.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8109';  -- Kab. Buru Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 57.38, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8171';  -- Kota Ambon
UPDATE kabupaten SET gdrp_per_capita_juta = 38.39, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8172';  -- Kota Tual
UPDATE kabupaten SET gdrp_per_capita_juta = 22.78, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8201';  -- Kab. Halmahera Barat
UPDATE kabupaten SET gdrp_per_capita_juta = 870.96, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8202';  -- Kab. Halmahera Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 37.31, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8203';  -- Kab. Halmahera Utara
UPDATE kabupaten SET gdrp_per_capita_juta = 114.37, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8204';  -- Kab. Halmahera Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 32.72, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8205';  -- Kab. Kepulauan Sula
UPDATE kabupaten SET gdrp_per_capita_juta = 83.28, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8206';  -- Kab. Halmahera Timur
UPDATE kabupaten SET gdrp_per_capita_juta = 27.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8207';  -- Kab. Pulau Morotai
UPDATE kabupaten SET gdrp_per_capita_juta = 36.59, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8208';  -- Kab. Pulau Taliabu
UPDATE kabupaten SET gdrp_per_capita_juta = 76.45, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8271';  -- Kota Ternate
UPDATE kabupaten SET gdrp_per_capita_juta = 33.45, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '8272';  -- Kota Tidore Kepulauan
UPDATE kabupaten SET gdrp_per_capita_juta = 123.13, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9103';  -- Kab. Jayapura
UPDATE kabupaten SET gdrp_per_capita_juta = 46.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9105';  -- Kab. Kepulauan Yapen
UPDATE kabupaten SET gdrp_per_capita_juta = 48.0, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9106';  -- Kab. Biak Numfor
UPDATE kabupaten SET gdrp_per_capita_juta = 92.9, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9110';  -- Kab. Sarmi
UPDATE kabupaten SET gdrp_per_capita_juta = 58.53, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9111';  -- Kab. Keerom
UPDATE kabupaten SET gdrp_per_capita_juta = 71.6, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9115';  -- Kab. Waropen
UPDATE kabupaten SET gdrp_per_capita_juta = 52.42, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9119';  -- Kab. Supiori
UPDATE kabupaten SET gdrp_per_capita_juta = 60.29, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9120';  -- Kab. Mamberamo Raya
UPDATE kabupaten SET gdrp_per_capita_juta = 99.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9171';  -- Kota Jayapura
UPDATE kabupaten SET gdrp_per_capita_juta = 57.89, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9202';  -- Kab. Manokwari
UPDATE kabupaten SET gdrp_per_capita_juta = 71.79, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9203';  -- Kab. Fak-Fak
UPDATE kabupaten SET gdrp_per_capita_juta = 621.84, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9206';  -- Kab. Teluk Bintuni
UPDATE kabupaten SET gdrp_per_capita_juta = 41.28, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9207';  -- Kab. Teluk Wondama
UPDATE kabupaten SET gdrp_per_capita_juta = 47.2, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9208';  -- Kab. Kaimana
UPDATE kabupaten SET gdrp_per_capita_juta = 26.94, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9211';  -- Kab. Manokwari Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 9.12, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9212';  -- Kab. Pegunungan Arfak
UPDATE kabupaten SET gdrp_per_capita_juta = 90.05, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9301';  -- Kab. Merauke
UPDATE kabupaten SET gdrp_per_capita_juta = 87.89, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9302';  -- Kab. Boven Digoel
UPDATE kabupaten SET gdrp_per_capita_juta = 35.13, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9303';  -- Kab. Mappi
UPDATE kabupaten SET gdrp_per_capita_juta = 30.47, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9304';  -- Kab. Asmat
UPDATE kabupaten SET gdrp_per_capita_juta = 91.1, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9401';  -- Kab. Nabire
UPDATE kabupaten SET gdrp_per_capita_juta = 7.52, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9402';  -- Kab. Puncak Jaya
UPDATE kabupaten SET gdrp_per_capita_juta = 23.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9403';  -- Kab. Paniai
UPDATE kabupaten SET gdrp_per_capita_juta = 395.26, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9404';  -- Kab. Mimika
UPDATE kabupaten SET gdrp_per_capita_juta = 15.01, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9405';  -- Kab. Puncak
UPDATE kabupaten SET gdrp_per_capita_juta = 13.57, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9406';  -- Kab. Dogiyai
UPDATE kabupaten SET gdrp_per_capita_juta = 10.64, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9407';  -- Kab. Intan Jaya
UPDATE kabupaten SET gdrp_per_capita_juta = 17.01, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9408';  -- Kab. Deiyai
UPDATE kabupaten SET gdrp_per_capita_juta = 42.84, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9501';  -- Kab. Jayawijaya
UPDATE kabupaten SET gdrp_per_capita_juta = 32.35, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9502';  -- Kab. Pegunungan Bintang
UPDATE kabupaten SET gdrp_per_capita_juta = 9.1, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9503';  -- Kab. Yahukimo
UPDATE kabupaten SET gdrp_per_capita_juta = 9.29, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9504';  -- Kab. Tolikara
UPDATE kabupaten SET gdrp_per_capita_juta = 30.73, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9505';  -- Kab. Mamberamo Tengah
UPDATE kabupaten SET gdrp_per_capita_juta = 16.82, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9506';  -- Kab. Yalimo
UPDATE kabupaten SET gdrp_per_capita_juta = 13.06, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9507';  -- Kab. Lanny Jaya
UPDATE kabupaten SET gdrp_per_capita_juta = 15.11, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9508';  -- Kab. Nduga
UPDATE kabupaten SET gdrp_per_capita_juta = 107.9, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9601';  -- Kab. Sorong
UPDATE kabupaten SET gdrp_per_capita_juta = 42.83, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9602';  -- Kab. Sorong Selatan
UPDATE kabupaten SET gdrp_per_capita_juta = 60.19, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9603';  -- Kab. Raja Ampat
UPDATE kabupaten SET gdrp_per_capita_juta = 10.33, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9604';  -- Kab. Tambrauw
UPDATE kabupaten SET gdrp_per_capita_juta = 18.44, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9605';  -- Kab. Maybrat
UPDATE kabupaten SET gdrp_per_capita_juta = 59.64, source = concat(source, '; BPS PDRB per kapita ADHB per kabupaten/kota (seri s.d. 2024, mirror publik BPS)') WHERE code = '9671';  -- Kota Sorong
COMMIT;
