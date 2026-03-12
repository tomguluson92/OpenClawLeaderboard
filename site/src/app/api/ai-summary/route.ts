import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { profile } = await req.json();

    const s = profile.stats || {};
    const sc = profile.score || {};
    const recentPRs = (profile.recentPRs || []).slice(0, 20);
    const recentIssues = (profile.recentIssues || []).slice(0, 10);
    const recentReviews = (profile.recentReviews || []).slice(0, 10);

    const mergedPRs = recentPRs.filter((pr: any) => pr.merged);
    const openPRs = recentPRs.filter((pr: any) => !pr.merged && pr.state === "open");
    const closedPRs = recentPRs.filter((pr: any) => !pr.merged && pr.state === "closed");

    const prList = recentPRs
      .map(
        (pr: any) =>
          `  - openclaw/openclaw#${pr.number}: "${pr.title}" [${pr.merged ? "MERGED" : pr.state.toUpperCase()}] (+${pr.additions}/-${pr.deletions}, ${pr.changedFiles} files)${pr.mergedAt ? ` merged ${pr.mergedAt.slice(0, 10)}` : ""} created ${pr.createdAt.slice(0, 10)}`
      )
      .join("\n");

    const issueList = recentIssues
      .map(
        (i: any) =>
          `  - openclaw/openclaw#${i.number}: "${i.title}" [${i.state.toUpperCase()}]${i.closedAt ? ` closed ${i.closedAt.slice(0, 10)}` : ""} created ${i.createdAt.slice(0, 10)}`
      )
      .join("\n");

    const reviewList = recentReviews
      .map(
        (r: any) =>
          `  - PR #${r.prNumber}: ${r.state} on ${r.createdAt.slice(0, 10)}`
      )
      .join("\n");

    const avgPRSize = s.prs > 0
      ? Math.round(((s.prAdditions || 0) + (s.prDeletions || 0)) / s.prs)
      : 0;

    const commentsOnlyReviews = (s.reviews || 0) - (s.reviewsApproved || 0) - (s.reviewsChangesRequested || 0);
    const approvalRate = s.reviews > 0
      ? Math.round(((s.reviewsApproved || 0) / s.reviews) * 100)
      : 0;

    const systemPrompt = `You are a senior open-source intelligence analyst. You produce precise, data-driven contributor profiles. Your analysis is sharp, concise, and avoids filler. You cite specific PR numbers to back every claim. You write in third person, never use emojis, and format output as clean Markdown.

IMPORTANT: You have web search access. Use it to verify contributor facts — especially their actual first contribution date on github.com/openclaw/openclaw. The "firstContribution" field in the data below only reflects our recent API fetch window and is often inaccurate (too recent). Search GitHub to find their true earliest activity on the repo.`;

    const userPrompt = `Analyze this contributor to the **OpenClaw** project (github.com/openclaw/openclaw — a personal AI assistant platform with 300K+ stars).

<CONTRIBUTOR_DATA>
Username: ${profile.username}
Tier: ${profile.tier} | Class: ${profile.characterClass} | Score: ${sc.score || 0} pts
Data window: ${profile.firstContribution || "?"} → ${profile.lastContribution || "?"} (NOTE: this only reflects our API fetch window — use web search to find the actual first contribution date on github.com/openclaw/openclaw for this user)

ACTIVITY METRICS:
- Commits: **${s.commits || 0}** (${(s.commitAdditions || 0).toLocaleString()}+ / ${(s.commitDeletions || 0).toLocaleString()}-, ${(s.commitChangedFiles || 0).toLocaleString()} files)
- PRs authored: **${s.prs || 0}** (${s.prsMerged || 0} merged, ${openPRs.length} open, ${closedPRs.length} closed — **${s.prMergeRate || 0}%** merge rate)
- PR line impact: +${(s.prAdditions || 0).toLocaleString()} / -${(s.prDeletions || 0).toLocaleString()} across ${(s.prChangedFiles || 0).toLocaleString()} files
- Avg PR size: ~${avgPRSize.toLocaleString()} lines changed
- Issues: **${s.issues || 0}** opened (${s.issuesClosed || 0} closed)
- Reviews: **${s.reviews || 0}** (${s.reviewsApproved || 0} approvals, ${s.reviewsChangesRequested || 0} change requests, ${commentsOnlyReviews} comment-only — **${approvalRate}%** approval rate)
- Comments: **${s.comments || 0}**

SCORE BREAKDOWN:
- Code: ${sc.prScore || 0} pts | Issues: ${sc.issueScore || 0} pts | Reviews: ${sc.reviewScore || 0} pts | Comments: ${sc.commentScore || 0} pts

RECENT VELOCITY (last 7 days / last 30 days):
- PRs: ${profile.period?.weekly?.prs || 0} / ${profile.period?.monthly?.prs || 0}
- Issues: ${profile.period?.weekly?.issues || 0} / ${profile.period?.monthly?.issues || 0}
- Reviews: ${profile.period?.weekly?.reviews || 0} / ${profile.period?.monthly?.reviews || 0}
- Commits: ${profile.period?.weekly?.commits || 0} / ${profile.period?.monthly?.commits || 0}

SKILLS: ${(profile.skills || []).join(", ") || "None detected"}
ACHIEVEMENTS: ${(profile.achievements || []).map((a: any) => `${a.label} (${a.description})`).join("; ") || "None"}

RECENT PRS (up to 20):
${prList || "  None"}

RECENT ISSUES (up to 10):
${issueList || "  None"}

RECENT REVIEWS (up to 10):
${reviewList || "  None"}
</CONTRIBUTOR_DATA>

---

Produce a Markdown analysis with EXACTLY these sections. Start directly with the first section header.

## Activity Ledger

Bullet list of key metrics. Each bullet uses **bold** for the number. Example format:
- **Pull Requests Authored**: 95 merged, 44 open
- **Pull Requests Reviewed**: 69 total (46 approvals, 1 change requests, 19 comments)
- **Commits**: 234 total (+45.2K / -12.1K)
- **Issues**: 77 opened, 70 closed
- **Avg PR Size**: ~320 lines changed
- **Merge Rate**: 68%

## Contribution Domains

Identify **3-5 thematic areas** from the PR titles/patterns. For each:
1. **Bold domain name** as a subheading
2. One sentence on what this contributor does in that area
3. List 2-4 specific PRs as evidence: \`openclaw/openclaw#NUMBER\` (PR title)

Be specific — don't invent domains that aren't supported by the data. If the contributor only has 1-2 PRs, use fewer domains.

## Contribution Patterns

**3-5 behavioral observations**, each as a **bold label** + explanation. Examples of patterns to look for:
- PR size tendency (micro-commits vs large refactors)
- Deletion-heavy work (extracting/modularizing code)
- Review style (rubber-stamper vs thorough reviewer)
- Commit frequency and burst patterns
- Solo vs collaborative work signals

Always cite a specific PR to support each pattern.

## Organizational Signals

**2-3 structured observations**:
- **Ownership** (LOW / MEDIUM / HIGH): percentage of project PRs, what their structural role implies
- **Work Style**: issue-driven vs roadmap-driven, batch vs continuous
- **Collaboration Network**: who reviews their work, who they review

---

STRICT RULES:
1. Third person only. No emojis.
2. **Bold** all key numbers and important terms.
3. Use \`openclaw/openclaw#NUMBER\` for every PR citation.
4. Do NOT fabricate PR numbers — only use numbers from the data above.
5. If data is sparse, keep sections concise but still include all 4 sections.
6. Do NOT output the raw data. Start with "## Activity Ledger".
7. Keep total output under 800 words.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openclaw-leaderboard.dev",
        "X-Title": "OpenClaw Leaderboard",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4-fast",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("OpenRouter error:", res.status, text);
      return NextResponse.json(
        { error: `OpenRouter error: ${res.status} — ${text}` },
        { status: 500 },
      );
    }

    const data = await res.json();
    const summary =
      data.choices?.[0]?.message?.content || "Unable to generate summary.";

    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
