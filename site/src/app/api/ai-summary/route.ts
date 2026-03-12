import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { profile } = await req.json();

    const prompt = `You are analyzing an open-source contributor's activity on the OpenClaw project (a personal AI assistant platform with 300K+ GitHub stars).

Contributor: ${profile.username}
Tier: ${profile.tier} (${profile.characterClass})
Score: ${profile.score?.score || 0} points

Stats:
- ${profile.stats.commits} commits
- ${profile.stats.prs} PRs (${profile.stats.prsMerged} merged, ${profile.stats.prMergeRate}% merge rate)
- ${profile.stats.prAdditions.toLocaleString()} lines added, ${profile.stats.prDeletions.toLocaleString()} lines deleted
- ${profile.stats.issues} issues (${profile.stats.issuesClosed} closed)
- ${profile.stats.reviews} code reviews (${profile.stats.reviewsApproved} approved, ${profile.stats.reviewsChangesRequested} changes requested)
- ${profile.stats.comments} comments

Recent PRs:
${(profile.recentPRs || []).slice(0, 10).map((pr: any) => `- #${pr.number}: ${pr.title} [${pr.merged ? "merged" : pr.state}] (+${pr.additions}/-${pr.deletions})`).join("\n")}

Recent Issues:
${(profile.recentIssues || []).slice(0, 5).map((i: any) => `- #${i.number}: ${i.title} [${i.state}]`).join("\n") || "None"}

Skills: ${(profile.skills || []).join(", ")}
Achievements: ${(profile.achievements || []).map((a: any) => a.label).join(", ")}
First contribution: ${profile.firstContribution || "Unknown"}
Last contribution: ${profile.lastContribution || "Unknown"}

Write a concise, engaging contributor summary in 3-4 sentences. Cover: their primary role/contribution style, notable strengths, impact level, and what makes them stand out. Be specific about their work patterns. Do not use emojis. Write in third person.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openclaw-leaderboard.dev",
        "X-Title": "OpenClaw Leaderboard",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `OpenRouter error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary.";

    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
