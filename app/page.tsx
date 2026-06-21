import { BgmPlayer } from "@/components/bgm-player";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        {/* Brand wordmark */}
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Streaming BGM for Creators
          </p>
        </header>

        {/* Player */}
        <BgmPlayer />

        {/* Footer note */}
        <footer>
          <p className="text-center text-xs text-muted-foreground">
            Cloudflare Workers + D1 + R2 powered
          </p>
        </footer>
      </div>
    </main>
  );
}
