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

const QUERY = `
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
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

export async function fetchContributions(
  username: string,
  token?: string
): Promise<ContributionData> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "gh-heatmap-cli",
  };

  if (token) {
    headers["Authorization"] = `bearer ${token}`;
  }

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query: QUERY, variables: { username } }),
  });

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
    data?: { user?: { contributionsCollection: { contributionCalendar: ContributionData } } };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data?.user) {
    throw new Error(`User "${username}" not found on GitHub.`);
  }

  return json.data.user.contributionsCollection.contributionCalendar;
}
