"use client";

import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Maximize2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { PlotlyChart, DataTable, type ChartSpec, type TableSpec } from "./agent-plotly-chart";

type Part = Record<string, unknown>;
interface UIMessageLike {
  id: string;
  role: string;
  parts?: Part[];
}

interface Citation {
  fileId: string;
  score: number;
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
}

export interface SourceRef {
  title: string;
  fileId: string;
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
    return text
      .replace(/【(\d+)】/g, "[$1]")
      .replace(/\[(\d+)\](?!\()/g, (m, n) => {
        const i = parseInt(n, 10);
        return i >= 1 && i <= citations.length ? `[${n}](cite://${n})` : m;
      });
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
            if (!className && FILE_PATH.test(txt.trim())) {
              const p = txt.trim();
              return (
                <button
                  className="path-link"
                  title={p}
                  onClick={() => onOpenSource?.({ title: p, fileId: p })}
                >
                  {p}
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
              return (
                <button
                  className="cite"
                  title={src.fileId}
                  aria-label={`Open source ${n}`}
                  onClick={() => onOpenSource?.({ title: src.fileId, fileId: src.fileId })}
                >
                  {n}
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
  origin,
  onOpenSource,
}: {
  citation: Citation;
  origin?: string;
  onOpenSource?: (ref: SourceRef) => void;
}) {
  const sub = origin ?? `${(citation.score * 100).toFixed(0)}% match`;
  return (
    <button
      className="lrow"
      aria-label={`Open ${citation.fileId}`}
      onClick={() => onOpenSource?.({ title: citation.fileId, fileId: citation.fileId, kind: kindFromExt(citation.fileId) })}
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
          {citation.fileId}
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
  durationLabel,
  onOpenSource,
}: {
  message: UIMessageLike;
  busy: boolean;
  durationLabel?: string;
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

  return <AssistantTurn parts={parts} busy={busy} durationLabel={durationLabel} onOpenSource={onOpenSource} />;
}

function AssistantTurn({
  parts,
  busy,
  durationLabel,
  onOpenSource,
}: {
  parts: Part[];
  busy: boolean;
  durationLabel?: string;
  onOpenSource?: (ref: SourceRef) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"" | "up" | "down">("");
  const [allSources, setAllSources] = useState(false);

  const text = textFromParts(parts);
  const outputs = toolOutputs(parts);
  const citations = outputs.flatMap((o) => o.citations ?? []);
  const chart = outputs.find((o) => o.chart)?.chart;
  const table = outputs.find((o) => o.table)?.table;
  const origins = outputs.flatMap((o) => o.origins ?? []);
  const nSources = citations.length;
  const hasTool = outputs.length > 0 || busy;

  const workedLabel = busy
    ? "Working…"
    : `Searched workspace knowledge${nSources ? ` · ${nSources} sources` : ""}${durationLabel ? ` · ${durationLabel}` : ""}`;

  return (
    <div className="rise">
      {/* worked row */}
      {hasTool && (
        <button
          className="btn-ghost"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={workedLabel}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            color: "var(--ink-3)",
            margin: "20px 0 4px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: 7,
            padding: "3px 6px 3px 4px",
            fontFamily: "var(--font-body)",
          }}
        >
          <ChevronRight
            className="lucide"
            aria-hidden="true"
            style={{ width: 13, height: 13, transition: "transform .18s ease", transform: open ? "rotate(90deg)" : "" }}
          />
          {workedLabel}
        </button>
      )}
      {open && (
        <div
          style={{
            borderLeft: "2px solid var(--line)",
            margin: "4px 0 12px 10px",
            padding: "6px 0 6px 16px",
            fontSize: 12.5,
            color: "var(--ink-2)",
            lineHeight: 1.9,
          }}
        >
          Embedded your question and searched workspace knowledge
          <br />
          Assembled context from {nSources} source{nSources === 1 ? "" : "s"}
          {origins.length > 0 ? ` across ${origins.join(", ")}` : ""}
        </div>
      )}

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

      {/* sources filecard */}
      {nSources > 0 && text !== "" && (
        <div className="card" style={{ overflow: "hidden", margin: "14px 0 0", borderRadius: "var(--r-card)" }}>
          {(allSources ? citations : citations.slice(0, 3)).map((c, i) => (
            <SourceRow key={`${c.fileId}-${i}`} citation={c} origin={origins[i]} onOpenSource={onOpenSource} />
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
