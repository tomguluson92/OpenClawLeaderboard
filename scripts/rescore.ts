#!/usr/bin/env bun
/**
 * Re-score existing profile data and rebuild leaderboard JSONs
 * without re-fetching from GitHub API.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(import.meta.dir, "..", "output");
const PROFILES_DIR = join(OUTPUT_DIR, "profiles");

interface ProfileStats {
  commits: number;
  prs: number;
  prsMerged: number;
  prAdditions: number;
  prDeletions: number;
  prChangedFiles: number;
  prMergeRate: number;
  commitAdditions?: number;
  commitDeletions?: number;
  commitChangedFiles?: number;
  issues: number;
  issuesClosed: number;
  reviews: number;
  reviewsApproved: number;
  reviewsChangesRequested: number;
  comments: number;
}

interface Profile {
  username: string;
  avatarUrl: string;
  githubUrl: string;
  score: { score: number; prScore: number; issueScore: number; reviewScore: number; commentScore: number };
  tier: string;
  characterClass: string;
  stats: ProfileStats;
  period: {
    weekly: { prs: number; issues: number; reviews: number; comments: number; commits?: number; commitAdditions?: number; commitDeletions?: number };
    monthly: { prs: number; issues: number; reviews: number; comments: number; commits?: number; commitAdditions?: number; commitDeletions?: number };
  };
  firstContribution: string | null;
  lastContribution: string | null;
  recentPRs: any[];
  recentIssues: any[];
  recentReviews: any[];
  skills: string[];
  achievements: any[];
}

function calculateScore(
  stats: ProfileStats,
  period: { prs: number; issues: number; reviews: number; comments: number } | null,
  mode: "lifetime" | "monthly" | "weekly",
) {
  let prs: number, prsMerged: number, issues: number, reviews: number, comments: number;

  if (mode === "weekly" && period) {
    prs = period.prs; prsMerged = 0; issues = period.issues; reviews = period.reviews; comments = period.comments;
  } else if (mode === "monthly" && period) {
    prs = period.prs; prsMerged = 0; issues = period.issues; reviews = period.reviews; comments = period.comments;
  } else {
    prs = stats.prs; prsMerged = stats.prsMerged;
    issues = stats.issues; reviews = stats.reviews; comments = stats.comments;
  }

  const commits = stats.commits;
  const commitScore = mode === "lifetime" ? commits * 5 : 0;

  const prBase = prs * 7;
  const prMergedBonus = prsMerged * 3;
  const totalAdd = (stats.prAdditions || 0) + (stats.commitAdditions || 0);
  const totalDel = (stats.prDeletions || 0) + (stats.commitDeletions || 0);
  const totalFiles = (stats.prChangedFiles || 0) + (stats.commitChangedFiles || 0);
  const prComplexity = mode === "lifetime"
    ? Math.min(Math.log(totalAdd + totalDel + 1) * Math.min(totalFiles, 50) * 0.3, 300)
    : 0;
  const prScore = prBase + prMergedBonus + prComplexity + commitScore;

  const issueScore = issues * 5 + (mode === "lifetime" ? stats.issuesClosed * 3 : 0);

  const reviewBase = reviews * 3;
  const reviewBonus = mode === "lifetime"
    ? stats.reviewsApproved * 1 + stats.reviewsChangesRequested * 1.5
    : 0;
  const reviewScore = reviewBase + reviewBonus;

  const commentScore = Math.min(comments * 0.5, mode === "lifetime" ? 100 : 20);

  const totalScore = Math.round((prScore + issueScore + reviewScore + commentScore) * 100) / 100;

  return {
    score: totalScore,
    prScore: Math.round(prScore * 100) / 100,
    issueScore: Math.round(issueScore * 100) / 100,
    reviewScore: Math.round(reviewScore * 100) / 100,
    commentScore: Math.round(commentScore * 100) / 100,
  };
}

function getTier(score: number): string {
  if (score >= 5000) return "legend";
  if (score >= 1000) return "elite";
  if (score >= 500) return "veteran";
  if (score >= 200) return "active";
  if (score >= 50) return "regular";
  return "beginner";
}

const FIXED_ROLES: Record<string, string> = {
  steipete: "Founder",
};

function getCharacterClass(stats: ProfileStats, username?: string): string {
  if (username && FIXED_ROLES[username]) return FIXED_ROLES[username];
  const total = stats.prs + stats.issues + stats.reviews + stats.comments + stats.commits;
  if (total === 0) return "Contributor";
  const prPct = (stats.prs + stats.commits) / total;
  const issuePct = stats.issues / total;
  const reviewPct = stats.reviews / total;
  if (prPct >= 0.4 && reviewPct >= 0.2) return "Maintainer";
  if (prPct >= 0.5 && issuePct >= 0.15) return "Pathfinder";
  if (prPct >= 0.4) return "Builder";
  if (issuePct >= 0.3) return "Hunter";
  if (reviewPct >= 0.3) return "Reviewer";
  return "Contributor";
}

function main() {
  console.log("🔄 Re-scoring profiles with updated formula...\n");

  if (!existsSync(PROFILES_DIR)) {
    console.error("No profiles directory found. Run fetch-rest.ts first.");
    process.exit(1);
  }

  const profileFiles = readdirSync(PROFILES_DIR).filter((f) => f.endsWith(".json"));
  console.log(`  Found ${profileFiles.length} profiles`);

  const profiles: Profile[] = [];
  for (const file of profileFiles) {
    const raw = readFileSync(join(PROFILES_DIR, file), "utf-8");
    profiles.push(JSON.parse(raw));
  }

  // Re-score each profile and update profile files
  for (const p of profiles) {
    const newScore = calculateScore(p.stats, null, "lifetime");
    p.score = newScore;
    p.tier = getTier(newScore.score);
    p.characterClass = getCharacterClass(p.stats, p.username);
    p.stats.prMergeRate = p.stats.prs > 0 ? Math.round(p.stats.prsMerged / p.stats.prs * 100) : 0;
    writeFileSync(join(PROFILES_DIR, `${p.username}.json`), JSON.stringify(p, null, 2));
  }

  // Load repo meta from existing leaderboard
  let reposMeta: any[] = [];
  const existingLt = join(OUTPUT_DIR, "leaderboard-lifetime.json");
  if (existsSync(existingLt)) {
    const existing = JSON.parse(readFileSync(existingLt, "utf-8"));
    reposMeta = existing.repositories || [];
  }

  // Build leaderboards
  const modes: Array<{ mode: "lifetime" | "monthly" | "weekly"; filename: string; label: string }> = [
    { mode: "lifetime", filename: "leaderboard-lifetime.json", label: "All Time" },
    { mode: "monthly", filename: "leaderboard-monthly.json", label: "Monthly" },
    { mode: "weekly", filename: "leaderboard-weekly.json", label: "Weekly" },
  ];

  const now = new Date();

  for (const { mode, filename, label } of modes) {
    const entries: any[] = [];

    for (const p of profiles) {
      const period = mode === "weekly" ? p.period.weekly : mode === "monthly" ? p.period.monthly : null;
      const sc = calculateScore(p.stats, period, mode);
      if (sc.score === 0) continue;

      entries.push({
        rank: 0,
        username: p.username,
        avatarUrl: p.avatarUrl,
        score: sc.score,
        prScore: sc.prScore,
        issueScore: sc.issueScore,
        reviewScore: sc.reviewScore,
        commentScore: sc.commentScore,
        prsCount: mode === "weekly" ? p.period.weekly.prs : mode === "monthly" ? p.period.monthly.prs : p.stats.prs,
        issuesCount: mode === "weekly" ? p.period.weekly.issues : mode === "monthly" ? p.period.monthly.issues : p.stats.issues,
        reviewsCount: mode === "weekly" ? p.period.weekly.reviews : mode === "monthly" ? p.period.monthly.reviews : p.stats.reviews,
        commentsCount: mode === "weekly" ? p.period.weekly.comments : mode === "monthly" ? p.period.monthly.comments : p.stats.comments,
        tier: getTier(sc.score),
        characterClass: getCharacterClass(p.stats, p.username),
        focusAreas: [],
        links: { github: p.githubUrl },
      });
    }

    entries.sort((a: any, b: any) => b.score - a.score);
    entries.forEach((e: any, i: number) => (e.rank = i + 1));

    const output = {
      version: "1.0",
      period: mode,
      label,
      generatedAt: now.toISOString(),
      totalUsers: entries.length,
      repositories: reposMeta,
      leaderboard: entries,
    };

    writeFileSync(join(OUTPUT_DIR, filename), JSON.stringify(output, null, 2));
    console.log(`  ✅ ${label}: ${entries.length} contributors → output/${filename}`);
  }

  // Re-export summary
  const ltBoard = JSON.parse(readFileSync(join(OUTPUT_DIR, "leaderboard-lifetime.json"), "utf-8")).leaderboard;
  const summary = {
    generatedAt: now.toISOString(),
    totalContributors: ltBoard.length,
    repositories: reposMeta,
    tierDistribution: {
      legend: ltBoard.filter((c: any) => c.tier === "legend").length,
      elite: ltBoard.filter((c: any) => c.tier === "elite").length,
      veteran: ltBoard.filter((c: any) => c.tier === "veteran").length,
      active: ltBoard.filter((c: any) => c.tier === "active").length,
      regular: ltBoard.filter((c: any) => c.tier === "regular").length,
      beginner: ltBoard.filter((c: any) => c.tier === "beginner").length,
    },
    top10: ltBoard.slice(0, 10).map((c: any) => ({
      rank: c.rank, username: c.username, score: c.score, tier: c.tier, characterClass: c.characterClass,
    })),
  };
  writeFileSync(join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  // Print top 30 and shakkernerd
  console.log("\n🏆 Top 30 Contributors (All Time) — Updated Scoring:");
  console.log("─".repeat(100));
  for (let i = 0; i < Math.min(30, ltBoard.length); i++) {
    const c = ltBoard[i];
    console.log(
      `  #${String(i + 1).padStart(2)} ${c.username.padEnd(30)} ${String(c.score).padStart(8)} pts  [${c.tier}/${c.characterClass}]  PR:${c.prsCount} Issue:${c.issuesCount} Review:${c.reviewsCount}`,
    );
  }

  const shakkernerd = ltBoard.find((c: any) => c.username === "shakkernerd");
  if (shakkernerd) {
    console.log(`\n🔍 shakkernerd: rank #${shakkernerd.rank}, score: ${shakkernerd.score}, tier: ${shakkernerd.tier}`);
  }

  console.log(`\n🎉 Re-scoring complete!`);
}

main();
