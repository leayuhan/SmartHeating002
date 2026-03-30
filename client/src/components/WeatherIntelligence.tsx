/**
 * WeatherIntelligence.tsx
 * 阶段1.5：气象突变检测 + 热惰性预测
 * - 卫星图标出现，发射数据流到AI智脑
 * - 云层从左飘过，遮挡太阳（辐射降温）
 * - AI计算热惰性影响（延迟2-4小时）
 * - 显示未来12h室温预测曲线（考虑热惰性）
 * - 给出预调控建议
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';

interface WeatherIntelligenceProps {
  isActive: boolean;
  onComplete?: () => void;
}

// 生成室温预测数据（考虑热惰性）
const generatePrediction = () => {
  const arr = [];
  for (let h = 0; h <= 12; h++) {
    // 无干预：热惰性延迟2h后开始降温
    const noAction = h < 2 ? 21.5 : 21.5 - (h - 2) * 0.6;
    // AI预调控：提前1h升温，维持在21℃以上
    const withAI = h < 1 ? 21.5 : Math.max(21.2, 21.5 - (h - 1) * 0.15);
    arr.push({
      h,
      noAction: parseFloat(Math.max(16, noAction).toFixed(1)),
      withAI: parseFloat(withAI.toFixed(1)),
    });
  }
  return arr;
};

export const WeatherIntelligence = ({ isActive, onComplete }: WeatherIntelligenceProps) => {
  const satelliteRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<SVGPathElement>(null);
  const [phase, setPhase] = useState<'idle' | 'satellite' | 'cloud' | 'calculating' | 'result'>('idle');
  const [predData] = useState(generatePrediction);
  const [showCurve, setShowCurve] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setShowCurve(false);
      return;
    }

    const tl = gsap.timeline({ onComplete });

    // 阶段1: 卫星出现
    tl.call(() => setPhase('satellite'), undefined, 0);
    if (satelliteRef.current) {
      tl.fromTo(satelliteRef.current,
        { scale: 0, opacity: 0, rotation: -30 },
        { scale: 1, opacity: 1, rotation: 0, duration: 1, ease: 'back.out(1.7)' },
        0
      );
    }

    // 数据流beam动画
    if (beamRef.current) {
      tl.fromTo(beamRef.current,
        { strokeDashoffset: 300 },
        { strokeDashoffset: 0, duration: 2, ease: 'none', repeat: 2 },
        0.5
      );
    }

    // 阶段2: 云层飘过
    tl.call(() => setPhase('cloud'), undefined, 2);
    if (cloudRef.current) {
      tl.fromTo(cloudRef.current,
        { x: -200, opacity: 0 },
        { x: 300, opacity: 1, duration: 3, ease: 'power1.inOut' },
        2
      );
    }
    if (sunRef.current) {
      tl.to(sunRef.current, { opacity: 0.25, filter: 'blur(4px)', duration: 2 }, 3);
    }

    // 阶段3: AI计算热惰性
    tl.call(() => setPhase('calculating'), undefined, 5);

    // 阶段4: 显示预测曲线
    tl.call(() => {
      setPhase('result');
      setShowCurve(true);
    }, undefined, 7);

    // 完成
    tl.call(() => {}, undefined, 11);

    return () => { tl.kill(); };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div style={{
      position: 'absolute',
      right: 12,
      top: 60,
      width: 340,
      zIndex: 20,
      background: 'rgba(2,11,26,0.96)',
      border: '1.5px solid rgba(245,158,11,0.5)',
      borderRadius: 12,
      boxShadow: '0 0 24px rgba(245,158,11,0.2)',
      overflow: 'hidden',
      padding: '10px',
      pointerEvents: 'none',
    }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 800 }}>☁️ 气象突变检测</div>
        <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>
          {phase === 'satellite' && '卫星数据接入中...'}
          {phase === 'cloud' && '检测到云层移入，辐射降温剠5℃'}
          {phase === 'calculating' && 'AI正在计算热惰性延迟影响...'}
          {phase === 'result' && '预测完成：2小时后室温将下降，建议提前调控'}
        </div>
      </div>

      {/* 天气参数行 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: '6px 8px', border: '1px solid #374151', textAlign: 'center' }}>
          <div style={{ fontSize: 16 }}>🌡️</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>-3.5℃</div>
          <div style={{ color: '#9ca3af', fontSize: 10 }}>当前外温</div>
        </div>
        <div style={{ background: 'rgba(120,53,15,0.3)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(245,158,11,0.4)', textAlign: 'center' }}>
          <div style={{ fontSize: 16 }}>📉</div>
          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>-5℃</div>
          <div style={{ color: '#9ca3af', fontSize: 10 }}>预计降温</div>
        </div>
      </div>

      {/* 热惰性说明 */}
      {(phase === 'calculating' || phase === 'result') && (
        <div style={{ background: 'rgba(88,28,135,0.3)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: '#ddd6fe', marginBottom: 8 }}>
          <span style={{ color: '#c084fc', fontWeight: 700 }}>🧱 热惰性延迟：</span>建筑墙体热容量大，外温变化需<span style={{ color: '#fbbf24', fontWeight: 700 }}>2-4小时</span>才能传导至室内。
        </div>
      )}

      {/* 计算中动画 */}
      {phase === 'calculating' && !showCurve && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: '#06b6d4', fontSize: 11 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }} className="animate-spin">⚙️</div>
          <div>AI正在计算热惰性延迟影响...</div>
        </div>
      )}

      {/* 预测曲线 */}
      {showCurve && (
        <div>
          <div style={{ color: '#06b6d4', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>未来12h室温预测</div>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={predData}>
                <XAxis dataKey="h" stroke="#555" tickFormatter={v => `${v}h`} tick={{ fontSize: 9 }} />
                <YAxis stroke="#555" domain={[15, 23]} tick={{ fontSize: 9 }} width={24} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 10 }}
                  labelFormatter={v => `${v}小时后`}
                />
                <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="noAction" stroke="#ef4444" strokeWidth={1.5} dot={false} name="无干预" />
                <Line type="monotone" dataKey="withAI" stroke="#10b981" strokeWidth={2} dot={false} name="AI预调控" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#d1d5db' }}>
              <span style={{ width: 12, height: 2, background: '#ef4444', display: 'inline-block' }} />
              无干预（降至16℃）
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#d1d5db' }}>
              <span style={{ width: 12, height: 2, background: '#10b981', display: 'inline-block' }} />
              AI预调控（保21℃+）
            </span>
          </div>
          <div style={{ marginTop: 6, background: 'rgba(6,78,59,0.3)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 8, padding: '5px 8px', fontSize: 10, color: '#a7f3d0' }}>
            <span style={{ color: '#34d399', fontWeight: 700 }}>🤖 AI建议：</span>立即将供温从45℃升至47℃，提前预热，节能<span style={{ color: '#06b6d4', fontWeight: 700 }}>12%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherIntelligence;
