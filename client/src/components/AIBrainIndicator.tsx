/**
 * AIBrainIndicator.tsx
 * AI大脑指示器 - 固定在地图顶部中央
 * 思考时持续闪烁发光，虚线连接到当前处理环节
 */
import { useEffect, useRef } from "react";

interface AIBrainIndicatorProps {
  isThinking: boolean;
  currentStep?: string;
  stepLabel?: string;
  mode?: "coldwave" | "realtime" | "interactive" | "idle";
}

export default function AIBrainIndicator({
  isThinking,
  currentStep,
  stepLabel,
  mode = "idle",
}: AIBrainIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef(0);

  // 绘制脉冲光晕动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (!isThinking) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      phaseRef.current += 0.04;
      const p = phaseRef.current;

      // 外层脉冲环
      for (let i = 0; i < 3; i++) {
        const r = 28 + i * 12 + Math.sin(p - i * 0.8) * 6;
        const alpha = 0.15 + 0.1 * Math.sin(p - i * 0.8);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 旋转粒子
      for (let i = 0; i < 8; i++) {
        const angle = p * 1.5 + (i / 8) * Math.PI * 2;
        const r = 22 + Math.sin(p * 2 + i) * 4;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${0.6 + 0.4 * Math.sin(p + i)})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isThinking]);

  const modeColors: Record<string, string> = {
    coldwave: "#ef4444",
    realtime: "#00d4ff",
    interactive: "#f59e0b",
    idle: "#6b7280",
  };

  const modeLabels: Record<string, string> = {
    coldwave: "寒潮演示",
    realtime: "实时运行",
    interactive: "自由操控",
    idle: "待机",
  };

  const color = modeColors[mode];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        userSelect: "none",
      }}
    >
      {/* AI大脑核心 */}
      <div style={{ position: "relative", width: 80, height: 80 }}>
        {/* 脉冲动画画布 */}
        <canvas
          ref={canvasRef}
          width={80}
          height={80}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        />
        {/* 核心圆 */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${color}33, ${color}11)`,
            border: `2px solid ${color}`,
            boxShadow: isThinking
              ? `0 0 20px ${color}88, 0 0 40px ${color}44`
              : `0 0 8px ${color}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "box-shadow 0.3s",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
            <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="2" r="1.2" fill="currentColor"/>
            <circle cx="9" cy="11" r="1.8" fill="currentColor" opacity="0.9"/>
            <circle cx="15" cy="11" r="1.8" fill="currentColor" opacity="0.9"/>
            <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
            <rect x="1" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/>
            <rect x="20" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/>
          </svg>
        </div>
      </div>

      {/* 模式标签 */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontFamily: "monospace",
          background: `${color}18`,
          border: `1px solid ${color}44`,
          borderRadius: 4,
          padding: "2px 8px",
          whiteSpace: "nowrap",
        }}
      >
        {modeLabels[mode]}
      </div>

      {/* 当前步骤 */}
      {isThinking && stepLabel && (
        <div
          style={{
            fontSize: 10,
            color: "#94a3b8",
            maxWidth: 120,
            textAlign: "center",
            lineHeight: 1.3,
            animation: "fadeInUp 0.3s ease",
          }}
        >
          {stepLabel}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
