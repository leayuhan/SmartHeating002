/**
 * BuildingDetailPanel - 楼栋详情侧边面板
 * Design: Deep blue tech — dark background, cyan/blue accents, glowing data
 */
import { useState, useEffect, useMemo, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Building, WeatherType } from "../pages/Home";

// ── Animated Number ─────────────────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 1, suffix = '', style }: {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: React.CSSProperties;
}) {
  const [displayVal, setDisplayVal] = useState(value);
  const [prevVal, setPrevVal] = useState(value);
  const [flash, setFlash] = useState(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (Math.abs(value - prevVal) < 0.001) return;
    setFlash(true);
    const startTime = performance.now();
    const duration = 500;
    const startVal = prevVal;
    const endVal = value;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayVal(startVal + (endVal - startVal) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayVal(endVal);
        setPrevVal(endVal);
        setTimeout(() => setFlash(false), 300);
      }
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);

  return (
    <span style={{
      ...style,
      transition: 'color 0.3s ease',
      textShadow: flash ? '0 0 12px rgba(0,212,255,0.8), 0 0 24px rgba(0,180,255,0.4)' : (style?.textShadow as string | undefined),
    }}>
      {displayVal.toFixed(decimals)}{suffix}
    </span>
  );
}

interface Props {
  building: Building;
  weather: WeatherType;
  outdoorTemp: number;
  onClose: () => void;
  onDrillToUnit?: () => void;
}

const METER_CONFIG: Record<string, Record<number, number>> = {
  A1: { 3: 2, 11: 1 },
  B2: { 7: 3 },
  C2: { 5: 2, 15: 1 },
  C3: { 2: 1 },
};

function calcFloorTemp(b: Building, floor: number): number {
  const base = b.temp;
  const topEffect = floor === b.floors ? -0.9 : floor === b.floors - 1 ? -0.5 : 0;
  const bottomEffect = floor === 1 ? -0.6 : floor === 2 ? -0.3 : 0;
  const midEffect = (floor > 3 && floor < b.floors - 2) ? 0.25 : 0;
  const orientEffect = b.orientation === "南北" ? 0.2 : -0.15;
  const noise = Math.sin(floor * 7.3 + b.id.charCodeAt(0)) * 0.25;
  const raw = base + topEffect + bottomEffect + midEffect + orientEffect + noise;
  return +Math.max(16, Math.min(24, raw)).toFixed(1);
}

function genForecast(b: Building, weather: WeatherType, outdoorTemp: number) {
  const isUnderfloor = b.heatingType === "地暖";
  const responseDelay = isUnderfloor ? 5.5 : 2.5;
  const settleTime = isUnderfloor ? 18 : 7;
  const weatherEffect = { sunny: 1.4, cloudy: -0.6, rainy: -1.8, snowy: -2.6 }[weather] ?? -0.6;
  const aiTarget = Math.min(22, Math.max(18.5, b.temp + (b.temp < 20 ? 1.8 : 0)));

  return Array.from({ length: 13 }, (_, i) => {
    const progress = i <= responseDelay ? 0
      : Math.min(1, (i - responseDelay) / (settleTime - responseDelay));
    const smooth = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const predicted = +Math.max(16, Math.min(24, b.temp + weatherEffect * smooth + (aiTarget - b.temp) * smooth * 0.65)).toFixed(1);
    const noAI = +Math.max(16, Math.min(24, b.temp + weatherEffect * smooth)).toFixed(1);
    return {
      h: i === 0 ? "现在" : `+${i}h`,
      predicted,
      noAI,
      outdoor: +(outdoorTemp + (weather === "sunny" ? 0.4 : -0.2) * smooth).toFixed(1),
    };
  });
}

function tempColor(t: number) {
  if (t > 22) return "#FF6060";
  if (t >= 20) return "#E0F4FF";
  if (t >= 18) return "#7DD3FC";
  return "#60A5FA";
}
function tempLabel(t: number) {
  if (t > 22) return "偏暖";
  if (t >= 20) return "舒适";
  if (t >= 18) return "略凉";
  return "偏冷";
}

