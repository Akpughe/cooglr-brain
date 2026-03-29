"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface Audience {
  id: string;
  name: string;
  contact_count: number;
  source_type: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

const SOURCE_META: Record<string, { label: string }> = {
  csv_import: { label: "CSV Import" },
  database_query: { label: "Database" },
  manual: { label: "Manual" },
};

const INPUT = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40";

export function AudiencesView() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadAudiences = useCallback(() => {
    fetch("/api/emails/audiences")
      .then((r) => r.json())
      .then((data) => { setAudiences(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadAudiences(); }, [loadAudiences]);

  async function deleteAudience(id: string) {
    await fetch("/api/emails/audiences", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAudiences((prev) => prev.filter((a) => a.id !== id));
  }

  // CSV import
  if (showImport) {
    return <CsvImportFlow onClose={() => { setShowImport(false); loadAudiences(); }} />;
  }

  // Manual create
  if (showCreate) {
    return <ManualCreateFlow onClose={() => { setShowCreate(false); loadAudiences(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-muted-foreground">
          {loading ? "Loading..." : `${audiences.length} audience${audiences.length !== 1 ? "s" : ""} · ${audiences.reduce((s, a) => s + (a.contact_count || 0), 0).toLocaleString()} total contacts`}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-card text-[13px] font-medium text-foreground hover:border-primary/25 hover:bg-muted/40 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import CSV
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Audience
          </button>
        </div>
      </div>

      {audiences.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-surface">
          {audiences.map((aud, i) => {
            const source = SOURCE_META[aud.source_type] || SOURCE_META.manual;
            return (
              <div key={aud.id} className={cn("group flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors", i < audiences.length - 1 && "border-b border-border")}>
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 text-muted-foreground/60">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{aud.name}</p>
                  <p className="text-[11px] text-muted-foreground/60">{(aud.contact_count || 0).toLocaleString()} contacts · {source.label}</p>
                </div>
                <div className="text-right shrink-0">
                  {aud.last_synced_at ? (
                    <p className="text-[11px] text-muted-foreground/50">Synced {formatDate(aud.last_synced_at)}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/40">Never synced</p>
                  )}
                </div>
                <button onClick={() => deleteAudience(aud.id)}
                  className="p-1.5 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0" title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      ) : !loading ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <p className="text-[15px] font-medium text-foreground">Build your audience</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[320px] mx-auto">Import contacts from CSV or create a manual list.</p>
          <button onClick={() => setShowImport(true)} className="mt-5 h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">Import CSV</button>
        </div>
      ) : null}
    </div>
  );
}

/* ======== CSV Import Flow ======== */

function CsvImportFlow({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file);
  }

  function parseCsv(text: string) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setError("CSV must have a header row and at least one data row"); return; }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    if (!headers.includes("email")) { setError("CSV must have an 'email' column"); return; }
    setError(null);

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    }).filter((r) => r.email);

    setParsed(rows);
  }

  async function handleImport() {
    if (!name.trim()) { setError("Audience name required"); return; }
    if (parsed.length === 0) { setError("No valid contacts found"); return; }
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/emails/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_csv",
          name: name.trim(),
          contacts: parsed,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setImporting(false); return; }
      onClose();
    } catch {
      setError("Import failed");
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h2 className="text-[15px] font-medium text-foreground">Import CSV</h2>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-surface p-6 space-y-5">
        <div>
          <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Audience Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Newsletter Subscribers" className={INPUT} />
        </div>

        <div>
          <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Upload CSV File</label>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center hover:border-primary/20 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 mx-auto mb-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-[12px] text-muted-foreground">{csvText ? `${parsed.length} contacts parsed` : "Click to select a CSV file"}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Must include an &quot;email&quot; column. Optional: first_name, last_name</p>
          </button>
        </div>

        {parsed.length > 0 && (
          <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
            <p className="text-[12px] font-medium text-foreground mb-2">Preview ({parsed.length} contacts)</p>
            <div className="max-h-[120px] overflow-y-auto space-y-0.5">
              {parsed.slice(0, 5).map((r, i) => (
                <p key={i} className="text-[11px] text-muted-foreground font-mono truncate">
                  {r.email}{r.first_name ? ` — ${r.first_name}` : ""}
                </p>
              ))}
              {parsed.length > 5 && <p className="text-[10px] text-muted-foreground/50">...and {parsed.length - 5} more</p>}
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        <div className="flex justify-between pt-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">Cancel</button>
          <button onClick={handleImport} disabled={importing || parsed.length === 0}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface disabled:opacity-40">
            {importing ? "Importing..." : `Import ${parsed.length} contacts`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======== Manual Create ======== */

function ManualCreateFlow({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) { setError("Name required"); return; }
    setCreating(true);
    const res = await fetch("/api/emails/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); setCreating(false); return; }
    onClose();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h2 className="text-[15px] font-medium text-foreground">New Audience</h2>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-surface p-6 space-y-5">
        <div>
          <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Audience Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VIP Customers" className={INPUT} />
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex justify-between pt-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">Cancel</button>
          <button onClick={handleCreate} disabled={creating}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface disabled:opacity-40">
            {creating ? "Creating..." : "Create Audience"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
