/**
 * ColdWaveDemo.tsx — 模式A：寒潮场景演示（侧边栏模式）
 * 不遮挡系统图，在地图右侧显示步骤说明侧边栏
 * 同时通过 onAnnotationsChange 在地图对应位置显示标注框
 *
 * SVG坐标参考（viewBox 1100×820）：
 *   热源：(55, 430)
 *   换热站A：(230, 250)  换热站B：(230, 430)  换热站C：(230, 620)
 *   楼栋区域：x=410-740, y=130-620
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { DemoAnnotation } from "./HeatingSystemMap";

interface ColdWaveDemoProps {
  isActive: boolean;
  onClose: () => void;
  onAnnotationsChange?: (annotations: DemoAnnotation[]) => void;
  onWeatherChange?: (temp: number, type: "snowy") => void;
}

interface StepData {
  id: string;
  title: string;
  desc: string;
  duration: number;
  traditionalTemp: number;
  aiTemp: number;
  traditionalStatus: "normal" | "warning" | "danger";
  aiStatus: "normal" | "success";
  aiAction: string;
  traditionalAction: string;
  // Annotations to show on the map during this step
  annotations: DemoAnnotation[];
}

const STEPS: StepData[] = [
  {
    id: "weather-drop",
    title: "① 寒潮来袭",
    desc: "室外温度从 -3°C 骤降至 -15°C",
    duration: 4000,
    traditionalTemp: 21.0,
    aiTemp: 21.0,
    traditionalStatus: "normal",
    aiStatus: "normal",
    aiAction: "AI检测到气温骤降，正在计算热负荷...",
    traditionalAction: "系统正常运行，未检测到异常",
    annotations: [
      {
        id: "heat-src-weather",
        svgX: 55, svgY: 380,
        title: "⚠️ 寒潮预警",
        body: "室外-15°C，热负荷↑18%",
        color: "yellow",
        pulse: true,
      },
    ],
  },
  {
    id: "ai-predict",
    title: "② AI提前响应",
    desc: "AI预测未来6小时热负荷，提前调节",
    duration: 4000,
    traditionalTemp: 20.2,
    aiTemp: 20.8,
    traditionalStatus: "normal",
    aiStatus: "success",
    aiAction: "✅ 已提前调高供温 45°C→52°C，流量+15%",
    traditionalAction: "等待室温下降后再响应...",
    annotations: [
      {
        id: "heat-src-boost",
        svgX: 55, svgY: 380,
        title: "🔥 热源提升",
        body: "供温45→52°C，流量+15%",
        color: "green",
        pulse: false,
      },
      {
        id: "station-a-adjust",
        svgX: 230, svgY: 200,
        title: "⚙️ 换热站A调节",
        body: "二次侧流量+12%",
        color: "cyan",
        pulse: false,
      },
      {
        id: "station-b-adjust",
        svgX: 230, svgY: 380,
        title: "⚙️ 换热站B调节",
        body: "供温+3°C",
        color: "cyan",
        pulse: false,
      },
    ],
  },
  {
    id: "traditional-fail",
    title: "③ 传统系统滞后",
    desc: "传统系统反应延迟 2~3小时，室温下降",
    duration: 4000,
    traditionalTemp: 17.5,
    aiTemp: 20.2,
    traditionalStatus: "warning",
    aiStatus: "success",
    aiAction: "✅ 室温稳定保持在 20.2°C",
    traditionalAction: "❌ 室温已降至 17.5°C，用户投诉激增",
    annotations: [
      {
        id: "bldg-9-cold",
        svgX: 580, svgY: 430,
        title: "🔴 6号楼低温",
        body: "室温17.5°C < 18°C阈值",
        color: "red",
        pulse: true,
      },
      {
        id: "bldg-12-cold",
        svgX: 700, svgY: 620,
        title: "🔴 12号楼低温",
        body: "室温16.8°C，顶层偏冷",
        color: "red",
        pulse: true,
      },
      {
        id: "ai-stable",
        svgX: 480, svgY: 250,
        title: "✅ AI侧稳定",
        body: "室温20.2°C，正常",
        color: "green",
        pulse: false,
      },
    ],
  },
  {
    id: "ai-success",
    title: "④ AI精准调控",
    desc: "AI系统室温稳定，传统系统仍在追赶",
    duration: 4000,
    traditionalTemp: 18.8,
    aiTemp: 20.5,
    traditionalStatus: "warning",
    aiStatus: "success",
    aiAction: "✅ 三级联动完成，全区室温均衡",
    traditionalAction: "正在加大供热，追赶目标温度...",
    annotations: [
      {
        id: "all-stations-ok",
        svgX: 230, svgY: 430,
        title: "✅ 三站联动完成",
        body: "全区供热均衡调节",
        color: "green",
        pulse: false,
      },
      {
        id: "unit-level",
        svgX: 620, svgY: 250,
        title: "🏠 户端均衡",
        body: "顶/底层温差<1°C",
        color: "cyan",
        pulse: false,
      },
    ],
  },
  {
    id: "final-compare",
    title: "⑤ 最终对比",
    desc: "寒潮结束，AI系统全程领先",
    duration: 5000,
    traditionalTemp: 20.0,
    aiTemp: 21.2,
    traditionalStatus: "normal",
    aiStatus: "success",
    aiAction: "🏆 节能12% · 响应提前6h · 投诉减少80%",
    traditionalAction: "室温恢复正常，但已产生大量投诉",
    annotations: [
      {
        id: "final-result",
        svgX: 400, svgY: 430,
        title: "🏆 AI系统优势",
        body: "节能12% · 提前6h响应",
        color: "green",
        pulse: false,
      },
    ],
  },
];

export default function ColdWaveDemo({ isActive, onClose, onAnnotationsChange }: ColdWaveDemoProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  // Update map annotations when step changes
  useEffect(() => {
    if (isActive && isPlaying) {
      onAnnotationsChange?.(STEPS[currentStep]?.annotations ?? []);
    } else if (!isActive) {
      onAnnotationsChange?.([]);
    }
  }, [isActive, isPlaying, currentStep, onAnnotationsChange]);

  // Clear annotations on close
  useEffect(() => {
    if (!isActive) {
      clearTimers();
      setIsPlaying(false);
      setCurrentStep(0);
      setProgress(0);
      onAnnotationsChange?.([]);
    }
  }, [isActive, clearTimers, onAnnotationsChange]);

  const goToStep = useCallback((stepIdx: number) => {
    clearTimers();
    setCurrentStep(stepIdx);
    setProgress(0);
    onAnnotationsChange?.(STEPS[stepIdx]?.annotations ?? []);

    const step = STEPS[stepIdx];
    if (!step) return;

    let p = 0;
    progressRef.current = setInterval(() => {
      p += 100 / (step.duration / 100);
      setProgress(Math.min(100, p));
      if (p >= 100) {
        if (progressRef.current) clearInterval(progressRef.current);
      }
    }, 100);

    timerRef.current = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) {
        goToStep(stepIdx + 1);
      } else {
        setIsPlaying(false);
      }
    }, step.duration);
  }, [clearTimers, onAnnotationsChange]);

  const handlePlay = () => {
    setIsPlaying(true);
    goToStep(0);
  };

  const handlePause = () => {
    clearTimers();
    setIsPlaying(false);
  };

  const handleStepClick = (idx: number) => {
    clearTimers();
    setIsPlaying(false);
    setCurrentStep(idx);
    setProgress(0);
    onAnnotationsChange?.(STEPS[idx]?.annotations ?? []);
  };

  if (!isActive) return null;

  const step = STEPS[currentStep];

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
            🥶 寒潮场景演示
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(100,180,255,0.6)", marginTop: 2 }}>
            传统系统 vs AI系统对比
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "rgba(0,200,255,0.5)",
          fontSize: 18, cursor: "pointer", padding: "0 4px",
        }}>×</button>
      </div>

      {/* Step indicators */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,180,255,0.1)" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => handleStepClick(i)} style={{
              flex: 1, height: 4, borderRadius: 2, border: "none", cursor: "pointer",
              background: i === currentStep
                ? "#00D4FF"
                : i < currentStep
                  ? "rgba(0,212,255,0.4)"
                  : "rgba(0,80,120,0.4)",
              transition: "all 0.2s",
            }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "rgba(100,160,220,0.5)" }}>
          <span>步骤 {currentStep + 1}/{STEPS.length}</span>
          <span>{step.title}</span>
        </div>
      </div>

      {/* Current step content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {/* Step title */}
        <div style={{
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(0,40,80,0.5)",
          border: "1px solid rgba(0,180,255,0.2)",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#E0F4FF", marginBottom: 4, fontFamily: "'Noto Sans SC', sans-serif" }}>
            {step.title}
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(148,210,255,0.8)", lineHeight: 1.6, fontFamily: "'Noto Sans SC', sans-serif" }}>
            {step.desc}
          </div>
          {/* Progress bar */}
          {isPlaying && (
            <div style={{ marginTop: 8, height: 3, borderRadius: 1.5, background: "rgba(0,60,100,0.5)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 1.5,
                width: `${progress}%`,
                background: "linear-gradient(90deg, #00D4FF, #00FFB4)",
                transition: "width 0.1s linear",
              }} />
            </div>
          )}
        </div>

        {/* Traditional vs AI comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {/* Traditional */}
          <div style={{
            padding: "10px 10px", borderRadius: 10,
            background: step.traditionalStatus === "danger" ? "rgba(180,0,0,0.2)"
              : step.traditionalStatus === "warning" ? "rgba(180,80,0,0.2)"
              : "rgba(0,20,60,0.4)",
            border: `1px solid ${step.traditionalStatus === "danger" ? "rgba(239,68,68,0.4)"
              : step.traditionalStatus === "warning" ? "rgba(249,115,22,0.4)"
              : "rgba(0,80,120,0.3)"}`,
          }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(200,100,100,0.9)", marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif" }}>
              传统系统
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: step.traditionalStatus === "danger" ? "#EF4444" : step.traditionalStatus === "warning" ? "#F97316" : "#94A3B8", fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>
              {step.traditionalTemp}°C
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(200,150,150,0.7)", lineHeight: 1.5, fontFamily: "'Noto Sans SC', sans-serif" }}>
              {step.traditionalAction}
            </div>
          </div>
          {/* AI */}
          <div style={{
            padding: "10px 10px", borderRadius: 10,
            background: step.aiStatus === "success" ? "rgba(0,100,50,0.2)" : "rgba(0,20,60,0.4)",
            border: `1px solid ${step.aiStatus === "success" ? "rgba(34,197,94,0.4)" : "rgba(0,80,120,0.3)"}`,
          }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(100,200,150,0.9)", marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif" }}>
              AI系统
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: step.aiStatus === "success" ? "#22C55E" : "#7DD3FC", fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>
              {step.aiTemp}°C
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(100,200,150,0.7)", lineHeight: 1.5, fontFamily: "'Noto Sans SC', sans-serif" }}>
              {step.aiAction}
            </div>
          </div>
        </div>

        {/* Map annotations hint */}
        {isPlaying && step.annotations.length > 0 && (
          <div style={{
            padding: "8px 10px", borderRadius: 8,
            background: "rgba(0,40,80,0.4)",
            border: "1px solid rgba(0,180,255,0.15)",
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(0,200,255,0.7)", marginBottom: 4, fontFamily: "'Noto Sans SC', sans-serif" }}>
              📍 地图标注（{step.annotations.length}处）
            </div>
            {step.annotations.map(ann => (
              <div key={ann.id} style={{ fontSize: 8, color: "rgba(148,210,255,0.6)", marginBottom: 2, fontFamily: "'Noto Sans SC', sans-serif" }}>
                · {ann.title} — {ann.body}
              </div>
            ))}
          </div>
        )}

        {/* Step navigation */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => handleStepClick(i)} style={{
              padding: "4px 8px", borderRadius: 6, cursor: "pointer",
              fontSize: 8.5, fontFamily: "'Noto Sans SC', sans-serif",
              background: i === currentStep ? "rgba(0,180,255,0.3)" : "rgba(0,40,80,0.4)",
              color: i === currentStep ? "#00D4FF" : "rgba(148,210,255,0.6)",
              border: `1px solid ${i === currentStep ? "rgba(0,180,255,0.4)" : "rgba(0,80,120,0.2)"}`,
              transition: "all 0.15s",
            }}>
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Footer controls */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid rgba(0,180,255,0.12)",
        display: "flex", gap: 8,
      }}>
        {!isPlaying ? (
          <button onClick={handlePlay} style={{
            flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
            background: "linear-gradient(135deg, rgba(0,100,200,0.6), rgba(0,60,150,0.6))",
            color: "#00D4FF", fontSize: 11, fontWeight: 700,
            fontFamily: "'Noto Sans SC', sans-serif",
            outline: "1px solid rgba(0,180,255,0.3)",
          }}>
            ▶ 自动播放
          </button>
        ) : (
          <button onClick={handlePause} style={{
            flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
            background: "rgba(0,40,80,0.5)",
            color: "rgba(148,210,255,0.8)", fontSize: 11, fontWeight: 700,
            fontFamily: "'Noto Sans SC', sans-serif",
            outline: "1px solid rgba(0,80,120,0.3)",
          }}>
            ⏸ 暂停
          </button>
        )}
        <button onClick={() => { handleStepClick(0); }} style={{
          padding: "8px 12px", borderRadius: 8, cursor: "pointer",
          background: "rgba(0,40,80,0.4)",
          color: "rgba(148,210,255,0.6)", fontSize: 11,
          outline: "1px solid rgba(0,80,120,0.2)",
        }}>
          ↺
        </button>
      </div>
    </div>
  );
}
