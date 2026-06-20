"use client";

import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import {
  ChevronDown,
  Copy,
  FileText,
  Maximize2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { PlotlyChart, DataTable, type ChartSpec, type TableSpec } from "./agent-plotly-chart";
import { AgentThinkingTrace } from "./agent-thinking-trace";
import { AgentApprovalCard } from "./agent-approval-card";
import type { ApprovalView } from "@/lib/agent/approvals/types";

type Part = Record<string, unknown>;
interface UIMessageLike {
  id: string;
  role: string;
  parts?: Part[];
}

interface Citation {
  fileId: string;
  score: number;
  title?: string;
  source?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  file: "Document",
  manual: "Document",
  gmail: "Gmail",
  slack: "Slack",
  github: "GitHub",
  "google-drive": "Google Drive",
  memory: "Memory",
};
function sourceLabel(source?: string): string {
  return (source && SOURCE_LABELS[source]) || "Source";
}
/** Best human name for a citation: its title, else the raw reference. */
function citationName(c: Citation): string {
  return c.title?.trim() || c.fileId;
}
/** Collapse multiple snippet-citations of the same file into one, first wins. */
function dedupeByFileId(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of citations) {
    if (seen.has(c.fileId)) continue;
    seen.add(c.fileId);
    out.push(c);
  }
  return out;
}
interface ToolOutput {
  source?: "database" | "content";
  markdown?: string;
  citations?: Citation[];
  sql?: string | null;
  hasChart?: boolean;
  chart?: ChartSpec;
  table?: TableSpec;
  origins?: string[];
  /** request_approval tool output: a human-in-the-loop action awaiting decision. */
  approval?: ApprovalView | null;
}

export interface SourceRef {
  title: string;
  fileId: string;
  source?: string;
  kind?: "markdown" | "md" | "text" | "image" | "pdf" | "report" | "chart" | "xlsx" | "html";
  chart?: ChartSpec;
  table?: TableSpec;
}

function kindFromExt(name: string): SourceRef["kind"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (["md", "markdown"].includes(ext)) return "md";
  if (["xlsx", "csv"].includes(ext)) return "xlsx";
  if (["txt", "log", "json"].includes(ext)) return "text";
  return "report";
}

/** A string that is an absolute local file path with an extension. */
const FILE_PATH = /^(\/Users\/[^\s`]+|\/[^\s`]+)\.[A-Za-z0-9]{1,6}$/;

function textFromParts(parts: Part[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => String((p as { text?: string }).text ?? ""))
    .join("");
}

function toolOutputs(parts: Part[]): ToolOutput[] {
  return parts
    .filter((p) => {
      const t = String(p.type ?? "");
      return t.startsWith("tool-") || t === "dynamic-tool";
    })
    .map((p) => p.output as ToolOutput | undefined)
    .filter((o): o is ToolOutput => Boolean(o));
}

/** Streamed answer with [n] citations turned into clickable chips — ported
 *  from recally Answer.tsx, adapted to citation-index (1..N) ordering. */
