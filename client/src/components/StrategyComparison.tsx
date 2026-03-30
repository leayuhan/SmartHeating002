/**
 * StrategyComparison.tsx  v2.0
 * 三种控制策略对比：流量控制 / 供温控制 / 室温反馈（AI推荐）
 * - Tab切换三种策略
 * - 每种策略显示：目标值 vs 实际值 逐渐逼近动画
 * - 室温反馈策略标记为"AI推荐"
 * - 底部室温回升曲线对比
 */
import { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Legend,
} from 'recharts';

interface StrategyComparisonProps {
  isActive: boolean;
  onSelect?: (strategyId: string) => void;
}

interface StrategyDef {
  id: string;
  name: string;
  shortName: string;
  desc: string;
  mechanism: string;
  targetLabel: string;
  targetUnit: string;
  targetValue: number;
  initialActual: number;
  finalActual: number;
  convergenceTime: number; // seconds to converge
  pros: string[];
  cons: string[];
  color: string;
  recommended: boolean;
  efficiency: number;
  tempRecoveryMin: number; // minutes to recover room temp
}

const STRATEGIES: StrategyDef[] = [
  {
    id: 'flow',
    name: '流量控制',
    shortName: '调流量',
    desc: '通过调节循环泵频率控制管网流量，实现各楼栋按需分配',
    mechanism: '循环泵变频 → 管网流量调节 → 末端热量分配',
    targetLabel: '目标流量',
    targetUnit: 't/h',
    targetValue: 110,
    initialActual: 100,
    finalActual: 110,
    convergenceTime: 8,
    pros: ['精准分配', '减少水力失调', '响应较快'],
    cons: ['水力工况复杂', '需精确建模'],
    color: '#3B82F6',
    recommended: false,
    efficiency: 78,
    tempRecoveryMin: 35,
  },
  {
    id: 'supply',
    name: '供温控制',
    shortName: '调供温',
    desc: '通过调节换热站供水温度，提升整体供热量',
    mechanism: '换热站调节 → 供水温度升高 → 散热器热量增加',
    targetLabel: '目标供温',
    targetUnit: '°C',
    targetValue: 55,
    initialActual: 53,
    finalActual: 55,
    convergenceTime: 6,
    pros: ['响应快', '控制简单', '效果明显'],
    cons: ['能耗偏高', '过供热风险', '不精准'],
    color: '#F59E0B',
    recommended: false,
    efficiency: 65,
    tempRecoveryMin: 25,
  },
  {
    id: 'room',
    name: '室温反馈',
    shortName: '室温AI',
    desc: '基于AI预测的室温反馈闭环控制，按需精准供热',
    mechanism: 'AI预测室温 → 计算热量缺口 → 协调流量+供温 → 验证反馈',
    targetLabel: '目标室温',
    targetUnit: '°C',
    targetValue: 18,
    initialActual: 16,
    finalActual: 18,
    convergenceTime: 12,
    pros: ['按需供热', '节能 18%', '精准闭环', '自学习优化'],
    cons: ['依赖 A I模型精度', '实施复杂度高'],
    color: '#10B981',
    recommended: true,
    efficiency: 94,
    tempRecoveryMin: 28,
  },
];

// 生成室温回升曲线
function generateRecoveryCurve(strategy: StrategyDef) {
  const points = [];
  const startTemp = strategy.initialActual;
  const endTemp = strategy.finalActual;
  for (let t = 0; t <= 60; t += 5) {
    const progress = Math.min(1, t / strategy.tempRecoveryMin);
    const eased = 1 - Math.pow(1 - progress, 2.5);
    const temp = startTemp + (endTemp - startTemp) * eased;
    points.push({ t, temp: parseFloat(temp.toFixed(1)) });
  }
  return points;
}

// 实际值逼近目标值的动画数据
function generateConvergenceData(strategy: StrategyDef, progress: number) {
  const points = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const animFrac = Math.min(1, progress * 1.2);
    const eased = 1 - Math.pow(1 - Math.min(frac, animFrac), 2);
    const actual = strategy.initialActual + (strategy.finalActual - strategy.initialActual) * eased;
    points.push({
      t: i,
      target: strategy.targetValue,
      actual: parseFloat(actual.toFixed(1)),
    });
  }
  return points;
}

