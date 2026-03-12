import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile-view";

interface ProfileData {
  username: string;
  avatarUrl: string;
  githubUrl: string;
  score: { score: number; prScore: number; issueScore: number; reviewScore: number; commentScore: number };
  tier: string;
  characterClass: string;
  stats: {
    commits: number;
    prs: number;
    prsMerged: number;
    prAdditions: number;
    prDeletions: number;
    prChangedFiles: number;
    prMergeRate: number;
    issues: number;
    issuesClosed: number;
    reviews: number;
    reviewsApproved: number;
    reviewsChangesRequested: number;
    comments: number;
  };
  period: {
    weekly: { prs: number; issues: number; reviews: number; comments: number };
    monthly: { prs: number; issues: number; reviews: number; comments: number };
  };
  firstContribution: string | null;
  lastContribution: string | null;
  recentPRs: { number: number; title: string; state: string; merged: boolean; createdAt: string; mergedAt: string | null; additions: number; deletions: number; changedFiles: number }[];
  recentIssues: { number: number; title: string; state: string; createdAt: string; closedAt: string | null }[];
  recentReviews: { prNumber: number; state: string; createdAt: string }[];
  skills: string[];
  achievements: { id: string; label: string; description: string }[];
}

function loadProfile(username: string): ProfileData | null {
  const paths = [
    join(process.cwd(), "public", "api", "profiles", `${username}.json`),
    join(process.cwd(), "..", "output", "profiles", `${username}.json`),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf-8"));
    }
  }
  return null;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = loadProfile(username);

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <ProfileView profile={profile} />
    </main>
  );
}
