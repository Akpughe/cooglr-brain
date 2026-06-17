"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  onSent: () => void;
}

export function EmailComposer({ onSent }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(null);

    const recipients = to.split(",").map((e) => e.trim()).filter(Boolean);
    if (!recipients.length) { setError("Enter at least one recipient"); setSending(false); return; }

    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", subject, bodyHtml: body, recipients }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setSuccess(`Sent to ${data.sentCount} recipient(s)`);
      setTo("");
      setSubject("");
      setBody("");
      onSent();
    }
    setSending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose Email</CardTitle>
        <CardDescription>Send emails via your connected Google account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-3">
          <Input placeholder="To (comma-separated emails)" value={to} onChange={(e) => setTo(e.target.value)} required />
          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <Textarea placeholder="Email body (HTML supported)" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          <div className="flex gap-2">
            <Button type="submit" disabled={sending}>{sending ? "Sending..." : "Send Email"}</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
