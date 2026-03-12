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
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {TABS.map((tab) => {
            const count = dataMap[tab.id]?.totalUsers ?? 0;
            return (
              <button
                key={tab.id}
                onClick={() => handlePeriodChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contributors..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
          />
        </div>
      </div>

      {/* Table Header */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid h-10 grid-cols-[3rem_2fr_5rem_5rem_1fr] items-center border-b border-border bg-muted/50 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>#</span>
          <span>Contributor</span>
          <span className="text-center">Tier</span>
          <span className="text-center">Class</span>
          <span className="text-right">Score</span>
        </div>

        {/* Rows */}
        {paginated.length > 0 ? (
          <div>
            {paginated.map((entry, i) => (
              <LeaderboardCard
                key={entry.username}
                entry={entry}
                rank={search ? i + 1 : (page - 1) * perPage + i + 1}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            {search
              ? `No contributors matching "${search}"`
              : "No data for this period"}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * perPage + 1}–
            {Math.min(page * perPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent"
            >
              Prev
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
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    page === pageNum
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
