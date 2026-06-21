"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SkipForwardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagSelector } from "@/components/tag-selector";
import { VolumeControl } from "@/components/volume-control";
import type { BgmTag, PlayerStatus, Track } from "@/types/bgm";

const WORKERS_BASE_URL = "https://bgm-management-tool.shirokuma0822.workers.dev";

// プログレスバーをドラッグ中の最小更新間隔（ms）
const SEEK_THROTTLE_MS = 50;

export function BgmPlayer() {
  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const progressBarRef  = useRef<HTMLDivElement>(null);
  const isDraggingRef   = useRef(false);
  const lastSeekTimeRef = useRef(0);

  const [track,       setTrack]       = useState<Track | null>(null);
  const [status,      setStatus]      = useState<PlayerStatus>("idle");
  const [tag,         setTag]         = useState<BgmTag>("ALL");
  const [volume,      setVolume]      = useState(0.7);
  const [isMuted,     setIsMuted]     = useState(false);
  const [progress,    setProgress]    = useState(0);       // 0–1
  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  // 直前のトラック ID（同じ曲を連続させないため）
  const prevIdRef = useRef<string | null>(null);

  /* ---------- audio 初期化 ---------- */
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!audio.duration) return;
      setCurrentTime(audio.currentTime);
      if (!isDraggingRef.current) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onWaiting        = () => setIsBuffering(true);
    const onCanPlay        = () => setIsBuffering(false);
    const onPlaying        = () => { setIsBuffering(false); setStatus("playing"); };
    const onEnded          = () => {
      autoNextRef.current = true;
      setStatus("loading");
      setIsBuffering(false);
    };
    const onError          = () => {
      setIsBuffering(false);
      setStatus("error");
      setErrorMsg("音声の読み込みに失敗しました。ファイルが R2 に存在するか確認してください。");
    };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("waiting",        onWaiting);
    audio.addEventListener("canplay",        onCanPlay);
    audio.addEventListener("playing",        onPlaying);
    audio.addEventListener("ended",          onEnded);
    audio.addEventListener("error",          onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("waiting",        onWaiting);
      audio.removeEventListener("canplay",        onCanPlay);
      audio.removeEventListener("playing",        onPlaying);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("error",          onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- volume / mute 同期 ---------- */
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  /* ---------- ended 後に自動次曲 ---------- */
  // status が "loading" に変わった直後かつ track が存在する場合は曲送り
  const tagRef = useRef(tag);
  useEffect(() => { tagRef.current = tag; }, [tag]);

  // 曲が自然に終わった（onEnded）ときだけ自動次曲を取得する
  // prevIdRef が null = まだ一度も再生していない = 自動発火しない
  const autoNextRef = useRef(false);

  useEffect(() => {
    if (status === "loading" && autoNextRef.current && prevIdRef.current !== null) {
      autoNextRef.current = false;
      fetchNextTrack(tagRef.current, prevIdRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ---------- 次曲取得 ---------- */
  const fetchNextTrack = useCallback(async (selectedTag: BgmTag, excludeId?: string | null) => {
    setStatus("loading");
    setIsBuffering(false);
    setErrorMsg(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

    if (!WORKERS_BASE_URL) {
      setStatus("error");
      setErrorMsg(
        "NEXT_PUBLIC_WORKERS_URL が未設定です。Settings → Vars に Cloudflare Workers の URL を追加してください。"
      );
      return;
    }

    const params = new URLSearchParams({ tag: selectedTag });
    if (excludeId) params.set("exclude_id", excludeId);
    const apiUrl = `${WORKERS_BASE_URL}/api/next-track?${params.toString()}`;

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const data: Track = await res.json();
      prevIdRef.current = data.id;
      setTrack(data);

      const audio = audioRef.current!;
      audio.src = data.url;
      audio.load();
      await audio.play();
      // status は onPlaying イベントで "playing" に切り替わる
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "不明なエラーが発生しました");
    }
  }, []);

  /* ---------- 再生 / 一時停止 ---------- */
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "idle" || status === "error") {
      prevIdRef.current = null;
      fetchNextTrack(tag, null);
      return;
    }
    if (status === "playing") {
      audio.pause();
      setStatus("paused");
    } else if (status === "paused") {
      audio.play();
    }
  };

  /* ---------- スキップ ---------- */
  const skip = () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    fetchNextTrack(tag, prevIdRef.current);
  };

  /* ---------- タグ変更 ---------- */
  const handleTagChange = (newTag: BgmTag) => {
    setTag(newTag);
    if (status === "playing" || status === "paused") {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      fetchNextTrack(newTag, null);
    }
  };

  /* ---------- プログレスバー シーク ---------- */
  const calcRatio = (clientX: number): number => {
    const el = progressBarRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const applySeek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const now = Date.now();
    if (now - lastSeekTimeRef.current < SEEK_THROTTLE_MS) return;
    lastSeekTimeRef.current = now;
    audio.currentTime = ratio * duration;
    setProgress(ratio);
    setCurrentTime(ratio * duration);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    isDraggingRef.current = true;
    applySeek(calcRatio(e.clientX));

    const onMove = (ev: MouseEvent) => applySeek(calcRatio(ev.clientX));
    const onUp   = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!duration) return;
    isDraggingRef.current = true;
    applySeek(calcRatio(e.touches[0].clientX));

    const onMove = (ev: TouchEvent) => applySeek(calcRatio(ev.touches[0].clientX));
    const onEnd  = () => {
      isDraggingRef.current = false;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onEnd);
    };
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend",  onEnd);
  };

  /* ---------- 時間フォーマット ---------- */
  const formatTime = (secs: number): string => {
    if (!isFinite(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  /* ---------- 派生状態 ---------- */
  const isLoading       = status === "loading";
  const showBuffering   = isBuffering && status === "playing";
  const showPlayIcon    = status !== "playing";
  const hasTrackInfo    = track !== null && (status === "playing" || status === "paused" || showBuffering);
  // 再生を試みてエラーになった場合にのみ Workers URL 未設定の警告を出す
  const workersNotSet   = !WORKERS_BASE_URL && status === "error" &&
    (errorMsg?.includes("NEXT_PUBLIC_WORKERS_URL") ?? false);

  return (
    <div
      className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border p-6"
      style={{ background: "var(--player-bg)" }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">
          おまかせ<span className="text-primary">BGM</span>
        </h1>
        <Badge variant="secondary" className="font-mono text-xs">
          {tag === "ALL" ? "すべて" : tag}
        </Badge>
      </div>

      {/* Workers URL 未設定の警告 */}
      {workersNotSet && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-semibold">NEXT_PUBLIC_WORKERS_URL</span> が未設定です。
            Vercel の環境変数に Cloudflare Workers の URL を設定してください。
          </span>
        </div>
      )}

      {/* タグ選択 */}
      <TagSelector selected={tag} onChange={handleTagChange} disabled={isLoading} />

      {/* トラック情報 */}
      <div
        className="flex min-h-[4.5rem] flex-col justify-center rounded-xl px-4 py-3"
        style={{ background: "var(--player-surface)" }}
      >
        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
            タグを選んで再生ボタンを押してください
          </p>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            <span>楽曲を取得中...</span>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col gap-1">
            <div className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          </div>
        )}
        {hasTrackInfo && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{track!.title}</p>
              <p className="truncate text-xs text-muted-foreground">{track!.artist}</p>
            </div>
            {showBuffering && (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
            )}
          </div>
        )}
      </div>

      {/* プログレスバー（クリック＆ドラッグでシーク） */}
      <div className="flex flex-col gap-1.5">
        <div
          ref={progressBarRef}
          role="slider"
          aria-label="再生位置"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={duration ? 0 : -1}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          className="relative h-1.5 w-full overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            background: "var(--player-surface)",
            cursor: duration ? "pointer" : "default",
          }}
        >
          {/* バッファリング アニメーション */}
          {showBuffering && (
            <div
              className="absolute inset-y-0 left-0 animate-pulse rounded-full"
              style={{ width: `${progress * 100}%`, background: "var(--player-active)", opacity: 0.5 }}
            />
          )}
          {/* 再生進捗 */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-none"
            style={{ width: `${progress * 100}%`, background: "var(--player-active)" }}
          />
          {/* シークサム */}
          {duration > 0 && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full border-2 border-background"
              style={{ left: `${progress * 100}%`, background: "var(--player-active)" }}
            />
          )}
        </div>
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* コントロール */}
      <div className="flex items-center justify-between">
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={setVolume}
          onMuteToggle={() => setIsMuted((m) => !m)}
        />

        <div className="flex items-center gap-2">
          {/* リトライボタン（エラー時のみ） */}
          {status === "error" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="再試行"
              onClick={() => fetchNextTrack(tag, null)}
              className="size-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <RefreshCwIcon data-icon />
            </Button>
          )}

          {/* 再生 / 一時停止 */}
          <Button
            variant="default"
            size="icon"
            aria-label={status === "playing" ? "一時停止" : "再生"}
            disabled={isLoading}
            onClick={togglePlay}
            className="size-12 rounded-full text-primary-foreground"
          >
            {isLoading ? (
              <Loader2Icon data-icon className="animate-spin" />
            ) : showPlayIcon ? (
              <PlayIcon data-icon />
            ) : (
              <PauseIcon data-icon />
            )}
          </Button>

          {/* スキップ */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="次の曲"
            disabled={isLoading}
            onClick={skip}
            className="size-10 rounded-full text-muted-foreground hover:text-foreground"
          >
            <SkipForwardIcon data-icon />
          </Button>
        </div>
      </div>
    </div>
  );
}
