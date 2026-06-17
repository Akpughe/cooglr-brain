"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type WFNodeKind = "trigger" | "action" | "decision" | "output";

export type WFNode = {
  id: string;
  kind: WFNodeKind;
  title: string;
  subtitle?: string;
  /** brand accent hex, used for the icon tile + connect label */
  brand?: string;
  /** an inline SVG/element, or a short emoji/text glyph */
  icon?: ReactNode | string;
  x: number;
  y: number;
};

export type WFEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type AgentWorkflowCanvasProps = {
  nodes?: WFNode[];
  edges?: WFEdge[];
  autoBuild?: boolean;
};

/* ------------------------------------------------------------------ */
/* Palette (canvas-local, matches the reference HTML)                  */
/* ------------------------------------------------------------------ */

const C = {
  bg: "#F8F8FA",
  dot: "#E5E5E6",
  card: "#ffffff",
  cardAlt: "#FAFAFA",
  border: "#E5E5E5",
  borderStrong: "#D6D6D6",
  text: "#2a2530",
  textSoft: "#5a5060",
  textFaint: "#8a8590",
  accent: "#FD3099",
  accentSoft: "#FFEAF5",
  blue: "#017BFF",
  blueSoft: "#E6F2FF",
  edge: "#D6D6D6",
} as const;

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/* card geometry (canvas-world coords) */
const CARD_W = 240;
const HEADER_H = 52; // approx card height for non-decision nodes
const DECISION_H = 64;

function nodeHeight(n: WFNode): number {
  if (n.kind === "decision") return DECISION_H;
  if (n.subtitle) return 72;
  return HEADER_H;
}
function nodeWidth(n: WFNode): number {
  return n.kind === "trigger" ? 260 : CARD_W;
}

/* ------------------------------------------------------------------ */
/* Built-in icons                                                      */
/* ------------------------------------------------------------------ */

const stroke: CSSProperties = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ClockIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" style={stroke}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const SearchIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" style={stroke}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </svg>
);

const ClaudeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <path
      fill="#d97757"
      d="M4.7 16l4.7-2.6.1-.4-.1-.2h-.4l-1.5-.1-5-.2-1.3-.1L0 11.9l.7-.6.9.1 2 .2 3 .2h.4l.1-.2-.2-.1-.1-.1-3-2-3.2-2.1L0 7l-.4-.5-.2-1 .8-.9 1.1.1.3.1 1.1.9 2.4 1.8 3.1 2.3.5.4.2-.1v-.1l-.2-.4-1.7-3-1.8-3.1-.8-1.3-.2-.8c-.1-.3-.1-.6-.1-.9l.9-1.3.5-.1 1.2.1.5.5.8 1.7 1.2 2.8 1.9 3.8.6 1.1.3 1V8.8l.2-2.1.3-2.6.3-3.4.1-.9.4-1.1.9-.6.7.3.6.9-.1.5-.4 2.3-.7 3.6-.4 2.4h.3l.3-.3 1.2-1.6 2-2.6.9-1 1-1.1.7-.5h1.3l.9 1.4-.4 1.5-1.3 1.7-1.1 1.4-1.6 2.1-1 1.7.1.1.2-.1 3.5-.7 1.9-.4 2.3-.4 1 .5.1.5-.4 1-2.4.6-2.9.6-4.2 1-.1.1.1.1 1.9.1.8.1h2l3.7.3 1 .6.6.8-.1.6-1.5.8-2-.5-4.7-1.1-1.6-.4h-.2v.1l1.3 1.3 2.5 2.2 3.1 2.9.2.7-.4.6-.4-.1-2.7-2-1-.9-2.4-2h-.2v.2l.5.8 2.9 4.3.1 1.3-.2.4-.7.3-.8-.1-1.7-2.4-1.7-2.7-1.4-2.4-.2.1-.8 9-.4.5-.9.3-.7-.6-.4-.9.4-1.8.5-2.4.4-1.9.3-2.3.2-.8v-.1h-.2L8 22.9l-2.7 3.7-2.1 2.3-.5.2-.9-.5.1-.8.5-.7 2.9-3.7 1.8-2.3 1.1-1.3v-.2h-.1L1.5 22.9l-1.4.2-.6-.6.1-.9.3-.3 2.4-1.6Z"
    />
  </svg>
);

const BranchIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" style={stroke}>
    <path d="M16 3h5v5" />
    <path d="M8 3H3v5" />
    <path d="M12 22V8" />
    <path d="M21 3l-9 9" />
    <path d="M3 3l9 9" />
  </svg>
);

const SlackIcon = (
  <svg viewBox="0 0 270 270" width="16" height="16" aria-hidden>
    <path d="M56.73 170.62a28.36 28.36 0 1 1-28.37-28.36h28.37Z" fill="#E01E5A" />
    <path d="M71.02 170.62a28.36 28.36 0 0 1 56.72 0v71.02a28.36 28.36 0 0 1-56.72 0Z" fill="#E01E5A" />
    <path d="M99.38 56.73a28.36 28.36 0 1 1 28.36-28.37v28.37Z" fill="#36C5F0" />
    <path d="M99.38 71.02a28.36 28.36 0 0 1 0 56.72H28.36a28.36 28.36 0 0 1 0-56.72Z" fill="#36C5F0" />
    <path d="M213.27 99.38a28.36 28.36 0 1 1 28.37 28.36h-28.37Z" fill="#2EB67D" />
    <path d="M198.98 99.38a28.36 28.36 0 0 1-56.72 0V28.36a28.36 28.36 0 0 1 56.72 0Z" fill="#2EB67D" />
    <path d="M170.62 213.27a28.36 28.36 0 1 1-28.36 28.37v-28.37Z" fill="#ECB22E" />
    <path d="M170.62 198.98a28.36 28.36 0 0 1 0-56.72h71.02a28.36 28.36 0 0 1 0 56.72Z" fill="#ECB22E" />
  </svg>
);

const DocIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" style={stroke}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);

const PencilIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" style={stroke}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Default sample workflow — "Daily tech & AI brief"                   */
/* ------------------------------------------------------------------ */

const COL = 380; // center column x
const LEFT = 150;
const RIGHT = 610;

const DEFAULT_NODES: WFNode[] = [
  {
    id: "trigger",
    kind: "trigger",
    title: "Schedule",
    subtitle: "Daily · 9:00 AM",
    icon: ClockIcon,
    x: COL,
    y: 40,
  },
  {
    id: "search",
    kind: "action",
    title: "Search the web",
    subtitle: "X / Twitter · Product Hunt",
    brand: C.blue,
    icon: SearchIcon,
    x: COL,
    y: 180,
  },
  {
    id: "summarize",
    kind: "action",
    title: "Summarize findings",
    subtitle: "Claude",
    brand: "#d97757",
    icon: ClaudeIcon,
    x: COL,
    y: 320,
  },
  {
    id: "decide",
    kind: "decision",
    title: "Anything important?",
    icon: BranchIcon,
    x: COL,
    y: 462,
  },
  {
    id: "draft",
    kind: "action",
    title: "Draft brief",
    subtitle: "Claude",
    brand: "#d97757",
    icon: PencilIcon,
    x: LEFT,
    y: 612,
  },
  {
    id: "slack",
    kind: "output",
    title: "Send to Slack",
    subtitle: "#tech-daily",
    brand: "#E01E5A",
    icon: SlackIcon,
    x: LEFT,
    y: 752,
  },
  {
    id: "report",
    kind: "output",
    title: "Save to report",
    subtitle: "Archive · no alert",
    brand: C.textSoft,
    icon: DocIcon,
    x: RIGHT,
    y: 612,
  },
];

const DEFAULT_EDGES: WFEdge[] = [
  { id: "e1", from: "trigger", to: "search" },
  { id: "e2", from: "search", to: "summarize" },
  { id: "e3", from: "summarize", to: "decide" },
  { id: "e4", from: "decide", to: "draft", label: "Yes" },
  { id: "e5", from: "draft", to: "slack" },
  { id: "e6", from: "decide", to: "report", label: "No" },
];

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

function bottomAnchor(n: WFNode): Pt {
  return { x: n.x + nodeWidth(n) / 2, y: n.y + nodeHeight(n) };
}
function topAnchor(n: WFNode): Pt {
  return { x: n.x + nodeWidth(n) / 2, y: n.y };
}

