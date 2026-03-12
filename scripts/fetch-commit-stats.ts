#!/usr/bin/env bun
/**
 * Fetch per-commit statistics (additions/deletions/changedFiles) via GraphQL
 * by iterating through the repo's commit history. Aggregates per-user and
 * updates existing profile JSONs.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const OWNER = "openclaw";
const REPO = "openclaw";
const OUTPUT_DIR = join(import.meta.dir, "..", "output");
const PROFILES_DIR = join(OUTPUT_DIR, "profiles");

const TOKEN = process.env.GITHUB_TOKEN;
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "User-Agent": "openclaw-leaderboard",
};
if (TOKEN) HEADERS.Authorization = `Bearer ${TOKEN}`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const COMMIT_HISTORY_QUERY = `
query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              oid
              additions
              deletions
              changedFilesIfAvailable
              committedDate
              author {
                user { login }
              }
            }
          }
        }
      }
    }
  }
}`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 403 || res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * 2 ** attempt, 120000);
      console.log(`  Rate limited, waiting ${Math.ceil(waitMs / 1000)}s...`);
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

interface CommitStats {
  totalAdditions: number;
  totalDeletions: number;
  totalChangedFiles: number;
  totalCommits: number;
  weeklyAdditions: number;
  weeklyDeletions: number;
  weeklyCommits: number;
  monthlyAdditions: number;
  monthlyDeletions: number;
  monthlyCommits: number;
  dailyCounts: Record<string, number>;
}

async function main() {
  console.log("📊 Fetching commit history via GraphQL...\n");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const userCommits = new Map<string, CommitStats>();

  let cursor: string | null = null;
  let page = 0;
  let totalCommits = 0;
  const MAX_PAGES = 300;

  while (page < MAX_PAGES) {
    page++;
    process.stdout.write(`  page ${page}...`);

    const data = await gql<{
      repository: {
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: { hasNextPage: boolean; endCursor: string };
              nodes: {
                oid: string;
                additions: number;
                deletions: number;
                changedFilesIfAvailable: number | null;
                committedDate: string;
                author: { user: { login: string } | null } | null;
              }[];
            };
          };
        };
      };
    }>(COMMIT_HISTORY_QUERY, { owner: OWNER, name: REPO, after: cursor });

    const commits = data.repository.defaultBranchRef.target.history.nodes;
    console.log(` ${commits.length} commits`);
    totalCommits += commits.length;

    for (const c of commits) {
      const login = c.author?.user?.login;
      if (!login) continue;

      if (!userCommits.has(login)) {
        userCommits.set(login, {
          totalAdditions: 0, totalDeletions: 0, totalChangedFiles: 0, totalCommits: 0,
          weeklyAdditions: 0, weeklyDeletions: 0, weeklyCommits: 0,
          monthlyAdditions: 0, monthlyDeletions: 0, monthlyCommits: 0,
          dailyCounts: {},
        });
      }
      const s = userCommits.get(login)!;

      s.totalAdditions += c.additions || 0;
      s.totalDeletions += c.deletions || 0;
      s.totalChangedFiles += c.changedFilesIfAvailable || 0;
      s.totalCommits++;

      const day = c.committedDate.slice(0, 10);
      s.dailyCounts[day] = (s.dailyCounts[day] || 0) + 1;

      if (c.committedDate >= weekAgo) {
        s.weeklyAdditions += c.additions || 0;
        s.weeklyDeletions += c.deletions || 0;
        s.weeklyCommits++;
      }
      if (c.committedDate >= monthAgo) {
        s.monthlyAdditions += c.additions || 0;
        s.monthlyDeletions += c.deletions || 0;
        s.monthlyCommits++;
      }
    }

    if (!data.repository.defaultBranchRef.target.history.pageInfo.hasNextPage) break;
    cursor = data.repository.defaultBranchRef.target.history.pageInfo.endCursor;
    await sleep(50);
  }

  console.log(`\n  Total commits fetched: ${totalCommits}`);
  console.log(`  Unique committers: ${userCommits.size}\n`);

  // Update profiles
  if (!existsSync(PROFILES_DIR)) {
    console.error("No profiles directory found.");
    process.exit(1);
  }

  const profileFiles = readdirSync(PROFILES_DIR).filter((f) => f.endsWith(".json"));
  let updated = 0;

  for (const file of profileFiles) {
    const path = join(PROFILES_DIR, file);
    const profile = JSON.parse(readFileSync(path, "utf-8"));
    const login = profile.username;
    const cd = userCommits.get(login);

    if (cd) {
      profile.stats.commitAdditions = cd.totalAdditions;
      profile.stats.commitDeletions = cd.totalDeletions;
      profile.stats.commitChangedFiles = cd.totalChangedFiles;

      profile.period.weekly.commitAdditions = cd.weeklyAdditions;
      profile.period.weekly.commitDeletions = cd.weeklyDeletions;
      profile.period.weekly.commits = cd.weeklyCommits;
      profile.period.monthly.commitAdditions = cd.monthlyAdditions;
      profile.period.monthly.commitDeletions = cd.monthlyDeletions;
      profile.period.monthly.commits = cd.monthlyCommits;

      const recent: Record<string, number> = {};
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
      for (const [day, count] of Object.entries(cd.dailyCounts)) {
        if (day >= sixtyDaysAgo) recent[day] = count;
      }
      profile.recentCommitDays = recent;

      updated++;
    } else {
      profile.stats.commitAdditions = profile.stats.commitAdditions || 0;
      profile.stats.commitDeletions = profile.stats.commitDeletions || 0;
      profile.stats.commitChangedFiles = profile.stats.commitChangedFiles || 0;
      profile.period.weekly.commitAdditions = profile.period.weekly.commitAdditions || 0;
      profile.period.weekly.commitDeletions = profile.period.weekly.commitDeletions || 0;
      profile.period.weekly.commits = profile.period.weekly.commits || 0;
      profile.period.monthly.commitAdditions = profile.period.monthly.commitAdditions || 0;
      profile.period.monthly.commitDeletions = profile.period.monthly.commitDeletions || 0;
      profile.period.monthly.commits = profile.period.monthly.commits || 0;
      if (!profile.recentCommitDays) profile.recentCommitDays = {};
    }

    writeFileSync(path, JSON.stringify(profile, null, 2));
  }

  console.log(`  ✅ Updated ${updated}/${profileFiles.length} profiles with commit stats`);

  // Sample output
  const examples = ["shakkernerd", "steipete", "bmendonca3", "vincentkoc", "Sid-Qin"];
  console.log("\n📋 Sample commit stats:");
  for (const login of examples) {
    const cd = userCommits.get(login);
    if (cd) {
      console.log(`  ${login}: ${cd.totalCommits} commits, +${cd.totalAdditions.toLocaleString()} / -${cd.totalDeletions.toLocaleString()}, ${cd.totalChangedFiles} files`);
    } else {
      console.log(`  ${login}: no commits found in history`);
    }
  }

  console.log("\n🎉 Done! Now run: bun scripts/rescore.ts");
}

main().catch(console.error);
