/**
 * NetworkDiagnosis.tsx — 管网诊断页面
 * "热量去向审计师"
 * 
 * 左侧：管网拓扑图（节点绿/黄/红健康状态）
 * 右侧：压力曲线（绿线实测 vs 红线理论）+ 三大问题卡片 + 热量去向环形图
 * 
 * 纯前端静态数据演示，4个预设诊断场景
 */
import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeStatus = "green" | "yellow" | "red";

interface AnomalyRange {
  startIndex: number;
  endIndex: number;
  message: string;
}

interface PressureCurve {
  timeLabels: string[];
  redLine: number[];
  greenLine: number[];
  anomalyRanges: AnomalyRange[];
}

interface CardDetail {
  description: string;
  possibleCauses: string[];
  suggestions: string[];
  heatLoss: string;
}

interface DiagnosisCard {
  type: "pipe" | "terminal" | "model";
  title: string;
  confidence: number;
  symptom: string;
  details: CardDetail;
}

interface HeatBalance {
  normal: number;
  acceptableLoss: number;
  abnormalLoss: number;
}

interface NodeData {
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  roomTemp: number;
  supplyTemp: number;
  returnTemp: number;
  tempDiff: number;
  pressureCurve: PressureCurve;
  diagnosisCards: DiagnosisCard[];
  heatBalance: HeatBalance;
}

// ─── Static Diagnosis Data ────────────────────────────────────────────────────

