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
} from "lucide-react";
import { useState } from "react";
import { DinqLink } from "./dinq-link";

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  rank: number;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return <Trophy className="h-5 w-5 text-yellow-400" />;
  if (rank === 2)
    return <Medal className="h-5 w-5 text-gray-400 dark:text-gray-300" />;
  if (rank === 3)
    return <Award className="h-5 w-5 text-amber-600" />;
  return (
    <span className="text-sm font-semibold text-muted-foreground">{rank}</span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tier === "legend" && "bg-yellow-500/15 text-yellow-500",
        tier === "elite" && "bg-purple-500/15 text-purple-600 dark:text-purple-400",
        tier === "veteran" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        tier === "active" && "bg-green-500/15 text-green-600 dark:text-green-400",
        tier === "regular" && "bg-gray-500/10 text-gray-600 dark:text-gray-400",
        tier === "beginner" && "bg-gray-500/5 text-gray-500",
      )}
    >
      {tier}
    </span>
  );
}

export function LeaderboardCard({ entry, rank }: LeaderboardCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className={cn(
          "grid w-full grid-cols-[3rem_2fr_5rem_5rem_1fr] items-center px-4 py-3 text-left transition-colors hover:bg-accent/50 cursor-pointer",
          rank <= 3 && "bg-primary/[0.02]",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Rank */}
        <div className="flex items-center justify-center">
          <RankBadge rank={rank} />
        </div>

        {/* Avatar (clickable → profile) + Username */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/profile/${entry.username}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-primary transition-all"
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
              <DinqLink username={entry.username} />
            </div>
            {entry.focusAreas.length > 0 && (
              <span className="block truncate text-[11px] text-muted-foreground">
                {entry.focusAreas
                  .slice(0, 3)
                  .map((a) => a.tag)
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>

        {/* Tier */}
        <div className="flex justify-center">
          <TierBadge tier={entry.tier} />
        </div>

        {/* Character class */}
        <div className="text-center text-xs text-muted-foreground">
          {entry.characterClass}
        </div>

        {/* Score */}
        <div className="text-right">
          <span className={cn("text-lg font-bold tabular-nums", TIER_COLORS[entry.tier])}>
            {(entry.score ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">pts</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ScoreDetail
              icon={GitPullRequest}
              label="PRs"
              score={entry.prScore ?? 0}
              count={entry.prsCount ?? 0}
              color="text-green-500"
            />
            <ScoreDetail
              icon={Bug}
              label="Issues"
              score={entry.issueScore ?? 0}
              count={entry.issuesCount ?? 0}
              color="text-orange-500"
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
          <div className="mt-3 flex items-center gap-3">
            <Link
              href={`/profile/${entry.username}`}
              className="text-xs text-primary font-medium hover:underline"
            >
              View Full Profile →
            </Link>
            <a
              href={entry.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              GitHub ↗
            </a>
            <a
              href={`https://analysis.dinq.me/github?user=${entry.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              DINQ ↗
            </a>
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
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4 shrink-0", color)} />
      <div>
        <div className="text-sm font-semibold tabular-nums">
          {score.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {count} {label}
        </div>
      </div>
    </div>
  );
}
