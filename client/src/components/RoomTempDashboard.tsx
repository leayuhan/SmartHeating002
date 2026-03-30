/**
 * RoomTempDashboard.tsx
 * 平均室温Dashboard
 * - 显示全小区平均室温 vs 目标值
 * - 调控前：楼层分布不均（顶层17°C，底层19°C，中层22°C）
 * - 调控后：趋于均衡（全部21-22°C）
 * - 各楼栋室温横向条形图
 */
import { useEffect, useRef, useState } from 'react';

// ── Animated Number ─────────────────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 1, suffix = '', style }: {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: React.CSSProperties;
}) {
  const [displayVal, setDisplayVal] = useState(value);
  const [prevVal, setPrevVal] = useState(value);
  const [flash, setFlash] = useState(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (Math.abs(value - prevVal) < 0.001) return;
    setFlash(true);
    const startTime = performance.now();
    const duration = 500;
    const startVal = prevVal;
    const endVal = value;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayVal(startVal + (endVal - startVal) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayVal(endVal);
        setPrevVal(endVal);
        setTimeout(() => setFlash(false), 300);
      }
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);

  return (
    <span style={{
      ...style,
      transition: 'color 0.3s ease',
      textShadow: flash ? '0 0 12px rgba(0,212,255,0.8), 0 0 24px rgba(0,180,255,0.4)' : (style?.textShadow as string | undefined),
    }}>
      {displayVal.toFixed(decimals)}{suffix}
    </span>
  );
}

interface RoomTempDashboardProps {
  buildings: Array<{ id: string; name: string; temp: number; stationId: string; predicted12h?: number }>;
  demoPhase: number;
  isDemoRunning: boolean;
  targetTemp?: number;
}

function TempBar({ label, temp, target, color, width = 100 }: {
  label: string; temp: number; target: number; color: string; width?: number;
}) {
  const pct = Math.max(0, Math.min(100, ((temp - 14) / (26 - 14)) * 100));
  const targetPct = Math.max(0, Math.min(100, ((target - 14) / (26 - 14)) * 100));
  const isLow = temp < 18;
  const isGood = temp >= 20;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <div style={{ width: 36, fontSize: 8.5, color: 'rgba(148,210,255,0.6)', fontFamily: "'Noto Sans SC', sans-serif", flexShrink: 0, textAlign: 'right' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,40,100,0.4)', position: 'relative', overflow: 'visible' }}>
        {/* 目标线 */}
        <div style={{
          position: 'absolute', left: `${targetPct}%`, top: -2, bottom: -2, width: 1.5,
          background: 'rgba(0,212,255,0.4)', zIndex: 2,
        }} />
        {/* 实际值条 */}
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: isLow ? 'linear-gradient(90deg, #EF4444, #F97316)'
            : isGood ? `linear-gradient(90deg, ${color}80, ${color})`
            : 'linear-gradient(90deg, #EAB308, #F97316)',
          transition: 'width 0.5s ease',
          boxShadow: isLow ? '0 0 6px rgba(239,68,68,0.5)' : `0 0 4px ${color}40`,
        }} />
      </div>
           <AnimatedNumber
        value={temp}
        decimals={1}
        suffix="°"
        style={{
          width: 36, fontSize: 9, fontWeight: 700,
          color: isLow ? '#EF4444' : isGood ? color : '#EAB308',
          fontFamily: "'Share Tech Mono', monospace", flexShrink: 0,
          display: 'inline-block',
        }}
      />
    </div>
  );
}

