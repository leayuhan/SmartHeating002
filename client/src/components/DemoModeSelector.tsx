/**
 * DemoModeSelector.tsx
 * 三大演示模式入口选择器
 * 模式A：寒潮演示 | 模式B：实时运行 | 模式C：自由操控
 */

export type DemoMode = "none" | "coldwave" | "realtime" | "interactive";

interface DemoModeSelectorProps {
  currentMode: DemoMode;
  onSelectMode: (mode: DemoMode) => void;
}

const MODES = [
  {
    id: "coldwave" as DemoMode,
    icon: "🥶",
    name: "寒潮场景演示",
    desc: "传统 vs AI 对比",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.35)",
    tag: "推荐",
  },
  {
    id: "realtime" as DemoMode,
    icon: "⚡",
    name: "实时系统运行",
    desc: "五步闭环流程",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.35)",
    tag: "",
  },
];

export default function DemoModeSelector({
  currentMode,
  onSelectMode,
}: DemoModeSelectorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        borderBottom: "1px solid rgba(0,180,255,0.10)",
        background: "rgba(0,8,30,0.6)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "monospace",
          marginBottom: 2,
        }}
      >
        演示模式
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {MODES.map((m) => {
          const isActive = currentMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMode(isActive ? "none" : m.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                border: `1px solid ${isActive ? m.color : m.border}`,
                background: isActive ? m.bg : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                position: "relative",
                boxShadow: isActive ? `0 0 12px ${m.color}33` : "none",
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isActive ? m.color : "#e2e8f0",
                    fontFamily: "'Noto Sans SC', sans-serif",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    marginTop: 1,
                    fontFamily: "'Noto Sans SC', sans-serif",
                  }}
                >
                  {m.desc}
                </div>
              </div>
              {m.tag && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: m.color,
                    border: `1px solid ${m.color}`,
                    borderRadius: 3,
                    padding: "1px 4px",
                    flexShrink: 0,
                    fontFamily: "monospace",
                  }}
                >
                  {m.tag}
                </span>
              )}
              {isActive && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#10b981",
                    flexShrink: 0,
                    fontFamily: "monospace",
                  }}
                >
                  ● 运行中
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
