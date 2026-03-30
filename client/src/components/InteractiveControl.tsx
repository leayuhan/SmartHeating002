/**
 * InteractiveControl.tsx  v3.0
 * 模式C：自由操控系统（全功能重构版）
 * ─────────────────────────────────────────────
 * 核心功能：
 * 1. 三换热站参数手动调节（供水温度/流量/压差）→ 系统图高亮 + 楼栋室温联动
 * 2. 楼阀/户阀开关控制 → 系统图阀门图标切换 + 温度联动
 * 3. 故障模拟（低温/压力异常）→ 触发AI诊断全链路流程
 * 4. 操作指引面板
 * 5. 所有操作即时视觉+数据双重反馈
 */
import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StationParams {
  id: string;
  name: string;
  supplyTemp: number;
  returnTemp: number;
  flow: number;
  pressure: number;
  valveOpen: boolean;
}

export interface BuildingValveState {
  buildingId: string;
  buildingName: string;
  valveOpen: boolean;
  unitValves: Record<string, boolean>; // unitId -> open
}

export interface FaultScenario {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  targetBuilding?: string;
  targetStation?: string;
}

interface InteractiveControlProps {
  isActive: boolean;
  onClose: () => void;
  onTargetTempChange?: (temp: number) => void;
  onStrategyChange?: (strategy: string) => void;
  onFaultSimulate?: (fault: string, buildingId?: string) => void;
  // 新增回调
  onStationParamChange?: (stationId: string, params: Partial<StationParams>) => void;
  onBuildingValveChange?: (buildingId: string, open: boolean) => void;
  onFaultAIDiagnosis?: (fault: FaultScenario) => void;
  onHighlightStation?: (stationId: string | null) => void;
  onHighlightBuilding?: (buildingId: string | null) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_STATIONS: StationParams[] = [
  { id: "S1", name: "换热站A", supplyTemp: 48, returnTemp: 38, flow: 105, pressure: 0.28, valveOpen: true },
  { id: "S2", name: "换热站B", supplyTemp: 46, returnTemp: 36, flow: 100, pressure: 0.25, valveOpen: true },
  { id: "S3", name: "换热站C", supplyTemp: 47, returnTemp: 37, flow: 102, pressure: 0.27, valveOpen: true },
];

const BUILDINGS_BY_STATION: Record<string, { id: string; name: string }[]> = {
  S1: [
    { id: "1", name: "1号楼" }, { id: "2", name: "2号楼" },
    { id: "3", name: "3号楼" }, { id: "4", name: "4号楼" },
    { id: "5", name: "5号楼" }, { id: "6", name: "6号楼" },
  ],
  S2: [
    { id: "7", name: "7号楼" }, { id: "8", name: "8号楼" },
    { id: "9", name: "6号楼" }, { id: "10", name: "10号楼" },
    { id: "11", name: "11号楼" }, { id: "12", name: "12号楼" },
  ],
  S3: [
    { id: "13", name: "13号楼" }, { id: "14", name: "14号楼" },
    { id: "15", name: "15号楼" }, { id: "16", name: "16号楼" },
    { id: "17", name: "17号楼" }, { id: "18", name: "18号楼" },
  ],
};

const FAULT_SCENARIOS: FaultScenario[] = [
  {
    id: "low-temp-9",
    name: "6号楼低温异常",
    icon: "🥶",
    desc: "模拟6号楼室温骤降至14.5°C，触发AI诊断全流程",
    color: "#3b82f6",
    targetBuilding: "9",
    targetStation: "S2",
  },
  {
    id: "pressure-fault",
    name: "管网压力异常",
    icon: "⚡",
    desc: "模拟换热站B管网压差异常（0.25→0.12 MPa），触发AI预警",
    color: "#f59e0b",
    targetStation: "S2",
  },
  {
    id: "pump-fail",
    name: "循环泵故障",
    icon: "⚠️",
    desc: "模拟换热站C循环泵停机，全网流量骤降",
    color: "#a78bfa",
    targetStation: "S3",
  },
  {
    id: "restore",
    name: "恢复正常",
    icon: "✅",
    desc: "清除所有故障，恢复正常运行参数",
    color: "#10b981",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: "0.02em" }}>{title}</span>
    </div>
  );
}

function ParamSlider({
  label, value, min, max, step, unit, color, onChange, onFocus, onBlur,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; color: string;
  onChange: (v: number) => void;
  onFocus?: () => void; onBlur?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 9.5, color: "rgba(148,210,255,0.6)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "'Share Tech Mono', monospace" }}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(0,40,100,0.5)" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${pct}%`, borderRadius: 3,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 6px ${color}66`,
          transition: "width 0.2s ease",
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onFocus={onFocus} onBlur={onBlur}
          style={{
            position: "absolute", top: -4, left: 0, width: "100%", height: 14,
            opacity: 0, cursor: "pointer",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 7.5, color: "rgba(100,150,200,0.4)" }}>{min}{unit}</span>
        <span style={{ fontSize: 7.5, color: "rgba(100,150,200,0.4)" }}>{max}{unit}</span>
      </div>
    </div>
  );
}

