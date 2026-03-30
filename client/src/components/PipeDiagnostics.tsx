/**
 * PipeDiagnostics.tsx
 * 管道漏水检测 + 故障模拟
 * - 管道上闪烁红点（3个预设故障点）
 * - 点击红点：语音报警 + 弹窗诊断 + 换热站阀门联动关小
 * - 故障模拟：极寒/管道爆裂/热源故障/阀门卡死
 */
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

export interface FaultPoint {
  id: string;
  x: number;
  y: number;
  type: 'leak' | 'block' | 'pressure';
  severity: 'high' | 'medium' | 'low';
  description: string;
  detail: string;
}

interface PipeDiagnosticsProps {
  isActive: boolean;           // 是否激活（预警阶段才显示）
  onFaultTriggered?: (faultId: string) => void;
  containerWidth?: number;
  containerHeight?: number;
}

const DEFAULT_FAULTS: FaultPoint[] = [
  {
    id: 'f1',
    x: 0.38, y: 0.42,
    type: 'pressure',
    severity: 'high',
    description: '管道压差异常',
    detail: '检测到B区主干管压差骤升至38kPa（正常≤30kPa），疑似局部堵塞或阀门故障',
  },
  {
    id: 'f2',
    x: 0.62, y: 0.28,
    type: 'leak',
    severity: 'medium',
    description: '疑似漏水点',
    detail: '11号楼支路流量损失约8%，压力持续下降，建议派人现场检查',
  },
  {
    id: 'f3',
    x: 0.55, y: 0.65,
    type: 'block',
    severity: 'low',
    description: '流量偏低',
    detail: 'C区末端楼栋流量仅达设计值72%，可能存在管道结垢或阀门未全开',
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
};

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 1.1;
  window.speechSynthesis.speak(utter);
};

export const PipeDiagnostics = ({
  isActive,
  onFaultTriggered,
  containerWidth = 800,
  containerHeight = 600,
}: PipeDiagnosticsProps) => {
  const [activeFault, setActiveFault] = useState<FaultPoint | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  // 红点脉冲动画
  useEffect(() => {
    if (!isActive) return;
    DEFAULT_FAULTS.forEach(fault => {
      const el = dotRefs.current[fault.id];
      if (!el || dismissed.has(fault.id)) return;
      const dur = fault.severity === 'high' ? 0.4 : fault.severity === 'medium' ? 0.7 : 1.2;
      gsap.to(el, {
        scale: 1.6,
        opacity: 0.4,
        duration: dur,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    });
    return () => {
      DEFAULT_FAULTS.forEach(fault => {
        const el = dotRefs.current[fault.id];
        if (el) gsap.killTweensOf(el);
      });
    };
  }, [isActive, dismissed]);

  // 弹窗入场动画
  useEffect(() => {
    if (activeFault && modalRef.current) {
      gsap.fromTo(modalRef.current,
        { scale: 0.8, opacity: 0, y: 10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' }
      );
    }
  }, [activeFault]);

  const handleFaultClick = (fault: FaultPoint) => {
    setActiveFault(fault);
    onFaultTriggered?.(fault.id);

    // 语音报警
    const voiceMap: Record<string, string> = {
      pressure: '警告！检测到管网压力异常，请立即检查！',
      leak: '警告！检测到管道疑似漏水，建议派人现场排查！',
      block: '提示：检测到管道流量偏低，可能存在堵塞！',
    };
    speak(voiceMap[fault.type] || '检测到管网异常！');
  };

  const handleDismiss = () => {
    if (activeFault) {
      setDismissed(prev => { const next = new Set(Array.from(prev)); next.add(activeFault.id); return next; });
    }
    setActiveFault(null);
  };

  if (!isActive) return null;

  return (
    <>
      {/* 故障红点（叠加在管网SVG上方） */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {DEFAULT_FAULTS.filter(f => !dismissed.has(f.id)).map(fault => (
          <div
            key={fault.id}
            ref={el => { dotRefs.current[fault.id] = el; }}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left: `${fault.x * 100}%`,
              top: `${fault.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={() => handleFaultClick(fault)}
          >
            {/* 外圈光晕 */}
            <div
              className="absolute rounded-full"
              style={{
                width: 28,
                height: 28,
                top: -6,
                left: -6,
                background: `radial-gradient(circle, ${SEVERITY_COLOR[fault.severity]}40, transparent)`,
              }}
            />
            {/* 核心红点 */}
            <div
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{
                background: SEVERITY_COLOR[fault.severity],
                borderColor: SEVERITY_COLOR[fault.severity],
                boxShadow: `0 0 12px ${SEVERITY_COLOR[fault.severity]}`,
              }}
            >
              <span className="text-white text-[8px] font-bold">!</span>
            </div>
            {/* 悬浮标签 */}
            <div
              className="absolute left-5 top-0 bg-black/90 border rounded px-2 py-1 text-[10px] whitespace-nowrap pointer-events-none opacity-0 hover:opacity-100 transition-opacity"
              style={{ borderColor: SEVERITY_COLOR[fault.severity], color: SEVERITY_COLOR[fault.severity] }}
            >
              {fault.description}
            </div>
          </div>
        ))}
      </div>

      {/* 诊断弹窗 */}
      {activeFault && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <div
            ref={modalRef}
            className="bg-gray-950 rounded-2xl border p-6 max-w-md w-full mx-4"
            style={{
              borderColor: SEVERITY_COLOR[activeFault.severity],
              boxShadow: `0 0 40px ${SEVERITY_COLOR[activeFault.severity]}40`,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ background: `${SEVERITY_COLOR[activeFault.severity]}20`, border: `2px solid ${SEVERITY_COLOR[activeFault.severity]}` }}
              >
                {activeFault.type === 'pressure' ? '⚡' : activeFault.type === 'leak' ? '💧' : '🔧'}
              </div>
              <div>
                <div className="font-bold text-white">{activeFault.description}</div>
                <div
                  className="text-xs font-bold uppercase"
                  style={{ color: SEVERITY_COLOR[activeFault.severity] }}
                >
                  {activeFault.severity === 'high' ? '高危' : activeFault.severity === 'medium' ? '中危' : '低危'} 告警
                </div>
              </div>
            </div>

            {/* 详情 */}
            <div className="bg-gray-900/60 rounded-xl p-4 mb-4 text-sm text-gray-300 leading-relaxed">
              {activeFault.detail}
            </div>

            {/* 系统响应 */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3 mb-4 text-xs">
              <div className="text-blue-400 font-bold mb-2">🤖 AI系统响应</div>
              <div className="space-y-1 text-gray-300">
                <div>✓ 已触发语音报警</div>
                <div>✓ 换热站阀门自动关小至60%（保护模式）</div>
                <div>✓ 已通知运维人员</div>
                {activeFault.severity === 'high' && (
                  <div className="text-yellow-400">⚠ 建议立即现场检查</div>
                )}
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition-all"
              >
                知道了
              </button>
              <button
                onClick={() => {
                  speak('已确认故障，正在派遣维修人员');
                  handleDismiss();
                }}
                className="flex-1 py-2 rounded-xl text-white text-sm font-bold transition-all"
                style={{ background: SEVERITY_COLOR[activeFault.severity] }}
              >
                派单处理
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PipeDiagnostics;
