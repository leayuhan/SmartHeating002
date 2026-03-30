/**
 * OneTowerTwoUnits.tsx
 * 一梯两户组件：6层×2户=12个温度
 * - 楼前总阀（菱形SVG）+ 入户小阀（圆形SVG）
 * - 电梯井居中
 * - 演示阶段5时阀门旋转动画
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export interface UnitData {
  temp: number;
  valve: number;     // 阀门开度 0-100%
  isEdge?: boolean;  // 是否边户（热损失大）
  isTop?: boolean;   // 是否顶层（热损失大）
}

interface OneTowerTwoUnitsProps {
  buildingId: string;
  buildingName?: string;
  floors?: number;
  unitData: UnitData[];  // 长度 = floors * 2，按从顶层到底层排列
  mainValveOpenPct?: number;  // 楼前总阀开度
  isAdjusting?: boolean;      // 是否正在调节（演示阶段5）
  onUnitClick?: (floor: number, unit: 'left' | 'right') => void;
  className?: string;
}

// 根据温度获取颜色
const getTempColor = (temp: number) => {
  if (temp < 16) return { bg: 'rgba(30,58,138,0.6)', border: '#3b82f6', text: '#93c5fd', label: '过冷' };
  if (temp < 18) return { bg: 'rgba(30,58,138,0.4)', border: '#60a5fa', text: '#bfdbfe', label: '偏冷' };
  if (temp <= 22) return { bg: 'rgba(6,78,59,0.4)', border: '#22c55e', text: '#86efac', label: '舒适' };
  if (temp <= 24) return { bg: 'rgba(120,53,15,0.4)', border: '#f97316', text: '#fdba74', label: '偏热' };
  return { bg: 'rgba(127,29,29,0.5)', border: '#ef4444', text: '#fca5a5', label: '过热' };
};

// 阀门SVG（圆形，带旋转手柄）
const ValveSVG = ({ openPct, size = 24, isAdjusting = false, color = '#22c55e' }: {
  openPct: number; size?: number; isAdjusting?: boolean; color?: string;
}) => {
  const angle = -90 + openPct * 0.9; // -90° (全关) → 0° (全开)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ animation: isAdjusting ? 'spin 2s linear infinite' : 'none' }}>
      <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth="2.5" opacity="0.5" />
      <circle cx="20" cy="20" r="10" fill="rgba(0,20,60,0.6)" stroke={color} strokeWidth="1.5" />
      {/* 开度弧 */}
      <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={`${openPct * 0.88} 88`}
        strokeDashoffset="22"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* 手柄 */}
      <line
        x1="20" y1="20" x2="20" y2="8"
        stroke={isAdjusting ? '#fbbf24' : color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{
          transformOrigin: '20px 20px',
          transform: `rotate(${angle}deg)`,
          transition: 'transform 0.5s ease',
        }}
      />
      <circle cx="20" cy="20" r="3" fill={color} />
    </svg>
  );
};

// 楼前总阀（菱形SVG）
const MainValveSVG = ({ openPct, isAdjusting = false }: { openPct: number; isAdjusting?: boolean }) => {
  const angle = -90 + openPct * 0.9;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="44" height="44" viewBox="0 0 44 44">
        {/* 菱形外框 */}
        <polygon
          points="22,4 40,22 22,40 4,22"
          fill="rgba(0,20,60,0.8)"
          stroke="#fbbf24"
          strokeWidth="2"
        />
        {/* 内部圆 */}
        <circle cx="22" cy="22" r="10" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.5" />
        {/* 开度弧 */}
        <circle cx="22" cy="22" r="10" fill="none" stroke="#fbbf24" strokeWidth="2"
          strokeDasharray={`${openPct * 0.628} 62.8`}
          strokeDashoffset="15.7"
          strokeLinecap="round"
        />
        {/* 手柄 */}
        <line
          x1="22" y1="22" x2="22" y2="13"
          stroke={isAdjusting ? '#ef4444' : '#fbbf24'}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transformOrigin: '22px 22px',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 0.8s ease',
          }}
        />
        <circle cx="22" cy="22" r="3" fill="#fbbf24" />
      </svg>
      <div style={{ fontSize: 10, color: '#fbbf24', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>
        {openPct}%
      </div>
      <div style={{ fontSize: 9, color: 'rgba(200,160,60,0.6)', fontFamily: "'Noto Sans SC', sans-serif" }}>总阀</div>
    </div>
  );
};

// 单户卡片
const UnitCard = ({
  data, floor, side, onClick, isAdjusting,
}: {
  data: UnitData;
  floor: number;
  side: 'left' | 'right';
  onClick?: () => void;
  isAdjusting: boolean;
}) => {
  const colors = getTempColor(data.temp);
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        height: '100%',
        borderRadius: 8,
        padding: '6px 8px',
        cursor: 'pointer',
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        boxShadow: isAdjusting ? `0 0 12px ${colors.border}60` : 'none',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        animation: isAdjusting ? 'pulse-unit 1.5s ease-in-out infinite' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 16, fontWeight: 900, color: colors.text,
            fontFamily: "'Share Tech Mono', monospace",
            textShadow: `0 0 8px ${colors.border}80`,
          }}>
            {data.temp.toFixed(1)}℃
          </div>
          <div style={{ fontSize: 9, color: `${colors.text}80`, marginTop: 1 }}>
            {data.isEdge ? '边户 ' : ''}{data.isTop ? '顶层' : ''}
          </div>
        </div>
        <ValveSVG openPct={data.valve} size={22} isAdjusting={isAdjusting} color={colors.border} />
      </div>
      <div style={{
        fontSize: 9, color: `${colors.text}70`,
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        阀{data.valve}%
      </div>
    </div>
  );
};

