/**
 * FlippingHeatSource.tsx  v2.0
 * 热源卡片 — 点击展开/收起
 * 收起态：小卡片（120×140）显示负荷+状态
 * 展开态：大面板（420×500）显示完整48h预测+天气因素
 * 不再翻转，改为原地展开（scale+opacity动画）
 */
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface HeatSourceStatus {
  capacity: number;
  currentLoad: number;
  status: 'normal' | 'stressed' | 'emergency';
}

interface Props {
  status?: HeatSourceStatus;
  currentOutdoorTemp?: number;
  supplyTemp?: number;
  flow?: number;
  className?: string;
  style?: React.CSSProperties;
}

// 生成48小时负荷数据（天气驱动）
function generateLoadData(baseOutdoorTemp: number) {
  const arr = [];
  const baseLoad = 1080;
  const now = new Date();
  for (let i = 0; i <= 48; i++) {
    const h = (now.getHours() + i) % 24;
    const tempVariation = Math.sin((h - 14) * Math.PI / 12) * 3;
    const outdoorTemp = baseOutdoorTemp + tempVariation - (i > 24 ? (i - 24) * 0.15 : 0);
    const tempFactor = 1 + Math.max(0, (-5 - outdoorTemp) * 0.08);
    const dayNight = h > 6 && h < 22 ? 1 : 0.88;
    const windFactor = 1 + (i > 30 ? 0.06 : 0);
    const predicted = baseLoad * tempFactor * dayNight * windFactor;
    const actual = i <= 12 ? predicted * (0.96 + Math.sin(i * 1.7) * 0.04) : undefined;
    arr.push({
      hour: i,
      label: `${(now.getHours() + i) % 24}:00`,
      predicted: Math.round(predicted),
      actual: actual !== undefined ? Math.round(actual) : undefined,
      outdoorTemp: parseFloat(outdoorTemp.toFixed(1)),
      isHistory: i <= 12,
    });
  }
  return arr;
}

