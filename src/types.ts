// ============================================================
// おまかせBGM - 型定義
// ============================================================

/**
 * Cloudflare Workers の環境変数・バインディング定義
 */
export interface Env {
  /** D1 データベース */
  DB: D1Database;
  /** R2 バケット */
  BGM_BUCKET: R2Bucket;
  /** 許可するフロントエンドのオリジン（wrangler.toml の vars で設定） */
  ALLOWED_ORIGIN: string;
}

/**
 * D1 の tracks テーブルの行型
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  r2_key: string;
  tags: string;
  created_at: string;
}

/**
 * /api/next-track のレスポンス型
 */
export interface NextTrackResponse {
  id: string;
  title: string;
  artist: string;
  url: string;
}

/**
 * エラーレスポンス型
 */
export interface ErrorResponse {
  error: string;
}
