#!/usr/bin/env bun
import "dotenv/config";
import { Command } from "commander";
import { readFileSync } from "fs";
import { join } from "path";
import { ingest, process as processScores, exportLeaderboard } from "../src/pipeline.js";
import { getDb } from "../src/db.js";
import type { PipelineConfig } from "../src/types.js";

// Load config
function loadConfig(): PipelineConfig {
  const configFile =
    process.env.PIPELINE_CONFIG_FILE || "config/openclaw.json";
  const configPath = join(process.cwd(), configFile);
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("❌ GITHUB_TOKEN environment variable is required");
    console.error("   Set it in .env or export GITHUB_TOKEN=ghp_...");
    process.exit(1);
  }
  return token;
}

// Ensure database tables exist
function ensureDb() {
  const db = getDb();
  // Create tables using raw SQL (Drizzle doesn't auto-create)
  const sqlite = (db as any)._.session.client;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      avatar_url TEXT,
      is_bot INTEGER DEFAULT 0,
      last_updated TEXT
    );
    CREATE TABLE IF NOT EXISTS repositories (
      repo_id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      default_branch TEXT DEFAULT 'main',
      description TEXT,
      stars INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      last_fetched_at TEXT
    );
    CREATE TABLE IF NOT EXISTS raw_pull_requests (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      title TEXT,
      body TEXT,
      state TEXT,
      merged INTEGER DEFAULT 0,
      author TEXT,
      repository TEXT,
      created_at TEXT,
      merged_at TEXT,
      closed_at TEXT,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      changed_files INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_prs_author ON raw_pull_requests(author);
    CREATE INDEX IF NOT EXISTS idx_prs_repo ON raw_pull_requests(repository);
    CREATE INDEX IF NOT EXISTS idx_prs_created ON raw_pull_requests(created_at);

    CREATE TABLE IF NOT EXISTS raw_pull_request_files (
      id TEXT PRIMARY KEY,
      pr_id TEXT NOT NULL,
      path TEXT NOT NULL,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS raw_issues (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      title TEXT,
      body TEXT,
      state TEXT,
      author TEXT,
      repository TEXT,
      created_at TEXT,
      closed_at TEXT,
      comment_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_issues_author ON raw_issues(author);
    CREATE INDEX IF NOT EXISTS idx_issues_repo ON raw_issues(repository);
    CREATE INDEX IF NOT EXISTS idx_issues_created ON raw_issues(created_at);

    CREATE TABLE IF NOT EXISTS raw_commits (
      oid TEXT PRIMARY KEY,
      message TEXT,
      author TEXT,
      author_email TEXT,
      repository TEXT,
      committed_date TEXT,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      changed_files INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_commits_author ON raw_commits(author);
    CREATE INDEX IF NOT EXISTS idx_commits_repo ON raw_commits(repository);
    CREATE INDEX IF NOT EXISTS idx_commits_date ON raw_commits(committed_date);

    CREATE TABLE IF NOT EXISTS pr_reviews (
      id TEXT PRIMARY KEY,
      pr_id TEXT NOT NULL,
      author TEXT,
      state TEXT,
      body TEXT,
      created_at TEXT,
      repository TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_author ON pr_reviews(author);
    CREATE INDEX IF NOT EXISTS idx_reviews_created ON pr_reviews(created_at);

    CREATE TABLE IF NOT EXISTS pr_comments (
      id TEXT PRIMARY KEY,
      pr_id TEXT NOT NULL,
      author TEXT,
      body TEXT,
      created_at TEXT,
      repository TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pr_comments_author ON pr_comments(author);

    CREATE TABLE IF NOT EXISTS issue_comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      author TEXT,
      body TEXT,
      created_at TEXT,
      repository TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_issue_comments_author ON issue_comments(author);

    CREATE TABLE IF NOT EXISTS user_daily_scores (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      score REAL DEFAULT 0,
      pr_score REAL DEFAULT 0,
      issue_score REAL DEFAULT 0,
      review_score REAL DEFAULT 0,
      comment_score REAL DEFAULT 0,
      prs_count INTEGER DEFAULT 0,
      issues_count INTEGER DEFAULT 0,
      reviews_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      metrics TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scores_username ON user_daily_scores(username);
    CREATE INDEX IF NOT EXISTS idx_scores_date ON user_daily_scores(date);
    CREATE INDEX IF NOT EXISTS idx_scores_category ON user_daily_scores(category);

    CREATE TABLE IF NOT EXISTS user_tag_scores (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      tag TEXT NOT NULL,
      score REAL DEFAULT 0,
      percentage REAL DEFAULT 0
    );
  `);
}

const program = new Command();

program
  .name("openclaw-pipeline")
  .description("OpenClaw contributor analytics pipeline")
  .version("0.1.0");

program
  .command("ingest")
  .description("Fetch GitHub data (PRs, issues, commits)")
  .option("-d, --days <number>", "Number of days to fetch", "30")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (opts) => {
    const config = loadConfig();
    const token = getToken();
    ensureDb();
    await ingest(config, token, parseInt(opts.days), opts.verbose);
  });

program
  .command("process")
  .description("Calculate contributor scores")
  .option("-f, --force", "Force recalculation", false)
  .option("-v, --verbose", "Verbose output", false)
  .action(async (opts) => {
    const config = loadConfig();
    ensureDb();
    await processScores(config, opts.force, opts.verbose);
  });

program
  .command("export")
  .description("Export leaderboard JSON")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (opts) => {
    const config = loadConfig();
    ensureDb();
    await exportLeaderboard(config, opts.verbose);
  });

program
  .command("all")
  .description("Run full pipeline: ingest → process → export")
  .option("-d, --days <number>", "Number of days to fetch", "30")
  .option("-f, --force", "Force recalculation", false)
  .option("-v, --verbose", "Verbose output", false)
  .action(async (opts) => {
    const config = loadConfig();
    const token = getToken();
    ensureDb();

    console.log("🚀 Running full pipeline...\n");

    console.log("═".repeat(60));
    console.log("Step 1/3: INGEST");
    console.log("═".repeat(60));
    await ingest(config, token, parseInt(opts.days), opts.verbose);

    console.log("\n" + "═".repeat(60));
    console.log("Step 2/3: PROCESS");
    console.log("═".repeat(60));
    await processScores(config, opts.force, opts.verbose);

    console.log("\n" + "═".repeat(60));
    console.log("Step 3/3: EXPORT");
    console.log("═".repeat(60));
    await exportLeaderboard(config, opts.verbose);

    console.log("\n🎉 Full pipeline complete!");
  });

program.parse();
