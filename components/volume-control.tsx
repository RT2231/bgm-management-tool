"use client";

import { Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface VolumeControlProps {
  volume: number; // 0–1
  onVolumeChange: (value: number) => void;
}

export function VolumeControl({ volume, onVolumeChange }: VolumeControlProps) {
  const Icon =
    volume === 0 ? VolumeXIcon : volume < 0.5 ? Volume1Icon : Volume2Icon;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={volume === 0 ? "ミュート解除" : "ミュート"}
        onClick={() => onVolumeChange(volume === 0 ? 0.7 : 0)}
        className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-4" />
      </button>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[volume]}
        onValueChange={([v]) => onVolumeChange(v)}
        aria-label="音量"
        className="w-24"
      />
      <span className="w-8 text-right font-mono text-xs text-muted-foreground">
        {Math.round(volume * 100)}
      </span>
    </div>
  );
}
