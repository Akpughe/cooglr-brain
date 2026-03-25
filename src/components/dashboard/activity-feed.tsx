"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Activity {
  id: string;
  action: string;
  section: string;
  title: string;
  description: string | null;
  created_at: string;
}

const SECTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  repos: "default",
  tickets: "secondary",
  reports: "outline",
  emails: "destructive",
  chat: "outline",
};

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then(setActivities)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      {loading && <p className="text-muted-foreground">Loading activity...</p>}

      {!loading && activities.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium">Welcome to 500Claw</p>
            <p className="text-sm mt-2">Your recent activity will appear here. Get started by:</p>
            <div className="mt-4 space-y-2 text-sm text-left max-w-sm mx-auto">
              <p>→ <a href="/chat" className="text-primary hover:underline">Chat with the AI assistant</a></p>
              <p>→ <a href="/repos" className="text-primary hover:underline">Browse your GitHub repos</a></p>
              <p>→ <a href="/tickets" className="text-primary hover:underline">Create a ticket</a></p>
              <p>→ <a href="/reports" className="text-primary hover:underline">Run a database report</a></p>
              <p>→ <a href="/emails" className="text-primary hover:underline">Send an email</a></p>
            </div>
          </CardContent>
        </Card>
      )}

      {activities.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3 flex items-start gap-3">
            <Badge variant={SECTION_COLORS[a.section] || "outline"} className="mt-0.5 text-[10px]">
              {a.section}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                {a.action} · {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
