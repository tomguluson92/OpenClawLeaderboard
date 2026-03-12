export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  score: number | null;
  prScore: number | null;
  issueScore: number | null;
  reviewScore: number | null;
  commentScore: number | null;
  prsCount: number | null;
  issuesCount: number | null;
  reviewsCount: number | null;
  commentsCount: number | null;
  tier: string;
  characterClass: string;
  focusAreas: { tag: string; score: number; percentage: number }[];
  links: { github: string };
}

export interface LeaderboardData {
  version: string;
  period: string;
  label: string;
  generatedAt: string;
  totalUsers: number;
  repositories: {
    id: string;
    stars: number | null;
    forks: number | null;
    description: string | null;
  }[];
  leaderboard: LeaderboardEntry[];
}

export type Period = "lifetime" | "monthly" | "weekly";

export const TIER_COLORS: Record<string, string> = {
  legend: "text-yellow-600 dark:text-yellow-300",
  elite: "text-purple-600 dark:text-purple-300",
  veteran: "text-blue-600 dark:text-blue-300",
  active: "text-green-600 dark:text-green-300",
  regular: "text-gray-500 dark:text-gray-400",
  beginner: "text-gray-400 dark:text-gray-500",
};

export const TIER_BG: Record<string, string> = {
  legend: "bg-yellow-500/10 border-yellow-500/30",
  elite: "bg-purple-500/10 border-purple-500/30",
  veteran: "bg-blue-500/10 border-blue-500/30",
  active: "bg-green-500/10 border-green-500/30",
  regular: "bg-gray-500/10 border-gray-500/30",
  beginner: "bg-gray-500/5 border-gray-500/20",
};
