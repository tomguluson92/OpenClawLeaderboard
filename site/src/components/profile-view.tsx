"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TIER_COLORS } from "@/lib/types";
import {
  ArrowLeft,
  ExternalLink,
  Github,
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
  TrendingUp,
  Award,
  Shield,
  Zap,
  Target,
  FileCode,
  Clock,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { DinqLink } from "./dinq-link";
import ReactMarkdown from "react-markdown";

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
  recentCommitDays?: Record<string, number>;
  recentActivityDays?: Record<string, { prs: number; issues: number; reviews: number }>;
  skills: string[];
  achievements: { id: string; label: string; description: string }[];
}

const tierGlow: Record<string, string> = {
  legend: "ring-yellow-500/20 dark:ring-yellow-500/30 shadow-lg dark:shadow-[0_0_40px_-8px_rgba(234,179,8,0.2)]",
  elite: "ring-purple-500/20 dark:ring-purple-500/30 shadow-lg dark:shadow-[0_0_40px_-8px_rgba(168,85,247,0.15)]",
  veteran: "ring-blue-500/15 dark:ring-blue-500/20 shadow-md dark:shadow-none",
  active: "ring-emerald-500/15 dark:ring-emerald-500/20 shadow-md dark:shadow-none",
  regular: "ring-border/30 dark:ring-border/40 shadow-sm dark:shadow-none",
  beginner: "ring-border/20 shadow-sm dark:shadow-none",
};