function ValveToggle({
  label, open, onChange, color = "#00d4ff",
}: {
  label: string; open: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <button
      onClick={() => onChange(!open)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px", borderRadius: 7, width: "100%",
        border: `1px solid ${open ? color + "60" : "rgba(239,68,68,0.4)"}`,
        background: open ? `${color}0D` : "rgba(239,68,68,0.08)",
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: open ? color : "#ef4444",
          boxShadow: `0 0 6px ${open ? color : "#ef4444"}`,
          animation: !open ? "blink 1s infinite" : "none",
        }} />
        <span style={{ fontSize: 10, color: open ? "rgba(200,230,255,0.8)" : "#ef4444" }}>{label}</span>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace",
        color: open ? color : "#ef4444",
        padding: "1px 6px", borderRadius: 3,
        border: `1px solid ${open ? color + "44" : "rgba(239,68,68,0.3)"}`,
        background: open ? `${color}15` : "rgba(239,68,68,0.1)",
      }}>
        {open ? "开" : "关"}
      </span>
    </button>
  );
}

function FeedbackBadge({ text, color }: { text: string; color: string }) {
  return (
    <div style={{
      padding: "4px 10px", borderRadius: 5,
      background: `${color}15`, border: `1px solid ${color}44`,
      fontSize: 9.5, color, fontFamily: "'Share Tech Mono', monospace",
      animation: "flow-in 0.3s ease",
    }}>
      {text}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InteractiveControl({
  isActive,
  onClose,
  onTargetTempChange,
  onStrategyChange,
  onFaultSimulate,
  onStationParamChange,
  onBuildingValveChange,
  onFaultAIDiagnosis,
  onHighlightStation,
  onHighlightBuilding,
}: InteractiveControlProps) {
  const [activeSection, setActiveSection] = useState<"guide" | "station" | "valve" | "fault" | "strategy">("guide");
  const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
  const [strategyPhase, setStrategyPhase] = useState<"idle" | "highlight" | "ai" | "params" | "temp" | "done">("idle");
  const strategyTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [stations, setStations] = useState<StationParams[]>(INITIAL_STATIONS);
  const [selectedStation, setSelectedStation] = useState<string>("S2");
  const [buildingValves, setBuildingValves] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    Object.values(BUILDINGS_BY_STATION).flat().forEach(b => { init[b.id] = true; });
    return init;
  });
  const [activeFault, setActiveFault] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Array<{ id: number; text: string; color: string }>>([]);
  const [diagnosisLog, setDiagnosisLog] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const feedbackIdRef = useRef(0);
  const diagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addFeedback = useCallback((text: string, color = "#00d4ff") => {
    const id = ++feedbackIdRef.current;
    setFeedbacks(prev => [{ id, text, color }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    }, 4000);
  }, []);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDiagnosisLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 14)]);
  }, []);

  // 换热站参数调节
  const handleStationParam = useCallback((stationId: string, key: keyof StationParams, value: number | boolean) => {
    setStations(prev => prev.map(s => s.id === stationId ? { ...s, [key]: value } : s));
    onStationParamChange?.(stationId, { [key]: value });
    onHighlightStation?.(stationId);

    const station = stations.find(s => s.id === stationId);
    const stationName = station?.name ?? stationId;

    if (key === "supplyTemp") {
      addFeedback(`${stationName} 供水温度 → ${(value as number).toFixed(1)}°C`, "#f97316");
      addLog(`调节 ${stationName} 供水温度: ${(value as number).toFixed(1)}°C`);
    } else if (key === "flow") {
      addFeedback(`${stationName} 循环流量 → ${(value as number).toFixed(0)} t/h`, "#00d4ff");
      addLog(`调节 ${stationName} 循环流量: ${(value as number).toFixed(0)} t/h`);
    } else if (key === "pressure") {
      addFeedback(`${stationName} 管网压差 → ${(value as number).toFixed(2)} MPa`, "#a78bfa");
      addLog(`调节 ${stationName} 管网压差: ${(value as number).toFixed(2)} MPa`);
    }

    // 联动楼栋室温变化（供水温度影响最大）
    if (key === "supplyTemp") {
      const delta = (value as number) - (station?.supplyTemp ?? 46);
      const buildings = BUILDINGS_BY_STATION[stationId] ?? [];
      buildings.forEach(b => {
        const tempDelta = delta * 0.12; // 供温每升1°C，室温约升0.12°C
        if (Math.abs(tempDelta) > 0.05) {
          addLog(`  → ${b.name} 室温预计变化 ${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}°C`);
        }
      });
    }

    setTimeout(() => onHighlightStation?.(null), 3000);
  }, [stations, onStationParamChange, onHighlightStation, addFeedback, addLog]);

  // 楼阀开关控制
  const handleBuildingValve = useCallback((buildingId: string, open: boolean) => {
    setBuildingValves(prev => ({ ...prev, [buildingId]: open }));
    onBuildingValveChange?.(buildingId, open);
    onHighlightBuilding?.(buildingId);

    const bldgName = Object.values(BUILDINGS_BY_STATION).flat().find(b => b.id === buildingId)?.name ?? `${buildingId}号楼`;
    addFeedback(`${bldgName} 楼阀 ${open ? "开启" : "关闭"}`, open ? "#10b981" : "#ef4444");
    addLog(`${open ? "开启" : "关闭"} ${bldgName} 楼阀`);

    if (!open) {
      // 完整链条：阀门关闭→温度逐步下降→AI报警→系统图闪烁
      addLog(`  🔴 阀门关闭动画触发，供热中断`);
      onFaultSimulate?.("close-valve", buildingId);

      // 1s后：室温开始下降
      setTimeout(() => {
        addLog(`  🌡️ ${bldgName} 室温 21.0°C → 19.5°C（-1.5°C）`);
        addFeedback(`${bldgName} 室温下降中...`, "#fbbf24");
      }, 1000);

      // 2.5s：室温继续下降
      setTimeout(() => {
        addLog(`  🌡️ ${bldgName} 室温 19.5°C → 17.8°C（持续下降）`);
      }, 2500);

      // 4s：触发AI报警
      setTimeout(() => {
        addLog(`  🚨 AI报警：${bldgName}室温低于预警阈値 18°C，已触发局部供热异常告警`);
        addFeedback(`⚠️ ${bldgName} 低温报警！`, "#ef4444");
        onFaultAIDiagnosis?.({
          id: "close-valve-" + buildingId,
          name: `${bldgName}楼阀关闭低温`,
          icon: "🚨",
          desc: `${bldgName}楼阀关闭，室温连续下降至 17.8°C`,
          color: "#ef4444",
          targetBuilding: buildingId,
        });
        // 系统图闪烁效果：重新高亮楼栋
        onHighlightBuilding?.(buildingId);
      }, 4000);

      // 5.5s：开始AI诊断日志
      setTimeout(() => {
        addLog(`  🧠 AI诊断启动：分析${bldgName}供热中断原因...`);
      }, 5500);

      // 7s：诊断结果
      setTimeout(() => {
        addLog(`  📋 诊断结果：${bldgName}楼阀手动关闭，建议立即开启楼阀恢复供热`);
        addFeedback(`请开启 ${bldgName} 楼阀`, "#f97316");
        setTimeout(() => onHighlightBuilding?.(null), 2000);
      }, 7000);

    } else {
      addLog(`  ✅ ${bldgName} 供热恢复，室温将逐步回升`);
      // 恢复后温度回升动画
      setTimeout(() => {
        addLog(`  🌡️ ${bldgName} 室温回升中... 17.8°C → 19.2°C`);
        addFeedback(`${bldgName} 室温回升中`, "#10b981");
      }, 1500);
      setTimeout(() => {
        addLog(`  🌡️ ${bldgName} 室温 19.2°C → 21.0°C，恢复正常`);
        setTimeout(() => onHighlightBuilding?.(null), 1000);
      }, 4000);
    }
  }, [onBuildingValveChange, onHighlightBuilding, addFeedback, addLog, onFaultSimulate, onFaultAIDiagnosis]);

  // 故障模拟 + AI诊断触发
  const handleFault = useCallback((fault: FaultScenario) => {
    if (fault.id === "restore") {
      setActiveFault(null);
      setIsDiagnosing(false);
      setStations(INITIAL_STATIONS.map(s => ({ ...s })));
      setBuildingValves(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { next[k] = true; });
        return next;
      });
      addFeedback("✅ 系统已恢复正常", "#10b981");
      addLog("系统恢复正常，所有参数重置");
      onFaultSimulate?.("restore");
      return;
    }

    setActiveFault(fault.id);
    addFeedback(`⚠️ 触发故障: ${fault.name}`, fault.color);
    addLog(`触发故障场景: ${fault.name}`);
    onFaultSimulate?.(fault.id, fault.targetBuilding);
    onFaultAIDiagnosis?.(fault);

    if (fault.targetStation) {
      onHighlightStation?.(fault.targetStation);
    }
    if (fault.targetBuilding) {
      onHighlightBuilding?.(fault.targetBuilding);
    }

    // 模拟AI诊断流程
    setIsDiagnosing(true);
    setActiveSection("fault");

    const steps = fault.id === "low-temp-9" ? [
      { delay: 500,  msg: "🔍 AI感知模块检测到6号楼室温异常: 14.5°C" },
      { delay: 1500, msg: "📊 调取6号楼历史温度曲线，比对正常基线..." },
      { delay: 3000, msg: "🧠 AI诊断: 换热站B供水温度偏低，6号楼入户阀门开度不足" },
      { delay: 4500, msg: "📋 生成调控方案: 换热站B供温 46→48°C，6号楼阀门开度→85%" },
      { delay: 6000, msg: "⚙️ 执行调控: 换热站B参数已更新" },
      { delay: 7500, msg: "✅ 调控完成，预计6号楼室温30分钟内恢复至21°C+" },
    ] : fault.id === "pressure-fault" ? [
      { delay: 500,  msg: "⚡ 检测到换热站B管网压差异常: 0.25→0.12 MPa" },
      { delay: 1800, msg: "🔍 排查管网压力传感器数据，分析压降原因..." },
      { delay: 3200, msg: "🧠 AI诊断: 疑似管网局部泄漏或阀门故障" },
      { delay: 4800, msg: "📋 建议: 降低换热站B循环流量，减少管网压力损失" },
      { delay: 6200, msg: "⚙️ 已自动调节换热站B流量: 100→85 t/h" },
      { delay: 7800, msg: "✅ 压力趋于稳定，建议现场检查管网阀门状态" },
    ] : [
      { delay: 500,  msg: "⚠️ 检测到换热站C循环泵停机告警" },
      { delay: 1500, msg: "🔍 切换备用泵，检查主泵电气状态..." },
      { delay: 3000, msg: "🧠 AI诊断: 主泵电机过热保护触发，已自动切换备用泵" },
      { delay: 4500, msg: "📋 换热站A/B流量上调补偿，维持全网热量平衡" },
      { delay: 6000, msg: "✅ 备用泵运行正常，建议尽快检修主泵" },
    ];

    steps.forEach(({ delay, msg }) => {
      diagTimerRef.current = setTimeout(() => {
        addLog(msg);
        if (msg.startsWith("✅")) {
          setIsDiagnosing(false);
          onHighlightStation?.(null);
          onHighlightBuilding?.(null);
        }
      }, delay);
    });

    // 故障模拟时更新换热站参数
    if (fault.id === "pressure-fault") {
      setTimeout(() => {
        setStations(prev => prev.map(s =>
          s.id === "S2" ? { ...s, pressure: 0.12, flow: 85 } : s
        ));
        onStationParamChange?.("S2", { pressure: 0.12, flow: 85 });
      }, 6200);
    } else if (fault.id === "pump-fail") {
      setTimeout(() => {
        setStations(prev => prev.map(s =>
          s.id === "S3" ? { ...s, flow: 30 } : s
        ));
        onStationParamChange?.("S3", { flow: 30 });
      }, 3000);
    }
  }, [onFaultSimulate, onFaultAIDiagnosis, onHighlightStation, onHighlightBuilding, onStationParamChange, addFeedback, addLog]);

  useEffect(() => {
    return () => {
      if (diagTimerRef.current) clearTimeout(diagTimerRef.current);
    };
  }, []);

  // ── 策略定义（必须在所有Hook之前，不能放在if(!isActive)之后） ──
  const STRATEGIES = [
    {
      id: "eco",
      name: "节能模式",
      icon: "🌱",
      desc: "三站供温下调2°C，降低热源消耗，适合天气回暖时段",
      color: "#10b981",
      steps: [
        { delay: 0,    msg: "🎯 切换至节能模式，开始三站参数优化...", phase: "highlight" as const },
        { delay: 800,  msg: "🧠 AI计算最优节能参数组合...", phase: "ai" as const },
        { delay: 2000, msg: "⚙️ 换热站A供温 46°C → 44°C（-2°C）", phase: "params" as const },
        { delay: 2800, msg: "⚙️ 换热站B供温 47°C → 45°C（-2°C）" },
        { delay: 3600, msg: "⚙️ 换热站C供温 45°C → 43°C（-2°C）" },
        { delay: 4800, msg: "🌡️ 全区楼栋室温预计降低 0.8°C（18-24h内）", phase: "temp" as const },
        { delay: 6000, msg: "✅ 节能模式已生效，预计节省热源消耗 8%", phase: "done" as const },
      ],
      paramChanges: { supplyTempDelta: -2 },
      stations: ["S1", "S2", "S3"],
    },
    {
      id: "comfort",
      name: "舒适模式",
      icon: "🏠",
      desc: "三站供温上调3°C，提升室内热舒适度，适合寒冷天气",
      color: "#f97316",
      steps: [
        { delay: 0,    msg: "🎯 切换至舒适模式，提升全区供热参数...", phase: "highlight" as const },
        { delay: 800,  msg: "🧠 AI评估当前热负荷余量，确认可提升供温...", phase: "ai" as const },
        { delay: 2000, msg: "⚙️ 换热站A供温 46°C → 49°C（+3°C）", phase: "params" as const },
        { delay: 2800, msg: "⚙️ 换热站B供温 47°C → 50°C（+3°C）" },
        { delay: 3600, msg: "⚙️ 换热站C供温 45°C → 48°C（+3°C）" },
        { delay: 4800, msg: "🌡️ 全区楼栋室温预计提升 1.2°C（6-12h内）", phase: "temp" as const },
        { delay: 6000, msg: "✅ 舒适模式已生效，全区供热能力提升 12%", phase: "done" as const },
      ],
      paramChanges: { supplyTempDelta: +3 },
      stations: ["S1", "S2", "S3"],
    },
    {
      id: "emergency",
      name: "应急模式",
      icon: "🚨",
      desc: "针对低温异常区域（换热站B/6号楼）紧急提升供热参数",
      color: "#ef4444",
      steps: [
        { delay: 0,    msg: "🚨 触发应急模式，针对换热站B区域紧急响应...", phase: "highlight" as const },
        { delay: 800,  msg: "🧠 AI定位低温异常：6号楼室温 14.5°C，低于阈值 18°C", phase: "ai" as const },
        { delay: 2200, msg: "⚙️ 换热站B供温 47°C → 52°C（+5°C，紧急提升）", phase: "params" as const },
        { delay: 3200, msg: "⚙️ 换热站B循环流量 100 → 115 t/h（+15%）" },
        { delay: 4200, msg: "⚙️ 6号楼入户阀开度 → 90%（最大开度）" },
        { delay: 5500, msg: "🌡️ 6号楼室温预计 30min内从 14.5°C 回升至 19°C+", phase: "temp" as const },
        { delay: 7000, msg: "✅ 应急调控已下发，换热站B正在执行参数变更", phase: "done" as const },
      ],
      paramChanges: { supplyTempDelta: +5, flowDelta: +15 },
      stations: ["S2"],
    },
  ];

  const handleStrategy = useCallback((strategy: typeof STRATEGIES[0]) => {
    // 清除之前的定时器
    strategyTimerRefs.current.forEach(t => clearTimeout(t));
    strategyTimerRefs.current = [];

    setActiveStrategy(strategy.id);
    setStrategyPhase("idle");
    setDiagnosisLog([]);
    setActiveSection("strategy");

    strategy.steps.forEach(({ delay, msg, phase }) => {
      const t = setTimeout(() => {
        addLog(msg);
        if (phase) setStrategyPhase(phase);

        // 高亮对应换热站
        if (phase === "highlight") {
          strategy.stations.forEach((sid, i) => {
            const t2 = setTimeout(() => {
              onHighlightStation?.(sid);
              setTimeout(() => onHighlightStation?.(null), 1500);
            }, i * 400);
            strategyTimerRefs.current.push(t2);
          });
        }

        // 参数变化：更新换热站state
        if (phase === "params") {
          setStations(prev => prev.map(s => {
            if (!strategy.stations.includes(s.id)) return s;
            const newSupply = Math.max(38, Math.min(65,
              s.supplyTemp + (strategy.paramChanges.supplyTempDelta ?? 0)
            ));
            const newFlow = strategy.paramChanges.flowDelta
              ? Math.max(60, Math.min(150, s.flow + strategy.paramChanges.flowDelta))
              : s.flow;
            onStationParamChange?.(s.id, { supplyTemp: newSupply, flow: newFlow });
            return { ...s, supplyTemp: newSupply, flow: newFlow };
          }));
          addFeedback(`${strategy.name} 参数下发中...`, strategy.color);
        }

        // 完成
        if (phase === "done") {
          addFeedback(`✅ ${strategy.name} 已生效`, "#10b981");
          onHighlightStation?.(null);
          onHighlightBuilding?.(null);
        }
      }, delay);
      strategyTimerRefs.current.push(t);
    });
  }, [addFeedback, addLog, onHighlightStation, onHighlightBuilding, onStationParamChange]);  // eslint-disable-line

  // 所有Hook定义完毕后，才可以做条件返回
  if (!isActive) return null;

  const currentStation = stations.find(s => s.id === selectedStation) ?? stations[0];
  const stationBuildings = BUILDINGS_BY_STATION[selectedStation] ?? [];

  const SECTION_TABS = [
    { id: "guide" as const, icon: "📖", label: "操作指引" },
    { id: "station" as const, icon: "🏭", label: "换热站调节" },
    { id: "valve" as const, icon: "🔧", label: "阀门控制" },
    { id: "fault" as const, icon: "⚠️", label: "故障模拟" },
    { id: "strategy" as const, icon: "🎯", label: "策略切换" },
  ];

  return (
    <div style={{
      position: "fixed",
      top: 0, right: 0,
      width: 340,
      height: "100vh",
      zIndex: 50,
      background: "rgba(0,6,24,0.98)",
      borderLeft: "1.5px solid rgba(245,158,11,0.3)",
      display: "flex",
      flexDirection: "column",
      boxShadow: "-8px 0 40px rgba(0,0,0,0.7)",
      backdropFilter: "blur(16px)",
      fontFamily: "'Noto Sans SC', sans-serif",
    }}>
      {/* 顶部标题栏 */}
      <div style={{
        padding: "12px 14px 8px",
        borderBottom: "1px solid rgba(245,158,11,0.2)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
        background: "rgba(245,158,11,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎮</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>自由操控系统</div>
            <div style={{ fontSize: 8.5, color: "rgba(160,120,60,0.7)" }}>
              换热站调参 · 阀门控制 · 故障模拟 · AI诊断
              {activeFault && activeFault !== "restore" && (
                <span style={{ color: "#ef4444", marginLeft: 6 }}>⚠️ 故障运行中</span>
              )}
              {isDiagnosing && (
                <span style={{ color: "#f59e0b", marginLeft: 6 }}>🧠 AI诊断中...</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: "rgba(245,158,11,0.5)",
          fontSize: 18, cursor: "pointer", padding: "0 4px",
        }}>×</button>
      </div>

      {/* 即时反馈区 */}
      {feedbacks.length > 0 && (
        <div style={{
          padding: "6px 12px",
          borderBottom: "1px solid rgba(0,180,255,0.1)",
          display: "flex", flexDirection: "column", gap: 3,
          flexShrink: 0,
        }}>
          {feedbacks.slice(0, 2).map(f => (
            <FeedbackBadge key={f.id} text={f.text} color={f.color} />
          ))}
        </div>
      )}

      {/* Section Tabs */}
      <div style={{
        display: "flex", borderBottom: "1px solid rgba(0,180,255,0.15)",
        flexShrink: 0,
      }}>
        {SECTION_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            style={{
              flex: 1, padding: "8px 2px",
              fontSize: 9, fontWeight: activeSection === tab.id ? 700 : 500,
              color: activeSection === tab.id ? "#00d4ff" : "rgba(148,210,255,0.5)",
              background: activeSection === tab.id ? "rgba(0,100,200,0.12)" : "transparent",
              border: "none",
              borderBottom: activeSection === tab.id ? "2px solid #00d4ff" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div>{tab.icon}</div>
            <div style={{ marginTop: 2 }}>{tab.label}</div>
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>

        {/* ── 操作指引 ── */}
        {activeSection === "guide" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(0,180,255,0.06)",
              border: "1px solid rgba(0,180,255,0.2)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#00d4ff", marginBottom: 8 }}>
                📖 操作指引
              </div>
              {[
                { icon: "🏭", title: "换热站调节", desc: "手动调节A/B/C三个换热站的供水温度（40-65°C）、循环流量（60-150 t/h）、管网压差（0.1-0.5 MPa）。调节后系统图对应换热站高亮，覆盖楼栋室温同步联动变化。" },
                { icon: "🔧", title: "阀门控制", desc: "可开关单个楼栋的楼阀。关闭楼阀后该楼栋供热中断，室温持续下降；重新开启后室温逐步回升。操作后系统图对应阀门图标同步切换状态。" },
                { icon: "⚠️", title: "故障模拟", desc: "触发低温异常、管网压力异常、循环泵故障等场景，系统自动演示AI诊断→全链路调控的完整流程，对应场景同步触发高亮特效。" },
              ].map(item => (
                <div key={item.title} style={{
                  marginBottom: 10, paddingBottom: 10,
                  borderBottom: "1px solid rgba(0,180,255,0.08)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(200,230,255,0.9)" }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: "rgba(148,210,255,0.6)", lineHeight: 1.6 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 9, color: "rgba(100,150,200,0.5)", marginTop: 4 }}>
                💡 提示：所有操作均有即时数据反馈，右侧系统图同步高亮对应设备
              </div>
            </div>

            {/* 快捷操作入口 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "rgba(148,210,255,0.5)", marginBottom: 4 }}>快捷操作入口</div>
              {[
                { label: "调节换热站B供水温度", action: () => { setSelectedStation("S2"); setActiveSection("station"); }, color: "#f97316" },
                { label: "关闭6号楼楼阀", action: () => { setSelectedStation("S2"); setActiveSection("valve"); }, color: "#ef4444" },
                { label: "触发6号楼低温故障", action: () => { handleFault(FAULT_SCENARIOS[0]); }, color: "#3b82f6" },
                { label: "触发管网压力异常", action: () => { handleFault(FAULT_SCENARIOS[1]); }, color: "#f59e0b" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    padding: "8px 12px", borderRadius: 7, textAlign: "left",
                    border: `1px solid ${item.color}44`,
                    background: `${item.color}0A`,
                    color: item.color, fontSize: 10, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${item.color}18`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${item.color}0A`; }}
                >
                  → {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 换热站调节 ── */}
        {activeSection === "station" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle icon="🏭" title="换热站参数手动调节" color="#f97316" />

            {/* 换热站选择 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStation(s.id); onHighlightStation?.(s.id); setTimeout(() => onHighlightStation?.(null), 2000); }}
                  style={{
                    flex: 1, padding: "6px 4px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${selectedStation === s.id ? "#f97316" : "rgba(249,115,22,0.25)"}`,
                    background: selectedStation === s.id ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.04)",
                    color: selectedStation === s.id ? "#f97316" : "rgba(200,230,255,0.6)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* 当前换热站参数 */}
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(0,10,40,0.7)",
              border: "1px solid rgba(249,115,22,0.2)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", marginBottom: 10 }}>
                {currentStation.name} — 参数调节
              </div>

              <ParamSlider
                label="供水温度 (°C)"
                value={currentStation.supplyTemp}
                min={40} max={65} step={0.5} unit="°C" color="#f97316"
                onChange={v => handleStationParam(selectedStation, "supplyTemp", v)}
                onFocus={() => onHighlightStation?.(selectedStation)}
                onBlur={() => setTimeout(() => onHighlightStation?.(null), 2000)}
              />

              <ParamSlider
                label="循环流量 (t/h)"
                value={currentStation.flow}
                min={60} max={150} step={1} unit=" t/h" color="#00d4ff"
                onChange={v => handleStationParam(selectedStation, "flow", v)}
                onFocus={() => onHighlightStation?.(selectedStation)}
                onBlur={() => setTimeout(() => onHighlightStation?.(null), 2000)}
              />

              <ParamSlider
                label="管网压差 (MPa)"
                value={currentStation.pressure}
                min={0.1} max={0.5} step={0.01} unit=" MPa" color="#a78bfa"
                onChange={v => handleStationParam(selectedStation, "pressure", v)}
                onFocus={() => onHighlightStation?.(selectedStation)}
                onBlur={() => setTimeout(() => onHighlightStation?.(null), 2000)}
              />

              {/* 回水温度（只读，由供水温度推算） */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 9.5, color: "rgba(148,210,255,0.5)" }}>回水温度（推算）</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", fontFamily: "'Share Tech Mono', monospace" }}>
                  {(currentStation.supplyTemp - 10).toFixed(1)}°C
                </span>
              </div>
            </div>

            {/* 三站对比面板 */}
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(0,10,40,0.5)",
              border: "1px solid rgba(0,180,255,0.12)",
            }}>
              <div style={{ fontSize: 9.5, color: "rgba(148,210,255,0.5)", marginBottom: 8 }}>三站参数对比</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {stations.map(s => (
                  <div key={s.id} style={{
                    textAlign: "center", padding: "6px 4px", borderRadius: 7,
                    background: selectedStation === s.id ? "rgba(249,115,22,0.1)" : "rgba(0,20,60,0.5)",
                    border: `1px solid ${selectedStation === s.id ? "rgba(249,115,22,0.3)" : "rgba(0,180,255,0.1)"}`,
                  }}>
                    <div style={{ fontSize: 9, color: "rgba(148,210,255,0.6)", marginBottom: 3 }}>{s.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#f97316", fontFamily: "'Share Tech Mono', monospace" }}>
                      {s.supplyTemp.toFixed(0)}°C
                    </div>
                    <div style={{ fontSize: 8.5, color: "rgba(0,212,255,0.6)", fontFamily: "'Share Tech Mono', monospace" }}>
                      {s.flow.toFixed(0)} t/h
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 联动说明 */}
            <div style={{
              padding: "8px 10px", borderRadius: 7,
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.12)",
              fontSize: 8.5, color: "rgba(148,210,255,0.5)", lineHeight: 1.6,
            }}>
              💡 调节供水温度后，覆盖楼栋室温将在约30分钟内产生联动变化（供温每升1°C，室温约升0.12°C）
            </div>
          </div>
        )}

        {/* ── 阀门控制 ── */}
        {activeSection === "valve" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle icon="🔧" title="楼阀开关控制" color="#10b981" />

            {/* 换热站选择 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStation(s.id)}
                  style={{
                    flex: 1, padding: "5px 4px", borderRadius: 6, fontSize: 9.5, fontWeight: 700,
                    border: `1px solid ${selectedStation === s.id ? "#10b981" : "rgba(16,185,129,0.2)"}`,
                    background: selectedStation === s.id ? "rgba(16,185,129,0.12)" : "transparent",
                    color: selectedStation === s.id ? "#10b981" : "rgba(148,210,255,0.5)",
                    cursor: "pointer",
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(0,10,40,0.7)",
              border: "1px solid rgba(16,185,129,0.15)",
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
                {stations.find(s => s.id === selectedStation)?.name} — 覆盖楼栋阀门
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {stationBuildings.map(b => (
                  <ValveToggle
                    key={b.id}
                    label={b.name}
                    open={buildingValves[b.id] ?? true}
                    onChange={open => handleBuildingValve(b.id, open)}
                    color="#10b981"
                  />
                ))}
              </div>
            </div>

            {/* 全站阀门状态统计 */}
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(0,10,40,0.5)",
              border: "1px solid rgba(0,180,255,0.1)",
            }}>
              <div style={{ fontSize: 9, color: "rgba(148,210,255,0.5)", marginBottom: 6 }}>全站阀门状态</div>
              <div style={{ display: "flex", gap: 10 }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#10b981", fontFamily: "'Share Tech Mono', monospace" }}>
                    {Object.values(buildingValves).filter(Boolean).length}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(148,210,255,0.5)", marginLeft: 3 }}>开启</span>
                </div>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", fontFamily: "'Share Tech Mono', monospace" }}>
                    {Object.values(buildingValves).filter(v => !v).length}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(148,210,255,0.5)", marginLeft: 3 }}>关闭</span>
                </div>
              </div>
            </div>

            <div style={{
              padding: "8px 10px", borderRadius: 7,
              background: "rgba(239,68,68,0.04)",
              border: "1px solid rgba(239,68,68,0.12)",
              fontSize: 8.5, color: "rgba(255,150,150,0.5)", lineHeight: 1.6,
            }}>
              ⚠️ 关闭楼阀后该楼栋供热中断，室温将持续下降。系统图对应阀门图标同步切换状态。
            </div>
          </div>
        )}

        {/* ── 策略切换 ── */}
        {activeSection === "strategy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle icon="🎯" title="供热策略切换" color="#a78bfa" />

            {/* 策略说明 */}
            <div style={{
              padding: "8px 10px", borderRadius: 8,
              background: "rgba(167,139,250,0.06)",
              border: "1px solid rgba(167,139,250,0.2)",
              fontSize: 9.5, color: "rgba(148,210,255,0.6)", lineHeight: 1.6,
            }}>
              选择供热策略后，系统将自动触发完整调控链条：换热站高亮 → AI评估 → 参数下发 → 室温联动
            </div>

            {/* 策略卡片 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STRATEGIES.map(strategy => {
                const isActive3 = activeStrategy === strategy.id;
                const isDone = isActive3 && strategyPhase === "done";
                const isRunning = isActive3 && strategyPhase !== "idle" && strategyPhase !== "done";
                return (
                  <button
                    key={strategy.id}
                    onClick={() => handleStrategy(strategy)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "12px 14px", borderRadius: 10, textAlign: "left",
                      border: `1.5px solid ${isActive3 ? strategy.color : `${strategy.color}44`}`,
                      background: isDone ? `${strategy.color}18` : isActive3 ? `${strategy.color}10` : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      boxShadow: isActive3 ? `0 0 16px ${strategy.color}33` : "none",
                      transition: "all 0.25s",
                    }}
                    onMouseEnter={e => { if (!isActive3) e.currentTarget.style.background = `${strategy.color}0D`; }}
                    onMouseLeave={e => { if (!isActive3) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{strategy.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: isActive3 ? strategy.color : "#e2e8f0" }}>
                          {strategy.name}
                        </span>
                        {isDone && (
                          <span style={{
                            fontSize: 8.5, color: "#10b981", padding: "1px 6px",
                            borderRadius: 3, border: "1px solid rgba(16,185,129,0.4)",
                            background: "rgba(16,185,129,0.1)",
                          }}>✓ 已生效</span>
                        )}
                        {isRunning && (
                          <span style={{
                            fontSize: 8.5, color: strategy.color, padding: "1px 6px",
                            borderRadius: 3, border: `1px solid ${strategy.color}44`,
                            background: `${strategy.color}10`,
                            animation: "blink 1s infinite",
                          }}>执行中...</span>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(148,210,255,0.55)", lineHeight: 1.5 }}>{strategy.desc}</div>
                      {/* 执行进度指示 */}
                      {isActive3 && strategyPhase !== "idle" && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {(["highlight", "ai", "params", "temp", "done"] as const).map((phase, i) => {
                            const phases = ["highlight", "ai", "params", "temp", "done"];
                            const currentIdx = phases.indexOf(strategyPhase);
                            const thisIdx = i;
                            const done2 = thisIdx <= currentIdx;
                            return (
                              <div key={phase} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                background: done2 ? strategy.color : "rgba(255,255,255,0.1)",
                                transition: "background 0.3s",
                              }} />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 执行日志 */}
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(0,10,40,0.7)",
              border: `1px solid ${activeStrategy ? "rgba(167,139,250,0.3)" : "rgba(0,180,255,0.12)"}`,
              boxShadow: activeStrategy && strategyPhase !== "idle" && strategyPhase !== "done"
                ? "0 0 16px rgba(167,139,250,0.15)" : "none",
              transition: "all 0.3s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12 }}>📋</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: activeStrategy ? "#a78bfa" : "rgba(148,210,255,0.6)" }}>
                  策略执行日志
                </span>
                {activeStrategy && strategyPhase !== "idle" && strategyPhase !== "done" && (
                  <span style={{
                    fontSize: 8, color: "#a78bfa", padding: "1px 6px", borderRadius: 3,
                    border: "1px solid rgba(167,139,250,0.4)",
                    background: "rgba(167,139,250,0.1)",
                    animation: "blink 1s infinite",
                  }}>执行中...</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {diagnosisLog.length === 0 ? (
                  <div style={{ fontSize: 10, color: "rgba(100,150,200,0.4)", textAlign: "center", padding: "12px 0" }}>
                    点击策略卡片后，执行日志将在此显示
                  </div>
                ) : (
                  diagnosisLog.map((log, i) => (
                    <div key={i} style={{
                      fontSize: 9.5, color: i === 0 ? "#e2e8f0" : "rgba(148,210,255,0.5)",
                      background: i === 0 ? "rgba(167,139,250,0.06)" : "transparent",
                      borderRadius: 4, padding: "3px 6px",
                      borderLeft: `2px solid ${i === 0 ? "#a78bfa" : "transparent"}`,
                      fontFamily: "'Share Tech Mono', monospace",
                      lineHeight: 1.5,
                    }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 故障模拟 ── */}
        {activeSection === "fault" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle icon="⚠️" title="故障模拟 + AI诊断" color="#ef4444" />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FAULT_SCENARIOS.map(fault => {
                const isActive2 = activeFault === fault.id;
                return (
                  <button
                    key={fault.id}
                    onClick={() => handleFault(fault)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 12px", borderRadius: 9,
                      border: `1px solid ${isActive2 ? fault.color : `${fault.color}44`}`,
                      background: isActive2 ? `${fault.color}15` : "rgba(255,255,255,0.02)",
                      cursor: "pointer", textAlign: "left",
                      boxShadow: isActive2 ? `0 0 12px ${fault.color}33` : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{fault.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isActive2 ? fault.color : "#e2e8f0", marginBottom: 2 }}>
                        {fault.name}
                        {isActive2 && <span style={{ marginLeft: 6, fontSize: 9, color: fault.color }}>● 运行中</span>}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(148,210,255,0.5)", lineHeight: 1.5 }}>{fault.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* AI诊断日志 */}
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(0,10,40,0.7)",
              border: `1px solid ${isDiagnosing ? "rgba(245,158,11,0.4)" : "rgba(0,180,255,0.12)"}`,
              boxShadow: isDiagnosing ? "0 0 16px rgba(245,158,11,0.15)" : "none",
              transition: "all 0.3s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12 }}>🧠</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: isDiagnosing ? "#f59e0b" : "rgba(148,210,255,0.6)" }}>
                  AI诊断日志
                </span>
                {isDiagnosing && (
                  <span style={{
                    fontSize: 8, color: "#f59e0b",
                    padding: "1px 6px", borderRadius: 3,
                    border: "1px solid rgba(245,158,11,0.4)",
                    background: "rgba(245,158,11,0.1)",
                    animation: "blink 1s infinite",
                  }}>诊断中...</span>
                )}
              </div>
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                maxHeight: 200, overflowY: "auto",
              }}>
                {diagnosisLog.length === 0 ? (
                  <div style={{ fontSize: 10, color: "rgba(100,150,200,0.4)", textAlign: "center", padding: "12px 0" }}>
                    触发故障场景后，AI诊断日志将在此显示
                  </div>
                ) : (
                  diagnosisLog.map((log, i) => (
                    <div key={i} style={{
                      fontSize: 9.5, color: i === 0 ? "#e2e8f0" : "rgba(148,210,255,0.5)",
                      background: i === 0 ? "rgba(0,212,255,0.05)" : "transparent",
                      borderRadius: 4, padding: "3px 6px",
                      borderLeft: `2px solid ${i === 0 ? "#00d4ff" : "transparent"}`,
                      fontFamily: "'Share Tech Mono', monospace",
                      lineHeight: 1.5,
                    }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes flow-in { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
      `}</style>
    </div>
  );
}
