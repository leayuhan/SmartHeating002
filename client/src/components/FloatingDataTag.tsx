/**
 * FloatingDataTag.tsx
 * 悬浮数据标签 - 跟随目标元素显示供温/流量/压差
 * 轻微上下浮动动画
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface FloatingDataTagProps {
  targetId: string;
  data: {
    temp?: number;
    flow?: number;
    pressure?: number;
    label?: string;
  };
  type: 'station' | 'building' | 'valve';
  visible?: boolean;
}

export const FloatingDataTag = ({ targetId, data, type, visible = true }: FloatingDataTagProps) => {
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    const tag = tagRef.current;
    if (!target || !tag) return;

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      tag.style.left = `${rect.left + rect.width / 2 - 60}px`;
      tag.style.top = `${rect.top - 85}px`;
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(document.body);

    // 浮动动画
    gsap.to(tag, {
      y: -5,
      duration: 2.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return () => {
      observer.disconnect();
      gsap.killTweensOf(tag);
    };
  }, [targetId]);

  if (!visible) return null;

  const dotColor = type === 'station' ? '#f97316' : type === 'building' ? '#06b6d4' : '#10b981';

  return (
    <div
      ref={tagRef}
      className="fixed z-30 bg-black/85 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-2 min-w-[120px] pointer-events-none"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: dotColor }} />
        <span className="text-xs text-gray-400">
          {data.label || (type === 'station' ? '换热站' : type === 'building' ? '楼栋' : '阀门')}
        </span>
      </div>

      {data.temp !== undefined && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-400">供温</span>
          <span className="text-sm font-bold text-white font-mono">{data.temp}℃</span>
        </div>
      )}
      {data.flow !== undefined && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-400">流量</span>
          <span className="text-sm font-bold text-cyan-400 font-mono">{data.flow}t/h</span>
        </div>
      )}
      {data.pressure !== undefined && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-400">压差</span>
          <span
            className="text-sm font-bold font-mono"
            style={{ color: data.pressure > 30 ? '#ef4444' : '#f59e0b' }}
          >
            {data.pressure}kPa
          </span>
        </div>
      )}

      {/* 小三角 */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-black/85" />
    </div>
  );
};

export default FloatingDataTag;
