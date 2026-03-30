/**
 * FlippingBuilding.tsx
 * 可翻转3D楼栋组件
 * 正面：楼外观（窗户纹理+平均温度悬浮）
 * 背面：一梯两户6层×2户=12个温度网格
 * 点击：rotateY:180 + z:200 + scale:1.5，其他楼后退虚化
 */
import { useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { generateUnitTemperatures, getTempColor, type UnitData } from '../utils/buildingPhysics';
import type { StrategyType } from '../utils/strategyCurves';

interface Props {
  id: string;
  name: string;
  baseTemp: number;
  outdoorTemp?: number;
  strategy?: StrategyType | 'none';
  isAlert?: boolean;
  isGrayed?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onFlip?: (id: string, isFlipped: boolean) => void;
}

const FlippingBuilding: React.FC<Props> = ({
  id,
  name,
  baseTemp,
  outdoorTemp = -8,
  strategy = 'none',
  isAlert = false,
  isGrayed = false,
  className = '',
  style,
  onFlip,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const units = generateUnitTemperatures(id, baseTemp, outdoorTemp, strategy as any);
  const avgTemp = parseFloat((units.reduce((a, b) => a + b.temp, 0) / units.length).toFixed(1));

  // 按楼层分组（从高到低显示）
  const floors = Array.from({ length: 6 }, (_, i) => 6 - i).map(floor => ({
    floor,
    left: units.find(u => u.floor === floor && u.side === 'left')!,
    right: units.find(u => u.floor === floor && u.side === 'right')!,
  }));

  const handleClick = useCallback(() => {
    const newState = !isFlipped;
    setIsFlipped(newState);
    onFlip?.(id, newState);

    if (newState) {
      // 翻转+推近
      gsap.to(containerRef.current, {
        rotateY: 180,
        z: 180,
        scale: 1.5,
        duration: 0.75,
        ease: 'back.out(1.2)',
      });
      // 其他楼后退虚化
      gsap.to('.flipping-building-other', {
        z: -80,
        opacity: 0.25,
        filter: 'blur(3px) grayscale(50%)',
        duration: 0.45,
      });
    } else {
      gsap.to(containerRef.current, {
        rotateY: 0,
        z: 0,
        scale: 1,
        duration: 0.55,
        ease: 'power2.inOut',
      });
      gsap.to('.flipping-building-other', {
        z: 0,
        opacity: 1,
        filter: 'blur(0px) grayscale(0%)',
        duration: 0.45,
      });
    }
  }, [isFlipped, id, onFlip]);

  const alertGlow = isAlert
    ? '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)'
    : '0 0 15px rgba(6,182,212,0.3)';

  return (
    <div
      ref={containerRef}
      id={`building-${id}`}
      className={`absolute cursor-pointer select-none ${isFlipped ? 'flipping-building-active' : 'flipping-building-other'} ${className}`}
      style={{
        width: 140,
        height: 200,
        transformStyle: 'preserve-3d',
        filter: isGrayed ? 'grayscale(80%) brightness(0.4)' : undefined,
        transition: isGrayed ? 'filter 1s ease' : undefined,
        ...style,
      }}
      onClick={handleClick}
    >
      {/* ===== 正面：楼外观 ===== */}
      <div
        className="absolute inset-0 rounded-xl flex flex-col items-center justify-center overflow-hidden"
        style={{
          backfaceVisibility: 'hidden',
          background: isAlert
            ? 'linear-gradient(to top, rgba(127,29,29,0.9), rgba(185,28,28,0.5))'
            : 'linear-gradient(to top, rgba(7,25,60,0.9), rgba(14,60,120,0.6))',
          border: `2px solid ${isAlert ? 'rgba(239,68,68,0.7)' : 'rgba(6,182,212,0.5)'}`,
          boxShadow: alertGlow,
        }}
      >
        {/* 窗户纹理 */}
        <div className="absolute inset-3 grid grid-cols-3 gap-1 opacity-30 pointer-events-none">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                background: isAlert
                  ? `rgba(239,68,68,${0.3 + Math.random() * 0.4})`
                  : `rgba(6,182,212,${0.2 + Math.random() * 0.5})`,
                animation: isAlert ? `pulse ${1 + Math.random()}s ease-in-out infinite alternate` : undefined,
              }}
            />
          ))}
        </div>

        {/* 楼栋名称 */}
        <span className="text-white font-bold text-base z-10 drop-shadow">{name}</span>

        {/* 平均温度 */}
        <div
          className="mt-1 px-3 py-0.5 rounded-full text-xs font-bold z-10"
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: `1px solid ${isAlert ? '#ef4444' : '#06b6d4'}`,
            color: isAlert ? '#fca5a5' : '#67e8f9',
          }}
        >
          {avgTemp}℃
        </div>

        {/* 点击提示 */}
        <span className="text-xs mt-2 z-10" style={{ color: 'rgba(148,163,184,0.7)' }}>
          点击展开
        </span>

        {/* 告警标识 */}
        {isAlert && (
          <div
            className="absolute top-2 right-2 w-3 h-3 rounded-full bg-red-500"
            style={{ animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }}
          />
        )}
      </div>

      {/* ===== 背面：12户温度网格 ===== */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'rgba(2,11,26,0.97)',
          border: '2px solid rgba(234,179,8,0.6)',
          boxShadow: '0 0 20px rgba(234,179,8,0.3)',
        }}
      >
        <div className="p-2 h-full flex flex-col">
          {/* 标题 */}
          <div
            className="text-center text-xs font-bold pb-1 mb-1"
            style={{ color: '#fbbf24', borderBottom: '1px solid rgba(75,85,99,0.5)' }}
          >
            {name} · 一梯两户
          </div>

          {/* 楼层网格 */}
          <div className="flex-1 flex flex-col gap-1 justify-around">
            {floors.map(({ floor, left, right }) => (
              <div key={floor} className="flex items-center gap-1">
                <span className="text-gray-500 text-[9px] w-4 text-right">{floor}F</span>
                <UnitCell unit={left} />
                {/* 电梯井 */}
                <div
                  className="w-4 flex items-center justify-center rounded-sm"
                  style={{
                    background: 'rgba(30,41,59,0.8)',
                    border: '1px solid rgba(75,85,99,0.4)',
                    fontSize: 7,
                    color: '#4b5563',
                    height: 28,
                  }}
                >
                  梯
                </div>
                <UnitCell unit={right} />
              </div>
            ))}
          </div>

          {/* 返回按钮 */}
          <button
            className="mt-1 w-full text-[10px] py-0.5 rounded"
            style={{
              background: 'rgba(30,41,59,0.8)',
              color: '#94a3b8',
              border: '1px solid rgba(75,85,99,0.4)',
            }}
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
          >
            ← 返回
          </button>
        </div>
      </div>
    </div>
  );
};

