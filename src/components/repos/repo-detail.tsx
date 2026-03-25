"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface PR {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  user: { login: string };
  head: { ref: string };
  base: { ref: string };
  draft: boolean;
}

interface Issue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  user: { login: string };
  labels: { name: string; color: string }[];
}

export function RepoDetail({ owner, repo }: { owner: string; repo: string }) {
  const [pulls, setPulls] = useState<PR[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [prRes, issueRes] = await Promise.all([
      fetch(`/api/github/pulls?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
      fetch(`/api/github/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
    ]);
    if (prRes.ok) setPulls(await prRes.json());
    if (issueRes.ok) {
      const allIssues = await issueRes.json();
      setIssues(allIssues.filter((i: { pull_request?: unknown }) => !i.pull_request));
    }
    setLoading(false);
  }, [owner, repo]);

  useEffect(() => { load(); }, [load]);

  async function handleMerge(number: number) {
    setActionLoading(`merge-${number}`);
    const res = await fetch("/api/github/pulls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "merge", owner, repo, number }),
    });
    if (res.ok) load();
    else alert((await res.json()).error);
    setActionLoading(null);
  }

  async function handleCreateIssue(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/github/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, title: issueTitle, body: issueBody }),
    });
    if (res.ok) {
      setIssueTitle("");
      setIssueBody("");
      setShowCreate(false);
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <a href="/repos" className="text-xs text-muted-foreground hover:underline">← Back to repos</a>
          <h2 className="text-xl font-bold">{owner}/{repo}</h2>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger>
            <Button size="sm">Create Issue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Issue on {repo}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateIssue} className="space-y-3">
              <Input placeholder="Issue title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} required />
              <Textarea placeholder="Description..." value={issueBody} onChange={(e) => setIssueBody(e.target.value)} rows={4} />
              <Button type="submit" className="w-full">Create Issue</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-muted-foreground">Loading...</p>}

      <Tabs defaultValue="prs">
        <TabsList>
          <TabsTrigger value="prs">Pull Requests ({pulls.length})</TabsTrigger>
          <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prs" className="space-y-2 mt-3">
          {pulls.map((pr) => (
            <Card key={pr.number}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{pr.number}</span>
                    <span className="font-medium text-sm truncate">{pr.title}</span>
                    {pr.draft && <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pr.user.login} · {pr.head.ref} → {pr.base.ref} · {new Date(pr.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 ml-2">
                  <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">View</Button>
                  </a>
                  <Button
                    size="sm"
                    onClick={() => handleMerge(pr.number)}
                    disabled={actionLoading === `merge-${pr.number}` || pr.draft}
                  >
                    {actionLoading === `merge-${pr.number}` ? "Merging..." : "Merge"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && pulls.length === 0 && <p className="text-sm text-muted-foreground py-4">No open pull requests.</p>}
        </TabsContent>

        <TabsContent value="issues" className="space-y-2 mt-3">
          {issues.map((issue) => (
            <Card key={issue.number}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{issue.number}</span>
                    <span className="font-medium text-sm truncate">{issue.title}</span>
                    {issue.labels.map((l) => (
                      <Badge key={l.name} variant="outline" className="text-[10px]">{l.name}</Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {issue.user.login} · {new Date(issue.created_at).toLocaleDateString()}
                  </div>
                </div>
                <a href={issue.html_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">View</Button>
                </a>
              </CardContent>
            </Card>
          ))}
          {!loading && issues.length === 0 && <p className="text-sm text-muted-foreground py-4">No open issues.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
