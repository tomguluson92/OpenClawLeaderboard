"use client";

import { Users, Star, GitFork, Trophy, Code, Eye } from "lucide-react";
import type { LeaderboardData } from "@/lib/types";

interface StatsBarProps {
  data: LeaderboardData | null;
}

export function StatsBar({ data }: StatsBarProps) {
  if (!data) return null;

  const repo = data.repositories?.[0];
  const tierCounts = data.leaderboard.reduce(
    (acc, c) => {
      acc[c.tier] = (acc[c.tier] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const stats = [
    {
      icon: Users,
      label: "Contributors",
      value: data.totalUsers.toLocaleString(),
    },
    ...(repo?.stars
      ? [
          {
            icon: Star,
            label: "Stars",
            value: (repo.stars ?? 0).toLocaleString(),
          },
        ]
      : []),
    ...(repo?.forks
      ? [
          {
            icon: GitFork,
            label: "Forks",
            value: (repo.forks ?? 0).toLocaleString(),
          },
        ]
      : []),
    {
      icon: Trophy,
      label: "Legends",
      value: String(tierCounts.legend || 0),
    },
    {
      icon: Code,
      label: "Elite",
      value: String(tierCounts.elite || 0),
    },
    {
      icon: Eye,
      label: "Veterans",
      value: String(tierCounts.veteran || 0),
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3"
        >
          <stat.icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-bold">{stat.value}</span>
          <span className="text-[11px] text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
