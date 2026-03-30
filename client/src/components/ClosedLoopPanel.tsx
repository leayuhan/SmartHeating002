/**
 * ClosedLoopPanel.tsx
 * 完整闭环可视化：报警 → AI分析 → 命令下发 → 执行 → 反馈
 * - 5个节点横向连接，当前激活节点高亮
 * - 每个节点下方显示详细状态
 * - 连线上有流动粒子动画
 * - 右侧显示平均室温 before/after 对比
 */
import { useEffect, useState } from 'react';

interface ClosedLoopPanelProps {
  demoPhase: number;
  isDemoRunning: boolean;
  alertBuilding?: string;
  alertTemp?: number;
  currentTemp?: number;
  targetTemp?: number;
  avgTempBefore?: number;
  avgTempAfter?: number;
}

interface LoopNode {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  color: string;
  activePhase: number; // 从哪个阶段开始激活
}

const LOOP_NODES: LoopNode[] = [
  {
    id: 'alarm',
    icon: '⚠️',
    label: '低温告警',
    sublabel: '6号楼 14.5°C',
    color: '#EF4444',
    activePhase: 2,
  },
  {
    id: 'ai',
    icon: '🧠',
    label: 'AI分析',
    sublabel: '根因诊断',
    color: '#8B5CF6',
    activePhase: 3,
  },
  {
    id: 'decide',
    icon: '⚡',
    label: '策略决策',
    sublabel: '室温反馈方案',
    color: '#3B82F6',
    activePhase: 4,
  },
  {
    id: 'execute',
    icon: '⚙️',
    label: '指令执行',
    sublabel: '三级联动调控',
    color: '#F59E0B',
    activePhase: 5,
  },
  {
    id: 'feedback',
    icon: '✅',
    label: '温度反馈',
    sublabel: '21.8°C 恢复',
    color: '#10B981',
    activePhase: 6,
  },
];