const DIAGNOSIS_DATA: Record<string, NodeData> = {
  "C2": {
    nodeId: "C2", nodeName: "C2栋（3栋）", status: "red",
    roomTemp: 17.2, supplyTemp: 54.3, returnTemp: 45.1, tempDiff: 9.2,
    pressureCurve: {
      timeLabels: ["00:00","04:00","08:00","10:00","12:00","16:00","20:00","24:00"],
      redLine:   [0.44, 0.44, 0.44, 0.44, 0.44, 0.44, 0.44, 0.44],
      greenLine: [0.44, 0.43, 0.44, 0.14, 0.16, 0.44, 0.44, 0.44],
      anomalyRanges: [{ startIndex: 3, endIndex: 4, message: "压降0.28bar · 疑似局部堵塞" }],
    },
    diagnosisCards: [
      {
        type: "pipe", title: "管网问题", confidence: 92,
        symptom: "C2节点压降异常 · 除污器堵塞概率85%",
        details: {
          description: "水力模型显示C2节点在08:00-12:00出现压力骤降0.28bar，上游流量正常，下游压力明显不足，判断为局部阻力异常。",
          possibleCauses: ["除污器堵塞（滤网积垢）", "局部阀门未全开", "管道局部锈蚀缩径"],
          suggestions: ["立即检查C2节点除污器，清洗或更换滤网", "核查附近手动阀门开度", "安排管道巡检，排查锈蚀泄漏"],
          heatLoss: "约85kW · 相当于每日多烧3吨煤",
        },
      },
      {
        type: "terminal", title: "末端问题", confidence: 34,
        symptom: "部分房间回水温度偏低",
        details: {
          description: "部分用户回水温度较平均低约5°C，但整体压差正常，判断为次要因素。",
          possibleCauses: ["散热器积气", "地暖回路局部堵塞", "个别用户长期开窗"],
          suggestions: ["建议巡检C2-501、C2-1503用户", "对积气散热器进行排气操作"],
          heatLoss: "局部换热效率下降约12%",
        },
      },
      {
        type: "model", title: "模型问题", confidence: 12,
        symptom: "热负荷计算与实测偏差小",
        details: {
          description: "模型预测室温与实测基本一致，无明显系统性偏差，模型认知问题可能性低。",
          possibleCauses: [],
          suggestions: ["无需调整模型参数"],
          heatLoss: "无",
        },
      },
    ],
    heatBalance: { normal: 58, acceptableLoss: 22, abnormalLoss: 20 },
  },

  "D5": {
    nodeId: "D5", nodeName: "D5栋（7栋）", status: "yellow",
    roomTemp: 16.5, supplyTemp: 57.8, returnTemp: 54.6, tempDiff: 3.2,
    pressureCurve: {
      timeLabels: ["00:00","04:00","08:00","12:00","16:00","20:00","24:00"],
      redLine:   [0.38, 0.38, 0.38, 0.38, 0.38, 0.38, 0.38],
      greenLine: [0.38, 0.37, 0.38, 0.37, 0.38, 0.38, 0.37],
      anomalyRanges: [],
    },
    diagnosisCards: [
      {
        type: "terminal", title: "末端问题", confidence: 87,
        symptom: "供回水温差仅3.2°C（正常应为8-10°C）",
        details: {
          description: "水力分配正常（绿线贴红线），但供回水温差异常偏小（3.2°C vs 正常8-10°C），说明热量到达末端但未被有效吸收，换热效率严重偏低。",
          possibleCauses: ["散热器大量积气，水循环不畅", "地暖回路短路，流量过大但换热不足", "多户用户长期开窗散热，导致回水温度虚高"],
          suggestions: ["对D5栋全楼散热器进行系统排气", "检查地暖分集水器，排查短路回路", "上门巡查高楼层用户（D5-1501~1806）开窗情况"],
          heatLoss: "换热效率下降约60%，热量大量浪费",
        },
      },
      {
        type: "pipe", title: "管网问题", confidence: 18,
        symptom: "水力分配正常，管网无异常",
        details: {
          description: "压力曲线显示绿线紧贴红线，管网水力分配健康，管网问题可能性低。",
          possibleCauses: [],
          suggestions: ["无需检查管网"],
          heatLoss: "无",
        },
      },
      {
        type: "model", title: "模型问题", confidence: 22,
        symptom: "室温预测偏差约1.5°C",
        details: {
          description: "模型预测室温18.0°C，实测16.5°C，偏差1.5°C，存在轻微低估热损失的情况。",
          possibleCauses: ["该楼栋实际保温系数低于模型设定值", "未充分考虑角落户、顶层户的额外热损"],
          suggestions: ["建议对D5栋进行建筑热工参数复核", "更新模型中该楼栋的保温修正系数"],
          heatLoss: "模型误差导致供热量偏少约8%",
        },
      },
    ],
    heatBalance: { normal: 52, acceptableLoss: 18, abnormalLoss: 30 },
  },

  "A3": {
    nodeId: "A3", nodeName: "A3栋（10栋）", status: "yellow",
    roomTemp: 15.8, supplyTemp: 58.2, returnTemp: 47.9, tempDiff: 10.3,
    pressureCurve: {
      timeLabels: ["00:00","04:00","08:00","12:00","16:00","20:00","24:00"],
      redLine:   [0.32, 0.32, 0.32, 0.32, 0.32, 0.32, 0.32],
      greenLine: [0.32, 0.31, 0.32, 0.32, 0.31, 0.32, 0.32],
      anomalyRanges: [],
    },
    diagnosisCards: [
      {
        type: "model", title: "模型问题", confidence: 78,
        symptom: "室温预测偏差-2.3°C · 热负荷被系统性低估",
        details: {
          description: "水力分配正常，供回水温差正常（10.3°C），但室温持续低于模型预测值2.3°C，且该偏差在寒潮期间扩大至3.5°C，判断为模型热负荷计算系统性偏低。",
          possibleCauses: ["1980年代老旧建筑，实际传热系数比模型设定大30%", "孤岛户（顶层+角落户）保温差，未在模型中单独标注", "昨日西北风速8m/s，模型仅考虑5m/s基准，风速每增1m/s热耗增加约0.5°C"],
          suggestions: ["对A3栋进行建筑热工现场检测，更新传热系数", "在模型中标注孤岛户（A3-101、A3-1801、A3-1802），增加修正系数", "接入气象站实时风速数据，动态修正热负荷预测"],
          heatLoss: "模型低估导致供热量不足约15%",
        },
      },
      {
        type: "pipe", title: "管网问题", confidence: 14,
        symptom: "水力分配正常，管网健康",
        details: {
          description: "压力曲线绿线紧贴红线，管网水力状态良好。",
          possibleCauses: [],
          suggestions: ["无需检查管网"],
          heatLoss: "无",
        },
      },
      {
        type: "terminal", title: "末端问题", confidence: 25,
        symptom: "供回水温差正常，末端换热基本正常",
        details: {
          description: "供回水温差10.3°C处于正常范围，末端换热效率基本正常，末端问题可能性较低。",
          possibleCauses: ["个别顶层用户散热器效率偏低"],
          suggestions: ["可选择性巡检顶层用户散热器状态"],
          heatLoss: "局部影响，整体可忽略",
        },
      },
    ],
    heatBalance: { normal: 60, acceptableLoss: 25, abnormalLoss: 15 },
  },

  "E4": {
    nodeId: "E4", nodeName: "E4栋（9栋）", status: "red",
    roomTemp: 16.8, supplyTemp: 55.1, returnTemp: 47.3, tempDiff: 7.8,
    pressureCurve: {
      timeLabels: ["00:00","04:00","08:00","12:00","14:00","16:00","20:00","24:00"],
      redLine:   [0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40],
      greenLine: [0.40, 0.39, 0.40, 0.22, 0.18, 0.38, 0.40, 0.40],
      anomalyRanges: [{ startIndex: 3, endIndex: 4, message: "压降0.22bar · 疑似管道泄漏" }],
    },
    diagnosisCards: [
      {
        type: "pipe", title: "管网问题", confidence: 89,
        symptom: "E4节点压降异常 · 管道泄漏概率7%",
        details: {
          description: "水力模型显示E4节点在12:00-14:00出现压力骤降0.22bar，上游流量正常而下游压力明显不足，判断为管道泄漏或弥补阀异常。",
          possibleCauses: ["地下管道连接处密封圈老化", "弥补阀未关闭导致流量分流", "局部管道腐蚀穿孔"],
          suggestions: ["立即封隔E4节点上游弥补阀，排查泄漏点", "安排管道巡检队伏水检测", "核查E4节点附近手动阀门开度"],
          heatLoss: "约110kW · 相当于每日多烧4吨煮",
        },
      },
      {
        type: "terminal", title: "末端问题", confidence: 28,
        symptom: "部分房间回水温度偏低",
        details: {
          description: "部分用户回水温度较平均低约4°C，但整体压差异常，判断为次要因素。",
          possibleCauses: ["散热器积气", "个别用户长期开窗"],
          suggestions: ["建议E4节点管网恢复后再进行末端巡检"],
          heatLoss: "局部换热效率下降约15%",
        },
      },
      {
        type: "model", title: "模型问题", confidence: 10,
        symptom: "热负荷计算与实测偏差小",
        details: {
          description: "模型预测室温17.0°C，实测16.8°C，偏差0.2°C，模型认知问题可能性低。",
          possibleCauses: [],
          suggestions: ["无需调整模型参数"],
          heatLoss: "无",
        },
      },
    ],
    heatBalance: { normal: 55, acceptableLoss: 20, abnormalLoss: 25 },
  },

  "B1": {
    nodeId: "B1", nodeName: "B1栋（6栋）", status: "green",
    roomTemp: 20.1, supplyTemp: 56.5, returnTemp: 46.8, tempDiff: 9.7,
    pressureCurve: {
      timeLabels: ["00:00","04:00","08:00","12:00","16:00","20:00","24:00"],
      redLine:   [0.41, 0.41, 0.41, 0.41, 0.41, 0.41, 0.41],
      greenLine: [0.41, 0.41, 0.40, 0.41, 0.41, 0.41, 0.41],
      anomalyRanges: [],
    },
    diagnosisCards: [
      {
        type: "pipe", title: "管网问题", confidence: 3,
        symptom: "水力分配完全正常",
        details: {
          description: "压力曲线绿线与红线高度吻合，管网水力分配健康，无任何异常。",
          possibleCauses: [],
          suggestions: ["保持当前运行状态，定期巡检即可"],
          heatLoss: "无",
        },
      },
      {
        type: "terminal", title: "末端问题", confidence: 5,
        symptom: "供回水温差9.7°C，末端换热正常",
        details: {
          description: "供回水温差9.7°C处于理想范围（8-10°C），末端换热效率正常。",
          possibleCauses: [],
          suggestions: ["无需干预"],
          heatLoss: "无",
        },
      },
      {
        type: "model", title: "模型问题", confidence: 8,
        symptom: "室温预测偏差仅0.1°C，模型精准",
        details: {
          description: "模型预测室温20.0°C，实测20.1°C，偏差仅0.1°C，模型表现优秀。",
          possibleCauses: [],
          suggestions: ["无需调整"],
          heatLoss: "无",
        },
      },
    ],
    heatBalance: { normal: 78, acceptableLoss: 17, abnormalLoss: 5 },
  },
};

