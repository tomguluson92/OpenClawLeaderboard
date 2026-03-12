import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";
import type { LeaderboardData } from "@/lib/types";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function loadLeaderboard(period: string): LeaderboardData | null {
  const paths = [
    join(process.cwd(), "public", "api", `leaderboard-${period}.json`),
    join(process.cwd(), "..", "output", `leaderboard-${period}.json`),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf-8"));
    }
  }
  return null;
}

export default function Home() {
  const lifetime = loadLeaderboard("lifetime");
  const monthly = loadLeaderboard("monthly");
  const weekly = loadLeaderboard("weekly");

  const hasData = lifetime || monthly || weekly;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Hero */}
      <div className="animate-fade-up mb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-4">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
          Open Source Intelligence
        </div>
        <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
          <span className="text-primary">Open</span>Claw
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Recognizing the builders who shape the future of personal AI
        </p>
        {lifetime?.generatedAt && (
          <p className="mt-3 text-[11px] text-muted-foreground/50 font-medium tracking-wider uppercase">
            Updated {new Date(lifetime.generatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {hasData && <StatsBar data={lifetime} />}

      {hasData ? (
        <Leaderboard lifetime={lifetime} monthly={monthly} weekly={weekly} />
      ) : (
        <div className="animate-fade-up rounded-xl border border-border bg-card shadow-sm dark:shadow-none dark:bg-card/60 dark:glass p-16 text-center">
          <p className="text-4xl mb-3">🦞</p>
          <p className="font-display text-xl font-bold">No leaderboard data yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run the pipeline first:{" "}
            <code className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono">
              bun run scripts/fetch-rest.ts
            </code>
          </p>
        </div>
      )}
    </main>
  );
}