export default function ClosedLoopPanel({
  demoPhase,
  isDemoRunning,
  alertBuilding = '6号楼',
  alertTemp = 14.5,
  currentTemp,
  targetTemp = 22,
  avgTempBefore = 18.2,
  avgTempAfter = 21.8,
}: ClosedLoopPanelProps) {
  const [particlePos, setParticlePos] = useState(0);

  // 粒子流动动画
  useEffect(() => {
    if (!isDemoRunning) return;
    const interval = setInterval(() => {
      setParticlePos(prev => (prev + 1.5) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, [isDemoRunning]);

  const activeNodeCount = LOOP_NODES.filter(n => n.activePhase <= demoPhase).length;
  const displayTemp = currentTemp ?? (demoPhase >= 6 ? avgTempAfter : alertTemp);

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
          闭环调控流程
        </div>
        <div style={{ fontSize: 9, color: 'rgba(100,180,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
          {activeNodeCount}/{LOOP_NODES.length} 步完成
        </div>
      </div>

      {/* 流程节点 */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
        {LOOP_NODES.map((node, idx) => {
          const isActive = node.activePhase <= demoPhase && isDemoRunning;
          const isCurrent = LOOP_NODES.findIndex(n => n.activePhase > demoPhase) === idx ||
            (idx === LOOP_NODES.length - 1 && demoPhase >= node.activePhase);
          const isDone = node.activePhase < demoPhase && isDemoRunning;

          return (
            <div key={node.id} style={{ display: 'flex', alignItems: 'center', flex: idx < LOOP_NODES.length - 1 ? undefined : undefined }}>
              {/* 节点 */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, width: 52, flexShrink: 0,
              }}>
                {/* 图标圆圈 */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: isActive ? `${node.color}20` : 'rgba(0,15,50,0.6)',
                  border: `2px solid ${isActive ? node.color : 'rgba(0,100,200,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                  boxShadow: isCurrent && isDemoRunning ? `0 0 12px ${node.color}60` : 'none',
                  animation: isCurrent && isDemoRunning ? 'node-pulse 1s ease-in-out infinite' : undefined,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}>
                  {isDone ? '✓' : node.icon}
                  {/* 完成勾 */}
                  {isDone && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: `${node.color}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: node.color,
                    }}>✓</div>
                  )}
                </div>
                {/* 标签 */}
                <div style={{
                  fontSize: 8.5, fontWeight: isActive ? 700 : 400,
                  color: isActive ? node.color : 'rgba(100,180,255,0.4)',
                  fontFamily: "'Noto Sans SC', sans-serif",
                  textAlign: 'center', lineHeight: 1.3,
                  transition: 'color 0.3s ease',
                }}>
                  {node.label}
                </div>
              </div>

              {/* 连接线（最后一个节点后不加） */}
              {idx < LOOP_NODES.length - 1 && (
                <div style={{
                  flex: 1, height: 2, position: 'relative', overflow: 'hidden',
                  background: 'rgba(0,100,200,0.15)',
                  minWidth: 12,
                }}>
                  {/* 激活的连线 */}
                  {LOOP_NODES[idx + 1].activePhase <= demoPhase && isDemoRunning && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(90deg, ${node.color}60, ${LOOP_NODES[idx + 1].color}60)`,
                    }} />
                  )}
                  {/* 流动粒子 */}
                  {isDemoRunning && LOOP_NODES[idx + 1].activePhase <= demoPhase + 1 && (
                    <div style={{
                      position: 'absolute',
                      left: `${(particlePos + idx * 25) % 100}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 5, height: 5, borderRadius: '50%',
                      background: node.color,
                      boxShadow: `0 0 6px ${node.color}`,
                    }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 当前状态文字 */}
      {isDemoRunning && (
        <div style={{
          padding: '6px 10px', borderRadius: 7,
          background: 'rgba(0,15,50,0.5)',
          border: '1px solid rgba(0,180,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: demoPhase >= 6 ? '#00FF9D' : demoPhase >= 2 ? '#EF4444' : '#00D4FF',
            animation: 'ai-blink 1s infinite',
            flexShrink: 0,
          }} />
          <div style={{ fontSize: 9.5, color: 'rgba(148,210,255,0.8)', fontFamily: "'Noto Sans SC', sans-serif', lineHeight: 1.5" }}>
            {demoPhase < 2 && '系统正常运行中，实时监测各楼栋室温'}
            {demoPhase === 2 && `⚠ ${alertBuilding}室温 ${alertTemp}°C，低于设定值 ${targetTemp}°C，触发低温预警`}
            {demoPhase === 3 && 'AI正在分析根因：远端水力失调，换热站B供热不足'}
            {demoPhase === 4 && 'AI推荐室温反馈方案：协调流量+供温，按需精准供热'}
            {demoPhase === 5 && `三级联动执行中：换热站B供温↑2°C，流量↑10%，室温恢复至 ${displayTemp?.toFixed(1)}°C`}
            {demoPhase === 6 && `✅ 调控完成！${alertBuilding}室温恢复至 ${avgTempAfter}°C，节能 18%`}
          </div>
        </div>
      )}

      {/* 室温前后对比（阶段5-6显示） */}
      {isDemoRunning && demoPhase >= 5 && (
        <div style={{
          marginTop: 8, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center',
        }}>
          <div style={{
            padding: '6px 8px', borderRadius: 7,
            background: 'rgba(60,0,0,0.4)', border: '1px solid rgba(255,60,60,0.3)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 8.5, color: 'rgba(255,100,100,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>调控前均温</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FF6060', fontFamily: "'Share Tech Mono', monospace" }}>
              {avgTempBefore}°C
            </div>
          </div>
          <div style={{ fontSize: 16, color: 'rgba(0,212,255,0.5)' }}>→</div>
          <div style={{
            padding: '6px 8px', borderRadius: 7,
            background: 'rgba(0,50,20,0.4)', border: '1px solid rgba(0,200,100,0.3)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 8.5, color: 'rgba(100,220,150,0.7)', fontFamily: "'Noto Sans SC', sans-serif" }}>调控后均温</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#00FF9D', fontFamily: "'Share Tech Mono', monospace" }}>
              {demoPhase === 6 ? avgTempAfter : (displayTemp?.toFixed(1) ?? avgTempBefore)}°C
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes node-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
