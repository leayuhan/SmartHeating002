/**
 * HeatStationPanel - 换热站供热决策面板
 * Design: Deep blue tech — dark background, cyan/blue accents, glowing data
 */
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine,
} from "recharts";
import type { HeatStation, Building, WeatherType } from "../pages/Home";

interface Props {
  station: HeatStation;
  buildings: Building[];
  weather: WeatherType;
  onClose: () => void;
}

function generate24hData(station: HeatStation, weather: WeatherType) {
  const now = new Date();
  const weatherNoise: Record<WeatherType, number> = { sunny: 0, cloudy: -1, rainy: -2.5, snowy: -5 };
  const wn = weatherNoise[weather] ?? 0;
  return Array.from({ length: 25 }, (_, i) => {
    const hoursAgo = 24 - i;
    const t = new Date(now.getTime() - hoursAgo * 3600_000);
    const hour = t.getHours();
    const nightOffset = hour < 6 ? -2.5 : hour < 8 ? -1 : 0;
    const afternoonBoost = hour >= 13 && hour <= 16 ? 1.5 : 0;
    const noise = Math.sin(i * 1.7 + station.id.charCodeAt(1)) * 0.6;
    const supplyRaw = station.supplyTemp + nightOffset + afternoonBoost + wn * 0.4 + noise;
    const supplyT = +Math.max(50, Math.min(60, supplyRaw)).toFixed(1);
    const returnRaw = supplyT - 10 + nightOffset * 0.3 + noise * 0.3;
    const returnT = +Math.max(40, Math.min(50, returnRaw)).toFixed(1);
    const label = `${String(t.getHours()).padStart(2, "0")}:00`;
    return { time: label, supply: supplyT, return: returnT, diff: +(supplyT - returnT).toFixed(1) };
  });
}