const FlippingHeatSource: React.FC<Props> = ({
  status = { capacity: 3000, currentLoad: 1240, status: 'normal' },
  currentOutdoorTemp = -3.5,
  supplyTemp = 46,
  flow = 108,
  className = '',
  style,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const data = useRef(generateLoadData(currentOutdoorTemp)).current;

  const loadPercent = Math.round((status.currentLoad / status.capacity) * 100);
  const isEmergency = status.status === 'emergency';
  const isStressed = status.status === 'stressed';
  const statusColor = isEmergency ? '#ef4444' : isStressed ? '#f59e0b' : '#22c55e';
  const statusLabel = isEmergency ? '满负荷' : isStressed ? '紧张' : '正常';

  const peakLoad = Math.max(...data.map(d => d.predicted));

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
  };

  // 展开/收起动画
  useEffect(() => {
    if (!panelRef.current) return;
    if (isExpanded) {
      gsap.fromTo(panelRef.current,
        { opacity: 0, scale: 0.85, y: -10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' }
      );
    }
  }, [isExpanded]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(0,15,50,0.97)', border: '1px solid rgba(0,180,255,0.3)',
        borderRadius: 8, padding: '6px 10px', fontSize: 9,
      }}>
        <div style={{ color: 'rgba(100,180,255,0.7)', marginBottom: 3, fontFamily: "'Share Tech Mono', monospace" }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.6 }}>
            {p.name}: <strong>{p.value}{p.name === '室外温度' ? '°C' : 'kW'}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      id="heat-source-icon"
      className={`absolute cursor-pointer select-none ${className}`}
      style={{
        width: isExpanded ? 440 : 120,
        height: isExpanded ? 'auto' : 140,
        transition: 'width 0.3s ease, height 0.3s ease',
        zIndex: isExpanded ? 40 : 25,
        ...style,
      }}
    >
      {/* ===== 收起态：小卡片 ===== */}
      {!isExpanded && (
        <div
          onClick={handleToggle}
          className="absolute inset-0 rounded-xl flex flex-col items-center justify-center"
          style={{
            background: isEmergency
              ? 'linear-gradient(135deg, rgba(127,29,29,0.9), rgba(185,28,28,0.7))'
              : 'linear-gradient(135deg, rgba(120,53,15,0.9), rgba(154,52,18,0.7))',
            border: `2px solid ${statusColor}80`,
            boxShadow: `0 0 ${isEmergency ? '40px' : '20px'} ${statusColor}50`,
          }}
        >
          <div className="text-4xl mb-1" style={{ filter: `drop-shadow(0 0 8px ${statusColor})` }}>🔥</div>
          <span className="text-white font-bold text-sm">热源</span>
          <span className="text-xs mt-0.5" style={{ color: '#fdba74' }}>
            {status.currentLoad.toLocaleString()} MW
          </span>
          <div className="w-full px-3 mt-2">
            <div className="flex justify-between text-[9px] mb-0.5" style={{ color: '#94a3b8' }}>
              <span>负荷</span>
              <span style={{ color: statusColor }}>{loadPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(30,41,59,0.8)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${loadPercent}%`,
                  background: `linear-gradient(to right, ${statusColor}80, ${statusColor})`,
                }}
              />
            </div>
          </div>
          <div className="mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}50` }}>
            {statusLabel}
          </div>
          <span className="text-[9px] mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
            点击查看预测
          </span>
        </div>
      )}

      {/* ===== 展开态：完整48h预测面板 ===== */}
      {isExpanded && (
        <div
          ref={panelRef}
          style={{
            background: 'rgba(2,11,26,0.97)',
            border: '2px solid rgba(251,146,60,0.5)',
            borderRadius: 16,
            boxShadow: '0 0 40px rgba(251,146,60,0.2), 0 8px 32px rgba(0,0,0,0.6)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* 标题栏 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fb923c', fontFamily: "'Noto Sans SC', sans-serif" }}>
                  热源48h负荷预测
                </div>
                <div style={{ fontSize: 9, color: 'rgba(100,180,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
                  HEAT SOURCE · 48H FORECAST
                </div>
              </div>
            </div>
            <button
              onClick={handleToggle}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(75,85,99,0.5)',
                color: '#9ca3af', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* 顶部：负荷指标 + 供温流量 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {/* 当前负荷 */}
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,15,50,0.7)',
              border: '1.5px solid rgba(251,146,60,0.4)',
              gridColumn: '1 / 2',
            }}>
              <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif", marginBottom: 2 }}>当前热源负荷</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fb923c', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
                {status.currentLoad.toLocaleString()}
                <span style={{ fontSize: 10, marginLeft: 3, opacity: 0.7 }}>MW</span>
              </div>
              <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: 'rgba(0,40,100,0.4)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2, width: `${loadPercent}%`,
                  background: loadPercent >= 90 ? 'linear-gradient(90deg,#FF4444,#FF8800)' : 'linear-gradient(90deg,#fb923c,#fcd34d)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 8, color: 'rgba(100,180,255,0.4)', marginTop: 2, fontFamily: "'Share Tech Mono', monospace" }}>
                {loadPercent}% · 峰值 {peakLoad.toLocaleString()}MW
              </div>
            </div>

            {/* 供水温度 */}
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,15,50,0.6)',
              border: '1px solid rgba(255,80,80,0.25)',
            }}>
              <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif", marginBottom: 2 }}>供水温度</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FF6060', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
                {supplyTemp}°C
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,80,80,0.4)', marginTop: 4 }}>供 回</div>
            </div>

            {/* 循环流量 */}
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,15,50,0.6)',
              border: '1px solid rgba(0,180,255,0.25)',
            }}>
              <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif", marginBottom: 2 }}>循环流量</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#00D4FF', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
                {flow}t/h
              </div>
              <div style={{ fontSize: 8, color: 'rgba(0,180,255,0.4)', marginTop: 4 }}>一次网</div>
            </div>
          </div>

          {/* 天气因素分析 */}
          <div>
            <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 1 }}>
              天气因素分析（影响热源负荷）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { icon: '🌡️', label: '室外温度', value: `${currentOutdoorTemp}°C`, impact: '每降1°C负荷+8%', color: '#60A5FA' },
                { icon: '💨', label: '风速', value: '3.2m/s', impact: '风冷效应+5%', color: '#A78BFA' },
                { icon: '☀️', label: '日照强度', value: '42W/m²', impact: '日照补热-3%', color: '#FCD34D' },
                { icon: '💧', label: '相对湿度', value: '68%', impact: '湿度影响+2%', color: '#34D399' },
              ].map(f => (
                <div key={f.label} style={{
                  padding: '6px 8px', borderRadius: 7,
                  background: 'rgba(0,15,50,0.6)',
                  border: `1px solid ${f.color}30`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 12 }}>{f.icon}</span>
                    <span style={{ fontSize: 8.5, color: 'rgba(148,210,255,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>{f.label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: f.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
                    {f.value}
                  </div>
                  <div style={{ fontSize: 7.5, color: 'rgba(100,180,255,0.5)', marginTop: 2, fontFamily: "'Noto Sans SC', sans-serif" }}>
                    {f.impact}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 48h负荷预测曲线 */}
          <div>
            <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', marginBottom: 6, fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 1 }}>
              40小时热源负荷预测（天气驱动）
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,180,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(100,180,255,0.5)', fontSize: 7 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(0,180,255,0.15)' }}
                  interval={7}
                />
                <YAxis
                  yAxisId="load"
                  orientation="left"
                  tick={{ fill: 'rgba(100,180,255,0.5)', fontSize: 7 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 100) * 100}`}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="temp"
                  orientation="right"
                  tick={{ fill: 'rgba(100,180,255,0.4)', fontSize: 7 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}°`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine yAxisId="load" x={data[12]?.label} stroke="rgba(0,212,255,0.3)" strokeDasharray="4 3"
                  label={{ value: '当前', fill: 'rgba(0,212,255,0.5)', fontSize: 7, position: 'top' }} />
                <Line yAxisId="load" type="monotone" dataKey="predicted"
                  stroke="rgba(249,115,22,0.7)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="预测负荷" />
                <Area yAxisId="load" type="monotone" dataKey="actual"
                  stroke="#00D4FF" strokeWidth={2} fill="rgba(0,212,255,0.06)" dot={false} name="实测负荷" connectNulls={false} />
                <Line yAxisId="temp" type="monotone" dataKey="outdoorTemp"
                  stroke="rgba(147,197,253,0.5)" strokeWidth={1} dot={false} name="室外温度" strokeDasharray="3 2" />
                <Legend wrapperStyle={{ fontSize: 8, color: 'rgba(148,210,255,0.7)', paddingTop: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 底部说明 */}
          <div style={{
            padding: '6px 10px', borderRadius: 7,
            background: 'rgba(0,15,50,0.5)',
            border: '1px solid rgba(0,180,255,0.12)',
            display: 'flex', gap: 12, flexWrap: 'wrap',
          }}>
            {[
              { label: '预测模型', value: 'LSTM+天气修正', color: '#00D4FF' },
              { label: '精度', value: 'MAE<2.3%', color: '#00FF9D' },
              { label: '更新', value: '每15分钟', color: '#A78BFA' },
              { label: '时域', value: '48小时', color: '#FCD34D' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}:</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: item.color, fontFamily: "'Share Tech Mono', monospace" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlippingHeatSource;
