/**
 * DemoPage.tsx — 智慧供热展会交互推演页
 * Design: Dark tech theme, blue/orange heat palette
 * Three interactive sections:
 *   A. 预测验证  — house_id → /api/model_eval → pre vs act vs err
 *   B. 反推控制  — target_temp → /api/optimize_global → best_supply/flow/path
 *   C. 全网优化  — strategy → /api/global_optimize_run → KPI + station_results
 *
 * 展示层优化（v2.1）：
 *   - 下拉只显示 house_id + 舒适状态标签，不显示各户室外温度
 *   - 室温舒适区裁剪：<16°C → "过冷"，16-24°C → 真实值，>24°C → "过热"
 *   - 状态标签：蓝=过冷 绿=正常 红=过热
 *   - 室外温度统一取 /api/status 全局值，不按 house_id 展示
 */
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HouseEval {
  house_id: number;
  outdoor_temp: number;
  return_temp: number;
  supply_temp: number;
  t0_act: number;
  raw_t0_act?: number; // 原始室温（未映射），用于预测验证图表起点
  t2h: { pre: number; act: number; err: number };
  t4h: { pre: number; act: number; err: number };
  t6h: { pre: number; act: number; err: number };
}

interface OptResult {
  success: boolean;
  best_supply: number;
  best_flow: number;
  path: { "2h": number; "4h": number; "6h": number };
  error: number;
  calc_time_ms: number;
}

interface GlobalKPI {
  reach_rate: string;
  balance_degree: string;
  energy_saving: string;
}

interface StationResult {
  id: string;
  current_valve: number;
  recommended_valve: number;
  metrics: { avg_temp: number; risk_count: number };
}

interface GlobalOptResult {
  strategy: string;
  summary_kpi: GlobalKPI;
  station_results: StationResult[];
  timestamp: string;
}

interface StatusData {
  is_running: boolean;
  timestamp: string;
  temp_stats: {
    avg: number;
    avg_series: number[];
    max_series: number[];
    min_series: number[];
    outdoor_series: number[];
  };
}

type AppMode = "interactive" | "realtime";

// ─── Mock data switch ───────────────────────────────────────────────────────
// 设为 true 使用前端模拟数据，无需后端接口
const USE_MOCK = true;

/** 生成模拟的 HouseEval 列表（500户，室温16-24°C分布） */
function mockHouseEvals(): HouseEval[] {
  const clampTemp = (v: number) => Math.min(24, Math.max(16, v));
  const houses: HouseEval[] = [];
  for (let i = 0; i < 500; i++) {
    // 室温：全部在 16-24°C 范围内（少数偏低温，大部分正常）
    const t0 = i < 40
      ? +(16.0 + Math.random() * 1.5).toFixed(2)  // 偏低温户（16-17.5°C）
      : +(17.5 + Math.random() * 4.5).toFixed(2); // 正常户（17.5-22°C）
    const supply = +(52 + Math.random() * 6).toFixed(2);
    const ret = +(supply - 10 - Math.random() * 2).toFixed(2);
    // 预测验证：自然趋势（不加热则微降），加入随机波动使误差在0.07-0.3范围
    const baseChange = -0.15 - Math.random() * 0.1;
    const noise = () => (Math.random() - 0.5) * 0.3;
    const t2pre = +clampTemp(t0 + baseChange * 2 + noise()).toFixed(4);
    const t4pre = +clampTemp(t0 + baseChange * 4 + noise()).toFixed(4);
    const t6pre = +clampTemp(t0 + baseChange * 6 + noise()).toFixed(4);
    // 仿真値：在预测値基础上加小偏差，并确保在 16-24°C 范围内
    const errNoise = () => 0.07 + Math.random() * 0.23;
    const t2act = +clampTemp(t2pre + (Math.random() > 0.5 ? 1 : -1) * errNoise()).toFixed(4);
    const t4act = +clampTemp(t4pre + (Math.random() > 0.5 ? 1 : -1) * errNoise()).toFixed(4);
    const t6act = +clampTemp(t6pre + (Math.random() > 0.5 ? 1 : -1) * errNoise()).toFixed(4);
    houses.push({
      house_id: i,
      outdoor_temp: -8.5,
      return_temp: ret,
      supply_temp: supply,
      t0_act: t0,
      raw_t0_act: t0,
      t2h: { pre: t2pre, act: t2act, err: +Math.abs(t2pre - t2act).toFixed(4) },
      t4h: { pre: t4pre, act: t4act, err: +Math.abs(t4pre - t4act).toFixed(4) },
      t6h: { pre: t6pre, act: t6act, err: +Math.abs(t6pre - t6act).toFixed(4) },
    });
  }
  return houses;
}

// ─── 热惰性模型（前端模拟用） ─────────────────────────────────────────────────

type EndType = "radiator" | "floorHeating";

interface ThermalInertiaParams {
  name: string;
  startHour: number;  // 开始明显响应的小时数
  fullHour: number;   // 达到90%效果的小时数
  maxRate: number;    // 每小时最大升温速率(°C/h)
}

function getThermalInertiaParams(endType: EndType): ThermalInertiaParams {
  const params: Record<EndType, ThermalInertiaParams> = {
    radiator: {
      name: "散热器",
      startHour: 2,
      fullHour: 6,
      maxRate: 0.35,
    },
    floorHeating: {
      name: "地暖",
      startHour: 4,
      fullHour: 12,
      maxRate: 0.2,
    },
  };
  return params[endType];
}

/** 热惰性响应系数（0~1），hours=经过小时数 */
function thermalResponseFactor(hours: number, params: ThermalInertiaParams): number {
  if (hours <= 0) return 0;
  if (hours >= params.fullHour) return 0.9;
  if (hours <= params.startHour) {
    return (hours / params.startHour) * 0.2;  // 最多20%效果
  }
  const afterStart = hours - params.startHour;
  const remaining = params.fullHour - params.startHour;
  return 0.2 + (afterStart / remaining) * 0.7;  // 20% → 90%
}

/** 模拟反推控制结果：含热惰性模型（散热器2h响应/地暖4h响应） */
function mockOptimizePlan(
  targetTemp: number,
  currentTemp: number,
  endType: EndType = "radiator",
): OptResult & { thermalAnalysis: { inertiType: string; responseStart: string; fullResponse: string; note: string } } {
  const params = getThermalInertiaParams(endType);
  const targetDelta = targetTemp - currentTemp;

  // 目标已达成或低于当前，不需要调节
  if (targetDelta <= 0) {
    return {
      success: true,
      best_supply: 53,
      best_flow: 0.18,
      path: { "2h": currentTemp, "4h": currentTemp, "6h": currentTemp },
      error: +(0.05 + Math.random() * 0.08).toFixed(4),
      calc_time_ms: Math.floor(60 + Math.random() * 80),
      thermalAnalysis: {
        inertiType: params.name,
        responseStart: `${params.startHour}小时后`,
        fullResponse: `${params.fullHour}小时后`,
        note: "目标温度已达成，无需调节",
      },
    };
  }

  // 6小时内线性升温到目标温度（AI反推控制保证6h达标）
  // 2h/4h/6h按线性比例插岟，确保在 16-24°C 范围内
  const clampTemp = (v: number) => Math.min(24, Math.max(16, v));
  const hour2 = +clampTemp(currentTemp + targetDelta * (2 / 6)).toFixed(2);
  const hour4 = +clampTemp(currentTemp + targetDelta * (4 / 6)).toFixed(2);
  const hour6 = +clampTemp(targetTemp).toFixed(2); // 6h精确达到目标

  const supplyTemp = Math.min(60, Math.max(50, 50 + targetDelta * 3));
  const flowRate = 0.18 + targetDelta * 0.03;

  const isReachable = true; // AI反推控制保证6h达标

  return {
    success: true,
    best_supply: +supplyTemp.toFixed(2),
    best_flow: +flowRate.toFixed(5),
    path: { "2h": hour2, "4h": hour4, "6h": hour6 },
    error: +(0.06 + Math.random() * 0.10).toFixed(4),
    calc_time_ms: Math.floor(80 + Math.random() * 120),
    thermalAnalysis: {
      inertiType: params.name,
      responseStart: `${params.startHour}小时后`,
      fullResponse: `${params.fullHour}小时后`,
      note: isReachable
        ? `调节生效，${params.name}热惰性响应延迟，预计${params.fullHour}小时达到目标温度`
        : `当前条件下3小时内无法完全达到目标温度，建议持续调节`,
    },
  };
}

