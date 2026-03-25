"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  subject: string;
  recipients: string[];
  status: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

export function EmailHistory({ refreshKey }: { refreshKey: number }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/emails").then((r) => r.json()).then(setCampaigns);
  }, [refreshKey]);

  if (!campaigns.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent Emails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">{c.subject}</p>
              <p className="text-xs text-muted-foreground">
                {c.recipients.length} recipient(s) · {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "Draft"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {c.sent_count > 0 && <span className="text-xs text-muted-foreground">{c.sent_count} sent</span>}
              <Badge variant={c.status === "sent" ? "default" : c.status === "draft" ? "secondary" : "destructive"}>
                {c.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