export const OneTowerTwoUnits = ({
  buildingId,
  buildingName,
  floors = 6,
  unitData,
  mainValveOpenPct = 75,
  isAdjusting = false,
  onUnitClick,
  className = '',
}: OneTowerTwoUnitsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 演示阶段5时的阀门调节动画
  useEffect(() => {
    if (!isAdjusting || !containerRef.current) return;
    // 逐层延迟高亮
    const rows = containerRef.current.querySelectorAll('.floor-row');
    rows.forEach((row, i) => {
      gsap.fromTo(row,
        { opacity: 0.5, x: -5 },
        { opacity: 1, x: 0, duration: 0.4, delay: i * 0.3, ease: 'power2.out' }
      );
    });
  }, [isAdjusting]);

  // 确保unitData长度足够
  const safeData = (idx: number): UnitData => {
    if (idx < unitData.length) return unitData[idx];
    const baseTemp = 18 + Math.random() * 4;
    return { temp: parseFloat(baseTemp.toFixed(1)), valve: 60 + Math.floor(Math.random() * 30) };
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: 320,
        background: 'rgba(0,10,30,0.95)',
        borderRadius: 16,
        border: '1.5px solid rgba(0,180,255,0.25)',
        padding: '20px 16px 16px',
        boxShadow: '0 0 40px rgba(0,100,200,0.2)',
      }}
    >
      {/* 楼顶标识 */}
      <div style={{
        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,40,120,0.9)',
        border: '1px solid rgba(0,180,255,0.4)',
        borderRadius: 20, padding: '3px 14px',
        fontSize: 12, fontWeight: 800, color: '#00D4FF',
        fontFamily: "'Noto Sans SC', sans-serif",
        whiteSpace: 'nowrap',
        boxShadow: '0 0 12px rgba(0,180,255,0.3)',
      }}>
        {buildingName ?? `${buildingId}栋`} · 一梯两户
      </div>

      {/* 楼前总阀（左侧） */}
      <div style={{
        position: 'absolute', left: -52, top: '50%', transform: 'translateY(-50%)',
      }}>
        <MainValveSVG openPct={mainValveOpenPct} isAdjusting={isAdjusting} />
      </div>

      {/* 楼层列表（从顶层到底层） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: floors }).map((_, idx) => {
          const floor = floors - idx; // 从顶楼开始
          const leftUnit = safeData((floor - 1) * 2);
          const rightUnit = safeData((floor - 1) * 2 + 1);
          const leftAdjusting = isAdjusting && leftUnit.valve > 70;
          const rightAdjusting = isAdjusting && rightUnit.valve > 70;

          return (
            <div
              key={floor}
              className="floor-row"
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 60 }}
            >
              {/* 楼层号 */}
              <div style={{
                width: 24, textAlign: 'center', flexShrink: 0,
                fontSize: 11, fontWeight: 700,
                color: 'rgba(100,160,220,0.7)',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {floor}F
              </div>

              {/* 左户 */}
              <UnitCard
                data={leftUnit}
                floor={floor}
                side="left"
                onClick={() => onUnitClick?.(floor, 'left')}
                isAdjusting={leftAdjusting}
              />

              {/* 电梯井 */}
              <div style={{
                width: 28, height: 48, flexShrink: 0,
                background: 'rgba(15,25,50,0.8)',
                border: '1px solid rgba(0,100,200,0.2)',
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 14, height: 36,
                  background: 'rgba(0,40,100,0.6)',
                  border: '1px solid rgba(0,100,200,0.3)',
                  borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 7, color: 'rgba(100,150,200,0.4)', writingMode: 'vertical-rl' }}>梯</span>
                </div>
              </div>

              {/* 右户 */}
              <UnitCard
                data={rightUnit}
                floor={floor}
                side="right"
                onClick={() => onUnitClick?.(floor, 'right')}
                isAdjusting={rightAdjusting}
              />
            </div>
          );
        })}
      </div>

      {/* 底部入户管道（供水红+回水蓝） */}
      <div style={{
        marginTop: 10, paddingTop: 8,
        borderTop: '1px solid rgba(0,100,200,0.15)',
        display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 20, height: 4, borderRadius: 2, background: '#ef4444' }} />
          <span style={{ fontSize: 9, color: 'rgba(200,100,100,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>供水</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 20, height: 4, borderRadius: 2, background: '#3b82f6' }} />
          <span style={{ fontSize: 9, color: 'rgba(100,150,220,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>回水</span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(100,160,220,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>
          总阀 {mainValveOpenPct}%
        </div>
      </div>

      <style>{`
        @keyframes pulse-unit {
          0%, 100% { box-shadow: 0 0 6px rgba(0,180,255,0.2); }
          50% { box-shadow: 0 0 16px rgba(0,180,255,0.5); }
        }
      `}</style>
    </div>
  );
};

export default OneTowerTwoUnits;
