"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  subject: string;
  html_content?: string;
  category: string;
  is_ai_generated: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

const INPUT = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40";

export function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadTemplates = useCallback(() => {
    fetch("/api/emails/templates")
      .then((r) => r.json())
      .then((data) => { setTemplates(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  if (showCreate) {
    return <TemplateCreateFlow onClose={() => { setShowCreate(false); loadTemplates(); }} />;
  }

  async function deleteTemplate(id: string) {
    await fetch("/api/emails/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-muted-foreground">
          {loading ? "Loading..." : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
        </p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Template
        </button>
      </div>

      {templates.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/20 hover:shadow-surface-md transition-all cursor-pointer">
              <div className="aspect-[4/3] bg-muted/30 border-b border-border flex items-center justify-center p-4">
                <div className="w-full max-w-[160px] space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 mx-auto"/>
                  <div className="h-2.5 bg-foreground/8 rounded w-3/4 mx-auto"/>
                  <div className="h-2 bg-foreground/5 rounded w-full"/>
                  <div className="h-2 bg-foreground/5 rounded w-5/6"/>
                  <div className="h-6 bg-primary/10 rounded-md w-1/3 mx-auto mt-3"/>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">{t.category} · {timeAgo(t.updated_at)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                  className="p-1.5 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setShowCreate(true)} className="rounded-2xl border border-dashed border-border hover:border-primary/25 bg-card flex flex-col items-center justify-center min-h-[240px] transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 group-hover:bg-primary/8 flex items-center justify-center mb-3 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 group-hover:text-primary transition-colors"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <p className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">Create template</p>
          </button>
        </div>
      ) : !loading ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          </div>
          <p className="text-[15px] font-medium text-foreground">No templates yet</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[300px] mx-auto">Create your first email template with AI.</p>
          <button onClick={() => setShowCreate(true)} className="mt-5 h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">Create Template</button>
        </div>
      ) : null}
    </div>
  );
}

/* ======== Template Create Flow ======== */

const TONES = ["Professional", "Friendly", "Minimal", "Bold", "Playful", "Corporate"];
const PRESETS = ["Welcome email", "Monthly newsletter", "Product launch", "Promotional offer", "Event invitation", "Re-engagement", "Thank you"];

function TemplateCreateFlow({ onClose }: { onClose: () => void }) {
  // Brand state
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c2410c");
  const [tone, setTone] = useState("Professional");

  // Generate state
  const [templateName, setTemplateName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [step, setStep] = useState<"brand" | "generate" | "preview">("brand");

  async function handleGenerate() {
    if (!prompt.trim()) { setError("Describe the email you want to create"); return; }
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/emails/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          prompt: prompt.trim(),
          templateName: templateName.trim() || "AI Generated Template",
          brandConfig: {
            brandName,
            logoUrl,
            primaryColor,
            tone,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); setGenerating(false); return; }

      setGeneratedHtml(data.html_content || "");
      setGeneratedId(data.id);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
    setGenerating(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h2 className="text-[15px] font-medium text-foreground">
          {step === "brand" ? "Brand Guide" : step === "generate" ? "Generate Template" : "Preview & Save"}
        </h2>
        <div className="flex items-center gap-1 ml-auto">
          {(["brand", "generate", "preview"] as const).map((s, i) => (
            <div key={s} className={cn("w-8 h-1 rounded-full",
              step === s ? "bg-primary" : i < ["brand", "generate", "preview"].indexOf(step) ? "bg-emerald-500/40" : "bg-border"
            )}/>
          ))}
        </div>
      </div>

      {/* Brand Guide */}
      {step === "brand" && (
        <div className="rounded-2xl border border-border bg-card shadow-surface p-6 space-y-5">
          <p className="text-[13px] text-muted-foreground">Tell us about your brand so AI can generate on-brand templates.</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Brand Name</label><input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. 500Claw" className={INPUT}/></div>
            <div><label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Logo URL</label><input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className={INPUT}/></div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Primary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0.5"/>
              <span className="text-[11px] text-muted-foreground font-mono">{primaryColor}</span>
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Tone & Style</label>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button key={t} onClick={() => setTone(t)}
                  className={cn("h-7 px-3 rounded-md text-[11px] border transition-colors",
                    tone === t ? "border-primary bg-primary/8 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/20"
                  )}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setStep("generate")} className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface">Continue</button>
          </div>
        </div>
      )}

      {/* Generate */}
      {step === "generate" && (
        <div className="rounded-2xl border border-border bg-card shadow-surface p-6 space-y-5">
          <div><label className="text-[12px] font-medium text-foreground/80 block mb-1.5">Template Name</label><input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Welcome Email" className={INPUT}/></div>
          <div>
            <label className="text-[12px] font-medium text-foreground/80 block mb-1.5">What kind of email?</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the email you want. e.g. 'A welcome email for new users introducing our platform with a CTA to complete their profile'"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40 resize-none min-h-[80px]" rows={3}/>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground/80 block mb-2">Quick presets</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => { setPrompt(p); if (!templateName) setTemplateName(p); }}
                  className="h-7 px-3 rounded-md text-[11px] border border-border text-muted-foreground hover:border-primary/20 hover:text-foreground transition-colors">{p}</button>
              ))}
            </div>
          </div>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep("brand")} className="h-9 px-4 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">Back</button>
            <button onClick={handleGenerate} disabled={generating}
              className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors shadow-surface disabled:opacity-50 flex items-center gap-2">
              {generating ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"/>Generating...</>
              ) : (
                <>Generate with AI</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {step === "preview" && (
        <div className="grid grid-cols-2 gap-4">
          {/* HTML editor */}
          <div className="rounded-2xl border border-border bg-card shadow-surface overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <span className="text-[12px] font-medium text-foreground/80">HTML Source</span>
            </div>
            <textarea value={generatedHtml} onChange={(e) => setGeneratedHtml(e.target.value)}
              className="w-full h-[400px] px-4 py-3 text-[12px] font-mono bg-background focus:outline-none resize-none"/>
            <div className="px-4 py-3 border-t border-border flex justify-between">
              <button onClick={() => { setStep("generate"); setGeneratedHtml(""); setGeneratedId(null); }}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">Regenerate</button>
              <button onClick={async () => {
                if (generatedId) {
                  await fetch("/api/emails/templates", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: generatedId, htmlContent: generatedHtml }),
                  });
                }
                onClose();
              }} className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors">
                Save Template
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-2xl border border-border bg-card shadow-surface overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <span className="text-[12px] font-medium text-foreground/80">Preview</span>
            </div>
            <div className="h-[460px] overflow-auto bg-muted/20 p-4">
              {generatedHtml ? (
                <iframe srcDoc={generatedHtml} className="w-full h-full rounded-lg border border-border bg-white" sandbox="allow-same-origin" title="Email preview"/>
              ) : (
                <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground">No preview available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
