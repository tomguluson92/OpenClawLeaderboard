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
  legend: "text-yellow-400",
  elite: "text-purple-400",
  veteran: "text-blue-400",
  active: "text-green-400",
  regular: "text-gray-400",
  beginner: "text-gray-500",
};

export const TIER_BG: Record<string, string> = {
  legend: "bg-yellow-500/10 border-yellow-500/30",
  elite: "bg-purple-500/10 border-purple-500/30",
  veteran: "bg-blue-500/10 border-blue-500/30",
  active: "bg-green-500/10 border-green-500/30",
  regular: "bg-gray-500/10 border-gray-500/30",
  beginner: "bg-gray-500/5 border-gray-500/20",
};
