/**
 * AIModelingVisualization.tsx
 * 阶段0：AI建模可视化 — 垂直列表布局，完整显示所有内容
 * - 顶部：楼栋扫描动画
 * - 中部：6个数据卡片依次飞入（垂直2列）
 * - 底部：预测结果
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface AIModelingVisualizationProps {
  isActive: boolean;
  onComplete?: () => void;
}

const DATA_CARDS = [
  { id: 'c1', label: '建筑基础数据', icon: '🏗️', value: '18层 · 5400㎡', color: '#06b6d4' },
  { id: 'c2', label: '热平衡模型', icon: '⚖️', value: 'Q=UA·ΔT', color: '#8b5cf6' },
  { id: 'c3', label: '历史数据', icon: '📊', value: '3年·26280h', color: '#10b981' },
  { id: 'c4', label: 'XGBoost模型', icon: '🤖', value: '准确率 94.2%', color: '#f59e0b' },
  { id: 'c5', label: 'LSTM神经网络', icon: '🧠', value: '12h预测窗口', color: '#ec4899' },
  { id: 'c6', label: '数据治理', icon: '🔒', value: '异常值过滤', color: '#3b82f6' },
];

export const AIModelingVisualization = ({ isActive, onComplete }: AIModelingVisualizationProps) => {
  const buildingRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const [buildingPhase, setBuildingPhase] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setVisibleCards([]);
      setBuildingPhase('idle');
      setShowResult(false);
      return;
    }

    const tl = gsap.timeline({ onComplete });

    // 楼栋放大
    tl.call(() => setBuildingPhase('scanning'), undefined, 0);
    if (buildingRef.current) {
      tl.fromTo(buildingRef.current,
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.0, ease: 'back.out(1.5)' },
        '<'
      );
    }

    // 扫描线动画
    if (scanRef.current) {
      tl.fromTo(scanRef.current,
        { top: '0%', opacity: 0.8 },
        { top: '100%', opacity: 0, duration: 1.5, ease: 'power1.inOut', repeat: 1 },
        0.3
      );
    }

    // 6张卡片依次飞入
    DATA_CARDS.forEach((_, i) => {
      tl.call(() => {
        setVisibleCards(prev => [...prev, i]);
      }, undefined, 1.2 + i * 0.4);
    });

    // 楼栋边框变色
    tl.call(() => setBuildingPhase('complete'), undefined, 4.5);

    // 显示结果
    tl.call(() => setShowResult(true), undefined, 5.2);

    return () => {
      tl.kill();
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 56,
        width: 340,
        zIndex: 20,
        background: 'rgba(2,11,26,0.97)',
        border: '1.5px solid rgba(6,182,212,0.5)',
        borderRadius: 12,
        boxShadow: '0 0 24px rgba(6,182,212,0.25)',
        padding: '10px 12px 12px',
        pointerEvents: 'none',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      {/* 标题 */}
      <div className="text-center mb-3">
        <div className="text-cyan-400 text-sm font-bold tracking-wider">🧠 A I特征学习建模</div>
        <div className="text-gray-400 text-[10px] mt-0.5">
          {buildingPhase === 'scanning' ? '正在扫描建筑热特征...' :
           buildingPhase === 'complete' ? '✓ 建模完成，热惰性参数已校准' : '初始化中...'}
        </div>
      </div>

      {/* 楼栋扫描动画（小型横向） */}
      <div className="flex justify-center mb-3">
        <div
          ref={buildingRef}
          className="relative rounded-lg overflow-hidden"
          style={{
            width: 80,
            height: 100,
            background: buildingPhase === 'complete'
              ? 'linear-gradient(to bottom, rgba(6,182,212,0.3), rgba(6,182,212,0.1))'
              : 'linear-gradient(to bottom, rgba(30,41,59,0.9), rgba(15,23,42,0.9))',
            border: buildingPhase === 'complete'
              ? '2px solid #06b6d4'
              : buildingPhase === 'scanning'
              ? '2px solid #f59e0b'
              : '2px solid #374151',
            boxShadow: buildingPhase === 'complete'
              ? '0 0 20px rgba(6,182,212,0.5)'
              : '0 0 6px rgba(0,0,0,0.5)',
          }}
        >
          {/* 楼层网格 */}
          <div className="absolute inset-1 grid grid-cols-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  height: 6,
                  background: buildingPhase === 'complete'
                    ? 'rgba(6,182,212,0.4)'
                    : 'rgba(100,116,139,0.3)',
                }}
              />
            ))}
          </div>
          {/* 扫描线 */}
          <div
            ref={scanRef}
            className="absolute left-0 right-0 h-0.5 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, transparent, #06b6d4, transparent)',
              boxShadow: '0 0 6px #06b6d4',
              top: 0,
            }}
          />
          {/* 楼号 */}
          <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-cyan-400 font-bold">
            11号楼
          </div>
        </div>
      </div>

      {/* 6张数据卡片 — 2列3行 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {DATA_CARDS.map((card, i) => {
          const isVisible = visibleCards.includes(i);
          return (
            <div
              key={card.id}
              className="rounded-lg p-2 transition-all duration-500"
              style={{
                background: 'rgba(15,23,42,0.9)',
                border: `1px solid ${card.color}60`,
                boxShadow: isVisible ? `0 0 10px ${card.color}30` : 'none',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.9)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base">{card.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-bold truncate" style={{ color: card.color }}>{card.label}</div>
                  <div className="text-[9px] text-gray-300 truncate">{card.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 预测结果 */}
      {showResult && (
        <div
          className="text-center py-1.5 rounded-lg text-xs font-bold text-black"
          style={{
            background: 'linear-gradient(to right, #10b981, #06b6d4)',
            boxShadow: '0 0 16px rgba(16,185,129,0.5)',
            animation: 'fadeIn 0.5s ease-out',
          }}
        >
          ✓ 室温预测完成：18℃
        </div>
      )}
    </div>
  );
};
export default AIModelingVisualization;
