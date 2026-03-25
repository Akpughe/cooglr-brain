export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  updated_at: string;
  private: boolean;
  default_branch: string;
  owner: { login: string; avatar_url: string };
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  head: { ref: string };
  base: { ref: string };
  draft: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  body: string | null;
  created_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string; color: string }[];
  assignee: { login: string } | null;
}
