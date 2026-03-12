"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";
import { TIER_COLORS } from "@/lib/types";
import {
  Trophy,
  Medal,
  Award,
  GitPullRequest,
  Bug,
  Eye,
  MessageSquare,
  ChevronRight,
  Github,
} from "lucide-react";
import { useState } from "react";
import { DinqLink } from "./dinq-link";

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  rank: number;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="relative">
        <Trophy className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
      </div>
    );
  if (rank === 2)
    return <Medal className="h-5 w-5 text-gray-400 dark:text-gray-300" />;
  if (rank === 3)
    return <Award className="h-5 w-5 text-amber-600 dark:text-amber-500" />;
  return (
    <span className="font-display text-sm font-bold text-muted-foreground tabular-nums">{rank}</span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tier === "legend" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 ring-1 ring-yellow-300 dark:ring-yellow-400/30",
        tier === "elite" && "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-400/30",
        tier === "veteran" && "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-400/30",
        tier === "active" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-400/30",
        tier === "regular" && "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
        tier === "beginner" && "bg-gray-50 text-gray-500 dark:bg-gray-500/5 dark:text-gray-400",
      )}
    >
      {tier}
    </span>
  );
}

export function LeaderboardCard({ entry, rank }: LeaderboardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rowHighlight =
    rank === 1 ? "row-gold" : rank === 2 ? "row-silver" : rank === 3 ? "row-bronze" : "";

  return (
    <div className={`group/card ${rowHighlight}`}>
      <div
        className={cn(
          "grid w-full grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[3rem_2fr_5rem_5rem_1fr] items-center px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-all cursor-pointer",
          "hover:bg-accent/40",
          expanded && "bg-accent/30",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Rank */}
        <div className="flex items-center justify-center">
          <RankBadge rank={rank} />
        </div>

        {/* Avatar + Username */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/profile/${entry.username}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-primary/60 transition-all hover:scale-105"
          >
            <Image
              src={entry.avatarUrl || `https://github.com/${entry.username}.png`}
              alt={entry.username}
              width={36}
              height={36}
              className="rounded-full"
              unoptimized
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/profile/${entry.username}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-medium text-sm hover:text-primary transition-colors"
              >
                {entry.username}
              </Link>
              <a
                href={entry.links.github}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:inline-flex items-center justify-center shrink-0 rounded-md transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                title={`${entry.username} on GitHub`}
              >
                <Github className="h-3.5 w-3.5" />
              </a>
              <span className="hidden sm:inline"><DinqLink username={entry.username} /></span>
            </div>
            <div className="flex items-center gap-1.5 sm:hidden mt-0.5">
              <TierBadge tier={entry.tier} />
              <span className="text-[10px] text-muted-foreground">{entry.characterClass}</span>
            </div>
            {entry.focusAreas.length > 0 && (
              <span className="hidden sm:block truncate text-[11px] text-muted-foreground/70">
                {entry.focusAreas
                  .slice(0, 3)
                  .map((a) => a.tag)
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>

        {/* Tier (hidden on mobile) */}
        <div className="hidden sm:flex justify-center">
          <TierBadge tier={entry.tier} />
        </div>

        {/* Character class (hidden on mobile) */}
        <div className="hidden sm:block text-center text-[11px] text-muted-foreground font-medium">
          {entry.characterClass}
        </div>

        {/* Score */}
        <div className="flex items-center justify-end gap-2">
          <div>
            <span className={cn("font-display text-lg font-bold tabular-nums", TIER_COLORS[entry.tier])}>
              {(entry.score ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>
            <span className="ml-1 text-[10px] text-muted-foreground font-medium">pts</span>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground/40 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/50 dark:border-border/30 bg-muted/40 dark:bg-accent/20 px-5 py-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ScoreDetail
              icon={GitPullRequest}
              label="PRs"
              score={entry.prScore ?? 0}
              count={entry.prsCount ?? 0}
              color="text-emerald-500"
            />
            <ScoreDetail
              icon={Bug}
              label="Issues"
              score={entry.issueScore ?? 0}
              count={entry.issuesCount ?? 0}
              color="text-primary"
            />
            <ScoreDetail
              icon={Eye}
              label="Reviews"
              score={entry.reviewScore ?? 0}
              count={entry.reviewsCount ?? 0}
              color="text-blue-500"
            />
            <ScoreDetail
              icon={MessageSquare}
              label="Comments"
              score={entry.commentScore ?? 0}
              count={entry.commentsCount ?? 0}
              color="text-purple-500"
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Link
              href={`/profile/${entry.username}`}
              className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline transition-colors"
            >
              View Full Profile
              <ChevronRight className="h-3 w-3" />
            </Link>
            <a
              href={entry.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:scale-110"
              title="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <DinqLink username={entry.username} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDetail({
  icon: Icon,
  label,
  score,
  count,
  color,
}: {
  icon: typeof GitPullRequest;
  label: string;
  score: number;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-background dark:bg-card/80", color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="font-display text-sm font-bold tabular-nums">
          {score.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {count} {label}
        </div>
      </div>
    </div>
  );
}