export default function RoomTempDashboard({
  buildings,
  demoPhase,
  isDemoRunning,
  targetTemp = 22,
}: RoomTempDashboardProps) {
  const [displayTemps, setDisplayTemps] = useState<Record<string, number>>({});
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;

  // 初始化显示温度（用buildingIds字符串作为依赖，避免数组引用变化导致无限循环）
  const buildingIds = buildings.map(b => b.id).join(',');
  useEffect(() => {
    const temps: Record<string, number> = {};
    buildingsRef.current.forEach(b => { temps[b.id] = b.temp; });
    setDisplayTemps(temps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingIds]);

  // 演示阶段5：温度逐渐回升
  useEffect(() => {
    if (isDemoRunning && demoPhase === 5) {
      const interval = setInterval(() => {
        setDisplayTemps(prev => {
          const next = { ...prev };
          buildingsRef.current.forEach(b => {
            if (next[b.id] !== undefined && next[b.id] < 22) {
              next[b.id] = parseFloat(Math.min(22, next[b.id] + 0.08).toFixed(1));
            }
          });
          return next;
        });
      }, 600);
      return () => clearInterval(interval);
    }
  }, [isDemoRunning, demoPhase]);

  // In normal mode (not demo), use live buildings.temp directly for dynamic updates
  // In demo phase 5, use displayTemps (animated recovery)
  const getDisplayTemp = (b: { id: string; temp: number }) =>
    (isDemoRunning && demoPhase === 5 && displayTemps[b.id] !== undefined)
      ? displayTemps[b.id]
      : b.temp;

  const avgTemp = buildings.length > 0
    ? buildings.reduce((s, b) => s + getDisplayTemp(b), 0) / buildings.length
    : 0;

  const lowTempCount = buildings.filter(b => getDisplayTemp(b) < 18).length;
  const goodTempCount = buildings.filter(b => getDisplayTemp(b) >= 20).length;

  const stationColors: Record<string, string> = {
    S1: '#3B82F6',
    S2: '#8B5CF6',
    S3: '#10B981',
  };

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(0,8,30,0.8)',
      border: '1px solid rgba(0,180,255,0.15)',
      borderRadius: 12,
    }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#00D4FF', fontFamily: "'Noto Sans SC', sans-serif" }}>
          全区室温分布
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {lowTempCount > 0 && (
            <div style={{
              padding: '2px 7px', borderRadius: 4,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 8.5, color: '#EF4444', fontFamily: "'Noto Sans SC', sans-serif",
            }}>
              {lowTempCount}栋低温
            </div>
          )}
          <div style={{
            padding: '2px 7px', borderRadius: 4,
            background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.2)',
            fontSize: 8.5, color: '#00FF9D', fontFamily: "'Noto Sans SC', sans-serif",
          }}>
            {goodTempCount}栋达标
          </div>
        </div>
      </div>

      {/* 平均室温大数字 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif", marginBottom: 2 }}>
            全区平均室温
          </div>
          <AnimatedNumber
            value={avgTemp}
            decimals={1}
            suffix="°C"
            style={{
              fontSize: 28, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace",
              color: avgTemp >= 20 ? '#00FF9D' : avgTemp >= 18 ? '#EAB308' : '#EF4444',
              textShadow: '0 0 16px rgba(0,212,255,0.3)',
              lineHeight: 1,
              display: 'block',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>14°C</span>
            <span style={{ fontSize: 8.5, color: 'rgba(0,212,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>目标 {targetTemp}°C</span>
            <span style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>26°C</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,40,100,0.4)', position: 'relative', overflow: 'visible' }}>
            {/* 目标线 */}
            <div style={{
              position: 'absolute',
              left: `${((targetTemp - 14) / 12) * 100}%`,
              top: -3, bottom: -3, width: 1.5,
              background: 'rgba(0,212,255,0.5)',
            }} />
            {/* 当前均温 */}
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.max(0, Math.min(100, ((avgTemp - 14) / 12) * 100))}%`,
              background: avgTemp >= 20
                ? 'linear-gradient(90deg, #00A8FF, #00FF9D)'
                : avgTemp >= 18
                ? 'linear-gradient(90deg, #EAB308, #F97316)'
                : 'linear-gradient(90deg, #EF4444, #F97316)',
              transition: 'width 0.5s ease',
              boxShadow: '0 0 6px rgba(0,200,255,0.4)',
            }} />
          </div>
        </div>
      </div>

      {/* 各楼栋室温条形图 */}
      <div>
        <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.4)', marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 0.5 }}>
          各楼栋室温（目标线 {targetTemp}°C）
        </div>
        {buildings.map(b => (
          <TempBar
            key={b.id}
            label={b.name.replace('号楼', '#')}
            temp={getDisplayTemp(b)}
            target={targetTemp}
            color={stationColors[b.stationId] ?? '#00D4FF'}
          />
        ))}
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        {[
          { color: '#EF4444', label: '< 18°C 低温' },
          { color: '#EAB308', label: '18-20°C 偏低' },
          { color: '#00FF9D', label: '≥ 20°C 达标' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
            <span style={{ fontSize: 8, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* 未来2-12小时低温用户预警列表 */}
      {(() => {
        const lowTempWarnings = buildings
          .filter(b => (b.predicted12h ?? getDisplayTemp(b)) < 18)
          .map(b => {
            const pred = Math.max(16, b.predicted12h ?? getDisplayTemp(b));
            // 估算几小时后会达到低温
            const curTemp = getDisplayTemp(b);
            const hoursUntilLow = curTemp < 18 ? 0 : Math.round((curTemp - 18) / Math.max(0.01, (curTemp - pred) / 12));
            return { b, pred, hoursUntilLow };
          })
          .sort((a, b) => a.hoursUntilLow - b.hoursUntilLow);

        if (lowTempWarnings.length === 0) return null;

        return (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(80,0,0,0.3)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#EF4444', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⚠️</span> 未来2-12小时低温预警
              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 10, background: 'rgba(120,0,0,0.5)', color: '#EF4444', border: '1px solid rgba(255,60,60,0.3)', fontWeight: 700 }}>
                {lowTempWarnings.length}栋
              </span>
            </div>
            {lowTempWarnings.map(({ b, pred, hoursUntilLow }) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(255,60,60,0.1)' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,180,180,0.8)', fontFamily: "'Noto Sans SC', sans-serif" }}>
                  {b.name}
                </span>
                <span style={{ fontSize: 9, color: '#EF4444', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>
                  预计 {pred.toFixed(1)}°C
                </span>
                <span style={{ fontSize: 8, color: 'rgba(255,120,120,0.6)', fontFamily: "'Share Tech Mono', monospace" }}>
                  {hoursUntilLow <= 0 ? '已低温' : `${hoursUntilLow}h内`}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
