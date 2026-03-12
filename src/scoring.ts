import type { ScoringConfig, ScoreBreakdown } from "./types.js";

interface PRData {
  merged: boolean;
  body: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
}

interface IssueData {
  state: string;
  commentCount: number;
}

interface ReviewData {
  state: string;
  body: string | null;
  createdAt: string;
}

interface CommentData {
  parentId: string; // prId or issueId
}

/**
 * Calculate PR score (aligned with elizaos scoring)
 */
export function calculatePRScore(
  prs: PRData[],
  config: ScoringConfig,
): number {
  // Group by date for daily cap
  const prsByDate = new Map<string, PRData[]>();
  for (const pr of prs) {
    const date = pr.createdAt.slice(0, 10);
    const existing = prsByDate.get(date) || [];
    existing.push(pr);
    prsByDate.set(date, existing);
  }

  let totalScore = 0;

  for (const [, datePrs] of prsByDate) {
    const cappedPrs = datePrs.slice(0, config.pullRequest.maxPerDay);

    for (const pr of cappedPrs) {
      let score = config.pullRequest.base;

      // Merged bonus
      if (pr.merged) {
        score += config.pullRequest.merged;
      }

      // Description quality
      const bodyLen = pr.body?.length || 0;
      score += Math.min(bodyLen * config.pullRequest.descriptionMultiplier, 10);

      // Complexity multiplier
      const changes = pr.additions + pr.deletions;
      const complexity =
        Math.min(pr.changedFiles, 10) *
        Math.log(Math.min(changes, 1000) + 1) *
        config.pullRequest.complexityMultiplier;
      score += complexity;

      // Optimal size bonus/penalty
      if (changes >= 100 && changes <= 500) {
        score += config.pullRequest.optimalSizeBonus;
      } else if (changes > 1000) {
        score -= config.pullRequest.optimalSizeBonus;
      }

      totalScore += Math.max(score, 0);
    }
  }

  return totalScore;
}

/**
 * Calculate Issue score
 */
export function calculateIssueScore(
  issues: IssueData[],
  config: ScoringConfig,
): number {
  let totalScore = 0;

  for (const issue of issues) {
    let score = config.issue.base;

    // Closed bonus
    if (issue.state === "CLOSED") {
      score += config.issue.closedBonus;
    }

    // Comment engagement
    const comments = Math.min(issue.commentCount, config.issue.maxPerThread);
    score += comments * config.issue.perComment;

    totalScore += score;
  }

  return totalScore;
}

/**
 * Calculate Review score
 */
export function calculateReviewScore(
  reviews: ReviewData[],
  config: ScoringConfig,
): number {
  // Group by date for daily cap
  const reviewsByDate = new Map<string, ReviewData[]>();
  for (const review of reviews) {
    const date = review.createdAt.slice(0, 10);
    const existing = reviewsByDate.get(date) || [];
    existing.push(review);
    reviewsByDate.set(date, existing);
  }

  let totalScore = 0;

  for (const [, dateReviews] of reviewsByDate) {
    const cappedReviews = dateReviews.slice(0, config.review.maxPerDay);

    for (const review of cappedReviews) {
      let score = config.review.base;

      switch (review.state) {
        case "APPROVED":
          score += config.review.approved;
          break;
        case "CHANGES_REQUESTED":
          score += config.review.changesRequested;
          break;
        case "COMMENTED":
          score += config.review.commented;
          break;
      }

      totalScore += score;
    }
  }

  return totalScore;
}

/**
 * Calculate Comment score with diminishing returns
 */
export function calculateCommentScore(
  comments: CommentData[],
  config: ScoringConfig,
): number {
  // Group by thread
  const commentsByThread = new Map<string, number>();
  for (const comment of comments) {
    const count = commentsByThread.get(comment.parentId) || 0;
    commentsByThread.set(comment.parentId, count + 1);
  }

  let totalScore = 0;
  let totalCounted = 0;

  for (const [, threadCount] of commentsByThread) {
    const capped = Math.min(threadCount, config.comment.maxPerThread);
    for (let i = 0; i < capped && totalCounted < config.comment.maxTotal; i++) {
      const multiplier = Math.pow(config.comment.diminishingReturns, i);
      totalScore += config.comment.base * multiplier;
      totalCounted++;
    }
  }

  return totalScore;
}

/**
 * Calculate full contributor score
 */
export function calculateContributorScore(
  prs: PRData[],
  issues: IssueData[],
  reviews: ReviewData[],
  comments: CommentData[],
  config: ScoringConfig,
): ScoreBreakdown {
  const prScore = calculatePRScore(prs, config);
  const issueScore = calculateIssueScore(issues, config);
  const reviewScore = calculateReviewScore(reviews, config);
  const commentScore = calculateCommentScore(comments, config);

  return {
    prScore: Math.round(prScore * 100) / 100,
    issueScore: Math.round(issueScore * 100) / 100,
    reviewScore: Math.round(reviewScore * 100) / 100,
    commentScore: Math.round(commentScore * 100) / 100,
    totalScore:
      Math.round((prScore + issueScore + reviewScore + commentScore) * 100) /
      100,
  };
}
