-- 002_indexes.sql
--
-- Tiap index di sini dibuat untuk satu query nyata di aplikasi. Index yang tidak
-- bisa saya sebutkan query pemakainya tidak saya buat: index bukan gratis, ia
-- memperlambat setiap INSERT — dan tabel swap ini yang paling sering di-INSERT.

-- Dipakai oleh DUA hal sekaligus:
--   1. agregasi "swap 24 jam terakhir" per cabinet (halaman daftar)
--   2. "20 transaksi terakhir di cabinet ini" (halaman detail)
-- Urutan kolomnya penting: cabinet_id di depan untuk equality, occurred_at DESC
-- di belakang supaya Postgres bisa membaca urut mundur tanpa langkah sort.
CREATE INDEX swap_tx_cabinet_time_idx
  ON swap_transactions (cabinet_id, occurred_at DESC);

-- Untuk memotong window 24 jam lebih dulu ketika agregat dihitung untuk SEMUA
-- cabinet dalam satu query. Tanpa ini, agregasinya harus menyapu seluruh
-- 30 hari data (~22.000 baris sekarang, jutaan dalam produksi).
CREATE INDEX swap_tx_time_idx
  ON swap_transactions (occurred_at DESC);

CREATE INDEX cabinets_branch_idx ON cabinets (branch_id);

-- Sortir daftar. NULLS LAST cocok dengan urutan yang dipakai query supaya
-- cabinet yang belum pernah melapor tidak menumpuk di puncak daftar.
CREATE INDEX cabinets_heartbeat_idx ON cabinets (last_heartbeat_at DESC NULLS LAST);
CREATE INDEX cabinets_status_idx ON cabinets (status);

-- Pencarian server-side memakai ILIKE '%q%'. Wildcard di depan membuat B-tree
-- biasa tidak terpakai sama sekali, jadi Postgres akan seq-scan. Trigram GIN
-- adalah index yang memang bisa melayani pola berawalan wildcard.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX cabinets_code_trgm_idx ON cabinets USING gin (code gin_trgm_ops);
CREATE INDEX branches_name_trgm_idx ON branches USING gin (name gin_trgm_ops);
CREATE INDEX branches_code_trgm_idx ON branches USING gin (code gin_trgm_ops);

-- Catatan: slots (cabinet_id, slot_no) TIDAK diberi index terpisah. Constraint
-- UNIQUE slots_unique_position sudah membuat index B-tree dengan kolom dan
-- urutan yang persis sama; menambah satu lagi hanya menggandakan biaya tulis.
