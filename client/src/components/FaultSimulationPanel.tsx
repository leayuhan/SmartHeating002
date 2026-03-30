/**
 * FaultSimulationPanel.tsx
 * 右侧故障演练按钮面板
 * - 4种场景：极寒天气/管道爆裂/热源故障/阀门卡死
 * - 点击触发语音播报 + 系统应急响应
 */
import { useState } from 'react';

interface Scenario {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  voice: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'extreme-cold',
    name: '极寒天气',
    icon: '❄️',
    desc: '-20℃暴风雪，全网满负荷',
    color: '#3b82f6',
    voice: '极端寒冷天气预警！室外温度骤降至零下二十度，全网进入满负荷运行模式！',
  },
  {
    id: 'pipe-burst',
    name: '管道爆裂',
    icon: '💥',
    desc: '支路压力骤降，紧急隔离',
    color: '#ef4444',
    voice: '紧急警报！检测到管道爆裂，支路压力骤降，正在启动紧急隔离程序！',
  },
  {
    id: 'source-failure',
    name: '热源故障',
    icon: '⚠️',
    desc: '主热源停机，切换备用',
    color: '#f97316',
    voice: '警告！主热源发生故障，系统正在自动切换至备用热源，请运维人员立即检查！',
  },
  {
    id: 'valve-stuck',
    name: '阀门卡死',
    icon: '🔧',
    desc: '二网平衡阀失效，手动调节',
    color: '#eab308',
    voice: '提示：检测到二网平衡阀失效，请运维人员前往现场手动调节！',
  },
];

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 1.0;
  window.speechSynthesis.speak(utter);
};

interface FaultSimulationPanelProps {
  onTrigger?: (id: string) => void;
}

export const FaultSimulationPanel = ({ onTrigger }: FaultSimulationPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [triggered, setTriggered] = useState<string | null>(null);

  const handleTrigger = (scenario: Scenario) => {
    setTriggered(scenario.id);
    speak(scenario.voice);
    onTrigger?.(scenario.id);
    setIsOpen(false);
    // 3秒后重置
    setTimeout(() => setTriggered(null), 3000);
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg transition-all hover:scale-110"
        style={{
          background: triggered ? '#ef4444' : 'rgba(239,68,68,0.8)',
          border: '2px solid rgba(239,68,68,0.6)',
          boxShadow: triggered ? '0 0 20px rgba(239,68,68,0.8)' : '0 4px 15px rgba(0,0,0,0.4)',
          animation: triggered ? 'pulse 0.5s ease-in-out infinite' : 'none',
        }}
        title="故障演练模式"
      >
        {triggered ? '🚨' : '⚡'}
      </button>

      {/* 面板 */}
      {isOpen && (
        <div
          className="fixed right-20 top-1/2 -translate-y-1/2 z-40 bg-black/92 border border-red-500/30 rounded-2xl p-4 w-64 backdrop-blur-md"
          style={{ boxShadow: '0 0 30px rgba(239,68,68,0.15)' }}
        >
          <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm">
            <span>🚨</span> 故障演练模式
          </h3>

          <div className="space-y-2">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => handleTrigger(s)}
                className="w-full text-left p-3 rounded-xl border border-gray-700 transition-all hover:scale-102 group"
                style={{
                  background: 'rgba(17,24,39,0.8)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = s.color;
                  (e.currentTarget as HTMLElement).style.background = `${s.color}15`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#374151';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(17,24,39,0.8)';
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="text-white font-bold text-sm">{s.name}</div>
                    <div className="text-gray-400 text-xs">{s.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500 text-center">
            点击场景触发系统应急响应
          </div>
        </div>
      )}

      {/* 触发反馈提示 */}
      {triggered && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500 rounded-xl px-6 py-3 text-white text-sm font-bold backdrop-blur-sm"
          style={{ boxShadow: '0 0 30px rgba(239,68,68,0.5)' }}
        >
          🚨 {SCENARIOS.find(s => s.id === triggered)?.name} 已触发 — 系统应急响应中...
        </div>
      )}
    </>
  );
};

export default FaultSimulationPanel;
