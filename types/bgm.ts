/** タグ一覧 */
export const BGM_TAGS = [
  "ALL",
  "雑談・Chill",
  "アップテンポ・Pop",
  "シネマティック・壮大",
  "ローファイ・BPM低め",
] as const;

export type BgmTag = (typeof BGM_TAGS)[number];

/** /api/next-track レスポンス */
export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
}

/** プレイヤーの再生状態 */
export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";
