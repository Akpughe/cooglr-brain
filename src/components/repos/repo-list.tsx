"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export function RepoList() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch(() => setError("Failed to load repos"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground p-6">Loading repositories...</p>;
  if (error) return <p className="text-destructive p-6">{error}</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {repos.map((repo) => (
        <a key={repo.id} href={`/repos/${repo.owner.login}/${repo.name}`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{repo.full_name}</h3>
                    {repo.private && <Badge variant="outline" className="text-[10px]">Private</Badge>}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {repo.language && <span>{repo.language}</span>}
                    {repo.open_issues_count > 0 && <span>{repo.open_issues_count} issues</span>}
                    <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </a>
      ))}
      {repos.length === 0 && (
        <div className="col-span-2 text-center text-muted-foreground py-12">
          <p>No repositories found.</p>
        </div>
      )}
    </div>
  );
}
