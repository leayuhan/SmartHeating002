/**
 * BuildingZoomView.tsx
 * 楼栋点击后3D飞出放大视图
 * - 6层 × 2户 室温网格（每个窗格显示温度）
 * - 顶层报警灯（低温时红色闪烁）
 * - 报警灯 → AI智脑 连线动画（演示阶段2+）
 * - 阀门旋转动画（演示阶段5执行中）
 * - 调控前后室温对比（before/after）
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface BuildingZoomViewProps {
  buildingId: string;
  buildingName: string;
  floors?: number;
  baseTemp: number;           // 楼栋平均室温
  demoPhase?: number;         // 演示阶段
  isAlertTarget?: boolean;    // 是否为低温预警楼栋
  isExecuting?: boolean;      // 阶段5执行中
  onClose: () => void;
}

interface UnitCell {
  floor: number;
  side: 'left' | 'right';
  temp: number;
  valve: number;
  hasMeter: boolean;
}

function generateUnits(baseTemp: number, floors: number): UnitCell[] {
  const cells: UnitCell[] = [];
  for (let f = floors; f >= 1; f--) {
    const floorFactor = (f - Math.ceil(floors / 2)) * 0.25;
    for (const side of ['left', 'right'] as const) {
      const edgeFactor = side === 'left' ? -0.6 : 0;
      const topFactor = f === floors ? -1.1 : 0;
      const noise = (Math.sin(f * 7.3 + (side === 'left' ? 1 : 3)) * 0.3) as number;
      const rawTemp = baseTemp + floorFactor + edgeFactor + topFactor + noise;
      const clampedTemp = Math.max(14, Math.min(25, rawTemp));
      const temp = parseFloat(clampedTemp.toFixed(1));
      cells.push({
        floor: f,
        side,
        temp,
        valve: 45 + Math.floor(Math.abs(Math.sin(f * 3.7 + (side === 'left' ? 0 : 2))) * 40),
        hasMeter: f === 3 && side === 'left',
      });
    }
  }
  return cells;
}

function tempColor(t: number): string {
  if (t < 16) return '#EF4444';
  if (t < 18) return '#F97316';
  if (t < 20) return '#EAB308';
  if (t < 22) return '#22C55E';
  return '#00D4FF';
}

function ValveIcon({ openPct, isSpinning }: { openPct: number; isSpinning: boolean }) {
  const rotation = isSpinning ? undefined : (openPct / 100) * 90;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: 'block' }}>
      <circle cx="8" cy="8" r="7" fill="rgba(0,30,80,0.8)" stroke="rgba(0,180,255,0.5)" strokeWidth="1" />
      <g transform={`rotate(${rotation ?? 0}, 8, 8)`}
        style={isSpinning ? { animation: 'valve-spin 1.5s linear infinite', transformOrigin: '8px 8px' } : undefined}>
        <line x1="8" y1="3" x2="8" y2="13" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="8" x2="13" y2="8" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="8" cy="8" r="2" fill={isSpinning ? '#00FF9D' : '#00D4FF'} />
    </svg>
  );
}

export default function BuildingZoomView({
  buildingId,
  buildingName,
  floors = 6,
  baseTemp,
  demoPhase = 0,
  isAlertTarget = false,
  isExecuting = false,
  onClose,
}: BuildingZoomViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [units, setUnits] = useState<UnitCell[]>(() => generateUnits(baseTemp, floors));
  const [afterUnits, setAfterUnits] = useState<UnitCell[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [alarmLineProgress, setAlarmLineProgress] = useState(0);
  const alarmLineRef = useRef<SVGLineElement>(null);

  // 入场动画
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current,
        { scale: 0.7, opacity: 0, rotateY: -15 },
        { scale: 1, opacity: 1, rotateY: 0, duration: 0.5, ease: 'back.out(1.4)' }
      );
    }
  }, []);

  // 演示阶段5：室温逐渐回升
  useEffect(() => {
    if (isExecuting && isAlertTarget) {
      const interval = setInterval(() => {
        setUnits(prev => prev.map(u => ({
          ...u,
          temp: parseFloat(Math.min(22, u.temp + 0.15).toFixed(1)),
          valve: Math.min(90, u.valve + 3),
        })));
      }, 800);
      return () => clearInterval(interval);
    }
  }, [isExecuting, isAlertTarget]);

  // 演示阶段6：显示前后对比
  useEffect(() => {
    if (demoPhase === 6 && isAlertTarget) {
      const after = generateUnits(22, floors);
      setAfterUnits(after);
      setShowComparison(true);
    }
  }, [demoPhase, isAlertTarget, floors]);

  // 报警灯连线动画（阶段2-4）
  useEffect(() => {
    if (isAlertTarget && demoPhase >= 2 && demoPhase < 5) {
      const interval = setInterval(() => {
        setAlarmLineProgress(prev => (prev + 2) % 100);
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isAlertTarget, demoPhase]);

  const isAlarm = isAlertTarget && demoPhase >= 2 && demoPhase < 6;
  const avgTemp = units.reduce((s, u) => s + u.temp, 0) / units.length;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: 'rgba(0,8,30,0.97)',
        border: `2px solid ${isAlarm ? 'rgba(255,60,60,0.7)' : 'rgba(0,180,255,0.4)'}`,
        borderRadius: 16,
        padding: 16,
        minWidth: 340,
        maxWidth: 420,
        boxShadow: isAlarm
          ? '0 0 40px rgba(255,60,60,0.3), 0 20px 60px rgba(0,0,0,0.7)'
          : '0 0 40px rgba(0,180,255,0.2), 0 20px 60px rgba(0,0,0,0.7)',
        perspective: '800px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 10, right: 12, zIndex: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(148,210,255,0.6)', fontSize: 18, lineHeight: 1,
        }}
      >✕</button>

      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {/* 报警灯 */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: isAlarm ? 'rgba(255,60,60,0.2)' : 'rgba(0,80,200,0.2)',
          border: `2px solid ${isAlarm ? 'rgba(255,60,60,0.8)' : 'rgba(0,180,255,0.5)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
          animation: isAlarm ? 'alarm-pulse 0.7s ease-in-out infinite' : undefined,
          boxShadow: isAlarm ? '0 0 16px rgba(255,60,60,0.6)' : 'none',
          flexShrink: 0,
        }}>
          {isAlarm ? '⚠' : '🏢'}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: isAlarm ? '#FF6060' : '#E0F4FF', fontFamily: "'Noto Sans SC', sans-serif" }}>
            {buildingName}
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.6)', fontFamily: "'Share Tech Mono', monospace" }}>
            均温 <span style={{ color: isAlarm ? '#FF6060' : '#00D4FF', fontWeight: 700 }}>{avgTemp.toFixed(1)}°C</span>
            {isAlarm && <span style={{ color: '#FF6060', marginLeft: 6 }}>· 低温预警</span>}
            {isExecuting && <span style={{ color: '#00FF9D', marginLeft: 6 }}>· 调控中</span>}
          </div>
        </div>
        {/* 报警→AI连线SVG */}
        {isAlarm && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
            <defs>
              <linearGradient id="alarm-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF4444" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            {/* 从报警灯到右侧（象征连接AI智脑） */}
            <line ref={alarmLineRef}
              x1="28" y1="24" x2="95%" y2="24"
              stroke="url(#alarm-line-grad)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              strokeDashoffset={-alarmLineProgress}
              opacity="0.7"
            />
            <text x="96%" y="22" textAnchor="end" fontSize="8" fill="#00D4FF" opacity="0.8">→ AI智脑</text>
          </svg>
        )}
      </div>

      {/* 楼层室温网格 */}
      {!showComparison ? (
        <div>
          {/* 列标题 */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 4, marginBottom: 4 }}>
            <div />
            <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>1单元</div>
            <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>2单元</div>
          </div>
          {Array.from({ length: floors }, (_, i) => floors - i).map(floor => {
            const leftUnit = units.find(u => u.floor === floor && u.side === 'left');
            const rightUnit = units.find(u => u.floor === floor && u.side === 'right');
            return (
              <div key={floor} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 4, marginBottom: 4 }}>
                {/* 楼层标签 */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'rgba(100,180,255,0.5)',
                  fontFamily: "'Share Tech Mono', monospace",
                }}>
                  {floor}F
                </div>
                {/* 左单元 */}
                {leftUnit && (
                  <UnitCell
                    unit={leftUnit}
                    isExecuting={isExecuting}
                    isAlarm={isAlarm && leftUnit.temp < 18}
                  />
                )}
                {/* 右单元 */}
                {rightUnit && (
                  <UnitCell
                    unit={rightUnit}
                    isExecuting={isExecuting}
                    isAlarm={isAlarm && rightUnit.temp < 18}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 前后对比视图 */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#FF6060', fontFamily: "'Noto Sans SC', sans-serif" }}>
              调控前
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#00FF9D', fontFamily: "'Noto Sans SC', sans-serif" }}>
              调控后
            </div>
          </div>
          {Array.from({ length: floors }, (_, i) => floors - i).map(floor => {
            const beforeLeft = units.find(u => u.floor === floor && u.side === 'left');
            const beforeRight = units.find(u => u.floor === floor && u.side === 'right');
            const afterLeft = afterUnits.find(u => u.floor === floor && u.side === 'left');
            const afterRight = afterUnits.find(u => u.floor === floor && u.side === 'right');
            return (
              <div key={floor} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                {/* 调控前 */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {beforeLeft && <MiniTempBadge temp={beforeLeft.temp} />}
                  {beforeRight && <MiniTempBadge temp={beforeRight.temp} />}
                </div>
                {/* 调控后 */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {afterLeft && <MiniTempBadge temp={afterLeft.temp} after />}
                  {afterRight && <MiniTempBadge temp={afterRight.temp} after />}
                </div>
              </div>
            );
          })}
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(0,255,100,0.08)', border: '1px solid rgba(0,255,100,0.3)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, color: 'rgba(150,220,180,0.8)', fontFamily: "'Noto Sans SC', sans-serif" }}>均温提升</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#00FF9D', fontFamily: "'Share Tech Mono', monospace" }}>
              +{(22 - avgTemp).toFixed(1)}°C
            </span>
          </div>
        </div>
      )}

      {/* 底部阀门状态栏 */}
      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,180,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ValveIcon openPct={isExecuting ? 85 : 65} isSpinning={isExecuting} />
          <span style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>
            楼前总阀 {isExecuting ? '85%' : '65%'}
          </span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>
          {buildingId.replace('b', '')}号楼 · {floors}层 · {floors * 2}户
        </div>
      </div>

      <style>{`
        @keyframes alarm-pulse {
          0%, 100% { box-shadow: 0 0 16px rgba(255,60,60,0.6); opacity: 1; }
          50% { box-shadow: 0 0 30px rgba(255,60,60,0.9); opacity: 0.7; }
        }
        @keyframes valve-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// 单元格组件
