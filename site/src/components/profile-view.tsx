"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TIER_COLORS } from "@/lib/types";
import {
  ArrowLeft,
  ExternalLink,
  GitPullRequest,
  Bug,
  Eye,
  MessageSquare,
  Code,
  GitCommit,
  CheckCircle2,
  XCircle,
  Trophy,
  Star,
  Sparkles,
  Calendar,
  TrendingUp,
  Award,
  Shield,
  Zap,
  Target,
  FileCode,
  Clock,
  Loader2,
} from "lucide-react";
import { DinqLink } from "./dinq-link";

interface ProfileData {
  username: string;
  avatarUrl: string;
  githubUrl: string;
  score: { score: number; prScore: number; issueScore: number; reviewScore: number; commentScore: number };
  tier: string;
  characterClass: string;
  stats: {
    commits: number; prs: number; prsMerged: number;
    prAdditions: number; prDeletions: number; prChangedFiles: number; prMergeRate: number;
    commitAdditions?: number; commitDeletions?: number; commitChangedFiles?: number;
    issues: number; issuesClosed: number;
    reviews: number; reviewsApproved: number; reviewsChangesRequested: number;
    comments: number;
  };
  period: {
    weekly: { prs: number; issues: number; reviews: number; comments: number; commits?: number; commitAdditions?: number; commitDeletions?: number };
    monthly: { prs: number; issues: number; reviews: number; comments: number; commits?: number; commitAdditions?: number; commitDeletions?: number };
  };
  firstContribution: string | null;
  lastContribution: string | null;
  recentPRs: { number: number; title: string; state: string; merged: boolean; createdAt: string; mergedAt: string | null; additions: number; deletions: number; changedFiles: number }[];
  recentIssues: { number: number; title: string; state: string; createdAt: string; closedAt: string | null }[];
  recentReviews: { prNumber: number; state: string; createdAt: string }[];
  skills: string[];
  achievements: { id: string; label: string; description: string }[];
}

const tierStyle: Record<string, string> = {
  legend: "from-yellow-500/20 to-orange-500/20 border-yellow-500/40",
  elite: "from-purple-500/20 to-pink-500/20 border-purple-500/40",
  veteran: "from-blue-500/20 to-cyan-500/20 border-blue-500/40",
  active: "from-green-500/20 to-emerald-500/20 border-green-500/40",
  regular: "from-gray-500/10 to-gray-500/10 border-gray-500/30",
  beginner: "from-gray-500/5 to-gray-500/5 border-gray-500/20",
};

