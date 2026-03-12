export interface RepoConfig {
  owner: string;
  name: string;
  defaultBranch: string;
}

export interface ScoringConfig {
  pullRequest: {
    base: number;
    merged: number;
    descriptionMultiplier: number;
    complexityMultiplier: number;
    optimalSizeBonus: number;
    maxPerDay: number;
  };
  issue: {
    base: number;
    closedBonus: number;
    perComment: number;
    maxPerThread: number;
  };
  review: {
    base: number;
    approved: number;
    changesRequested: number;
    commented: number;
    maxPerDay: number;
  };
  comment: {
    base: number;
    diminishingReturns: number;
    maxPerThread: number;
    maxTotal: number;
  };
}

export interface TagConfig {
  name: string;
  patterns: string[];
  weight: number;
  description: string;
}

export interface PipelineConfig {
  PIPELINE_START_DATE: string;
  PIPELINE_PROJECT_CONTEXT: string;
  PIPELINE_REPOS: RepoConfig[];
  PIPELINE_BOT_USERS: string[];
  PIPELINE_SCORING: ScoringConfig;
  PIPELINE_TAGS: {
    area: TagConfig[];
  };
}

// GitHub API response types
export interface GHPullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  state: string;
  merged: boolean;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  author: { login: string; avatarUrl: string } | null;
  reviews: { nodes: GHReview[] };
  comments: { nodes: GHComment[] };
  files: { nodes: { path: string; additions: number; deletions: number }[] };
}

export interface GHIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: string;
  createdAt: string;
  closedAt: string | null;
  author: { login: string; avatarUrl: string } | null;
  comments: { totalCount: number; nodes: GHComment[] };
}

export interface GHReview {
  id: string;
  state: string;
  body: string;
  createdAt: string;
  author: { login: string } | null;
}

export interface GHComment {
  id: string;
  body: string;
  createdAt: string;
  author: { login: string } | null;
}

export interface GHCommit {
  oid: string;
  message: string;
  committedDate: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  author: { name: string; email: string; user: { login: string } | null };
}

// Scoring output types
export interface ScoreBreakdown {
  prScore: number;
  issueScore: number;
  reviewScore: number;
  commentScore: number;
  totalScore: number;
}

export interface ContributorScore {
  username: string;
  avatarUrl: string;
  scores: ScoreBreakdown;
  prsCount: number;
  issuesCount: number;
  reviewsCount: number;
  commentsCount: number;
  focusAreas: { tag: string; score: number; percentage: number }[];
  tier: string;
  characterClass: string;
}

// Tier system (aligned with elizaos)
export const TIERS = {
  beginner: { min: 0, max: 49, label: "Beginner" },
  regular: { min: 50, max: 199, label: "Regular" },
  active: { min: 200, max: 499, label: "Active" },
  veteran: { min: 500, max: 999, label: "Veteran" },
  elite: { min: 1000, max: 4999, label: "Elite" },
  legend: { min: 5000, max: Infinity, label: "Legend" },
} as const;

export function getTier(score: number): string {
  if (score >= 5000) return "legend";
  if (score >= 1000) return "elite";
  if (score >= 500) return "veteran";
  if (score >= 200) return "active";
  if (score >= 50) return "regular";
  return "beginner";
}

export function getCharacterClass(scores: ScoreBreakdown): string {
  const { prScore, issueScore, reviewScore, totalScore } = scores;
  if (totalScore === 0) return "Contributor";

  const prPct = prScore / totalScore;
  const issuePct = issueScore / totalScore;
  const reviewPct = reviewScore / totalScore;

  if (prPct >= 0.5 && reviewPct >= 0.25) return "Maintainer";
  if (prPct >= 0.5 && issuePct >= 0.25) return "Pathfinder";
  if (prPct >= 0.5) return "Builder";
  if (issuePct >= 0.25) return "Hunter";
  if (reviewPct >= 0.25) return "Reviewer";
  return "Contributor";
}
