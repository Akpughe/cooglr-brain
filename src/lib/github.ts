import type { GitHubRepo, GitHubPR, GitHubIssue } from "@/types/github";

const GITHUB_API = "https://api.github.com";

async function githubFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

export async function listRepos(token: string): Promise<GitHubRepo[]> {
  return githubFetch<GitHubRepo[]>(token, "/user/repos?sort=updated&per_page=50&type=all");
}

export async function listPulls(token: string, owner: string, repo: string): Promise<GitHubPR[]> {
  return githubFetch<GitHubPR[]>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=50`);
}

export async function getPull(token: string, owner: string, repo: string, number: number): Promise<GitHubPR> {
  return githubFetch<GitHubPR>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`);
}

export async function mergePull(token: string, owner: string, repo: string, number: number): Promise<void> {
  await githubFetch(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/merge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merge_method: "squash" }),
  });
}

export async function listIssues(token: string, owner: string, repo: string): Promise<GitHubIssue[]> {
  return githubFetch<GitHubIssue[]>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=50`);
}

export async function createIssue(token: string, owner: string, repo: string, title: string, body: string): Promise<GitHubIssue> {
  return githubFetch<GitHubIssue>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
}

export async function addPRReview(token: string, owner: string, repo: string, number: number, body: string, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"): Promise<void> {
  await githubFetch(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, event }),
  });
}
