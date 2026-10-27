-- Kabupaten renumbering to official BPS/Kepmendagri codes + province fix
-- (2022 Papua split and non-official repo numbering). Two-phase rename;
-- idempotent. Load BEFORE 03_kecamatan.sql.

BEGIN;

-- phase 1: move affected rows into a temp namespace
UPDATE kabupaten SET code = 'TMP~1101' WHERE code = '1101';
UPDATE kabupaten SET code = 'TMP~1102' WHERE code = '1102';
UPDATE kabupaten SET code = 'TMP~1103' WHERE code = '1103';
UPDATE kabupaten SET code = 'TMP~1104' WHERE code = '1104';
UPDATE kabupaten SET code = 'TMP~1105' WHERE code = '1105';
UPDATE kabupaten SET code = 'TMP~1106' WHERE code = '1106';
UPDATE kabupaten SET code = 'TMP~1107' WHERE code = '1107';
UPDATE kabupaten SET code = 'TMP~1108' WHERE code = '1108';
UPDATE kabupaten SET code = 'TMP~1109' WHERE code = '1109';
UPDATE kabupaten SET code = 'TMP~1110' WHERE code = '1110';
UPDATE kabupaten SET code = 'TMP~1111' WHERE code = '1111';
UPDATE kabupaten SET code = 'TMP~1114' WHERE code = '1114';
UPDATE kabupaten SET code = 'TMP~1116' WHERE code = '1116';
UPDATE kabupaten SET code = 'TMP~1173' WHERE code = '1173';
UPDATE kabupaten SET code = 'TMP~1174' WHERE code = '1174';
UPDATE kabupaten SET code = 'TMP~1201' WHERE code = '1201';
UPDATE kabupaten SET code = 'TMP~1202' WHERE code = '1202';
UPDATE kabupaten SET code = 'TMP~1204' WHERE code = '1204';
UPDATE kabupaten SET code = 'TMP~1205' WHERE code = '1205';
UPDATE kabupaten SET code = 'TMP~1206' WHERE code = '1206';
UPDATE kabupaten SET code = 'TMP~1207' WHERE code = '1207';
UPDATE kabupaten SET code = 'TMP~1208' WHERE code = '1208';
UPDATE kabupaten SET code = 'TMP~1209' WHERE code = '1209';
UPDATE kabupaten SET code = 'TMP~1210' WHERE code = '1210';
UPDATE kabupaten SET code = 'TMP~1211' WHERE code = '1211';
UPDATE kabupaten SET code = 'TMP~1212' WHERE code = '1212';
UPDATE kabupaten SET code = 'TMP~1213' WHERE code = '1213';
UPDATE kabupaten SET code = 'TMP~1215' WHERE code = '1215';
UPDATE kabupaten SET code = 'TMP~1216' WHERE code = '1216';
UPDATE kabupaten SET code = 'TMP~1271' WHERE code = '1271';
UPDATE kabupaten SET code = 'TMP~1272' WHERE code = '1272';
UPDATE kabupaten SET code = 'TMP~1273' WHERE code = '1273';
UPDATE kabupaten SET code = 'TMP~1274' WHERE code = '1274';
UPDATE kabupaten SET code = 'TMP~1275' WHERE code = '1275';
UPDATE kabupaten SET code = 'TMP~1276' WHERE code = '1276';
UPDATE kabupaten SET code = 'TMP~1301' WHERE code = '1301';
UPDATE kabupaten SET code = 'TMP~1302' WHERE code = '1302';
UPDATE kabupaten SET code = 'TMP~1303' WHERE code = '1303';
UPDATE kabupaten SET code = 'TMP~1304' WHERE code = '1304';
UPDATE kabupaten SET code = 'TMP~1305' WHERE code = '1305';
UPDATE kabupaten SET code = 'TMP~1306' WHERE code = '1306';
UPDATE kabupaten SET code = 'TMP~1307' WHERE code = '1307';
UPDATE kabupaten SET code = 'TMP~1308' WHERE code = '1308';
UPDATE kabupaten SET code = 'TMP~1309' WHERE code = '1309';
UPDATE kabupaten SET code = 'TMP~1310' WHERE code = '1310';
UPDATE kabupaten SET code = 'TMP~1311' WHERE code = '1311';
UPDATE kabupaten SET code = 'TMP~1401' WHERE code = '1401';
UPDATE kabupaten SET code = 'TMP~1403' WHERE code = '1403';
UPDATE kabupaten SET code = 'TMP~1404' WHERE code = '1404';
UPDATE kabupaten SET code = 'TMP~1405' WHERE code = '1405';
UPDATE kabupaten SET code = 'TMP~1406' WHERE code = '1406';
UPDATE kabupaten SET code = 'TMP~1407' WHERE code = '1407';
UPDATE kabupaten SET code = 'TMP~1408' WHERE code = '1408';
UPDATE kabupaten SET code = 'TMP~1409' WHERE code = '1409';
UPDATE kabupaten SET code = 'TMP~1473' WHERE code = '1473';
UPDATE kabupaten SET code = 'TMP~1506' WHERE code = '1506';
UPDATE kabupaten SET code = 'TMP~1507' WHERE code = '1507';
UPDATE kabupaten SET code = 'TMP~1508' WHERE code = '1508';
UPDATE kabupaten SET code = 'TMP~1509' WHERE code = '1509';
UPDATE kabupaten SET code = 'TMP~1608' WHERE code = '1608';
UPDATE kabupaten SET code = 'TMP~1609' WHERE code = '1609';
UPDATE kabupaten SET code = 'TMP~1672' WHERE code = '1672';
UPDATE kabupaten SET code = 'TMP~1673' WHERE code = '1673';
UPDATE kabupaten SET code = 'TMP~1674' WHERE code = '1674';
UPDATE kabupaten SET code = 'TMP~1801' WHERE code = '1801';
UPDATE kabupaten SET code = 'TMP~1802' WHERE code = '1802';
UPDATE kabupaten SET code = 'TMP~1803' WHERE code = '1803';
UPDATE kabupaten SET code = 'TMP~1804' WHERE code = '1804';
UPDATE kabupaten SET code = 'TMP~1805' WHERE code = '1805';
UPDATE kabupaten SET code = 'TMP~1806' WHERE code = '1806';
UPDATE kabupaten SET code = 'TMP~1807' WHERE code = '1807';
UPDATE kabupaten SET code = 'TMP~1808' WHERE code = '1808';
UPDATE kabupaten SET code = 'TMP~1903' WHERE code = '1903';
UPDATE kabupaten SET code = 'TMP~1905' WHERE code = '1905';
UPDATE kabupaten SET code = 'TMP~2101' WHERE code = '2101';
UPDATE kabupaten SET code = 'TMP~2102' WHERE code = '2102';
UPDATE kabupaten SET code = 'TMP~3171' WHERE code = '3171';
UPDATE kabupaten SET code = 'TMP~3172' WHERE code = '3172';
UPDATE kabupaten SET code = 'TMP~3173' WHERE code = '3173';
UPDATE kabupaten SET code = 'TMP~3174' WHERE code = '3174';
UPDATE kabupaten SET code = 'TMP~3175' WHERE code = '3175';
UPDATE kabupaten SET code = 'TMP~3176' WHERE code = '3176';
UPDATE kabupaten SET code = 'TMP~3674' WHERE code = '3674';
UPDATE kabupaten SET code = 'TMP~3676' WHERE code = '3676';
UPDATE kabupaten SET code = 'TMP~5301' WHERE code = '5301';
UPDATE kabupaten SET code = 'TMP~5302' WHERE code = '5302';
UPDATE kabupaten SET code = 'TMP~5303' WHERE code = '5303';
UPDATE kabupaten SET code = 'TMP~5304' WHERE code = '5304';
UPDATE kabupaten SET code = 'TMP~5305' WHERE code = '5305';
UPDATE kabupaten SET code = 'TMP~5306' WHERE code = '5306';
UPDATE kabupaten SET code = 'TMP~5307' WHERE code = '5307';
UPDATE kabupaten SET code = 'TMP~5308' WHERE code = '5308';
UPDATE kabupaten SET code = 'TMP~5309' WHERE code = '5309';
UPDATE kabupaten SET code = 'TMP~5310' WHERE code = '5310';
UPDATE kabupaten SET code = 'TMP~5311' WHERE code = '5311';
UPDATE kabupaten SET code = 'TMP~5312' WHERE code = '5312';
UPDATE kabupaten SET code = 'TMP~5313' WHERE code = '5313';
UPDATE kabupaten SET code = 'TMP~5316' WHERE code = '5316';
UPDATE kabupaten SET code = 'TMP~5317' WHERE code = '5317';
UPDATE kabupaten SET code = 'TMP~5318' WHERE code = '5318';
UPDATE kabupaten SET code = 'TMP~6102' WHERE code = '6102';
UPDATE kabupaten SET code = 'TMP~6103' WHERE code = '6103';
UPDATE kabupaten SET code = 'TMP~6104' WHERE code = '6104';
UPDATE kabupaten SET code = 'TMP~6105' WHERE code = '6105';
UPDATE kabupaten SET code = 'TMP~6106' WHERE code = '6106';
UPDATE kabupaten SET code = 'TMP~6107' WHERE code = '6107';
UPDATE kabupaten SET code = 'TMP~6108' WHERE code = '6108';
UPDATE kabupaten SET code = 'TMP~6206' WHERE code = '6206';
UPDATE kabupaten SET code = 'TMP~6207' WHERE code = '6207';
UPDATE kabupaten SET code = 'TMP~6208' WHERE code = '6208';
UPDATE kabupaten SET code = 'TMP~6209' WHERE code = '6209';
UPDATE kabupaten SET code = 'TMP~6210' WHERE code = '6210';
UPDATE kabupaten SET code = 'TMP~6211' WHERE code = '6211';
UPDATE kabupaten SET code = 'TMP~6212' WHERE code = '6212';
UPDATE kabupaten SET code = 'TMP~6213' WHERE code = '6213';
UPDATE kabupaten SET code = 'TMP~6402' WHERE code = '6402';
UPDATE kabupaten SET code = 'TMP~6403' WHERE code = '6403';
UPDATE kabupaten SET code = 'TMP~6404' WHERE code = '6404';
UPDATE kabupaten SET code = 'TMP~6405' WHERE code = '6405';
UPDATE kabupaten SET code = 'TMP~6501' WHERE code = '6501';
UPDATE kabupaten SET code = 'TMP~6502' WHERE code = '6502';
UPDATE kabupaten SET code = 'TMP~6503' WHERE code = '6503';
UPDATE kabupaten SET code = 'TMP~6504' WHERE code = '6504';
UPDATE kabupaten SET code = 'TMP~7107' WHERE code = '7107';
UPDATE kabupaten SET code = 'TMP~7108' WHERE code = '7108';
UPDATE kabupaten SET code = 'TMP~7109' WHERE code = '7109';
UPDATE kabupaten SET code = 'TMP~7110' WHERE code = '7110';
UPDATE kabupaten SET code = 'TMP~7111' WHERE code = '7111';
UPDATE kabupaten SET code = 'TMP~7201' WHERE code = '7201';
UPDATE kabupaten SET code = 'TMP~7202' WHERE code = '7202';
UPDATE kabupaten SET code = 'TMP~7203' WHERE code = '7203';
UPDATE kabupaten SET code = 'TMP~7204' WHERE code = '7204';
UPDATE kabupaten SET code = 'TMP~7205' WHERE code = '7205';
UPDATE kabupaten SET code = 'TMP~7206' WHERE code = '7206';
UPDATE kabupaten SET code = 'TMP~7207' WHERE code = '7207';
UPDATE kabupaten SET code = 'TMP~7308' WHERE code = '7308';
UPDATE kabupaten SET code = 'TMP~7309' WHERE code = '7309';
UPDATE kabupaten SET code = 'TMP~7310' WHERE code = '7310';
UPDATE kabupaten SET code = 'TMP~7311' WHERE code = '7311';
UPDATE kabupaten SET code = 'TMP~7325' WHERE code = '7325';
UPDATE kabupaten SET code = 'TMP~7401' WHERE code = '7401';
UPDATE kabupaten SET code = 'TMP~7402' WHERE code = '7402';
UPDATE kabupaten SET code = 'TMP~7403' WHERE code = '7403';
UPDATE kabupaten SET code = 'TMP~7404' WHERE code = '7404';
UPDATE kabupaten SET code = 'TMP~7409' WHERE code = '7409';
UPDATE kabupaten SET code = 'TMP~7410' WHERE code = '7410';
UPDATE kabupaten SET code = 'TMP~7501' WHERE code = '7501';
UPDATE kabupaten SET code = 'TMP~7502' WHERE code = '7502';
UPDATE kabupaten SET code = 'TMP~7503' WHERE code = '7503';
UPDATE kabupaten SET code = 'TMP~7504' WHERE code = '7504';
UPDATE kabupaten SET code = 'TMP~7601' WHERE code = '7601';
UPDATE kabupaten SET code = 'TMP~7602' WHERE code = '7602';
UPDATE kabupaten SET code = 'TMP~7604' WHERE code = '7604';
UPDATE kabupaten SET code = 'TMP~7605' WHERE code = '7605';
UPDATE kabupaten SET code = 'TMP~8101' WHERE code = '8101';
UPDATE kabupaten SET code = 'TMP~8103' WHERE code = '8103';
UPDATE kabupaten SET code = 'TMP~8105' WHERE code = '8105';
UPDATE kabupaten SET code = 'TMP~8107' WHERE code = '8107';
UPDATE kabupaten SET code = 'TMP~8203' WHERE code = '8203';
UPDATE kabupaten SET code = 'TMP~8205' WHERE code = '8205';
UPDATE kabupaten SET code = 'TMP~9101' WHERE code = '9101';
UPDATE kabupaten SET code = 'TMP~9102' WHERE code = '9102';
UPDATE kabupaten SET code = 'TMP~9103' WHERE code = '9103';
UPDATE kabupaten SET code = 'TMP~9104' WHERE code = '9104';
UPDATE kabupaten SET code = 'TMP~9105' WHERE code = '9105';
UPDATE kabupaten SET code = 'TMP~9106' WHERE code = '9106';
UPDATE kabupaten SET code = 'TMP~9107' WHERE code = '9107';
UPDATE kabupaten SET code = 'TMP~9108' WHERE code = '9108';
UPDATE kabupaten SET code = 'TMP~9109' WHERE code = '9109';
UPDATE kabupaten SET code = 'TMP~9110' WHERE code = '9110';
UPDATE kabupaten SET code = 'TMP~9111' WHERE code = '9111';
UPDATE kabupaten SET code = 'TMP~9112' WHERE code = '9112';
UPDATE kabupaten SET code = 'TMP~9171' WHERE code = '9171';
UPDATE kabupaten SET code = 'TMP~9401' WHERE code = '9401';
UPDATE kabupaten SET code = 'TMP~9402' WHERE code = '9402';
UPDATE kabupaten SET code = 'TMP~9403' WHERE code = '9403';
UPDATE kabupaten SET code = 'TMP~9404' WHERE code = '9404';
UPDATE kabupaten SET code = 'TMP~9408' WHERE code = '9408';
UPDATE kabupaten SET code = 'TMP~9409' WHERE code = '9409';
UPDATE kabupaten SET code = 'TMP~9410' WHERE code = '9410';
UPDATE kabupaten SET code = 'TMP~9411' WHERE code = '9411';
UPDATE kabupaten SET code = 'TMP~9412' WHERE code = '9412';
UPDATE kabupaten SET code = 'TMP~9413' WHERE code = '9413';
UPDATE kabupaten SET code = 'TMP~9414' WHERE code = '9414';
UPDATE kabupaten SET code = 'TMP~9415' WHERE code = '9415';
UPDATE kabupaten SET code = 'TMP~9416' WHERE code = '9416';
UPDATE kabupaten SET code = 'TMP~9417' WHERE code = '9417';
UPDATE kabupaten SET code = 'TMP~9418' WHERE code = '9418';
UPDATE kabupaten SET code = 'TMP~9419' WHERE code = '9419';
UPDATE kabupaten SET code = 'TMP~9420' WHERE code = '9420';
UPDATE kabupaten SET code = 'TMP~9426' WHERE code = '9426';
UPDATE kabupaten SET code = 'TMP~9427' WHERE code = '9427';
UPDATE kabupaten SET code = 'TMP~9428' WHERE code = '9428';
UPDATE kabupaten SET code = 'TMP~9429' WHERE code = '9429';
UPDATE kabupaten SET code = 'TMP~9430' WHERE code = '9430';
UPDATE kabupaten SET code = 'TMP~9431' WHERE code = '9431';
UPDATE kabupaten SET code = 'TMP~9432' WHERE code = '9432';
UPDATE kabupaten SET code = 'TMP~9433' WHERE code = '9433';
UPDATE kabupaten SET code = 'TMP~9434' WHERE code = '9434';
UPDATE kabupaten SET code = 'TMP~9435' WHERE code = '9435';
UPDATE kabupaten SET code = 'TMP~9436' WHERE code = '9436';
UPDATE kabupaten SET code = 'TMP~9471' WHERE code = '9471';

