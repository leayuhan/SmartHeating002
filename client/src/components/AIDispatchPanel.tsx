/**
 * AIDispatchPanel.tsx — AI全局调度中心
 * Design: NEON Deep Blue Tech — glass cards, Lucide weather icons, glow effects
 */
import { useMemo, useState } from "react";
import { Sun, Cloud, CloudRain, Snowflake, TrendingUp, TrendingDown, AlertTriangle, Eye, Zap, Home, Thermometer } from "lucide-react";
import type { Building, WeatherType } from "../pages/Home";

interface Props {
  buildings: Building[];
  weather: WeatherType;
  outdoorTemp: number;
  transitionFactor: number;
  onSelectBuilding: (b: Building) => void;
  onShowTechModal: () => void;
  isAutoDemo: boolean;
  onToggleAutoDemo: () => void;
}

// 入户室温计安装用户（全小区只有少数几户）
export const METER_USERS: Record<string, { floor: number; unit: string; realTemp: number }[]> = {
  A2: [
    { floor: 3,  unit: "2单元301", realTemp: 21.5 },
    { floor: 11, unit: "1单元1102", realTemp: 20.3 },
  ],
  B2: [
    { floor: 7,  unit: "3单元702", realTemp: 19.6 },
  ],
  C2: [
    { floor: 5,  unit: "2单元501", realTemp: 17.4 },
    { floor: 15, unit: "1单元1503", realTemp: 16.9 },
  ],
  C6: [
    { floor: 2,  unit: "1单元201", realTemp: 17.8 },
  ],
};

// 热惰性参数
const THERMAL_INERTIA: Record<string, { responseHours: number; balanceHours: number }> = {
  "散热器": { responseHours: 3,  balanceHours: 7  },
  "地暖":   { responseHours: 6,  balanceHours: 18 },
};

// 天气趋势：未来12小时室温变化速率（°C/h，负=降温）
const WEATHER_TREND: Record<WeatherType, number> = {
  sunny:  +0.08,
  cloudy: -0.05,
  rainy:  -0.14,
  snowy:  -0.22,
};

const NEON_GLOW = { filter: "drop-shadow(0 0 8px rgba(0,224,255,0.55))" };

function WeatherIcon({ type, size = 18 }: { type: WeatherType; size?: number }) {
  const base = { width: size, height: size };
  if (type === "sunny")  return <Sun  style={{ ...base, color: "#FFD700", filter: "drop-shadow(0 0 8px rgba(255,215,0,0.65))" }} />;
  if (type === "cloudy") return <Cloud style={{ ...base, color: "#94C8FF", filter: "drop-shadow(0 0 6px rgba(148,200,255,0.5))" }} />;
  if (type === "rainy")  return <CloudRain style={{ ...base, color: "#7DD3FC", filter: "drop-shadow(0 0 6px rgba(125,211,252,0.5))" }} />;
  return <Snowflake style={{ ...base, color: "#C0E8FF", filter: "drop-shadow(0 0 8px rgba(192,232,255,0.7))" }} />;
}

function predict12hTemp(building: Building, weather: WeatherType, transitionFactor: number): number {
  const trend = WEATHER_TREND[weather];
  const inertia = THERMAL_INERTIA[building.heatingType];
  const slowPhaseHours = inertia.responseHours;
  const slowChange = trend * slowPhaseHours * 0.2;
  const fastChange = trend * (12 - slowPhaseHours);
  const totalChange = slowChange + fastChange;
  const raw = building.temp + totalChange * (1 - transitionFactor * 0.3);
  return +Math.max(16, Math.min(24, raw)).toFixed(1);
}

