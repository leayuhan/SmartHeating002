/**
 * DemoPlaybar.tsx — 底部演示播放控制条（7阶段版）
 * 阶段：算法训练→感知→预警→诊断→决策→执行→完成
 * 特性：
 * - GSAP平滑进度条
 * - 播放/暂停/重置按钮
 * - 阶段进度点+连接线
 * - 当前阶段高亮+倒计时
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export const DEMO_PHASES = [
  { id: 0, label: "算法训练", duration: 7,  icon: "⚙", color: "#7DD3FC", desc: "模型加载中" },
  { id: 1, label: "感知",     duration: 4,  icon: "👁", color: "#60A5FA", desc: "实时数据采集" },
  { id: 2, label: "预警",     duration: 5,  icon: "⚠", color: "#EF4444", desc: "低温告警触发" },
  { id: 3, label: "诊断",     duration: 5,  icon: "🔍", color: "#F59E0B", desc: "AI根因分析" },
  { id: 4, label: "决策",     duration: 7,  icon: "🧠", color: "#A78BFA", desc: "策略评估选择" },
  { id: 5, label: "执行",     duration: 13, icon: "⚡", color: "#3B82F6", desc: "三级联动调控" },
  { id: 6, label: "完成",     duration: 4,  icon: "✓",  color: "#22C55E", desc: "温度恢复正常" },
];

export const TOTAL_DURATION = DEMO_PHASES.reduce((a, p) => a + p.duration, 0);

interface DemoPlaybarProps {
  isDemoRunning: boolean;
  demoPhase: number;
  demoProgress: number; // 0-100
  onStart: () => void;
  onStop: () => void;
  onRestart?: () => void;
  onSeek?: (phase: number) => void;
}

export default function DemoPlaybar({
  isDemoRunning,
  demoPhase,
  demoProgress,
  onStart,
  onStop,
  onRestart,
  onSeek,
}: DemoPlaybarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  // GSAP平滑进度条
  useEffect(() => {
    if (barRef.current) {
      gsap.to(barRef.current, {
        width: `${isDemoRunning ? demoProgress : 0}%`,
        duration: 0.4,
        ease: "power1.out",
      });
    }
  }, [demoProgress, isDemoRunning]);

  const elapsed   = (demoProgress / 100) * TOTAL_DURATION;
  const remaining = Math.max(0, TOTAL_DURATION - elapsed);
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = Math.floor(remaining % 60).toString().padStart(2, "0");

  const currentPhaseInfo = DEMO_PHASES[demoPhase] ?? DEMO_PHASES[0];

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      zIndex: 50,
      background: "rgba(2,8,30,0.96)",
      borderTop: "1px solid rgba(0,180,255,0.2)",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.5), 0 -1px 0 rgba(0,180,255,0.1)",
      padding: "8px 16px 10px",
    }}>
      {/* 阶段进度点 */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 4, maxWidth: 900, margin: "0 auto 4px" }}>
        {DEMO_PHASES.map((phase, i) => {
          const isActive  = isDemoRunning && phase.id === demoPhase;
          const isDone    = isDemoRunning && phase.id < demoPhase;
          return (
            <div key={phase.id} style={{ display: "flex", alignItems: "center", flex: i < DEMO_PHASES.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <button
                  onClick={() => onSeek?.(phase.id)}
                  title={`跳转: ${phase.label}`}
                  style={{
                    width: isActive ? 26 : 20,
                    height: isActive ? 26 : 20,
                    borderRadius: "50%",
                    border: `2px solid ${isActive ? phase.color : isDone ? `${phase.color}80` : "rgba(0,100,200,0.3)"}`,
                    background: isActive
                      ? `${phase.color}25`
                      : isDone
                      ? `${phase.color}15`
                      : "rgba(0,20,60,0.5)",
                    color: isActive ? phase.color : isDone ? `${phase.color}cc` : "rgba(100,150,200,0.4)",
                    fontSize: isActive ? 12 : 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: onSeek ? "pointer" : "default",
                    flexShrink: 0,
                    transition: "all 0.3s",
                    boxShadow: isActive ? `0 0 14px ${phase.color}80, 0 0 28px ${phase.color}30` : "none",
                    animation: isActive && isDemoRunning ? "phase-pulse 1.5s ease-in-out infinite" : "none",
                  }}
                >
                  {phase.icon}
                </button>
                <span style={{
                  fontSize: 8,
                  color: isActive ? phase.color : isDone ? `${phase.color}80` : "rgba(100,150,200,0.35)",
                  fontFamily: "'Noto Sans SC', sans-serif",
                  fontWeight: isActive ? 700 : 400,
                  whiteSpace: "nowrap",
                  textShadow: isActive ? `0 0 6px ${phase.color}60` : "none",
                  transition: "all 0.3s",
                }}>
                  {phase.label}
                </span>
              </div>
              {/* 连接线 */}
              {i < DEMO_PHASES.length - 1 && (
                <div style={{
                  flex: 1, height: 2,
                  background: isDone
                    ? `linear-gradient(90deg, ${phase.color}80, ${DEMO_PHASES[i+1].color}80)`
                    : "rgba(0,60,150,0.25)",
                  margin: "0 2px",
                  marginBottom: 14,
                  borderRadius: 1,
                  transition: "background 0.5s",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 总进度条 + 控制按钮 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 900, margin: "0 auto" }}>
        {/* 播放/暂停 */}
        <button
          onClick={isDemoRunning ? onStop : onStart}
          style={{
            width: 34, height: 34,
            borderRadius: "50%",
            border: `2px solid ${isDemoRunning ? "rgba(255,80,80,0.6)" : "rgba(0,212,255,0.6)"}`,
            background: isDemoRunning ? "rgba(80,0,0,0.4)" : "rgba(0,40,120,0.5)",
            color: isDemoRunning ? "#FF6060" : "#00D4FF",
            fontSize: 13,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: isDemoRunning ? "0 0 10px rgba(255,80,80,0.4)" : "0 0 10px rgba(0,180,255,0.4)",
            transition: "all 0.2s",
          }}
        >
          {isDemoRunning ? "⏸" : "▶"}
        </button>

        {/* 重置 */}
        {onRestart && (
          <button
            onClick={onRestart}
            title="重新开始"
            style={{
              width: 28, height: 28,
              borderRadius: "50%",
              border: "1px solid rgba(0,100,200,0.3)",
              background: "rgba(0,20,60,0.5)",
              color: "rgba(100,160,220,0.6)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
            ↺
          </button>
        )}

        {/* 进度条 */}
        <div style={{
          flex: 1,
          height: 5,
          background: "rgba(0,40,100,0.4)",
          borderRadius: 3,
          overflow: "hidden",
          position: "relative",
        }}>
          <div
            ref={barRef}
            style={{
              height: "100%",
              width: "0%",
              background: "linear-gradient(90deg, #1A56DB, #00D4FF, #22C55E)",
              borderRadius: 3,
              boxShadow: "0 0 6px rgba(0,212,255,0.5)",
            }}
          />
        </div>

        {/* 倒计时 */}
        <div style={{
          fontSize: 11,
          fontFamily: "'Share Tech Mono', monospace",
          color: isDemoRunning ? "rgba(0,200,255,0.8)" : "rgba(100,150,200,0.4)",
          flexShrink: 0,
          minWidth: 40,
          textAlign: "right",
        }}>
          {isDemoRunning ? `${mm}:${ss}` : `${Math.floor(TOTAL_DURATION / 60)}:${(TOTAL_DURATION % 60).toString().padStart(2, "0")}`}
        </div>

        {/* 当前阶段名 */}
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: isDemoRunning ? currentPhaseInfo.color : "rgba(100,150,200,0.4)",
          fontFamily: "'Noto Sans SC', sans-serif",
          flexShrink: 0,
          textShadow: isDemoRunning ? `0 0 8px ${currentPhaseInfo.color}60` : "none",
          minWidth: 56,
          textAlign: "right",
          transition: "all 0.3s",
        }}>
          {isDemoRunning ? currentPhaseInfo.desc : "点击▶启动"}
        </div>
      </div>

      <style>{`
        @keyframes phase-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
