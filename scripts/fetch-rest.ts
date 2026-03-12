#!/usr/bin/env bun
/**
 * Comprehensive contributor fetcher using GitHub REST + GraphQL APIs.
 * Fetches: contributors (commits), PRs, issues, reviews, comments
 * to build a complete picture of all 1100+ contributors.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const OWNER = "openclaw";
const REPO = "openclaw";
const OUTPUT_DIR = join(import.meta.dir, "..", "output");

const BOT_USERS = new Set([
  "dependabot[bot]", "dependabot", "dependabot-preview",
  "renovate[bot]", "renovate-bot", "renovate",
  "github-actions[bot]", "github-actions", "github-bot",
  "codecov", "codecov-io", "stale[bot]",
  "semantic-release-bot", "copilot-pull-request-reviewer",
  "imgbot", "coderabbitai", "codefactor-io", "graphite-app",
  "google-labs-jules[bot]", "cursor", "claude",
  "openclaw-bot", "clawdinator[bot]",
  "chatgpt-codex-connector", "greptile-apps",
]);

const TOKEN = process.env.GITHUB_TOKEN;
const HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "openclaw-leaderboard",
};
if (TOKEN) HEADERS.Authorization = `Bearer ${TOKEN}`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── REST helpers ───

async function fetchAllPages<T>(url: string, maxPages = 50): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (page <= maxPages) {
    const sep = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${sep}per_page=100&page=${page}`;
    process.stdout.write(`  page ${page}...`);

    const res = await fetch(fullUrl, { headers: HEADERS });

    if (res.status === 403 || res.status === 429) {
      const reset = res.headers.get("x-ratelimit-reset");
      const waitSec = reset ? Math.max(0, Number(reset) - Date.now() / 1000) + 2 : 60;
      console.log(` rate limited, waiting ${Math.ceil(waitSec)}s...`);
      await sleep(waitSec * 1000);
      continue;
    }

    if (!res.ok) {
      console.log(` error ${res.status}`);
      break;
    }

    const data = (await res.json()) as T[];
    if (!Array.isArray(data) || data.length === 0) {
      console.log(` done (empty)`);
      break;
    }
    console.log(` ${data.length} items`);
    all.push(...data);

    const link = res.headers.get("link") || "";
    if (!link.includes('rel="next"')) break;
    page++;
    await sleep(100);
  }

  return all;
}

// ─── GraphQL helper ───

const GQL_URL = "https://api.github.com/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(GQL_URL, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 403 || res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * 2 ** attempt, 120000);
      console.log(`  GraphQL rate limited, waiting ${Math.ceil(waitMs / 1000)}s...`);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GraphQL error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { data: T; errors?: { message: string }[] };
    if (json.errors) {
      console.warn("  GraphQL warnings:", json.errors.map((e) => e.message).join(", "));
    }
    return json.data;
  }
  throw new Error("Max retries exceeded");
}

// ─── GraphQL Queries ───

const PR_QUERY = `
query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        state
        merged
        createdAt
        mergedAt
        additions
        deletions
        changedFiles
        author { login avatarUrl }
        reviews(first: 10) {
          nodes {
            state
            createdAt
            author { login }
          }
        }
        comments(first: 5) {
          nodes {
            createdAt
            author { login }
          }
        }
      }
    }
  }
}`;

const ISSUE_QUERY = `
query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        state
        createdAt
        closedAt
        author { login avatarUrl }
        comments(first: 5) {
          totalCount
          nodes {
            createdAt
            author { login }
          }
        }
      }
    }
  }
}`;

// ─── Types ───

interface PRActivity {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  createdAt: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
}

interface IssueActivity {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  closedAt: string | null;
}

interface ReviewActivity {
  prNumber: number;
  state: string;
  createdAt: string;
}

interface UserStats {
  username: string;
  avatarUrl: string;
  commits: number;
  weeklyCommits: number;
  monthlyCommits: number;
  prs: number;
  prsMerged: number;
  prAdditions: number;
  prDeletions: number;
  prChangedFiles: number;
  issues: number;
  issuesClosed: number;
  reviews: number;
  reviewsApproved: number;
  reviewsChangesRequested: number;
  comments: number;
  weeklyPrs: number;
  weeklyPrsMerged: number;
  weeklyIssues: number;
  weeklyReviews: number;
  weeklyComments: number;
  monthlyPrs: number;
  monthlyPrsMerged: number;
  monthlyIssues: number;
  monthlyReviews: number;
  monthlyComments: number;
  prList: PRActivity[];
  issueList: IssueActivity[];
  reviewList: ReviewActivity[];
  firstContribution: string;
  lastContribution: string;
}

function newStats(username: string, avatarUrl: string): UserStats {
  return {
    username, avatarUrl,
    commits: 0, prs: 0, prsMerged: 0, prAdditions: 0, prDeletions: 0, prChangedFiles: 0,
    issues: 0, issuesClosed: 0, reviews: 0, reviewsApproved: 0, reviewsChangesRequested: 0, comments: 0,
    weeklyPrs: 0, weeklyPrsMerged: 0, weeklyIssues: 0, weeklyReviews: 0, weeklyComments: 0,
    monthlyPrs: 0, monthlyPrsMerged: 0, monthlyIssues: 0, monthlyReviews: 0, monthlyComments: 0,
    prList: [], issueList: [], reviewList: [],
    firstContribution: "", lastContribution: "",
  };
}

function trackDate(s: UserStats, date: string) {
  if (!s.firstContribution || date < s.firstContribution) s.firstContribution = date;
  if (!s.lastContribution || date > s.lastContribution) s.lastContribution = date;
}

function isBot(login: string): boolean {
  return BOT_USERS.has(login) || BOT_USERS.has(login.toLowerCase()) || login.endsWith("[bot]");
}

function getOrCreate(map: Map<string, UserStats>, login: string, avatarUrl = ""): UserStats {
  if (!map.has(login)) map.set(login, newStats(login, avatarUrl || `https://github.com/${login}.png`));
  const s = map.get(login)!;
  if (avatarUrl && !s.avatarUrl.includes("avatars")) s.avatarUrl = avatarUrl;
  return s;
}

// ─── Scoring ───

function calculateScore(s: UserStats, mode: "lifetime" | "monthly" | "weekly") {
  let prs: number, prsMerged: number, issues: number, reviews: number, comments: number;

  if (mode === "weekly") {
    prs = s.weeklyPrs; prsMerged = s.weeklyPrsMerged;
    issues = s.weeklyIssues; reviews = s.weeklyReviews; comments = s.weeklyComments;
  } else if (mode === "monthly") {
    prs = s.monthlyPrs; prsMerged = s.monthlyPrsMerged;
    issues = s.monthlyIssues; reviews = s.monthlyReviews; comments = s.monthlyComments;
  } else {
    prs = s.prs; prsMerged = s.prsMerged;
    issues = s.issues; reviews = s.reviews; comments = s.comments;
  }

  const commits = mode === "weekly" ? s.weeklyCommits : mode === "monthly" ? s.monthlyCommits : s.commits;
  const commitScore = commits * 5;

  const prBase = prs * 7;
  const prMergedBonus = prsMerged * 3;
  const prComplexity = mode === "lifetime"
    ? Math.min(Math.log(s.prAdditions + s.prDeletions + 1) * Math.min(s.prChangedFiles, 50) * 0.3, 300)
    : 0;
  const prScore = prBase + prMergedBonus + prComplexity + commitScore;

  const issueScore = issues * 5 + (mode === "lifetime" ? s.issuesClosed * 3 : 0);

  const reviewBase = reviews * 3;
  const reviewBonus = mode === "lifetime"
    ? s.reviewsApproved * 1 + s.reviewsChangesRequested * 1.5
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

function getCharacterClass(s: UserStats, login?: string): string {
  if (login && FIXED_ROLES[login]) return FIXED_ROLES[login];
  const total = s.prs + s.issues + s.reviews + s.comments + s.commits;
  if (total === 0) return "Contributor";
  const prPct = (s.prs + s.commits) / total;
  const issuePct = s.issues / total;
  const reviewPct = s.reviews / total;
  if (prPct >= 0.4 && reviewPct >= 0.2) return "Maintainer";
  if (prPct >= 0.5 && issuePct >= 0.15) return "Pathfinder";
  if (prPct >= 0.4) return "Builder";
  if (issuePct >= 0.3) return "Hunter";
  if (reviewPct >= 0.3) return "Reviewer";
  return "Contributor";
}

type Entry = {
  rank: number;
  username: string;
  avatarUrl: string;
  score: number;
  prScore: number;
  issueScore: number;
  reviewScore: number;
  commentScore: number;
  prsCount: number;
  issuesCount: number;
  reviewsCount: number;
  commentsCount: number;
  tier: string;
  characterClass: string;
  focusAreas: { tag: string; score: number; percentage: number }[];
  links: { github: string };
};

function isContributor(s: UserStats): boolean {
  return s.commits > 0 || s.prs > 0 || s.reviews > 0;
}

function buildLeaderboard(users: Map<string, UserStats>, mode: "lifetime" | "monthly" | "weekly"): Entry[] {
  const entries: Entry[] = [];

  for (const [login, stats] of users) {
    if (isBot(login)) continue;
    if (!isContributor(stats)) continue;
    const sc = calculateScore(stats, mode);
    if (sc.score === 0) continue;

    entries.push({
      rank: 0,
      username: login,
      avatarUrl: stats.avatarUrl,
      score: sc.score,
      prScore: sc.prScore,
      issueScore: sc.issueScore,
      reviewScore: sc.reviewScore,
      commentScore: sc.commentScore,
      prsCount: mode === "weekly" ? stats.weeklyPrs : mode === "monthly" ? stats.monthlyPrs : stats.prs,
      issuesCount: mode === "weekly" ? stats.weeklyIssues : mode === "monthly" ? stats.monthlyIssues : stats.issues,
      reviewsCount: mode === "weekly" ? stats.weeklyReviews : mode === "monthly" ? stats.monthlyReviews : stats.reviews,
      commentsCount: mode === "weekly" ? stats.weeklyComments : mode === "monthly" ? stats.monthlyComments : stats.comments,
      tier: getTier(sc.score),
      characterClass: getCharacterClass(stats, login),
      focusAreas: [],
      links: { github: `https://github.com/${login}` },
    });
  }

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

// ─── Main ───

async function main() {
  console.log("🦞 OpenClaw Leaderboard - Full Contributor Fetcher\n");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const users = new Map<string, UserStats>();

  // 1. Repo info
  console.log("📦 Fetching repo info...");
  const repoRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers: HEADERS });
  const repoInfo = (await repoRes.json()) as { description: string; stargazers_count: number; forks_count: number };
  console.log(`  Stars: ${repoInfo.stargazers_count}, Forks: ${repoInfo.forks_count}\n`);

  // 2. All contributors (commit-based, paginate fully)
  console.log("👥 Fetching contributors (commit-based)...");
  interface ContribAPI { login: string; avatar_url: string; contributions: number }
  const contributors = await fetchAllPages<ContribAPI>(
    `https://api.github.com/repos/${OWNER}/${REPO}/contributors`,
    50,
  );
  console.log(`  Total commit-contributors: ${contributors.length}`);
  for (const c of contributors) {
    if (isBot(c.login)) continue;
    const s = getOrCreate(users, c.login, c.avatar_url);
    s.commits = c.contributions;
  }

  // 3. Fetch PRs via GraphQL (much more data, paginate deeply)
  console.log("\n🔄 Fetching pull requests via GraphQL...");
  let prCursor: string | null = null;
  let prPage = 0;
  let prTotal = 0;
  const MAX_PR_PAGES = 80;

  while (prPage < MAX_PR_PAGES) {
    prPage++;
    process.stdout.write(`  page ${prPage}...`);

    const data = await gql<{
      repository: {
        pullRequests: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: {
            number: number;
            state: string;
            merged: boolean;
            createdAt: string;
            mergedAt: string | null;
            additions: number;
            deletions: number;
            changedFiles: number;
            author: { login: string; avatarUrl: string } | null;
            reviews: { nodes: { state: string; createdAt: string; author: { login: string } | null }[] };
            comments: { nodes: { createdAt: string; author: { login: string } | null }[] };
          }[];
        };
      };
    }>(PR_QUERY, { owner: OWNER, name: REPO, after: prCursor });

    const prs = data.repository.pullRequests.nodes;
    console.log(` ${prs.length} PRs`);
    prTotal += prs.length;

    for (const pr of prs) {
      const author = pr.author?.login;
      if (!author || isBot(author)) continue;

      const s = getOrCreate(users, author, pr.author!.avatarUrl);
      s.prs++;
      if (pr.merged) s.prsMerged++;
      s.prAdditions += pr.additions || 0;
      s.prDeletions += pr.deletions || 0;
      s.prChangedFiles += pr.changedFiles || 0;
      trackDate(s, pr.createdAt);

      s.prList.push({
        number: pr.number, title: (pr as any).title || `PR #${pr.number}`,
        state: pr.state, merged: pr.merged,
        createdAt: pr.createdAt, mergedAt: pr.mergedAt,
        additions: pr.additions || 0, deletions: pr.deletions || 0,
        changedFiles: pr.changedFiles || 0,
      });

      if (pr.createdAt >= weekAgo) {
        s.weeklyPrs++;
        if (pr.merged) s.weeklyPrsMerged++;
      }
      if (pr.createdAt >= monthAgo) {
        s.monthlyPrs++;
        if (pr.merged) s.monthlyPrsMerged++;
      }

      for (const review of pr.reviews.nodes) {
        const rAuthor = review.author?.login;
        if (!rAuthor || isBot(rAuthor)) continue;
        const rs = getOrCreate(users, rAuthor);
        rs.reviews++;
        if (review.state === "APPROVED") rs.reviewsApproved++;
        if (review.state === "CHANGES_REQUESTED") rs.reviewsChangesRequested++;
        if (review.createdAt >= weekAgo) rs.weeklyReviews++;
        if (review.createdAt >= monthAgo) rs.monthlyReviews++;
        trackDate(rs, review.createdAt);
        rs.reviewList.push({ prNumber: pr.number, state: review.state, createdAt: review.createdAt });
      }

      for (const comment of pr.comments.nodes) {
        const cAuthor = comment.author?.login;
        if (!cAuthor || isBot(cAuthor)) continue;
        const cs = getOrCreate(users, cAuthor);
        cs.comments++;
        if (comment.createdAt >= weekAgo) cs.weeklyComments++;
        if (comment.createdAt >= monthAgo) cs.monthlyComments++;
        trackDate(cs, comment.createdAt);
      }
    }

    if (!data.repository.pullRequests.pageInfo.hasNextPage) break;
    prCursor = data.repository.pullRequests.pageInfo.endCursor;
    await sleep(50);
  }
  console.log(`  Total PRs fetched: ${prTotal}`);

  // 4. Fetch Issues via GraphQL
  console.log("\n🐛 Fetching issues via GraphQL...");
  let issueCursor: string | null = null;
  let issuePage = 0;
  let issueTotal = 0;
  const MAX_ISSUE_PAGES = 50;

  while (issuePage < MAX_ISSUE_PAGES) {
    issuePage++;
    process.stdout.write(`  page ${issuePage}...`);

    const data = await gql<{
      repository: {
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: {
            number: number;
            state: string;
            createdAt: string;
            closedAt: string | null;
            author: { login: string; avatarUrl: string } | null;
            comments: {
              totalCount: number;
              nodes: { createdAt: string; author: { login: string } | null }[];
            };
          }[];
        };
      };
    }>(ISSUE_QUERY, { owner: OWNER, name: REPO, after: issueCursor });

    const issues = data.repository.issues.nodes;
    console.log(` ${issues.length} issues`);
    issueTotal += issues.length;

    for (const issue of issues) {
      const author = issue.author?.login;
      if (!author || isBot(author)) continue;

      const s = getOrCreate(users, author, issue.author!.avatarUrl);
      s.issues++;
      if (issue.state === "CLOSED") s.issuesClosed++;
      if (issue.createdAt >= weekAgo) s.weeklyIssues++;
      if (issue.createdAt >= monthAgo) s.monthlyIssues++;
      trackDate(s, issue.createdAt);

      s.issueList.push({
        number: issue.number, title: (issue as any).title || `Issue #${issue.number}`,
        state: issue.state, createdAt: issue.createdAt, closedAt: issue.closedAt,
      });

      for (const comment of issue.comments.nodes) {
        const cAuthor = comment.author?.login;
        if (!cAuthor || isBot(cAuthor)) continue;
        const cs = getOrCreate(users, cAuthor);
        cs.comments++;
        if (comment.createdAt >= weekAgo) cs.weeklyComments++;
        if (comment.createdAt >= monthAgo) cs.monthlyComments++;
        trackDate(cs, comment.createdAt);
      }
    }

    if (!data.repository.issues.pageInfo.hasNextPage) break;
    issueCursor = data.repository.issues.pageInfo.endCursor;
    await sleep(50);
  }
  console.log(`  Total issues fetched: ${issueTotal}`);

  // 5. Build leaderboards
  console.log(`\n📊 Total unique contributors: ${users.size}`);
  console.log("Building leaderboards...");

  const lifetimeBoard = buildLeaderboard(users, "lifetime");
  const monthlyBoard = buildLeaderboard(users, "monthly");
  const weeklyBoard = buildLeaderboard(users, "weekly");

  console.log(`  All Time: ${lifetimeBoard.length} contributors`);
  console.log(`  Monthly:  ${monthlyBoard.length} contributors`);
  console.log(`  Weekly:   ${weeklyBoard.length} contributors`);

  // 6. Write output
  const reposMeta = [{
    id: `${OWNER}/${REPO}`,
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    description: repoInfo.description,
  }];

  const files = [
    { name: "leaderboard-lifetime.json", period: "lifetime", label: "All Time", data: lifetimeBoard },
    { name: "leaderboard-monthly.json", period: "monthly", label: "Monthly", data: monthlyBoard },
    { name: "leaderboard-weekly.json", period: "weekly", label: "Weekly", data: weeklyBoard },
  ];

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
    console.log(`  ✅ ${label}: ${data.length} → output/${name}`);
  }

  // 7. Export per-user profiles
  console.log("\n📋 Exporting per-user profiles...");
  const profilesDir = join(OUTPUT_DIR, "profiles");
  mkdirSync(profilesDir, { recursive: true });

  let profileCount = 0;
  for (const [login, stats] of users) {
    if (isBot(login)) continue;
    if (!isContributor(stats)) continue;
    const sc = calculateScore(stats, "lifetime");
    if (sc.score === 0) continue;

    const achievements: { id: string; label: string; description: string }[] = [];
    if (stats.commits >= 100) achievements.push({ id: "centurion", label: "Centurion", description: "100+ commits" });
    if (stats.commits >= 500) achievements.push({ id: "marathon", label: "Marathon Coder", description: "500+ commits" });
    if (stats.commits >= 1000) achievements.push({ id: "legend-commits", label: "Commit Legend", description: "1000+ commits" });
    if (stats.prs >= 10) achievements.push({ id: "pr-machine", label: "PR Machine", description: "10+ pull requests" });
    if (stats.prs >= 50) achievements.push({ id: "pr-master", label: "PR Master", description: "50+ pull requests" });
    if (stats.prs >= 100) achievements.push({ id: "pr-legend", label: "PR Legend", description: "100+ pull requests" });
    if (stats.prsMerged >= 5) achievements.push({ id: "merger", label: "Merger", description: "5+ merged PRs" });
    if (stats.prsMerged >= 50) achievements.push({ id: "merge-master", label: "Merge Master", description: "50+ merged PRs" });
    if (stats.issues >= 5) achievements.push({ id: "bug-reporter", label: "Bug Reporter", description: "5+ issues filed" });
    if (stats.issues >= 20) achievements.push({ id: "issue-tracker", label: "Issue Tracker", description: "20+ issues filed" });
    if (stats.reviews >= 10) achievements.push({ id: "reviewer", label: "Code Reviewer", description: "10+ reviews" });
    if (stats.reviews >= 50) achievements.push({ id: "review-guru", label: "Review Guru", description: "50+ reviews" });
    if (stats.reviews >= 100) achievements.push({ id: "review-legend", label: "Review Legend", description: "100+ reviews" });
    if (stats.comments >= 20) achievements.push({ id: "conversationalist", label: "Conversationalist", description: "20+ comments" });
    if (stats.prAdditions >= 10000) achievements.push({ id: "prolific", label: "Prolific Coder", description: "10K+ lines added" });
    if (stats.prAdditions >= 50000) achievements.push({ id: "mega-coder", label: "Mega Coder", description: "50K+ lines added" });
    const mergeRate = stats.prs > 0 ? stats.prsMerged / stats.prs : 0;
    if (stats.prs >= 5 && mergeRate >= 0.9) achievements.push({ id: "precision", label: "Precision", description: "90%+ PR merge rate" });
    if (stats.prs > 0 && stats.reviews > 0 && stats.issues > 0) achievements.push({ id: "well-rounded", label: "Well Rounded", description: "Active in PRs, reviews, and issues" });

    const skills: string[] = [];
    if (stats.prs > 0) skills.push("Pull Requests");
    if (stats.reviews > 0) skills.push("Code Review");
    if (stats.issues > 0) skills.push("Issue Reporting");
    if (stats.comments > 0) skills.push("Discussion");
    if (stats.commits > 0) skills.push("Direct Commits");
    if (stats.prAdditions + stats.prDeletions > 5000) skills.push("Large-Scale Changes");
    if (stats.reviewsApproved > 10) skills.push("Approvals");
    if (stats.reviewsChangesRequested > 5) skills.push("Quality Gating");

    const profile = {
      username: login,
      avatarUrl: stats.avatarUrl,
      githubUrl: `https://github.com/${login}`,
      score: sc,
      tier: getTier(sc.score),
      characterClass: getCharacterClass(stats, login),
      stats: {
        commits: stats.commits,
        prs: stats.prs,
        prsMerged: stats.prsMerged,
        prAdditions: stats.prAdditions,
        prDeletions: stats.prDeletions,
        prChangedFiles: stats.prChangedFiles,
        prMergeRate: stats.prs > 0 ? Math.round(stats.prsMerged / stats.prs * 100) : 0,
        issues: stats.issues,
        issuesClosed: stats.issuesClosed,
        reviews: stats.reviews,
        reviewsApproved: stats.reviewsApproved,
        reviewsChangesRequested: stats.reviewsChangesRequested,
        comments: stats.comments,
      },
      period: {
        weekly: { prs: stats.weeklyPrs, issues: stats.weeklyIssues, reviews: stats.weeklyReviews, comments: stats.weeklyComments },
        monthly: { prs: stats.monthlyPrs, issues: stats.monthlyIssues, reviews: stats.monthlyReviews, comments: stats.monthlyComments },
      },
      firstContribution: stats.firstContribution || null,
      lastContribution: stats.lastContribution || null,
      recentPRs: stats.prList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
      recentIssues: stats.issueList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
      recentReviews: stats.reviewList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
      recentActivityDays: (() => {
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
        const days: Record<string, { prs: number; issues: number; reviews: number }> = {};
        for (const pr of stats.prList) {
          const d = pr.createdAt.slice(0, 10);
          if (d >= sixtyDaysAgo) { if (!days[d]) days[d] = { prs: 0, issues: 0, reviews: 0 }; days[d].prs++; }
        }
        for (const issue of stats.issueList) {
          const d = issue.createdAt.slice(0, 10);
          if (d >= sixtyDaysAgo) { if (!days[d]) days[d] = { prs: 0, issues: 0, reviews: 0 }; days[d].issues++; }
        }
        for (const review of stats.reviewList) {
          const d = review.createdAt.slice(0, 10);
          if (d >= sixtyDaysAgo) { if (!days[d]) days[d] = { prs: 0, issues: 0, reviews: 0 }; days[d].reviews++; }
        }
        return days;
      })(),
      skills,
      achievements,
    };

    writeFileSync(join(profilesDir, `${login}.json`), JSON.stringify(profile, null, 2));
    profileCount++;
  }
  console.log(`  ✅ Exported ${profileCount} user profiles → output/profiles/`);

  // Summary
  const summary = {
    generatedAt: now.toISOString(),
    totalContributors: lifetimeBoard.length,
    repositories: reposMeta,
    tierDistribution: {
      legend: lifetimeBoard.filter((c) => c.tier === "legend").length,
      elite: lifetimeBoard.filter((c) => c.tier === "elite").length,
      veteran: lifetimeBoard.filter((c) => c.tier === "veteran").length,
      active: lifetimeBoard.filter((c) => c.tier === "active").length,
      regular: lifetimeBoard.filter((c) => c.tier === "regular").length,
      beginner: lifetimeBoard.filter((c) => c.tier === "beginner").length,
    },
    top10: lifetimeBoard.slice(0, 10).map((c) => ({
      rank: c.rank, username: c.username, score: c.score, tier: c.tier, characterClass: c.characterClass,
    })),
  };
  writeFileSync(join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  // Print top 20
  console.log("\n🏆 Top 20 Contributors (All Time):");
  console.log("─".repeat(90));
  for (let i = 0; i < Math.min(20, lifetimeBoard.length); i++) {
    const c = lifetimeBoard[i];
    console.log(
      `  #${String(i + 1).padStart(2)} ${c.username.padEnd(30)} ${String(c.score).padStart(8)} pts  [${c.tier}/${c.characterClass}]  PR:${c.prsCount} Issue:${c.issuesCount} Review:${c.reviewsCount}`,
    );
  }

  console.log(`\n🎉 Done! ${lifetimeBoard.length} all-time, ${monthlyBoard.length} monthly, ${weeklyBoard.length} weekly contributors.`);
}

main().catch(console.error);
