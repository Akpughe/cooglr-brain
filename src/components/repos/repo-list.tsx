"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Repo {
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
  owner: { login: string };
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-emerald-500",
  Go: "bg-cyan-500",
  Rust: "bg-orange-600",
  Java: "bg-red-500",
  Ruby: "bg-red-600",
  Swift: "bg-orange-500",
  Kotlin: "bg-violet-500",
  "C#": "bg-green-600",
  PHP: "bg-indigo-400",
  Shell: "bg-emerald-600",
  HTML: "bg-orange-500",
  CSS: "bg-blue-400",
  Dart: "bg-sky-500",
  Elixir: "bg-purple-500",
};

export function RepoList() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "name" | "stars">("updated");

  useEffect(() => {
    fetch("/api/github/repos")
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json();
          setError(data.error);
          return;
        }
        setRepos(await r.json());
      })
      .catch(() => setError("Failed to load repositories"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = repos
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.language?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "stars") return b.stargazers_count - a.stargazers_count;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
              Repositories
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Loading..." : `${repos.length} repositories from GitHub`}
            </p>
          </div>
        </div>

        {/* Controls */}
        {!error && repos.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-[320px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repositories..."
                className="w-full h-9 pl-9 pr-3 text-[13px] rounded-lg border border-border bg-card focus:outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
              {(["updated", "name", "stars"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "h-9 px-3 text-[12px] transition-colors duration-100",
                    sortBy === s
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "updated" ? "Recent" : s === "name" ? "Name" : "Stars"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-border bg-card py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Could not load repositories</p>
            <p className="text-xs text-muted-foreground max-w-[320px] mx-auto">{error}</p>
            <a href="/settings" className="inline-block mt-4 text-xs text-primary hover:underline">
              Check GitHub connection
            </a>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-lg skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 skeleton" style={{ width: `${30 + i * 8}%` }} />
                  <div className="h-2.5 skeleton" style={{ width: `${50 + i * 5}%` }} />
                </div>
                <div className="h-5 w-16 skeleton shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Repo list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-surface">
            {filtered.map((repo, i) => (
              <a
                key={repo.id}
                href={`/repos/${repo.owner.login}/${repo.name}`}
                className={cn(
                  "group flex items-center gap-4 px-5 py-3.5 transition-colors duration-100 hover:bg-muted/30",
                  i < filtered.length - 1 && "border-b border-border"
                )}
              >
                {/* Repo icon */}
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/8 transition-colors duration-150">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60 group-hover:text-primary transition-colors duration-150">
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/>
                    <path d="M9 18c-4.51 2-5-2-7-2"/>
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground/60">{repo.owner.login}/</span>
                    <span className="text-[13px] font-medium text-foreground">{repo.name}</span>
                    {repo.private && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                        Private
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-[12px] text-muted-foreground/70 mt-0.5 truncate max-w-[480px]">
                      {repo.description}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 shrink-0">
                  {repo.language && (
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        LANG_COLORS[repo.language] || "bg-muted-foreground/40"
                      )} />
                      <span className="text-[11px] text-muted-foreground">{repo.language}</span>
                    </div>
                  )}
                  {repo.stargazers_count > 0 && (
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{repo.stargazers_count}</span>
                    </div>
                  )}
                  {repo.open_issues_count > 0 && (
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{repo.open_issues_count}</span>
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground/40 tabular-nums w-16 text-right">
                    {timeAgo(repo.updated_at)}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-muted-foreground/0 group-hover:text-muted-foreground/30 transition-all duration-150 shrink-0"
                  >
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Empty search */}
        {!loading && !error && filtered.length === 0 && repos.length > 0 && (
          <div className="rounded-2xl border border-border bg-card py-16 text-center">
            <p className="text-sm text-muted-foreground">No repositories matching &ldquo;{search}&rdquo;</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && repos.length === 0 && (
          <div className="rounded-2xl border border-border bg-card py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">No repositories found</p>
            <p className="text-xs text-muted-foreground mt-1">Connect GitHub in settings to see your repos here.</p>
            <a href="/settings" className="inline-block mt-4 text-xs text-primary hover:underline">Go to settings</a>
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
