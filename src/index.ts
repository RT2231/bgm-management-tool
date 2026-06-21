// ============================================================
// おまかせBGM - Cloudflare Workers メインコード
// ============================================================

import type { Env, Track, NextTrackResponse, ErrorResponse } from "./types";

// ------------------------------------------------------------
// CORS ヘルパー
// ------------------------------------------------------------

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, *",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  };
}

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
  corsHeaders: Record<string, string>
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
// GET /api/next-track
// クエリパラメータ:
//   tag        - タグ名 (省略または "ALL" で全曲対象)
//   exclude_id - 直前のトラック ID（同じ曲を連続させないための除外）
// ------------------------------------------------------------

async function handleNextTrack(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const origin = env.ALLOWED_ORIGIN ?? "*";
  const corsHeaders = buildCorsHeaders(origin);

  const tag       = url.searchParams.get("tag");
  const excludeId = url.searchParams.get("exclude_id");

  // ベースクエリの組み立て
  const conditions: string[] = [];
  const params: string[] = [];

  if (tag && tag !== "ALL") {
    conditions.push("tags LIKE ?");
    params.push(`%${tag}%`);
  }

  if (excludeId) {
    conditions.push("id != ?");
    params.push(excludeId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM tracks ${where} ORDER BY RANDOM() LIMIT 1`;

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

  // exclude_id で絞り込んだ結果が 0 件の場合（曲が 1 曲しかない等）、exclude なしで再試行
  if (!track && excludeId) {
    const fallbackWhere = tag && tag !== "ALL" ? "WHERE tags LIKE ?" : "";
    const fallbackParams = tag && tag !== "ALL" ? [`%${tag}%`] : [];
    const fallbackQuery = `SELECT * FROM tracks ${fallbackWhere} ORDER BY RANDOM() LIMIT 1`;
    try {
      const result = await env.DB.prepare(fallbackQuery)
        .bind(...fallbackParams)
        .first<Track>();
      track = result ?? null;
    } catch (err) {
      console.error("[BGM Worker] D1 fallback query error:", err);
      return jsonResponse({ error: "Database error" }, 500, corsHeaders);
    }
  }

  if (!track) {
    return jsonResponse(
      { error: "No tracks found for the specified tag" },
      404,
      corsHeaders
    );
  }

  const streamUrl = `${url.origin}/api/stream?key=${encodeURIComponent(track.r2_key)}`;

  const responseBody: NextTrackResponse = {
    id:     track.id,
    title:  track.title,
    artist: track.artist,
    url:    streamUrl,
  };

  return jsonResponse(responseBody, 200, corsHeaders);
}

// ------------------------------------------------------------
// GET /api/stream?key=<r2_key>
// Range ヘッダーに対応し、シーク可能な音声ストリーミングを行う
// ------------------------------------------------------------

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

  const rangeHeader = request.headers.get("Range");
  const contentType = guessContentType(key);

  // Range リクエストの場合: R2 の range オプションで部分取得
  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
    if (!match) {
      return new Response("Invalid Range header", { status: 416, headers: corsHeaders });
    }

    const rangeStart = parseInt(match[1], 10);
    const rangeEnd   = match[2] ? parseInt(match[2], 10) : undefined;

    let object: R2ObjectBody | null = null;
    try {
      object = await env.BGM_BUCKET.get(key, {
        range: { offset: rangeStart, length: rangeEnd !== undefined ? rangeEnd - rangeStart + 1 : undefined },
      });
    } catch (err) {
      console.error("[BGM Worker] R2 range get error:", err);
      return jsonResponse({ error: "Storage error" }, 500, corsHeaders);
    }

    if (!object) {
      return jsonResponse({ error: "Audio file not found" }, 404, corsHeaders);
    }

    const totalSize   = object.size ?? 0;
    const effectiveEnd = rangeEnd ?? totalSize - 1;

    return new Response(object.body, {
      status: 206,
      headers: {
        "Content-Type":   contentType,
        "Content-Range":  `bytes ${rangeStart}-${effectiveEnd}/${totalSize}`,
        "Content-Length": String(effectiveEnd - rangeStart + 1),
        "Accept-Ranges":  "bytes",
        "Cache-Control":  "public, max-age=86400",
        ...corsHeaders,
      },
    });
  }

  // 通常リクエスト（Range なし）
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

  const headers: Record<string, string> = {
    "Content-Type":  contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    ...corsHeaders,
  };

  if (object.size !== undefined) {
    headers["Content-Length"] = String(object.size);
  }

  return new Response(object.body, { status: 200, headers });
}

// ------------------------------------------------------------
// Content-Type 推定
// ------------------------------------------------------------

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".mp3"))  return "audio/mpeg";
  if (lower.endsWith(".ogg"))  return "audio/ogg";
  if (lower.endsWith(".wav"))  return "audio/wav";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".aac"))  return "audio/aac";
  if (lower.endsWith(".m4a"))  return "audio/mp4";
  return "application/octet-stream";
}

// ------------------------------------------------------------
// Workers エントリーポイント
// ------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url);
    const method = request.method.toUpperCase();
    const origin = env.ALLOWED_ORIGIN ?? "*";

    if (method === "OPTIONS") {
      return handleOptions(origin);
    }

    if (method === "GET" || method === "HEAD") {
      switch (url.pathname) {
        case "/api/next-track":
          return handleNextTrack(request, env);
        case "/api/stream":
          return handleStream(request, env);
        default:
          return new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json; charset=utf-8", ...buildCorsHeaders(origin) },
          });
      }
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Allow: "GET, HEAD, OPTIONS",
        ...buildCorsHeaders(origin),
      },
    });
  },
} satisfies ExportedHandler<Env>;