const tierGradient: Record<string, string> = {
  legend: "from-yellow-500/10 via-amber-500/5 to-transparent",
  elite: "from-purple-500/10 via-pink-500/5 to-transparent",
  veteran: "from-blue-500/8 via-cyan-500/3 to-transparent",
  active: "from-emerald-500/8 via-green-500/3 to-transparent",
  regular: "from-gray-500/5 to-transparent",
  beginner: "from-gray-500/3 to-transparent",
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

function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function ProfileView({ profile }: { profile: ProfileData }) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

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
      {/* Back */}
      <Link
        href="/"
        className="animate-fade-in group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        <span>Back to Leaderboard</span>
      </Link>

      {/* Hero card */}
      <div
        className={cn(
          "animate-fade-up relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 sm:p-8 ring-1",
          tierGradient[profile.tier] || tierGradient.beginner,
          tierGlow[profile.tier] || tierGlow.beginner,
          "border-border bg-card dark:border-border/40 dark:bg-card/60 dark:glass",
        )}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Image
                src={profile.avatarUrl}
                alt={profile.username}
                width={88}
                height={88}
                className="rounded-2xl ring-2 ring-border/40"
                unoptimized
              />
              <div className={cn(
                "absolute -bottom-1 -right-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                profile.tier === "legend" && "bg-yellow-500 text-yellow-950 border-yellow-400 dark:bg-yellow-500 dark:text-yellow-950 dark:border-yellow-400",
                profile.tier === "elite" && "bg-purple-500 text-white border-purple-400 dark:bg-purple-500 dark:text-white dark:border-purple-400",
                profile.tier === "veteran" && "bg-blue-500 text-white border-blue-400 dark:bg-blue-500 dark:text-white dark:border-blue-400",
                profile.tier === "active" && "bg-emerald-500 text-white border-emerald-400 dark:bg-emerald-500 dark:text-white dark:border-emerald-400",
                !["legend", "elite", "veteran", "active"].includes(profile.tier) && "bg-muted text-muted-foreground border-border",
              )}>
                {profile.tier}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-3xl font-extrabold tracking-tight">{profile.username}</h1>
                <a
                  href={profile.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center shrink-0 rounded-md transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                  title={`${profile.username} on GitHub`}
                >
                  <Github className="h-[18px] w-[18px]" />
                </a>
                <DinqLink username={profile.username} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">{profile.characterClass}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("font-display text-4xl font-extrabold tabular-nums tracking-tight", TIER_COLORS[profile.tier])}>
              {sc.score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">total points</div>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <Section title="AI Analysis" icon={Sparkles} delay={1} action={
        !summaryLoading && !summaryError && aiSummary ? (
          <button
            onClick={() => setSummaryExpanded(!summaryExpanded)}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-accent hover:scale-105 active:scale-95 dark:bg-card dark:shadow-none"
          >
            {summaryExpanded ? "Show less" : "Show more"}
          </button>
        ) : null
      }>
        {summaryLoading ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Generating detailed analysis...</span>
          </div>
        ) : summaryError ? (
          <p className="text-sm text-muted-foreground/70 italic">Unable to generate analysis.</p>
        ) : (
          <div className="relative">
            <div className={cn(
              "prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-h2:text-base prose-h2:font-bold prose-h2:mt-5 prose-h2:mb-2 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-1.5 prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-foreground/85 prose-li:text-[13px] prose-li:leading-relaxed prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-ul:my-1.5 prose-li:my-0.5 overflow-hidden transition-[max-height] duration-300",
              summaryExpanded ? "max-h-[5000px]" : "max-h-[280px]",
            )}>
              <ReactMarkdown>{aiSummary || ""}</ReactMarkdown>
            </div>
            {!summaryExpanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent dark:from-[rgba(14,18,30,0.7)]" />
            )}
          </div>
        )}
      </Section>

      {/* Activity + PR/Code grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <Section title="Recent Activity (Last 31 Days)" icon={Clock} delay={2}>
          <ActivityChart profile={profile} />
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] font-medium">
            <ChartLegend color="bg-teal-500" label="Commits" />
            <ChartLegend color="bg-indigo-700 dark:bg-indigo-400" label="Issues" />
            <ChartLegend color="bg-amber-500" label="PRs" />
            <ChartLegend color="bg-rose-500" label="Reviews" />
          </div>
          {profile.lastContribution && (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Last active: {formatDate(profile.lastContribution)} ({timeAgo(profile.lastContribution)})
            </p>
          )}
        </Section>

        <div className="flex flex-col gap-5">
          <Section title="Pull Requests &amp; Commits" icon={GitPullRequest} delay={3}>
            <div className="grid grid-cols-4 gap-3 text-center">
              <BigStat value={s.prs} label="PRs" />
              <BigStat value={s.commits} label="Commits" />
              <BigStat value={s.prsMerged} label="Merged" accent="text-purple-500" />
              <BigStat value={closedPrs} label="Closed" accent="text-muted-foreground" />
            </div>
          </Section>

          <Section title="Code Contributions" icon={Code} delay={4}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <BigStat value={totalChangedFiles} label="Files" />
              <BigStat value={totalAdditions} label="Additions" prefix="+" accent="text-emerald-500" />
              <BigStat value={totalDeletions} label="Deletions" prefix="-" accent="text-rose-500" />
            </div>
          </Section>
        </div>
      </div>

      {/* Score Breakdown */}
      <Section title="Score Breakdown" icon={TrendingUp} delay={5}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ScoreBar label="Code (pts)" value={sc.prScore} max={sc.score} color="bg-emerald-500" />
          <ScoreBar label="Issues (pts)" value={sc.issueScore} max={sc.score} color="bg-primary" />
          <ScoreBar label="Reviews (pts)" value={sc.reviewScore} max={sc.score} color="bg-blue-500" />
          <ScoreBar label="Comments (pts)" value={sc.commentScore} max={sc.score} color="bg-purple-500" />
        </div>
      </Section>

      {/* Recent PRs list */}
      {profile.recentPRs.length > 0 && (
        <Section title="Recent Pull Requests" icon={GitPullRequest} count={s.prs}>
          <div className="space-y-0.5">
            {profile.recentPRs.slice(0, 10).map((pr) => (
              <a
                key={pr.number}
                href={`https://github.com/openclaw/openclaw/pull/${pr.number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/pr flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent/40 transition-all"
              >
                {pr.merged ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-500" />
                ) : pr.state === "CLOSED" ? (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                ) : (
                  <GitPullRequest className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <span className="truncate flex-1 group-hover/pr:text-foreground transition-colors">{pr.title}</span>
                <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                  +{pr.additions}/-{pr.deletions}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">{timeAgo(pr.createdAt)}</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Issues */}
      {(s.issues > 0 || profile.recentIssues.length > 0) && (
        <Section title="Issues" icon={Bug} count={s.issues}>
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <MiniStat label="Filed" value={String(s.issues)} />
            <MiniStat label="Closed" value={String(s.issuesClosed)} accent="text-emerald-500" />
            <MiniStat label="Open" value={String(s.issues - s.issuesClosed)} accent="text-amber-500" />
          </div>
          {profile.recentIssues.length > 0 && (
            <div className="space-y-0.5">
              <h4 className="mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Recent</h4>
              {profile.recentIssues.slice(0, 8).map((issue) => (
                <a
                  key={issue.number}
                  href={`https://github.com/openclaw/openclaw/issues/${issue.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent/40 transition-all"
                >
                  {issue.state === "CLOSED" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-500" />
                  ) : (
                    <Bug className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <span className="truncate flex-1">{issue.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">{timeAgo(issue.createdAt)}</span>
                </a>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Role */}
      <Section title="Role" icon={Shield}>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-border bg-muted/50 dark:border-border/40 dark:bg-background/40 p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1.5">Class</div>
            <div className="font-display text-lg font-bold">{profile.characterClass}</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 dark:border-border/40 dark:bg-background/40 p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1.5">Tier</div>
            <div className={cn("font-display text-lg font-bold capitalize", TIER_COLORS[profile.tier])}>
              {profile.tier}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 dark:border-border/40 dark:bg-background/40 p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1.5">Score</div>
            <div className="font-display text-lg font-bold tabular-nums">{sc.score.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      </Section>

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <Section title="Achievements" icon={Trophy}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {profile.achievements.map((a) => {
              const Icon = ACHIEVEMENT_ICONS[a.id] || Award;
              return (
                <div
                  key={a.id}
                  className="group/ach flex items-center gap-3.5 rounded-xl border border-border bg-muted/50 dark:border-border/40 dark:bg-background/40 p-4 transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover/ach:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{a.label}</div>
                    <div className="text-xs text-muted-foreground/70">{a.description}</div>
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

/* ─── Sub-components ─── */

function Section({
  title,
  icon: Icon,
  count,
  delay,
  action,
  children,
}: {
  title: string;
  icon: typeof Trophy;
  count?: number;
  delay?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6 dark:border-border/40 dark:bg-card/60 dark:glass dark:shadow-none",
        delay !== undefined && "animate-fade-up",
      )}
      style={delay !== undefined ? { animationDelay: `${delay * 60}ms` } : undefined}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {count}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 dark:border-border/30 dark:bg-background/40 p-3">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</div>
      <div className={cn("font-display text-xl font-bold tabular-nums mt-0.5", accent)}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-display font-bold tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="h-2 rounded-full bg-muted dark:bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
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
  return (
    <div>
      <div className={cn("font-sans text-xl font-bold tabular-nums sm:text-2xl tracking-tight", accent)}>
        {prefix}{fmtNum(value)}
      </div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-[3px]", color)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ActivityChart({ profile }: { profile: ProfileData }) {
  const commitDays = profile.recentCommitDays || {};
  const activityDays = profile.recentActivityDays || {};

  const now = new Date();
  const days: string[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }

  const buckets = days.map((day) => {
    const act = activityDays[day] || { prs: 0, issues: 0, reviews: 0 };
    return {
      day,
      label: new Date(day + "T00:00:00").getDate().toString().padStart(2, "0"),
      commits: commitDays[day] || 0,
      prs: act.prs,
      issues: act.issues,
      reviews: act.reviews,
    };
  });

  const maxVal = Math.max(1, ...buckets.map((b) => b.commits + b.issues + b.prs + b.reviews));
  const chartH = 160;

  const yTicks = [];
  const step = Math.max(1, Math.ceil(maxVal / 4));
  for (let v = 0; v <= maxVal; v += step) {
    yTicks.push(v);
  }
  if (yTicks[yTicks.length - 1] < maxVal) yTicks.push(maxVal);

  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col justify-between pr-1 text-right" style={{ height: chartH }}>
        {yTicks.slice().reverse().map((v) => (
          <span key={v} className="text-[10px] text-muted-foreground/60 leading-none tabular-nums font-medium">{v}</span>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-[2px]" style={{ height: chartH }}>
        {buckets.map((b, i) => {
          const total = b.commits + b.issues + b.prs + b.reviews;
          const barH = total > 0 ? (total / maxVal) * chartH : 0;
          const cmtH = total > 0 ? (b.commits / total) * barH : 0;
          const issH = total > 0 ? (b.issues / total) * barH : 0;
          const prH = total > 0 ? (b.prs / total) * barH : 0;
          const revH = total > 0 ? (b.reviews / total) * barH : 0;
          return (
            <div key={b.day} className="group/bar flex flex-1 flex-col items-center">
              <div
                className="flex w-full flex-col-reverse rounded-t-sm overflow-hidden transition-opacity group-hover/bar:opacity-80"
                style={{ height: barH || 0 }}
              >
                {cmtH > 0 && <div className="w-full bg-teal-500" style={{ height: cmtH }} />}
                {issH > 0 && <div className="w-full bg-indigo-700 dark:bg-indigo-400" style={{ height: issH }} />}
                {prH > 0 && <div className="w-full bg-amber-500" style={{ height: prH }} />}
                {revH > 0 && <div className="w-full bg-rose-500" style={{ height: revH }} />}
              </div>
              {total === 0 && (
                <div className="w-full rounded-t-sm bg-border/20" style={{ height: 2 }} />
              )}
              <span className="mt-1.5 text-[8px] text-muted-foreground/50 leading-none font-medium">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
