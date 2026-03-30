/**
 * EnergyDashboard.tsx
 * 右上角常驻能耗看板
 * COP / 节能% / 减碳kg/h + 绿色粒子上升动画
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface EnergyMetrics {
  cop: number;          // 系数 2.8-4.2
  savingPct: number;    // 节能百分比
  carbonReduction: number; // kg/h
  powerInput: number;   // kW
}

interface EnergyDashboardProps {
  demoPhase?: number;
  isExecuting?: boolean;
}

export default function EnergyDashboard({
  demoPhase = 0,
  isExecuting = false,
}: EnergyDashboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const copRef = useRef<HTMLSpanElement>(null);
  const savingRef = useRef<HTMLSpanElement>(null);
  const carbonRef = useRef<HTMLSpanElement>(null);

  const [metrics, setMetrics] = useState<EnergyMetrics>({
    cop: 3.2,
    savingPct: 12,
    carbonReduction: 8.4,
    powerInput: 180,
  });

  // 演示阶段更新指标
  useEffect(() => {
    const targets: Record<number, EnergyMetrics> = {
      0: { cop: 3.2, savingPct: 12, carbonReduction: 8.4, powerInput: 180 },
      1: { cop: 3.1, savingPct: 10, carbonReduction: 7.8, powerInput: 185 },
      2: { cop: 2.9, savingPct: 8,  carbonReduction: 6.5, powerInput: 195 },
      3: { cop: 3.0, savingPct: 9,  carbonReduction: 7.2, powerInput: 190 },
      4: { cop: 3.3, savingPct: 14, carbonReduction: 9.1, powerInput: 175 },
      5: { cop: 3.8, savingPct: 22, carbonReduction: 14.2, powerInput: 155 },
      6: { cop: 4.1, savingPct: 28, carbonReduction: 18.6, powerInput: 140 },
    };

    const target = targets[demoPhase] || targets[0];

    // GSAP数字滚动
    const obj = { ...metrics };
    gsap.to(obj, {
      cop: target.cop,
      savingPct: target.savingPct,
      carbonReduction: target.carbonReduction,
      powerInput: target.powerInput,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => {
        setMetrics({ ...obj });
      },
    });
  }, [demoPhase]);

  // Canvas绿色粒子上升
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 160;
    const H = 60;
    canvas.width = W;
    canvas.height = H;

    interface Particle {
      x: number;
      y: number;
      vy: number;
      size: number;
      opacity: number;
    }

    const particles: Particle[] = [];
    const spawnRate = isExecuting ? 2 : 1;

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      if (frame % (isExecuting ? 4 : 8) === 0) {
        for (let i = 0; i < spawnRate; i++) {
          particles.push({
            x: 10 + Math.random() * (W - 20),
            y: H,
            vy: 0.4 + Math.random() * 0.6,
            size: 1.5 + Math.random() * 1.5,
            opacity: 0.7 + Math.random() * 0.3,
          });
        }
      }
      frame++;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y -= p.vy;
        p.opacity -= 0.008;

        if (p.opacity <= 0 || p.y < 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(16,185,129,${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [isExecuting]);

  const copColor = metrics.cop >= 3.5 ? '#10b981' : metrics.cop >= 3.0 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="absolute top-3 right-3 rounded-xl overflow-hidden"
      style={{
        zIndex: 120,
        background: 'rgba(2,11,26,0.88)',
        border: '1px solid rgba(16,185,129,0.3)',
        boxShadow: '0 0 16px rgba(16,185,129,0.15)',
        width: 168,
      }}
    >
      {/* 标题 */}
      <div
        className="px-3 py-1.5 text-xs font-mono tracking-wider flex items-center gap-1.5"
        style={{
          background: 'rgba(16,185,129,0.1)',
          borderBottom: '1px solid rgba(16,185,129,0.2)',
          color: '#10b981',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        能耗看板
      </div>

      {/* 粒子Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.6 }}
        />

        {/* 指标 */}
        <div className="px-3 py-2 space-y-1.5 relative z-10">
          {/* 节能 */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#64748b' }}>节能</span>
            <span
              ref={savingRef}
              className="text-xs font-mono font-bold"
              style={{ color: '#10b981' }}
            >
              ↓ {metrics.savingPct.toFixed(0)}%
            </span>
          </div>

          {/* 减碳 */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#64748b' }}>减碳</span>
            <span
              ref={carbonRef}
              className="text-xs font-mono font-bold"
              style={{ color: '#06b6d4' }}
            >
              {metrics.carbonReduction.toFixed(1)} kg/h
            </span>
          </div>


        </div>
      </div>
    </div>
  );
}
