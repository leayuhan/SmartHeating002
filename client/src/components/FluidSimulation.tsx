/**
 * FluidSimulation.tsx
 * Canvas粒子流体系统 — 管道里真正有水在流动
 * 速度映射流量，颜色映射温度（蓝→绿→橙→红）
 * 压力超阈值时出现脉冲圆环
 */
import { useEffect, useRef, useCallback } from 'react';

export interface PipeSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flowRate: number;   // 0-200 m³/h
  temperature: number; // °C
  pressure: number;   // MPa
  isActive?: boolean;
  isAlarm?: boolean;
}

interface Particle {
  progress: number; // 0-1 along pipe
  speed: number;
  size: number;
  opacity: number;
}

function tempToColor(temp: number): string {
  if (temp < 30) return '#3b82f6';
  if (temp < 50) return '#10b981';
  if (temp < 65) return '#f59e0b';
  return '#ef4444';
}

function tempToColorRGB(temp: number): [number, number, number] {
  if (temp < 30) return [59, 130, 246];
  if (temp < 50) return [16, 185, 129];
  if (temp < 65) return [245, 158, 11];
  return [239, 68, 68];
}

interface FluidSimulationProps {
  pipes: PipeSegment[];
  width: number;
  height: number;
  globalFlowMultiplier?: number; // 1.0 = normal, 2.0 = boosted
}

export default function FluidSimulation({
  pipes,
  width,
  height,
  globalFlowMultiplier = 1.0,
}: FluidSimulationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Map<string, Particle[]>>(new Map());
  const animRef = useRef<number>(0);
  const pipesRef = useRef(pipes);
  const multiplierRef = useRef(globalFlowMultiplier);

  // keep refs in sync
  useEffect(() => { pipesRef.current = pipes; }, [pipes]);
  useEffect(() => { multiplierRef.current = globalFlowMultiplier; }, [globalFlowMultiplier]);

  const initParticles = useCallback((pipe: PipeSegment) => {
    const dx = pipe.x2 - pipe.x1;
    const dy = pipe.y2 - pipe.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const count = Math.max(4, Math.floor(len / 18));
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        progress: Math.random(),
        speed: 0.0015 + Math.random() * 0.001,
        size: 2.5 + Math.random() * 1.5,
        opacity: 0.6 + Math.random() * 0.4,
      });
    }
    particlesRef.current.set(pipe.id, particles);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // init particles for all pipes
    pipesRef.current.forEach(pipe => {
      if (!particlesRef.current.has(pipe.id)) {
        initParticles(pipe);
      }
    });

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const now = Date.now();
      const currentPipes = pipesRef.current;
      const mult = multiplierRef.current;

      currentPipes.forEach(pipe => {
        if (!pipe.isActive && pipe.flowRate === 0) return;

        // ensure particles exist
        if (!particlesRef.current.has(pipe.id)) {
          initParticles(pipe);
        }
        const particles = particlesRef.current.get(pipe.id)!;

        const dx = pipe.x2 - pipe.x1;
        const dy = pipe.y2 - pipe.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;

        const flowSpeed = (pipe.flowRate / 1000) * 0.012 * mult;
        const [r, g, b] = tempToColorRGB(pipe.temperature);
        const baseColor = `rgba(${r},${g},${b}`;

        particles.forEach(p => {
          p.progress += p.speed + flowSpeed;
          if (p.progress > 1) p.progress -= 1;

          const px = pipe.x1 + ux * len * p.progress;
          const py = pipe.y1 + uy * len * p.progress;

          // glow gradient
          const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3.5);
          grad.addColorStop(0, `${baseColor},${p.opacity})`);
          grad.addColorStop(0.4, `${baseColor},${p.opacity * 0.5})`);
          grad.addColorStop(1, `${baseColor},0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 3.5, 0, Math.PI * 2);
          ctx.fill();

          // bright core
          ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.9})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        });

        // pressure pulse ring at midpoint
        if (pipe.pressure > 0.55 || pipe.isAlarm) {
          const pulse = (now % 2000) / 2000;
          const mx = (pipe.x1 + pipe.x2) / 2;
          const my = (pipe.y1 + pipe.y2) / 2;
          const ringColor = pipe.isAlarm ? `rgba(239,68,68,${1 - pulse})` : `rgba(245,158,11,${1 - pulse})`;
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(mx, my, 8 + pulse * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [width, height, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10, mixBlendMode: 'screen' }}
    />
  );
}