export function StrategyComparison({ isActive, onSelect }: StrategyComparisonProps) {
  const [activeTab, setActiveTab] = useState<string>('room');
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 切换Tab或面板激活时重置动画
  useEffect(() => {
    setAnimProgress(0);
    if (animRef.current) clearInterval(animRef.current);
    if (isActive) {
      // 延迟200ms再开始，确保面板已显示
      const startTimer = setTimeout(() => {
        animRef.current = setInterval(() => {
          setAnimProgress(prev => {
            if (prev >= 1) {
              if (animRef.current) clearInterval(animRef.current);
              return 1;
            }
            // 每80ms步进0.01，共100步×80ms=8秒
            return prev + 0.01;
          });
        }, 80);
      }, 200);
      return () => {
        clearTimeout(startTimer);
        if (animRef.current) clearInterval(animRef.current);
      };
    }
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [activeTab, isActive]);

  if (!isActive) return null;

  const strategy = STRATEGIES.find(s => s.id === activeTab)!;
  const convergenceData = generateConvergenceData(strategy, animProgress);
  const recoveryCurve = generateRecoveryCurve(strategy);

  const currentActual = convergenceData[convergenceData.length - 1]?.actual ?? strategy.initialActual;
  const convergencePercent = Math.round(
    ((currentActual - strategy.initialActual) / (strategy.finalActual - strategy.initialActual)) * 100
  );

  return (
    <div style={{
      position: 'absolute',
      right: 12,
      top: 50,
      bottom: 50,
      width: 380,
      zIndex: 25,
      background: 'rgba(0,5,20,0.97)',
      border: '1.5px solid rgba(0,212,255,0.4)',
      borderRadius: 12,
      boxShadow: '0 0 30px rgba(0,212,255,0.2)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      padding: 14,
      overflow: 'hidden',
    }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#00D4FF', fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 2 }}>
            AI 控制策略对比
          </div>
          <div style={{ fontSize: 11, color: 'rgba(100,180,255,0.6)', fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
            STRATEGY COMPARISON · 三种控制模式 · 实际值 vs 目标值
          </div>
        </div>
        <button
          onClick={() => onSelect?.(activeTab)}
          style={{
            padding: '8px 20px', borderRadius: 10,
            border: '1.5px solid rgba(0,212,255,0.5)',
            background: 'rgba(0,80,180,0.3)',
            color: '#00D4FF', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Noto Sans SC', sans-serif",
          }}
        >
          确认选择 ✓
        </button>
      </div>

      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STRATEGIES.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: `2px solid ${activeTab === s.id ? s.color : 'rgba(0,100,200,0.2)'}`,
              background: activeTab === s.id ? `${s.color}18` : 'rgba(0,15,50,0.5)',
              color: activeTab === s.id ? s.color : 'rgba(148,210,255,0.6)',
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: "'Noto Sans SC', sans-serif",
              position: 'relative',
            }}
          >
            {s.recommended && (
              <div style={{
                position: 'absolute', top: -8, right: 8,
                padding: '2px 8px', borderRadius: 4,
                background: s.color, color: 'white',
                fontSize: 9, fontWeight: 700,
                fontFamily: "'Noto Sans SC', sans-serif",
              }}>AI推荐</div>
            )}
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{s.shortName}</div>
            <div style={{ fontSize: 9.5, opacity: 0.8 }}>{s.name}</div>
          </button>
        ))}
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 0 }}>

        {/* 左侧：策略说明 + 实际vs目标 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 策略描述 */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(0,15,50,0.6)',
            border: `1px solid ${strategy.color}40`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: strategy.color, marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif" }}>
              {strategy.name}
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(148,210,255,0.8)', lineHeight: 1.7, fontFamily: "'Noto Sans SC', sans-serif", marginBottom: 8 }}>
              {strategy.desc}
            </div>
            <div style={{
              padding: '6px 10px', borderRadius: 7,
              background: `${strategy.color}10`,
              border: `1px solid ${strategy.color}25`,
              fontSize: 9.5, color: 'rgba(148,210,255,0.6)',
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {strategy.mechanism}
            </div>
          </div>

          {/* 实际值 vs 目标值 大数字展示 */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'rgba(0,15,50,0.6)',
            border: `1.5px solid ${strategy.color}50`,
            boxShadow: `0 0 20px ${strategy.color}20`,
          }}>
            <div style={{ fontSize: 10, color: 'rgba(100,180,255,0.5)', marginBottom: 10, fontFamily: "'Noto Sans SC', sans-serif" }}>
              {strategy.targetLabel} 收敛过程
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12 }}>
              {/* 实际值 */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', marginBottom: 4, fontFamily: "'Noto Sans SC', sans-serif" }}>
                  实际值
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace",
                  color: strategy.color,
                  textShadow: `0 0 20px ${strategy.color}80`,
                  lineHeight: 1,
                }}>
                  {currentActual.toFixed(1)}
                  <span style={{ fontSize: 14, marginLeft: 4, opacity: 0.7 }}>{strategy.targetUnit}</span>
                </div>
              </div>
              {/* 箭头 */}
              <div style={{ fontSize: 20, color: 'rgba(0,212,255,0.5)', paddingBottom: 8 }}>→</div>
              {/* 目标值 */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', marginBottom: 4, fontFamily: "'Noto Sans SC', sans-serif" }}>
                  目标值
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace",
                  color: '#00D4FF',
                  textShadow: '0 0 20px rgba(0,212,255,0.6)',
                  lineHeight: 1,
                }}>
                  {strategy.targetValue.toFixed(1)}
                  <span style={{ fontSize: 14, marginLeft: 4, opacity: 0.7 }}>{strategy.targetUnit}</span>
                </div>
              </div>
            </div>
            {/* 收敛进度条 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>收敛进度</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: strategy.color, fontFamily: "'Share Tech Mono', monospace" }}>
                  {Math.max(0, convergencePercent)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,40,100,0.4)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${Math.max(0, convergencePercent)}%`,
                  background: `linear-gradient(90deg, ${strategy.color}80, ${strategy.color})`,
                  transition: 'width 0.3s ease',
                  boxShadow: `0 0 8px ${strategy.color}60`,
                }} />
              </div>
            </div>
          </div>

          {/* 优缺点 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(0,80,40,0.2)', border: '1px solid rgba(0,200,100,0.2)',
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#00FF9D', marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif" }}>✓ 优势</div>
              {strategy.pros.map((p, i) => (
                <div key={i} style={{ fontSize: 9.5, color: 'rgba(150,220,180,0.8)', lineHeight: 1.6, fontFamily: "'Noto Sans SC', sans-serif" }}>
                  · {p}
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(80,40,0,0.2)', border: '1px solid rgba(200,100,0,0.2)',
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#FFB347', marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif" }}>⚠ 局限</div>
              {strategy.cons.map((c, i) => (
                <div key={i} style={{ fontSize: 9.5, color: 'rgba(220,180,100,0.8)', lineHeight: 1.6, fontFamily: "'Noto Sans SC', sans-serif" }}>
                  · {c}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：收敛曲线 + 室温回升对比 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 收敛曲线图 */}
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(0,15,50,0.6)',
            border: `1px solid ${strategy.color}30`,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(148,210,255,0.8)', marginBottom: 10, fontFamily: "'Noto Sans SC', sans-serif" }}>
              实际值 vs 目标值 — 收敛曲线
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={convergenceData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="t" hide />
                <YAxis
                  domain={[
                    Math.min(strategy.initialActual, strategy.targetValue) - 2,
                    Math.max(strategy.initialActual, strategy.targetValue) + 2,
                  ]}
                  tick={{ fill: 'rgba(100,180,255,0.5)', fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,15,50,0.95)', border: `1px solid ${strategy.color}40`, borderRadius: 8, fontSize: 10 }}
                  labelStyle={{ color: 'rgba(100,180,255,0.6)' }}
                />
                <ReferenceLine y={strategy.targetValue} stroke={`${strategy.color}60`} strokeDasharray="4 3" />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke={`${strategy.color}60`}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name="目标值"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={strategy.color}
                  strokeWidth={2.5}
                  dot={false}
                  name="实际值"
                  strokeLinecap="round"
                />
                <Legend
                  wrapperStyle={{ fontSize: 9, color: 'rgba(148,210,255,0.7)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 室温回升曲线 */}
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(0,15,50,0.6)',
            border: '1px solid rgba(0,180,255,0.2)',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(148,210,255,0.8)', marginBottom: 10, fontFamily: "'Noto Sans SC', sans-serif" }}>
              6号楼室温回升预测（60分钟）
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={recoveryCurve} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="t" tick={{ fill: 'rgba(100,180,255,0.5)', fontSize: 9 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}min`} />
                <YAxis domain={[14, 23]} tick={{ fill: 'rgba(100,180,255,0.5)', fontSize: 9 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}°`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,15,50,0.95)', border: '1px solid rgba(0,180,255,0.3)', borderRadius: 8, fontSize: 10 }}
                />
                <ReferenceLine y={22} stroke="rgba(0,212,255,0.4)" strokeDasharray="4 3" label={{ value: '目标22°C', fill: 'rgba(0,212,255,0.6)', fontSize: 9, position: 'right' }} />
                <ReferenceLine y={18} stroke="rgba(255,100,100,0.3)" strokeDasharray="4 3" label={{ value: '下限18°C', fill: 'rgba(255,100,100,0.5)', fontSize: 9, position: 'right' }} />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke={strategy.color}
                  strokeWidth={2.5}
                  dot={false}
                  name="室温"
                />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>
                预计恢复时间：<span style={{ color: strategy.color, fontWeight: 700 }}>{strategy.tempRecoveryMin}分钟</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>
                节能效率：<span style={{ color: strategy.color, fontWeight: 700 }}>{strategy.efficiency}%</span>
              </div>
            </div>
          </div>

          {/* 三策略横向对比条 */}
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(0,15,50,0.5)',
            border: '1px solid rgba(0,180,255,0.15)',
          }}>
            <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', marginBottom: 8, fontFamily: "'Noto Sans SC', sans-serif" }}>
              三策略效率对比
            </div>
            {STRATEGIES.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 40, fontSize: 9.5, color: s.id === activeTab ? s.color : 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif", flexShrink: 0 }}>
                  {s.shortName}
                </div>
                <div style={{ flex: 1, height: 5, borderRadius: 2.5, background: 'rgba(0,40,100,0.4)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2.5,
                    width: `${s.efficiency}%`,
                    background: s.id === activeTab ? s.color : `${s.color}60`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ width: 32, fontSize: 9.5, fontWeight: 700, color: s.id === activeTab ? s.color : 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace", textAlign: 'right', flexShrink: 0 }}>
                  {s.efficiency}%
                </div>
                {s.recommended && (
                  <div style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: s.color, color: 'white', fontFamily: "'Noto Sans SC', sans-serif", flexShrink: 0 }}>
                    推荐
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StrategyComparison;
