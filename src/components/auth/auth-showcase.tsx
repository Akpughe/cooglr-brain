"use client";

// The branded right-hand panel for the auth/onboarding split layout — a soft
// gradient with a floating mini preview of the actual agent workspace. On
// onboarding it reflects the workspace name / user being set up.

import { SquarePen, Search, FolderClosed } from "lucide-react";

export function AuthShowcase({
  workspaceName,
  userName,
}: {
  workspaceName?: string;
  userName?: string;
}) {
  const name = (workspaceName?.trim() || "500Chow").slice(0, 22);
  const initial = name[0]?.toUpperCase() ?? "5";
  const who = userName?.trim() || "your team";

  return (
    <div
      className="auth-showcase"
      aria-hidden="true"
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 48,
        background:
          "radial-gradient(120% 120% at 18% 8%, #f3f1ec 0%, #e8e4db 48%, #ddd7ca 100%)",
      }}
    >
      {/* soft accent glows */}
      <div
        style={{
          position: "absolute",
          top: "-18%",
          right: "-10%",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,.10), transparent 70%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "-8%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,.08), transparent 70%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", width: "min(440px, 100%)" }}>
        {/* floating mini workspace */}
        <div
          style={{
            display: "flex",
            height: 300,
            borderRadius: 18,
            overflow: "hidden",
            background: "#fff",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,.04), 0 30px 70px -22px rgba(0,0,0,.32)",
          }}
        >
          {/* mini sidebar */}
          <aside
            style={{
              width: 132,
              flexShrink: 0,
              background: "#fafafa",
              borderRight: "1px solid #f0efed",
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px 8px" }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initial}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
            </div>
            <MiniNav icon={<SquarePen size={12} />} label="New chat" active />
            <MiniNav icon={<Search size={12} />} label="Search" />
            <MiniNav icon={<FolderClosed size={12} />} label="Folders" />
            <div style={{ height: 1, background: "#f0efed", margin: "8px 4px 6px" }} />
            {["Draft growth report", "Instagram carousel", "Research prospects"].map((t) => (
              <div
                key={t}
                style={{
                  fontSize: 10.5,
                  color: "#8a8a86",
                  padding: "5px 6px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t}
              </div>
            ))}
          </aside>

          {/* mini canvas */}
          <div style={{ flex: 1, minWidth: 0, padding: "26px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 12 }}>
              What should we work on?
            </div>
            <div
              style={{
                width: "100%",
                border: "1px solid #ececec",
                borderRadius: 12,
                padding: "9px 11px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 1px 2px rgba(0,0,0,.03)",
              }}
            >
              <span style={{ fontSize: 11, color: "#9a9a96", flex: 1 }}>Ask your workspace anything</span>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: "#1a1a1a",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                ↑
              </span>
            </div>
            <div style={{ width: "100%", marginTop: 12, display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                { d: "Summarize my ", b: "Teams", a: " meetings" },
                { d: "Plot data in ", b: "graphs", a: "" },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 10.5,
                    color: "#6a6a66",
                    padding: "7px 4px",
                    borderTop: i ? "1px solid #f3f2f0" : "none",
                  }}
                >
                  {s.d}
                  <strong style={{ color: "#1a1a1a", fontWeight: 600 }}>{s.b}</strong>
                  {s.a}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* caption */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#26241f", letterSpacing: "-0.01em" }}>
            One workspace, one agent.
          </div>
          <div style={{ fontSize: 13.5, color: "#7a766e", marginTop: 5, lineHeight: 1.5 }}>
            Chat, files, and automations for {who} — grounded in everything you connect.
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniNav({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 24,
        padding: "0 6px",
        borderRadius: 7,
        background: active ? "#efefef" : "transparent",
        color: active ? "#1a1a1a" : "#6a6a66",
        fontSize: 11,
        fontWeight: active ? 500 : 450,
      }}
    >
      <span style={{ color: active ? "#3a3a3a" : "#9a9a96", display: "flex" }}>{icon}</span>
      {label}
    </div>
  );
}
