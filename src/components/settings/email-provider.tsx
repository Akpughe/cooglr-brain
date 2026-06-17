"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Provider {
  id: string;
  name: string;
  display_name: string | null;
  from_email: string;
  from_name: string | null;
  reply_to_email: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
}

const INPUT = "w-full h-8 px-3 rounded-md border border-border bg-background text-[13px] focus-visible:ring-2 focus-visible:ring-ring/50 outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40";

const PROVIDERS = [
  { value: "resend", label: "Resend", description: "Modern email API with React Email support" },
];

export function EmailProviderSettings({ workspaceId }: { workspaceId: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [providerName, setProviderName] = useState("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editApiKey, setEditApiKey] = useState("");
  const [editFromEmail, setEditFromEmail] = useState("");
  const [editFromName, setEditFromName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/emails/providers?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => { setProviders(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  function startEditing(p: Provider) {
    setEditingId(p.id);
    setEditApiKey("");
    setEditFromEmail(p.from_email);
    setEditFromName(p.from_name || "");
    setEditDisplayName(p.display_name || p.name);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/emails/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: providerName, apiKey, fromEmail, fromName, workspaceId }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setProviders((prev) => [data, ...prev]);
      setShowAdd(false);
      setApiKey("");
      setFromEmail("");
      setFromName("");
    }
    setSaving(false);
  }

  async function handleEdit(id: string) {
    setEditSaving(true);
    setEditError(null);

    const body: Record<string, string> = {
      id,
      workspaceId,
      fromEmail: editFromEmail,
      fromName: editFromName,
      displayName: editDisplayName,
    };
    if (editApiKey.trim()) body.apiKey = editApiKey;

    const res = await fetch("/api/emails/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error);
    } else {
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
      setEditingId(null);
    }
    setEditSaving(false);
  }

  async function removeProvider(id: string) {
    if (!confirm("Remove this email provider?")) return;
    await fetch("/api/emails/providers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, workspaceId }),
    });
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-surface">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-medium text-foreground">Email Provider</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Connect an email service to send marketing campaigns</p>
        </div>
        {!showAdd && providers.length === 0 && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Provider
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <label className="text-[11px] font-medium text-foreground/80 block mb-1">Provider</label>
              <select value={providerName} onChange={(e) => setProviderName(e.target.value)}
                className={cn(INPUT, "appearance-none cursor-pointer")}>
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-foreground/80 block mb-1">API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="re_..." required className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-foreground/80 block mb-1">From Email</label>
                <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourdomain.com" required className={INPUT} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground/80 block mb-1">From Name</label>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Company" className={INPUT} />
              </div>
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowAdd(false); setError(null); }}
                className="h-8 px-3 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? "Verifying..." : "Connect Provider"}
              </button>
            </div>
          </form>
        )}

        {/* Provider list */}
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-border overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "size-9 rounded-lg flex items-center justify-center text-[11px] font-bold border",
                  p.status === "active" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"
                )}>
                  {p.name === "resend" ? "RS" : p.name === "ses" ? "SES" : "SG"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-foreground">{p.display_name || p.name}</p>
                    {p.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 text-primary border border-primary/15">Default</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.from_name ? `${p.from_name} <${p.from_email}>` : p.from_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingId !== p.id && (
                  <>
                    <button onClick={() => startEditing(p)}
                      className="h-7 px-3 rounded-md text-[11px] text-foreground/70 hover:text-foreground hover:bg-muted/50 border border-border transition-colors">
                      Edit
                    </button>
                    <button onClick={() => removeProvider(p.id)}
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2">
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Edit form — inline expand */}
            {editingId === p.id && (
              <div className="border-t border-border px-4 py-4 bg-muted/10 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground/80 block mb-1">Display Name</label>
                  <input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="e.g. Production Resend" className={INPUT} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground/80 block mb-1">From Email</label>
                    <input value={editFromEmail} onChange={(e) => setEditFromEmail(e.target.value)} placeholder="hello@yourdomain.com" required className={INPUT} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-foreground/80 block mb-1">From Name</label>
                    <input value={editFromName} onChange={(e) => setEditFromName(e.target.value)} placeholder="Your Company" className={INPUT} />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-foreground/80 block mb-1">API Key <span className="text-muted-foreground/50 font-normal">(leave blank to keep current)</span></label>
                  <input type="password" value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)} placeholder="re_... (unchanged)" className={INPUT} />
                </div>
                {editError && <p className="text-[12px] text-destructive">{editError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={cancelEditing}
                    className="h-8 px-3 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => handleEdit(p.id)} disabled={editSaving}
                    className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {!loading && providers.length === 0 && !showAdd && (
          <div className="py-6 text-center">
            <p className="text-[13px] text-muted-foreground">No email provider connected</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Add one to start sending campaigns</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-[12px] text-primary hover:underline">Add Provider</button>
          </div>
        )}

        {loading && <div className="py-6 text-center text-[13px] text-muted-foreground">Loading...</div>}
      </div>
    </div>
  );
}
