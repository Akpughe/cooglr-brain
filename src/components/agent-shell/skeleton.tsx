// Shimmering skeleton placeholder. Styling lives in agent-shell.css (.skel).

export function Skeleton({
  width,
  height = 12,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="skel"
      style={{ display: "block", width: width ?? "100%", height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

/** A row skeleton: round/rounded icon tile + two stacked text lines. */
export function SkeletonRow({ height = 64, tile = 40 }: { height?: number; tile?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height, padding: "0 10px" }}>
      <Skeleton width={tile} height={tile} radius={tile / 2 >= 18 ? 10 : 999} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <Skeleton width="42%" height={12} />
        <Skeleton width="26%" height={10} />
      </div>
    </div>
  );
}

/** A card skeleton (for the folder grid). */
export function SkeletonCard({ height = 132 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 16,
        background: "var(--hover-soft)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      aria-hidden
    >
      <Skeleton width={20} height={20} radius={6} style={{ background: "rgba(0,0,0,.06)" }} />
      <Skeleton width="55%" height={13} style={{ background: "rgba(0,0,0,.06)" }} />
    </div>
  );
}