// ─── Node positions in the topology map ──────────────────────────────────────
// Based on Home.tsx building coordinates, scaled to fit the left panel

interface TopoNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "source" | "station" | "building";
  diagKey?: string;
  status?: NodeStatus;
  temp?: number;
}

// Map buildings to diagnosis scenarios
const BUILDING_DIAG_MAP: Record<string, string> = {
  "3":  "C2",  // 3栋 → C2场景（管网问题）
  "9":  "E4",  // 9栋 → E4场景（管网泄漏）
  "7":  "D5",  // 7栋 → D5场景（末端问题）
  "10": "A3",  // 10栋 → A3场景（模型问题）
  "6":  "B1",  // 6栋 → B1场景（正常）
};

// 注意：修改此 map 后，右上角统计数字会自动跟随更新
const BUILDING_STATUS_MAP: Record<string, NodeStatus> = {
  "3": "red",    "9": "red",    // 2个异常节点（红色）
  "7": "yellow", "10": "yellow", // 2个需诊断节点（黄色）
  "6": "green",  "1": "green",  "2": "green",  "4": "green",
  "5": "green",  "8": "green",  "11": "green", "12": "green",  // 8个正常节点（绿色）
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<NodeStatus, string> = {
  green: "#2DE0A5",
  yellow: "#FFB347",
  red: "#FF4D4D",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  green: "正常",
  yellow: "需诊断",
  red: "异常",
};

const CARD_COLOR: Record<string, string> = {
  pipe: "#FF4D4D",
  terminal: "#FF8C42",
  model: "#4DA6FF",
};

const CARD_ICON: Record<string, string> = {
  pipe: "🔴",
  terminal: "🟠",
  model: "🔵",
};

// Pressure chart data builder
function buildChartData(curve: PressureCurve) {
  return curve.timeLabels.map((t, i) => ({
    time: t,
    theory: curve.redLine[i],
    actual: curve.greenLine[i],
  }));
}

// Custom tooltip for pressure chart
function PressureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,15,31,0.95)", border: "1px solid rgba(0,240,255,0.3)",
      borderRadius: 8, padding: "8px 12px", fontSize: 11,
    }}>
      <div style={{ color: "rgba(125,185,230,0.50)", marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.dataKey === "theory" ? "理论值" : "实测值"}：{p.value.toFixed(2)} bar
        </div>
      ))}
    </div>
  );
}