function genAIAction(building: Building, predicted12h: number, weather: WeatherType): {
  urgency: "immediate" | "soon" | "monitor";
  action: string;
  detail: string;
  leadTime: string;
} {
  const inertia = THERMAL_INERTIA[building.heatingType];
  const gap = 18 - predicted12h;

  if (building.temp < 18) {
    const valveIncrease = Math.round(Math.abs(gap) * 8 + 15);
    const supplyTempIncrease = Math.round(Math.abs(gap) * 2.5 + 3);
    return {
      urgency: "immediate",
      action: `立即调节换热站${building.stationId.replace("S", "")}`,
      detail: `阀门开度 +${valveIncrease}%（目标室温18°C），供水温度升高 ${supplyTempIncrease}°C。${building.heatingType === "地暖" ? "地暖热惰性大，需持续供热6~8h才能见效。" : "散热器响应较快，约3~4h室温开始回升。"}`,
      leadTime: `立即执行，${inertia.responseHours}h后见效`,
    };
  } else if (predicted12h < 18) {
    const hoursUntilRisk = Math.round((building.temp - 18) / Math.abs(WEATHER_TREND[weather]) / 0.8);
    const mustActIn = Math.max(1, hoursUntilRisk - inertia.responseHours);
    const valveIncrease = Math.round(Math.abs(gap) * 6 + 10);
    return {
      urgency: "soon",
      action: `${mustActIn}h内预调换热站${building.stationId.replace("S", "")}`,
      detail: `预计${hoursUntilRisk}h后室温跌破18°C，${building.heatingType}需提前${inertia.responseHours}h响应。建议阀门开度 +${valveIncrease}%，提前锁定热量储备。`,
      leadTime: `最迟 ${mustActIn}h 内下发`,
    };
  } else if (predicted12h < 19) {
    return {
      urgency: "monitor",
      action: `持续监测 ${building.name}`,
      detail: `12h后室温预计 ${predicted12h}°C，处于临界区间。若天气进一步恶化，需及时介入。`,
      leadTime: "持续观察",
    };
  }
  return {
    urgency: "monitor",
    action: `${building.name} 运行正常`,
    detail: `12h后室温预计 ${predicted12h}°C，无需干预。`,
    leadTime: "无需操作",
  };
}

const URGENCY_CONFIG = {
  immediate: {
    bg: "linear-gradient(135deg, rgba(80,0,0,0.55) 0%, rgba(50,0,0,0.45) 100%)",
    border: "rgba(255,60,60,0.35)",
    accent: "#FF6060",
    badge: "#FF6060",
    badgeBg: "rgba(120,0,0,0.4)",
    label: "立即处理",
    icon: <AlertTriangle style={{ width: 11, height: 11, color: "#FF6060", filter: "drop-shadow(0 0 5px rgba(255,60,60,0.7))" }} />,
  },
  soon: {
    bg: "linear-gradient(135deg, rgba(60,30,0,0.55) 0%, rgba(40,20,0,0.45) 100%)",
    border: "rgba(255,150,50,0.35)",
    accent: "#FFB347",
    badge: "#FFB347",
    badgeBg: "rgba(80,40,0,0.4)",
    label: "12h内处理",
    icon: <AlertTriangle style={{ width: 11, height: 11, color: "#FFB347", filter: "drop-shadow(0 0 5px rgba(255,150,50,0.7))" }} />,
  },
  monitor: {
    bg: "linear-gradient(135deg, rgba(0,20,60,0.55) 0%, rgba(0,15,45,0.45) 100%)",
    border: "rgba(0,150,255,0.25)",
    accent: "#7DD3FC",
    badge: "#7DD3FC",
    badgeBg: "rgba(0,40,100,0.3)",
    label: "持续监测",
    icon: <Eye style={{ width: 11, height: 11, color: "#7DD3FC", filter: "drop-shadow(0 0 5px rgba(125,211,252,0.5))" }} />,
  },
};

