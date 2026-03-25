"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  department: string | null;
  target_repo: string | null;
  ai_triage: Record<string, unknown> | null;
  pr_url: string | null;
  created_at: string;
  created_by_profile: { email: string; full_name: string } | null;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  in_progress: "default",
  in_review: "secondary",
  done: "outline",
  closed: "outline",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-yellow-600",
  high: "text-orange-600",
  critical: "text-red-600 font-bold",
};

export function TicketBoard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("bug");
  const [priority, setPriority] = useState("medium");
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    const url = filter === "all" ? "/api/tickets" : `/api/tickets?status=${filter}`;
    const res = await fetch(url);
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, type, priority }),
    });

    if (res.ok) {
      setTitle("");
      setDescription("");
      setType("bug");
      setPriority("medium");
      setShowCreate(false);
      loadTickets();
    }
    setCreating(false);
  }

  async function updateStatus(ticketId: string, status: string) {
    await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId, status }),
    });
    loadTickets();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button>Create Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Ticket</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTicket} className="space-y-4">
                <Input
                  placeholder="Ticket title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <Textarea
                  placeholder="Describe the issue or request..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-2">
                  <Select value={type} onValueChange={(v) => v && setType(v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="improvement">Improvement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating..." : "Create Ticket"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  AI will automatically triage this ticket after creation.
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Loading tickets...</p>}

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <Card
            key={ticket.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_COLORS[ticket.status] || "secondary"}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline">{ticket.type}</Badge>
                    <span className={`text-xs ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm">{ticket.title}</h3>
                  {ticket.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {ticket.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{ticket.created_by_profile?.full_name || ticket.created_by_profile?.email || "Unknown"}</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                    {ticket.ai_triage && <Badge variant="outline" className="text-[10px]">AI Triaged</Badge>}
                    {ticket.pr_url && <a href={ticket.pr_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>PR</a>}
                  </div>
                </div>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => { if (v) { updateStatus(ticket.id, v); } }}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedTicket?.id === ticket.id && ticket.ai_triage && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                  <p className="font-medium">AI Triage Analysis</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Area:</span> {(ticket.ai_triage as Record<string, string>).likely_area}</div>
                    <div><span className="text-muted-foreground">Repo:</span> {(ticket.ai_triage as Record<string, string>).suggested_repo}</div>
                    <div><span className="text-muted-foreground">Priority:</span> {(ticket.ai_triage as Record<string, string>).suggested_priority}</div>
                  </div>
                  <p className="text-xs"><span className="text-muted-foreground">Hypothesis:</span> {(ticket.ai_triage as Record<string, string>).root_cause_hypothesis}</p>
                  {(ticket.ai_triage as Record<string, string[]>).suggested_next_steps && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Next Steps:</span>
                      <ul className="list-disc list-inside mt-1">
                        {((ticket.ai_triage as Record<string, string[]>).suggested_next_steps || []).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {!loading && tickets.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg font-medium">No tickets yet</p>
            <p className="text-sm mt-1">Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
