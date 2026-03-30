/**
 * TimeScrubber.tsx
 * 底部可拖拽时间轴（替换DemoPlaybar）
 * - 8个阶段标记（算法训练/感知/气象预警/低温预警/诊断/决策/执行/完成）
 * - 拖拽手柄可任意跳转
 * - 点击阶段标签直接跳转
 * - 播放/暂停/重置控制
 */
import { useRef, useState, useEffect, useCallback } from 'react';

interface Phase {
  label: string;
  time: number;
  color: string;
  icon: string;
}

const PHASES: Phase[] = [
  { label: '算法训练', time: 0,  color: '#3b82f6', icon: '🤖' },
  { label: '感知',     time: 8,  color: '#10b981', icon: '📡' },
  { label: '气象预警', time: 11, color: '#f59e0b', icon: '🛰️' },
  { label: '低温预警', time: 23, color: '#ef4444', icon: '❄️' },
  { label: '诊断',     time: 28, color: '#8b5cf6', icon: '🔍' },
  { label: '决策',     time: 33, color: '#ec4899', icon: '🧠' },
  { label: '执行',     time: 38, color: '#06b6d4', icon: '⚙️' },
  { label: '完成',     time: 46, color: '#10b981', icon: '✅' },
];

const TOTAL_DURATION = 50;

interface TimeScrubberProps {
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onScrub: (time: number) => void;
  onRestart: () => void;
}

export const TimeScrubber = ({
  currentTime,
  isPlaying,
  onTogglePlay,
  onScrub,
  onRestart,
}: TimeScrubberProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getTimeFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return pct * TOTAL_DURATION;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    onScrub(getTimeFromEvent(e));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) onScrub(getTimeFromEvent(e));
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getTimeFromEvent, onScrub]);

  // 当前阶段
  const currentPhase = [...PHASES].reverse().find(p => currentTime >= p.time) || PHASES[0];
  const progress = (currentTime / TOTAL_DURATION) * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/92 border-t border-gray-700/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* 阶段标签行 */}
        <div className="flex justify-between mb-2 px-1">
          {PHASES.map((p, i) => {
            const isPast = currentTime >= p.time;
            const isCurrent = currentPhase.label === p.label;
            return (
              <button
                key={i}
                onClick={() => onScrub(p.time)}
                className="flex flex-col items-center gap-0.5 transition-all hover:scale-110"
                style={{ minWidth: 0 }}
              >
                <span className="text-sm">{p.icon}</span>
                <span
                  className="text-[10px] font-medium transition-colors"
                  style={{
                    color: isCurrent ? p.color : isPast ? '#9ca3af' : '#4b5563',
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 主控制行 */}
        <div className="flex items-center gap-4">
          {/* 播放/暂停 */}
          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 flex-shrink-0"
            style={{
              background: currentPhase.color,
              boxShadow: `0 0 12px ${currentPhase.color}60`,
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* 重置 */}
          <button
            onClick={onRestart}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white text-xs transition-all hover:scale-110 flex-shrink-0"
            title="重新开始"
          >
            ↺
          </button>

          {/* 轨道 */}
          <div className="flex-1 relative">
            <div
              ref={trackRef}
              className="h-3 bg-gray-800 rounded-full cursor-pointer relative overflow-hidden select-none"
              onMouseDown={handleMouseDown}
            >
              {/* 已播放 */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(to right, #3b82f6, ${currentPhase.color})`,
                }}
              />

              {/* 阶段分割线 */}
              {PHASES.map((p, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-gray-600/80"
                  style={{ left: `${(p.time / TOTAL_DURATION) * 100}%` }}
                />
              ))}

              {/* 拖拽手柄 */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2 cursor-grab active:cursor-grabbing transition-transform hover:scale-125"
                style={{
                  left: `calc(${progress}% - 10px)`,
                  borderColor: currentPhase.color,
                  boxShadow: `0 0 8px ${currentPhase.color}80`,
                }}
              />
            </div>
          </div>

          {/* 时间显示 */}
          <div className="text-xs text-gray-400 font-mono flex-shrink-0 w-16 text-right">
            {Math.floor(currentTime)}s / {TOTAL_DURATION}s
          </div>

          {/* 当前阶段标签 */}
          <div
            className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
            style={{
              background: `${currentPhase.color}20`,
              border: `1px solid ${currentPhase.color}60`,
              color: currentPhase.color,
            }}
          >
            {currentPhase.icon} {currentPhase.label}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeScrubber;
