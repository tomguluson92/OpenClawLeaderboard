import type {
  GHPullRequest,
  GHIssue,
  GHReview,
  GHComment,
  GHCommit,
} from "./types.js";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// Rate limiter with adaptive concurrency
let remainingPoints = 5000;
let resetAt = Date.now();

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  // Check rate limit
  if (remainingPoints < 100 && Date.now() < resetAt) {
    const waitMs = resetAt - Date.now() + 1000;
    console.log(`  Rate limit approaching, waiting ${Math.ceil(waitMs / 1000)}s...`);
    await sleep(waitMs);
  }

  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    // Handle rate limits
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    if (remaining) remainingPoints = parseInt(remaining);
    if (reset) resetAt = parseInt(reset) * 1000;

    if (response.status === 403 || response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const waitMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 120000);
      console.log(`  Rate limited, retrying in ${Math.ceil(waitMs / 1000)}s...`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as { data: T; errors?: { message: string }[] };
    if (json.errors) {
      console.warn("GraphQL errors:", json.errors.map((e) => e.message).join(", "));
    }
    return json.data;
  }

  throw new Error("Max retries exceeded for GitHub API request");
}

// --- Pull Requests ---

const PR_QUERY = `
query($owner: String!, $name: String!, $after: String, $since: DateTime) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      first: 25,
      after: $after,
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        number
        title
        body
        state
        merged
        createdAt
        mergedAt
        closedAt
        additions
        deletions
        changedFiles
        author { login avatarUrl }
        reviews(first: 20) {
          nodes {
            id
            state
            body
            createdAt
            author { login }
          }
        }
        comments(first: 20) {
          nodes {
            id
            body
            createdAt
            author { login }
          }
        }
        files(first: 50) {
          nodes {
            path
            additions
            deletions
          }
        }
      }
    }
  }
}`;

export async function fetchPullRequests(
  token: string,
  owner: string,
  name: string,
  since: string,
  until: string,
): Promise<GHPullRequest[]> {
  const allPRs: GHPullRequest[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (true) {
    page++;
    const data = await graphql<{
      repository: {
        pullRequests: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: GHPullRequest[];
        };
      };
    }>(token, PR_QUERY, { owner, name, after: cursor, since });

    const prs = data.repository.pullRequests.nodes;

    // Filter by date range
    for (const pr of prs) {
      const created = pr.createdAt;
      if (created < since) {
        // PRs are ordered by createdAt DESC, so we can stop
        return allPRs;
      }
      if (created <= until) {
        allPRs.push(pr);
      }
    }

    if (!data.repository.pullRequests.pageInfo.hasNextPage) break;
    cursor = data.repository.pullRequests.pageInfo.endCursor;

    // Safety limit
    if (page > 200) {
      console.warn(`  Reached max pages (200) for PRs`);
      break;
    }
  }

  return allPRs;
}

// --- Issues ---

const ISSUE_QUERY = `
query($owner: String!, $name: String!, $after: String, $since: DateTime) {
  repository(owner: $owner, name: $name) {
    issues(
      first: 100,
      after: $after,
      orderBy: { field: CREATED_AT, direction: DESC }
      filterBy: { since: $since }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        number
        title
        body
        state
        createdAt
        closedAt
        author { login avatarUrl }
        comments(first: 20) {
          totalCount
          nodes {
            id
            body
            createdAt
            author { login }
          }
        }
      }
    }
  }
}`;

export async function fetchIssues(
  token: string,
  owner: string,
  name: string,
  since: string,
  until: string,
): Promise<GHIssue[]> {
  const allIssues: GHIssue[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (true) {
    page++;
    const data = await graphql<{
      repository: {
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: GHIssue[];
        };
      };
    }>(token, ISSUE_QUERY, { owner, name, after: cursor, since });

    const issues = data.repository.issues.nodes;

    for (const issue of issues) {
      if (issue.createdAt < since) return allIssues;
      if (issue.createdAt <= until) {
        allIssues.push(issue);
      }
    }

    if (!data.repository.issues.pageInfo.hasNextPage) break;
    cursor = data.repository.issues.pageInfo.endCursor;
    if (page > 100) break;
  }

  return allIssues;
}

// --- Commits ---

const COMMIT_QUERY = `
query($owner: String!, $name: String!, $branch: String!, $after: String, $since: GitTimestamp) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $branch) {
      target {
        ... on Commit {
          history(first: 100, after: $after, since: $since) {
            pageInfo { hasNextPage endCursor }
            nodes {
              oid
              message
              committedDate
              additions
              deletions
              changedFiles
              author {
                name
                email
                user { login }
              }
            }
          }
        }
      }
    }
  }
}`;

export async function fetchCommits(
  token: string,
  owner: string,
  name: string,
  branch: string,
  since: string,
  until: string,
): Promise<GHCommit[]> {
  const allCommits: GHCommit[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (true) {
    page++;
    const data = await graphql<{
      repository: {
        ref: {
          target: {
            history: {
              pageInfo: { hasNextPage: boolean; endCursor: string };
              nodes: GHCommit[];
            };
          };
        } | null;
      };
    }>(token, COMMIT_QUERY, {
      owner,
      name,
      branch: `refs/heads/${branch}`,
      after: cursor,
      since,
    });

    const ref = data.repository.ref;
    if (!ref) {
      console.warn(`  Branch ${branch} not found for ${owner}/${name}`);
      break;
    }

    const commits = ref.target.history.nodes;

    for (const commit of commits) {
      if (commit.committedDate < since) return allCommits;
      if (commit.committedDate <= until) {
        allCommits.push(commit);
      }
    }

    if (!ref.target.history.pageInfo.hasNextPage) break;
    cursor = ref.target.history.pageInfo.endCursor;
    if (page > 100) break;
  }

  return allCommits;
}

// --- Repository info ---

const REPO_INFO_QUERY = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    description
    stargazerCount
    forkCount
  }
}`;

export async function fetchRepoInfo(
  token: string,
  owner: string,
  name: string,
): Promise<{ description: string; stars: number; forks: number }> {
  const data = await graphql<{
    repository: {
      description: string;
      stargazerCount: number;
      forkCount: number;
    };
  }>(token, REPO_INFO_QUERY, { owner, name });

  return {
    description: data.repository.description,
    stars: data.repository.stargazerCount,
    forks: data.repository.forkCount,
  };
}