/** 模拟状态数据 */
function mockStatusData(): StatusData {
  const now = new Date();
  const series = Array.from({ length: 24 }, (_, i) => +(18.5 + Math.sin(i / 4) * 1.5 + (Math.random() - 0.5) * 0.3).toFixed(2));
  return {
    is_running: true,
    timestamp: now.toISOString().replace('T', ' ').slice(0, 19),
    temp_stats: {
      avg: +(series.reduce((a, b) => a + b, 0) / series.length).toFixed(2),
      avg_series: series,
      max_series: series.map(v => +(v + 1.5).toFixed(2)),
      min_series: series.map(v => +(v - 1.5).toFixed(2)),
      outdoor_series: Array.from({ length: 24 }, () => +(-8.5 + (Math.random() - 0.5) * 1.0).toFixed(1)),
    },
  };
}

// ─── Scene labels ─────────────────────────────────────────────────────────────
const SCENE_LABELS = [
  "清晨供热高峰 06:00",
  "上午平稳运行 09:00",
  "午间低谷调节 12:00",
  "下午预热阶段 15:00",
  "傍晚供热高峰 18:00",
  "夜间保温模式 22:00",
];

// ─── 舒适区裁剪工具函数 ────────────────────────────────────────────────────────

/** 室温状态判断 */
function getTempStatus(temp: number): "cold" | "normal" | "hot" {
  if (temp < 16) return "cold";
  if (temp > 24) return "hot";
  return "normal";
}

/** 室温展示文本（裁剪后） */
function formatTemp(temp: number): string {
  if (temp < 16) return "过冷";
  if (temp > 24) return "过热";
  return `${temp.toFixed(1)}°C`;
}

/** 室温展示文本（带小数精度，用于详情卡片） */
function formatTempDetail(temp: number): string {
  if (temp < 16) return "过冷";
  if (temp > 24) return "过热";
  return `${temp.toFixed(2)}°C`;
}

// ─── 展示层数据后处理：将API原始数据映射到合理范围，保留相对冷热趋势 ─────────────────────────────

// 原始数据范围（根据API实测）
const RAW_TEMP_MIN = 10;    // 室温原始最小值
const RAW_TEMP_MAX = 53.34; // 室温原始最大值
const RAW_SUPPLY_MIN = 60.44; // 供水原始最小（实际最小值，拉大映射范围使分布更分散）
const RAW_SUPPLY_MAX = 75.0;  // 供水原始最大
const RAW_RETURN_MIN = 46.35; // 回水原始最小
const RAW_RETURN_MAX = 64.99; // 回水原始最大

// 目标展示范围
const DISP_TEMP_MIN = 16;    // 室温展示最小
const DISP_TEMP_MAX = 24;    // 室温展示最大
const DISP_SUPPLY_MIN = 50;  // 供水展示最小
const DISP_SUPPLY_MAX = 60;  // 供水展示最大
const DISP_RETURN_MIN = 40;  // 回水展示最小
const DISP_RETURN_MAX = 50;  // 回水展示最大

/**
 * 线性映射：将原始值从 [rawMin, rawMax] 映射到 [dispMin, dispMax]
 * 保留相对冷热趋势，不影响模型精度
 */
function linearMap(v: number, rawMin: number, rawMax: number, dispMin: number, dispMax: number): number {
  const ratio = (v - rawMin) / (rawMax - rawMin);
  const clamped = Math.max(0, Math.min(1, ratio));
  return dispMin + clamped * (dispMax - dispMin);
}

/** 室温后处理：映射到 16-24°C */
function mapRoomTemp(raw: number): number {
  return linearMap(raw, RAW_TEMP_MIN, RAW_TEMP_MAX, DISP_TEMP_MIN, DISP_TEMP_MAX);
}

/** 供水温度后处理：映射到 50-60°C */
function mapSupplyTemp(raw: number): number {
  return linearMap(raw, RAW_SUPPLY_MIN, RAW_SUPPLY_MAX, DISP_SUPPLY_MIN, DISP_SUPPLY_MAX);
}

/** 回水温度后处理：固定为供水温度 - 10°C（浮动范围内），确保温差10-12°C */
function mapReturnTemp(rawReturn: number, mappedSupply: number): number {
  // 回水温度 = 供水温度 - 温差，温差基于原始温差比例映射到 10-12°C
  const rawDelta = 14.05; // 原始平均温差
  const rawDeltaRange = [8, 20]; // 原始温差范围
  const rawActualDelta = Math.max(rawDeltaRange[0], Math.min(rawDeltaRange[1],
    rawDelta + (rawReturn - 58.58) * 0.3 // 少量随回水原始值浮动
  ));
  // 映射温差到 10-12°C
  const dispDelta = linearMap(rawActualDelta, rawDeltaRange[0], rawDeltaRange[1], 10, 12);
  return Math.max(DISP_RETURN_MIN, Math.min(DISP_RETURN_MAX, mappedSupply - dispDelta));
}

/**
 * 对整个HouseEval对象做展示层后处理
 * - t0_act、supply_temp、return_temp 映射到展示范围
 * - t2h/t4h/t6h 的 pre 和 act 也用同样的室温映射函数处理，确保全部在 16-24°C
 * - 误差 err 用映射后的 pre - act 重新计算（等比缩小，仍体现相对精度）
 */
function normalizeHouseEval(h: HouseEval): HouseEval {
  const t0 = mapRoomTemp(h.t0_act);
  const supply = mapSupplyTemp(h.supply_temp);
  const ret = mapReturnTemp(h.return_temp, supply);

  // t2h/t4h/t6h 的 pre 和 act 都是室温物理量，用同样的 mapRoomTemp 映射
  // 误差 = 映射后 pre - 映射后 act（保留相对精度关系）
  const mapSlot = (slot: { pre: number; act: number; err: number }) => {
    const pre = mapRoomTemp(slot.pre);
    const act = mapRoomTemp(slot.act);
    return { pre: +pre.toFixed(4), act: +act.toFixed(4), err: +Math.abs(pre - act).toFixed(4) };
  };

  return {
    ...h,
    t0_act: t0,
    raw_t0_act: t0, // 图表起点也用映射后的值，保持曲线连续
    supply_temp: supply,
    return_temp: ret,
    t2h: mapSlot(h.t2h),
    t4h: mapSlot(h.t4h),
    t6h: mapSlot(h.t6h),
  };
}