function UnitCell({ unit, isExecuting, isAlarm }: { unit: UnitCell; isExecuting: boolean; isAlarm: boolean }) {
  const color = tempColor(unit.temp);
  return (
    <div style={{
      padding: '5px 6px', borderRadius: 7,
      background: isAlarm ? 'rgba(60,0,0,0.6)' : 'rgba(0,15,50,0.7)',
      border: `1px solid ${isAlarm ? 'rgba(255,60,60,0.5)' : 'rgba(0,180,255,0.2)'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      transition: 'all 0.3s ease',
      animation: isAlarm ? 'alarm-pulse 0.8s ease-in-out infinite' : undefined,
    }}>
      {/* 温度 */}
      <div style={{
        fontSize: 13, fontWeight: 800, color,
        fontFamily: "'Share Tech Mono', monospace",
        textShadow: `0 0 8px ${color}80`,
        lineHeight: 1,
      }}>
        {unit.temp.toFixed(1)}
      </div>
      <div style={{ fontSize: 7.5, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
        °C
      </div>
      {/* 阀门 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <ValveIcon openPct={unit.valve} isSpinning={isExecuting} />
        <span style={{ fontSize: 7.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
          {isExecuting ? Math.min(90, unit.valve + 15) : unit.valve}%
        </span>
      </div>
      {unit.hasMeter && (
        <div style={{ fontSize: 7, color: '#00FF9D', fontFamily: "'Share Tech Mono', monospace" }}>📡</div>
      )}
    </div>
  );
}

// 迷你温度徽章（用于前后对比）
function MiniTempBadge({ temp, after = false }: { temp: number; after?: boolean }) {
  const color = after ? '#00FF9D' : tempColor(temp);
  return (
    <div style={{
      flex: 1, padding: '4px 6px', borderRadius: 5,
      background: after ? 'rgba(0,255,100,0.08)' : 'rgba(0,15,50,0.6)',
      border: `1px solid ${color}40`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "'Share Tech Mono', monospace" }}>
        {temp.toFixed(1)}°
      </div>
    </div>
  );
}