export default function BuildingDetailPanel({ building, weather, outdoorTemp, onClose, onDrillToUnit }: Props) {
  const [tab, setTab] = useState<"floors" | "forecast" | "history" | "ai">("floors");
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 30); }, []);
  useEffect(() => { setExpandedFloor(null); setTab("floors"); }, [building.id]);

  const historyData = useMemo(() => {
    const now = new Date();
    const weatherDrop: Record<WeatherType, number> = { sunny: 0, cloudy: -0.5, rainy: -1.2, snowy: -2.0 };
    const wd = weatherDrop[weather] ?? 0;
    return Array.from({ length: 25 }, (_, i) => {
      const hoursAgo = 24 - i;
      const t = new Date(now.getTime() - hoursAgo * 3600_000);
      const hour = t.getHours();
      const nightDip = hour < 5 ? -1.2 : hour < 8 ? -0.6 : hour >= 22 ? -0.4 : 0;
      const afternoonBoost = hour >= 14 && hour <= 17 ? 0.4 : 0;
      const noise = Math.sin(i * 2.1 + building.id.charCodeAt(0) * 0.3) * 0.2;
      const rawTemp = building.temp + nightDip + afternoonBoost + wd * (i / 24) + noise;
      const temp = +Math.max(16, Math.min(24, rawTemp)).toFixed(1);
      return { time: `${String(t.getHours()).padStart(2, "0")}:00`, temp, target: 20 };
    });
  }, [building.id, building.temp, weather]);

  const meterCfg = METER_CONFIG[building.id];
  const isUnderfloor = building.heatingType === "地暖";
  const responseDelayStr = isUnderfloor ? "4~8小时" : "2~4小时";
  const settleStr = isUnderfloor ? "12~24小时" : "6~8小时";
  const forecast = genForecast(building, weather, outdoorTemp);

  const floors = Array.from({ length: building.floors }, (_, i) => {
    const floor = building.floors - i;
    const temp = calcFloorTemp(building, floor);
    const hasMeter = meterCfg ? floor in meterCfg : false;
    return { floor, temp, hasMeter };
  });

  const avgTemp = +(floors.reduce((s, f) => s + f.temp, 0) / floors.length).toFixed(1);
  const riskFloors = floors.filter(f => f.temp < 18);
  const minTemp = Math.min(...floors.map(f => f.temp));
  const maxTemp = Math.max(...floors.map(f => f.temp));

  const needsAction = avgTemp < 20.5;
  const currentValve = building.position === "近端" ? 45 : building.position === "中端" ? 62 : 82;
  const targetValve = needsAction ? Math.min(currentValve + 18, 100) : avgTemp > 22.5 ? Math.max(currentValve - 15, 20) : currentValve;
  const targetSupplyTemp = needsAction ? Math.min(60, Math.round(52 + (20.5 - avgTemp) * 3)) : 50;

  const PANEL_BG = "rgba(2,11,26,0.97)";
  const CARD_BG = "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(0,234,255,0.04) 40%, rgba(7,18,38,0.65) 100%)";
  const BORDER = "rgba(0,200,255,0.22)";
  const TEXT_PRIMARY = "#E0F4FF";
  const TEXT_SECONDARY = "rgba(100,180,255,0.6)";
  const CYAN = "#00eaff";
  const CHART_GRID = "rgba(0,100,200,0.1)";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      width: "100%",
      background: PANEL_BG,
      borderLeft: "1px solid rgba(0,200,255,0.22)",
      boxShadow: "-4px 0 40px rgba(0,0,0,0.6), -2px 0 20px rgba(0,100,255,0.12)",
      transform: visible ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      {/* ===== HEADER ===== */}
      <div style={{
        flexShrink: 0, padding: "16px 16px 12px",
        borderBottom: `1px solid ${BORDER}`,
        background: "linear-gradient(180deg, rgba(0,15,40,0.6) 0%, rgba(0,10,28,0.4) 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{
                fontSize: 20, fontWeight: 800, color: CYAN,
                textShadow: "0 0 12px rgba(0,212,255,0.5)",
              }}>{building.name}</span>
              <span style={{
                padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                background: avgTemp < 18 ? "rgba(80,0,0,0.4)" : avgTemp > 22 ? "rgba(60,0,0,0.4)" : "rgba(0,40,100,0.4)",
                color: tempColor(avgTemp),
                border: `1px solid ${tempColor(avgTemp)}40`,
              }}>
                {tempLabel(avgTemp)}
              </span>
              {meterCfg && (
                <span style={{
                  padding: "1px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600,
                  background: "rgba(0,40,100,0.4)", color: "#7DD3FC", border: "1px solid rgba(0,150,255,0.25)",
                }}>
                  📡 有入户计
                </span>
              )}
              {riskFloors.length > 0 && (
                <span style={{
                  padding: "1px 7px", borderRadius: 10, fontSize: 9, fontWeight: 700,
                  background: "rgba(80,0,0,0.4)", color: "#FF6060", border: "1px solid rgba(255,60,60,0.3)",
                }}>
                  ⚠ {riskFloors.length}层低温
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TEXT_SECONDARY, flexWrap: "wrap", marginTop: 4 }}>
              <span>{building.floors}层</span>
              <span>·</span>
              <span>{building.area.toLocaleString()} m²</span>
              <span>·</span>
              <span>{building.orientation}朝向</span>
              <span>·</span>
              <span style={{ color: "#7DD3FC", fontWeight: 600 }}>{building.heatingType}</span>
              <span>·</span>
              <span>{building.position}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {onDrillToUnit && (
              <button onClick={onDrillToUnit} style={{
                padding: "4px 8px", borderRadius: 6,
                border: "1px solid rgba(0,212,255,0.4)",
                background: "rgba(0,40,120,0.5)",
                color: "#7DD3FC", fontSize: 9.5, fontWeight: 700,
                cursor: "pointer", flexShrink: 0,
                fontFamily: "'Noto Sans SC', sans-serif",
                display: "flex", alignItems: "center", gap: 3,
              }}>🏠 户端</button>
            )}
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: "50%",
              border: `1px solid ${BORDER}`, background: "rgba(0,20,60,0.4)",
              color: TEXT_SECONDARY, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}>✕</button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
          {[
            { label: "均温", numVal: avgTemp, suffix: '°C', color: tempColor(avgTemp) },
            { label: "最低层", numVal: minTemp, suffix: '°C', color: "#7DD3FC" },
            { label: "最高层", numVal: maxTemp, suffix: '°C', color: "#FF6060" },
            { label: "风险层", numVal: riskFloors.length, suffix: '层', color: riskFloors.length > 0 ? "#FF6060" : "#00FF9D" },
          ].map(({ label, numVal, suffix, color }) => (
            <div key={label} style={{ borderRadius: 8, padding: "6px 4px", textAlign: "center", background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 9, color: TEXT_SECONDARY, marginBottom: 2 }}>{label}</div>
              <AnimatedNumber
                value={numVal}
                decimals={suffix === '层' ? 0 : 1}
                suffix={suffix}
                style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'Share Tech Mono', monospace", textShadow: `0 0 8px ${color}60` }}
              />
            </div>
          ))}
        </div>

        {/* Thermal inertia note */}
        <div style={{
          padding: "6px 10px", borderRadius: 8, fontSize: 10,
          background: "rgba(0,30,80,0.4)", border: `1px solid ${BORDER}`,
        }}>
          <span style={{ fontWeight: 700, color: CYAN }}>🏠 热惰性：</span>
          <span style={{ color: TEXT_SECONDARY }}>
            {isUnderfloor ? "地暖" : "散热器"}调节后
            <strong style={{ color: CYAN }}> {responseDelayStr}</strong> 开始响应，
            <strong style={{ color: CYAN }}>{settleStr}</strong> 达稳态
          </span>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: `1px solid ${BORDER}`, background: "rgba(0,10,30,0.3)" }}>
        {[
          { key: "floors" as const, label: "楼层室温" },
          { key: "history" as const, label: "24h历史" },
          { key: "forecast" as const, label: "12h预测" },
          { key: "ai" as const, label: "AI建议" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600,
              color: tab === key ? CYAN : TEXT_SECONDARY,
              borderBottom: tab === key ? `2px solid ${CYAN}` : "2px solid transparent",
              background: tab === key ? "rgba(0,40,100,0.3)" : "transparent",
              border: "none", cursor: "pointer", transition: "all 0.15s",
              textShadow: tab === key ? "0 0 8px rgba(0,212,255,0.5)" : "none",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ===== CONTENT ===== */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(0,150,255,0.3) transparent" }}>

        {/* FLOORS TAB */}
        {tab === "floors" && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 8 }}>
              各楼层室温（AI模型推算）· 点击楼层查看各户详情
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {floors.map(({ floor, temp, hasMeter }) => {
                const tc = tempColor(temp);
                const isExpanded = expandedFloor === floor;
                const isRisk = temp < 18;

                return (
                  <div key={floor}>
                    <button
                      onClick={() => setExpandedFloor(isExpanded ? null : floor)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center",
                        padding: "7px 12px", borderRadius: 6, cursor: "pointer",
                        background: isExpanded ? "rgba(0,40,100,0.5)" : CARD_BG,
                        border: `1px solid ${isExpanded ? "rgba(0,180,255,0.3)" : BORDER}`,
                        transition: "all 0.15s",
                        marginBottom: 0,
                      }}>
                      <div style={{
                        width: 32, flexShrink: 0, fontSize: 10, fontWeight: 600,
                        color: TEXT_SECONDARY,
                        fontFamily: "'Share Tech Mono', monospace",
                        textAlign: "left",
                      }}>
                        {floor}层
                      </div>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                        {hasMeter && (
                          <span style={{
                            padding: "0 4px", borderRadius: 3,
                            fontSize: 8, fontWeight: 700,
                            background: "rgba(0,40,100,0.4)", color: "#7DD3FC", border: "1px solid rgba(0,150,255,0.25)",
                          }}>实测</span>
                        )}
                        {isRisk && <span style={{ fontSize: 10 }}>⚠️</span>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tc, fontFamily: "'Share Tech Mono', monospace", flexShrink: 0, textShadow: `0 0 8px ${tc}60` }}>
                        {temp}°C
                      </span>
                      <span style={{
                        fontSize: 9, color: TEXT_SECONDARY, marginLeft: 6,
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        display: "inline-block", transition: "transform 0.2s", flexShrink: 0,
                      }}>▼</span>
                    </button>

                    {isExpanded && (
                      <div style={{
                        margin: "2px 6px 4px", padding: 8, borderRadius: 6,
                        background: "rgba(0,30,80,0.5)", border: `1px solid ${tc}30`,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: tc, marginBottom: 6, textShadow: `0 0 6px ${tc}60` }}>
                          {floor}层各户室温（4户）
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                          {[1, 2, 3, 4].map((unit) => {
                            const unitTemp = +(temp + ((unit * 3 + floor) % 7 - 3) * 0.14).toFixed(1);
                            const isMeterUnit = hasMeter && unit === (METER_CONFIG[building.id]?.[floor] ?? -1);
                            return (
                              <div key={unit} style={{
                                borderRadius: 5, padding: "5px 4px", textAlign: "center",
                                background: "rgba(0,20,60,0.5)", border: `1px solid ${tc}25`,
                              }}>
                                <div style={{ fontSize: 8, color: TEXT_SECONDARY }}>{unit}单元</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: tempColor(unitTemp), fontFamily: "'Share Tech Mono', monospace" }}>
                                  {unitTemp}°C
                                </div>
                                {isMeterUnit && (
                                  <div style={{ fontSize: 8, fontWeight: 700, color: "#7DD3FC" }}>📡实测</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {hasMeter && (
                          <div style={{
                            marginTop: 5, fontSize: 8.5, padding: "3px 7px", borderRadius: 4,
                            background: "rgba(0,40,100,0.4)", color: "#7DD3FC", border: "1px solid rgba(0,150,255,0.2)",
                          }}>
                            📡 本层有入户室温计实测数据，其余户由AI模型推算
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {riskFloors.length > 0 && (
              <div style={{
                marginTop: 8, padding: "8px 10px", borderRadius: 6,
                background: "rgba(80,0,0,0.3)", border: "1px solid rgba(255,60,60,0.25)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6060", marginBottom: 4 }}>
                  ⚠️ 低温风险楼层（{riskFloors.length}层低于18°C）
                </div>
                {riskFloors.map(f => (
                  <div key={f.floor} style={{ fontSize: 10, color: "#FF9090", lineHeight: 1.8 }}>
                    · {f.floor}层：{f.temp}°C，需立即调节
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 8 }}>
              过去24小时室温变化记录（AI模型推算）
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
              {[
                { label: "24h最低", value: `${Math.min(...historyData.map(d => d.temp)).toFixed(1)}°C`, color: "#7DD3FC" },
                { label: "24h均温", value: `${(historyData.reduce((s, d) => s + d.temp, 0) / historyData.length).toFixed(1)}°C`, color: "#00FF9D" },
                { label: "24h最高", value: `${Math.max(...historyData.map(d => d.temp)).toFixed(1)}°C`, color: "#FF6060" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ borderRadius: 6, padding: "6px 4px", textAlign: "center", background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 9, color: TEXT_SECONDARY }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color, fontFamily: "'Share Tech Mono', monospace", textShadow: `0 0 8px ${color}60` }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="time" tick={{ fontSize: 8, fill: "rgba(100,160,220,0.5)", fontFamily: "'Share Tech Mono', monospace" }} tickFormatter={(v, i) => i % 4 === 0 ? v : ""} interval={0} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 8, fill: "rgba(100,160,220,0.5)", fontFamily: "'Share Tech Mono', monospace" }} unit="°" />
                  <ReferenceLine y={20.5} stroke="#00FF9D" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "目标", position: "right", fontSize: 8, fill: "#00FF9D" }} />
                  <ReferenceLine y={18} stroke="#FF6060" strokeDasharray="4 2" strokeWidth={1} label={{ value: "警戒", position: "right", fontSize: 8, fill: "#FF6060" }} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid rgba(0,150,255,0.3)", background: "rgba(2,11,26,0.95)", color: "#E0F4FF", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }} formatter={(v: number) => [`${v}°C`, "室温"]} labelStyle={{ color: CYAN, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }} />
                  <Line type="monotone" dataKey="temp" stroke={CYAN} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: CYAN }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 9, background: CARD_BG, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, lineHeight: 1.7 }}>
              绿色虚线 = 目标室温 20.5°C · 红色虚线 = 低温警戒线 18°C<br />
              夜间（0-5时）室温自然下降，午后（14-17时）因日照略有回升
            </div>
          </div>
        )}

        {/* FORECAST TAB */}
        {tab === "forecast" && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 8 }}>
              未来12小时室温预测（含建筑热惰性滞后）
            </div>
            <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, fontSize: 10, background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div style={{ fontWeight: 700, color: CYAN, marginBottom: 4 }}>
                📐 {isUnderfloor ? "地暖" : "散热器"}系统热惰性
              </div>
              <div style={{ color: TEXT_SECONDARY, lineHeight: 1.7 }}>
                • 调节指令下发后，<strong style={{ color: CYAN }}>{responseDelayStr}</strong> 开始响应<br />
                • 需 <strong style={{ color: CYAN }}>{settleStr}</strong> 才能达到新稳态<br />
                • {isUnderfloor ? "地暖蓄热量大，响应慢但保温好" : "散热器响应快，但受建筑外墙蓄热影响仍有滞后"}<br />
                • <span style={{ color: CYAN }}>青蓝色</span>=AI干预预测，<span style={{ color: "rgba(100,160,220,0.4)" }}>灰色</span>=无干预对照
              </div>
            </div>
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CYAN} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="h" tick={{ fontSize: 9, fill: "rgba(100,160,220,0.5)" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "rgba(100,160,220,0.5)" }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid rgba(0,150,255,0.3)", background: "rgba(2,11,26,0.95)", color: "#E0F4FF", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }} formatter={(v: number, name: string) => [`${v}°C`, name === "predicted" ? "AI干预后" : name === "noAI" ? "无干预对照" : "室外温度"]} />
                  <ReferenceLine y={18} stroke="#FF6060" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "18°C安全线", position: "right", fontSize: 8, fill: "#FF6060" }} />
                  <ReferenceLine y={22} stroke="#FFB347" strokeDasharray="4 3" strokeWidth={1} label={{ value: "22°C上限", position: "right", fontSize: 8, fill: "#FFB347" }} />
                  <Area type="monotone" dataKey="predicted" stroke={CYAN} strokeWidth={2.5} fill="url(#fg)" dot={false} name="predicted" />
                  <Line type="monotone" dataKey="noAI" stroke="rgba(100,160,220,0.3)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="noAI" />
                  <Line type="monotone" dataKey="outdoor" stroke="rgba(100,160,220,0.2)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="outdoor" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { time: isUnderfloor ? "0~5.5h" : "0~2.5h", label: "热惰性缓冲期", desc: "调节指令已下发，室温暂无明显变化", color: TEXT_SECONDARY },
                { time: isUnderfloor ? "5.5~12h" : "2.5~6h", label: "室温开始响应", desc: "热量逐渐传导，室温缓慢变化", color: CYAN },
                { time: isUnderfloor ? "12~24h" : "6~8h", label: "趋于新稳态", desc: "室温达目标值，系统稳定运行", color: "#00FF9D" },
              ].map(({ time, label, desc, color }) => (
                <div key={time} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 10 }}>
                  <div style={{ width: 52, flexShrink: 0, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color }}>{time}</div>
                  <div>
                    <span style={{ fontWeight: 700, color }}>{label}：</span>
                    <span style={{ color: TEXT_SECONDARY }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: CYAN, marginBottom: 5 }}>
                📋 未来12h风险预警列表
              </div>
              {forecast.filter((_, i) => i > 0 && i % 3 === 0).map(d => {
                const isRisk = d.predicted < 18;
                return (
                  <div key={d.h} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, padding: "2px 0" }}>
                    <span style={{ color: TEXT_SECONDARY, fontFamily: "'Share Tech Mono', monospace" }}>{d.h}</span>
                    <span style={{ color: isRisk ? "#FF6060" : "#00FF9D", fontWeight: 600 }}>
                      {isRisk ? `⚠️ ${d.predicted}°C 低温风险` : `✓ ${d.predicted}°C 正常`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI TAB */}
        {tab === "ai" && (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: needsAction ? "rgba(60,30,0,0.4)" : "rgba(0,50,30,0.4)",
              border: `1px solid ${needsAction ? "rgba(255,150,50,0.3)" : "rgba(0,200,100,0.3)"}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: needsAction ? "#FFB347" : "#00FF9D", textShadow: needsAction ? "0 0 8px rgba(255,150,50,0.5)" : "0 0 8px rgba(0,220,100,0.5)" }}>
                {needsAction ? "⚠️ 需要调节" : "✅ 运行正常"}
              </div>
              <div style={{ fontSize: 10, marginTop: 3, color: needsAction ? "rgba(255,180,100,0.7)" : "rgba(0,220,100,0.6)" }}>
                {needsAction
                  ? `均温 ${avgTemp}°C 低于舒适目标 20~22°C，建议增加供热`
                  : `均温 ${avgTemp}°C 处于舒适区间，维持当前供热策略`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY, marginBottom: 6 }}>AI具体调节建议</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  {
                    icon: "🔧", title: "调节阀门开度",
                    current: `当前 ${currentValve}%`,
                    target: `目标 ${targetValve}%`,
                    desc: `${needsAction ? "增大" : "维持"}阀门开度，${needsAction ? "增加" : "保持"}二次网流量`,
                    color: CYAN,
                  },
                  {
                    icon: "🌡️", title: "调整供水温度",
                    current: `当前 ${targetSupplyTemp - (needsAction ? 4 : 0)}°C`,
                    target: `目标 ${targetSupplyTemp}°C`,
                    desc: `换热站供水温度${needsAction ? "上调" : "维持"}，确保末端热量充足`,
                    color: "#FF6060",
                  },
                  {
                    icon: "⏱️", title: "热惰性补偿",
                    current: "已考虑",
                    target: `提前 ${isUnderfloor ? "4~6h" : "2~3h"} 调节`,
                    desc: `${isUnderfloor ? "地暖" : "散热器"}热惰性大，AI提前预判并下发指令`,
                    color: "#00FF9D",
                  },
                ].map(({ icon, title, current, target, color, desc }) => (
                  <div key={title} style={{ padding: "8px 10px", borderRadius: 6, background: CARD_BG, border: `1px solid ${BORDER}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY }}>
                        {icon} {title}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                        <span style={{ color: TEXT_SECONDARY }}>{current}</span>
                        <span style={{ color: "rgba(100,160,220,0.3)" }}>→</span>
                        <span style={{ fontWeight: 700, color, textShadow: `0 0 6px ${color}60` }}>{target}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: TEXT_SECONDARY }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "8px 10px", borderRadius: 8, background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: CYAN, marginBottom: 5 }}>📊 能耗管理</div>
              {[
                { label: "单位面积能耗", value: `${(building.area * 0.042 / 1000).toFixed(2)} GJ/m²` },
                { label: "本楼栋今日热量", value: `${(building.area * 0.042).toFixed(0)} kJ` },
                { label: "AI节能效果", value: needsAction ? "优化调节中" : "节能 12~18%" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, padding: "2px 0" }}>
                  <span style={{ color: TEXT_SECONDARY }}>{label}</span>
                  <span style={{ fontWeight: 700, color: CYAN, textShadow: "0 0 6px rgba(0,212,255,0.4)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