/** smooth vertical bezier between two anchor points */
function edgePath(a: Pt, b: Pt): string {
  const dy = Math.max(40, Math.abs(b.y - a.y) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function AgentWorkflowCanvas({
  nodes: nodesProp,
  edges: edgesProp,
  autoBuild = true,
}: AgentWorkflowCanvasProps) {
  const nodes = useMemo(() => nodesProp ?? DEFAULT_NODES, [nodesProp]);
  const edges = useMemo(() => edgesProp ?? DEFAULT_EDGES, [edgesProp]);

  const nodeById = useMemo(() => {
    const m = new Map<string, WFNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  /* ---- build order (BFS layers from roots) ---- */
  const { nodeOrder, nodeAppearAt } = useMemo(() => {
    const incoming = new Set(edges.map((e) => e.to));
    const roots = nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
    const order: string[] = [];
    const seen = new Set<string>();
    let frontier = roots.length ? roots : nodes.slice(0, 1).map((n) => n.id);
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        if (seen.has(id)) continue;
        seen.add(id);
        order.push(id);
        edges.filter((e) => e.from === id).forEach((e) => next.push(e.to));
      }
      frontier = next;
    }
    nodes.forEach((n) => {
      if (!seen.has(n.id)) order.push(n.id);
    });
    const appear = new Map<string, number>();
    order.forEach((id, i) => appear.set(id, i));
    return { nodeOrder: order, nodeAppearAt: appear };
  }, [nodes, edges]);

  /* ---- pan / zoom ---- */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;
  const [isPanning, setIsPanning] = useState(false);

  const clampZoom = (z: number) => Math.min(1.6, Math.max(0.4, z));

  const fitView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || nodes.length === 0) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + nodeWidth(n)));
    const maxY = Math.max(...nodes.map((n) => n.y + nodeHeight(n)));
    const w = maxX - minX;
    const h = maxY - minY;
    const pad = 80;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const z = clampZoom(Math.min((vw - pad * 2) / w, (vh - pad * 2) / h, 1.2));
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    setZoom(z);
    setPan({ x: vw / 2 - cx * z, y: vh / 2 - cy * z });
  }, [nodes]);

  // initial fit once mounted
  useLayoutEffect(() => {
    fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const vp = viewportRef.current;
    setZoom((z0) => {
      const z = clampZoom(z0 * factor);
      if (vp) {
        const cx = vp.clientWidth / 2;
        const cy = vp.clientHeight / 2;
        const p = panRef.current;
        const wx = (cx - p.x) / z0;
        const wy = (cy - p.y) / z0;
        setPan({ x: cx - wx * z, y: cy - wy * z });
      }
      return z;
    });
  }, []);

  // ctrl/cmd-scroll zoom (non-passive listener so preventDefault works)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const z0 = zoomRef.current;
      const z = clampZoom(z0 * (e.deltaY < 0 ? 1.08 : 0.926));
      const p = panRef.current;
      const wx = (px - p.x) / z0;
      const wy = (py - p.y) / z0;
      setZoom(z);
      setPan({ x: px - wx * z, y: py - wy * z });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  // panning by dragging empty space
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const onPanDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node]") || target.closest("[data-toolbar]")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setIsPanning(true);
  };
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) });
    };
    const onUp = () => {
      dragRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning]);

  /* ---- build-out animation ---- */
  const [builtCount, setBuiltCount] = useState(autoBuild ? 0 : nodeOrder.length);
  useEffect(() => {
    if (!autoBuild) {
      setBuiltCount(nodeOrder.length);
      return;
    }
    setBuiltCount(0);
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      i += 1;
      setBuiltCount(i);
      if (i < nodeOrder.length) {
        timers.push(setTimeout(tick, 120));
      }
    };
    timers.push(setTimeout(tick, 260));
    return () => timers.forEach(clearTimeout);
  }, [autoBuild, nodeOrder.length]);

  const isNodeBuilt = (id: string) => {
    const idx = nodeAppearAt.get(id) ?? 0;
    return idx < builtCount;
  };
  // an edge appears once its target node has appeared
  const isEdgeBuilt = (e: WFEdge) => isNodeBuilt(e.to);

  /* ---- run animation ---- */
  const [running, setRunning] = useState(false);
  const [runNodes, setRunNodes] = useState<Set<string>>(new Set());
  const [doneNodes, setDoneNodes] = useState<Set<string>>(new Set());
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>("");
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearRunTimers = () => {
    runTimers.current.forEach(clearTimeout);
    runTimers.current = [];
  };

  const runWorkflow = useCallback(() => {
    if (running) return;
    clearRunTimers();
    setRunning(true);
    setDoneNodes(new Set());
    setRunNodes(new Set());
    setActiveEdges(new Set());

    // sequential order following nodeOrder
    const seq = nodeOrder;
    const stepMs = 720;
    seq.forEach((id, i) => {
      const at = 200 + i * stepMs;
      runTimers.current.push(
        setTimeout(() => {
          setRunNodes(new Set([id]));
          setStatus(`Running… step ${i + 1} of ${seq.length}`);
          // light up outgoing edges
          const outs = edges.filter((e) => e.from === id).map((e) => e.id);
          setActiveEdges(new Set(outs));
        }, at)
      );
      runTimers.current.push(
        setTimeout(() => {
          setDoneNodes((prev) => {
            const s = new Set(prev);
            s.add(id);
            return s;
          });
        }, at + stepMs - 120)
      );
    });
    const total = 200 + seq.length * stepMs + 200;
    runTimers.current.push(
      setTimeout(() => {
        setRunNodes(new Set());
        setActiveEdges(new Set());
        setStatus("Completed");
        setRunning(false);
      }, total)
    );
  }, [running, nodeOrder, edges]);

  useEffect(() => () => clearRunTimers(), []);

  /* ---- render ---- */
  const worldTransform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div
      ref={viewportRef}
      onMouseDown={onPanDown}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 480,
        overflow: "hidden",
        background: C.bg,
        cursor: isPanning ? "grabbing" : "grab",
        borderRadius: 16,
        userSelect: "none",
      }}
    >
      {/* dotted world */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: C.bg,
          backgroundImage: `radial-gradient(circle, ${C.dot} 1.2px, transparent 1.2px)`,
          backgroundSize: `${18 * zoom}px ${18 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          pointerEvents: "none",
        }}
      />

      {/* canvas-world */}
      <div
        className="canvas-world"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: worldTransform,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {/* edges layer */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 4000,
            height: 3000,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <marker
              id="wf-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke={C.edge} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker
              id="wf-arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>

          {edges.map((e) => {
            const from = nodeById.get(e.from);
            const to = nodeById.get(e.to);
            if (!from || !to) return null;
            const a = bottomAnchor(from);
            const b = topAnchor(to);
            const d = edgePath(a, b);
            const built = isEdgeBuilt(e);
            const active = activeEdges.has(e.id);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            return (
              <Edge
                key={e.id}
                d={d}
                built={built}
                active={active}
                label={e.label}
                labelPos={mid}
              />
            );
          })}
        </svg>

        {/* nodes layer */}
        {nodes.map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            built={isNodeBuilt(n.id)}
            buildIndex={nodeAppearAt.get(n.id) ?? 0}
            running={runNodes.has(n.id)}
            done={doneNodes.has(n.id)}
          />
        ))}
      </div>

      {/* toolbar */}
      <div
        data-toolbar
        style={{
          position: "absolute",
          left: 16,
          bottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 6,
          borderRadius: 14,
          background: C.cardAlt,
          border: `0.5px solid ${C.borderStrong}`,
          boxShadow: "0 4px 10px rgba(0,0,0,.05)",
          backdropFilter: "blur(20px)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ToolBtn label="Zoom out" onClick={() => zoomBy(1 / 1.18)}>
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ ...stroke, color: C.textSoft }}>
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </ToolBtn>
        <div
          style={{
            minWidth: 44,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 500,
            color: C.textSoft,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(zoom * 100)}%
        </div>
        <ToolBtn label="Zoom in" onClick={() => zoomBy(1.18)}>
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ ...stroke, color: C.textSoft }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </ToolBtn>
        <div style={{ width: 1, height: 22, background: C.border, margin: "0 2px" }} />
        <button
          onClick={fitView}
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 9,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: C.text,
            background: C.card,
            border: `0.5px solid ${C.border}`,
            boxShadow: "0 1px 2px rgba(0,0,0,.06)",
          }}
        >
          Fit
        </button>
      </div>

      {/* run + status (bottom-right) */}
      <div
        data-toolbar
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {status && (
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: status === "Completed" ? "#1f9d55" : C.accent,
              background: C.cardAlt,
              border: `0.5px solid ${C.borderStrong}`,
              padding: "8px 12px",
              borderRadius: 12,
              boxShadow: "0 1px 2px rgba(0,0,0,.06)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: `color 0.25s ${EASE}`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: status === "Completed" ? "#1f9d55" : C.accent,
                boxShadow: running ? `0 0 0 0 ${C.accent}` : "none",
                animation: running ? "wfPulseDot 1s ease-in-out infinite" : "none",
              }}
            />
            {status}
          </div>
        )}
        <button
          onClick={runWorkflow}
          disabled={running}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 38,
            padding: "0 16px",
            borderRadius: 11,
            cursor: running ? "default" : "pointer",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#fff",
            background: running ? "#cf2a82" : C.accent,
            border: "1px solid rgba(0,0,0,.08)",
            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,.25), 0 2px 6px rgba(253,48,153,.35)",
            transition: `background 0.2s ${EASE}, transform 0.1s ${EASE}`,
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff" aria-hidden>
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
          {running ? "Running" : "Run"}
        </button>
      </div>

      <style>{keyframes}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ToolBtn({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9,
        cursor: "pointer",
        background: C.card,
        border: `0.5px solid ${C.border}`,
        boxShadow: "0 1px 2px rgba(0,0,0,.06)",
        padding: 0,
        transition: `box-shadow 0.15s ${EASE}, transform 0.1s ${EASE}`,
      }}
    >
      {children}
    </button>
  );
}

function Edge({
  d,
  built,
  active,
  label,
  labelPos,
}: {
  d: string;
  built: boolean;
  active: boolean;
  label?: string;
  labelPos: Pt;
}) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [len, setLen] = useState(0);

  useLayoutEffect(() => {
    if (pathRef.current) {
      try {
        setLen(pathRef.current.getTotalLength());
      } catch {
        setLen(600);
      }
    }
  }, [d]);

  return (
    <g>
      {/* base line, drawn progressively via dashoffset */}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={active ? C.accent : C.edge}
        strokeWidth={active ? 2.4 : 1.5}
        strokeLinecap="round"
        markerEnd={active ? "url(#wf-arrow-active)" : "url(#wf-arrow)"}
        style={{
          strokeDasharray: len,
          strokeDashoffset: built ? 0 : len,
          opacity: len ? 1 : built ? 1 : 0,
          transition: `stroke-dashoffset 0.4s ${EASE}, stroke 0.25s ${EASE}, stroke-width 0.2s ${EASE}`,
        }}
      />
      {/* start + end dots */}
      {built && (
        <>
          <circle cx={pathPointStart(d).x} cy={pathPointStart(d).y} r={4} fill="#fff" stroke={C.edge} strokeWidth={1.5} />
        </>
      )}
      {/* moving token while active */}
      {active && len > 0 && (
        <circle r={4.5} fill={C.accent}>
          <animateMotion dur="0.6s" repeatCount="indefinite" path={d} rotate="auto" />
        </circle>
      )}
      {label && built && (
        <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
          <rect x={-16} y={-11} width={32} height={22} rx={8} fill="#fff" stroke={C.border} strokeWidth={0.75} />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={600}
            fill={label.toLowerCase() === "yes" ? "#1f9d55" : C.textSoft}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

/** parse the "M x y" leading move from an edge path string */
function pathPointStart(d: string): Pt {
  const parts = d.trim().split(/[\s,]+/);
  return { x: parseFloat(parts[1]) || 0, y: parseFloat(parts[2]) || 0 };
}

function NodeCard({
  node,
  built,
  buildIndex,
  running,
  done,
}: {
  node: WFNode;
  built: boolean;
  buildIndex: number;
  running: boolean;
  done: boolean;
}) {
  const [hover, setHover] = useState(false);
  const isTrigger = node.kind === "trigger";
  const isDecision = node.kind === "decision";
  const accent = node.brand ?? C.textSoft;

  const labelText =
    node.kind === "trigger"
      ? "Trigger"
      : node.kind === "decision"
        ? "Decision"
        : node.kind === "output"
          ? "Output"
          : "Action";
  const labelColor =
    node.kind === "action" || node.kind === "decision" ? C.accent : C.blue;
  const labelBg =
    node.kind === "action" || node.kind === "decision" ? C.accentSoft : C.blueSoft;

  const runRing = running
    ? `0 0 0 3px rgba(253,48,153,.18), 0 0 22px 2px rgba(253,48,153,.28)`
    : "";
  const baseShadow = "0 1px 2px rgba(0,0,0,.06), 0 4px 12px -4px rgba(0,0,0,.08)";

  return (
    <div
      data-node={node.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: nodeWidth(node),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: built ? 1 : 0,
        transform: built ? "translateY(0) scale(1)" : "translateY(14px) scale(0.94)",
        transition: `opacity 0.42s ${EASE} ${0}ms, transform 0.42s ${EASE}`,
        pointerEvents: built ? "auto" : "none",
        zIndex: running ? 20 : hover ? 10 : 1,
      }}
    >
      {/* label pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: labelColor,
          background: labelBg,
          padding: "4px 8px",
          borderRadius: 6,
          marginBottom: 7,
          alignSelf: "flex-start",
        }}
      >
        {node.kind === "trigger" ? ClockIcon : node.kind === "decision" ? BranchIcon : <BoltGlyph color={labelColor} />}
        {labelText}
      </div>

      {/* card body */}
      <div
        style={{
          width: "100%",
          borderRadius: 14,
          background: C.card,
          border: `1px solid ${running ? "rgba(253,48,153,.45)" : isDecision ? C.borderStrong : C.border}`,
          boxShadow: running ? `${baseShadow}, ${runRing}` : baseShadow,
          overflow: "hidden",
          position: "relative",
          transition: `box-shadow 0.3s ${EASE}, border-color 0.3s ${EASE}`,
          ...(isTrigger ? { borderRadius: 16 } : null),
        }}
      >
        {/* shimmer overlay while running */}
        {running && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(135deg, transparent 44%, rgba(253,48,153,.08) 48%, rgba(253,48,153,.12) 50%, rgba(253,48,153,.08) 52%, transparent 56%)",
              backgroundSize: "300% 300%",
              animation: "wfShimmer 1.2s ease-in-out infinite",
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: isDecision ? "13px 14px" : "11px 13px",
          }}
        >
          {/* icon tile */}
          <div
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: tint(accent),
              color: accent,
              border: `0.5px solid ${C.border}`,
            }}
          >
            <NodeGlyph icon={node.icon} fallback={node.kind} color={accent} />
          </div>

          {/* title block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: C.text,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {node.title}
              {done && !running && (
                <svg viewBox="0 0 24 24" width="13" height="13" style={{ ...stroke, color: "#1f9d55", strokeWidth: 2.4 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            {node.subtitle && (
              <div
                style={{
                  fontSize: 11.5,
                  color: C.textFaint,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.subtitle}
              </div>
            )}
          </div>

          {/* ⋯ menu stub */}
          <button
            aria-label="Node menu"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "none",
              background: "none",
              color: "rgba(0,0,0,.3)",
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: hover ? 1 : 0.55,
              transition: `opacity 0.15s ${EASE}`,
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        </div>
      </div>

      {/* bottom connect handle */}
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "#fff",
          border: `1.5px solid ${C.borderStrong}`,
          marginTop: -4.5,
          zIndex: 2,
          transition: `border-color 0.2s ${EASE}`,
          ...(hover ? { borderColor: accent } : null),
        }}
      />

      {/* hover "+" add affordance */}
      <button
        aria-label="Add step"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#F3F3F4",
          border: "none",
          color: "rgba(0,0,0,.4)",
          cursor: "pointer",
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: hover ? 1 : 0,
          transform: hover ? "scale(1)" : "scale(0.8)",
          transition: `opacity 0.15s ${EASE}, transform 0.15s ${EASE}`,
        }}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" style={stroke}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

/* small lightning glyph used in the action label pill */
function BoltGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" style={{ ...stroke, color, strokeWidth: 1.9 }}>
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
}

function NodeGlyph({
  icon,
  fallback,
  color,
}: {
  icon?: ReactNode | string;
  fallback: WFNodeKind;
  color: string;
}) {
  if (icon == null) {
    // default per kind
    if (fallback === "trigger") return ClockIcon;
    if (fallback === "decision") return BranchIcon;
    return <BoltGlyph color={color} />;
  }
  if (typeof icon === "string") {
    return <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>;
  }
  return <>{icon}</>;
}

/* derive a very soft tinted background from a brand hex */
function tint(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "rgba(0,0,0,.04)";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.10)`;
}

/* ------------------------------------------------------------------ */
/* Keyframes                                                           */
/* ------------------------------------------------------------------ */

const keyframes = `
@keyframes wfShimmer {
  0% { background-position: 0% 0%; }
  100% { background-position: 100% 100%; }
}
@keyframes wfPulseDot {
  0% { box-shadow: 0 0 0 0 rgba(253,48,153,.5); }
  70% { box-shadow: 0 0 0 6px rgba(253,48,153,0); }
  100% { box-shadow: 0 0 0 0 rgba(253,48,153,0); }
}
`;

export default AgentWorkflowCanvas;
