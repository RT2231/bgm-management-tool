"use client";

import { cn } from "@/lib/utils";
import { BGM_TAGS, type BgmTag } from "@/types/bgm";

interface TagSelectorProps {
  selected: BgmTag;
  onChange: (tag: BgmTag) => void;
  disabled?: boolean;
}

const TAG_LABELS: Record<BgmTag, string> = {
  ALL: "すべて",
  "雑談・Chill": "雑談・Chill",
  "アップテンポ・Pop": "アップテンポ・Pop",
  "シネマティック・壮大": "シネマティック・壮大",
  "ローファイ・BPM低め": "ローファイ・BPM低め",
};

export function TagSelector({ selected, onChange, disabled }: TagSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="BGM タグを選択">
      {BGM_TAGS.map((tag) => {
        const isActive = tag === selected;
        return (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(tag)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isActive
                ? "border-primary bg-accent text-primary"
                : "border-border bg-transparent text-muted-foreground hover:border-primary/60 hover:text-foreground"
            )}
          >
            {TAG_LABELS[tag]}
          </button>
        );
      })}
    </div>
  );
}