// Donut chart (pure SVG)
function DonutChart({ normal, acceptableLoss, abnormalLoss }: HeatBalance) {
  const total = normal + acceptableLoss + abnormalLoss;
  const r = 52, cx = 70, cy = 70, strokeW = 18;
  const circumference = 2 * Math.PI * r;

  function getArc(value: number, offset: number) {
    const pct = value / total;
    return { dasharray: `${pct * circumference} ${circumference}`, offset: -offset * circumference / total };
  }

  const normalArc = getArc(normal, 0);
  const lossArc = getArc(acceptableLoss, normal);
  const abnormalArc = getArc(abnormalLoss, normal + acceptableLoss);

  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeW} />
      {/* Normal */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2DE0A5" strokeWidth={strokeW}
        strokeDasharray={normalArc.dasharray}
        strokeDashoffset={`${circumference * 0.25}`}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Acceptable loss */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FFB347" strokeWidth={strokeW}
        strokeDasharray={lossArc.dasharray}
        strokeDashoffset={`${circumference * 0.25 - (normal / total) * circumference}`}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Abnormal loss */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FF4D4D" strokeWidth={strokeW}
        strokeDasharray={abnormalArc.dasharray}
        strokeDashoffset={`${circumference * 0.25 - ((normal + acceptableLoss) / total) * circumference}`}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Center text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)" fontFamily="'Share Tech Mono', monospace">热量分配</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={14} fill="#00F0FF" fontWeight={700} fontFamily="'Share Tech Mono', monospace">{abnormalLoss}%</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8} fill="#FF4D4D" fontFamily="'Noto Sans SC', sans-serif">异常损耗</text>
    </svg>
  );
}

// ─── Topology Map ─────────────────────────────────────────────────────────────

const BUILDINGS_TOPO = [
  { id: "1",  label: "1栋",  x: 210, y: 52  },
  { id: "2",  label: "2栋",  x: 245, y: 100 },
  { id: "3",  label: "3栋",  x: 215, y: 168 },
  { id: "4",  label: "4栋",  x: 248, y: 225 },
  { id: "5",  label: "5栋",  x: 290, y: 38  },
  { id: "6",  label: "6栋",  x: 318, y: 128 },
  { id: "7",  label: "7栋",  x: 285, y: 198 },
  { id: "8",  label: "8栋",  x: 325, y: 258 },
  { id: "9",  label: "9栋",  x: 370, y: 68  },
  { id: "10", label: "10栋", x: 395, y: 158 },
  { id: "11", label: "11栋", x: 368, y: 218 },
  { id: "12", label: "12栋", x: 398, y: 278 },
];

