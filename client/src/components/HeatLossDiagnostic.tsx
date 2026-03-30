/**
 * HeatLossDiagnostic.tsx
 * 热量流失诊断 — 点击低温楼触发红色粒子向上飘散 + 诊断面板
 * 粒子从楼栋位置向上扩散，颜色从橙红渐变到透明
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface DiagnosticResult {
  buildingId: string;
  buildingName: string;
  temperature: number;
  heatLossRate: number; // W/m²
  cause: string;
  recommendation: string;
  severity: 'critical' | 'warning' | 'normal';
}

interface HeatLossDiagnosticProps {
  buildingId: string | null;
  buildingName?: string;
  temperature?: number;
  position?: { x: number; y: number };
  onClose?: () => void;
}

export default function HeatLossDiagnostic({
  buildingId,
  buildingName = '未知楼栋',
  temperature = 14.5,
  position = { x: 400, y: 300 },
  onClose,
}: HeatLossDiagnosticProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');

  const getDiagnostic = (temp: number): DiagnosticResult => {
    const heatLoss = Math.round((22 - temp) * 8.5 + Math.random() * 5);
    let cause = '末端调节阀开度不足';
    let recommendation = '建议将楼前阀门开度从35%调至65%';
    let severity: DiagnosticResult['severity'] = 'warning';

    if (temp < 14) {
      cause = '支路水力失调，流量严重不足';
      recommendation = '立即开启备用泵，并联调节支路压差至 0.08MPa；建议安排管道检修，排查远端支路漏水隐患';
      severity = 'critical';
    } else if (temp < 16) {
      cause = '管道热损失偏高，保温层老化';
      recommendation = '提升供水温度 2°C，同步增大循环流量；建议安排管道检修，排查远端支路漏水隐患';
      severity = 'warning';
    } else {
      cause = '室内散热器堵塞，换热效率下降';
      recommendation = '安排维修人员检查散热器，清洗过滤器';
      severity = 'normal';
    }

    return {
      buildingId: buildingId || '',
      buildingName,
      temperature: temp,
      heatLossRate: heatLoss,
      cause,
      recommendation,
      severity,
    };
  };

  // Canvas粒子动画
  useEffect(() => {
    if (!buildingId) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
    }

    const particles: Particle[] = [];
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    // 相对于canvas的位置
    const cx = position.x;
    const cy = position.y;

    const spawnParticle = () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 0.5 + Math.random() * 1.5;
      particles.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 80 + Math.random() * 60,
        size: 2 + Math.random() * 3,
      });
    };

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      // spawn
      if (frame % 3 === 0) spawnParticle();
      frame++;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.015; // upward drift
        p.vx += (Math.random() - 0.5) * 0.1;
        p.life++;

        if (p.life > p.maxLife || p.y < 0 || p.x < 0 || p.x > W) {
          particles.splice(i, 1);
          continue;
        }

        const t = p.life / p.maxLife;
        const alpha = (1 - t) * 0.85;
        // orange-red gradient
        const r = 239;
        const g = Math.round(68 + (1 - t) * 50);
        const b = 68;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    setIsVisible(true);

    return () => cancelAnimationFrame(animRef.current);
  }, [buildingId, position.x, position.y]);

  // 打字机效果
  useEffect(() => {
    if (!buildingId) {
      setIsVisible(false);
      setTypewriterText('');
      return;
    }

    const diag = getDiagnostic(temperature);
    const fullText = `诊断原因：${diag.cause}\n建议措施：${diag.recommendation}`;
    let i = 0;
    setTypewriterText('');

    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTypewriterText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 28);

    return () => clearInterval(timer);
  }, [buildingId, temperature]);

  // panel entrance animation
  useEffect(() => {
    if (isVisible && panelRef.current) {
      gsap.fromTo(panelRef.current,
        { opacity: 0, scale: 0.85, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' }
      );
    }
  }, [isVisible]);

  if (!buildingId) return null;

  const diag = getDiagnostic(temperature);
  const severityColor = {
    critical: '#ef4444',
    warning: '#f59e0b',
    normal: '#10b981',
  }[diag.severity];

  return (
    <>
      {/* Canvas粒子层 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 15, width: '100%', height: '100%' }}
      />

      {/* 诊断面板 */}
      <div
        ref={panelRef}
        className="absolute pointer-events-auto"
        style={{
          left: Math.min(position.x + 20, window.innerWidth - 320),
          top: Math.max(position.y - 180, 10),
          zIndex: 200,
          width: 300,
        }}
      >
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'rgba(2,11,26,0.95)',
            border: `1px solid ${severityColor}`,
            boxShadow: `0 0 20px ${severityColor}40`,
          }}
        >
          {/* 标题 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: severityColor }}
              />
              <span className="font-bold" style={{ color: severityColor }}>
                热量流失诊断
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors text-xs"
            >
              ✕
            </button>
          </div>

          {/* 楼栋信息 */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
            <span className="text-gray-400">{buildingName}</span>
            <span className="font-mono font-bold" style={{ color: severityColor }}>
              {temperature.toFixed(1)}°C
            </span>
          </div>

          {/* 热损失率 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs">热损失率</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, (diag.heatLossRate / 120) * 100)}%`,
                    background: `linear-gradient(90deg, ${severityColor}, #fff)`,
                  }}
                />
              </div>
              <span className="text-xs font-mono" style={{ color: severityColor }}>
                {diag.heatLossRate} W/m²
              </span>
            </div>
          </div>

          {/* 打字机文字 */}
          <div
            className="text-xs leading-relaxed whitespace-pre-line"
            style={{ color: '#94a3b8', minHeight: 56 }}
          >
            {typewriterText}
            <span className="animate-pulse">|</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-3">
            <button
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: `${severityColor}20`,
                border: `1px solid ${severityColor}60`,
                color: severityColor,
              }}
              onClick={() => {
                // trigger speech
                if ('speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance(
                    `${buildingName}热量流失诊断完成，${diag.cause}，建议${diag.recommendation}`
                  );
                  u.lang = 'zh-CN';
                  u.rate = 1.1;
                  speechSynthesis.speak(u);
                }
              }}
            >
              🔊 语音播报
            </button>
            <button
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#10b981',
              }}
              onClick={onClose}
            >
              ✓ 已知晓
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
