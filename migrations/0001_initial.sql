-- ============================================================
-- おまかせBGM - D1 マイグレーション
-- ============================================================

-- tracks テーブルの作成
CREATE TABLE IF NOT EXISTS tracks (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  artist     TEXT NOT NULL,
  r2_key     TEXT NOT NULL,
  tags       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- インデックス（タグ検索の高速化）
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON tracks(tags);

-- ============================================================
-- テストデータ（各タグが散りばめられた8件）
-- ============================================================

INSERT INTO tracks (id, title, artist, r2_key, tags) VALUES
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Midnight Coffee',
    'Lo-Fi Studio',
    'music/midnight_coffee.mp3',
    'ALL,雑談・Chill,ローファイ・BPM低め'
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Summer Breeze Pop',
    'Pixel Beats',
    'music/summer_breeze_pop.mp3',
    'ALL,アップテンポ・Pop'
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Epic Horizon',
    'Cinematic Waves',
    'music/epic_horizon.mp3',
    'ALL,シネマティック・壮大'
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Rainy Afternoon',
    'Chill House',
    'music/rainy_afternoon.mp3',
    'ALL,雑談・Chill,ローファイ・BPM低め'
  ),
  (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'Neon Runner',
    'Synthwave Collective',
    'music/neon_runner.mp3',
    'ALL,アップテンポ・Pop'
  ),
  (
    'a1b2c3d4-0006-4000-8000-000000000006',
    'Galaxy Odyssey',
    'Orbital Composer',
    'music/galaxy_odyssey.mp3',
    'ALL,シネマティック・壮大'
  ),
  (
    'a1b2c3d4-0007-4000-8000-000000000007',
    'Lazy Sunday',
    'Lo-Fi Studio',
    'music/lazy_sunday.mp3',
    'ALL,雑談・Chill,ローファイ・BPM低め'
  ),
  (
    'a1b2c3d4-0008-4000-8000-000000000008',
    'City Pop Groove',
    'Retro Future',
    'music/city_pop_groove.mp3',
    'ALL,アップテンポ・Pop,雑談・Chill'
  );
