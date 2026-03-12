import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// --- Core tables ---

export const users = sqliteTable("users", {
  username: text("username").primaryKey(),
  avatarUrl: text("avatar_url"),
  isBot: integer("is_bot", { mode: "boolean" }).default(false),
  lastUpdated: text("last_updated"),
});

export const repositories = sqliteTable("repositories", {
  repoId: text("repo_id").primaryKey(), // "owner/name"
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  defaultBranch: text("default_branch").default("main"),
  description: text("description"),
  stars: integer("stars").default(0),
  forks: integer("forks").default(0),
  lastFetchedAt: text("last_fetched_at"),
});

// --- Raw data tables ---

export const rawPullRequests = sqliteTable(
  "raw_pull_requests",
  {
    id: text("id").primaryKey(),
    number: integer("number").notNull(),
    title: text("title"),
    body: text("body"),
    state: text("state"),
    merged: integer("merged", { mode: "boolean" }).default(false),
    author: text("author"),
    repository: text("repository"),
    createdAt: text("created_at"),
    mergedAt: text("merged_at"),
    closedAt: text("closed_at"),
    additions: integer("additions").default(0),
    deletions: integer("deletions").default(0),
    changedFiles: integer("changed_files").default(0),
  },
  (table) => [
    index("idx_prs_author").on(table.author),
    index("idx_prs_repo").on(table.repository),
    index("idx_prs_created").on(table.createdAt),
  ],
);

export const rawPullRequestFiles = sqliteTable("raw_pull_request_files", {
  id: text("id").primaryKey(), // "prId:path"
  prId: text("pr_id").notNull(),
  path: text("path").notNull(),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
});

export const rawIssues = sqliteTable(
  "raw_issues",
  {
    id: text("id").primaryKey(),
    number: integer("number").notNull(),
    title: text("title"),
    body: text("body"),
    state: text("state"),
    author: text("author"),
    repository: text("repository"),
    createdAt: text("created_at"),
    closedAt: text("closed_at"),
    commentCount: integer("comment_count").default(0),
  },
  (table) => [
    index("idx_issues_author").on(table.author),
    index("idx_issues_repo").on(table.repository),
    index("idx_issues_created").on(table.createdAt),
  ],
);

export const rawCommits = sqliteTable(
  "raw_commits",
  {
    oid: text("oid").primaryKey(),
    message: text("message"),
    author: text("author"),
    authorEmail: text("author_email"),
    repository: text("repository"),
    committedDate: text("committed_date"),
    additions: integer("additions").default(0),
    deletions: integer("deletions").default(0),
    changedFiles: integer("changed_files").default(0),
  },
  (table) => [
    index("idx_commits_author").on(table.author),
    index("idx_commits_repo").on(table.repository),
    index("idx_commits_date").on(table.committedDate),
  ],
);

// --- Activity tables ---

export const prReviews = sqliteTable(
  "pr_reviews",
  {
    id: text("id").primaryKey(),
    prId: text("pr_id").notNull(),
    author: text("author"),
    state: text("state"), // APPROVED, CHANGES_REQUESTED, COMMENTED
    body: text("body"),
    createdAt: text("created_at"),
    repository: text("repository"),
  },
  (table) => [
    index("idx_reviews_author").on(table.author),
    index("idx_reviews_created").on(table.createdAt),
  ],
);

export const prComments = sqliteTable(
  "pr_comments",
  {
    id: text("id").primaryKey(),
    prId: text("pr_id").notNull(),
    author: text("author"),
    body: text("body"),
    createdAt: text("created_at"),
    repository: text("repository"),
  },
  (table) => [index("idx_pr_comments_author").on(table.author)],
);

export const issueComments = sqliteTable(
  "issue_comments",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull(),
    author: text("author"),
    body: text("body"),
    createdAt: text("created_at"),
    repository: text("repository"),
  },
  (table) => [index("idx_issue_comments_author").on(table.author)],
);

// --- Score tables ---

export const userDailyScores = sqliteTable(
  "user_daily_scores",
  {
    id: text("id").primaryKey(), // "username_date_category"
    username: text("username").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    category: text("category").notNull(), // "day", "week", "month"
    score: real("score").default(0),
    prScore: real("pr_score").default(0),
    issueScore: real("issue_score").default(0),
    reviewScore: real("review_score").default(0),
    commentScore: real("comment_score").default(0),
    prsCount: integer("prs_count").default(0),
    issuesCount: integer("issues_count").default(0),
    reviewsCount: integer("reviews_count").default(0),
    commentsCount: integer("comments_count").default(0),
    metrics: text("metrics"), // JSON with detailed breakdown
  },
  (table) => [
    index("idx_scores_username").on(table.username),
    index("idx_scores_date").on(table.date),
    index("idx_scores_category").on(table.category),
  ],
);

export const userTagScores = sqliteTable("user_tag_scores", {
  id: text("id").primaryKey(), // "username_tag"
  username: text("username").notNull(),
  tag: text("tag").notNull(),
  score: real("score").default(0),
  percentage: real("percentage").default(0),
});
