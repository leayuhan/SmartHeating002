/**
 * UnitDetailView.tsx — 户端层（第4层穿透）
 * 显示一梯两户5层温度分布网格
 */
import type { Building } from "../pages/Home";

interface Props {
  building: Building;
  demoPhase?: number;
  onBack: () => void;
}

function getTempColor(temp: number) {
  if (temp >= 22) return { bg: "rgba(239,68,68,0.25)", border: "rgba(239,68,68,0.6)", text: "#EF4444" };
  if (temp >= 20) return { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.5)", text: "#22C55E" };
  if (temp >= 18) return { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.5)", text: "#60A5FA" };
  return { bg: "rgba(147,51,234,0.2)", border: "rgba(147,51,234,0.5)", text: "#A78BFA" };
}

export default function UnitDetailView({ building, demoPhase, onBack }: Props) {
  const floors = Math.min(6, Math.max(3, Math.round(building.floors / 4)));
  const baseTemp = building.temp;

  // Generate floor/unit temperatures
  const floorData = Array.from({ length: floors }, (_, floorIdx) => {
    const floorFactor = floorIdx / (floors - 1); // 0=bottom, 1=top
    const isTop = floorIdx === floors - 1;
    const isBottom = floorIdx === 0;

    // Left unit (west-facing, slightly cooler)
    const leftTemp = +(baseTemp
      + (isTop ? -1.8 : isBottom ? -0.5 : 0)
      + (Math.sin(floorIdx * 2.3) * 0.3)
      - 0.6
    ).toFixed(1);

    // Right unit (east-facing)
    const rightTemp = +(baseTemp
      + (isTop ? -1.5 : isBottom ? -0.3 : 0)
      + (Math.sin(floorIdx * 1.7) * 0.25)
    ).toFixed(1);

    return {
      floor: building.floors - Math.round(floorIdx * (building.floors / floors)),
      left: Math.max(14, Math.min(25, leftTemp)),
      right: Math.max(14, Math.min(25, rightTemp)),
    };
  }).reverse(); // Top floor first

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "12px 14px",
      background: "rgba(0,8,30,0.95)",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          padding: "4px 10px", borderRadius: 6,
          background: "rgba(0,30,80,0.6)", border: "1px solid rgba(0,180,255,0.3)",
          color: "#7DD3FC", fontSize: 11, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Noto Sans SC', sans-serif",
        }}>← 返回</button>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#E0F4FF", fontFamily: "'Noto Sans SC', sans-serif" }}>
            {building.name} · 户端详情
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(100,180,255,0.5)", fontFamily: "'Share Tech Mono', monospace" }}>
            UNIT TEMPERATURE GRID · {building.floors}F
          </div>
        </div>
      </div>

      {/* Floor grid */}
      <div style={{ marginBottom: 12 }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 4, marginBottom: 4 }}>
          <div />
          <div style={{ textAlign: "center", fontSize: 9, color: "rgba(100,180,255,0.5)", fontFamily: "'Noto Sans SC', sans-serif" }}>西户</div>
          <div style={{ textAlign: "center", fontSize: 9, color: "rgba(100,180,255,0.5)", fontFamily: "'Noto Sans SC', sans-serif" }}>东户</div>
        </div>

        {floorData.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 4, marginBottom: 4 }}>
            {/* Floor label */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, fontWeight: 700,
              color: "rgba(100,180,255,0.6)",
              fontFamily: "'Share Tech Mono', monospace",
            }}>{row.floor}F</div>

            {/* Left unit */}
            {[row.left, row.right].map((temp, j) => {
              const c = getTempColor(temp);
              return (
                <div key={j} style={{
                  padding: "8px 6px",
                  borderRadius: 6,
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Grid pattern overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, ${c.border}20 8px, ${c.border}20 9px),
                      repeating-linear-gradient(90deg, transparent, transparent 8px, ${c.border}20 8px, ${c.border}20 9px)`,
                    opacity: 0.5,
                  }} />
                  <div style={{
                    position: "relative",
                    fontSize: 13, fontWeight: 800,
                    color: c.text,
                    fontFamily: "'Share Tech Mono', monospace",
                    textShadow: `0 0 8px ${c.text}80`,
                  }}>{temp.toFixed(1)}°</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(0,20,60,0.4)",
        border: "1px solid rgba(0,180,255,0.15)",
        marginBottom: 10,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "平均室温", value: `${building.temp.toFixed(1)}°C`, color: "#7DD3FC" },
            { label: "最高", value: `${Math.max(...floorData.map(r => Math.max(r.left, r.right))).toFixed(1)}°C`, color: "#EF4444" },
            { label: "最低", value: `${Math.min(...floorData.map(r => Math.min(r.left, r.right))).toFixed(1)}°C`, color: "#60A5FA" },
          ].map(item => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8.5, color: "rgba(100,160,220,0.5)", fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: item.color, fontFamily: "'Share Tech Mono', monospace" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Building info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
        {[
          { label: "楼层数", value: `${building.floors}层` },
          { label: "朝向", value: building.orientation },
          { label: "供暖方式", value: building.heatingType },
          { label: "管网位置", value: building.position },
          { label: "建筑面积", value: `${building.area} m²` },
          { label: "玻璃比例", value: `${(building.glassRatio * 100).toFixed(0)}%` },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 8.5, color: "rgba(100,150,200,0.5)", letterSpacing: 0.5, fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(200,230,255,0.85)", fontFamily: "'Share Tech Mono', monospace" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Temperature legend */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { color: "#EF4444", label: "≥22°C 偏热" },
          { color: "#22C55E", label: "20-22°C 适宜" },
          { color: "#60A5FA", label: "18-20°C 偏凉" },
          { color: "#A78BFA", label: "<18°C 偏冷" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, opacity: 0.8 }} />
            <span style={{ fontSize: 8.5, color: "rgba(148,210,255,0.6)", fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
