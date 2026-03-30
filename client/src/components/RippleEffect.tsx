/**
 * RippleEffect.tsx
 * 调节完成时从设备中心扩散青色圆环 + 文字上浮
 * "±1℃平衡达成"
 */
import { useEffect, useRef } from 'react';

interface RippleEffectProps {
  x: number;
  y: number;
  active: boolean;
  label?: string;
  color?: string;
}

export default function RippleEffect({
  x,
  y,
  active,
  label = '±1℃ 平衡达成',
  color = '#06b6d4',
}: RippleEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animRef.current);
      return;
    }

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

    interface Ring {
      radius: number;
      maxRadius: number;
      opacity: number;
      speed: number;
    }

    const rings: Ring[] = [];
    let textOpacity = 0;
    let textY = y + 20;

    // spawn 3 rings
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        rings.push({ radius: 0, maxRadius: 80 + i * 30, opacity: 0.8, speed: 1.2 });
      }, i * 200);
    }

    let started = false;
    const startTime = Date.now();

    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      const elapsed = (Date.now() - startTime) / 1000;

      // text float up
      if (elapsed > 0.3) {
        textOpacity = Math.min(1, (elapsed - 0.3) * 2);
        textY = y - (elapsed - 0.3) * 25;

        ctx.fillStyle = `rgba(255,255,255,${textOpacity})`;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillText(label, x, textY);
        ctx.shadowBlur = 0;
      }

      // rings
      rings.forEach((ring, i) => {
        ring.radius += ring.speed;
        ring.opacity = Math.max(0, 0.8 * (1 - ring.radius / ring.maxRadius));

        ctx.strokeStyle = `rgba(6,182,212,${ring.opacity})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x, y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // remove dead rings
      for (let i = rings.length - 1; i >= 0; i--) {
        if (rings[i].opacity <= 0) rings.splice(i, 1);
      }

      if (elapsed < 3) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, x, y, label, color]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 50, width: '100%', height: '100%' }}
    />
  );
}
