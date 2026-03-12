"use client";

import { Users, Star, GitFork } from "lucide-react";
import type { LeaderboardData } from "@/lib/types";

interface StatsBarProps {
  data: LeaderboardData | null;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function StatsBar({ data }: StatsBarProps) {
  if (!data) return null;

  const repo = data.repositories?.[0];

  return (
    <div className="animate-fade-up delay-2 mb-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-foreground">{fmt(data.totalUsers)}</span>
        contributors
      </span>
      {repo?.stars ? (
        <span className="inline-flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" />
          <span className="font-semibold text-foreground">{fmt(repo.stars)}</span>
          stars
        </span>
      ) : null}
      {repo?.forks ? (
        <span className="inline-flex items-center gap-1.5">
          <GitFork className="h-3.5 w-3.5 text-teal" />
          <span className="font-semibold text-foreground">{fmt(repo.forks)}</span>
          forks
        </span>
      ) : null}
    </div>
  );
}