-- phase 2: assign official codes + province labels
UPDATE kabupaten SET code = '1109', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1101';  -- Simeulue
UPDATE kabupaten SET code = '1110', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1102';  -- Aceh Singkil
UPDATE kabupaten SET code = '1101', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1103';  -- Aceh Selatan
UPDATE kabupaten SET code = '1102', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1104';  -- Aceh Tenggara
UPDATE kabupaten SET code = '1103', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1105';  -- Aceh Timur
UPDATE kabupaten SET code = '1104', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1106';  -- Aceh Tengah
UPDATE kabupaten SET code = '1105', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1107';  -- Aceh Barat
UPDATE kabupaten SET code = '1106', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1108';  -- Aceh Besar
UPDATE kabupaten SET code = '1107', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1109';  -- Pidie
UPDATE kabupaten SET code = '1111', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1110';  -- Bireuen
UPDATE kabupaten SET code = '1108', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1111';  -- Aceh Utara
UPDATE kabupaten SET code = '1116', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1114';  -- Aceh Tamiang
UPDATE kabupaten SET code = '1114', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1116';  -- Aceh Jaya
UPDATE kabupaten SET code = '1174', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1173';  -- Langsa
UPDATE kabupaten SET code = '1173', province_code = '11', province = 'Aceh' WHERE code = 'TMP~1174';  -- Lhokseumawe
UPDATE kabupaten SET code = '1204', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1201';  -- Nias
UPDATE kabupaten SET code = '1213', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1202';  -- Mandailing Natal
UPDATE kabupaten SET code = '1201', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1204';  -- Tapanuli Tengah
UPDATE kabupaten SET code = '1202', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1205';  -- Tapanuli Utara
UPDATE kabupaten SET code = '1212', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1206';  -- Toba Samosir
UPDATE kabupaten SET code = '1210', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1207';  -- Labuhan Batu
UPDATE kabupaten SET code = '1209', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1208';  -- Asahan
UPDATE kabupaten SET code = '1208', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1209';  -- Simalungun
UPDATE kabupaten SET code = '1211', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1210';  -- Dairi
UPDATE kabupaten SET code = '1206', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1211';  -- Karo
UPDATE kabupaten SET code = '1207', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1212';  -- Deli Serdang
UPDATE kabupaten SET code = '1205', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1213';  -- Langkat
UPDATE kabupaten SET code = '1216', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1215';  -- Humbang Hasundutan
UPDATE kabupaten SET code = '1215', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1216';  -- Pakpak Bharat
UPDATE kabupaten SET code = '1273', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1271';  -- Sibolga
UPDATE kabupaten SET code = '1274', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1272';  -- Tanjung Balai
UPDATE kabupaten SET code = '1272', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1273';  -- Pematang Siantar
UPDATE kabupaten SET code = '1276', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1274';  -- Tebing Tinggi
UPDATE kabupaten SET code = '1271', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1275';  -- Medan
UPDATE kabupaten SET code = '1275', province_code = '12', province = 'Sumatera Utara' WHERE code = 'TMP~1276';  -- Binjai
UPDATE kabupaten SET code = '1309', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1301';  -- Kepulauan Mentawai
UPDATE kabupaten SET code = '1301', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1302';  -- Pesisir Selatan
UPDATE kabupaten SET code = '1302', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1303';  -- Solok
UPDATE kabupaten SET code = '1303', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1304';  -- Sijunjung
UPDATE kabupaten SET code = '1304', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1305';  -- Tanah Datar
UPDATE kabupaten SET code = '1305', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1306';  -- Padang Pariaman
UPDATE kabupaten SET code = '1306', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1307';  -- Agam
UPDATE kabupaten SET code = '1307', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1308';  -- Lima Puluh Kota
UPDATE kabupaten SET code = '1308', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1309';  -- Pasaman
UPDATE kabupaten SET code = '1311', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1310';  -- Solok Selatan
UPDATE kabupaten SET code = '1310', province_code = '13', province = 'Sumatera Barat' WHERE code = 'TMP~1311';  -- Dharmasraya
UPDATE kabupaten SET code = '1409', province_code = '14', province = 'Riau' WHERE code = 'TMP~1401';  -- Kuantan Singingi
UPDATE kabupaten SET code = '1404', province_code = '14', province = 'Riau' WHERE code = 'TMP~1403';  -- Indragiri Hilir
UPDATE kabupaten SET code = '1405', province_code = '14', province = 'Riau' WHERE code = 'TMP~1404';  -- Pelalawan
UPDATE kabupaten SET code = '1408', province_code = '14', province = 'Riau' WHERE code = 'TMP~1405';  -- S I A K
UPDATE kabupaten SET code = '1401', province_code = '14', province = 'Riau' WHERE code = 'TMP~1406';  -- Kampar
UPDATE kabupaten SET code = '1406', province_code = '14', province = 'Riau' WHERE code = 'TMP~1407';  -- Rokan Hulu
UPDATE kabupaten SET code = '1403', province_code = '14', province = 'Riau' WHERE code = 'TMP~1408';  -- Bengkalis
UPDATE kabupaten SET code = '1407', province_code = '14', province = 'Riau' WHERE code = 'TMP~1409';  -- Rokan Hilir
UPDATE kabupaten SET code = '1472', province_code = '14', province = 'Riau' WHERE code = 'TMP~1473';  -- D U M A I
UPDATE kabupaten SET code = '1507', province_code = '15', province = 'Jambi' WHERE code = 'TMP~1506';  -- Tanjung Jabung Timur
UPDATE kabupaten SET code = '1506', province_code = '15', province = 'Jambi' WHERE code = 'TMP~1507';  -- Tanjung Jabung Barat
UPDATE kabupaten SET code = '1509', province_code = '15', province = 'Jambi' WHERE code = 'TMP~1508';  -- Tebo
UPDATE kabupaten SET code = '1508', province_code = '15', province = 'Jambi' WHERE code = 'TMP~1509';  -- Bungo
UPDATE kabupaten SET code = '1609', province_code = '16', province = 'Sumatera Selatan' WHERE code = 'TMP~1608';  -- Ogan Komering Ulu Selatan
UPDATE kabupaten SET code = '1608', province_code = '16', province = 'Sumatera Selatan' WHERE code = 'TMP~1609';  -- Ogan Komering Ulu Timur
UPDATE kabupaten SET code = '1674', province_code = '16', province = 'Sumatera Selatan' WHERE code = 'TMP~1672';  -- Prabumulih
UPDATE kabupaten SET code = '1672', province_code = '16', province = 'Sumatera Selatan' WHERE code = 'TMP~1673';  -- Pagar Alam
UPDATE kabupaten SET code = '1673', province_code = '16', province = 'Sumatera Selatan' WHERE code = 'TMP~1674';  -- Lubuklinggau
UPDATE kabupaten SET code = '1804', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1801';  -- Lampung Barat
UPDATE kabupaten SET code = '1806', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1802';  -- Tanggamus
UPDATE kabupaten SET code = '1801', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1803';  -- Lampung Selatan
UPDATE kabupaten SET code = '1807', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1804';  -- Lampung Timur
UPDATE kabupaten SET code = '1802', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1805';  -- Lampung Tengah
UPDATE kabupaten SET code = '1803', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1806';  -- Lampung Utara
UPDATE kabupaten SET code = '1808', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1807';  -- Way Kanan
UPDATE kabupaten SET code = '1805', province_code = '18', province = 'Lampung' WHERE code = 'TMP~1808';  -- Tulangbawang
UPDATE kabupaten SET code = '1905', province_code = '19', province = 'Kepulauan Bangka Belitung' WHERE code = 'TMP~1903';  -- Bangka Barat
UPDATE kabupaten SET code = '1903', province_code = '19', province = 'Kepulauan Bangka Belitung' WHERE code = 'TMP~1905';  -- Bangka Selatan
UPDATE kabupaten SET code = '2102', province_code = '21', province = 'Kepulauan Riau' WHERE code = 'TMP~2101';  -- Karimun
UPDATE kabupaten SET code = '2101', province_code = '21', province = 'Kepulauan Riau' WHERE code = 'TMP~2102';  -- Bintan
UPDATE kabupaten SET code = '3101', province_code = '31', province = 'Daerah Khusus Ibukota Jakarta' WHERE code = 'TMP~3171';  -- Kepulauan Seribu
UPDATE kabupaten SET code = '3174', province_code = '31', province = 'Daerah Khusus Ibukota Jakarta' WHERE code = 'TMP~3172';  -- Jakarta Selatan
UPDATE kabupaten SET code = '3175', province_code = '31', province = 'Daerah Khusus Ibukota Jakarta' WHERE code = 'TMP~3173';  -- Jakarta Timur
UPDATE kabupaten SET code = '3171', province_code = '31', province = 'Daerah Khusus Ibukota Jakarta' WHERE code = 'TMP~3174';  -- Jakarta Pusat
UPDATE kabupaten SET code = '3173', province_code = '31', province = 'Daerah Khusus Ibukota Jakarta' WHERE code = 'TMP~3175';  -- Jakarta Barat
UPDATE kabupaten SET code = '3172', province_code = '31', province = 'Daerah Khusus Ibukota Jakarta' WHERE code = 'TMP~3176';  -- Jakarta Utara
UPDATE kabupaten SET code = '3673', province_code = '36', province = 'Banten' WHERE code = 'TMP~3674';  -- Serang
UPDATE kabupaten SET code = '3674', province_code = '36', province = 'Banten' WHERE code = 'TMP~3676';  -- Tangerang Selatan
UPDATE kabupaten SET code = '5312', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5301';  -- Sumba Barat
UPDATE kabupaten SET code = '5311', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5302';  -- Sumba Timur
UPDATE kabupaten SET code = '5301', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5303';  -- Kupang
UPDATE kabupaten SET code = '5302', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5304';  -- Timor Tengah Selatan
UPDATE kabupaten SET code = '5303', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5305';  -- Timor Tengah Utara
UPDATE kabupaten SET code = '5304', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5306';  -- Belu
UPDATE kabupaten SET code = '5305', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5307';  -- Alor
UPDATE kabupaten SET code = '5313', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5308';  -- Lembata
UPDATE kabupaten SET code = '5306', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5309';  -- Flores Timur
UPDATE kabupaten SET code = '5307', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5310';  -- Sikka
UPDATE kabupaten SET code = '5308', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5311';  -- Ende
UPDATE kabupaten SET code = '5309', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5312';  -- Ngada
UPDATE kabupaten SET code = '5310', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5313';  -- Manggarai
UPDATE kabupaten SET code = '5317', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5316';  -- Sumba Tengah
UPDATE kabupaten SET code = '5318', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5317';  -- Sumba Barat Daya
UPDATE kabupaten SET code = '5316', province_code = '53', province = 'Nusa Tenggara Timur' WHERE code = 'TMP~5318';  -- Nagekeo
UPDATE kabupaten SET code = '6107', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6102';  -- Bengkayang
UPDATE kabupaten SET code = '6108', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6103';  -- Landak
UPDATE kabupaten SET code = '6102', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6104';  -- Mempawah
UPDATE kabupaten SET code = '6103', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6105';  -- Sanggau
UPDATE kabupaten SET code = '6104', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6106';  -- Ketapang
UPDATE kabupaten SET code = '6105', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6107';  -- Sintang
UPDATE kabupaten SET code = '6106', province_code = '61', province = 'Kalimantan Barat' WHERE code = 'TMP~6108';  -- Kapuas Hulu
UPDATE kabupaten SET code = '6208', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6206';  -- Sukamara
UPDATE kabupaten SET code = '6209', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6207';  -- Lamandau
UPDATE kabupaten SET code = '6207', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6208';  -- Seruyan
UPDATE kabupaten SET code = '6206', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6209';  -- Katingan
UPDATE kabupaten SET code = '6211', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6210';  -- Pulang Pisau
UPDATE kabupaten SET code = '6210', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6211';  -- Gunung Mas
UPDATE kabupaten SET code = '6213', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6212';  -- Barito Timur
UPDATE kabupaten SET code = '6212', province_code = '62', province = 'Kalimantan Tengah' WHERE code = 'TMP~6213';  -- Murung Raya
UPDATE kabupaten SET code = '6407', province_code = '64', province = 'Kalimantan Timur' WHERE code = 'TMP~6402';  -- Kutai Barat
UPDATE kabupaten SET code = '6402', province_code = '64', province = 'Kalimantan Timur' WHERE code = 'TMP~6403';  -- Kutai Kartanegara
UPDATE kabupaten SET code = '6408', province_code = '64', province = 'Kalimantan Timur' WHERE code = 'TMP~6404';  -- Kutai Timur
UPDATE kabupaten SET code = '6403', province_code = '64', province = 'Kalimantan Timur' WHERE code = 'TMP~6405';  -- Berau
UPDATE kabupaten SET code = '6502', province_code = '65', province = 'Kalimantan Utara' WHERE code = 'TMP~6501';  -- Malinau
UPDATE kabupaten SET code = '6501', province_code = '65', province = 'Kalimantan Utara' WHERE code = 'TMP~6502';  -- Bulungan
UPDATE kabupaten SET code = '6504', province_code = '65', province = 'Kalimantan Utara' WHERE code = 'TMP~6503';  -- Tana Tidung
UPDATE kabupaten SET code = '6503', province_code = '65', province = 'Kalimantan Utara' WHERE code = 'TMP~6504';  -- Nunukan
UPDATE kabupaten SET code = '7108', province_code = '71', province = 'Sulawesi Utara' WHERE code = 'TMP~7107';  -- Bolaang Mongondow Utara
UPDATE kabupaten SET code = '7109', province_code = '71', province = 'Sulawesi Utara' WHERE code = 'TMP~7108';  -- Siau Tagulandang Biaro
UPDATE kabupaten SET code = '7107', province_code = '71', province = 'Sulawesi Utara' WHERE code = 'TMP~7109';  -- Minahasa Tenggara
UPDATE kabupaten SET code = '7111', province_code = '71', province = 'Sulawesi Utara' WHERE code = 'TMP~7110';  -- Bolaang Mongondow Selatan
UPDATE kabupaten SET code = '7110', province_code = '71', province = 'Sulawesi Utara' WHERE code = 'TMP~7111';  -- Bolaang Mongondow Timur
UPDATE kabupaten SET code = '7207', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7201';  -- Banggai Kepulauan
UPDATE kabupaten SET code = '7201', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7202';  -- Banggai
UPDATE kabupaten SET code = '7206', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7203';  -- Morowali
UPDATE kabupaten SET code = '7202', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7204';  -- Poso
UPDATE kabupaten SET code = '7203', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7205';  -- Donggala
UPDATE kabupaten SET code = '7204', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7206';  -- Toli-Toli
UPDATE kabupaten SET code = '7205', province_code = '72', province = 'Sulawesi Tengah' WHERE code = 'TMP~7207';  -- Buol
UPDATE kabupaten SET code = '7309', province_code = '73', province = 'Sulawesi Selatan' WHERE code = 'TMP~7308';  -- Maros
UPDATE kabupaten SET code = '7310', province_code = '73', province = 'Sulawesi Selatan' WHERE code = 'TMP~7309';  -- Pangkajene Dan Kepulauan
UPDATE kabupaten SET code = '7311', province_code = '73', province = 'Sulawesi Selatan' WHERE code = 'TMP~7310';  -- Barru
UPDATE kabupaten SET code = '7308', province_code = '73', province = 'Sulawesi Selatan' WHERE code = 'TMP~7311';  -- Bone
UPDATE kabupaten SET code = '7324', province_code = '73', province = 'Sulawesi Selatan' WHERE code = 'TMP~7325';  -- Luwu Timur
UPDATE kabupaten SET code = '7404', province_code = '74', province = 'Sulawesi Tenggara' WHERE code = 'TMP~7401';  -- Buton
UPDATE kabupaten SET code = '7403', province_code = '74', province = 'Sulawesi Tenggara' WHERE code = 'TMP~7402';  -- Muna
UPDATE kabupaten SET code = '7402', province_code = '74', province = 'Sulawesi Tenggara' WHERE code = 'TMP~7403';  -- Konawe
UPDATE kabupaten SET code = '7401', province_code = '74', province = 'Sulawesi Tenggara' WHERE code = 'TMP~7404';  -- Kolaka
UPDATE kabupaten SET code = '7410', province_code = '74', province = 'Sulawesi Tenggara' WHERE code = 'TMP~7409';  -- Buton Utara
UPDATE kabupaten SET code = '7409', province_code = '74', province = 'Sulawesi Tenggara' WHERE code = 'TMP~7410';  -- Konawe Utara
UPDATE kabupaten SET code = '7502', province_code = '75', province = 'Gorontalo' WHERE code = 'TMP~7501';  -- Boalemo
UPDATE kabupaten SET code = '7501', province_code = '75', province = 'Gorontalo' WHERE code = 'TMP~7502';  -- Gorontalo
UPDATE kabupaten SET code = '7504', province_code = '75', province = 'Gorontalo' WHERE code = 'TMP~7503';  -- Pohuwato
UPDATE kabupaten SET code = '7503', province_code = '75', province = 'Gorontalo' WHERE code = 'TMP~7504';  -- Bone Bolango
UPDATE kabupaten SET code = '7605', province_code = '76', province = 'Sulawesi Barat' WHERE code = 'TMP~7601';  -- Majene
UPDATE kabupaten SET code = '7604', province_code = '76', province = 'Sulawesi Barat' WHERE code = 'TMP~7602';  -- Polewali Mandar
UPDATE kabupaten SET code = '7602', province_code = '76', province = 'Sulawesi Barat' WHERE code = 'TMP~7604';  -- Mamuju
UPDATE kabupaten SET code = '7601', province_code = '76', province = 'Sulawesi Barat' WHERE code = 'TMP~7605';  -- Mamuju Utara
UPDATE kabupaten SET code = '8103', province_code = '81', province = 'Maluku' WHERE code = 'TMP~8101';  -- Maluku Tenggara Barat
UPDATE kabupaten SET code = '8101', province_code = '81', province = 'Maluku' WHERE code = 'TMP~8103';  -- Maluku Tengah
UPDATE kabupaten SET code = '8107', province_code = '81', province = 'Maluku' WHERE code = 'TMP~8105';  -- Kepulauan Aru
UPDATE kabupaten SET code = '8105', province_code = '81', province = 'Maluku' WHERE code = 'TMP~8107';  -- Seram Bagian Timur
UPDATE kabupaten SET code = '8205', province_code = '82', province = 'Maluku Utara' WHERE code = 'TMP~8203';  -- Kepulauan Sula
UPDATE kabupaten SET code = '8203', province_code = '82', province = 'Maluku Utara' WHERE code = 'TMP~8205';  -- Halmahera Utara
UPDATE kabupaten SET code = '9203', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9101';  -- Fakfak
UPDATE kabupaten SET code = '9208', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9102';  -- Kaimana
UPDATE kabupaten SET code = '9207', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9103';  -- Teluk Wondama
UPDATE kabupaten SET code = '9206', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9104';  -- Teluk Bintuni
UPDATE kabupaten SET code = '9202', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9105';  -- Manokwari
UPDATE kabupaten SET code = '9602', province_code = '96', province = 'Papua Barat Daya' WHERE code = 'TMP~9106';  -- Sorong Selatan
UPDATE kabupaten SET code = '9601', province_code = '96', province = 'Papua Barat Daya' WHERE code = 'TMP~9107';  -- Sorong
UPDATE kabupaten SET code = '9603', province_code = '96', province = 'Papua Barat Daya' WHERE code = 'TMP~9108';  -- Raja Ampat
UPDATE kabupaten SET code = '9604', province_code = '96', province = 'Papua Barat Daya' WHERE code = 'TMP~9109';  -- Tambrauw
UPDATE kabupaten SET code = '9605', province_code = '96', province = 'Papua Barat Daya' WHERE code = 'TMP~9110';  -- Maybrat
UPDATE kabupaten SET code = '9211', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9111';  -- Manokwari Selatan
UPDATE kabupaten SET code = '9212', province_code = '92', province = 'Papua Barat' WHERE code = 'TMP~9112';  -- Pegunungan Arfak
UPDATE kabupaten SET code = '9671', province_code = '96', province = 'Papua Barat Daya' WHERE code = 'TMP~9171';  -- Sorong
UPDATE kabupaten SET code = '9301', province_code = '93', province = 'Papua Selatan' WHERE code = 'TMP~9401';  -- Merauke
UPDATE kabupaten SET code = '9501', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9402';  -- Jayawijaya
UPDATE kabupaten SET code = '9103', province_code = '91', province = 'Papua' WHERE code = 'TMP~9403';  -- Jayapura
UPDATE kabupaten SET code = '9401', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9404';  -- Nabire
UPDATE kabupaten SET code = '9105', province_code = '91', province = 'Papua' WHERE code = 'TMP~9408';  -- Kepulauan Yapen
UPDATE kabupaten SET code = '9106', province_code = '91', province = 'Papua' WHERE code = 'TMP~9409';  -- Biak Numfor
UPDATE kabupaten SET code = '9403', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9410';  -- Paniai
UPDATE kabupaten SET code = '9402', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9411';  -- Puncak Jaya
UPDATE kabupaten SET code = '9404', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9412';  -- Mimika
UPDATE kabupaten SET code = '9302', province_code = '93', province = 'Papua Selatan' WHERE code = 'TMP~9413';  -- Boven Digoel
UPDATE kabupaten SET code = '9303', province_code = '93', province = 'Papua Selatan' WHERE code = 'TMP~9414';  -- Mappi
UPDATE kabupaten SET code = '9304', province_code = '93', province = 'Papua Selatan' WHERE code = 'TMP~9415';  -- Asmat
UPDATE kabupaten SET code = '9503', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9416';  -- Yahukimo
UPDATE kabupaten SET code = '9502', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9417';  -- Pegunungan Bintang
UPDATE kabupaten SET code = '9504', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9418';  -- Tolikara
UPDATE kabupaten SET code = '9110', province_code = '91', province = 'Papua' WHERE code = 'TMP~9419';  -- Sarmi
UPDATE kabupaten SET code = '9111', province_code = '91', province = 'Papua' WHERE code = 'TMP~9420';  -- Keerom
UPDATE kabupaten SET code = '9115', province_code = '91', province = 'Papua' WHERE code = 'TMP~9426';  -- Waropen
UPDATE kabupaten SET code = '9119', province_code = '91', province = 'Papua' WHERE code = 'TMP~9427';  -- Supiori
UPDATE kabupaten SET code = '9120', province_code = '91', province = 'Papua' WHERE code = 'TMP~9428';  -- Mamberamo Raya
UPDATE kabupaten SET code = '9508', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9429';  -- Nduga
UPDATE kabupaten SET code = '9507', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9430';  -- Lanny Jaya
UPDATE kabupaten SET code = '9505', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9431';  -- Mamberamo Tengah
UPDATE kabupaten SET code = '9506', province_code = '95', province = 'Papua Pegunungan' WHERE code = 'TMP~9432';  -- Yalimo
UPDATE kabupaten SET code = '9405', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9433';  -- Puncak
UPDATE kabupaten SET code = '9406', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9434';  -- Dogiyai
UPDATE kabupaten SET code = '9407', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9435';  -- Intan Jaya
UPDATE kabupaten SET code = '9408', province_code = '94', province = 'Papua Tengah' WHERE code = 'TMP~9436';  -- Deiyai
UPDATE kabupaten SET code = '9171', province_code = '91', province = 'Papua' WHERE code = 'TMP~9471';  -- Jayapura

COMMIT;
