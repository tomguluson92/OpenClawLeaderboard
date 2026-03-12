#!/usr/bin/env node
/**
 * Lightweight contributor fetcher using GitHub REST API.
 * No external dependencies required - runs with plain Node.js 22+.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, "output");

// Load .env
if (existsSync(join(ROOT, ".env"))) {
  const envContent = readFileSync(join(ROOT, ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const OWNER = "openclaw";
const REPO = "openclaw";

const BOT_USERS = new Set([
  "dependabot[bot]", "dependabot", "renovate[bot]", "renovate-bot",
  "github-actions[bot]", "codecov", "stale[bot]", "imgbot",
  "coderabbitai", "copilot-pull-request-reviewer", "google-labs-jules[bot]",
  "cursor", "claude", "openclaw-bot",
]);

const HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "openclaw-leaderboard",
};
if (process.env.GITHUB_TOKEN) {
  HEADERS.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  console.log("✅ Using authenticated requests (higher rate limits)");
} else {
  console.log("⚠️  No GITHUB_TOKEN - using unauthenticated requests (60 req/hr)");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllPages(url, maxPages = 30) {
  const all = [];
  let page = 1;

  while (page <= maxPages) {
    const sep = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${sep}per_page=100&page=${page}`;
    const shortUrl = fullUrl.replace("https://api.github.com", "");
    process.stdout.write(`  GET ${shortUrl} ... `);

    const res = await fetch(fullUrl, { headers: HEADERS });

    const remaining = res.headers.get("x-ratelimit-remaining");
    process.stdout.write(`[${res.status}] (remaining: ${remaining})\n`);

    if (res.status === 403 || res.status === 429) {
      const reset = res.headers.get("x-ratelimit-reset");
      const waitSec = reset ? Math.max(0, Number(reset) - Date.now() / 1000) + 2 : 60;
      console.log(`  ⏳ Rate limited, waiting ${Math.ceil(waitSec)}s...`);
      await sleep(waitSec * 1000);
      continue;
    }

    if (!res.ok) {
      console.error(`  ❌ Error: ${await res.text()}`);
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);

    const link = res.headers.get("link") || "";
    if (!link.includes('rel="next"')) break;
    page++;
    await sleep(100);
  }

  return all;
}

function getTier(score) {
  if (score >= 5000) return "legend";
  if (score >= 1000) return "elite";
  if (score >= 500) return "veteran";
  if (score >= 200) return "active";
  if (score >= 50) return "regular";
  return "beginner";
}

function getCharacterClass(prPct, issuePct, reviewPct) {
  if (prPct >= 0.5 && reviewPct >= 0.25) return "Maintainer";
  if (prPct >= 0.5 && issuePct >= 0.25) return "Pathfinder";
  if (prPct >= 0.5) return "Builder";
  if (issuePct >= 0.25) return "Hunter";
  if (reviewPct >= 0.25) return "Reviewer";
  return "Contributor";
}

function buildEntry(login, avatarUrl, contributions, prData, issueData) {
  if (BOT_USERS.has(login)) return null;

  const commitScore = contributions * 2;
  const prScore = prData.prs * 7 + prData.merged * 3;
  const issueScore = issueData.issues * 5 + issueData.closed * 3;
  const reviewScore = Math.min(contributions * 0.5, 200);
  const totalScore = Math.round((commitScore + prScore + issueScore + reviewScore) * 100) / 100;

  if (totalScore === 0) return null;

  const total = commitScore + prScore + issueScore + reviewScore || 1;
  const prPct = (commitScore + prScore) / total;
  const issuePct = issueScore / total;
  const reviewPct = reviewScore / total;

  return {
    rank: 0,
    username: login,
    avatarUrl: avatarUrl || `https://github.com/${login}.png`,
    score: totalScore,
    prScore: Math.round(prScore * 100) / 100,
    issueScore: Math.round(issueScore * 100) / 100,
    reviewScore: Math.round(reviewScore * 100) / 100,
    commentScore: 0,
    prsCount: prData.prs,
    issuesCount: issueData.issues,
    reviewsCount: 0,
    commentsCount: 0,
    tier: getTier(totalScore),
    characterClass: getCharacterClass(prPct, issuePct, reviewPct),
    focusAreas: [],
    links: { github: `https://github.com/${login}` },
  };
}

async function main() {
  console.log("\n🦞 OpenClaw Leaderboard - Fetching contributor data\n");

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Fetch repo info
  console.log("📦 Fetching repo info...");
  const repoRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers: HEADERS });
  const repoInfo = await repoRes.json();
  console.log(`  Stars: ${repoInfo.stargazers_count}, Forks: ${repoInfo.forks_count}\n`);

  // 2. Fetch all contributors
  console.log("👥 Fetching contributors...");
  const contributors = await fetchAllPages(
    `https://api.github.com/repos/${OWNER}/${REPO}/contributors`,
    20,
  );
  console.log(`  📊 Total contributors: ${contributors.length}\n`);

  // 3. Fetch recent PRs
  console.log("🔄 Fetching recent pull requests...");
  const prs = await fetchAllPages(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls?state=all&sort=created&direction=desc`,
    15,
  );
  console.log(`  📊 Total PRs fetched: ${prs.length}\n`);

  // 4. Fetch recent issues
  console.log("🐛 Fetching recent issues...");
  const issues = await fetchAllPages(
    `https://api.github.com/repos/${OWNER}/${REPO}/issues?state=all&sort=created&direction=desc`,
    8,
  );
  const realIssues = issues.filter((i) => !i.pull_request);
  console.log(`  📊 Total issues: ${realIssues.length} (excluding PRs)\n`);

  // 5. Build per-user stats
  console.log("📊 Calculating scores...");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const userPRs = new Map();
  for (const pr of prs) {
    const login = pr.user?.login;
    if (!login || BOT_USERS.has(login)) continue;
    const e = userPRs.get(login) || { total: 0, weekly: 0, monthly: 0, merged: 0, weeklyMerged: 0, monthlyMerged: 0 };
    e.total++;
    if (pr.merged_at) e.merged++;
    if (pr.created_at >= weekAgo) { e.weekly++; if (pr.merged_at) e.weeklyMerged++; }
    if (pr.created_at >= monthAgo) { e.monthly++; if (pr.merged_at) e.monthlyMerged++; }
    userPRs.set(login, e);
  }

  const userIssues = new Map();
  for (const issue of realIssues) {
    const login = issue.user?.login;
    if (!login || BOT_USERS.has(login)) continue;
    const e = userIssues.get(login) || { total: 0, weekly: 0, monthly: 0, closed: 0 };
    e.total++;
    if (issue.state === "closed") e.closed++;
    if (issue.created_at >= weekAgo) e.weekly++;
    if (issue.created_at >= monthAgo) e.monthly++;
    userIssues.set(login, e);
  }

  // All-time leaderboard
  const lifetimeEntries = [];
  for (const c of contributors) {
    const prData = userPRs.get(c.login) || { total: 0, merged: 0 };
    const issData = userIssues.get(c.login) || { total: 0, closed: 0 };
    const entry = buildEntry(c.login, c.avatar_url, c.contributions,
      { prs: prData.total, merged: prData.merged },
      { issues: issData.total, closed: issData.closed });
    if (entry) lifetimeEntries.push(entry);
  }
  lifetimeEntries.sort((a, b) => b.score - a.score);
  lifetimeEntries.forEach((e, i) => (e.rank = i + 1));

  // Monthly
  const monthlyMap = new Map();
  for (const pr of prs) {
    if (!pr.user || BOT_USERS.has(pr.user.login) || pr.created_at < monthAgo) continue;
    const e = monthlyMap.get(pr.user.login) || { contributions: 0, avatarUrl: pr.user.avatar_url };
    e.contributions++;
    monthlyMap.set(pr.user.login, e);
  }
  for (const issue of realIssues) {
    if (!issue.user || BOT_USERS.has(issue.user.login) || issue.created_at < monthAgo) continue;
    const e = monthlyMap.get(issue.user.login) || { contributions: 0, avatarUrl: issue.user.avatar_url };
    e.contributions++;
    monthlyMap.set(issue.user.login, e);
  }
  const monthlyEntries = [];
  for (const [login, data] of monthlyMap) {
    const prData = userPRs.get(login) || {};
    const issData = userIssues.get(login) || {};
    const entry = buildEntry(login, data.avatarUrl, data.contributions,
      { prs: prData.monthly || 0, merged: prData.monthlyMerged || 0 },
      { issues: issData.monthly || 0, closed: issData.closed || 0 });
    if (entry) monthlyEntries.push(entry);
  }
  monthlyEntries.sort((a, b) => b.score - a.score);
  monthlyEntries.forEach((e, i) => (e.rank = i + 1));

  // Weekly
  const weeklyMap = new Map();
  for (const pr of prs) {
    if (!pr.user || BOT_USERS.has(pr.user.login) || pr.created_at < weekAgo) continue;
    const e = weeklyMap.get(pr.user.login) || { contributions: 0, avatarUrl: pr.user.avatar_url };
    e.contributions++;
    weeklyMap.set(pr.user.login, e);
  }
  for (const issue of realIssues) {
    if (!issue.user || BOT_USERS.has(issue.user.login) || issue.created_at < weekAgo) continue;
    const e = weeklyMap.get(issue.user.login) || { contributions: 0, avatarUrl: issue.user.avatar_url };
    e.contributions++;
    weeklyMap.set(issue.user.login, e);
  }
  const weeklyEntries = [];
  for (const [login, data] of weeklyMap) {
    const prData = userPRs.get(login) || {};
    const issData = userIssues.get(login) || {};
    const entry = buildEntry(login, data.avatarUrl, data.contributions,
      { prs: prData.weekly || 0, merged: prData.weeklyMerged || 0 },
      { issues: issData.weekly || 0, closed: issData.closed || 0 });
    if (entry) weeklyEntries.push(entry);
  }
  weeklyEntries.sort((a, b) => b.score - a.score);
  weeklyEntries.forEach((e, i) => (e.rank = i + 1));

  // 6. Write output
  const reposMeta = [{
    id: `${OWNER}/${REPO}`,
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    description: repoInfo.description,
  }];

  const files = [
    { name: "leaderboard-lifetime.json", period: "lifetime", label: "All Time", data: lifetimeEntries },
    { name: "leaderboard-monthly.json", period: "monthly", label: "Monthly", data: monthlyEntries },
    { name: "leaderboard-weekly.json", period: "weekly", label: "Weekly", data: weeklyEntries },
  ];

  console.log("");
  for (const { name, period, label, data } of files) {
    const output = {
      version: "1.0",
      period,
      label,
      generatedAt: now.toISOString(),
      totalUsers: data.length,
      repositories: reposMeta,
      leaderboard: data,
    };
    writeFileSync(join(OUTPUT_DIR, name), JSON.stringify(output, null, 2));
    console.log(`  ✅ ${label}: ${data.length} contributors → output/${name}`);
  }

  // Summary
  const summary = {
    generatedAt: now.toISOString(),
    totalContributors: lifetimeEntries.length,
    repositories: reposMeta,
    tierDistribution: {
      legend: lifetimeEntries.filter((c) => c.tier === "legend").length,
      elite: lifetimeEntries.filter((c) => c.tier === "elite").length,
      veteran: lifetimeEntries.filter((c) => c.tier === "veteran").length,
      active: lifetimeEntries.filter((c) => c.tier === "active").length,
      regular: lifetimeEntries.filter((c) => c.tier === "regular").length,
      beginner: lifetimeEntries.filter((c) => c.tier === "beginner").length,
    },
  };
  writeFileSync(join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`  ✅ Summary exported`);

  // Print top 20
  console.log("\n🏆 Top 20 Contributors (All Time):");
  console.log("─".repeat(80));
  for (let i = 0; i < Math.min(20, lifetimeEntries.length); i++) {
    const c = lifetimeEntries[i];
    console.log(
      `  #${String(i + 1).padStart(2)} ${c.username.padEnd(30)} ${String(c.score).padStart(8)} pts  [${c.tier}/${c.characterClass}]`,
    );
  }

  console.log(`\n🎉 Done! ${lifetimeEntries.length} all-time, ${monthlyEntries.length} monthly, ${weeklyEntries.length} weekly.`);
}

main().catch(console.error);