export default function AIDispatchPanel({
  buildings, weather, outdoorTemp, transitionFactor,
  onSelectBuilding, onShowTechModal, isAutoDemo, onToggleAutoDemo,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const weatherLabel = { sunny: "晴天", cloudy: "多云", rainy: "雨天", snowy: "雪天" }[weather] ?? "多云";

  const buildingAnalysis = useMemo(() => {
    return buildings.map(b => {
      const predicted = predict12hTemp(b, weather, transitionFactor);
      const action = genAIAction(b, predicted, weather);
      return { building: b, predicted12h: predicted, action };
    });
  }, [buildings, weather, transitionFactor]);

  const sortedAnalysis = useMemo(() => {
    const order = { immediate: 0, soon: 1, monitor: 2 };
    return [...buildingAnalysis].sort((a, b) => order[a.action.urgency] - order[b.action.urgency]);
  }, [buildingAnalysis]);

  const immediateCount = buildingAnalysis.filter(a => a.action.urgency === "immediate").length;
  const soonCount = buildingAnalysis.filter(a => a.action.urgency === "soon").length;
  const monitorCount = buildingAnalysis.filter(a => a.action.urgency === "monitor").length;

  const allMeterUsers = Object.entries(METER_USERS).flatMap(([bid, users]) =>
    users.map(u => ({ ...u, buildingId: bid, building: buildings.find(b => b.id === bid) }))
  );
  const riskMeterUsers = allMeterUsers.filter(u => u.realTemp < 16);

  const trendSign = WEATHER_TREND[weather] > 0 ? "↑" : "↓";
  const trendAbs = Math.abs(WEATHER_TREND[weather]);
  const trendColor = WEATHER_TREND[weather] > 0 ? "#00FF9D" : "#FF6B9D";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent" }}>

      {/* ── Panel Header ── */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: "1px solid rgba(0,180,255,0.12)",
        background: "linear-gradient(180deg, rgba(0,15,40,0.5) 0%, rgba(0,10,28,0.3) 100%)",
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "linear-gradient(135deg, rgba(0,80,200,0.7) 0%, rgba(0,40,120,0.9) 100%)",
            border: "1px solid rgba(0,212,255,0.4)",
            boxShadow: "0 0 14px rgba(0,180,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, color: "#00eaff", fontWeight: 900,
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}>AI</div>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 800, color: "#E0F4FF", lineHeight: 1.2,
              textShadow: "0 0 12px rgba(0,212,255,0.3)",
            }}>AI 调度中心</div>
            <div style={{ fontSize: 9, color: "rgba(0,234,255,0.5)", letterSpacing: "0.06em", fontFamily: "'Share Tech Mono', monospace" }}>
              SENSE · PREDICT · DECIDE · ACT
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(0,60,30,0.4)", border: "1px solid rgba(0,200,100,0.3)",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#00FF9D", animation: "pulse-dot 2s infinite", boxShadow: "0 0 6px rgba(0,220,100,0.6)" }} />
            <span style={{ fontSize: 8, color: "#00FF9D", fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, textShadow: "0 0 6px rgba(0,220,100,0.5)" }}>ONLINE</span>
          </div>
        </div>

        {/* Weather context card — NEON glass style */}
        <div style={{
          padding: "9px 12px", borderRadius: 10,
          background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(0,234,255,0.05) 40%, rgba(7,18,38,0.65) 100%)",
          border: "1px solid rgba(0,234,255,0.22)",
          boxShadow: "0 0 12px rgba(0,100,255,0.10), inset 0 1px 0 rgba(255,255,255,0.10)",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", gap: 10,
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle top highlight */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "40%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)",
            borderRadius: "10px 10px 60% 60%",
            pointerEvents: "none",
          }} />

          {/* Weather icon */}
          <WeatherIcon type={weather} size={22} />

          {/* Labels */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#E0F4FF", textShadow: "0 0 8px rgba(255,255,255,0.2)" }}>{weatherLabel}</span>
              <span style={{ fontSize: 9, color: "rgba(0,234,255,0.6)", fontFamily: "'Share Tech Mono', monospace" }}>
                <Thermometer style={{ width: 9, height: 9, display: "inline", verticalAlign: "middle", marginRight: 2 }} />
                室外 {outdoorTemp}°C
              </span>
            </div>
            <div style={{ fontSize: 8, color: "rgba(0,234,255,0.45)", marginTop: 1, fontFamily: "'Share Tech Mono', monospace" }}>
              AI气象感知 · 实时修正热负荷
            </div>
          </div>

          {/* Trend indicator */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            padding: "4px 8px", borderRadius: 7,
            background: WEATHER_TREND[weather] > 0 ? "rgba(0,80,40,0.4)" : "rgba(80,0,40,0.4)",
            border: `1px solid ${trendColor}44`,
          }}>
            {WEATHER_TREND[weather] > 0
              ? <TrendingUp style={{ width: 12, height: 12, color: trendColor, filter: `drop-shadow(0 0 4px ${trendColor}88)` }} />
              : <TrendingDown style={{ width: 12, height: 12, color: trendColor, filter: `drop-shadow(0 0 4px ${trendColor}88)` }} />
            }
            <div style={{
              fontSize: 10, fontWeight: 800, color: trendColor,
              fontFamily: "'Share Tech Mono', monospace",
              textShadow: `0 0 8px ${trendColor}60`,
              lineHeight: 1,
            }}>
              {trendSign}{trendAbs}°/h
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{
        display: "flex", gap: 6, padding: "8px 12px",
        borderBottom: "1px solid rgba(0,180,255,0.12)",
        flexShrink: 0,
      }}>
        {[
          { count: immediateCount, label: "立即处理", bg: "linear-gradient(135deg, rgba(80,0,0,0.55), rgba(50,0,0,0.45))", color: "#FF6060", border: "rgba(255,60,60,0.35)", glow: "rgba(255,60,60,0.2)" },
          { count: soonCount, label: "12h内", bg: "linear-gradient(135deg, rgba(60,30,0,0.55), rgba(40,20,0,0.45))", color: "#FFB347", border: "rgba(255,150,50,0.35)", glow: "rgba(255,150,50,0.15)" },
          { count: monitorCount, label: "监测中", bg: "linear-gradient(135deg, rgba(0,30,80,0.55), rgba(0,20,60,0.45))", color: "#7DD3FC", border: "rgba(0,150,255,0.3)", glow: "rgba(0,150,255,0.12)" },
        ].map(item => (
          <div key={item.label} style={{
            flex: 1, textAlign: "center", padding: "7px 4px", borderRadius: 9,
            background: item.bg, border: `1px solid ${item.border}`,
            boxShadow: `0 0 10px ${item.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
            position: "relative", overflow: "hidden",
          }}>
            {/* Top highlight */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "45%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)",
              borderRadius: "9px 9px 50% 50%", pointerEvents: "none",
            }} />
            <div style={{
              fontSize: 22, fontWeight: 900, color: item.color, lineHeight: 1,
              fontFamily: "'Share Tech Mono', monospace",
              textShadow: `0 0 12px ${item.color}80`,
            }}>{item.count}</div>
            <div style={{ fontSize: 8, color: item.color, marginTop: 2, fontWeight: 600, opacity: 0.85 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", scrollbarWidth: "thin", scrollbarColor: "rgba(0,150,255,0.3) transparent" }}>

        {/* Real meter users warning */}
        {riskMeterUsers.length > 0 && (
          <div style={{
            marginBottom: 8, padding: "10px 12px", borderRadius: 10,
            background: "linear-gradient(135deg, rgba(80,0,0,0.5), rgba(50,0,0,0.4))",
            border: "1.5px solid rgba(255,60,60,0.35)",
            boxShadow: "0 0 14px rgba(255,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: "#FF6060",
              display: "flex", alignItems: "center", gap: 4, marginBottom: 6,
              textShadow: "0 0 8px rgba(255,60,60,0.5)",
            }}>
              <AlertTriangle style={{ width: 11, height: 11 }} />
              入户实测低温用户
              <span style={{
                fontSize: 8, padding: "1px 5px", borderRadius: 10,
                background: "rgba(120,0,0,0.5)", color: "#FF6060", border: "1px solid rgba(255,60,60,0.3)",
                fontWeight: 700,
              }}>真实数据</span>
            </div>
            {riskMeterUsers.map((u, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "3px 0",
                borderBottom: i < riskMeterUsers.length - 1 ? "1px solid rgba(255,60,60,0.15)" : "none",
              }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#FF6060" }}>{u.buildingId}栋</span>
                  <span style={{ fontSize: 9, color: "rgba(100,160,220,0.5)", marginLeft: 4 }}>{u.unit}</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 900, color: "#FF6060",
                  fontFamily: "'Share Tech Mono', monospace",
                  textShadow: "0 0 8px rgba(255,60,60,0.5)",
                }}>
                  {u.realTemp}°C
                </span>
              </div>
            ))}
            <div style={{ fontSize: 8.5, color: "rgba(255,100,100,0.5)", marginTop: 4 }}>
              ⚡ 入户室温计实测数据，优先级最高
            </div>
          </div>
        )}

        {/* Section label */}
        <div style={{
          fontSize: 9, fontWeight: 700, color: "rgba(0,234,255,0.55)",
          display: "flex", alignItems: "center", gap: 4,
          marginBottom: 6, letterSpacing: "0.08em",
          fontFamily: "'Share Tech Mono', monospace",
          textTransform: "uppercase",
        }}>
          <Zap style={{ width: 9, height: 9, color: "#00eaff", ...NEON_GLOW }} />
          AI预判与调度建议
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(0,234,255,0.2), transparent)" }} />
        </div>

        {/* Dispatch cards */}
        {sortedAnalysis.map(({ building, predicted12h, action }) => {
          const cfg = URGENCY_CONFIG[action.urgency];
          const isNormal = action.urgency === "monitor" && building.temp >= 19 && building.temp < 21 && predicted12h >= 19;
          if (isNormal) return null;
          // 偏热楼栋（≥21°C）用粉色卡片
          const isOverheat = building.temp >= 21;
          const overheatCfg = {
            bg: "linear-gradient(135deg, rgba(60,0,40,0.55), rgba(40,0,30,0.45))",
            border: "rgba(255,100,180,0.35)",
            accent: "#FF6B9D",
            badge: "#FF6B9D",
            badgeBg: "rgba(80,0,50,0.4)",
            label: "偏热楼栋",
            icon: <Thermometer style={{ width: 11, height: 11, color: "#FF6B9D", filter: "drop-shadow(0 0 5px rgba(255,107,157,0.6))" }} />,
          };
          const displayCfg = isOverheat ? overheatCfg : cfg;
          const isExpanded = expandedId === building.id;

          return (
            <button
              key={building.id}
              onClick={() => {
                setExpandedId(isExpanded ? null : building.id);
                onSelectBuilding(building);
              }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                marginBottom: 5, padding: "10px 12px", borderRadius: 10,
                background: displayCfg.bg,
                border: `1px solid ${displayCfg.border}`,
                boxShadow: `0 0 10px ${displayCfg.border}55, inset 0 1px 0 rgba(255,255,255,0.07)`,
                cursor: "pointer", transition: "all 0.18s",
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Top glass highlight */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "40%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",
                borderRadius: "10px 10px 50% 50%", pointerEvents: "none",
              }} />

              {/* Card header row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {displayCfg.icon}
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#E0F4FF", textShadow: "0 0 6px rgba(255,255,255,0.15)" }}>
                    {building.name}
                  </span>
                  <span style={{
                    fontSize: 8, padding: "1px 5px", borderRadius: 10,
                    background: displayCfg.badgeBg, color: displayCfg.badge,
                    fontWeight: 700, border: `1px solid ${displayCfg.border}`,
                  }}>
                    {displayCfg.label}
                  </span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 900, lineHeight: 1,
                    color: building.temp > 22 ? "#FF6060" : building.temp < 18 ? "#7DD3FC" : "#E0F4FF",
                    fontFamily: "'Share Tech Mono', monospace",
                    textShadow: building.temp < 18 ? "0 0 8px rgba(125,211,252,0.5)" : building.temp > 22 ? "0 0 8px rgba(255,96,96,0.5)" : "none",
                  }}>
                    {building.temp.toFixed(1)}°C
                  </div>
                  <div style={{
                    fontSize: 9, color: predicted12h < 16 ? "#FFB347" : "rgba(100,160,220,0.5)",
                    fontFamily: "'Share Tech Mono', monospace",
                  }}>
                    12h→{predicted12h}°C
                  </div>
                </div>
              </div>

              {/* Action title */}
              <div style={{ fontSize: 10, fontWeight: 700, color: displayCfg.accent, marginBottom: 3, textShadow: `0 0 6px ${displayCfg.accent}60` }}>
                {action.action}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{
                  fontSize: 9.5, color: "rgba(148,210,255,0.85)", lineHeight: 1.65,
                  padding: "7px 9px", borderRadius: 7,
                  background: "rgba(0,20,60,0.5)",
                  border: "1px solid rgba(0,150,255,0.18)",
                  marginBottom: 4,
                  backdropFilter: "blur(6px)",
                }}>
                  {action.detail}
                </div>
              )}

              {/* Tags row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                {[
                  `⏱ ${action.leadTime}`,
                  building.heatingType,
                  building.position,
                  `${building.floors}层`,
                ].map(tag => (
                  <span key={tag} style={{
                    fontSize: 8, padding: "1px 6px", borderRadius: 10,
                    background: "rgba(0,40,100,0.45)", color: "rgba(0,234,255,0.6)", fontWeight: 600,
                    border: "1px solid rgba(0,180,255,0.18)",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* Expand hint */}
              <div style={{ fontSize: 8, color: "rgba(0,234,255,0.35)", marginTop: 3, textAlign: "right" }}>
                {isExpanded ? "▲ 收起" : "▼ 展开详情"}
              </div>
            </button>
          );
        })}

        {/* Normal buildings */}
        <div style={{
          padding: "9px 11px", borderRadius: 10,
          background: "linear-gradient(135deg, rgba(0,30,70,0.5), rgba(0,20,50,0.4))",
          border: "1px solid rgba(0,200,100,0.2)",
          boxShadow: "0 0 8px rgba(0,200,100,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
          marginTop: 4, position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "40%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
            borderRadius: "10px 10px 50% 50%", pointerEvents: "none",
          }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "#00FF9D", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <Home style={{ width: 10, height: 10, color: "#00FF9D", filter: "drop-shadow(0 0 4px rgba(0,255,157,0.6))" }} />
            正常运行楼栋
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {sortedAnalysis
              .filter(a => a.action.urgency === "monitor" && a.building.temp >= 19 && a.predicted12h >= 19)
              .map(a => (
                <button
                  key={a.building.id}
                  onClick={() => onSelectBuilding(a.building)}
                  style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 10,
                    background: "rgba(0,50,30,0.5)", color: "#00FF9D", fontWeight: 600,
                    border: "1px solid rgba(0,200,100,0.25)", cursor: "pointer",
                    fontFamily: "'Share Tech Mono', monospace",
                    textShadow: "0 0 6px rgba(0,220,100,0.4)",
                  }}
                >
                  {a.building.name} {a.building.temp.toFixed(1)}°
                </button>
              ))}
          </div>
        </div>

        {/* Thermal inertia reference */}
        <div style={{
          marginTop: 8, padding: "9px 11px", borderRadius: 10,
          background: "linear-gradient(135deg, rgba(0,20,60,0.5), rgba(0,15,45,0.4))",
          border: "1px solid rgba(0,150,255,0.18)",
          boxShadow: "0 0 8px rgba(0,100,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "40%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
            borderRadius: "10px 10px 50% 50%", pointerEvents: "none",
          }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,234,255,0.85)", marginBottom: 7, display: "flex", alignItems: "center", gap: 4 }}>
            <Zap style={{ width: 10, height: 10, color: "#00eaff", ...NEON_GLOW }} />
            建筑热惰性参考
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { type: "散热器", resp: "2~4h", bal: "6~8h", color: "#FFB347", bg: "linear-gradient(135deg, rgba(60,30,0,0.5), rgba(40,20,0,0.4))", border: "rgba(255,150,50,0.28)" },
              { type: "地暖",   resp: "4~8h", bal: "12~24h", color: "#7DD3FC", bg: "linear-gradient(135deg, rgba(0,30,80,0.5), rgba(0,20,60,0.4))", border: "rgba(0,150,255,0.28)" },
            ].map(item => (
              <div key={item.type} style={{
                flex: 1, textAlign: "center", padding: "7px 4px",
                borderRadius: 8, background: item.bg,
                border: `1px solid ${item.border}`,
                boxShadow: `0 0 8px ${item.border}55, inset 0 1px 0 rgba(255,255,255,0.07)`,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "45%",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",
                  borderRadius: "8px 8px 50% 50%", pointerEvents: "none",
                }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: item.color, textShadow: `0 0 6px ${item.color}60` }}>{item.type}</div>
                <div style={{
                  fontSize: 15, fontWeight: 900, color: "#E0F4FF",
                  fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.2, marginTop: 3,
                  textShadow: "0 0 8px rgba(255,255,255,0.2)",
                }}>{item.resp}</div>
                <div style={{ fontSize: 8, color: "rgba(0,234,255,0.45)" }}>开始响应</div>
                <div style={{ fontSize: 8, color: "rgba(0,234,255,0.4)", marginTop: 1 }}>{item.bal} 达平衡</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8.5, color: "rgba(0,234,255,0.35)", marginTop: 6, textAlign: "center" }}>
            ⚡ AI已将热惰性纳入提前量计算
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        flexShrink: 0, padding: "10px 12px",
        borderTop: "1px solid rgba(0,180,255,0.12)",
        display: "flex", flexDirection: "column", gap: 6,
        background: "linear-gradient(180deg, rgba(0,10,28,0.3) 0%, rgba(0,15,40,0.5) 100%)",
      }}>
        <button
          onClick={onToggleAutoDemo}
          style={{
            width: "100%", padding: "9px 0", borderRadius: 9,
            fontSize: 11, fontWeight: 700,
            border: isAutoDemo ? "1px solid rgba(0,200,100,0.45)" : "1px solid rgba(0,180,255,0.35)",
            cursor: "pointer",
            background: isAutoDemo
              ? "linear-gradient(135deg, rgba(0,80,40,0.65), rgba(0,120,60,0.55))"
              : "linear-gradient(135deg, rgba(0,40,100,0.65), rgba(0,80,160,0.55))",
            color: isAutoDemo ? "#00FF9D" : "#00eaff",
            boxShadow: isAutoDemo
              ? "0 0 18px rgba(0,200,100,0.25), inset 0 1px 0 rgba(255,255,255,0.10)"
              : "0 0 18px rgba(0,180,255,0.2), inset 0 1px 0 rgba(255,255,255,0.10)",
            textShadow: isAutoDemo ? "0 0 8px rgba(0,220,100,0.5)" : "0 0 8px rgba(0,234,255,0.5)",
            transition: "all 0.2s",
            position: "relative", overflow: "hidden",
          }}
        >
          {isAutoDemo ? "⏹ 停止自动演示" : "▶ 一键演示（天气自动切换）"}
        </button>
        <button
          onClick={onShowTechModal}
          style={{
            width: "100%", padding: "7px 0", borderRadius: 8,
            fontSize: 10, fontWeight: 600, cursor: "pointer",
            background: "linear-gradient(135deg, rgba(0,20,60,0.5), rgba(0,15,45,0.4))",
            color: "rgba(0,234,255,0.7)",
            border: "1px solid rgba(0,150,255,0.22)",
            boxShadow: "0 0 8px rgba(0,100,255,0.08)",
            transition: "all 0.2s",
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'rgba(0,234,255,0.7)' }}>
              <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
              <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="2" r="1.2" fill="currentColor"/>
              <circle cx="9" cy="11" r="1.8" fill="currentColor"/>
              <circle cx="15" cy="11" r="1.8" fill="currentColor"/>
              <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="1" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <rect x="20" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            室温辨识技术原理
          </span>
        </button>
      </div>
    </div>
  );
}
