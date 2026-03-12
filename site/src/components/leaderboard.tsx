"use client";

import { useState, useMemo } from "react";
import { Search, Trophy, Calendar, CalendarDays, Crown } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import type { LeaderboardData, LeaderboardEntry, Period } from "@/lib/types";
import fuzzysort from "fuzzysort";

interface LeaderboardProps {
  lifetime: LeaderboardData | null;
  monthly: LeaderboardData | null;
  weekly: LeaderboardData | null;
}

const TABS: { id: Period; label: string; icon: typeof Trophy }[] = [
  { id: "lifetime", label: "All Time", icon: Crown },
  { id: "monthly", label: "Monthly", icon: CalendarDays },
  { id: "weekly", label: "Weekly", icon: Calendar },
];

export function Leaderboard({ lifetime, monthly, weekly }: LeaderboardProps) {
  const [period, setPeriod] = useState<Period>("lifetime");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 50;

  const dataMap: Record<Period, LeaderboardData | null> = {
    lifetime,
    monthly,
    weekly,
  };

  const currentData = dataMap[period];
  const entries = currentData?.leaderboard ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const results = fuzzysort.go(search, entries, {
      key: "username",
      threshold: -500,
    });
    return results.map((r) => r.obj);
  }, [entries, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    setPage(1);
    setSearch("");
  };

  return (
    <div className="animate-fade-up delay-3 space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex w-full sm:w-auto rounded-xl border border-border bg-card p-1 gap-0.5 shadow-sm dark:shadow-none dark:border-border/60 dark:bg-card/40 dark:glass">
          {TABS.map((tab) => {
            const count = dataMap[tab.id]?.totalUsers ?? 0;
            return (
              <button
                key={tab.id}
                onClick={() => handlePeriodChange(tab.id)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                  period === tab.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`hidden sm:inline ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      period === tab.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Search contributors..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm shadow-sm dark:shadow-none dark:border-border/60 dark:bg-card/40 dark:glass placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all sm:w-72"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none dark:border-border/60 dark:bg-card/40 dark:glass overflow-hidden min-w-0">
        {/* Table Header */}
        <div className="grid h-11 grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[3rem_2fr_5rem_5rem_1fr] items-center border-b border-border dark:border-border/40 bg-muted/50 dark:bg-muted/30 px-3 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <span>#</span>
          <span>Contributor</span>
          <span className="hidden sm:block text-center">Tier</span>
          <span className="hidden sm:block text-center">Class</span>
          <span className="text-right">Score</span>
        </div>

        {/* Rows */}
        {paginated.length > 0 ? (
          <div className="divide-y divide-border/50 dark:divide-border/30">
            {paginated.map((entry, i) => (
              <LeaderboardCard
                key={entry.username}
                entry={entry}
                rank={search ? i + 1 : (page - 1) * perPage + i + 1}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <span className="text-3xl">🔍</span>
            {search
              ? `No contributors matching "${search}"`
              : "No data for this period"}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground font-medium">
            {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of{" "}
            <span className="text-foreground">{filtered.length}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm dark:shadow-none dark:border-border/60 dark:bg-card/40 dark:glass disabled:opacity-30 hover:bg-accent transition-all"
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                    page === pageNum
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "border-border bg-card shadow-sm dark:shadow-none dark:border-border/60 dark:bg-card/40 hover:bg-accent"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm dark:shadow-none dark:border-border/60 dark:bg-card/40 dark:glass disabled:opacity-30 hover:bg-accent transition-all"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
