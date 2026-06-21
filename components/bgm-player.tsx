"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, PauseIcon, PlayIcon, SkipForwardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagSelector } from "@/components/tag-selector";
import { VolumeControl } from "@/components/volume-control";
import type { BgmTag, PlayerStatus, Track } from "@/types/bgm";

const WORKERS_BASE_URL =
  process.env.NEXT_PUBLIC_WORKERS_URL ?? "";

export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [tag, setTag] = useState<BgmTag>("ALL");
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0); // 0–1
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ---------- audio element setup ---------- */
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!audio.duration) return;
      setCurrentTime(audio.currentTime);
      setProgress(audio.currentTime / audio.duration);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => fetchNextTrack(tag);
    const onError = () => {
      setStatus("error");
      setErrorMsg("音声の読み込みに失敗しました");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- volume sync ---------- */
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  /* ---------- fetch next track ---------- */
  const fetchNextTrack = useCallback(
    async (selectedTag: BgmTag) => {
      setStatus("loading");
      setErrorMsg(null);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);

      const url =
        WORKERS_BASE_URL
          ? `${WORKERS_BASE_URL}/api/next-track?tag=${encodeURIComponent(selectedTag)}`
          : `/api/next-track?tag=${encodeURIComponent(selectedTag)}`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data: Track = await res.json();
        setTrack(data);

        const audio = audioRef.current!;
        audio.src = data.url;
        audio.load();
        await audio.play();
        setStatus("playing");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "不明なエラーが発生しました");
      }
    },
    []
  );

  /* ---------- play / pause toggle ---------- */
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "idle" || status === "error") {
      fetchNextTrack(tag);
      return;
    }

    if (status === "playing") {
      audio.pause();
      setStatus("paused");
    } else if (status === "paused") {
      audio.play();
      setStatus("playing");
    }
  };

  /* ---------- skip ---------- */
  const skip = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    fetchNextTrack(tag);
  };

  /* ---------- tag change ---------- */
  const handleTagChange = (newTag: BgmTag) => {
    setTag(newTag);
    if (status === "playing" || status === "paused") {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      fetchNextTrack(newTag);
    }
  };

  /* ---------- seek ---------- */
  const handleSeek = (e: React.MouseEvent<HTMLButtonElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  /* ---------- helpers ---------- */
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isLoading = status === "loading";

  return (
    <div
      className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border p-6"
      style={{ background: "var(--player-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">
          おまかせ<span className="text-primary">BGM</span>
        </h1>
        <Badge variant="secondary" className="font-mono text-xs">
          {tag === "ALL" ? "すべて" : tag}
        </Badge>
      </div>

      {/* Tag selector */}
      <TagSelector selected={tag} onChange={handleTagChange} disabled={isLoading} />

      {/* Track info */}
      <div
        className="flex min-h-[4.5rem] flex-col justify-center rounded-xl px-4 py-3"
        style={{ background: "var(--player-surface)" }}
      >
        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
            タグを選んで再生ボタンを押してください
          </p>
        )}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            <span>楽曲を取得中...</span>
          </div>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}
        {track && (status === "playing" || status === "paused") && (
          <>
            <p className="truncate text-sm font-semibold text-foreground">{track.title}</p>
            <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-label="シーク"
          onClick={handleSeek}
          className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: "var(--player-surface)" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{
              width: `${progress * 100}%`,
              background: "var(--player-active)",
            }}
          />
        </button>
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <VolumeControl volume={volume} onVolumeChange={setVolume} />

        <div className="flex items-center gap-2">
          {/* Play / Pause */}
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
            ) : status === "playing" ? (
              <PauseIcon data-icon />
            ) : (
              <PlayIcon data-icon />
            )}
          </Button>

          {/* Skip */}
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