function Answer({
  text,
  citations,
  onOpenSource,
}: {
  text: string;
  citations: Citation[];
  onOpenSource?: (ref: SourceRef) => void;
}) {
  const processed = useMemo(() => {
    let t = text
      // Strip internal reference tokens the model sometimes parrots from tool
      // output (e.g. 【gmail:19ec…】, [slack:C123], 【google-drive:…】). These are
      // plumbing, not user-facing — the Sources list below has the real links.
      .replace(/[【[]\s*(?:gmail|slack|github|google-drive|drive|memory|file)\s*:[^】\]]+[】\]]/gi, "")
      // OpenAI-style citations with a dagger: 【1†source】, 【1†file.csv】,
      // 【1:0†source】, and the square-bracket variant → plain [n].
      .replace(/[【\[]\s*(\d+)(?::\d+)?\s*†[^】\]]*[】\]]/g, (m, n) => {
        const i = parseInt(n, 10);
        return i >= 1 && i <= citations.length ? `[${n}]` : m;
      })
      // Normalize the various citation forms the model emits to plain [n].
      .replace(/【\s*#?\s*(\d+)\s*】/g, "[$1]")
      .replace(/\[\s*#\s*(\d+)\s*\]/g, "[$1]")
      // Numbered citations -> clickable cite links.
      .replace(/\[(\d+)\](?!\()/g, (m, n) => {
        const i = parseInt(n, 10);
        return i >= 1 && i <= citations.length ? `[${n}](cite://${n})` : m;
      });
    // Bracketed/parenthesized "source N" markers (e.g. [source 1], (source 2),
    // 【source】) -> clickable cite. A numbered form maps to that source; a bare
    // "source" opens the first.
    if (citations.length > 0) {
      t = t
        .replace(/[[(（]\s*sources?\s*#?\s*(\d+)\s*[\])）]/gi, (m, n) => {
          const i = parseInt(n, 10);
          return i >= 1 && i <= citations.length ? `[source](cite://${n})` : m;
        })
        .replace(/【\s*sources?\s*】/gi, "[source](cite://1)")
        .replace(/\[\s*sources?\s*\](?!\()/gi, "[source](cite://1)");
    }
    return t;
  }, [text, citations.length]);

  return (
    <div className="selectable answer-md">
      <Streamdown
        mode="streaming"
        parseIncompleteMarkdown
        linkSafety={{ enabled: false }}
        urlTransform={(u) => (/^\s*(?:javascript|data|vbscript):/i.test(u) ? "" : u)}
        components={{
          img: ({ alt }) => <>{alt ?? ""}</>,
          table: ({ children }) => (
            <div className="md-table-wrap">
              <table>{children}</table>
            </div>
          ),
          code: ({ className, children }) => {
            const txt = String(children ?? "");
            const trimmed = txt.trim();
            // An inline `code` span that names one of this answer's sources →
            // make it open that source (e.g. `instagram-60-post-calendar.csv`).
            if (!className && citations.length) {
              const hit = citations.find((c) => citationName(c).toLowerCase() === trimmed.toLowerCase());
              if (hit) {
                const name = citationName(hit);
                return (
                  <button
                    className="path-link"
                    title={`Open source: ${name}`}
                    onClick={() => onOpenSource?.({ title: name, fileId: hit.fileId, source: hit.source, kind: kindFromExt(name) })}
                  >
                    {children}
                  </button>
                );
              }
            }
            if (!className && FILE_PATH.test(trimmed)) {
              return (
                <button
                  className="path-link"
                  title={trimmed}
                  onClick={() => onOpenSource?.({ title: trimmed, fileId: trimmed })}
                >
                  {trimmed}
                </button>
              );
            }
            return <code className={className}>{children}</code>;
          },
          a: ({ href, children }) => {
            if (href?.startsWith("cite://")) {
              const n = parseInt(href.slice("cite://".length), 10);
              const src = citations[n - 1];
              if (!src) return <>{children}</>;
              const label = String(children ?? n);
              const isWord = !/^\d+$/.test(label);
              const name = citationName(src);
              return (
                <button
                  className={isWord ? "cite cite-word" : "cite"}
                  title={`Open source: ${name}`}
                  aria-label={`Open source ${n}: ${name}`}
                  onClick={() => onOpenSource?.({ title: name, fileId: src.fileId, source: src.source, kind: kindFromExt(name) })}
                >
                  {isWord ? "source" : n}
                </button>
              );
            }
            const safe = href && /^(https?:\/\/|mailto:)/i.test(href);
            if (!safe) return <>{children}</>;
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--blue)", textDecoration: "none", wordBreak: "break-all" }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </Streamdown>
    </div>
  );
}

function ChartCard({
  chart,
  table,
  onOpenSource,
}: {
  chart: ChartSpec;
  table?: TableSpec;
  onOpenSource?: (ref: SourceRef) => void;
}) {
  return (
    <div className="card" style={{ position: "relative", padding: 12, margin: "14px 0 0" }}>
      {onOpenSource && (
        <button
          className="iconbtn tip"
          data-tip="Open in panel"
          aria-label="Open in panel"
          style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
          onClick={() => onOpenSource({ title: chart.title ?? "Chart", fileId: "chart", kind: "chart", chart, table })}
        >
          <Maximize2 aria-hidden="true" style={{ width: 14, height: 14 }} />
        </button>
      )}
      <PlotlyChart chart={chart} height={240} />
    </div>
  );
}

function SourceRow({
  citation,
  onOpenSource,
}: {
  citation: Citation;
  onOpenSource?: (ref: SourceRef) => void;
}) {
  const name = citationName(citation);
  const sub = sourceLabel(citation.source);
  return (
    <button
      className="lrow"
      aria-label={`Open ${name}`}
      onClick={() => onOpenSource?.({ title: name, fileId: citation.fileId, source: citation.source, kind: kindFromExt(name) })}
    >
      <div className="fic fic-file">
        <FileText className="lucide" aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: 13.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.004em",
            color: "var(--ink)",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{sub}</div>
      </div>
      <span
        className="btn btn-outline"
        style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", flexShrink: 0, fontSize: 12.5 }}
      >
        Open
        <ChevronDown className="lucide" aria-hidden="true" style={{ width: 13, height: 13 }} />
      </span>
    </button>
  );
}

export function AgentMessage({
  message,
  busy,
  onOpenSource,
}: {
  message: UIMessageLike;
  busy: boolean;
  onOpenSource?: (ref: SourceRef) => void;
}) {
  const parts = message.parts ?? [];

  // User: right-aligned subtle gray bubble (recally markup).
  if (message.role === "user") {
    return (
      <div className="rise" style={{ display: "flex", justifyContent: "flex-end", margin: "14px 0 4px" }}>
        <div
          className="selectable"
          style={{
            background: "#f4f4f4",
            borderRadius: "var(--r-bubble)",
            padding: "10px 15px",
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: "72%",
            whiteSpace: "pre-wrap",
          }}
        >
          {textFromParts(parts)}
        </div>
      </div>
    );
  }

  return <AssistantTurn parts={parts} busy={busy} onOpenSource={onOpenSource} />;
}

function traceSteps(parts: Part[]): { index: number; tool: string; text: string }[] {
  return parts
    .filter((p) => p.type === "data-trace-step" && p.data && typeof p.data === "object")
    .map((p) => p.data as { index: number; tool: string; text: string });
}

function hasFinalText(parts: Part[]): boolean {
  return parts.some((p) => p.type === "text" && typeof p.text === "string" && (p.text as string).trim().length > 0);
}

function AssistantTurn({
  parts,
  busy,
  onOpenSource,
}: {
  parts: Part[];
  busy: boolean;
  onOpenSource?: (ref: SourceRef) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"" | "up" | "down">("");
  const [allSources, setAllSources] = useState(false);

  const text = textFromParts(parts);
  const outputs = toolOutputs(parts);
  const citations = outputs.flatMap((o) => o.citations ?? []);
  // Distinct sources for the list/counts (a doc can produce several snippet
  // citations); the inline [n] chips still index the full per-snippet array.
  const dedupedCitations = dedupeByFileId(citations);
  const chart = outputs.find((o) => o.chart)?.chart;
  const table = outputs.find((o) => o.table)?.table;
  const approvals = outputs
    .map((o) => o.approval)
    .filter((a): a is ApprovalView => Boolean(a));
  const nSources = dedupedCitations.length;

  return (
    <div className="rise">
      {/* thinking trace */}
      <AgentThinkingTrace steps={traceSteps(parts)} answered={hasFinalText(parts)} />

      {/* answer */}
      {text === "" && busy ? (
        <div className="thinking" style={{ color: "var(--ink-3)", fontSize: 14, padding: "8px 0" }} />
      ) : text ? (
        <div style={{ fontSize: 14, lineHeight: 1.72, paddingTop: 6 }}>
          <Answer text={text} citations={citations} onOpenSource={onOpenSource} />
        </div>
      ) : null}

      {/* chart */}
      {chart && <ChartCard chart={chart} table={table} onOpenSource={onOpenSource} />}

      {/* data table */}
      {table && <DataTable table={table} />}

      {/* approval requests — actions awaiting the user's decision */}
      {approvals.map((a) => (
        <AgentApprovalCard key={a.id} approval={a} />
      ))}

      {/* sources filecard */}
      {nSources > 0 && text !== "" && (
        <div className="card" style={{ overflow: "hidden", margin: "14px 0 0", borderRadius: "var(--r-card)" }}>
          {(allSources ? dedupedCitations : dedupedCitations.slice(0, 3)).map((c, i) => (
            <SourceRow key={`${c.fileId}-${i}`} citation={c} onOpenSource={onOpenSource} />
          ))}
          {nSources > 3 && (
            <button className="showmore-row" aria-expanded={allSources} onClick={() => setAllSources(!allSources)}>
              {allSources ? "Show less" : `Show ${nSources - 3} more`}
              <ChevronDown
                className="lucide"
                aria-hidden="true"
                style={{ width: 13, height: 13, transition: "transform .18s ease", transform: allSources ? "rotate(180deg)" : "" }}
              />
            </button>
          )}
        </div>
      )}

      {/* actions */}
      {text !== "" && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 10, color: "var(--ink-3)" }}>
          <button
            className="iconbtn tip"
            data-tip={copied ? "Copied" : "Copy"}
            aria-label={copied ? "Copied" : "Copy"}
            style={{ width: 28, height: 28 }}
            onClick={() => {
              navigator.clipboard.writeText(text).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            <Copy aria-hidden="true" style={{ width: 14.5, height: 14.5 }} />
          </button>
          <button
            className="iconbtn tip"
            data-tip="Good answer"
            aria-label="Good answer"
            aria-pressed={vote === "up"}
            style={{ width: 28, height: 28, color: vote === "up" ? "var(--green)" : undefined }}
            onClick={() => setVote(vote === "up" ? "" : "up")}
          >
            <ThumbsUp aria-hidden="true" style={{ width: 14.5, height: 14.5 }} />
          </button>
          <button
            className="iconbtn tip"
            data-tip="Bad answer"
            aria-label="Bad answer"
            aria-pressed={vote === "down"}
            style={{ width: 28, height: 28, color: vote === "down" ? "var(--red)" : undefined }}
            onClick={() => setVote(vote === "down" ? "" : "down")}
          >
            <ThumbsDown aria-hidden="true" style={{ width: 14.5, height: 14.5 }} />
          </button>
        </div>
      )}
    </div>
  );
}
