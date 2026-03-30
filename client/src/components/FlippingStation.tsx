/**
 * FlippingStation.tsx
 * 可翻转换热站组件
 * 正面：站体图标+供温/流量/压差
 * 背面：参数调节面板（供回温/压差/流量实时显示）
 */
import { useState, useRef, useCallback } from 'react';
import gsap from 'gsap';

interface StationData {
  id: string;
  name: string;
  supplyTemp: number;
  returnTemp: number;
  flow: number;
  pressure: number;
  pressureDiff: number;
  buildings: string[];
}

interface Props {
  station: StationData;
  isAlert?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onFlip?: (id: string, isFlipped: boolean) => void;
}

const FlippingStation: React.FC<Props> = ({
  station,
  isAlert = false,
  className = '',
  style,
  onFlip,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    const newState = !isFlipped;
    setIsFlipped(newState);
    onFlip?.(station.id, newState);

    if (newState) {
      gsap.to(containerRef.current, {
        rotateY: 180,
        z: 150,
        scale: 1.6,
        duration: 0.7,
        ease: 'back.out(1.2)',
      });
      gsap.to('.flipping-building-other', {
        opacity: 0.35,
        filter: 'blur(2px)',
        duration: 0.4,
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
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.4,
      });
    }
  }, [isFlipped, station.id, onFlip]);

  const alertColor = isAlert ? '#ef4444' : '#06b6d4';
  const pressureAlert = station.pressureDiff > 30;

  return (
    <div
      ref={containerRef}
      id={`station-${station.id}`}
      className={`absolute cursor-pointer select-none flipping-building-other ${className}`}
      style={{
        width: 110,
        height: 120,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      onClick={handleClick}
    >
      {/* ===== 正面 ===== */}
      <div
        className="absolute inset-0 rounded-xl flex flex-col items-center justify-center"
        style={{
          backfaceVisibility: 'hidden',
          background: isAlert
            ? 'linear-gradient(135deg, rgba(127,29,29,0.9), rgba(185,28,28,0.6))'
            : 'linear-gradient(135deg, rgba(7,25,60,0.95), rgba(14,60,120,0.7))',
          border: `2px solid ${alertColor}60`,
          boxShadow: `0 0 20px ${alertColor}40`,
        }}
      >
        {/* 六边形图标 */}
        <svg width="36" height="36" viewBox="0 0 36 36" className="mb-1">
          <polygon
            points="18,2 32,10 32,26 18,34 4,26 4,10"
            fill={`${alertColor}20`}
            stroke={alertColor}
            strokeWidth="1.5"
          />
          <text x="18" y="22" textAnchor="middle" fill={alertColor} fontSize="11" fontWeight="bold">
            {station.id}
          </text>
        </svg>

        <span className="text-white text-xs font-bold">{station.name}</span>

        {/* 关键参数 */}
        <div className="flex gap-2 mt-1.5">
          <div className="text-center">
            <div className="text-[9px]" style={{ color: '#ef4444' }}>{station.supplyTemp}℃</div>
            <div className="text-[8px]" style={{ color: '#6b7280' }}>供</div>
          </div>
          <div className="text-center">
            <div className="text-[9px]" style={{ color: '#3b82f6' }}>{station.returnTemp}℃</div>
            <div className="text-[8px]" style={{ color: '#6b7280' }}>回</div>
          </div>
          <div className="text-center">
            <div
              className="text-[9px]"
              style={{ color: pressureAlert ? '#f59e0b' : '#22c55e' }}
            >
              {station.pressureDiff}kPa
            </div>
            <div className="text-[8px]" style={{ color: '#6b7280' }}>压差</div>
          </div>
        </div>

        {pressureAlert && (
          <div
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400"
            style={{ animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }}
          />
        )}
      </div>

      {/* ===== 背面：参数面板 ===== */}
      <div
        className="absolute inset-0 rounded-xl p-2 flex flex-col"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'rgba(2,11,26,0.97)',
          border: `2px solid ${alertColor}60`,
          boxShadow: `0 0 15px ${alertColor}30`,
        }}
      >
        <div className="text-[10px] font-bold mb-1.5 text-center" style={{ color: alertColor }}>
          {station.name} 参数
        </div>

        <div className="flex-1 space-y-1.5">
          {[
            { label: '供水温度', value: `${station.supplyTemp}℃`, color: '#ef4444' },
            { label: '回水温度', value: `${station.returnTemp}℃`, color: '#3b82f6' },
            { label: '循环流量', value: `${station.flow}m³/h`, color: '#22c55e' },
            { label: '管网压差', value: `${station.pressureDiff}kPa`, color: pressureAlert ? '#f59e0b' : '#22c55e' },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center">
              <span className="text-[9px]" style={{ color: '#6b7280' }}>{item.label}</span>
              <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}

          <div className="pt-1" style={{ borderTop: '1px solid rgba(75,85,99,0.3)' }}>
            <div className="text-[9px] mb-0.5" style={{ color: '#6b7280' }}>覆盖楼栋</div>
            <div className="flex flex-wrap gap-0.5">
              {station.buildings.map(b => (
                <span key={b} className="text-[8px] px-1 rounded" style={{ background: `${alertColor}20`, color: alertColor }}>
                  {b.replace('b', '')}栋
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          className="mt-1 w-full text-[9px] py-0.5 rounded"
          style={{ background: 'rgba(30,41,59,0.8)', color: '#94a3b8', border: '1px solid rgba(75,85,99,0.4)' }}
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
        >
          ← 返回
        </button>
      </div>
    </div>
  );
};

export default FlippingStation;