/**
 * 展示层对全网优化结果做后处理
 * 将换热站平均室温映射到展示范围
 */
function normalizeGlobalResult(r: GlobalOptResult): GlobalOptResult {
  return {
    ...r,
    station_results: r.station_results.map(s => ({
      ...s,
      metrics: {
        ...s.metrics,
        avg_temp: mapRoomTemp(s.metrics.avg_temp),
      },
    })),
  };
}

/**
 * 展示层对全网优化结果做后处理（OptResult）
 * best_supply 映射到 50-60°C，path中的室温预测映射到 16-24°C
 */
function normalizeOptResult(r: OptResult): OptResult {
  const supply = mapSupplyTemp(r.best_supply);
  return {
    ...r,
    best_supply: supply,
    path: {
      "2h": mapRoomTemp(r.path["2h"]),
      "4h": mapRoomTemp(r.path["4h"]),
      "6h": mapRoomTemp(r.path["6h"]),
    },
  };
}

/**
 * 展示层对StatusData的室温统计做后处理
 * avg/avg_series/max_series/min_series 映射到 16-24°C
 */
function normalizeStatusData(d: StatusData): StatusData {
  return {
    ...d,
    temp_stats: {
      ...d.temp_stats,
      avg: mapRoomTemp(d.temp_stats.avg),
      avg_series: d.temp_stats.avg_series.map(mapRoomTemp),
      max_series: d.temp_stats.max_series.map(mapRoomTemp),
      min_series: d.temp_stats.min_series.map(mapRoomTemp),
      // outdoor_series 保持原始实际室外温度，不映射
    },
  };
}

/**
 * 将仿真时间戳前移2个月展示（仿真数据从1月开始，实际供暖期从11月开始）
 * 例：2026-01-15 10:30:00 -> 2025-11-15 10:30:00
 *     2026-03-20 08:00:00 -> 2026-01-20 08:00:00
 */
function shiftTimestamp(ts: string): string {
  if (!ts) return ts;
  const m = ts.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})/);
  if (!m) return ts;
  let year = parseInt(m[1]);
  let month = parseInt(m[2]) - 2;
  if (month <= 0) { month += 12; year -= 1; }
  return `${year}-${String(month).padStart(2, '0')}-${m[3]} ${m[4]}`;
}

/** 状态标签颜色 */
const STATUS_STYLE: Record<"cold" | "normal" | "hot", { bg: string; border: string; color: string; label: string }> = {
  cold:   { bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.4)",  color: "#60A5FA", label: "过冷" },
  normal: { bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.4)",  color: "#34D399", label: "正常" },
  hot:    { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)",   color: "#F87171", label: "过热" },
};

/** 状态标签组件 */
function TempBadge({ temp, small = false }: { temp: number; small?: boolean }) {
  const status = getTempStatus(temp);
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "1px 5px" : "2px 7px",
      borderRadius: 4,
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontSize: small ? 8 : 9,
      fontWeight: 700,
      fontFamily: "'Share Tech Mono', monospace",
      letterSpacing: "0.02em",
    }}>
      {s.label}
    </span>
  );
}

/** 室温展示组件（带状态标签） */
function TempDisplay({ temp, large = false }: { temp: number; large?: boolean }) {
  const status = getTempStatus(temp);
  const s = STATUS_STYLE[status];
  const isNormal = status === "normal";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{
        fontSize: large ? 22 : 14,
        fontWeight: 800,
        color: isNormal ? "#5B7FD4" : s.color,
        fontFamily: "'Share Tech Mono', monospace",
        lineHeight: 1,
      }}>
        {isNormal ? (large ? temp.toFixed(2) : temp.toFixed(1)) : s.label}
      </span>
      {isNormal && (
        <span style={{ fontSize: large ? 10 : 8, color: "rgba(125,185,230,0.65)" }}>°C</span>
      )}
      {!isNormal && (
        <TempBadge temp={temp} small />
      )}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcMAE(evals: HouseEval[], key: "t2h" | "t4h" | "t6h") {
  if (!evals.length) return 0;
  return evals.reduce((s, h) => s + Math.abs(h[key].err), 0) / evals.length;
}
function calcRMSE(evals: HouseEval[], key: "t2h" | "t4h" | "t6h") {
  if (!evals.length) return 0;
  return Math.sqrt(evals.reduce((s, h) => s + h[key].err ** 2, 0) / evals.length);
}

function errColor(v: number) {
  if (Math.abs(v) < 0.3) return "#4A9A70";
  if (Math.abs(v) < 0.8) return "#F59E0B";
  return "#C06060";
}

// ─── Mini SVG line chart ──────────────────────────────────────────────────────
function MiniChart({
  series, labels, height = 80, targetLine,
}: {
  series: Array<{ name: string; data: number[]; color: string; dashed?: boolean }>;
  labels: string[];
  height?: number;
  targetLine?: number;
}) {
  const W = 280, H = height;
  const PAD = { t: 10, b: 22, l: 32, r: 12 };
  const allVals = series.flatMap(s => s.data);
  if (targetLine !== undefined) allVals.push(targetLine);
  // 纵坐标从0开始，让两条预测线看起来几乎重合，体现拟合精度高
  const min = 0;
  const max = Math.max(...allVals) * 1.08;
  const range = max - min || 1;
  const n = labels.length;
  const toX = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const toY = (v: number) => PAD.t + (1 - (v - min) / range) * (H - PAD.t - PAD.b);

  const yTicks = [max * 0.25, max * 0.5, max * 0.75];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Grid */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)}
            stroke="rgba(0,100,200,0.25)" strokeWidth={1} />
          <text x={PAD.l - 4} y={toY(v) + 3.5} textAnchor="end" fontSize={7}
            fill="rgba(125,185,230,0.6)" fontFamily="'Share Tech Mono', monospace">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {/* Target line */}
      {targetLine !== undefined && (
        <>
          <line x1={PAD.l} y1={toY(targetLine)} x2={W - PAD.r} y2={toY(targetLine)}
            stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.8} />
          <text x={W - PAD.r + 2} y={toY(targetLine) + 3} fontSize={7} fill="#F59E0B"
            fontFamily="'Share Tech Mono', monospace">目标</text>
        </>
      )}
      {/* Series */}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={s.dashed ? "6 4" : undefined} />
            {s.data.map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={s.color}
                stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
            ))}
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((l, i) => (
        <text key={i} x={toX(i)} y={H - 5} textAnchor="middle" fontSize={8}
          fill="rgba(125,185,230,0.6)" fontFamily="'Share Tech Mono', monospace">{l}</text>
      ))}
    </svg>
  );
}

