"use client";

import { Users, Star, GitFork, Trophy, Code, Eye } from "lucide-react";
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
      value: fmt(data.totalUsers),
      accent: "text-primary",
      glow: false,
    },
    ...(repo?.stars
      ? [
          {
            icon: Star,
            label: "Stars",
            value: fmt(repo.stars ?? 0),
            accent: "text-yellow-500",
            glow: false,
          },
        ]
      : []),
    ...(repo?.forks
      ? [
          {
            icon: GitFork,
            label: "Forks",
            value: fmt(repo.forks ?? 0),
            accent: "text-teal dark:text-teal",
            glow: false,
          },
        ]
      : []),
    {
      icon: Trophy,
      label: "Legends",
      value: String(tierCounts.legend || 0),
      accent: "text-yellow-500",
      glow: true,
    },
    {
      icon: Code,
      label: "Elite",
      value: String(tierCounts.elite || 0),
      accent: "text-purple-500",
      glow: false,
    },
    {
      icon: Eye,
      label: "Veterans",
      value: String(tierCounts.veteran || 0),
      accent: "text-blue-500",
      glow: false,
    },
  ];

  return (
    <div className="animate-fade-up delay-2 mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`group relative flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 glass p-4 transition-all hover:border-border hover:bg-card/80 ${
            stat.glow ? "hover:glow-gold" : ""
          }`}
          style={{ animationDelay: `${(i + 2) * 50}ms` }}
        >
          <stat.icon className={`h-4 w-4 ${stat.accent} transition-transform group-hover:scale-110`} />
          <span className="font-display text-xl font-bold tracking-tight">{stat.value}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
