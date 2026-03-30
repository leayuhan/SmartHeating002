/**
 * DualModeTimeline.tsx
 * 底部双模式时间轴
 * 历史段：实线绿色 | 预测段：虚线橙色
 * 可拖拽游标，点击阶段标签跳转
 * 支持自定义 stages prop（12步演示模式）
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface TimelineStage {
  id: number;
  label: string;
  shortLabel: string;
  startSec: number;
  endSec: number;
  type: 'history' | 'prediction';
  color: string;
}

export const DEFAULT_STAGES: TimelineStage[] = [
  { id: 0, label: '算法训练', shortLabel: '训练', startSec: 0,  endSec: 7,  type: 'history',    color: '#6366f1' },
  { id: 1, label: '感知数据', shortLabel: '感知', startSec: 7,  endSec: 11, type: 'history',    color: '#06b6d4' },
  { id: 2, label: '低温预警', shortLabel: '预警', startSec: 11, endSec: 16, type: 'history',    color: '#ef4444' },
  { id: 3, label: 'AI诊断',   shortLabel: '诊断', startSec: 16, endSec: 21, type: 'history',    color: '#f59e0b' },
  { id: 4, label: '策略决策', shortLabel: '决策', startSec: 21, endSec: 28, type: 'prediction', color: '#8b5cf6' },
  { id: 5, label: '联动执行', shortLabel: '执行', startSec: 28, endSec: 41, type: 'prediction', color: '#10b981' },
  { id: 6, label: '调控完成', shortLabel: '完成', startSec: 41, endSec: 45, type: 'prediction', color: '#22c55e' },
];

// 12步演示阶段（每步约8秒：语音+4秒停顿）
export const DEMO_12_STAGES: TimelineStage[] = [
  { id: 0,  label: '外部输入',   shortLabel: '输入',   startSec: 0,   endSec: 8,   type: 'history',    color: '#6366f1' },
  { id: 1,  label: '室温辨识',   shortLabel: '辨识',   startSec: 8,   endSec: 16,  type: 'history',    color: '#06b6d4' },
  { id: 2,  label: 'A I参数识别', shortLabel: '参数',   startSec: 16,  endSec: 28,  type: 'history',    color: '#8b5cf6' },
  { id: 3,  label: '目标设定',   shortLabel: '目标',   startSec: 28,  endSec: 36,  type: 'history',    color: '#f59e0b' },
  { id: 4,  label: '热负荷预测', shortLabel: '预测',   startSec: 36,  endSec: 44,  type: 'history',    color: '#ef4444' },
  { id: 5,  label: '差値计算',   shortLabel: '差値',   startSec: 44,  endSec: 52,  type: 'history',    color: '#f97316' },
  { id: 6,  label: '系统决策',   shortLabel: '决策',   startSec: 52,  endSec: 64,  type: 'prediction', color: '#a855f7' },
  { id: 7,  label: '换热站调节', shortLabel: '换热站', startSec: 64,  endSec: 72,  type: 'prediction', color: '#10b981' },
  { id: 8,  label: '楼阀平衡',   shortLabel: '楼阀',   startSec: 72,  endSec: 80,  type: 'prediction', color: '#14b8a6' },
  { id: 9,  label: '户阀调节',   shortLabel: '户阀',   startSec: 80,  endSec: 88,  type: 'prediction', color: '#22c55e' },
  { id: 10, label: '室温变化',   shortLabel: '升温',   startSec: 88,  endSec: 96,  type: 'prediction', color: '#84cc16' },
  { id: 11, label: '达到目标',   shortLabel: '达标',   startSec: 96,  endSec: 104, type: 'prediction', color: '#00ff9d' },
  { id: 12, label: '诊断能力',   shortLabel: '诊断',   startSec: 104, endSec: 112, type: 'prediction', color: '#06b6d4' },
];

// 每个步骤的悬浮预览数据
export const DEMO_STEP_PREVIEWS: Record<number, { icon: string; keyData: string; desc: string }> = {
  0:  { icon: '🌡️', keyData: '天气: 雪天 − 8°C', desc: '接入天气预报、建筑物理参数、历史负荷数据' },
  1:  { icon: '🏠', keyData: '6号楼 16.0°C', desc: '全区18栋室温实时辨识，发现6号楼低温预警' },
  2:  { icon: '🧠', keyData: 'R²=0.94 | 热惰性模型', desc: 'A I识别建筑热惰性、管道热损、水力平衡参数' },
  3:  { icon: '🎯', keyData: '目标: 18°C | 实际: 16°C', desc: '设定室温调控目标，评估缺口热量' },
  4:  { icon: '📈', keyData: '预测热负荷 2840 kW', desc: '基于天气预报计算未来 12h 热负荷曲线' },
  5:  { icon: '∆', keyData: '缺口 ΔQ = 180 kW', desc: '计算当前供热量与目标的差値，确定调节幅度' },
  6:  { icon: '🤖', keyData: 'A I推荐: 室温调控', desc: 'A I对比三种控制策略，选择最优闭环方案' },
  7:  { icon: '🔧', keyData: '供水 53→ 55°C', desc: '换热站B三级联动：供水温度、循环流量、阀门开度' },
  8:  { icon: '⚖️', keyData: '楼间差异 < 0.5°C', desc: '水力平衡调节，消除远端楼栋供热不均' },
  9:  { icon: '🚰', keyData: '户阀开度 +15%', desc: '针对面积、层数、朝向精细调节户端阀门' },
  10: { icon: '🌡️', keyData: '16.0 → 17.5°C', desc: '室温开始回升，热惰性滞后约 40 分钟' },
  11: { icon: '✅', keyData: '18.0°C 达标', desc: '面积加权平均室温达到设定目标，节能 8.3%' },
  12: { icon: '🔍', keyData: '热损失 67 W/m²', desc: '识别管道热损、保温老化、阀门故障，生成检修工单' },
};

const TOTAL_SEC_DEFAULT = 45;

interface DualModeTimelineProps {
  currentPhase: number;
  currentTime?: number; // seconds
  isPlaying?: boolean;
  isPaused?: boolean;
  stages?: TimelineStage[];
  totalSec?: number;
  onPhaseClick?: (phase: number) => void;
  onSeek?: (time: number) => void;
  onPlayPause?: () => void;
  onPause?: () => void;
  onRestart?: () => void;
}

export default function DualModeTimeline({
  currentPhase,
  currentTime = 0,
  isPlaying = false,
  isPaused = false,
  stages,
  totalSec,
  onPhaseClick,
  onSeek,
  onPlayPause,
  onPause,
  onRestart,
}: DualModeTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredPhase, setHoveredPhase] = useState<number | null>(null);

  const activeStages = stages ?? DEFAULT_STAGES;
  const TOTAL_SEC = totalSec ?? TOTAL_SEC_DEFAULT;

  const progress = Math.min(1, currentTime / TOTAL_SEC);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * TOTAL_SEC;
    onSeek?.(time);
  }, [onSeek, TOTAL_SEC]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek?.(pct * TOTAL_SEC);
  }, [isDragging, onSeek, TOTAL_SEC]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const currentStage = activeStages.find(s => s.id === currentPhase) ?? activeStages[0];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 select-none"
      style={{
        zIndex: 500,
        background: 'rgba(2,11,26,0.96)',
        borderTop: '1px solid rgba(6,182,212,0.2)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        padding: '8px 16px 10px',
      }}
    >
      {/* 阶段标签行 */}
      <div className="flex items-center gap-1 mb-2" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        {activeStages.map(stage => (
          <button
            key={stage.id}
            className="flex-shrink-0 text-center py-0.5 rounded transition-all duration-200"
            style={{
              minWidth: activeStages.length > 7 ? 52 : undefined,
              flex: activeStages.length <= 7 ? '1' : undefined,
              color: currentPhase === stage.id ? stage.color : '#475569',
              background: currentPhase === stage.id ? `${stage.color}18` : 'transparent',
              border: currentPhase === stage.id ? `1px solid ${stage.color}50` : '1px solid transparent',
              fontSize: activeStages.length > 7 ? 9 : 10,
              fontFamily: 'monospace',
            }}
            onClick={() => onPhaseClick?.(stage.id)}
            onMouseEnter={() => setHoveredPhase(stage.id)}
            onMouseLeave={() => setHoveredPhase(null)}
          >
            {stage.shortLabel}
          </button>
        ))}
      </div>

      {/* 时间轴主轨道 */}
      <div className="flex items-center gap-3">
        {/* 播放/停止 */}
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            background: isPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            border: `1px solid ${isPlaying ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}`,
            color: isPlaying ? '#ef4444' : '#10b981',
          }}
          onClick={onPlayPause}
          title={isPlaying ? '停止' : '开始'}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        {/* 暂停/恢复（仅在播放中显示） */}
        {isPlaying && (
          <button
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: isPaused ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
              border: `1px solid ${isPaused ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)'}`,
              color: isPaused ? '#10b981' : '#f59e0b',
            }}
            onClick={onPause}
            title={isPaused ? '恢复' : '暂停'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
        )}

        {/* 轨道 */}
        <div
          ref={trackRef}
          className="flex-1 relative cursor-pointer"
          style={{ height: 20 }}
          onClick={handleTrackClick}
        >
          {/* 阶段色块 */}
          {activeStages.map(stage => {
            const left = (stage.startSec / TOTAL_SEC) * 100;
            const width = ((stage.endSec - stage.startSec) / TOTAL_SEC) * 100;
            const isHist = stage.type === 'history';
            const isCurrent = stage.id === currentPhase;
            return (
              <div
                key={stage.id}
                className="absolute top-1/2 -translate-y-1/2 rounded-sm transition-all duration-300"
                style={{
                  left: `${left}%`,
                  width: `${width - 0.3}%`,
                  height: isCurrent ? 10 : 6,
                  background: isCurrent ? stage.color : `${stage.color}40`,
                  borderTop: !isHist ? `2px dashed ${stage.color}80` : 'none',
                  opacity: stage.id < currentPhase ? 0.5 : 1,
                }}
              />
            );
          })}

          {/* 历史/预测分界线 */}
          {activeStages.some(s => s.type === 'prediction') && (() => {
            const firstPred = activeStages.find(s => s.type === 'prediction');
            if (!firstPred) return null;
            return (
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{
                  left: `${(firstPred.startSec / TOTAL_SEC) * 100}%`,
                  background: 'rgba(255,255,255,0.3)',
                }}
              >
                <span
                  className="absolute -top-4 -translate-x-1/2 text-xs"
                  style={{ color: '#64748b', fontSize: 9, whiteSpace: 'nowrap' }}
                >
                  历史 | 预测
                </span>
              </div>
            );
          })()}

          {/* 进度游标 */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{
              left: `${progress * 100}%`,
              x: '-50%',
              zIndex: 10,
            }}
            onMouseDown={() => setIsDragging(true)}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
              style={{
                background: currentStage?.color || '#06b6d4',
                boxShadow: `0 0 8px ${currentStage?.color || '#06b6d4'}`,
              }}
            />
          </motion.div>
        </div>

        {/* 时间显示 */}
        <span className="text-xs font-mono flex-shrink-0" style={{ color: '#475569', width: 40 }}>
          {Math.floor(currentTime)}s
        </span>

        {/* 重置 */}
        <button
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all"
          style={{
            background: 'rgba(100,116,139,0.15)',
            border: '1px solid rgba(100,116,139,0.3)',
            color: '#64748b',
          }}
          onClick={onRestart}
          title="重置"
        >
          ↺
        </button>
      </div>

      {/* 悬浮预览卡片 */}
      {hoveredPhase !== null && activeStages.find(s => s.id === hoveredPhase) && (() => {
        const stage = activeStages.find(s => s.id === hoveredPhase)!;
        const preview = DEMO_STEP_PREVIEWS[hoveredPhase];
        const leftPct = ((stage.startSec + stage.endSec) / 2 / TOTAL_SEC) * 100;
        return (
          <div
            className="absolute bottom-full mb-2 pointer-events-none"
            style={{
              left: `${Math.max(5, Math.min(85, leftPct))}%`,
              transform: 'translateX(-50%)',
              zIndex: 600,
            }}
          >
            <div
              style={{
                background: 'rgba(2,11,26,0.97)',
                border: `1px solid ${stage.color}60`,
                borderRadius: 8,
                padding: '10px 14px',
                minWidth: 200,
                boxShadow: `0 0 20px ${stage.color}30`,
              }}
            >
              {/* 标题行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {preview && <span style={{ fontSize: 16 }}>{preview.icon}</span>}
                <span style={{ color: stage.color, fontWeight: 700, fontSize: 12, fontFamily: "'Noto Sans SC', sans-serif" }}>
                  第{hoveredPhase}步 · {stage.label}
                </span>
                <span style={{ marginLeft: 'auto', color: 'rgba(100,160,220,0.4)', fontSize: 9, fontFamily: 'monospace' }}>
                  {stage.startSec}s–{stage.endSec}s
                </span>
              </div>
              {/* 关键数据 */}
              {preview && (
                <div style={{
                  background: `${stage.color}15`,
                  border: `1px solid ${stage.color}30`,
                  borderRadius: 4,
                  padding: '4px 8px',
                  marginBottom: 6,
                  color: stage.color,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}>
                  {preview.keyData}
                </div>
              )}
              {/* 描述 */}
              {preview && (
                <div style={{ color: 'rgba(148,163,184,0.85)', fontSize: 10, fontFamily: "'Noto Sans SC', sans-serif", lineHeight: 1.5 }}>
                  {preview.desc}
                </div>
              )}
              {/* 点击提示 */}
              <div style={{ marginTop: 6, color: 'rgba(100,160,220,0.4)', fontSize: 9, fontFamily: 'monospace', textAlign: 'right' }}>
                点击跳转到此步骤
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