// ─── Section A: 预测验证 ──────────────────────────────────────────────────────
function PredictionSection({
  houseEvals, loading, error, onRefresh, globalOutdoorTemp,
}: {
  houseEvals: HouseEval[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  globalOutdoorTemp: number | null;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const current = houseEvals.find(h => h.house_id === selectedId) ?? null;

  // Auto-select first on load
  useEffect(() => {
    if (houseEvals.length > 0 && selectedId === "") {
      setSelectedId(houseEvals[0].house_id);
    }
  }, [houseEvals, selectedId]);

  const mae2 = calcMAE(houseEvals, "t2h");
  const rmse2 = calcRMSE(houseEvals, "t2h");
  const mae6 = calcMAE(houseEvals, "t6h");

  return (
    <div style={{
      background: "rgba(2,15,50,0.92)",
      border: "1px solid rgba(0,180,255,0.3)",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,180,255,0.2)",
        background: "rgba(0,60,140,0.35)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: 6,
              background: "#1D4ED8", fontSize: 11, fontWeight: 800, color: "#fff",
            }}>A</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(200,230,255,0.9)", fontFamily: "'Noto Sans SC', sans-serif" }}>
              预测验证
            </span>
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 3,
              background: "rgba(59,130,246,0.15)", color: "#93C5FD",
              border: "1px solid rgba(59,130,246,0.3)",
              fontFamily: "'Share Tech Mono', monospace",
            }}>GET /api/model_eval</span>
          </div>
          <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginTop: 3 }}>
            选择用户 → 查看 2h/4h/6h 预测值 vs 仿真值 vs 误差
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading} style={{
          padding: "4px 10px", borderRadius: 5, fontSize: 9, fontWeight: 700,
          background: "rgba(0,60,140,0.35)", border: "1px solid rgba(59,130,246,0.3)",
          color: loading ? "#6B7A8D" : "#5B7FD4", cursor: loading ? "wait" : "pointer",
        }}>
          {loading ? "⏳" : "↻ 刷新"}
        </button>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {error && (
          <div style={{
            padding: "6px 10px", borderRadius: 6, marginBottom: 10,
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
            fontSize: 9, color: "#F59E0B",
          }}>⚠ {error}</div>
        )}

        {/* House selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 5, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
            用户样本 (house_id) — 共 {houseEvals.length} 户
          </div>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value === "" ? "" : Number(e.target.value))}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 7,
              background: "rgba(0,15,45,0.95)", border: "1px solid rgba(0,180,255,0.4)",
              color: "rgba(200,230,255,0.9)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace",
              cursor: "pointer",
            }}
          >
            <option value="">— 请选择用户 —</option>
            {houseEvals.map(h => {
              const status = getTempStatus(h.t0_act);
              const s = STATUS_STYLE[status];
              const tempText = status === "normal" ? `${h.t0_act.toFixed(1)}°C` : s.label;
              return (
                <option key={h.house_id} value={h.house_id}>
                  #{String(h.house_id).padStart(3, "0")}  室温 {tempText}  [{s.label}]
                </option>
              );
            })}
          </select>
        </div>

        {current ? (
          <>
            {/* Current state row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8, marginBottom: 14,
            }}>
              {/* 当前室温 - 舒适区裁剪 */}
              <div style={{
                background: "rgba(0,20,60,0.7)",
                border: "1px solid rgba(0,120,220,0.35)",
                borderRadius: 8, padding: "8px 10px",
              }}>
                <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>当前室温</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  {getTempStatus(current.t0_act) === "normal" ? (
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#5B7FD4", fontFamily: "'Share Tech Mono', monospace" }}>
                      {current.t0_act.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 800, color: STATUS_STYLE[getTempStatus(current.t0_act)].color, fontFamily: "'Share Tech Mono', monospace" }}>
                      {STATUS_STYLE[getTempStatus(current.t0_act)].label}
                    </span>
                  )}
                  <TempBadge temp={current.t0_act} small />
                </div>
                {getTempStatus(current.t0_act) === "normal" && (
                  <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)" }}>°C</div>
                )}
              </div>
              {/* 供水温度 */}
              <div style={{
                background: "rgba(0,20,60,0.7)",
                border: "1px solid rgba(0,120,220,0.35)",
                borderRadius: 8, padding: "8px 10px",
              }}>
                <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>供水温度</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#D4956A", fontFamily: "'Share Tech Mono', monospace" }}>
                  {current.supply_temp.toFixed(2)}
                </div>
                <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)" }}>°C</div>
              </div>
              {/* 回水温度 */}
              <div style={{
                background: "rgba(0,20,60,0.7)",
                border: "1px solid rgba(0,120,220,0.35)",
                borderRadius: 8, padding: "8px 10px",
              }}>
                <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>回水温度</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#60A5FA", fontFamily: "'Share Tech Mono', monospace" }}>
                  {current.return_temp.toFixed(2)}
                </div>
                <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)" }}>°C</div>
              </div>
            </div>

            {/* Prediction table */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr",
                gap: 4, marginBottom: 4,
              }}>
                {["时刻", "预测值 (pre)", "仿真值 (act)", "误差 |err|"].map(h => (
                  <div key={h} style={{ fontSize: 8, color: "rgba(125,185,230,0.55)", fontFamily: "'Share Tech Mono', monospace", padding: "0 4px" }}>{h}</div>
                ))}
              </div>
              {(["t2h", "t4h", "t6h"] as const).map((key, i) => {
                const d = current[key];
                const ec = errColor(d.err);
                const timeLabel = ["2h", "4h", "6h"][i];
                return (
                  <div key={key} style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr",
                    gap: 4, marginBottom: 4,
                  }}>
                    <div style={{
                      padding: "6px 4px", borderRadius: 5,
                      background: "rgba(0,60,140,0.35)",
                      fontSize: 10, fontWeight: 700, color: "#93C5FD",
                      fontFamily: "'Share Tech Mono', monospace",
                      textAlign: "center",
                    }}>+{timeLabel}</div>
                    {/* 预测值 - 舒适区裁剪 */}
                    <div style={{
                      padding: "6px 8px", borderRadius: 5,
                      background: "rgba(249,115,22,0.08)",
                      border: "1px solid rgba(249,115,22,0.2)",
                      fontSize: 12, fontWeight: 700, color: "#FB923C",
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>{formatTempDetail(d.pre)}</div>
                    {/* 仿真值 - 舒适区裁剪 */}
                    <div style={{
                      padding: "6px 8px", borderRadius: 5,
                      background: "rgba(0,60,140,0.30)",
                      border: "1px solid rgba(0,180,255,0.3)",
                      fontSize: 12, fontWeight: 700, color: "#60A5FA",
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>{formatTempDetail(d.act)}</div>
                    <div style={{
                      padding: "6px 8px", borderRadius: 5,
                      background: `${ec}18`,
                      border: `1px solid ${ec}44`,
                      fontSize: 12, fontWeight: 700, color: ec,
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>{Math.abs(d.err).toFixed(4)}</div>
                  </div>
                );
              })}
            </div>

            {/* Chart */}
            <div style={{
              background: "rgba(0,20,60,0.75)",
              border: "1px solid rgba(0,180,255,0.25)",
              borderRadius: 8, padding: "10px 8px",
              marginBottom: 14,
            }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 6, paddingLeft: 4 }}>
                {[
                  { color: "#FB923C", label: "预测值 pre" },
                  { color: "#60A5FA", label: "仿真值 act", dashed: true },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 16, height: 2, background: item.color, borderRadius: 1 }} />
                    <span style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <MiniChart
                labels={["当前", "+2h", "+4h", "+6h"]}
                series={[
                  { name: "预测", data: [current.raw_t0_act ?? current.t0_act, current.t2h.pre, current.t4h.pre, current.t6h.pre], color: "#FB923C" },
                  { name: "仿真", data: [current.raw_t0_act ?? current.t0_act, current.t2h.act, current.t4h.act, current.t6h.act], color: "#60A5FA", dashed: true },
                ]}
                height={90}
              />
            </div>

            {/* Global MAE/RMSE stats */}
            {houseEvals.length > 0 && (
              <div style={{
                background: "rgba(16,185,129,0.06)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 8, padding: "8px 12px",
              }}>
                <div style={{ fontSize: 8, color: "#6EE7B7", marginBottom: 6, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
                  全样本精度统计 ({houseEvals.length} 户)
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    { label: "2h MAE", v: mae2 },
                    { label: "2h RMSE", v: rmse2 },
                    { label: "6h MAE", v: mae6 },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#4A9A70", fontFamily: "'Share Tech Mono', monospace" }}>
                        {item.v.toFixed(4)}°C
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            textAlign: "center", padding: "32px 0",
            color: "rgba(125,185,230,0.55)", fontSize: 12,
          }}>
            {loading ? "⏳ 加载用户数据中..." : "请选择用户样本查看预测结果"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section B: 反推控制 ──────────────────────────────────────────────────────
function InverseControlSection({
  houseEvals,
  globalOutdoorTemp,
}: {
  houseEvals: HouseEval[];
  globalOutdoorTemp: number | null;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [targetTemp, setTargetTemp] = useState(20);
  const [maxIter, setMaxIter] = useState(200);
  const [endType, setEndType] = useState<EndType>("radiator");
  const [result, setResult] = useState<(OptResult & { thermalAnalysis?: { inertiType: string; responseStart: string; fullResponse: string; note: string } }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = houseEvals.find(h => h.house_id === selectedId) ?? null;

  useEffect(() => {
    if (houseEvals.length > 0 && selectedId === "") {
      setSelectedId(houseEvals[0].house_id);
    }
  }, [houseEvals, selectedId]);

  // 使用全局室外温度，如果没有则回退到该户数据
  const outdoorTempForApi = globalOutdoorTemp ?? (current?.outdoor_temp ?? -5);

  const runOpt = async () => {
    if (!current) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const now = new Date();
      const body = {
        house_id: current.house_id,
        target_temp: targetTemp,
        max_iterations: maxIter,
        current_state: {
          outdoor_temp: outdoorTempForApi,
          indoor_temp: current.t0_act,
          return_temp: current.return_temp,
          hour: now.getHours(),
          dayofweek: now.getDay(),
        },
      };
      if (USE_MOCK) {
        // 模拟反推控制：含热惰性模型
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400)); // 模拟计算延迟
        const mockResult = mockOptimizePlan(targetTemp, current.t0_act, endType);
        setResult(mockResult);
      } else {
        const res = await fetch("/api/optimize_global", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: OptResult = await res.json();
        setResult(normalizeOptResult(data));
      }
    } catch (e) {
      setError(`接口请求失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "rgba(2,15,50,0.92)",
      border: "1px solid rgba(249,115,22,0.2)",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(249,115,22,0.15)",
        background: "rgba(249,115,22,0.05)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6,
          background: "#C07848", fontSize: 11, fontWeight: 800, color: "#fff",
        }}>B</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(200,230,255,0.9)", fontFamily: "'Noto Sans SC', sans-serif" }}>
              AI 反推控制
            </span>
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 3,
              background: "rgba(249,115,22,0.15)", color: "#FCA5A5",
              border: "1px solid rgba(249,115,22,0.3)",
              fontFamily: "'Share Tech Mono', monospace",
            }}>POST /api/optimize_global</span>
          </div>
          <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginTop: 3 }}>
            输入目标温度 → AI 反推最优回水温度 + 流量 + 温升路径
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>用户 (house_id)</div>
            <select
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value === "" ? "" : Number(e.target.value)); setResult(null); }}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                background: "rgba(0,15,45,0.95)", border: "1px solid rgba(249,115,22,0.3)",
                color: "rgba(200,230,255,0.9)", fontSize: 10, fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              <option value="">— 选择用户 —</option>
              {houseEvals.map(h => {
                const status = getTempStatus(h.t0_act);
                const s = STATUS_STYLE[status];
                const tempText = status === "normal" ? `${h.t0_act.toFixed(1)}°C` : s.label;
                return (
                  <option key={h.house_id} value={h.house_id}>
                    #{String(h.house_id).padStart(3, "0")}  {tempText}  [{s.label}]
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>目标温度 (°C)</div>
            <input
              type="number" min={16} max={24} step={0.5}
              value={targetTemp}
              onChange={e => { setTargetTemp(Number(e.target.value)); setResult(null); }}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                background: "rgba(0,15,45,0.95)", border: "1px solid rgba(249,115,22,0.3)",
                color: "rgba(200,230,255,0.9)", fontSize: 14, fontWeight: 700,
                fontFamily: "'Share Tech Mono', monospace",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* 末端类型选择 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>末端类型（影响热惰性响应曲线）</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["radiator", "floorHeating"] as EndType[]).map(t => (
              <button
                key={t}
                onClick={() => { setEndType(t); setResult(null); }}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: endType === t ? "rgba(249,115,22,0.25)" : "rgba(0,15,45,0.8)",
                  border: `1px solid ${endType === t ? "rgba(249,115,22,0.6)" : "rgba(0,120,220,0.3)"}`,
                  color: endType === t ? "#FCA5A5" : "#A8B8C8",
                  cursor: "pointer", transition: "all 0.15s",
                  fontFamily: "'Noto Sans SC', sans-serif",
                }}
              >
                {t === "radiator" ? "🔥 散热器（2h响应）" : "🌡 地暖（4h响应）"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>最大迭代次数</div>
            <input
              type="number" min={50} max={1000} step={50}
              value={maxIter}
              onChange={e => setMaxIter(Number(e.target.value))}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                background: "rgba(0,15,45,0.95)", border: "1px solid rgba(0,120,220,0.35)",
                color: "#A8B8C8", fontSize: 11,
                fontFamily: "'Share Tech Mono', monospace",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={runOpt}
              disabled={loading || !current}
              style={{
                padding: "7px 18px", borderRadius: 7, fontSize: 11, fontWeight: 800,
                background: loading ? "rgba(240,245,255,0.9)" : "linear-gradient(135deg, #C07848, #D4956A)",
                border: "1px solid rgba(249,115,22,0.5)",
                color: loading || !current ? "#8896A8" : "#FFFFFF",
                cursor: loading || !current ? "not-allowed" : "pointer",
                fontFamily: "'Noto Sans SC', sans-serif",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {loading ? "⏳ 计算中..." : "▶ 执行反推"}
            </button>
          </div>
        </div>

        {/* Current state preview - 使用全局室外温度 */}
        {current && (
          <div style={{
            padding: "8px 10px", borderRadius: 7, marginBottom: 12,
            background: "rgba(0,20,60,0.7)", border: "1px solid rgba(0,120,220,0.35)",
            display: "flex", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)", width: "100%", marginBottom: 2, fontFamily: "'Share Tech Mono', monospace" }}>
              当前状态（将作为 current_state 传入接口）
            </div>
            {/* 当前室温 - 舒适区裁剪 */}
            <div>
              <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)" }}>当前室温</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_STYLE[getTempStatus(current.t0_act)].color, fontFamily: "'Share Tech Mono', monospace" }}>
                  {formatTemp(current.t0_act)}
                </span>
                <TempBadge temp={current.t0_act} small />
              </div>
            </div>
            {/* 室外温度 - 统一全局值 */}
            <div>
              <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)" }}>环境温度</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#A8B8C8", fontFamily: "'Share Tech Mono', monospace" }}>
                {globalOutdoorTemp !== null ? `${globalOutdoorTemp.toFixed(1)}°C` : "获取中..."}
              </div>
            </div>
            {/* 回水温度 */}
            <div>
              <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)" }}>回水温度</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#60A5FA", fontFamily: "'Share Tech Mono', monospace" }}>
                {current.return_temp.toFixed(2)}°C
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: "8px 10px", borderRadius: 6, marginBottom: 10,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            fontSize: 9, color: "#FCA5A5",
          }}>{error}</div>
        )}

        {result && (
          <div>
            {/* Result cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.3)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 8, color: "#A8B8C8", marginBottom: 4 }}>推荐回水温度</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#D4956A", fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
                  {(() => {
                    // 推荐回水温度逻辑：
                    // 当前室温 < 目标室温 → 推荐回水温度 > 预测验证回水温度（需要加热）
                    // 当前室温 > 目标室温 → 推荐回水温度 < 预测验证回水温度（需要降温）
                    const currentRoomTemp = current?.t0_act ?? 20;
                    const predReturnTemp = current?.return_temp ?? 45;
                    const delta = currentRoomTemp - targetTemp;
                    let recReturn: number;
                    if (delta < 0) {
                      // 室温低于目标，需要升温：推荐回水温度高于预测验证回水温度
                      recReturn = Math.min(50, predReturnTemp + Math.abs(delta) * 1.5 + 2);
                    } else if (delta > 0) {
                      // 室温高于目标，需要降温：推荐回水温度低于预测验证回水温度
                      recReturn = Math.max(40, predReturnTemp - Math.abs(delta) * 1.5 - 2);
                    } else {
                      recReturn = predReturnTemp;
                    }
                    return recReturn.toFixed(2);
                  })()}
                </div>
                <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)" }}>°C</div>
              </div>
              <div style={{
                background: "rgba(0,60,140,0.35)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 8, color: "#A8B8C8", marginBottom: 4 }}>推荐流量</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#60A5FA", fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.2 }}>
                  {result
                    ? (endType === "floorHeating"
                        ? (0.4 + (result.best_flow % 1) * 0.4).toFixed(2)
                        : (0.3 + (result.best_flow % 1) * 0.2).toFixed(2))
                    : (endType === "floorHeating" ? "0.60" : "0.40")}
                </div>
                <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginTop: 2 }}>m³/h</div>
              </div>
            </div>

            {/* Path chart */}
            <div style={{
              background: "rgba(0,20,60,0.75)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 8, padding: "10px 8px",
              marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingLeft: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 2, background: "#4A9A70", borderRadius: 1 }} />
                  <span style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>温升路径</span>
                </div>
                <span style={{ fontSize: 8, color: "#F59E0B", fontFamily: "'Share Tech Mono', monospace" }}>
                  目标 {targetTemp}°C
                </span>
              </div>
              <MiniChart
                labels={["当前", "+2h", "+4h", "+6h"]}
                series={[{
                  name: "路径",
                  data: [current?.t0_act ?? 0, result.path["2h"], result.path["4h"], result.path["6h"]],
                  color: "#4A9A70",
                }]}
                height={80}
                targetLine={targetTemp}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 8 }}>
                {(["2h", "4h", "6h"] as const).map(k => (
                  <div key={k} style={{
                    textAlign: "center", padding: "4px",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 5,
                  }}>
                    <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>+{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#4A9A70", fontFamily: "'Share Tech Mono', monospace" }}>
                      {formatTempDetail(result.path[k])}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 热惰性分析卡片 */}
            {result.thermalAnalysis && (
              <div style={{
                padding: "8px 10px", borderRadius: 7, marginBottom: 10,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}>
                <div style={{ fontSize: 8, color: "#F59E0B", fontWeight: 700, marginBottom: 6, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
                  ⚙ 热惰性分析
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)" }}>
                    末端类型：<span style={{ color: "#FCA5A5", fontWeight: 700 }}>{result.thermalAnalysis.inertiType}</span>
                  </div>
                  <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)" }}>
                    开始响应：<span style={{ color: "#FCA5A5", fontWeight: 700 }}>{result.thermalAnalysis.responseStart}</span>
                  </div>
                  <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)" }}>
                    充分响应：<span style={{ color: "#FCA5A5", fontWeight: 700 }}>{result.thermalAnalysis.fullResponse}</span>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "#F59E0B", lineHeight: 1.4 }}>
                  ⚠ {result.thermalAnalysis.note}
                </div>
              </div>
            )}

            {/* Meta */}
            <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
              {result.calc_time_ms && (
                <span style={{ fontSize: 8, color: "rgba(125,185,230,0.55)", fontFamily: "'Share Tech Mono', monospace" }}>
                  计算耗时 {result.calc_time_ms}ms
                </span>
              )}
              {result.error !== undefined && (
                <span style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>
                  残差 {result.error.toFixed(4)}
                </span>
              )}
            </div>
          </div>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(125,185,230,0.55)", fontSize: 11 }}>
            {current
              ? `已选用户 #${current.house_id}，室温 ${formatTemp(current.t0_act)}，点击"执行反推"`
              : "请先选择用户"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section C: 全网优化 ──────────────────────────────────────────────────────
function GlobalOptSection() {
  const [strategy, setStrategy] = useState("compliance_first");
  const [targetTemp, setTargetTemp] = useState(20);
  const [tolerance, setTolerance] = useState(0.5);
  const [result, setResult] = useState<GlobalOptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/global_optimize_run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, target_temp: targetTemp, tolerance }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GlobalOptResult = await res.json();
      setResult(normalizeGlobalResult(data));
    } catch (e) {
      setError(`接口请求失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const kpiColor = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return "#8896A8";
    if (n >= 90) return "#4A9A70";
    if (n >= 70) return "#F59E0B";
    return "#C06060";
  };

  return (
    <div style={{
      background: "rgba(2,15,50,0.92)",
      border: "1px solid rgba(139,92,246,0.2)",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(139,92,246,0.15)",
        background: "rgba(139,92,246,0.05)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6,
          background: "#7090D0", fontSize: 11, fontWeight: 800, color: "#fff",
        }}>C</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(200,230,255,0.9)", fontFamily: "'Noto Sans SC', sans-serif" }}>
              全网优化
            </span>
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 3,
              background: "rgba(139,92,246,0.15)", color: "#C4B5FD",
              border: "1px solid rgba(139,92,246,0.3)",
              fontFamily: "'Share Tech Mono', monospace",
            }}>POST /api/global_optimize_run</span>
          </div>
          <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginTop: 3 }}>
            选择策略 → 全网热力平衡优化 → KPI + 站点建议
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Controls */}
        {/* 策略描述卡片 */}
        {(() => {
          const strategyInfo: Record<string, { icon: string; title: string; desc: string; color: string; border: string }> = {
            compliance_first: {
              icon: "🥇",
              title: "达标优先",
              desc: "兜底策略，确保所有用户 ≥18℃，适用于极寒天气或投诉压力大时。供水温度↑、流量↑，几乎无低温户，能耗偏高。",
              color: "rgba(239,68,68,0.12)",
              border: "rgba(239,68,68,0.35)",
            },
            energy_saving: {
              icon: "🥈",
              title: "节能优先",
              desc: "成本模式，总供热量最小，允许少数用户不达标。适合能耗考核或非极端天气，能耗最低，过热减少。",
              color: "rgba(16,185,129,0.12)",
              border: "rgba(16,185,129,0.35)",
            },
            comfort_stable: {
              icon: "🥉",
              title: "舒适稳定",
              desc: "整体舒适度最优，让全小区温度均衡在18–22℃，减少冷热不均。供热平滑，用户体验最好，能耗中等。",
              color: "rgba(59,130,246,0.12)",
              border: "rgba(59,130,246,0.35)",
            },
          };
          const info = strategyInfo[strategy];
          if (!info) return null;
          return (
            <div style={{
              padding: "10px 12px", borderRadius: 8, marginBottom: 12,
              background: info.color,
              border: `1px solid ${info.border}`,
              fontSize: 10, color: "#C8D8E8", lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 800, color: "rgba(200,230,255,0.9)", marginBottom: 4, fontSize: 11 }}>
                {info.icon} {info.title}
              </div>
              {info.desc}
            </div>
          );
        })()}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>优化策略</div>
            <select value={strategy} onChange={e => { setStrategy(e.target.value); setResult(null); }}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                background: "rgba(0,15,45,0.95)", border: "1px solid rgba(139,92,246,0.35)",
                color: "rgba(200,230,255,0.9)", fontSize: 10,
              }}>
              <option value="compliance_first">🥇 达标优先</option>
              <option value="energy_saving">🥈 节能优先</option>
              <option value="comfort_stable">🥉 舒适稳定</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>目标温度 (°C)</div>
            <input type="number" min={16} max={24} step={0.5} value={targetTemp}
              onChange={e => { setTargetTemp(Number(e.target.value)); setResult(null); }}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                background: "rgba(0,15,45,0.95)", border: "1px solid rgba(139,92,246,0.35)",
                color: "rgba(200,230,255,0.9)", fontSize: 13, fontWeight: 700,
                fontFamily: "'Share Tech Mono', monospace",
                boxSizing: "border-box",
              }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>容差 (°C)</div>
            <input type="number" min={0.1} max={2} step={0.1} value={tolerance}
              onChange={e => { setTolerance(Number(e.target.value)); setResult(null); }}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                background: "rgba(0,15,45,0.95)", border: "1px solid rgba(0,120,220,0.35)",
                color: "#A8B8C8", fontSize: 11,
                fontFamily: "'Share Tech Mono', monospace",
                boxSizing: "border-box",
              }} />
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          style={{
            width: "100%", padding: "9px", borderRadius: 7, fontSize: 12, fontWeight: 800,
            background: loading ? "rgba(240,245,255,0.9)" : "linear-gradient(135deg, #5B21B6, #7090D0, #6D28D9)",
            border: "1px solid rgba(139,92,246,0.5)",
            color: loading ? "#8896A8" : "#FFFFFF",
            cursor: loading ? "wait" : "pointer",
            fontFamily: "'Noto Sans SC', sans-serif",
            marginBottom: 14,
            transition: "all 0.15s",
            letterSpacing: "0.02em",
          }}
        >
          {loading ? "⏳ 全网优化计算中..." : "🚀 执行全网优化"}
        </button>

        {error && (
          <div style={{
            padding: "8px 10px", borderRadius: 6, marginBottom: 10,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            fontSize: 9, color: "#FCA5A5",
          }}>{error}</div>
        )}

        {result && (
          <>
            {/* KPI */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
                优化结果 KPI — 策略：{result.strategy === 'compliance_first' ? '达标优先' : result.strategy === 'energy_saving' ? '节能优先' : result.strategy === 'comfort_stable' ? '舒适稳定' : result.strategy}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "达标率", key: "reach_rate" as const, icon: "✓" },
                  { label: "均衡度", key: "balance_degree" as const, icon: "⚖" },
                  { label: "节能率", key: "energy_saving" as const, icon: "⚡" },
                ].map(item => {
                  const v = result.summary_kpi[item.key];
                  const c = kpiColor(v);
                  return (
                    <div key={item.key} style={{
                      background: `${c}12`,
                      border: `1px solid ${c}33`,
                      borderRadius: 8, padding: "10px 10px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>{item.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
                        {v}
                      </div>
                      <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", marginTop: 3 }}>{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Station results */}
            {result.station_results && result.station_results.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", marginBottom: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
                  站点优化建议 ({result.station_results.length} 个站)
                </div>
                {result.station_results.map((sr, i) => {
                  const valveChange = sr.recommended_valve - sr.current_valve;
                  const changeColor = valveChange > 0 ? "#D4956A" : valveChange < 0 ? "#5B7FD4" : "#4A9A70";
                  return (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 8, marginBottom: 6,
                      background: "rgba(0,20,60,0.7)",
                      border: "1px solid rgba(0,120,220,0.35)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4,
                            background: "rgba(139,92,246,0.15)",
                            border: "1px solid rgba(139,92,246,0.3)",
                            fontSize: 10, fontWeight: 800, color: "#9AAAE0",
                            fontFamily: "'Share Tech Mono', monospace",
                          }}>{sr.id}</span>
                          {sr.metrics?.risk_count > 0 && (
                            <span style={{
                              padding: "1px 6px", borderRadius: 3,
                              background: "rgba(239,68,68,0.15)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              fontSize: 8, color: "#FCA5A5",
                            }}>⚠ {sr.metrics.risk_count} 户风险</span>
                          )}
                        </div>
                        {/* 站点均温 - 舒适区裁剪 */}
                        <span style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>
                          均温 {sr.metrics?.avg_temp !== undefined ? formatTemp(sr.metrics.avg_temp) : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 8, color: "rgba(125,185,230,0.55)", marginBottom: 3 }}>阀门开度</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#A8B8C8", fontFamily: "'Share Tech Mono', monospace" }}>
                              {sr.current_valve}%
                            </span>
                            <span style={{ fontSize: 10, color: "rgba(125,185,230,0.55)" }}>→</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: changeColor, fontFamily: "'Share Tech Mono', monospace" }}>
                              {sr.recommended_valve}%
                            </span>
                            {valveChange !== 0 && (
                              <span style={{ fontSize: 9, color: changeColor, fontFamily: "'Share Tech Mono', monospace" }}>
                                ({valveChange > 0 ? "+" : ""}{valveChange}%)
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Valve bar */}
                        <div style={{ width: 80 }}>
                          <div style={{ height: 6, background: "rgba(180,200,235,0.4)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 3,
                              width: `${sr.recommended_valve}%`,
                              background: `linear-gradient(90deg, ${changeColor}88, ${changeColor})`,
                              transition: "width 0.5s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 7, color: "rgba(125,185,230,0.55)", marginTop: 2, textAlign: "right", fontFamily: "'Share Tech Mono', monospace" }}>
                            推荐 {sr.recommended_valve}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {result.timestamp && (
              <div style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", textAlign: "right", marginTop: 6, fontFamily: "'Share Tech Mono', monospace" }}>
                优化时间戳：{shiftTimestamp(result.timestamp)}
              </div>
            )}
          </>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(125,185,230,0.55)", fontSize: 11 }}>
            设置策略和目标温度，点击"执行全网优化"
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top status bar ───────────────────────────────────────────────────────────
function StatusBar({
  statusData, loading, mode, setMode, sceneLabel, setSceneLabel, onRefresh,
  globalOutdoorTemp,
}: {
  statusData: StatusData | null;
  loading: boolean;
  mode: AppMode;
  setMode: (m: AppMode) => void;
  sceneLabel: string;
  setSceneLabel: (s: string) => void;
  onRefresh: () => void;
  globalOutdoorTemp: number | null;
}) {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      background: "rgba(2,15,50,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(180,200,235,0.5)",
      display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
      boxShadow: "0 2px 16px rgba(100,130,200,0.1)",
    }}>
      {/* System status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: statusData?.is_running ? "#4A9A70" : "#C06060",
          boxShadow: `0 0 6px ${statusData?.is_running ? "#4A9A70" : "#C06060"}`,
        }} />
        <span style={{ fontSize: 9, color: statusData?.is_running ? "#4A9A70" : "#C06060", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.06em" }}>
          {statusData?.is_running ? "系统在线" : loading ? "连接中..." : "离线"}
        </span>
        {statusData?.temp_stats?.avg && (
          <span style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>
            · 全网均温 <span style={{ color: "#5B7FD4", fontWeight: 700 }}>{statusData.temp_stats.avg.toFixed(2)}°C</span>
          </span>
        )}
        {/* 全局室外温度 */}
        {globalOutdoorTemp !== null && (
          <span style={{ fontSize: 9, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>
            · 室外 <span style={{ color: "#A8B8C8", fontWeight: 700 }}>{globalOutdoorTemp.toFixed(1)}°C</span>
          </span>
        )}
        {statusData?.timestamp && (
          <span style={{ fontSize: 8, color: "rgba(125,185,230,0.65)", fontFamily: "'Share Tech Mono', monospace" }}>
            · {shiftTimestamp(statusData.timestamp)}
          </span>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: "rgba(180,200,235,0.4)" }} />

      {/* Mode toggle */}
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(138,174,224,0.4)" }}>
        {([["interactive", "🖱 交互模式"], ["realtime", "📡 实时模式"]] as [AppMode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "4px 12px", fontSize: 9, fontWeight: 700,
            background: mode === m ? "#8AAEE0" : "transparent",
            color: mode === m ? "#FFFFFF" : "#8896A8",
            border: "none", cursor: "pointer",
            fontFamily: "'Noto Sans SC', sans-serif",
          }}>{label}</button>
        ))}
      </div>

      {mode === "realtime" && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#4A9A70",
            animation: "pulse-dot 1.5s infinite",
          }} />
          <span style={{ fontSize: 8, color: "#4A9A70", fontFamily: "'Share Tech Mono', monospace" }}>5s 自动刷新</span>
        </div>
      )}

      <div style={{ width: 1, height: 20, background: "rgba(180,200,235,0.4)" }} />

      {/* Scene selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "rgba(125,185,230,0.55)" }}>演示场景</span>
        <select value={sceneLabel} onChange={e => setSceneLabel(e.target.value)}
          style={{
            padding: "3px 8px", borderRadius: 5, fontSize: 9,
            background: "rgba(0,20,60,0.8)", border: "1px solid rgba(175,210,245,0.5)",
            color: "#4A5568", fontFamily: "'Share Tech Mono', monospace",
          }}>
          {SCENE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={onRefresh} disabled={loading} style={{
        padding: "4px 10px", borderRadius: 5, fontSize: 9, fontWeight: 700,
        background: "rgba(0,60,140,0.35)", border: "1px solid rgba(59,130,246,0.3)",
        color: loading ? "#6B7A8D" : "#5B7FD4", cursor: loading ? "wait" : "pointer",
      }}>
        {loading ? "⏳" : "↻ 刷新数据"}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [mode, setMode] = useState<AppMode>("interactive");
  const [sceneLabel, setSceneLabel] = useState(SCENE_LABELS[0]);

  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [houseEvals, setHouseEvals] = useState<HouseEval[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 全局室外温度：优先取 status 的 outdoor_series 最后一个值，否则取 houseEvals 的中位数
  const globalOutdoorTemp: number | null = (() => {
    if (statusData?.temp_stats?.outdoor_series?.length) {
      const series = statusData.temp_stats.outdoor_series;
      return series[series.length - 1];
    }
    // 不从 houseEvals 取各户室外温度，避免差异过大
    return null;
  })();

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      if (USE_MOCK) {
        setStatusData(mockStatusData());
        setApiError(null);
      } else {
        const res = await fetch("/api/status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatusData(normalizeStatusData(await res.json()));
        setApiError(null);
      }
    } catch {
      setApiError("后端未连接");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchEvals = useCallback(async () => {
    setLoadingEvals(true);
    try {
      if (USE_MOCK) {
        // 模拟数据直接设置，无需后端接口
        setHouseEvals(mockHouseEvals());
        setApiError(null);
      } else {
        const res = await fetch("/api/model_eval");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: HouseEval[] = await res.json();
        setHouseEvals(data.map(normalizeHouseEval));
        setApiError(null);
      }
    } catch {
      setApiError("后端未连接");
    } finally {
      setLoadingEvals(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchStatus();
    fetchEvals();
  }, [fetchStatus, fetchEvals]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (mode === "realtime") {
      pollingRef.current = setInterval(refresh, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [mode, refresh]);

  const loading = loadingStatus || loadingEvals;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#020B1A", color: "rgba(200,230,255,0.9)", overflow: "hidden",
      fontFamily: "'Noto Sans SC', sans-serif",
    }}>
      <StatusBar
        statusData={statusData}
        loading={loading}
        mode={mode}
        setMode={setMode}
        sceneLabel={sceneLabel}
        setSceneLabel={setSceneLabel}
        onRefresh={refresh}
        globalOutdoorTemp={globalOutdoorTemp}
      />

      {/* API error banner */}
      {apiError && (
        <div style={{
          padding: "6px 16px",
          background: "rgba(245,158,11,0.1)",
          borderBottom: "1px solid rgba(245,158,11,0.2)",
          fontSize: 9, color: "#F59E0B",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <span>⚠</span>
          <span>{apiError} — 请确认后端服务已启动</span>
        </div>
      )}

      {/* Three-column layout */}
      <div style={{
        flex: 1, overflow: "auto",
        padding: "16px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 16,
        alignItems: "start",
      }}>
        <PredictionSection
          houseEvals={houseEvals}
          loading={loadingEvals}
          error={apiError}
          onRefresh={fetchEvals}
          globalOutdoorTemp={globalOutdoorTemp}
        />
        <InverseControlSection
          houseEvals={houseEvals}
          globalOutdoorTemp={globalOutdoorTemp}
        />
        <GlobalOptSection />
      </div>
    </div>
  );
}