function TopologyMap({
  selectedNode, onSelectNode,
}: {
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
}) {
  const W = 460, H = 320;
  const srcX = 28, srcY = 148;
  const stX = 110, stY = 148;

  // Supply/return main trunk y offsets
  const supY = 142, retY = 154;

  // Column x positions (near/mid/far)
  const col1X = 230, col2X = 305, col3X = 385;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <filter id="nd-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="nd-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.3)" />
        </filter>
      </defs>

      {/* Background */}
      <rect width={W} height={H} rx={12} fill="#020F32" stroke="rgba(0,180,255,0.2)" strokeWidth={1} />

      {/* ── Trunk pipes: source → station → columns ── */}
      {/* Primary supply: source → station */}
      <line x1={srcX + 22} y1={supY} x2={stX - 18} y2={supY} stroke="#FF6B8A" strokeWidth={2.5} opacity={0.8} />
      {/* Primary return: station → source */}
      <line x1={stX - 18} y1={retY} x2={srcX + 22} y2={retY} stroke="#9B8FD8" strokeWidth={2.5} opacity={0.7} />

      {/* Secondary supply trunk: station → col3 */}
      <line x1={stX + 18} y1={supY} x2={col3X + 30} y2={supY} stroke="#FF6B8A" strokeWidth={2} opacity={0.7} />
      {/* Secondary return trunk: col3 → station */}
      <line x1={stX + 18} y1={retY} x2={col3X + 30} y2={retY} stroke="#9B8FD8" strokeWidth={2} opacity={0.6} />

      {/* ── Branch pipes per building ── */}
      {BUILDINGS_TOPO.map(b => {
        const colX = b.x < 270 ? col1X : b.x < 350 ? col2X : col3X;
        const bx = b.x, by = b.y + 12;
        const status = BUILDING_STATUS_MAP[b.id] || "green";
        const color = STATUS_COLOR[status];
        const isSelected = selectedNode === b.id;

        return (
          <g key={b.id}>
            {/* Vertical drop from trunk */}
            <line x1={colX} y1={supY} x2={colX} y2={by - 2}
              stroke="#FF6B8A" strokeWidth={1.5} opacity={0.5} />
            {/* Horizontal branch to building */}
            <line x1={colX} y1={by - 2} x2={bx + 14} y2={by - 2}
              stroke="#FF6B8A" strokeWidth={1.5} opacity={0.5} />
            {/* Return horizontal */}
            <line x1={bx + 14} y1={by + 2} x2={colX} y2={by + 2}
              stroke="#9B8FD8" strokeWidth={1.5} opacity={0.45} />
            {/* Return vertical */}
            <line x1={colX} y1={by + 2} x2={colX} y2={retY}
              stroke="#9B8FD8" strokeWidth={1.5} opacity={0.45} />

            {/* Building node */}
            <g
              onClick={() => onSelectNode(b.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle cx={bx + 14} cy={by} r={16} fill="none"
                  stroke={color} strokeWidth={1.5} opacity={0.6}>
                  <animate attributeName="r" values="14;18;14" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Node circle */}
              <circle cx={bx + 14} cy={by} r={11}
                fill={isSelected ? color : "#0A1F4E"}
                stroke={color} strokeWidth={isSelected ? 2 : 1.5}
                filter="url(#nd-shadow)"
              />
              {/* Status dot */}
              <circle cx={bx + 14} cy={by} r={4}
                fill={isSelected ? "#E0F4FF" : color}
                opacity={0.9}
              >
                {status !== "green" && (
                  <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
                )}
              </circle>
              {/* Label */}
              <text x={bx + 14} y={by + 22} textAnchor="middle"
                fontSize={8} fill={isSelected ? color : "rgba(160,210,255,0.85)"}
                fontFamily="'Noto Sans SC', sans-serif" fontWeight={isSelected ? 700 : 400}
              >
                {b.label}
              </text>
            </g>
          </g>
        );
      })}

      {/* ── Heat Source ── */}
      <g>
        <circle cx={srcX} cy={srcY} r={20}
          fill="rgba(255,140,60,0.12)" stroke="rgba(255,140,60,0.5)" strokeWidth={1.5} />
        <text x={srcX} y={srcY + 5} textAnchor="middle" fontSize={14}>🔥</text>
        <text x={srcX} y={srcY + 16} textAnchor="middle" fontSize={7}
          fill="#D97706" fontFamily="'Noto Sans SC', sans-serif" fontWeight={700}>热源</text>
      </g>

      {/* ── Heat Station ── */}
      <g onClick={() => {}} style={{ cursor: "default" }}>
        <rect x={stX - 16} y={stY - 20} width={32} height={40} rx={6}
          fill="rgba(26,86,219,0.08)" stroke="rgba(26,86,219,0.4)" strokeWidth={1.5}
          filter="url(#nd-shadow)"
        />
        <text x={stX} y={stY + 2} textAnchor="middle" fontSize={10}>⚙️</text>
        <text x={stX} y={stY + 14} textAnchor="middle" fontSize={7}
          fill="#1A56DB" fontFamily="'Noto Sans SC', sans-serif" fontWeight={700}>换热站</text>
      </g>

      {/* ── Legend ── */}
      <g transform="translate(8, 280)">
        {[
          { color: "#2DE0A5", label: "正常" },
          { color: "#FFB347", label: "需诊断" },
          { color: "#FF4D4D", label: "异常" },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 70}, 0)`}>
            <circle cx={6} cy={6} r={5} fill={item.color} opacity={0.8} />
            <text x={14} y={10} fontSize={8} fill="rgba(125,185,230,0.7)"
              fontFamily="'Noto Sans SC', sans-serif">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NetworkDiagnosis() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const diagKey = selectedBuildingId ? BUILDING_DIAG_MAP[selectedBuildingId] : null;
  const nodeData = diagKey ? DIAGNOSIS_DATA[diagKey] : null;

  function handleSelectNode(id: string) {
    setSelectedBuildingId(id);
    setExpandedCard(null);
    setAnimKey(k => k + 1);
  }

  const chartData = nodeData ? buildChartData(nodeData.pressureCurve) : [];
  const anomaly = nodeData?.pressureCurve.anomalyRanges[0];

  // Sort cards by confidence desc
  const sortedCards = nodeData
    ? [...nodeData.diagnosisCards].sort((a, b) => b.confidence - a.confidence)
    : [];

  const topCard = sortedCards[0];
  const isNormal = nodeData?.status === "green";

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#020B1A",
      color: "rgba(200,230,255,0.92)",
      fontFamily: "'Noto Sans SC', sans-serif",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 20px",
        borderBottom: "1px solid rgba(0,180,255,0.20)",
        background: "#020B1A",
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, #EF4444, #F97316)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>🔍</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(200,230,255,0.92)", letterSpacing: "0.05em" }}>
            管网诊断 · 热量去向审计师
          </div>
          <div style={{ fontSize: 10, color: "rgba(125,185,230,0.50)", fontFamily: "'Share Tech Mono', monospace" }}>
            NETWORK DIAGNOSIS · HEAT AUDIT SYSTEM
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Quick stats — 动态计算，与 BUILDING_STATUS_MAP 完全联动 */}
        {((): { label: string; value: string; color: string }[] => {
          const counts = Object.values(BUILDING_STATUS_MAP).reduce(
            (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
            {} as Record<NodeStatus, number>,
          );
          return [
            { label: "异常节点", value: String(counts["red"] ?? 0),    color: "#FF4D4D" },
            { label: "需诊断",   value: String(counts["yellow"] ?? 0), color: "#FFB347" },
            { label: "正常节点", value: String(counts["green"] ?? 0),  color: "#2DE0A5" },
          ];
        })().map(s => (
          <div key={s.label} style={{
            textAlign: "center", padding: "4px 12px",
            background: "rgba(0,15,50,0.7)",
            border: `1px solid ${s.color}50`,
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "rgba(125,185,230,0.50)" }}>{s.label}</div>
          </div>
        ))}
        <div style={{
          fontSize: 9, color: "rgba(125,185,230,0.65)",
          fontFamily: "'Share Tech Mono', monospace",
          padding: "4px 8px",
          background: "rgba(26,86,219,0.05)",
          border: "1px solid rgba(26,86,219,0.2)",
          borderRadius: 4,
        }}>
          点击左侧楼栋节点查看诊断
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: 0 }}>

        {/* ── Left: Topology Map ── */}
        <div style={{
          width: 480, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(0,180,255,0.15)",
          padding: "16px",
          overflow: "hidden",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#00D4FF",
            marginBottom: 10, letterSpacing: "0.08em",
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            ◈ 管网拓扑图 · 节点健康状态
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <TopologyMap
              selectedNode={selectedBuildingId}
              onSelectNode={handleSelectNode}
            />
          </div>

          {/* Diagnosis decision tree hint */}
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: "rgba(26,86,219,0.04)",
            border: "1px solid rgba(26,86,219,0.12)",
            borderRadius: 8, fontSize: 10,
          }}>
            <div style={{ color: "#00D4FF", fontWeight: 600, marginBottom: 6 }}>🧠 诊断决策树</div>
            <div style={{ color: "rgba(125,185,230,0.65)", lineHeight: 1.7 }}>
              绿线不贴红线 → <span style={{ color: "#FF4D4D" }}>🔴 管网问题</span><br />
              绿线正常 + 温差异常 → <span style={{ color: "#FF8C42" }}>🟠 末端问题</span><br />
              绿线正常 + 温差正常 + 室温低 → <span style={{ color: "#4DA6FF" }}>🔵 模型问题</span>
            </div>
          </div>
        </div>

        {/* ── Right: Diagnosis Panel ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {!nodeData ? (
            /* Empty state */
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 16, color: "rgba(125,185,230,0.50)",
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>📍</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>点击左侧管网图中的楼栋节点</div>
              <div style={{ fontSize: 11 }}>即可查看该节点的诊断数据</div>
              <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 8 }}>
                💡 建议先点击黄色或红色节点查看典型诊断案例
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>

              {/* Node header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                marginBottom: 16,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: STATUS_COLOR[nodeData.status],
                  boxShadow: `0 0 8px ${STATUS_COLOR[nodeData.status]}`,
                }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(200,230,255,0.92)" }}>
                  {nodeData.nodeName}
                </div>
                <div style={{
                  padding: "2px 8px", borderRadius: 4,
                  background: `${STATUS_COLOR[nodeData.status]}20`,
                  border: `1px solid ${STATUS_COLOR[nodeData.status]}50`,
                  fontSize: 10, fontWeight: 600,
                  color: STATUS_COLOR[nodeData.status],
                }}>
                  {STATUS_LABEL[nodeData.status]}
                </div>
                {isNormal && (
                  <div style={{ fontSize: 11, color: "#2DE0A5" }}>✅ 系统运行正常，无需干预</div>
                )}
                <div style={{ flex: 1 }} />
                {/* Key metrics */}
                {[
                  { label: "室温", value: `${nodeData.roomTemp}°C`, color: nodeData.roomTemp < 18 ? "#FFB347" : "#2DE0A5" },
                  { label: "供水", value: `${nodeData.supplyTemp}°C`, color: "#FF6B8A" },
                  { label: "回水", value: `${nodeData.returnTemp}°C`, color: "#9B8FD8" },
                  { label: "温差", value: `${nodeData.tempDiff}°C`, color: nodeData.tempDiff < 5 || nodeData.tempDiff > 12 ? "#FFB347" : "#2DE0A5" },
                ].map(m => (
                  <div key={m.label} style={{
                    textAlign: "center", padding: "4px 10px",
                    background: "rgba(0,15,50,0.7)",
                    border: "1px solid rgba(0,180,255,0.25)",
                    borderRadius: 6,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: "'Share Tech Mono', monospace" }}>{m.value}</div>
                    <div style={{ fontSize: 9, color: "rgba(125,185,230,0.50)" }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Two-column layout */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                {/* Left column: pressure chart + cards */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Pressure chart */}
                  <div style={{
                    background: "#020B1A",
                    border: "1px solid rgba(0,180,255,0.25)",
                    borderRadius: 10, padding: "14px 16px",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 12,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#00D4FF", fontFamily: "'Share Tech Mono', monospace" }}>
                        ◈ 压力曲线 · 最近24小时
                      </span>
                      <div style={{ flex: 1 }} />
                        <div style={{ display: "flex", gap: 12, fontSize: 10, color: "rgba(125,185,230,0.65)" }}>
                        <span><span style={{ color: "#FF4D4D" }}>━━</span> 理论值</span>
                        <span><span style={{ color: "#2DE0A5" }}>━━</span> 实测值</span>
                      </div>
                    </div>

                    {anomaly && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 10px", borderRadius: 6,
                        background: "rgba(255,77,77,0.1)",
                        border: "1px solid rgba(255,77,77,0.3)",
                        marginBottom: 10, fontSize: 10, color: "#FF8080",
                      }}>
                        <span>⚠️</span>
                        <span>{anomaly.message}</span>
                      </div>
                    )}

                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart key={animKey} data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,100,200,0.25)" />
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(125,185,230,0.65)" }} />
                        <YAxis
                          domain={[0, 0.6]}
                          tick={{ fontSize: 9, fill: "rgba(125,185,230,0.65)" }}
                          label={{ value: "bar", angle: -90, position: "insideLeft", fontSize: 9, fill: "rgba(125,185,230,0.65)", dy: 15 }}
                        />
                        <Tooltip content={<PressureTooltip />} />
                        {anomaly && (
                          <ReferenceArea
                            x1={nodeData.pressureCurve.timeLabels[anomaly.startIndex]}
                            x2={nodeData.pressureCurve.timeLabels[anomaly.endIndex]}
                            fill="rgba(255,77,77,0.12)"
                            stroke="rgba(255,77,77,0.3)"
                            strokeWidth={1}
                          />
                        )}
                        <Line
                          type="monotone" dataKey="theory" stroke="#FF4D4D"
                          strokeWidth={2} dot={false} strokeDasharray="5 3"
                          isAnimationActive={true}
                        />
                        <Line
                          type="monotone" dataKey="actual" stroke="#2DE0A5"
                          strokeWidth={2.5} dot={{ r: 3, fill: "#2DE0A5", strokeWidth: 0 }}
                          isAnimationActive={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    {!anomaly && (
                      <div style={{
                        textAlign: "center", fontSize: 10, color: "#2DE0A5",
                        marginTop: 6, opacity: 0.8,
                      }}>
                        ✅ 绿线紧贴红线 · 水力模型正常
                      </div>
                    )}
                  </div>

                  {/* Diagnosis cards */}
                  <div style={{
                    background: "#020B1A",
                    border: "1px solid rgba(0,180,255,0.25)",
                    borderRadius: 10, padding: "14px 16px",
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: "#00D4FF",
                      marginBottom: 12, fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      ◈ 问题诊断卡片
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {sortedCards.map((card, idx) => {
                        const isTop = idx === 0;
                        const isExpanded = expandedCard === card.type;
                        const cardColor = CARD_COLOR[card.type];

                        return (
                          <div key={card.type}>
                            <div
                              onClick={() => setExpandedCard(isExpanded ? null : card.type)}
                              style={{
                                padding: "10px 14px",
                                background: isTop ? `${cardColor}12` : "rgba(0,15,50,0.6)",
                                border: `1px solid ${isTop ? cardColor + "50" : "rgba(0,100,200,0.2)"}`,
                                borderRadius: 8, cursor: "pointer",
                                opacity: isTop ? 1 : 0.6,
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14 }}>{CARD_ICON[card.type]}</span>
                                <span style={{ fontSize: 12, fontWeight: isTop ? 700 : 500, color: isTop ? cardColor : "rgba(125,185,230,0.65)" }}>
                                  {card.title}
                                </span>
                                {/* Confidence bar */}
                                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{
                                    flex: 1, height: 4, borderRadius: 2,
                                    background: "rgba(0,60,140,0.4)",
                                    overflow: "hidden",
                                  }}>
                                    <div style={{
                                      height: "100%", borderRadius: 2,
                                      width: `${card.confidence}%`,
                                      background: isTop ? cardColor : "rgba(255,255,255,0.2)",
                                      transition: "width 0.8s ease",
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700,
                                    color: isTop ? cardColor : "rgba(125,185,230,0.55)",
                                    fontFamily: "'Share Tech Mono', monospace",
                                    minWidth: 32,
                                  }}>
                                    {card.confidence}%
                                  </span>
                                </div>
                                <span style={{ fontSize: 10, color: "rgba(125,185,230,0.50)" }}>
                                  {isExpanded ? "▲" : "▼"}
                                </span>
                              </div>
                              <div style={{
                                fontSize: 10, color: isTop ? "rgba(200,230,255,0.9)" : "rgba(125,185,230,0.55)",
                                marginTop: 4, paddingLeft: 22,
                              }}>
                                {card.symptom}
                              </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div style={{
                                padding: "12px 14px",
                                background: `${cardColor}08`,
                                border: `1px solid ${cardColor}30`,
                                borderTop: "none",
                                borderRadius: "0 0 8px 8px",
                                fontSize: 10, lineHeight: 1.7,
                              }}>
                                <div style={{ color: "rgba(200,230,255,0.85)", marginBottom: 8 }}>
                                  {card.details.description}
                                </div>
                                {card.details.possibleCauses.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ color: cardColor, fontWeight: 600, marginBottom: 4 }}>可能原因</div>
                                    {card.details.possibleCauses.map((c, i) => (
                                      <div key={i} style={{ color: "rgba(125,185,230,0.65)", paddingLeft: 8 }}>• {c}</div>
                                    ))}
                                  </div>
                                )}
                                {card.details.suggestions.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ color: "#00D4FF", fontWeight: 600, marginBottom: 4 }}>处理建议</div>
                                    {card.details.suggestions.map((s, i) => (
                                      <div key={i} style={{ color: "rgba(125,185,230,0.65)", paddingLeft: 8 }}>→ {s}</div>
                                    ))}
                                  </div>
                                )}
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  padding: "6px 10px",
                                  background: "rgba(255,77,77,0.08)",
                                  border: "1px solid rgba(255,77,77,0.2)",
                                  borderRadius: 6, marginTop: 4,
                                }}>
                                  <span style={{ fontSize: 11 }}>🔥</span>
                                  <span style={{ color: "#FF8080", fontWeight: 600 }}>热损失估算：</span>
                                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{card.details.heatLoss}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right column: heat balance donut */}
                <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{
                    background: "#020B1A",
                    border: "1px solid rgba(0,180,255,0.25)",
                    borderRadius: 10, padding: "14px 16px",
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: "#00D4FF",
                      marginBottom: 12, fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      ◈ 热量去向审计
                    </div>

                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <DonutChart {...nodeData.heatBalance} />
                    </div>

                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { color: "#2DE0A5", label: "正常室温消耗", value: nodeData.heatBalance.normal },
                        { color: "#FFB347", label: "管网正常损耗", value: nodeData.heatBalance.acceptableLoss },
                        { color: "#FF4D4D", label: "异常损耗", value: nodeData.heatBalance.abnormalLoss },
                      ].map(item => (
                        <div key={item.label} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          fontSize: 10,
                        }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: item.color, flexShrink: 0,
                          }} />
                          <span style={{ flex: 1, color: "rgba(125,185,230,0.65)" }}>{item.label}</span>
                          <span style={{ color: item.color, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>
                            {item.value}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Report button */}
                  <button
                    onClick={() => setShowReport(true)}
                    style={{
                      padding: "10px 16px",
                      background: "rgba(26,86,219,0.06)",
                      border: "1px solid rgba(26,86,219,0.3)",
                      borderRadius: 8, cursor: "pointer",
                      fontSize: 11, fontWeight: 600,
                      color: "#00D4FF",
                      fontFamily: "'Noto Sans SC', sans-serif",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(26,86,219,0.12)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(26,86,219,0.06)")}
                  >
                    📋 查看详细诊断报告 →
                  </button>

                  {/* Summary conclusion */}
                  {topCard && (
                    <div style={{
                      padding: "12px",
                      background: `${CARD_COLOR[topCard.type]}10`,
                      border: `1px solid ${CARD_COLOR[topCard.type]}30`,
                      borderRadius: 8, fontSize: 10, lineHeight: 1.7,
                    }}>
                      <div style={{ color: CARD_COLOR[topCard.type], fontWeight: 600, marginBottom: 6 }}>
                        {CARD_ICON[topCard.type]} 主要诊断结论
                      </div>
                      <div style={{ color: "rgba(125,185,230,0.65)" }}>
                        {topCard.title}（置信度 {topCard.confidence}%）
                      </div>
                      <div style={{ color: "rgba(125,185,230,0.50)", marginTop: 4 }}>
                        {topCard.symptom}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReport && nodeData && (
        <div
          onClick={() => setShowReport(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 560, maxHeight: "80vh",
              background: "#020B1A",
              border: "1px solid rgba(0,180,255,0.25)",
              borderRadius: 16, overflow: "auto",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(200,230,255,0.92)" }}>
                📋 诊断报告 · {nodeData.nodeName}
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setShowReport(false)}
                style={{
                  background: "transparent", border: "none",
                  color: "rgba(125,185,230,0.50)", cursor: "pointer", fontSize: 18,
                }}
              >×</button>
            </div>

            {/* Report header */}
            <div style={{
              padding: "12px 16px",
              background: "rgba(0,15,50,0.7)",
              border: "1px solid rgba(0,180,255,0.25)",
              borderRadius: 8, marginBottom: 16,
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 8, fontSize: 11,
            }}>
              {[
                { label: "节点", value: nodeData.nodeName },
                { label: "健康状态", value: STATUS_LABEL[nodeData.status], color: STATUS_COLOR[nodeData.status] },
                { label: "当前室温", value: `${nodeData.roomTemp}°C` },
                { label: "供水温度", value: `${nodeData.supplyTemp}°C` },
                { label: "回水温度", value: `${nodeData.returnTemp}°C` },
                { label: "供回水温差", value: `${nodeData.tempDiff}°C`, color: nodeData.tempDiff < 5 || nodeData.tempDiff > 12 ? "#FFB347" : "#2DE0A5" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(125,185,230,0.50)" }}>{item.label}</span>
                  <span style={{ color: (item as any).color || "#1e2a3a", fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* All cards detail */}
            {sortedCards.map((card, idx) => (
              <div key={card.type} style={{
                marginBottom: 14, padding: "14px",
                background: idx === 0 ? `${CARD_COLOR[card.type]}10` : "rgba(0,15,50,0.6)",
                border: `1px solid ${idx === 0 ? CARD_COLOR[card.type] + "40" : "rgba(0,100,200,0.2)"}`,
                borderRadius: 10, opacity: idx === 0 ? 1 : 0.65,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14 }}>{CARD_ICON[card.type]}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: CARD_COLOR[card.type] }}>{card.title}</span>
                  <span style={{ fontSize: 11, color: CARD_COLOR[card.type], fontFamily: "'Share Tech Mono', monospace" }}>
                    置信度 {card.confidence}%
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(200,230,255,0.85)", lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 6 }}>{card.details.description}</div>
                  {card.details.possibleCauses.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: CARD_COLOR[card.type], fontWeight: 600 }}>可能原因：</span>
                      {card.details.possibleCauses.join("；")}
                    </div>
                  )}
                  {card.details.suggestions.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: "#00D4FF", fontWeight: 600 }}>处理建议：</span>
                      {card.details.suggestions.join("；")}
                    </div>
                  )}
                  <div>
                     <div style={{ color: "#EF4444", fontWeight: 600 }}>热损失：</div>
                    <span style={{ color: "rgba(200,230,255,0.85)" }}>{card.details.heatLoss}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Heat balance summary */}
            <div style={{
              padding: "12px 16px",
              background: "rgba(0,15,50,0.7)",
              border: "1px solid rgba(0,180,255,0.25)",
              borderRadius: 8, fontSize: 10,
            }}>
              <div style={{ color: "#00D4FF", fontWeight: 600, marginBottom: 8 }}>热量去向审计</div>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { color: "#2DE0A5", label: "正常室温消耗", value: nodeData.heatBalance.normal },
                  { color: "#FFB347", label: "管网正常损耗", value: nodeData.heatBalance.acceptableLoss },
                  { color: "#FF4D4D", label: "异常损耗", value: nodeData.heatBalance.abnormalLoss },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color, fontFamily: "'Share Tech Mono', monospace" }}>
                      {item.value}%
                    </div>
                    <div style={{ color: "rgba(125,185,230,0.65)" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