const ACHIEVEMENT_ICONS: Record<string, typeof Trophy> = {
  centurion: GitCommit, marathon: Code, "legend-commits": Star,
  "pr-machine": GitPullRequest, "pr-master": GitPullRequest, "pr-legend": Trophy,
  merger: CheckCircle2, "merge-master": Trophy,
  "bug-reporter": Bug, "issue-tracker": Bug,
  reviewer: Eye, "review-guru": Eye, "review-legend": Award,
  conversationalist: MessageSquare, prolific: FileCode, "mega-coder": Zap,
  precision: Target, "well-rounded": Shield,
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ProfileView({ profile }: { profile: ProfileData }) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    setSummaryLoading(true);
    fetch("/api/ai-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setSummaryError(data.error);
        else setAiSummary(data.summary);
      })
      .catch((e) => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));
  }, [profile]);

  const s = profile.stats;
  const sc = profile.score;

  const totalAdditions = (s.prAdditions || 0) + (s.commitAdditions || 0);
  const totalDeletions = (s.prDeletions || 0) + (s.commitDeletions || 0);
  const totalChangedFiles = (s.prChangedFiles || 0) + (s.commitChangedFiles || 0);
  const totalPrsAndCommits = s.prs + s.commits;
  const closedPrs = s.prs - s.prsMerged;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leaderboard
      </Link>

      {/* Hero card */}
      <div className={cn("rounded-xl border bg-gradient-to-br p-6", tierStyle[profile.tier] || tierStyle.beginner)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={profile.avatarUrl}
              alt={profile.username}
              width={80}
              height={80}
              className="rounded-full ring-2 ring-border"
              unoptimized
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.username}</h1>
                <DinqLink username={profile.username} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide", TIER_COLORS[profile.tier])}>
                  {profile.tier}
                </span>
                <span className="text-sm text-muted-foreground">{profile.characterClass}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {profile.firstContribution && (
                  <span>Contributing since {formatDate(profile.firstContribution)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-3xl font-bold tabular-nums", TIER_COLORS[profile.tier])}>
              {sc.score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">total points</div>
            <div className="mt-2 flex flex-wrap gap-2 justify-end">
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-foreground/10 px-3 py-1.5 text-xs font-medium hover:bg-foreground/20 transition-colors"
              >
                View on GitHub <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={`https://analysis.dinq.me/github?user=${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-foreground/10 px-3 py-1.5 text-xs font-medium hover:bg-foreground/20 transition-colors"
              >
                View on DINQ <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <Section title="Summary" icon={Sparkles}>
        {summaryLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI analysis...
          </div>
        ) : summaryError ? (
          <p className="text-sm text-muted-foreground italic">Unable to generate summary.</p>
        ) : (
          <p className="text-sm leading-relaxed">{aiSummary}</p>
        )}
      </Section>

      {/* Recent Activity + Pull Requests + Code Contributions — reference layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Left: Activity Bar Chart */}
        <Section title={`Recent Activity (Last 31 Days)`} icon={Clock}>
          <ActivityChart profile={profile} />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
            <Legend color="bg-teal-500" label="Comments" />
            <Legend color="bg-indigo-800 dark:bg-indigo-400" label="Issues" />
            <Legend color="bg-amber-500" label="PRs" />
            <Legend color="bg-red-500" label="Reviews" />
          </div>
          {profile.lastContribution && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last active: {formatDate(profile.lastContribution)} ({timeAgo(profile.lastContribution)})
            </p>
          )}
        </Section>

        {/* Right: PR stats + Code stats */}
        <div className="flex flex-col gap-4">
          <Section title="Pull Requests" icon={GitPullRequest}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <BigStat value={totalPrsAndCommits} label="Total" />
              <BigStat value={s.prsMerged} label="Merged" />
              <BigStat value={closedPrs} label="Closed" />
            </div>
          </Section>

          <Section title="Code Contributions" icon={Code}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <BigStat value={totalChangedFiles} label="Files" />
              <BigStat value={totalAdditions} label="Additions" prefix="+" accent="text-green-500" />
              <BigStat value={totalDeletions} label="Deletions" prefix="-" accent="text-red-500" />
            </div>
          </Section>
        </div>
      </div>

      {/* Score Breakdown */}
      <Section title="Score Breakdown" icon={TrendingUp}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ScoreBar label="PRs" value={sc.prScore} max={sc.score} color="bg-green-500" />
          <ScoreBar label="Issues" value={sc.issueScore} max={sc.score} color="bg-orange-500" />
          <ScoreBar label="Reviews" value={sc.reviewScore} max={sc.score} color="bg-blue-500" />
          <ScoreBar label="Comments" value={sc.commentScore} max={sc.score} color="bg-purple-500" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatBox label="Commits" value={s.commits.toLocaleString()} accent="text-blue-500" />
          <StatBox label="PRs" value={s.prs} accent="text-green-500" />
          <StatBox label="Reviews" value={s.reviews} accent="text-cyan-500" />
          <StatBox label="Comments" value={s.comments} accent="text-purple-500" />
          <StatBox label="Merge Rate" value={s.prs > 0 ? `${s.prMergeRate}%` : "—"} accent="text-green-500" />
        </div>
      </Section>

      {/* Recent PRs list */}
      {profile.recentPRs.length > 0 && (
        <Section title="Recent Pull Requests" icon={GitPullRequest} count={s.prs}>
          <div className="space-y-1">
            {profile.recentPRs.slice(0, 10).map((pr) => (
              <a
                key={pr.number}
                href={`https://github.com/openclaw/openclaw/pull/${pr.number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors"
              >
                {pr.merged ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-500" />
                ) : pr.state === "CLOSED" ? (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                ) : (
                  <GitPullRequest className="h-4 w-4 shrink-0 text-green-500" />
                )}
                <span className="truncate flex-1">{pr.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  +{pr.additions}/-{pr.deletions}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(pr.createdAt)}</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Issues */}
      {(s.issues > 0 || profile.recentIssues.length > 0) && (
        <Section title="Issues" icon={Bug} count={s.issues}>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatBox label="Filed" value={s.issues} />
            <StatBox label="Closed" value={s.issuesClosed} accent="text-green-500" />
            <StatBox label="Open" value={s.issues - s.issuesClosed} accent="text-orange-500" />
          </div>
          {profile.recentIssues.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent</h4>
              {profile.recentIssues.slice(0, 8).map((issue) => (
                <a
                  key={issue.number}
                  href={`https://github.com/openclaw/openclaw/issues/${issue.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors"
                >
                  {issue.state === "CLOSED" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-500" />
                  ) : (
                    <Bug className="h-4 w-4 shrink-0 text-green-500" />
                  )}
                  <span className="truncate flex-1">{issue.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(issue.createdAt)}</span>
                </a>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Reviews */}
      {s.reviews > 0 && (
        <Section title="Code Reviews" icon={Eye} count={s.reviews}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatBox label="Total Reviews" value={s.reviews} />
            <StatBox label="Approved" value={s.reviewsApproved} accent="text-green-500" />
            <StatBox label="Changes Requested" value={s.reviewsChangesRequested} accent="text-orange-500" />
          </div>
        </Section>
      )}

      {/* Roles & Character */}
      <Section title="Role" icon={Shield}>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-border bg-card p-4 flex-1 min-w-[140px]">
            <div className="text-xs text-muted-foreground mb-1">Character Class</div>
            <div className="text-lg font-bold">{profile.characterClass}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex-1 min-w-[140px]">
            <div className="text-xs text-muted-foreground mb-1">Tier</div>
            <div className={cn("text-lg font-bold capitalize", TIER_COLORS[profile.tier])}>
              {profile.tier}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex-1 min-w-[140px]">
            <div className="text-xs text-muted-foreground mb-1">Total Score</div>
            <div className="text-lg font-bold tabular-nums">{sc.score.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      </Section>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <Section title="Skills" icon={Zap}>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-card px-3 py-1 text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <Section title="Achievements" icon={Trophy}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profile.achievements.map((a) => {
              const Icon = ACHIEVEMENT_ICONS[a.id] || Award;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Trophy;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", accent)}>{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  sublabel,
  value,
  icon: Icon,
}: {
  label: string;
  sublabel: string;
  value: number;
  icon: typeof GitPullRequest;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sublabel}</div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BigStat({
  value,
  label,
  prefix,
  accent,
}: {
  value: number;
  label: string;
  prefix?: string;
  accent?: string;
}) {
  const formatted = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(1)}K`
      : String(value);

  return (
    <div>
      <div className={cn("text-3xl font-bold tabular-nums sm:text-4xl", accent)}>
        {prefix}{formatted}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-3 rounded-sm", color)} />
      <span>{label}</span>
    </div>
  );
}

function ActivityChart({ profile }: { profile: ProfileData }) {
  const allItems: { date: string; type: "pr" | "issue" | "review" | "comment" }[] = [];

  for (const pr of profile.recentPRs || []) {
    allItems.push({ date: pr.createdAt.slice(0, 10), type: "pr" });
  }
  for (const issue of profile.recentIssues || []) {
    allItems.push({ date: issue.createdAt.slice(0, 10), type: "issue" });
  }
  for (const review of profile.recentReviews || []) {
    allItems.push({ date: review.createdAt.slice(0, 10), type: "review" });
  }

  const now = new Date();
  const days: string[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }

  const buckets = days.map((day) => {
    const dayItems = allItems.filter((item) => item.date === day);
    return {
      day,
      label: new Date(day + "T00:00:00").getDate().toString().padStart(2, "0"),
      comments: profile.stats.comments > 0 ? dayItems.filter((i) => i.type === "comment").length : 0,
      issues: dayItems.filter((i) => i.type === "issue").length,
      prs: dayItems.filter((i) => i.type === "pr").length,
      reviews: dayItems.filter((i) => i.type === "review").length,
    };
  });

  const maxVal = Math.max(1, ...buckets.map((b) => b.comments + b.issues + b.prs + b.reviews));
  const chartH = 160;

  const yTicks = [];
  const step = Math.max(1, Math.ceil(maxVal / 4));
  for (let v = 0; v <= maxVal; v += step) {
    yTicks.push(v);
  }
  if (yTicks[yTicks.length - 1] < maxVal) yTicks.push(maxVal);

  return (
    <div className="flex gap-1">
      {/* Y-axis labels */}
      <div className="flex flex-col justify-between pr-1 text-right" style={{ height: chartH }}>
        {yTicks.slice().reverse().map((v) => (
          <span key={v} className="text-[10px] text-muted-foreground leading-none tabular-nums">{v}</span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex flex-1 items-end gap-[2px]" style={{ height: chartH }}>
        {buckets.map((b, i) => {
          const total = b.comments + b.issues + b.prs + b.reviews;
          const barH = total > 0 ? (total / maxVal) * chartH : 0;
          const commH = total > 0 ? (b.comments / total) * barH : 0;
          const issH = total > 0 ? (b.issues / total) * barH : 0;
          const prH = total > 0 ? (b.prs / total) * barH : 0;
          const revH = total > 0 ? (b.reviews / total) * barH : 0;
          const showLabel = i % 2 === 0;

          return (
            <div key={b.day} className="flex flex-1 flex-col items-center">
              <div className="flex w-full flex-col-reverse rounded-t-sm overflow-hidden" style={{ height: barH || 0 }}>
                {commH > 0 && <div className="w-full bg-teal-500" style={{ height: commH }} />}
                {issH > 0 && <div className="w-full bg-indigo-800 dark:bg-indigo-400" style={{ height: issH }} />}
                {prH > 0 && <div className="w-full bg-amber-500" style={{ height: prH }} />}
                {revH > 0 && <div className="w-full bg-red-500" style={{ height: revH }} />}
              </div>
              {showLabel && (
                <span className="mt-1 text-[9px] text-muted-foreground leading-none">{b.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
