/**
 * PipeTwinDemo.tsx
 * 基于pasted_content_9.txt的Canvas粒子流体系统
 * 用真实管网坐标重建，接入演示阶段控制
 *
 * 核心特性：
 * 1. 每条管道独立粒子池（沿管道流动）
 * 2. 温度→颜色映射（蓝→绿→橙→红）
 * 3. 压力超阈值→脉冲圆环扩散
 * 4. 爆管模拟→红色粒子向外喷射
 * 5. 演示阶段5→粒子速度×1.8，颜色偏红
 */
import { useEffect, useRef, useCallback } from 'react';

// ── 真实管网坐标（与HeatingSystemMap.tsx保持一致）──
// 热源: (75, 340)
// 换热站A: (230, 120), B: (230, 340), C: (230, 560)
// 楼栋A区: x=370-690, y=80-180
// 楼栋B区: x=370-690, y=290-390
// 楼栋C区: x=370-690, y=490-590

export interface PipeTwinPipe {
  id: string;
  points: [number, number][];  // 折线段坐标
  flowRate: number;            // 0-200 m³/h
  temperature: number;         // °C
  pressure: number;            // MPa
  isAlarm?: boolean;
  isBurst?: boolean;           // 爆管模拟
}

interface Particle {
  pipeId: string;
  segIdx: number;      // 当前在哪段折线
  progress: number;    // 0-1 在当前段的进度
  speed: number;
  size: number;
  opacity: number;
  life: number;        // 0-1
}

interface BurstParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  color: string;
}

