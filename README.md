# OpenClaw Contributor Leaderboard

A contributor analytics and leaderboard platform for the [OpenClaw](https://github.com/openclaw/openclaw) project. Tracks pull requests, commits, issues, reviews, and comments to rank contributors across weekly, monthly, and all-time periods.

Inspired by [elizaOS/elizaos.github.io](https://github.com/elizaOS/elizaos.github.io).

## Features

- **Multi-period rankings** — Weekly, monthly, and all-time leaderboards
- **Contributor profiles** — Detailed pages with activity charts, PR stats, code contributions, achievements, and skills
- **AI-powered summaries** — Auto-generated contributor analysis via OpenRouter (Gemini Flash)
- **Scoring system** — Weighted scoring for commits, PRs, issues, reviews, and comments
- **Character classes** — RPG-style roles: Builder, Maintainer, Reviewer, Hunter, Pathfinder
- **Tier progression** — Beginner → Regular → Active → Veteran → Elite → Legend
- **DINQ integration** — Direct links to [DINQ analysis](https://analysis.dinq.me) for each contributor
- **Light & dark themes** — System-aware with manual toggle
- **Fuzzy search** — Instant client-side contributor search

## Prerequisites

- [Bun](https://bun.sh) runtime
- [Node.js](https://nodejs.org) 18+ (for the Next.js site)
- GitHub Personal Access Token with `repo` scope
- OpenRouter API Key (optional, for AI summaries)

## Quick Start

### 1. Install dependencies

```bash
# Root (data pipeline)
bun install

# Site (Next.js frontend)
cd site && npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
GITHUB_TOKEN=ghp_your_github_personal_access_token
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key   # optional
```

For the Next.js site, create `site/.env.local`:

```env
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key
```

### 3. Fetch data

```bash
# Fetch contributors, PRs, issues, reviews via GitHub API
bun scripts/fetch-rest.ts

# Fetch per-commit statistics (additions/deletions)
bun scripts/fetch-commit-stats.ts

# Re-score without re-fetching (after tuning scoring weights)
bun scripts/rescore.ts
```

### 4. Run the site

```bash
cd site
npm run dev
```

Open [http://localhost:3456](http://localhost:3456).

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/fetch-rest.ts` | Full data pipeline — fetches contributors, PRs, issues, reviews via REST + GraphQL APIs. Exports leaderboard JSONs and per-user profile JSONs. |
| `scripts/fetch-commit-stats.ts` | Fetches per-commit additions/deletions/files via GraphQL commit history. Enriches existing profiles with code stats. |
| `scripts/rescore.ts` | Re-calculates scores and rebuilds leaderboards from existing profile data without re-fetching from GitHub. |
| `scripts/daily-sync.sh` | Shell script for daily automation of the full pipeline. |

## Scoring System

Contributors are scored based on multiple activity types:

| Activity | Base Score | Bonuses |
|----------|-----------|---------|
| **Commits** | 5 pts each | Folded into code contribution score |
| **Pull Requests** | 7 pts each | +3 merged bonus, complexity bonus (up to 300) |
| **Issues** | 5 pts each | +3 closed bonus |
| **Reviews** | 3 pts each | +1 approved, +1.5 changes requested |
| **Comments** | 0.5 pts each | Diminishing returns, capped at 100 |

### Tiers

| Tier | Min Score |
|------|-----------|
| Legend | 5,000+ |
| Elite | 1,000+ |
| Veteran | 500+ |
| Active | 200+ |
| Regular | 50+ |
| Beginner | < 50 |

### Character Classes

| Class | Criteria |
|-------|----------|
| Maintainer | High PR + review activity |
| Pathfinder | High PR + issue activity |
| Builder | Primarily PR/commit focused |
| Hunter | Issue-focused contributor |
| Reviewer | Review-focused contributor |
| Contributor | General participation |

## Project Structure

```
.
├── scripts/                # Data pipeline scripts
│   ├── fetch-rest.ts       # Main data fetcher (REST + GraphQL)
│   ├── fetch-commit-stats.ts  # Commit stats enrichment
│   └── rescore.ts          # Offline re-scoring
├── config/
│   └── openclaw.json       # Pipeline configuration (repos, scoring weights, tags)
├── output/                 # Generated data (gitignored)
│   ├── leaderboard-*.json  # Leaderboard exports
│   ├── summary.json        # Project summary
│   └── profiles/           # Per-user profile JSONs
├── site/                   # Next.js frontend
│   ├── src/
│   │   ├── app/            # Pages (home, profile/[username])
│   │   │   └── api/        # AI summary API route
│   │   ├── components/     # React components
│   │   │   ├── leaderboard.tsx
│   │   │   ├── leaderboard-card.tsx
│   │   │   ├── profile-view.tsx
│   │   │   ├── stats-bar.tsx
│   │   │   ├── dinq-link.tsx
│   │   │   └── ...
│   │   └── lib/            # Types and utilities
│   └── public/api/         # Static JSON data (gitignored, copied from output/)
├── src/                    # Legacy pipeline (Drizzle ORM based)
├── cli/                    # CLI runner
├── .env.example            # Environment template
└── .gitignore
```

## API Endpoints

The site serves static JSON data at `/api/`:

| Endpoint | Description |
|----------|-------------|
| `/api/leaderboard-lifetime.json` | All-time leaderboard |
| `/api/leaderboard-monthly.json` | Monthly leaderboard |
| `/api/leaderboard-weekly.json` | Weekly leaderboard |
| `/api/summary.json` | Project summary with tier distribution |
| `/api/profiles/{username}.json` | Individual contributor profile |

### Leaderboard Response

```json
{
  "version": "1.0",
  "period": "lifetime",
  "generatedAt": "2026-03-12T...",
  "totalUsers": 2227,
  "repositories": [{ "id": "openclaw/openclaw", "stars": 312000, "forks": 45000 }],
  "leaderboard": [
    {
      "rank": 1,
      "username": "contributor1",
      "avatarUrl": "https://...",
      "score": 59725.8,
      "tier": "legend",
      "characterClass": "Builder",
      "prScore": 59000,
      "issueScore": 0,
      "reviewScore": 3,
      "commentScore": 50,
      "focusAreas": [],
      "links": { "github": "https://github.com/contributor1" }
    }
  ]
}
```

### Profile Response

```json
{
  "username": "shakkernerd",
  "avatarUrl": "https://...",
  "githubUrl": "https://github.com/shakkernerd",
  "score": { "score": 776.82, "prScore": 590, "issueScore": 0, "reviewScore": 0, "commentScore": 17.5 },
  "tier": "veteran",
  "characterClass": "Builder",
  "stats": {
    "commits": 118, "prs": 0, "prsMerged": 0,
    "commitAdditions": 63921, "commitDeletions": 15940, "commitChangedFiles": 1471,
    "reviews": 0, "comments": 35
  },
  "period": {
    "weekly": { "prs": 0, "issues": 0, "reviews": 0, "comments": 24 },
    "monthly": { "prs": 0, "issues": 0, "reviews": 0, "comments": 35 }
  },
  "recentPRs": [],
  "recentIssues": [],
  "recentReviews": [],
  "skills": ["Discussion", "Direct Commits"],
  "achievements": [
    { "id": "centurion", "label": "Centurion", "description": "100+ commits" }
  ]
}
```

## Development

```bash
# Run the site in development mode
cd site && npm run dev

# Re-score after tweaking scoring weights (no API calls needed)
bun scripts/rescore.ts

# Copy fresh data to the site
cp output/leaderboard-*.json output/summary.json site/public/api/
cp -r output/profiles site/public/api/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Data Pipeline** | Bun, GitHub REST + GraphQL APIs |
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4 |
| **AI Summaries** | OpenRouter API (Gemini 2.0 Flash) |
| **Search** | fuzzysort (client-side) |
| **Theming** | next-themes (system/light/dark) |
| **Icons** | Lucide React |

## Credits

- Architecture inspired by [elizaOS/elizaos.github.io](https://github.com/elizaOS/elizaos.github.io)
- Contributor analysis powered by [DINQ](https://analysis.dinq.me)
- Built for the [OpenClaw](https://github.com/openclaw/openclaw) community

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
