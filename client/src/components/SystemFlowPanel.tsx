/**
 * SystemFlowPanel - 智慧供热系统运行流程图
 * 展示从外部输入到达到目标值的完整闭环流程
 */

const FLOW_STEPS = [
  {
    id: "input",
    icon: "🌐",
    title: "外部输入",
    subtitle: "全局外生变量（持续输入）",
    desc: "天气 / 时段 / 用户行为：同时影响当前室温和未来负荷",
    color: "#38BDF8",
    isWide: true,
  },
  {
    id: "identify",
    icon: "🔍",
    title: "室温辨识（当前值）",
    subtitle: "物理模型 + 数据驱动模型融合估计",
    desc: "基于室外气象 + 历史运行数据 + 少量真实室温",
    color: "#34D399",
    sub: [
      { icon: "⚙️", text: "参数识别：反推散热系数、热惯性时间常数、保温水平、供热响应速度" },
      { icon: "📐", text: "误差补偿：AI学习机理模型残差，修正'纸面楼'->'真实楼'" },
    ],
  },
  {
    id: "target",
    icon: "🎯",
    title: "目标室温设定",
    subtitle: "策略输入",
    desc: "设定所有用户满足最低温超过 18°C",
    color: "#F59E0B",
  },
  {
    id: "predict",
    icon: "📊",
    title: "四级热负荷预测（未来48h）",
    subtitle: "根据天气 + 当前状态 + 历史数据",
    desc: "户 → 楼栋 → 换热站 → 热源",
    color: "#A78BFA",
  },
  {
    id: "diff",
    icon: "📉",
    title: "差值计算",
    subtitle: "目标 - 当前 + 预测趋势",
    desc: "不只是现在冷不冷，还要看未来会不会更冷",
    color: "#FB923C",
  },
  {
    id: "decision",
    icon: "🧠",
    title: "系统决策",
    subtitle: "热源 → 换热站 → 楼栋 → 户阀 四级调控",
    desc: "全网水力 + 热力优化模型：室温 → 热负荷 → 控制参数",
    color: "#60A5FA",
    sub: [
      { icon: "🔄", text: "四种调控模式：选择最优调控模式" },
    ],
  },
  {
    id: "execute",
    icon: "⚡",
    title: "执行层：下发四级调节指令",
    subtitle: "自动调节",
    desc: "换热站调节（供温/流量/压差）→ 调节阀门开度 → 确定二网热量总量",
    color: "#EF4444",
  },
  {
    id: "valve-balance",
    icon: "🔧",
    title: "楼阀平衡（二网分配）",
    subtitle: "决定热量如何分配到各楼",
    desc: "调楼前阀门，让各楼分得合理",
    color: "#F472B6",
  },
  {
    id: "unit-valve",
    icon: "🏠",
    title: "户阀调节（末端细调）",
    subtitle: "解决楼内不均",
    desc: "精细化调节各户阀门开度",
    color: "#34D399",
  },
  {
    id: "temp-change",
    icon: "🌡️",
    title: "室温变化（反馈）",
    subtitle: "17.2 → 20 → 21.5 → 22°C",
    desc: "关键不是'变热'，而是：全部收敛到目标值",
    color: "#38BDF8",
  },
  {
    id: "converge",
    icon: "✅",
    title: "达到目标值（闭环收敛）",
    subtitle: "实时采集运行数据，回到第一步持续迭代",
    desc: "所有楼温度逐渐变一致 · 颜色统一",
    color: "#22C55E",
    isWide: true,
  },
];

export default function SystemFlowPanel() {
  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "10px 10px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      background: "transparent",
    }}>
      {/* Title */}
      <div style={{
        fontSize: 11, fontWeight: 800, color: "rgba(0,212,255,0.9)",
        fontFamily: "'Noto Sans SC', sans-serif",
        letterSpacing: 1.5,
        padding: "6px 4px 8px",
        borderBottom: "1px solid rgba(0,180,255,0.15)",
        marginBottom: 8,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>⚙️</span>
        智慧供热系统运行流程
      </div>

      {/* Flow steps */}
      {FLOW_STEPS.map((step, idx) => (
        <div key={step.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Step card */}
          <div style={{
            width: "100%",
            padding: "7px 10px",
            borderRadius: 8,
            background: `rgba(0,20,60,0.6)`,
            border: `1px solid ${step.color}35`,
            borderLeft: `3px solid ${step.color}`,
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{step.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 800, color: step.color,
                  fontFamily: "'Noto Sans SC', sans-serif",
                  lineHeight: 1.3,
                }}>{step.title}</div>
                <div style={{
                  fontSize: 9, color: "rgba(148,210,255,0.75)",
                  fontFamily: "'Noto Sans SC', sans-serif",
                  marginTop: 1, lineHeight: 1.4,
                }}>{step.subtitle}</div>
                <div style={{
                  fontSize: 8.5, color: "rgba(100,160,220,0.6)",
                  fontFamily: "'Noto Sans SC', sans-serif",
                  marginTop: 2, lineHeight: 1.4,
                }}>{step.desc}</div>
                {/* Sub items */}
                {step.sub && (
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    {step.sub.map((s, si) => (
                      <div key={si} style={{
                        display: "flex", alignItems: "flex-start", gap: 5,
                        padding: "3px 6px", borderRadius: 4,
                        background: "rgba(0,40,100,0.3)",
                        border: "1px solid rgba(0,120,255,0.15)",
                      }}>
                        <span style={{ fontSize: 9, flexShrink: 0 }}>{s.icon}</span>
                        <span style={{ fontSize: 8, color: "rgba(148,210,255,0.7)", fontFamily: "'Noto Sans SC', sans-serif", lineHeight: 1.4 }}>{s.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Arrow connector (not after last step) */}
          {idx < FLOW_STEPS.length - 1 && (
            <div style={{
              width: 2, height: 10,
              background: `linear-gradient(to bottom, ${FLOW_STEPS[idx].color}60, ${FLOW_STEPS[idx + 1].color}60)`,
              position: "relative",
              flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)",
                width: 0, height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: `5px solid ${FLOW_STEPS[idx + 1].color}80`,
              }} />
            </div>
          )}
        </div>
      ))}

      {/* Loop indicator */}
      <div style={{
        marginTop: 10, padding: "6px 10px", borderRadius: 8,
        background: "rgba(0,40,100,0.4)",
        border: "1px solid rgba(0,180,255,0.2)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>🔄</span>
        <span style={{ fontSize: 9, color: "rgba(0,212,255,0.7)", fontFamily: "'Noto Sans SC', sans-serif", lineHeight: 1.5 }}>
          闭环持续迭代 · 实时采集运行数据 · 回到第一步
        </span>
      </div>
    </div>
  );
}
