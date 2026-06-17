"use client";

import { useEffect } from "react";
import { Streamdown } from "streamdown";
import {
  ChevronRight,
  Download,
  FileText,
  Globe,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  PanelRight,
  BarChart3,
} from "lucide-react";
import { PlotlyChart, DataTable, downloadCsv, type ChartSpec, type TableSpec } from "./agent-plotly-chart";

export type PreviewKind = "pdf" | "image" | "html" | "markdown" | "text" | "md" | "xlsx" | "report" | "chart";

export interface OpenDocument {
  title: string;
  breadcrumb: string[];
  kind: PreviewKind;
  contentMd?: string;
  imageUrl?: string;
  chart?: ChartSpec;
  table?: TableSpec;
}

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  image: "Image",
  html: "Website",
  markdown: "Document · MD",
  md: "Document · MD",
  text: "Document",
  xlsx: "Spreadsheet · XLSX",
  report: "Report",
  chart: "Chart",
};

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Side preview panel — recally's PreviewPanel, adapted to in-app artifacts.
 *  Pinned at the far right; opens/closes via the panel-toggle, expands to full
 *  page, and downloads its content. No header divider. */
export function AgentDocumentViewer({
  doc,
  onClose,
  isFull,
  onToggleFull,
}: {
  doc: OpenDocument;
  onClose?: () => void;
  isFull?: boolean;
  onToggleFull?: () => void;
}) {
  const name = doc.breadcrumb[doc.breadcrumb.length - 1] ?? doc.title;
  const crumbs = doc.breadcrumb.slice(0, -1);
  const isImage = doc.kind === "image";
  const isText = doc.kind === "text";
  const isChart = doc.kind === "chart";

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function doDownload() {
    if (isChart && doc.table) {
      downloadCsv(doc.table);
    } else if (isChart && doc.chart) {
      const rows = ["name,value", ...doc.chart.data.map((d) => `${d.name},${d.value}`)].join("\n");
      download(`${name.replace(/\W+/g, "-")}.csv`, rows, "text/csv");
    } else {
      download(name.endsWith(".md") ? name : `${name}.md`, doc.contentMd ?? "", "text/markdown");
    }
  }

  const HeaderIcon = isImage ? ImageIcon : isChart ? BarChart3 : doc.kind === "html" ? Globe : FileText;

  return (
    <div
      className="rise"
      role="region"
      aria-label={`${name} preview`}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        margin: "8px 8px 8px 0",
        borderRadius: 14,
        boxShadow: "var(--shadow-card)",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* header — no divider */}
      <div style={{ height: 48, display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 16px", flexShrink: 0 }}>
        <HeaderIcon className="lucide" aria-hidden="true" style={{ color: "var(--ink-2)" }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-3)", fontSize: 12.5, flexShrink: 1, minWidth: 0 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{c}</span>
                <ChevronRight className="lucide" aria-hidden="true" style={{ width: 11, height: 11 }} />
              </span>
            ))}
            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          </span>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)", flexShrink: 0 }}>{KIND_LABEL[doc.kind] ?? "Document"}</span>
        </div>

        <button className="iconbtn tip" data-tip="Download" onClick={doDownload} aria-label="Download">
          <Download aria-hidden="true" style={{ width: 16, height: 16 }} />
        </button>
        {onToggleFull && (
          <button className="iconbtn tip" data-tip={isFull ? "Collapse" : "Full page"} onClick={onToggleFull} aria-label={isFull ? "Collapse to panel" : "Expand to full page"}>
            {isFull ? <Minimize2 aria-hidden="true" style={{ width: 16, height: 16 }} /> : <Maximize2 aria-hidden="true" style={{ width: 16, height: 16 }} />}
          </button>
        )}
        <button className="iconbtn tip" data-tip="Close panel" onClick={onClose} aria-label="Close panel">
          <PanelRight aria-hidden="true" style={{ width: 17, height: 17 }} />
        </button>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", background: isImage ? "#FAFAFA" : "var(--bg)" }}>
        {isChart && doc.chart ? (
          <div style={{ height: "100%", overflowY: "auto", padding: "28px 30px 40px" }}>
            <div className="card" style={{ padding: 12 }}>
              <PlotlyChart chart={doc.chart} height={isFull ? 460 : 320} />
            </div>
            {doc.table && <DataTable table={doc.table} />}
          </div>
        ) : isImage && doc.imageUrl ? (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doc.imageUrl} alt={name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,.12)" }} />
          </div>
        ) : isText ? (
          <div className="selectable" style={{ height: "100%", overflowY: "auto", padding: "24px 30px 50px" }}>
            <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{doc.contentMd ?? ""}</pre>
          </div>
        ) : (
          <div className="selectable" style={{ height: "100%", overflowY: "auto", padding: "24px 30px 50px" }}>
            <div className="answer-md" style={{ maxWidth: isFull ? 760 : undefined, margin: isFull ? "0 auto" : undefined }}>
              <Streamdown mode="static" parseIncompleteMarkdown={false}>{doc.contentMd ?? ""}</Streamdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
