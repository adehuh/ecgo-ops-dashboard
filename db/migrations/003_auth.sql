-- 003_auth.sql — pengguna, ruang lingkup cabang, dan sesi.
--
-- Dibangun mengikuti bentuk yang saya usulkan di jawaban C2: pengenal ruang
-- lingkup TIDAK PERNAH datang dari client. Cabang yang boleh dilihat seseorang
-- adalah fakta yang tersimpan di sini, dan setiap query melakukan join ke sini.

CREATE TYPE user_role AS ENUM ('ADMIN', 'SUPERVISOR');

CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,
  name          text NOT NULL,

  -- Format berlabel: "scrypt$N$r$p$salt$key". Parameter ikut disimpan bersama
  -- hash-nya supaya biaya KDF bisa dinaikkan nanti tanpa membatalkan password
  -- yang sudah ada — hash lama tetap terverifikasi dengan parameter lamanya.
  password_hash text NOT NULL,

  role          user_role NOT NULL DEFAULT 'SUPERVISOR',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Unik pada lower(email): "Ade@ecgo.test" dan "ade@ecgo.test" adalah orang yang
-- sama, dan membiarkan keduanya terdaftar adalah cara membuat dua akun untuk
-- satu manusia tanpa ada yang menyadarinya.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- Ruang lingkup cabang. Baris di sini HANYA berlaku untuk SUPERVISOR; ADMIN
-- melihat seluruh armada dan sengaja tidak diberi baris apa pun, supaya tidak
-- ada dua sumber kebenaran yang bisa berselisih saat cabang baru dibuka.
CREATE TABLE user_branches (
  user_id   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE sessions (
  -- Yang disimpan adalah SHA-256 dari token, bukan tokennya.
  --
  -- Token sesi setara password selama masa berlakunya. Kalau tabel ini bocor —
  -- lewat backup, log query, atau SQL injection di tempat lain — penyerang yang
  -- memegang hash tidak bisa membalikkannya menjadi cookie yang sah. SHA-256
  -- tanpa salt sudah cukup di sini justru karena tokennya 256 bit acak: tidak
  -- ada yang bisa ditebak lewat rainbow table atau brute force.
  token_hash text PRIMARY KEY,

  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  -- Konteks untuk audit; tidak pernah dipakai sebagai kontrol keamanan, karena
  -- keduanya dikendalikan client dan sepele dipalsukan.
  user_agent text,
  ip         inet
);

-- Untuk "keluarkan semua sesi milik pengguna ini" saat password diubah atau
-- akun dinonaktifkan.
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Untuk membersihkan sesi kedaluwarsa.
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

COMMENT ON TABLE user_branches IS
  'Ruang lingkup cabang untuk SUPERVISOR. ADMIN tidak punya baris di sini dan melihat semuanya.';
COMMENT ON COLUMN sessions.token_hash IS
  'SHA-256 dari token sesi. Token mentahnya hanya pernah ada di cookie milik pengguna.';
