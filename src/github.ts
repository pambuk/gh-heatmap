export interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionData {
  totalContributions: number;
  weeks: ContributionWeek[];
}

export interface FetchResult {
  data: ContributionData;
  debug: {
    apiTotal: number;
    summedTotal: number;
    restrictedCount: number;
    commits: number;
    issues: number;
    prs: number;
    reviews: number;
    repos: number;
    firstDate: string;
    lastDate: string;
    weeksCount: number;
    daysCount: number;
  };
}

const QUERY = `
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      restrictedContributionsCount
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoryContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            color
          }
        }
      }
    }
  }
}
`;

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  return 300 * 2 ** (attempt - 1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchGitHubGraphql(
  headers: Record<string, string>,
  body: string
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (RETRYABLE_STATUS_CODES.has(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs(attempt));
        continue;
      }

      return res;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            `GitHub API request timed out after ${REQUEST_TIMEOUT_MS}ms (tried ${MAX_ATTEMPTS} times).`
          );
        }
        throw new Error(
          `GitHub API request failed after ${MAX_ATTEMPTS} attempts: ${errorMessage(error)}`
        );
      }
      await sleep(retryDelayMs(attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("GitHub API request failed.");
}

export async function fetchContributions(
  username: string,
  token?: string
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "gh-heatmap-cli",
  };

  if (token) {
    headers["Authorization"] = `bearer ${token}`;
  }

  const res = await fetchGitHubGraphql(
    headers,
    JSON.stringify({ query: QUERY, variables: { username } })
  );

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      throw new Error(
        "GitHub API requires authentication.\n" +
          "Set GITHUB_TOKEN env var or pass --token.\n" +
          "Create one at: https://github.com/settings/tokens (no scopes needed for public data)"
      );
    }
    throw new Error(`GitHub API error (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection: {
          restrictedContributionsCount: number;
          totalCommitContributions: number;
          totalIssueContributions: number;
          totalPullRequestContributions: number;
          totalPullRequestReviewContributions: number;
          totalRepositoryContributions: number;
          contributionCalendar: ContributionData;
        };
      };
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data?.user) {
    throw new Error(`User "${username}" not found on GitHub.`);
  }

  const c = json.data.user.contributionsCollection;
  const data = c.contributionCalendar;

  const allDays = data.weeks.flatMap((w) => w.contributionDays);
  const summedTotal = allDays.reduce((sum, d) => sum + d.contributionCount, 0);

  return {
    data,
    debug: {
      apiTotal: data.totalContributions,
      summedTotal,
      restrictedCount: c.restrictedContributionsCount,
      commits: c.totalCommitContributions,
      issues: c.totalIssueContributions,
      prs: c.totalPullRequestContributions,
      reviews: c.totalPullRequestReviewContributions,
      repos: c.totalRepositoryContributions,
      firstDate: allDays[0]?.date ?? "N/A",
      lastDate: allDays[allDays.length - 1]?.date ?? "N/A",
      weeksCount: data.weeks.length,
      daysCount: allDays.length,
    },
  };
}
