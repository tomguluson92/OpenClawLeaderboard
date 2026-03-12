import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "./db.js";
import * as schema from "./schema.js";
import {
  fetchPullRequests,
  fetchIssues,
  fetchCommits,
  fetchRepoInfo,
} from "./github.js";
import { calculateContributorScore } from "./scoring.js";
import type {
  PipelineConfig,
  ContributorScore,
  GHPullRequest,
  GHIssue,
} from "./types.js";
import { getTier, getCharacterClass } from "./types.js";

// ===================== INGEST =====================

export async function ingest(
  config: PipelineConfig,
  token: string,
  days: number,
  verbose: boolean,
) {
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString();
  const untilStr = now.toISOString();

  console.log(`\nIngesting data from ${sinceStr.slice(0, 10)} to ${untilStr.slice(0, 10)}`);

  for (const repo of config.PIPELINE_REPOS) {
    const repoId = `${repo.owner}/${repo.name}`;
    console.log(`\n📦 Processing ${repoId}...`);

    // Upsert repository
    const repoInfo = await fetchRepoInfo(token, repo.owner, repo.name);
    db.insert(schema.repositories)
      .values({
        repoId,
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.defaultBranch,
        description: repoInfo.description,
        stars: repoInfo.stars,
        forks: repoInfo.forks,
        lastFetchedAt: untilStr,
      })
      .onConflictDoUpdate({
        target: schema.repositories.repoId,
        set: {
          description: repoInfo.description,
          stars: repoInfo.stars,
          forks: repoInfo.forks,
          lastFetchedAt: untilStr,
        },
      })
      .run();

    // Fetch PRs
    console.log("  Fetching pull requests...");
    const prs = await fetchPullRequests(token, repo.owner, repo.name, sinceStr, untilStr);
    console.log(`  Found ${prs.length} PRs`);
    await storePullRequests(db, prs, repoId, config);

    // Fetch Issues
    console.log("  Fetching issues...");
    const issues = await fetchIssues(token, repo.owner, repo.name, sinceStr, untilStr);
    console.log(`  Found ${issues.length} issues`);
    await storeIssues(db, issues, repoId, config);

    // Fetch Commits
    console.log("  Fetching commits...");
    const commits = await fetchCommits(
      token,
      repo.owner,
      repo.name,
      repo.defaultBranch,
      sinceStr,
      untilStr,
    );
    console.log(`  Found ${commits.length} commits`);
    await storeCommits(db, commits, repoId, config);
  }

  console.log("\n✅ Ingestion complete!");
}

