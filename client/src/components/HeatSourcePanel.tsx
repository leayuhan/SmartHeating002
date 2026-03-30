/**
 * HeatSourcePanel.tsx  v2.0
 * 热源48小时负荷预测面板
 * - 热源SVG示意图（锅炉+烟囱+管道）
 * - 48h天气-负荷联动曲线（实线实测+虚线预测）
 * - 天气每降1°C → 负荷增加8%
 * - 当前负荷大数字 + 实时滚动动画
 * - 天气因素分析（气温/风速/日照/湿度）
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

interface HeatSourcePanelProps {
  currentOutdoorTemp?: number;
  isExecuting?: boolean;
  supplyTemp?: number;
  flow?: number;
}

// 生成48小时负荷数据（天气驱动）——单位 MW
function generateLoadData(baseOutdoorTemp: number) {
  const arr = [];
  const baseLoad = 1800;  // MW
  const now = new Date();
  for (let i = 0; i <= 48; i++) {
    const h = (now.getHours() + i) % 24;
    // 温度随时间变化（夜间更冷）
    const tempVariation = Math.sin((h - 14) * Math.PI / 12) * 3;
    const outdoorTemp = baseOutdoorTemp + tempVariation - (i > 24 ? (i - 24) * 0.15 : 0);
    // 负荷与温度负相关
    const tempFactor = 1 + Math.max(0, (-5 - outdoorTemp) * 0.08);
    // 日夜差异
    const dayNight = h > 6 && h < 22 ? 1 : 0.88;
    // 风速影响（模拟）
    const windFactor = 1 + (i > 30 ? 0.06 : 0);
    const predicted = baseLoad * tempFactor * dayNight * windFactor;
    // 前12小时有实测値
    const actual = i <= 12 ? predicted * (0.96 + Math.sin(i * 1.7) * 0.04) : undefined;
    arr.push({
      hour: i,
      label: `${String((now.getHours() + i) % 24).padStart(2, '0')}:00`,
      predicted: parseFloat(predicted.toFixed(1)),
      actual: actual !== undefined ? parseFloat(actual.toFixed(1)) : undefined,
      outdoorTemp: parseFloat(outdoorTemp.toFixed(1)),
      isHistory: i <= 12,
    });
  }
  return arr;
}

// 热源SVG示意图
function HeatSourceSVG({ loadPercent, isExecuting }: { loadPercent: number; isExecuting: boolean }) {
  const flameIntensity = 0.3 + loadPercent * 0.007;
  return (
    <svg viewBox="0 0 200 140" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="boiler-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,120,0,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#FF4400" />
          <stop offset="50%" stopColor="#FF8800" />
          <stop offset="100%" stopColor="#FFDD00" stopOpacity="0" />
        </linearGradient>
        <filter id="heat-blur">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* 地面 */}
      <line x1="10" y1="128" x2="190" y2="128" stroke="rgba(0,180,255,0.2)" strokeWidth="1" />

      {/* 主锅炉体 */}
      <rect x="60" y="50" width="80" height="75" rx="4"
        fill="rgba(0,15,50,0.9)" stroke="rgba(0,180,255,0.5)" strokeWidth="1.5" />
      {/* 锅炉顶盖 */}
      <ellipse cx="100" cy="50" rx="40" ry="6"
        fill="rgba(0,20,60,0.9)" stroke="rgba(0,180,255,0.5)" strokeWidth="1.5" />

      {/* 锅炉内火焰 */}
      <g opacity={flameIntensity}>
        <ellipse cx="100" cy="95" rx="20" ry="8" fill="url(#boiler-glow)" filter="url(#heat-blur)" />
        {[-8, 0, 8].map((dx, i) => (
          <path key={i}
            d={`M${100 + dx},100 Q${100 + dx - 5},${85 - i * 3} ${100 + dx},${75 - i * 2} Q${100 + dx + 5},${85 - i * 3} ${100 + dx},100`}
            fill="url(#flame-grad)" opacity={0.8}>
            <animate attributeName="d"
              values={`M${100 + dx},100 Q${100 + dx - 5},${85 - i * 3} ${100 + dx},${75 - i * 2} Q${100 + dx + 5},${85 - i * 3} ${100 + dx},100;M${100 + dx},100 Q${100 + dx + 5},${82 - i * 3} ${100 + dx},${72 - i * 2} Q${100 + dx - 5},${82 - i * 3} ${100 + dx},100;M${100 + dx},100 Q${100 + dx - 5},${85 - i * 3} ${100 + dx},${75 - i * 2} Q${100 + dx + 5},${85 - i * 3} ${100 + dx},100`}
              dur={`${0.8 + i * 0.2}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>

      {/* 锅炉观察窗 */}
      <circle cx="100" cy="85" r="14"
        fill="rgba(0,20,60,0.8)" stroke="rgba(0,180,255,0.4)" strokeWidth="1" />
      <circle cx="100" cy="85" r="10"
        fill={`rgba(255,${Math.round(80 + loadPercent * 0.8)},0,${0.2 + loadPercent * 0.005})`}
        stroke="rgba(255,120,0,0.4)" strokeWidth="0.8">
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>

      {/* 左烟囱 */}
      <rect x="70" y="10" width="14" height="42" rx="2"
        fill="rgba(0,10,40,0.9)" stroke="rgba(0,180,255,0.4)" strokeWidth="1" />
      {/* 右烟囱 */}
      <rect x="116" y="18" width="12" height="34" rx="2"
        fill="rgba(0,8,30,0.9)" stroke="rgba(0,180,255,0.35)" strokeWidth="1" />

      {/* 烟雾 */}
      {[{ cx: 77, cy: 6 }, { cx: 122, cy: 14 }].map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={5}
          fill="rgba(100,150,200,0.12)" stroke="rgba(0,180,255,0.15)" strokeWidth="0.6">
          <animate attributeName="r" values="3;7;3" dur={`${1.2 + i * 0.4}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur={`${1.2 + i * 0.4}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${p.cy};${p.cy - 8};${p.cy}`} dur={`${1.2 + i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* 供水管（右侧出口） */}
      <path d="M140 70 L165 70 L165 128" fill="none"
        stroke={isExecuting ? "rgba(255,80,80,0.8)" : "rgba(255,80,80,0.5)"} strokeWidth="3" strokeLinecap="round">
        {isExecuting && (
          <animate attributeName="stroke" values="rgba(255,80,80,0.5);rgba(255,80,80,1);rgba(255,80,80,0.5)" dur="1s" repeatCount="indefinite" />
        )}
      </path>
      {/* 回水管（左侧进口） */}
      <path d="M60 90 L35 90 L35 128" fill="none"
        stroke="rgba(0,100,255,0.5)" strokeWidth="3" strokeLinecap="round" />

      {/* 管道标签 */}
      <text x="172" y="100" fontSize="7" fill="rgba(255,100,100,0.7)" fontFamily="monospace">供</text>
      <text x="26" y="100" fontSize="7" fill="rgba(100,150,255,0.7)" fontFamily="monospace">回</text>

      {/* 负荷指示灯 */}
      <circle cx="155" cy="58" r="5"
        fill={loadPercent >= 90 ? '#FF4444' : loadPercent >= 70 ? '#FFB347' : '#00FF9D'}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <text x="155" y="50" textAnchor="middle" fontSize="7" fill="rgba(100,180,255,0.6)" fontFamily="monospace">
        {Math.round(loadPercent)}%
      </text>

      {/* 底座 */}
      <rect x="55" y="125" width="90" height="6" rx="2"
        fill="rgba(0,20,60,0.8)" stroke="rgba(0,180,255,0.3)" strokeWidth="0.8" />

      {/* 标签 */}
      <text x="100" y="138" textAnchor="middle" fontSize="8" fill="rgba(100,180,255,0.6)" fontFamily="'Noto Sans SC', sans-serif">
        热源中心
      </text>
    </svg>
  );
}

// 天气因素卡片
function WeatherFactorCard({ icon, label, value, impact, color }: {
  icon: string; label: string; value: string; impact: string; color: string;
}) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8,
      background: 'rgba(0,15,50,0.6)',
      border: `1px solid ${color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 9.5, color: 'rgba(148,210,255,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', marginTop: 3, fontFamily: "'Noto Sans SC', sans-serif" }}>
        {impact}
      </div>
    </div>
  );
}

export const HeatSourcePanel = ({
  currentOutdoorTemp = -3.5,
  isExecuting = false,
  supplyTemp = 46,
  flow = 108,
}: HeatSourcePanelProps) => {
  const [data] = useState(() => generateLoadData(currentOutdoorTemp));
  const [animatedLoad, setAnimatedLoad] = useState(1080);
  const loadRef = useRef<HTMLSpanElement>(null);

  const currentLoad = data[12]?.predicted ?? 1080;
  const peakLoad = Math.max(...data.map(d => d.predicted));
  const loadPercent = Math.round((currentLoad / peakLoad) * 100);

  // 执行阶段：负荷数字滚动
  useEffect(() => {
    if (isExecuting) {
      const obj = { val: currentLoad };
      gsap.to(obj, {
        val: currentLoad * 1.12,
        duration: 3,
        ease: 'power1.inOut',
        onUpdate() {
          setAnimatedLoad(Math.round(obj.val));
        },
      });
    } else {
      setAnimatedLoad(currentLoad);
    }
  }, [isExecuting, currentLoad]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(0,15,50,0.97)', border: '1px solid rgba(0,180,255,0.3)',
        borderRadius: 8, padding: '8px 12px', fontSize: 10,
      }}>
        <div style={{ color: 'rgba(100,180,255,0.7)', marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>
          {label}
        </div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.6 }}>
            {p.name}: <strong>{p.value} {p.name === '室外温度' ? '°C' : 'kW'}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* 顶部：热源SVG + 关键指标 */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
        {/* 热源SVG */}
        <div style={{
          height: 140,
          background: 'rgba(0,10,40,0.8)',
          borderRadius: 12,
          border: '1px solid rgba(0,180,255,0.2)',
          overflow: 'hidden',
          padding: 4,
        }}>
          <HeatSourceSVG loadPercent={loadPercent} isExecuting={isExecuting} />
        </div>

        {/* 关键指标 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 当前负荷大数字 */}
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(0,15,50,0.7)',
            border: `1.5px solid ${isExecuting ? 'rgba(255,120,0,0.5)' : 'rgba(0,180,255,0.3)'}`,
            boxShadow: isExecuting ? '0 0 20px rgba(255,120,0,0.2)' : 'none',
          }}>
            <div style={{ fontSize: 9.5, color: 'rgba(100,180,255,0.5)', marginBottom: 4, fontFamily: "'Noto Sans SC', sans-serif" }}>
              当前热源负荷
            </div>
            <div style={{
              fontSize: 32, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace",
              color: isExecuting ? '#FF8800' : '#00D4FF',
              textShadow: isExecuting ? '0 0 20px rgba(255,120,0,0.6)' : '0 0 20px rgba(0,212,255,0.4)',
              lineHeight: 1,
            }}>
              <span ref={loadRef}>{animatedLoad.toFixed(0)}</span>
              <span style={{ fontSize: 14, marginLeft: 4, opacity: 0.7 }}>MW</span>
            </div>
            {/* 负荷进度条 */}
            <div style={{ marginTop: 8, height: 5, borderRadius: 2.5, background: 'rgba(0,40,100,0.4)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2.5,
                width: `${loadPercent}%`,
                background: loadPercent >= 90 ? 'linear-gradient(90deg, #FF4444, #FF8800)'
                  : loadPercent >= 70 ? 'linear-gradient(90deg, #FF8800, #FFD700)'
                  : 'linear-gradient(90deg, #00A8FF, #00FF9D)',
                transition: 'width 0.5s ease',
                boxShadow: loadPercent >= 90 ? '0 0 8px rgba(255,60,60,0.7)' : '0 0 6px rgba(0,200,255,0.4)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>0</span>
              <span style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
                {loadPercent}% · 峰值 {peakLoad.toLocaleString()}kW
              </span>
            </div>
          </div>

          {/* 供温/流量 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,15,50,0.6)',
              border: '1px solid rgba(255,80,80,0.25)',
            }}>
              <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>供水温度</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FF6060', fontFamily: "'Share Tech Mono', monospace" }}>
                {supplyTemp}°C
              </div>
            </div>
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,15,50,0.6)',
              border: '1px solid rgba(0,180,255,0.25)',
            }}>
              <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>循环流量</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#00D4FF', fontFamily: "'Share Tech Mono', monospace" }}>
                {flow}t/h
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 天气因素分析 */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(100,180,255,0.5)', marginBottom: 8, fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 1 }}>
          天气因素分析（影响热源负荷）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <WeatherFactorCard
            icon="🌡️" label="室外温度"
            value={`${currentOutdoorTemp}°C`}
            impact={`每降1°C负荷+8%`}
            color="#60A5FA"
          />
          <WeatherFactorCard
            icon="💨" label="风速"
            value="3.2m/s"
            impact="风冷效应+5%"
            color="#A78BFA"
          />
          <WeatherFactorCard
            icon="☀️" label="日照强度"
            value="42W/m²"
            impact="日照补热-3%"
            color="#FCD34D"
          />
          <WeatherFactorCard
            icon="💧" label="相对湿度"
            value="68%"
            impact="湿度影响+2%"
            color="#34D399"
          />
        </div>
      </div>

      {/* 48h负荷预测曲线 */}
      <div style={{ flex: 1, minHeight: 220 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 1 }}>
            48小时热源负荷预测（天气驱动）
          </div>
          <div style={{ fontSize: 8.5, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>
            单位: kW（左轴）/ °C（右轴）
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 10, right: 50, bottom: 20, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,180,255,0.08)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(100,180,255,0.55)', fontSize: 8 }}
              tickLine={{ stroke: 'rgba(0,180,255,0.2)' }}
              axisLine={{ stroke: 'rgba(0,180,255,0.2)' }}
              interval={3}
              label={{ value: '时间轴（小时）', position: 'insideBottom', offset: -10, fill: 'rgba(100,180,255,0.4)', fontSize: 8 }}
            />
            <YAxis
              yAxisId="load"
              orientation="left"
              tick={{ fill: 'rgba(100,180,255,0.6)', fontSize: 8 }}
              tickLine={{ stroke: 'rgba(0,180,255,0.2)' }}
              axisLine={{ stroke: 'rgba(0,180,255,0.2)' }}
              tickFormatter={(v) => `${v}`}
              domain={[0, 3000]}
              ticks={[0, 500, 1000, 1500, 2000, 2500, 3000]}
              width={50}
              label={{ value: '负荷 (MW)', angle: -90, position: 'insideLeft', offset: -5, fill: 'rgba(249,115,22,0.6)', fontSize: 8 }}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: 'rgba(147,197,253,0.6)', fontSize: 8 }}
              tickLine={{ stroke: 'rgba(0,180,255,0.2)' }}
              axisLine={{ stroke: 'rgba(0,180,255,0.2)' }}
              tickFormatter={(v) => `${v}°C`}
              width={42}
              label={{ value: '温度 (°C)', angle: 90, position: 'insideRight', offset: 5, fill: 'rgba(147,197,253,0.5)', fontSize: 8 }}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* 当前时刻参考线（红色实线） */}
            <ReferenceLine yAxisId="load" x={data[12]?.label} stroke="#EF4444" strokeWidth={2}
              label={{ value: '当前', fill: '#EF4444', fontSize: 8.5, fontWeight: 700, position: 'top' }} />
            {/* 峰値参考线 */}
            <ReferenceLine yAxisId="load" y={peakLoad} stroke="rgba(255,100,100,0.6)" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `峰値 ${peakLoad}MW`, fill: 'rgba(255,100,100,0.85)', fontSize: 7.5, position: 'right' }} />
            {/* 预测负荷（虚线） */}
            <Line
              yAxisId="load"
              type="monotone"
              dataKey="predicted"
              stroke="rgba(249,115,22,0.8)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              name="预测负荷"
            />
            {/* 实测负荷（实线） */}
            <Area
              yAxisId="load"
              type="monotone"
              dataKey="actual"
              stroke="#00D4FF"
              strokeWidth={2.5}
              fill="rgba(0,212,255,0.08)"
              dot={false}
              name="实测负荷"
              connectNulls={false}
            />
            {/* 室外温度 */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="outdoorTemp"
              stroke="rgba(147,197,253,0.6)"
              strokeWidth={1.5}
              dot={false}
              name="室外温度"
              strokeDasharray="3 2"
            />
            <Legend
              wrapperStyle={{ fontSize: 9, color: 'rgba(148,210,255,0.7)', paddingTop: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* 关键负荷预测数值面板 */}
        {(() => {
          const allPredicted = data.map(d => d.predicted);
          const minLoad = Math.min(...allPredicted);
          const avgLoad = Math.round(allPredicted.reduce((a, b) => a + b, 0) / allPredicted.length);
          const peakIdx = allPredicted.indexOf(peakLoad);
          const minIdx = allPredicted.indexOf(minLoad);
          const peakTime = data[peakIdx]?.label ?? '--';
          const minTime = data[minIdx]?.label ?? '--';
          return (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8,
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,15,50,0.5)',
              border: '1px solid rgba(0,180,255,0.12)',
            }}>
              {[
                { label: '峰値负荷', value: `${peakLoad.toFixed(0)}MW`, sub: `@${peakTime}`, color: '#FF6060' },
                { label: '谷値负荷', value: `${minLoad.toFixed(0)}MW`, sub: `@${minTime}`, color: '#00FF9D' },
                { label: '平均负荷', value: `${avgLoad.toFixed(0)}MW`, sub: '全周期', color: '#FCD34D' },
                { label: '当前负荷', value: `${animatedLoad.toFixed(0)}MW`, sub: `${loadPercent}%负荷率`, color: '#00D4FF' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: 'rgba(100,180,255,0.5)', marginBottom: 2, fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.2 }}>{item.value}</div>
                  <div style={{ fontSize: 7.5, color: 'rgba(100,180,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>{item.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 底部：预测说明 */}
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(0,15,50,0.5)',
        border: '1px solid rgba(0,180,255,0.12)',
        display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        {[
          { label: '预测模型', value: 'LSTM + 天气修正', color: '#00D4FF' },
          { label: '预测精度', value: 'MAE < 2.3%', color: '#00FF9D' },
          { label: '更新频率', value: '每15分钟', color: '#A78BFA' },
          { label: '预测时域', value: '48小时', color: '#FCD34D' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'rgba(100,180,255,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>{item.label}:</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: item.color, fontFamily: "'Share Tech Mono', monospace" }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeatSourcePanel;