interface PressureRing {
  x: number; y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

function tempToRGB(temp: number): [number, number, number] {
  if (temp < 30) return [59, 130, 246];    // 蓝
  if (temp < 45) return [16, 185, 129];    // 绿
  if (temp < 60) return [245, 158, 11];    // 橙
  return [239, 68, 68];                     // 红
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// 默认管网管段（热源→换热站→楼栋）
export const DEFAULT_PIPES: PipeTwinPipe[] = [
  // 热源→换热站A
  { id: 'hs-sa', points: [[75,340],[75,120],[230,120]], flowRate: 180, temperature: 65, pressure: 0.6 },
  // 热源→换热站B
  { id: 'hs-sb', points: [[75,340],[230,340]], flowRate: 200, temperature: 65, pressure: 0.65 },
  // 热源→换热站C
  { id: 'hs-sc', points: [[75,340],[75,560],[230,560]], flowRate: 160, temperature: 65, pressure: 0.58 },
  // 换热站A→楼栋A1-A3
  { id: 'sa-a1', points: [[230,120],[370,100]], flowRate: 60, temperature: 48, pressure: 0.3 },
  { id: 'sa-a2', points: [[230,120],[480,120]], flowRate: 65, temperature: 47, pressure: 0.28 },
  { id: 'sa-a3', points: [[230,120],[590,140]], flowRate: 55, temperature: 46, pressure: 0.25 },
  // 换热站B→楼栋B1-B3
  { id: 'sb-b1', points: [[230,340],[370,310]], flowRate: 70, temperature: 50, pressure: 0.35 },
  { id: 'sb-b2', points: [[230,340],[480,340]], flowRate: 68, temperature: 49, pressure: 0.32 },
  { id: 'sb-b3', points: [[230,340],[590,360]], flowRate: 62, temperature: 48, pressure: 0.29 },
  // 换热站C→楼栋C1-C3
  { id: 'sc-c1', points: [[230,560],[370,530]], flowRate: 55, temperature: 46, pressure: 0.28 },
  { id: 'sc-c2', points: [[230,560],[480,560]], flowRate: 58, temperature: 45, pressure: 0.26 },
  { id: 'sc-c3', points: [[230,560],[590,580]], flowRate: 52, temperature: 44, pressure: 0.24 },
];

interface PipeTwinDemoProps {
  width?: number;
  height?: number;
  pipes?: PipeTwinPipe[];
  demoPhase?: number;
  alarmPipeId?: string;
  burstPipeId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PipeTwinDemo({
  width = 920,
  height = 680,
  pipes = DEFAULT_PIPES,
  demoPhase = 0,
  alarmPipeId,
  burstPipeId,
  className = '',
  style,
}: PipeTwinDemoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const burstParticlesRef = useRef<BurstParticle[]>([]);
  const pressureRingsRef = useRef<PressureRing[]>([]);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  // 计算折线段总长度
  const calcSegLen = useCallback((p1: [number,number], p2: [number,number]) => {
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    return Math.sqrt(dx*dx + dy*dy);
  }, []);

  // 获取管道总长度
  const getPipeLen = useCallback((pipe: PipeTwinPipe) => {
    let len = 0;
    for (let i = 0; i < pipe.points.length - 1; i++) {
      len += calcSegLen(pipe.points[i], pipe.points[i+1]);
    }
    return len;
  }, [calcSegLen]);

  // 获取粒子在管道上的实际坐标
  const getParticlePos = useCallback((pipe: PipeTwinPipe, segIdx: number, progress: number): [number,number] => {
    if (segIdx >= pipe.points.length - 1) {
      const last = pipe.points[pipe.points.length - 1];
      return [last[0], last[1]];
    }
    const p1 = pipe.points[segIdx];
    const p2 = pipe.points[segIdx + 1];
    return [lerp(p1[0], p2[0], progress), lerp(p1[1], p2[1], progress)];
  }, []);

  // 初始化粒子
  const initParticles = useCallback(() => {
    const particles: Particle[] = [];
    pipes.forEach(pipe => {
      const pipeLen = getPipeLen(pipe);
      const count = Math.max(3, Math.floor(pipeLen / 20));
      for (let i = 0; i < count; i++) {
        // 均匀分布在管道上
        const totalProgress = i / count;
        let remaining = totalProgress * pipeLen;
        let segIdx = 0;
        let segProgress = 0;
        for (let s = 0; s < pipe.points.length - 1; s++) {
          const segLen = calcSegLen(pipe.points[s], pipe.points[s+1]);
          if (remaining <= segLen) {
            segIdx = s;
            segProgress = remaining / segLen;
            break;
          }
          remaining -= segLen;
          segIdx = s + 1;
          segProgress = 0;
        }
        particles.push({
          pipeId: pipe.id,
          segIdx,
          progress: segProgress,
          speed: 0.3 + Math.random() * 0.4,
          size: 1.5 + Math.random() * 2,
          opacity: 0.5 + Math.random() * 0.5,
          life: Math.random(),
        });
      }
    });
    particlesRef.current = particles;
  }, [pipes, getPipeLen, calcSegLen]);

  // 更新粒子位置
  const updateParticles = useCallback((dt: number, flowMultiplier: number) => {
    const pipeMap = new Map(pipes.map(p => [p.id, p]));
    const newParticles: Particle[] = [];
    const newBursts: BurstParticle[] = [...burstParticlesRef.current];

    for (const p of particlesRef.current) {
      const pipe = pipeMap.get(p.pipeId);
      if (!pipe) continue;

      const isBurst = pipe.id === burstPipeId;
      const speedMult = flowMultiplier * (pipe.flowRate / 100) * (isBurst ? 2.5 : 1);
      let newProgress = p.progress + p.speed * speedMult * dt * 0.06;
      let newSegIdx = p.segIdx;

      // 推进到下一段
      while (newProgress >= 1 && newSegIdx < pipe.points.length - 2) {
        newProgress -= 1;
        newSegIdx++;
      }

      if (newProgress >= 1 || newSegIdx >= pipe.points.length - 1) {
        // 到达终点，重置到起点
        if (isBurst) {
          // 爆管：在终点生成爆炸粒子
          const [ex, ey] = getParticlePos(pipe, newSegIdx, 1);
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            newBursts.push({
              x: ex, y: ey,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              color: `rgba(239,68,68,${0.6 + Math.random() * 0.4})`,
            });
          }
        }
        newParticles.push({ ...p, segIdx: 0, progress: Math.random() * 0.1, life: 1 });
      } else {
        newParticles.push({ ...p, segIdx: newSegIdx, progress: newProgress, life: Math.max(0, p.life - dt * 0.01) });
      }
    }

    // 更新爆炸粒子
    const updatedBursts = newBursts
      .map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, vy: b.vy + 0.1, life: b.life - 0.03 }))
      .filter(b => b.life > 0);

    particlesRef.current = newParticles;
    burstParticlesRef.current = updatedBursts;
  }, [pipes, burstPipeId, getParticlePos]);

  // 更新压力圆环
  const updatePressureRings = useCallback((dt: number) => {
    frameRef.current++;
    // 每60帧检查一次高压管道
    if (frameRef.current % 60 === 0) {
      pipes.forEach(pipe => {
        if (pipe.pressure > 0.5 || pipe.isAlarm) {
          const midIdx = Math.floor(pipe.points.length / 2);
          const p1 = pipe.points[Math.max(0, midIdx - 1)];
          const p2 = pipe.points[midIdx];
          pressureRingsRef.current.push({
            x: lerp(p1[0], p2[0], 0.5),
            y: lerp(p1[1], p2[1], 0.5),
            radius: 4,
            maxRadius: 20 + pipe.pressure * 15,
            opacity: 0.8,
          });
        }
      });
    }
    pressureRingsRef.current = pressureRingsRef.current
      .map(r => ({ ...r, radius: r.radius + 0.5, opacity: r.opacity - 0.02 }))
      .filter(r => r.opacity > 0);
  }, [pipes]);

  // 渲染
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const pipeMap = new Map(pipes.map(p => [p.id, p]));

    // 绘制管道轮廓（半透明底色）
    pipes.forEach(pipe => {
      const isAlarm = pipe.id === alarmPipeId || pipe.isAlarm;
      const isBurst = pipe.id === burstPipeId || pipe.isBurst;
      const [r, g, b] = tempToRGB(pipe.temperature);
      ctx.beginPath();
      ctx.moveTo(pipe.points[0][0], pipe.points[0][1]);
      for (let i = 1; i < pipe.points.length; i++) {
        ctx.lineTo(pipe.points[i][0], pipe.points[i][1]);
      }
      ctx.strokeStyle = isBurst
        ? 'rgba(239,68,68,0.6)'
        : isAlarm
          ? 'rgba(251,191,36,0.5)'
          : `rgba(${r},${g},${b},0.15)`;
      ctx.lineWidth = isBurst ? 4 : isAlarm ? 3 : 2;
      ctx.stroke();
    });

    // 绘制粒子
    for (const p of particlesRef.current) {
      const pipe = pipeMap.get(p.pipeId);
      if (!pipe) continue;
      const [x, y] = getParticlePos(pipe, p.segIdx, p.progress);
      const isAlarm = pipe.id === alarmPipeId || pipe.isAlarm;
      const isBurst = pipe.id === burstPipeId || pipe.isBurst;
      const [r, g, b] = tempToRGB(pipe.temperature);
      const alpha = p.opacity * p.life * (isAlarm ? 1.2 : 1);

      // 粒子发光效果
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size * 2);
      gradient.addColorStop(0, isBurst
        ? `rgba(239,68,68,${alpha})`
        : isAlarm
          ? `rgba(251,191,36,${alpha})`
          : `rgba(${r},${g},${b},${alpha})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(x, y, p.size * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 核心亮点
      ctx.beginPath();
      ctx.arc(x, y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
      ctx.fill();
    }

    // 绘制爆炸粒子
    for (const b of burstParticlesRef.current) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = b.color.replace(/[\d.]+\)$/, `${b.life})`);
      ctx.fill();
    }

    // 绘制压力圆环
    for (const ring of pressureRingsRef.current) {
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(251,191,36,${ring.opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [pipes, width, height, alarmPipeId, burstPipeId, getParticlePos]);

  // 动画循环
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(50, timestamp - lastTimeRef.current);
    lastTimeRef.current = timestamp;

    const flowMult = demoPhase === 5 ? 1.8 : 1.0;
    updateParticles(dt, flowMult);
    updatePressureRings(dt);
    render();

    animRef.current = requestAnimationFrame(animate);
  }, [demoPhase, updateParticles, updatePressureRings, render]);

  useEffect(() => {
    initParticles();
  }, [initParticles]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
