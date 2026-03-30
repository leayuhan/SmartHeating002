/**
 * FiveStepLoop.tsx — 模式B：智慧供热闭环系统流程（侧边栏模式）
 * 展示完整的室温辨识→预测→决策→执行→反馈闭环
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { DemoAnnotation } from "./HeatingSystemMap";

interface FiveStepLoopProps {
  isActive: boolean;
  onClose: () => void;
  currentWeatherTemp?: number;
  onStepChange?: (step: number, label: string) => void;
  onAnnotationsChange?: (annotations: DemoAnnotation[]) => void;
}

interface LoopStep {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
  duration: number;
  dataLines: string[];
  aiThought: string;
  annotations: DemoAnnotation[];
}

const LOOP_STEPS: LoopStep[] = [
  {
    id: 0,
    icon: "🌍",
    title: "外部输入",
    subtitle: "天气 / 时段 / 用户行为",
    duration: 4000,
    dataLines: [
      "室外温度：-8.5°C（持续下降）",
      "风速：4.2 m/s（北风）",
      "时段：供热高峰期 18:00-22:00",
      "用户行为：回家率 87%",
      "全局外生变量持续输入中...",
    ],
    aiThought: "外部输入同时影响当前室温和未来负荷，正在融合多源数据...",
    annotations: [
      {
        id: "weather-input",
        svgX: 55, svgY: 370,
        title: "🌍 外部输入",
        body: "室外-8.5°C，高峰时段",
        color: "cyan",
        pulse: true,
      },
    ],
  },
  {
    id: 1,
    icon: "🔍",
    title: "室温辨识",
    subtitle: "物理模型 + AI 融合估计",
    duration: 4500,
    dataLines: [
      "物理机理模型：热力学方程",
      "AI数据驱动：历史运行学习",
      "参数识别：散热系数 / 热惯性",
      "误差补偿：模型残差修正",
      "当前室温估计精度：±0.3°C",
    ],
    aiThought: "融合物理模型与AI，反推楼栋真实散热系数和热惯性时间常数...",
    annotations: [
      {
        id: "temp-identify",
        svgX: 230, svgY: 200,
        title: "🔍 室温辨识",
        body: "物理+AI融合估计",
        color: "blue",
        pulse: true,
      },
    ],
  },
  {
    id: 2,
    icon: "📊",
    title: "四级热负荷预测",
    subtitle: "未来48h：户→楼→换热站→热源",
    duration: 4000,
    dataLines: [
      "户级预测：各户热需求曲线",
      "楼栋聚合：9栋总负荷预测",
      "换热站汇总：三站分配方案",
      "热源总量：48h负荷预测",
      "预测精度：MAE < 2.1%",
    ],
    aiThought: "四级热负荷预测完成，峰值将在凌晨2点出现，提前锁定热量储备...",
    annotations: [
      {
        id: "load-predict",
        svgX: 55, svgY: 200,
        title: "📊 负荷预测",
        body: "四级预测，48h前瞻",
        color: "blue",
        pulse: false,
      },
      {
        id: "station-a-predict",
        svgX: 230, svgY: 200,
        title: "📊 换热站A",
        body: "预测需求+15%",
        color: "cyan",
        pulse: false,
      },
    ],
  },
  {
    id: 3,
    icon: "⚡",
    title: "系统决策",
    subtitle: "差值计算 + 四级调控模式",
    duration: 4000,
    dataLines: [
      "差值：目标 - 当前 + 预测趋势",
      "全网水力+热力优化计算",
      "室温→热负荷→控制参数转换",
      "调控模式：精准供热模式",
      "四级指令：热源→换热站→楼阀→户阀",
    ],
    aiThought: "不只看现在冷不冷，还要看未来会不会更冷，生成最优调控方案...",
    annotations: [
      {
        id: "decision-center",
        svgX: 55, svgY: 430,
        title: "⚡ 系统决策",
        body: "四级联动调控方案",
        color: "yellow",
        pulse: true,
      },
    ],
  },
  {
    id: 4,
    icon: "⚙️",
    title: "执行层下发",
    subtitle: "换热站→楼阀→户阀 自动调节",
    duration: 4000,
    dataLines: [
      "换热站调节：供温/流量/压差",
      "楼阀平衡：热量合理分配",
      "户阀细调：解决楼内不均",
      "调节阀门开度：精准执行",
      "确定二网热量总量",
    ],
    aiThought: "三级联动调节执行中：换热站→楼阀→户阀，预计45分钟后室温收敛...",
    annotations: [
      {
        id: "station-b-exec",
        svgX: 230, svgY: 430,
        title: "⚙️ 换热站B",
        body: "流量+18%，已执行",
        color: "green",
        pulse: false,
      },
      {
        id: "bldg-valve-exec",
        svgX: 580, svgY: 430,
        title: "✅ 楼阀调节",
        body: "楼阀45→72%，户阀联动",
        color: "green",
        pulse: true,
      },
    ],
  },
  {
    id: 5,
    icon: "🌡️",
    title: "室温反馈",
    subtitle: "全部收敛到目标值 · 闭环迭代",
    duration: 4500,
    dataLines: [
      "室温变化：17.2→20→21.5→22°C",
      "关键：全部收敛到目标值",
      "所有楼温度逐渐变一致",
      "实时采集运行数据",
      "回到第一步持续迭代",
    ],
    aiThought: "室温正在收敛，目标不是变热，而是全部收敛到设定值，闭环完成...",
    annotations: [
      {
        id: "temp-feedback",
        svgX: 440, svgY: 200,
        title: "🌡️ 室温反馈",
        body: "17.2→22°C 收敛中",
        color: "green",
        pulse: true,
      },
    ],
  },
];

export default function FiveStepLoop({
  isActive,
  onClose,
  currentWeatherTemp = -8.5,
  onStepChange,
  onAnnotationsChange,
}: FiveStepLoopProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [round, setRound] = useState(1);
  const [stepProgress, setStepProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  const runStep = useCallback((stepIdx: number) => {
    clearTimers();
    const step = LOOP_STEPS[stepIdx];
    if (!step) return;

    setCurrentStep(stepIdx);
    setStepProgress(0);
    onStepChange?.(stepIdx, step.title);
    onAnnotationsChange?.(step.annotations);

    let p = 0;
    progressRef.current = setInterval(() => {
      p += 100 / (step.duration / 100);
      setStepProgress(Math.min(100, p));
      if (p >= 100 && progressRef.current) clearInterval(progressRef.current);
    }, 100);

    timerRef.current = setTimeout(() => {
      const nextStep = (stepIdx + 1) % LOOP_STEPS.length;
      if (nextStep === 0) setRound(r => r + 1);
      runStep(nextStep);
    }, step.duration);
  }, [clearTimers, onStepChange, onAnnotationsChange]);

  useEffect(() => {
    if (isActive) {
      setRound(1);
      runStep(0);
    } else {
      clearTimers();
      setCurrentStep(0);
      setStepProgress(0);
      onAnnotationsChange?.([]);
    }
  }, [isActive]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  if (!isActive) return null;

  const step = LOOP_STEPS[currentStep];

  return (
    <div style={{
      position: "fixed",
      top: 0, right: 0,
      width: 300,
      height: "100vh",
      zIndex: 50,
      background: "rgba(0,8,30,0.97)",
      borderLeft: "1.5px solid rgba(0,200,255,0.25)",
      display: "flex",
      flexDirection: "column",
      boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
      backdropFilter: "blur(12px)",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid rgba(0,180,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#00D4FF", fontFamily: "'Noto Sans SC', sans-serif" }}>
            ⚡ 智慧供热闭环系统
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(100,180,255,0.6)", marginTop: 2 }}>
            第 {round} 轮迭代 · 室外 {currentWeatherTemp}°C
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "rgba(0,200,255,0.5)",
          fontSize: 18, cursor: "pointer", padding: "0 4px",
        }}>×</button>
      </div>

      {/* Six steps flow */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,180,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {LOOP_STEPS.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: i === currentStep
                  ? "rgba(0,212,255,0.25)"
                  : i < currentStep
                  ? "rgba(0,200,100,0.15)"
                  : "rgba(0,30,80,0.6)",
                border: `1.5px solid ${i === currentStep ? "#00D4FF" : i < currentStep ? "#00FF9D" : "rgba(0,100,180,0.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12,
                flexShrink: 0,
                transition: "all 0.3s",
                boxShadow: i === currentStep ? "0 0 10px rgba(0,212,255,0.4)" : "none",
              }}>
                {i < currentStep ? "✓" : s.icon}
              </div>
              {i < LOOP_STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 1.5,
                  background: i < currentStep
                    ? "linear-gradient(90deg, #00FF9D, rgba(0,212,255,0.5))"
                    : "rgba(0,100,180,0.2)",
                  transition: "background 0.5s",
                }} />
              )}
            </div>
          ))}
        </div>
        {/* Step labels */}
        <div style={{ display: "flex", marginTop: 4 }}>
          {LOOP_STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, textAlign: "center",
              fontSize: 7.5, fontFamily: "'Noto Sans SC', sans-serif",
              color: i === currentStep ? "#00D4FF" : i < currentStep ? "#00FF9D" : "rgba(100,160,220,0.4)",
              fontWeight: i === currentStep ? 700 : 400,
              transition: "color 0.3s",
            }}>
              {s.title}
            </div>
          ))}
        </div>
      </div>

      {/* Current step detail */}
      <div style={{ flex: 1, padding: "12px 14px", overflowY: "auto" }}>
        {/* Step header */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{step.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#00D4FF", fontFamily: "'Noto Sans SC', sans-serif" }}>
                {step.title}
              </div>
              <div style={{ fontSize: 9.5, color: "rgba(100,180,255,0.6)", fontFamily: "'Noto Sans SC', sans-serif" }}>
                {step.subtitle}
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, borderRadius: 2, background: "rgba(0,40,100,0.5)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${stepProgress}%`,
              background: "linear-gradient(90deg, #0080FF, #00D4FF)",
              transition: "width 0.1s linear",
              boxShadow: "0 0 6px rgba(0,212,255,0.5)",
            }} />
          </div>
        </div>

        {/* Data lines */}
        <div style={{
          background: "rgba(0,20,60,0.6)",
          border: "1px solid rgba(0,180,255,0.12)",
          borderRadius: 8, padding: "8px 10px", marginBottom: 10,
        }}>
          {step.dataLines.map((line, i) => (
            <div key={i} style={{
              fontSize: 9.5, color: "rgba(148,210,255,0.85)",
              fontFamily: "'Share Tech Mono', monospace",
              padding: "2px 0",
              borderBottom: i < step.dataLines.length - 1 ? "1px solid rgba(0,100,180,0.1)" : "none",
              opacity: stepProgress > (i / step.dataLines.length) * 100 ? 1 : 0.3,
              transition: "opacity 0.3s",
            }}>
              <span style={{ color: "rgba(0,212,255,0.4)", marginRight: 4 }}>›</span>
              {line}
            </div>
          ))}
        </div>

        {/* AI thought */}
        <div style={{
          background: "rgba(80,0,120,0.2)",
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: 8, padding: "8px 10px",
        }}>
          <div style={{ fontSize: 8.5, color: "rgba(139,92,246,0.7)", marginBottom: 4, fontFamily: "'Noto Sans SC', sans-serif" }}>
            🧠 AI 决策思路
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(200,180,255,0.85)", fontFamily: "'Noto Sans SC', sans-serif", lineHeight: 1.5 }}>
            {step.aiThought}
          </div>
        </div>

        {/* Closed loop indicator */}
        <div style={{
          marginTop: 12, padding: "8px 10px",
          background: "rgba(0,30,60,0.5)",
          border: "1px solid rgba(0,180,255,0.1)",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 9, color: "rgba(0,212,255,0.5)", fontFamily: "'Noto Sans SC', sans-serif", marginBottom: 4 }}>
            闭环迭代状态
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 8.5, color: "rgba(100,180,255,0.6)", fontFamily: "'Share Tech Mono', monospace" }}>
              目标室温：18°C 最低保障
            </div>
            <div style={{
              padding: "2px 8px", borderRadius: 10,
              background: "rgba(0,200,100,0.1)",
              border: "1px solid rgba(0,200,100,0.3)",
              fontSize: 8.5, color: "#00FF9D",
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              第 {round} 轮
            </div>
          </div>
          <div style={{ marginTop: 4, fontSize: 8.5, color: "rgba(100,180,255,0.5)", fontFamily: "'Noto Sans SC', sans-serif" }}>
            实时采集 → 辨识 → 预测 → 决策 → 执行 → 反馈
          </div>
        </div>
      </div>
    </div>
  );
}
