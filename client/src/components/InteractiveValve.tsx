/**
 * InteractiveValve.tsx
 * 可拖拽阀门旋钮
 * 拖拽旋转手柄 → 实时改变开度 → 回调流量变化
 * 手柄从 -135° 到 +135° 映射 0-100%
 */
import { useRef, useState, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';

interface InteractiveValveProps {
  id: string;
  label?: string;
  initialOpenPct?: number;
  minFlow?: number;
  maxFlow?: number;
  onChange?: (openPct: number, flow: number) => void;
  size?: number;
  color?: string;
  disabled?: boolean;
}

export default function InteractiveValve({
  id,
  label = '调节阀',
  initialOpenPct = 50,
  minFlow = 0,
  maxFlow = 200,
  onChange,
  size = 72,
  color = '#06b6d4',
  disabled = false,
}: InteractiveValveProps) {
  const [openPct, setOpenPct] = useState(initialOpenPct);
  const [isDragging, setIsDragging] = useState(false);
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  // Convert openPct to rotation angle: 0% = -135°, 100% = +135°
  const pctToAngle = (pct: number) => -135 + (pct / 100) * 270;
  const angleToPct = (angle: number) => Math.max(0, Math.min(100, ((angle + 135) / 270) * 100));

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);

    const rect = knobRef.current?.getBoundingClientRect();
    if (rect) {
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!centerRef.current) return;
      const dx = e.clientX - centerRef.current.x;
      const dy = e.clientY - centerRef.current.y;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle > 180) angle -= 360;
      angle = Math.max(-135, Math.min(135, angle));
      const newPct = angleToPct(angle);
      setOpenPct(newPct);
      const flow = minFlow + (newPct / 100) * (maxFlow - minFlow);
      onChange?.(newPct, flow);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [disabled, minFlow, maxFlow, onChange]);

  const angle = pctToAngle(openPct);
  const flow = minFlow + (openPct / 100) * (maxFlow - minFlow);
  const r = size / 2;
  const strokeColor = openPct < 20 ? '#ef4444' : openPct < 50 ? '#f59e0b' : color;

  return (
    <div
      className="flex flex-col items-center gap-1 select-none"
      style={{ width: size + 24 }}
    >
      {/* 标签 */}
      <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>{label}</span>

      {/* 旋钮 */}
      <div
        ref={knobRef}
        className="relative cursor-grab active:cursor-grabbing"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        {/* 背景圆 */}
        <svg width={size} height={size} className="absolute inset-0">
          {/* 轨道弧 */}
          <circle
            cx={r}
            cy={r}
            r={r - 6}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={4}
          />
          {/* 开度弧 */}
          <circle
            cx={r}
            cy={r}
            r={r - 6}
            fill="none"
            stroke={strokeColor}
            strokeWidth={4}
            strokeDasharray={`${((openPct / 100) * 2 * Math.PI * (r - 6)).toFixed(1)} 999`}
            strokeDashoffset={`${(2 * Math.PI * (r - 6) * 0.25).toFixed(1)}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
          />
          {/* 中心圆 */}
          <circle
            cx={r}
            cy={r}
            r={r - 16}
            fill="rgba(2,11,26,0.8)"
            stroke={isDragging ? strokeColor : 'rgba(255,255,255,0.1)'}
            strokeWidth={1.5}
          />
        </svg>

        {/* 手柄 */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div
            className="rounded-full"
            style={{
              width: 4,
              height: r - 14,
              background: `linear-gradient(to bottom, ${strokeColor}, transparent)`,
              transformOrigin: 'bottom center',
              marginBottom: r - 14,
              boxShadow: `0 0 6px ${strokeColor}`,
            }}
          />
        </div>

        {/* 开度数字 */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="text-xs font-mono font-bold"
            style={{ color: strokeColor, fontSize: size < 60 ? 10 : 12 }}
          >
            {Math.round(openPct)}%
          </span>
        </div>
      </div>

      {/* 流量显示 */}
      <span className="text-xs font-mono" style={{ color: strokeColor }}>
        {flow.toFixed(0)} m³/h
      </span>
    </div>
  );
}
