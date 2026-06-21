"use client";

import { Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface VolumeControlProps {
  volume: number;       // 0–1（ミュート時も実際の音量値を保持）
  isMuted: boolean;
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
}

export function VolumeControl({ volume, isMuted, onVolumeChange, onMuteToggle }: VolumeControlProps) {
  const effectiveVolume = isMuted ? 0 : volume;
  const Icon =
    effectiveVolume === 0 ? VolumeXIcon : effectiveVolume < 0.5 ? Volume1Icon : Volume2Icon;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={isMuted ? "ミュート解除" : "ミュート"}
        onClick={onMuteToggle}
        className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-4" />
      </button>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[effectiveVolume]}
        onValueChange={([v]) => {
          // スライダー操作でミュート解除しつつ音量変更
          if (isMuted && v > 0) onMuteToggle();
          onVolumeChange(v);
        }}
        aria-label="音量"
        className="w-24"
      />
      <span className="w-8 text-right font-mono text-xs text-muted-foreground">
        {Math.round(effectiveVolume * 100)}
      </span>
    </div>
  );
}