// 单户温度格子
const UnitCell: React.FC<{ unit: UnitData }> = ({ unit }) => {
  const colors = getTempColor(unit.temp);
  return (
    <div
      className="flex-1 relative group rounded flex flex-col items-center justify-center"
      style={{
        height: 28,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: unit.temp < 18 ? `0 0 6px ${colors.border}40` : undefined,
      }}
    >
      <span className="text-[10px] font-bold leading-none" style={{ color: colors.text }}>
        {unit.temp}℃
      </span>
      <span className="text-[8px] leading-none mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
        {unit.valveOpen}%
      </span>

      {/* 悬停详情 */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[9px] whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'rgba(0,0,0,0.9)',
          border: '1px solid rgba(75,85,99,0.6)',
          color: '#e2e8f0',
        }}
      >
        <div style={{ color: '#94a3b8' }}>{unit.isTop ? '顶层' : unit.isBottom ? '底层' : '中间层'} · 边户</div>
        <div>目标: {unit.targetTemp}℃</div>
        <div style={{ color: unit.temp < unit.targetTemp ? '#93c5fd' : '#fca5a5' }}>
          偏差: {(unit.temp - unit.targetTemp).toFixed(1)}℃
        </div>
      </div>
    </div>
  );
};

export default FlippingBuilding;
