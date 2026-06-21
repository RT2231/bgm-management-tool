// ============================================================
// おまかせBGM - Cloudflare Workers メインコード
// ============================================================

import type { Env, Track, NextTrackResponse, ErrorResponse } from "./types";

// ------------------------------------------------------------
// CORS ヘルパー
// ------------------------------------------------------------

/**
 * CORS レスポンスヘッダーを生成する
 */
function buildCorsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range",
  };
}

/**
 * OPTIONS プリフライトリクエストへのレスポンスを返す
 */
function handleOptions(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

// ------------------------------------------------------------
// JSON レスポンスヘルパー
// ------------------------------------------------------------

function jsonResponse(
  body: NextTrackResponse | ErrorResponse,
  status: number,
  corsHeaders: HeadersInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

// ------------------------------------------------------------
// ルーティング
// ------------------------------------------------------------

/**
 * GET /api/next-track
 * クエリパラメータ tag に合致する楽曲をランダムに1件返す
 */
async function handleNextTrack(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const origin = env.ALLOWED_ORIGIN ?? "*";
  const corsHeaders = buildCorsHeaders(origin);

  const tag = url.searchParams.get("tag");

  let query: string;
  let params: string[];

  if (!tag || tag === "ALL") {
    // タグ指定なし、または ALL → 全楽曲からランダム
    query = "SELECT * FROM tracks ORDER BY RANDOM() LIMIT 1";
    params = [];
  } else {
    // 指定タグを含む楽曲からランダム（LIKE 検索）
    query =
      "SELECT * FROM tracks WHERE tags LIKE ? ORDER BY RANDOM() LIMIT 1";
    params = [`%${tag}%`];
  }

  let track: Track | null = null;
  try {
    const result = await env.DB.prepare(query)
      .bind(...params)
      .first<Track>();
    track = result ?? null;
  } catch (err) {
    console.error("[BGM Worker] D1 query error:", err);
    return jsonResponse({ error: "Database error" }, 500, corsHeaders);
  }

  if (!track) {
    return jsonResponse(
      { error: "No tracks found for the specified tag" },
      404,
      corsHeaders
    );
  }

  // /api/stream?key=<r2_key> の URL を組み立てる
  const streamUrl = `${url.origin}/api/stream?key=${encodeURIComponent(
    track.r2_key
  )}`;

  const responseBody: NextTrackResponse = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    url: streamUrl,
  };

  return jsonResponse(responseBody, 200, corsHeaders);
}

/**
 * GET /api/stream?key=<r2_key>
 * R2 から音声ファイルをストリーミング返却する
 */
async function handleStream(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const origin = env.ALLOWED_ORIGIN ?? "*";
  const corsHeaders = buildCorsHeaders(origin);

  const key = url.searchParams.get("key");

  if (!key) {
    return jsonResponse({ error: "Missing 'key' parameter" }, 400, corsHeaders);
  }

  let object: R2ObjectBody | null = null;
  try {
    object = await env.BGM_BUCKET.get(key);
  } catch (err) {
    console.error("[BGM Worker] R2 get error:", err);
    return jsonResponse({ error: "Storage error" }, 500, corsHeaders);
  }

  if (!object) {
    return jsonResponse({ error: "Audio file not found" }, 404, corsHeaders);
  }

  // Content-Type の推定（拡張子ベース）
  const contentType = guessContentType(key);

  const headers: HeadersInit = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400",
    ...corsHeaders,
  };

  // Content-Length が分かる場合は付与
  if (object.size !== undefined) {
    (headers as Record<string, string>)["Content-Length"] =
      String(object.size);
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

/**
 * ファイル拡張子から Content-Type を推定する
 */
function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

// ------------------------------------------------------------
// Workers エントリーポイント
// ------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const origin = env.ALLOWED_ORIGIN ?? "*";

    // ----- OPTIONS プリフライトの共通処理 -----
    if (method === "OPTIONS") {
      return handleOptions(origin);
    }

    // ----- ルーティング -----
    if (method === "GET" || method === "HEAD") {
      switch (url.pathname) {
        case "/api/next-track":
          return handleNextTrack(request, env);

        case "/api/stream":
          return handleStream(request, env);

        default:
          return new Response(
            JSON.stringify({ error: "Not Found" }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...buildCorsHeaders(origin),
              },
            }
          );
      }
    }

    // ----- その他のメソッドは 405 -----
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Allow: "GET, HEAD, OPTIONS",
          ...buildCorsHeaders(origin),
        },
      }
    );
  },
} satisfies ExportedHandler<Env>;