async function storePullRequests(
  db: ReturnType<typeof getDb>,
  prs: GHPullRequest[],
  repoId: string,
  config: PipelineConfig,
) {
  const botUsers = new Set(config.PIPELINE_BOT_USERS.map((u) => u.toLowerCase()));

  for (const pr of prs) {
    const author = pr.author?.login;
    if (!author || botUsers.has(author.toLowerCase())) continue;

    // Upsert user
    db.insert(schema.users)
      .values({
        username: author,
        avatarUrl: pr.author?.avatarUrl,
        lastUpdated: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: schema.users.username,
        set: {
          avatarUrl: pr.author?.avatarUrl,
          lastUpdated: new Date().toISOString(),
        },
      })
      .run();

    // Insert PR
    db.insert(schema.rawPullRequests)
      .values({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        merged: pr.merged,
        author,
        repository: repoId,
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        closedAt: pr.closedAt,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
      })
      .onConflictDoUpdate({
        target: schema.rawPullRequests.id,
        set: {
          state: pr.state,
          merged: pr.merged,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
        },
      })
      .run();

    // Store PR files
    if (pr.files?.nodes) {
      for (const file of pr.files.nodes) {
        db.insert(schema.rawPullRequestFiles)
          .values({
            id: `${pr.id}:${file.path}`,
            prId: pr.id,
            path: file.path,
            additions: file.additions,
            deletions: file.deletions,
          })
          .onConflictDoNothing()
          .run();
      }
    }

    // Store reviews
    if (pr.reviews?.nodes) {
      for (const review of pr.reviews.nodes) {
        const reviewAuthor = review.author?.login;
        if (!reviewAuthor || botUsers.has(reviewAuthor.toLowerCase())) continue;

        // Upsert review author
        db.insert(schema.users)
          .values({ username: reviewAuthor, lastUpdated: new Date().toISOString() })
          .onConflictDoNothing()
          .run();

        db.insert(schema.prReviews)
          .values({
            id: review.id,
            prId: pr.id,
            author: reviewAuthor,
            state: review.state,
            body: review.body,
            createdAt: review.createdAt,
            repository: repoId,
          })
          .onConflictDoNothing()
          .run();
      }
    }

    // Store PR comments
    if (pr.comments?.nodes) {
      for (const comment of pr.comments.nodes) {
        const commentAuthor = comment.author?.login;
        if (!commentAuthor || botUsers.has(commentAuthor.toLowerCase())) continue;

        db.insert(schema.users)
          .values({ username: commentAuthor, lastUpdated: new Date().toISOString() })
          .onConflictDoNothing()
          .run();

        db.insert(schema.prComments)
          .values({
            id: comment.id,
            prId: pr.id,
            author: commentAuthor,
            body: comment.body,
            createdAt: comment.createdAt,
            repository: repoId,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  }
}

async function storeIssues(
  db: ReturnType<typeof getDb>,
  issues: GHIssue[],
  repoId: string,
  config: PipelineConfig,
) {
  const botUsers = new Set(config.PIPELINE_BOT_USERS.map((u) => u.toLowerCase()));

  for (const issue of issues) {
    const author = issue.author?.login;
    if (!author || botUsers.has(author.toLowerCase())) continue;

    db.insert(schema.users)
      .values({
        username: author,
        avatarUrl: issue.author?.avatarUrl,
        lastUpdated: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: schema.users.username,
        set: { avatarUrl: issue.author?.avatarUrl, lastUpdated: new Date().toISOString() },
      })
      .run();

    db.insert(schema.rawIssues)
      .values({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author,
        repository: repoId,
        createdAt: issue.createdAt,
        closedAt: issue.closedAt,
        commentCount: issue.comments.totalCount,
      })
      .onConflictDoUpdate({
        target: schema.rawIssues.id,
        set: {
          state: issue.state,
          closedAt: issue.closedAt,
          commentCount: issue.comments.totalCount,
        },
      })
      .run();

    // Store issue comments
    if (issue.comments?.nodes) {
      for (const comment of issue.comments.nodes) {
        const commentAuthor = comment.author?.login;
        if (!commentAuthor || botUsers.has(commentAuthor.toLowerCase())) continue;

        db.insert(schema.users)
          .values({ username: commentAuthor, lastUpdated: new Date().toISOString() })
          .onConflictDoNothing()
          .run();

        db.insert(schema.issueComments)
          .values({
            id: comment.id,
            issueId: issue.id,
            author: commentAuthor,
            body: comment.body,
            createdAt: comment.createdAt,
            repository: repoId,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  }
}

async function storeCommits(
  db: ReturnType<typeof getDb>,
  commits: import("./types.js").GHCommit[],
  repoId: string,
  config: PipelineConfig,
) {
  const botUsers = new Set(config.PIPELINE_BOT_USERS.map((u) => u.toLowerCase()));

  for (const commit of commits) {
    const author = commit.author.user?.login || commit.author.name;
    if (!author || botUsers.has(author.toLowerCase())) continue;

    db.insert(schema.users)
      .values({ username: author, lastUpdated: new Date().toISOString() })
      .onConflictDoNothing()
      .run();

    db.insert(schema.rawCommits)
      .values({
        oid: commit.oid,
        message: commit.message,
        author,
        authorEmail: commit.author.email,
        repository: repoId,
        committedDate: commit.committedDate,
        additions: commit.additions,
        deletions: commit.deletions,
        changedFiles: commit.changedFiles,
      })
      .onConflictDoNothing()
      .run();
  }
}

// ===================== PROCESS =====================

type Period = "lifetime" | "monthly" | "weekly";

function getDateCutoff(period: Period): string | null {
  if (period === "lifetime") return null;
  const now = new Date();
  if (period === "weekly") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function processForPeriod(
  db: ReturnType<typeof getDb>,
  config: PipelineConfig,
  period: Period,
  verbose: boolean,
): ContributorScore[] {
  const cutoff = getDateCutoff(period);
  const allUsers = db.select().from(schema.users).all();
  const results: ContributorScore[] = [];

  for (const user of allUsers) {
    if (user.isBot) continue;

    let userPRs = db
      .select()
      .from(schema.rawPullRequests)
      .where(eq(schema.rawPullRequests.author, user.username))
      .all();
    if (cutoff) userPRs = userPRs.filter((pr) => (pr.createdAt || "") >= cutoff);

    let userIssues = db
      .select()
      .from(schema.rawIssues)
      .where(eq(schema.rawIssues.author, user.username))
      .all();
    if (cutoff) userIssues = userIssues.filter((i) => (i.createdAt || "") >= cutoff);

    let userReviews = db
      .select()
      .from(schema.prReviews)
      .where(eq(schema.prReviews.author, user.username))
      .all();
    if (cutoff) userReviews = userReviews.filter((r) => (r.createdAt || "") >= cutoff);

    let userPRComments = db
      .select()
      .from(schema.prComments)
      .where(eq(schema.prComments.author, user.username))
      .all();
    if (cutoff) userPRComments = userPRComments.filter((c) => (c.createdAt || "") >= cutoff);

    let userIssueComments = db
      .select()
      .from(schema.issueComments)
      .where(eq(schema.issueComments.author, user.username))
      .all();
    if (cutoff) userIssueComments = userIssueComments.filter((c) => (c.createdAt || "") >= cutoff);

    const allComments = [
      ...userPRComments.map((c) => ({ parentId: c.prId })),
      ...userIssueComments.map((c) => ({ parentId: c.issueId })),
    ];

    const scores = calculateContributorScore(
      userPRs.map((pr) => ({
        merged: pr.merged || false,
        body: pr.body,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changedFiles || 0,
        createdAt: pr.createdAt || "",
      })),
      userIssues.map((issue) => ({
        state: issue.state || "",
        commentCount: issue.commentCount || 0,
      })),
      userReviews.map((review) => ({
        state: review.state || "",
        body: review.body,
        createdAt: review.createdAt || "",
      })),
      allComments,
      config.PIPELINE_SCORING,
    );

    if (scores.totalScore === 0) continue;

    const focusAreas = calculateFocusAreas(db, user.username, config);

    const contributor: ContributorScore = {
      username: user.username,
      avatarUrl: user.avatarUrl || "",
      scores,
      prsCount: userPRs.length,
      issuesCount: userIssues.length,
      reviewsCount: userReviews.length,
      commentsCount: allComments.length,
      focusAreas,
      tier: getTier(scores.totalScore),
      characterClass: getCharacterClass(scores),
    };

    results.push(contributor);

    const scoreId = `${user.username}_${period}_all`;
    db.insert(schema.userDailyScores)
      .values({
        id: scoreId,
        username: user.username,
        date: new Date().toISOString().slice(0, 10),
        category: period,
        score: scores.totalScore,
        prScore: scores.prScore,
        issueScore: scores.issueScore,
        reviewScore: scores.reviewScore,
        commentScore: scores.commentScore,
        prsCount: userPRs.length,
        issuesCount: userIssues.length,
        reviewsCount: userReviews.length,
        commentsCount: allComments.length,
        metrics: JSON.stringify({ focusAreas, tier: contributor.tier, characterClass: contributor.characterClass }),
      })
      .onConflictDoUpdate({
        target: schema.userDailyScores.id,
        set: {
          score: scores.totalScore,
          prScore: scores.prScore,
          issueScore: scores.issueScore,
          reviewScore: scores.reviewScore,
          commentScore: scores.commentScore,
          prsCount: userPRs.length,
          issuesCount: userIssues.length,
          reviewsCount: userReviews.length,
          commentsCount: allComments.length,
          metrics: JSON.stringify({ focusAreas, tier: contributor.tier, characterClass: contributor.characterClass }),
          date: new Date().toISOString().slice(0, 10),
        },
      })
      .run();

    if (verbose) {
      console.log(
        `  ${user.username}: ${scores.totalScore} pts (PR:${scores.prScore} Issue:${scores.issueScore} Review:${scores.reviewScore} Comment:${scores.commentScore}) [${contributor.tier}/${contributor.characterClass}]`,
      );
    }
  }

  results.sort((a, b) => b.scores.totalScore - a.scores.totalScore);
  return results;
}

export async function process(
  config: PipelineConfig,
  force: boolean,
  verbose: boolean,
) {
  const db = getDb();

  const periods: Period[] = ["lifetime", "monthly", "weekly"];

  for (const period of periods) {
    console.log(`\n📊 Calculating ${period} scores...`);
    const results = processForPeriod(db, config, period, verbose);
    console.log(`  ✅ ${results.length} contributors with scores > 0`);

    if (period === "lifetime") {
      console.log("\n🏆 Top 20 Contributors (All Time):");
      console.log("─".repeat(80));
      for (let i = 0; i < Math.min(20, results.length); i++) {
        const c = results[i];
        console.log(
          `  #${String(i + 1).padStart(2)} ${c.username.padEnd(25)} ${String(c.scores.totalScore).padStart(8)} pts  [${c.tier}/${c.characterClass}]  PR:${c.prsCount} Issue:${c.issuesCount} Review:${c.reviewsCount}`,
        );
      }
    }
  }

  console.log("\n✅ Processing complete for all periods!");
}

function calculateFocusAreas(
  db: ReturnType<typeof getDb>,
  username: string,
  config: PipelineConfig,
): { tag: string; score: number; percentage: number }[] {
  // Get all PR files for this user
  const userPRs = db
    .select({ id: schema.rawPullRequests.id })
    .from(schema.rawPullRequests)
    .where(eq(schema.rawPullRequests.author, username))
    .all();

  if (userPRs.length === 0) return [];

  const prIds = userPRs.map((pr) => pr.id);
  const allFiles = db
    .select()
    .from(schema.rawPullRequestFiles)
    .where(sql`${schema.rawPullRequestFiles.prId} IN (${sql.join(prIds.map(id => sql`${id}`), sql`, `)})`)
    .all();

  if (allFiles.length === 0) return [];

  const tagScores = new Map<string, number>();
  let totalTagScore = 0;

  for (const areaTag of config.PIPELINE_TAGS.area) {
    let tagScore = 0;
    for (const file of allFiles) {
      const matchesPattern = areaTag.patterns.some((pattern) =>
        file.path.includes(pattern),
      );
      if (matchesPattern) {
        tagScore += (file.additions || 0) + (file.deletions || 0);
      }
    }
    if (tagScore > 0) {
      const weighted = tagScore * areaTag.weight;
      tagScores.set(areaTag.name, weighted);
      totalTagScore += weighted;
    }
  }

  const result: { tag: string; score: number; percentage: number }[] = [];
  for (const [tag, score] of tagScores) {
    result.push({
      tag,
      score: Math.round(score * 100) / 100,
      percentage: totalTagScore > 0 ? Math.round((score / totalTagScore) * 10000) / 100 : 0,
    });
  }

  return result.sort((a, b) => b.score - a.score);
}

// ===================== EXPORT =====================

function buildLeaderboardForPeriod(
  db: ReturnType<typeof getDb>,
  category: string,
) {
  const scores = db
    .select()
    .from(schema.userDailyScores)
    .where(eq(schema.userDailyScores.category, category))
    .all();

  const usersMap = new Map<string, { avatarUrl: string | null }>();
  const allUsers = db.select().from(schema.users).all();
  for (const u of allUsers) {
    usersMap.set(u.username, { avatarUrl: u.avatarUrl });
  }

  return scores
    .filter((s) => (s.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((s, i) => {
      const metrics = s.metrics ? JSON.parse(s.metrics) : {};
      const user = usersMap.get(s.username);
      return {
        rank: i + 1,
        username: s.username,
        avatarUrl: user?.avatarUrl || `https://github.com/${s.username}.png`,
        score: s.score,
        prScore: s.prScore,
        issueScore: s.issueScore,
        reviewScore: s.reviewScore,
        commentScore: s.commentScore,
        prsCount: s.prsCount,
        issuesCount: s.issuesCount,
        reviewsCount: s.reviewsCount,
        commentsCount: s.commentsCount,
        tier: metrics.tier || "beginner",
        characterClass: metrics.characterClass || "Contributor",
        focusAreas: metrics.focusAreas || [],
        links: {
          github: `https://github.com/${s.username}`,
        },
      };
    });
}

export async function exportLeaderboard(config: PipelineConfig, verbose: boolean) {
  const db = getDb();
  const repos = db.select().from(schema.repositories).all();
  const reposMeta = repos.map((r) => ({
    id: r.repoId,
    stars: r.stars,
    forks: r.forks,
    description: r.description,
  }));

  console.log("\nExporting leaderboards...");

  const periods = [
    { category: "lifetime", filename: "leaderboard-lifetime.json", label: "All Time" },
    { category: "monthly", filename: "leaderboard-monthly.json", label: "Monthly" },
    { category: "weekly", filename: "leaderboard-weekly.json", label: "Weekly" },
  ];

  for (const { category, filename, label } of periods) {
    const leaderboard = buildLeaderboardForPeriod(db, category);

    const output = {
      version: "1.0",
      period: category,
      label,
      generatedAt: new Date().toISOString(),
      totalUsers: leaderboard.length,
      repositories: reposMeta,
      leaderboard,
    };

    const outputPath = `./output/${filename}`;
    await Bun.write(outputPath, JSON.stringify(output, null, 2));
    console.log(`  ✅ ${label}: ${leaderboard.length} contributors → ${outputPath}`);
  }

  // Also export combined summary
  const lifetimeBoard = buildLeaderboardForPeriod(db, "lifetime");
  const summary = {
    generatedAt: new Date().toISOString(),
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
    classDistribution: {} as Record<string, number>,
    top10: lifetimeBoard.slice(0, 10).map((c) => ({
      rank: c.rank,
      username: c.username,
      score: c.score,
      tier: c.tier,
      characterClass: c.characterClass,
    })),
  };

  for (const c of lifetimeBoard) {
    summary.classDistribution[c.characterClass] =
      (summary.classDistribution[c.characterClass] || 0) + 1;
  }

  await Bun.write("./output/summary.json", JSON.stringify(summary, null, 2));
  console.log(`  ✅ Summary exported`);

  console.log("\n✅ All exports complete!");
}