function exportCSV(station: HeatStation, trendData: ReturnType<typeof generate24hData>) {
  const header = "时间,供水温度(°C),回水温度(°C),供回水温差(°C)";
  const rows = trendData.map(d => `${d.time},${d.supply},${d.return},${d.diff}`);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${station.name}_24h供回水温度_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PANEL_BG = "rgba(2,11,26,0.97)";
const CARD_BG = "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(0,234,255,0.04) 40%, rgba(7,18,38,0.65) 100%)";
const BORDER = "rgba(0,200,255,0.22)";
const TEXT_PRIMARY = "#E0F4FF";
const TEXT_SECONDARY = "rgba(100,180,255,0.6)";
const CYAN = "#00eaff";
const CHART_GRID = "rgba(0,100,200,0.1)";

export default function HeatStationPanel({ station, buildings, weather, onClose }: Props) {
  const avgTemp = +(buildings.reduce((s, b) => s + b.temp, 0) / buildings.length).toFixed(1);
  const riskBuildings = buildings.filter(b => b.temp < 18);
  const needsMore = avgTemp < 20;
  const weatherLabel = weather === "sunny" ? "晴天" : weather === "cloudy" ? "多云" : weather === "rainy" ? "雨天" : "雪天";

  const balanceData = buildings.map(b => ({
    name: b.name,
    temp: b.temp,
    target: 20.5,
    diff: +(b.temp - 20.5).toFixed(1),
  }));

  const trendData = useMemo(() => generate24hData(station, weather), [station.id, weather]);
  const trendTick = (value: string, index: number) => index % 4 === 0 ? value : "";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      width: 360, flexShrink: 0,
      background: PANEL_BG,
      borderLeft: "1px solid rgba(0,200,255,0.22)",
      boxShadow: "-4px 0 40px rgba(0,0,0,0.6), -2px 0 20px rgba(0,100,255,0.12)",
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "16px 16px 12px", borderBottom: `1px solid ${BORDER}`, background: "linear-gradient(180deg, rgba(0,15,40,0.6) 0%, rgba(0,10,28,0.4) 100%)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(to bottom, ${CYAN}, rgba(0,212,255,0.3))`, boxShadow: `0 0 8px ${CYAN}` }} />
              <span style={{ fontSize: 18, fontWeight: 800, color: CYAN, textShadow: "0 0 12px rgba(0,212,255,0.5)" }}>{station.name}</span>
              <span style={{
                padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                background: needsMore ? "rgba(80,30,0,0.5)" : "rgba(0,50,30,0.5)",
                color: needsMore ? "#FFB347" : "#00FF9D",
                border: `1px solid ${needsMore ? "rgba(255,150,50,0.3)" : "rgba(0,200,100,0.3)"}`,
                textShadow: needsMore ? "0 0 6px rgba(255,150,50,0.5)" : "0 0 6px rgba(0,220,100,0.5)",
              }}>
                {needsMore ? "需增热" : "运行正常"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>
              管辖 {buildings.length} 栋楼 · {weatherLabel} · 均温 {avgTemp}°C
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: "50%",
            border: `1px solid ${BORDER}`, background: "rgba(0,20,60,0.4)",
            color: TEXT_SECONDARY, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Key metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[
            { label: "供水温度", value: `${station.supplyTemp}°C`, color: "#FF6060", glow: "rgba(255,60,60,0.4)" },
            { label: "回水温度", value: `${station.returnTemp}°C`, color: CYAN, glow: "rgba(0,212,255,0.4)" },
            { label: "流量", value: `${station.flow} t/h`, color: "#7DD3FC", glow: "rgba(100,180,255,0.4)" },
            { label: "压力", value: `${station.pressure} MPa`, color: "#00FF9D", glow: "rgba(0,220,100,0.4)" },
          ].map(({ label, value, color, glow }) => (
            <div key={label} style={{ borderRadius: 8, padding: "7px 4px", textAlign: "center", background: CARD_BG, border: `1px solid ${BORDER}`, boxShadow: `0 0 8px rgba(0,100,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)`, backdropFilter: "blur(8px)", position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 9, color: TEXT_SECONDARY, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "'Share Tech Mono', monospace", textShadow: `0 0 8px ${glow}` }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12, scrollbarWidth: "thin", scrollbarColor: "rgba(0,150,255,0.3) transparent" }}>

        {/* 24h Trend Chart */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY }}>过去24小时 供/回水温度趋势</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {[{ color: "#FF6060", label: "供水" }, { color: CYAN, label: "回水" }].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 10, height: 2, background: color, borderRadius: 1, boxShadow: `0 0 4px ${color}` }} />
                  <span style={{ fontSize: 9, color: TEXT_SECONDARY, fontFamily: "'Share Tech Mono', monospace" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: "rgba(100,160,220,0.5)", fontFamily: "'Share Tech Mono', monospace" }} tickFormatter={trendTick} interval={0} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 8, fill: "rgba(100,160,220,0.5)", fontFamily: "'Share Tech Mono', monospace" }} unit="°" />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid rgba(0,150,255,0.3)", background: "rgba(2,11,26,0.95)", color: TEXT_PRIMARY, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }} formatter={(v: number, name: string) => [`${v}°C`, name === "supply" ? "供水温度" : "回水温度"]} labelStyle={{ color: CYAN, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }} />
                <Line type="monotone" dataKey="supply" stroke="#FF6060" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#FF6060" }} />
                <Line type="monotone" dataKey="return" stroke={CYAN} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: CYAN }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, padding: "0 4px" }}>
            <span style={{ fontSize: 9, color: TEXT_SECONDARY, fontFamily: "'Share Tech Mono', monospace" }}>当前供回水温差</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(255,80,0,0.15)", color: "#FF8060", border: "1px solid rgba(255,80,0,0.3)", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 6px rgba(255,80,0,0.4)" }}>
              ΔT = {station.supplyTemp - station.returnTemp}°C
            </span>
          </div>
        </div>

        {/* Hydraulic Balance Chart */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>
            二网水力平衡 — 各楼栋室温 vs 目标值
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balanceData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(100,160,220,0.5)" }} />
                <YAxis
                  domain={[14, 26]}
                  tick={{ fontSize: 9, fill: "rgba(100,160,220,0.5)" }}
                  tickFormatter={(v: number) => `${v}°`}
                />
                <ReferenceLine y={20.5} stroke="#00FF9D" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "目标", position: "right", fontSize: 8, fill: "#00FF9D" }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(0,150,255,0.3)", background: "rgba(2,11,26,0.95)", color: TEXT_PRIMARY }}
                  formatter={(v: number) => [`${v.toFixed(1)}°C`, "室温"]}
                  labelStyle={{ color: CYAN }}
                />
                <Bar dataKey="temp" radius={[4, 4, 0, 0]} name="实际室温" minPointSize={2}>
                  {balanceData.map((d, i) => (
                    <Cell key={i} fill={
                      d.temp >= 22 ? "#FF6060" :
                      d.temp >= 20 ? "#00FF9D" :
                      d.temp >= 18 ? CYAN : "#FF4040"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 9, textAlign: "center", marginTop: 4, color: TEXT_SECONDARY }}>
            红=偏热 · 绿=正常 · 青=偏冷 · 深红=低温预警
          </div>
        </div>

        {/* AI Decision */}
        <div style={{
          padding: "10px 12px", borderRadius: 10, marginBottom: 12,
          background: needsMore ? "rgba(60,30,0,0.4)" : "rgba(0,50,30,0.4)",
          border: `1px solid ${needsMore ? "rgba(255,150,50,0.3)" : "rgba(0,200,100,0.3)"}`,
          boxShadow: needsMore ? "0 0 20px rgba(255,100,0,0.1)" : "0 0 20px rgba(0,200,100,0.1)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: needsMore ? "#FFB347" : "#00FF9D", textShadow: needsMore ? "0 0 8px rgba(255,150,50,0.5)" : "0 0 8px rgba(0,220,100,0.5)" }}>
            {needsMore ? "⚡ AI决策：申请增加热源" : "✅ AI决策：维持当前供热"}
          </div>
          <div style={{ fontSize: 11, color: needsMore ? "rgba(255,180,100,0.7)" : "rgba(0,220,100,0.6)", lineHeight: 1.7 }}>
            {needsMore ? (
              <>
                均温 {avgTemp}°C 低于目标，{riskBuildings.length > 0 ? `${riskBuildings.length}栋低温预警，` : ""}
                建议向热源申请增加 {Math.round((20.5 - avgTemp) * 12)} kW 热量供给。<br />
                同时优化二网阀门分配，优先保障偏冷楼栋。
                {riskBuildings.length > 0 && (
                  <><br />⚠️ 建议安排管道检修，排查远端支路漏水隐患。</>
                )}
              </>
            ) : (
              <>
                各楼栋室温均在目标范围内，供热充足。
                当前{weatherLabel}条件下，维持供水温度 {station.supplyTemp}°C，
                流量 {station.flow} t/h，无需调整。
              </>
            )}
          </div>
        </div>

        {/* CSV Export */}
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => exportCSV(station, trendData)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: "rgba(0,40,100,0.4)", border: `1px solid ${BORDER}`,
              color: CYAN, cursor: "pointer", transition: "all 0.15s",
              textShadow: "0 0 6px rgba(0,212,255,0.4)",
            }}
          >
            <span style={{ fontSize: 14 }}>↓</span>
            导出24h供回水温度报表 (CSV)
          </button>
        </div>

        {/* Building Details */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>各楼栋详情</div>
          {buildings.map(b => {
            const tc = b.temp >= 22 ? "#FF6060" : b.temp >= 20 ? "#00FF9D" : b.temp >= 18 ? CYAN : "#FF4040";
            const valvePos = b.position === "近端" ? 45 : b.position === "中端" ? 62 : 82;
            return (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderRadius: 8, marginBottom: 6,
                background: CARD_BG, border: `1px solid ${BORDER}`,
              boxShadow: `0 0 8px rgba(0,100,255,0.08), inset 0 1px 0 rgba(255,255,255,0.07)`,
              backdropFilter: "blur(8px)",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,30,80,0.6)", border: `1px solid ${tc}40`,
                  boxShadow: `0 0 8px ${tc}20`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: tc, fontFamily: "'Share Tech Mono', monospace", textShadow: `0 0 6px ${tc}80` }}>{b.temp}°</span>
                  <span style={{ fontSize: 8, color: tc }}>C</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_PRIMARY }}>{b.name}</span>
                    <span style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'Share Tech Mono', monospace" }}>阀门 {valvePos}%</span>
                  </div>
                  <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>
                    {b.floors}层 · {b.heatingType} · {b.position}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(0,50,120,0.4)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${valvePos}%`, background: `linear-gradient(to right, ${tc}80, ${tc})`, boxShadow: `0 0 4px ${tc}` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
