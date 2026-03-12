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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-primary">OpenClaw</span> Contributors
        </h1>
        <p className="mt-2 text-muted-foreground">
          Recognizing the people who build OpenClaw
        </p>
        {lifetime?.generatedAt && (
          <p className="mt-1 text-xs text-muted-foreground/60">
            Last updated: {new Date(lifetime.generatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {hasData && <StatsBar data={lifetime} />}

      {hasData ? (
        <Leaderboard lifetime={lifetime} monthly={monthly} weekly={weekly} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-2xl mb-2">🦞</p>
          <p className="text-lg font-medium">No leaderboard data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run the pipeline first:{" "}
            <code className="rounded bg-muted px-2 py-0.5 text-xs">
              bun run cli/run.ts all --days 90 -v
            </code>
          </p>
        </div>
      )}
    </main>
  );
}
