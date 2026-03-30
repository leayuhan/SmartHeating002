/**
 * ThermalInertiaFormula.tsx
 * 热惰性公式动画 — 气象预警阶段全屏显示
 * T(t) = T_target - ΔT × (1 - e^(-t/τ))
 * 公式逐段出现 + 曲线实时绘制
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface ThermalInertiaFormulaProps {
  visible: boolean;
  targetTemp?: number;
  deltaTemp?: number;
  tau?: number; // 热惰性时间常数（小时）
  onComplete?: () => void;
}

export default function ThermalInertiaFormula({
  visible,
  targetTemp = 22,
  deltaTemp = 5,
  tau = 2.5,
  onComplete,
}: ThermalInertiaFormulaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [formulaStep, setFormulaStep] = useState(0);
  // 0: hidden, 1: T(t)=, 2: T_target, 3: -ΔT×, 4: (1-e^-t/τ), 5: full+curve

  useEffect(() => {
    if (!visible) {
      setFormulaStep(0);
      return;
    }

    const tl = gsap.timeline();
    tl.call(() => setFormulaStep(1), [], 0.3)
      .call(() => setFormulaStep(2), [], 0.9)
      .call(() => setFormulaStep(3), [], 1.5)
      .call(() => setFormulaStep(4), [], 2.1)
      .call(() => setFormulaStep(5), [], 2.8)
      .call(() => onComplete?.(), [], 6.5);

    return () => { tl.kill(); };
  }, [visible, onComplete]);

  // Canvas曲线绘制
  useEffect(() => {
    if (formulaStep < 5) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let progress = 0;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // grid
      ctx.strokeStyle = 'rgba(16,185,129,0.1)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x += W / 8) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += H / 5) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // axes
      ctx.strokeStyle = 'rgba(16,185,129,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, H - 20);
      ctx.lineTo(W - 10, H - 20);
      ctx.moveTo(30, H - 20);
      ctx.lineTo(30, 10);
      ctx.stroke();

      // axis labels
      ctx.fillStyle = 'rgba(16,185,129,0.7)';
      ctx.font = '10px monospace';
      ctx.fillText('时间 t (h)', W - 60, H - 5);
      ctx.fillText('室温 T (°C)', 32, 18);

      // target line
      const targetY = H - 20 - ((targetTemp - (targetTemp - deltaTemp)) / (deltaTemp + 2)) * (H - 40);
      ctx.strokeStyle = 'rgba(16,185,129,0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(30, targetY);
      ctx.lineTo(W - 10, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(16,185,129,0.6)';
      ctx.fillText(`T_target = ${targetTemp}°C`, W - 110, targetY - 4);

      // curve
      const maxT = 12; // hours
      const plotW = W - 50;
      const plotH = H - 40;

      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;

      for (let px = 0; px <= plotW * progress; px++) {
        const t = (px / plotW) * maxT;
        const temp = targetTemp - deltaTemp * (1 - Math.exp(-t / tau));
        const py = H - 20 - ((temp - (targetTemp - deltaTemp)) / (deltaTemp + 2)) * plotH;
        if (px === 0) ctx.moveTo(30 + px, py);
        else ctx.lineTo(30 + px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // current point glow
      if (progress > 0) {
        const t = progress * maxT;
        const temp = targetTemp - deltaTemp * (1 - Math.exp(-t / tau));
        const px = 30 + plotW * progress;
        const py = H - 20 - ((temp - (targetTemp - deltaTemp)) / (deltaTemp + 2)) * plotH;

        const grad = ctx.createRadialGradient(px, py, 0, px, py, 10);
        grad.addColorStop(0, 'rgba(16,185,129,0.9)');
        grad.addColorStop(1, 'rgba(16,185,129,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      if (progress < 1) {
        progress = Math.min(1, progress + 0.008);
        animId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [formulaStep, targetTemp, deltaTemp, tau]);

  if (!visible) return null;

  const formulaParts = [
    { text: 'T(t)', color: '#f0f9ff', show: formulaStep >= 1 },
    { text: ' = ', color: '#94a3b8', show: formulaStep >= 1 },
    { text: `${targetTemp}`, color: '#10b981', show: formulaStep >= 2 },
    { text: ' − ', color: '#94a3b8', show: formulaStep >= 3 },
    { text: `${deltaTemp}`, color: '#f59e0b', show: formulaStep >= 3 },
    { text: ' × (1 − e', color: '#94a3b8', show: formulaStep >= 4 },
    { text: ` −t/${tau}`, color: '#06b6d4', show: formulaStep >= 4, superscript: true },
    { text: ')', color: '#94a3b8', show: formulaStep >= 4 },
  ];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        zIndex: 300,
        background: 'rgba(2,11,26,0.92)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* 标题 */}
      <div
        className="text-xs font-mono mb-4 tracking-widest"
        style={{ color: '#10b981', opacity: formulaStep >= 1 ? 1 : 0, transition: 'opacity 0.5s' }}
      >
        ◈ 热惰性模型 · 室温响应预测
      </div>

      {/* 公式 */}
      <div className="flex items-baseline gap-0 mb-6" style={{ fontSize: 28, fontFamily: 'monospace' }}>
        {formulaParts.map((part, i) => (
          <span
            key={i}
            style={{
              color: part.color,
              opacity: part.show ? 1 : 0,
              transform: part.show ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.4s, transform 0.4s',
              fontSize: part.superscript ? 14 : undefined,
              verticalAlign: part.superscript ? 'super' : undefined,
            }}
          >
            {part.text}
          </span>
        ))}
      </div>

      {/* 参数说明 */}
      {formulaStep >= 4 && (
        <div
          className="flex gap-6 mb-5 text-xs font-mono"
          style={{ opacity: formulaStep >= 4 ? 1 : 0, transition: 'opacity 0.5s' }}
        >
          <span style={{ color: '#10b981' }}>T_target = {targetTemp}°C（目标室温）</span>
          <span style={{ color: '#f59e0b' }}>ΔT = {deltaTemp}°C（温差）</span>
          <span style={{ color: '#06b6d4' }}>τ = {tau}h（热惰性常数）</span>
        </div>
      )}

      {/* 曲线Canvas */}
      <div
        style={{
          width: 480,
          height: 160,
          opacity: formulaStep >= 5 ? 1 : 0,
          transition: 'opacity 0.6s',
          position: 'relative',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* 底部说明 */}
      {formulaStep >= 5 && (
        <div
          className="mt-4 text-xs text-center"
          style={{ color: '#64748b', maxWidth: 400 }}
        >
          预测：室外降温后，室温将在 {tau * 2}h 内下降约 {(deltaTemp * 0.86).toFixed(1)}°C
          <br />
          AI已提前 6h 发出预警，触发供热策略调整
        </div>
      )}
    </div>
  );
}
