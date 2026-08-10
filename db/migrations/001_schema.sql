-- 001_schema.sql — Battery Swap Monitoring, tabel inti.
--
-- Catatan desain:
--  * Semua kolom waktu `timestamptz`. Menyimpan waktu lokal tanpa offset adalah
--    cara paling umum kehilangan satu jam data dua kali setahun; Indonesia
--    memang tidak punya DST, tapi kolomnya juga tidak boleh mengasumsikan itu.
--  * Status dan state dibuat ENUM, bukan text. Nilai di luar daftar akan ditolak
--    oleh database, bukan hanya oleh Zod di lapisan aplikasi.
--  * Invarian yang bisa dinyatakan sebagai CHECK ditulis sebagai CHECK. Kalau
--    aturannya hanya hidup di kode aplikasi, satu skrip perbaikan manual sudah
--    cukup untuk merusaknya diam-diam.

CREATE TYPE cabinet_status AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');
CREATE TYPE slot_state AS ENUM ('EMPTY', 'CHARGING', 'FULL', 'LOCKED', 'FAULT');
CREATE TYPE swap_status AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE branches (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  city       text NOT NULL,
  -- Dipakai bersama Bagian B: cabang punya geofence.
  lat        double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  radius_m   integer NOT NULL DEFAULT 150 CHECK (radius_m > 0),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cabinets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  branch_id  bigint NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  status     cabinet_status NOT NULL DEFAULT 'ONLINE',

  -- Jumlah slot disimpan per cabinet, tidak dihardcode 12 di UI. Soal memakai
  -- 12, tapi ECGO memasang model 8 dan 16 slot juga; grid merender angka ini.
  slot_count smallint NOT NULL DEFAULT 12 CHECK (slot_count BETWEEN 1 AND 48),

  -- NULL berarti "belum pernah melapor" (baru dipasang), BUKAN "basi tak
  -- terhingga". Dua keadaan itu dibedakan di seluruh query dan UI.
  last_heartbeat_at timestamptz,

  installed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE slots (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cabinet_id bigint NOT NULL REFERENCES cabinets (id) ON DELETE CASCADE,
  slot_no    smallint NOT NULL CHECK (slot_no >= 1),
  state      slot_state NOT NULL DEFAULT 'EMPTY',
  battery_id text,
  soc        smallint CHECK (soc BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT slots_unique_position UNIQUE (cabinet_id, slot_no),

  -- SOC hanya punya arti kalau ada baterainya. Tanpa CHECK ini, slot kosong bisa
  -- tersimpan sebagai 0% dan UI akan melaporkan "baterai habis" untuk lubang
  -- yang sebenarnya kosong — dua kondisi yang butuh tindakan ops berbeda.
  CONSTRAINT slots_soc_requires_battery CHECK (
    (battery_id IS NULL AND soc IS NULL) OR (battery_id IS NOT NULL AND soc IS NOT NULL)
  ),

  -- Slot EMPTY, menurut definisi, tidak memegang baterai.
  CONSTRAINT slots_empty_holds_nothing CHECK (state <> 'EMPTY' OR battery_id IS NULL)
);

CREATE TABLE swap_transactions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cabinet_id  bigint NOT NULL REFERENCES cabinets (id) ON DELETE CASCADE,
  slot_no     smallint NOT NULL CHECK (slot_no >= 1),

  -- Referensi rider yang buram, bukan identitas. Dashboard ops tidak butuh nama
  -- atau nomor telepon untuk memantau cabinet, jadi tidak disimpan di sini.
  rider_ref   text NOT NULL,

  occurred_at timestamptz NOT NULL,
  soc_in      smallint NOT NULL CHECK (soc_in BETWEEN 0 AND 100),
  soc_out     smallint NOT NULL CHECK (soc_out BETWEEN 0 AND 100),
  duration_s  integer NOT NULL CHECK (duration_s >= 0),
  status      swap_status NOT NULL DEFAULT 'SUCCESS'
);

COMMENT ON COLUMN cabinets.last_heartbeat_at IS
  'NULL = cabinet belum pernah mengirim heartbeat (baru dipasang). Diurutkan NULLS LAST.';
COMMENT ON COLUMN swap_transactions.soc_in IS
  'SOC baterai kosong yang dimasukkan rider.';
COMMENT ON COLUMN swap_transactions.soc_out IS
  'SOC baterai terisi yang dibawa pergi rider.';
