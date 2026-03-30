/**
 * EnergyInlineBar.tsx
 * 左侧面板内嵌能耗数据行（节能% + 减碳kg/h）
 * 原右上角能耗看板数据整合至此，节省屏幕空间
 */
import { useEffect, useState } from 'react';
import { gsap } from 'gsap';

interface Props {
  demoPhase?: number;
  isExecuting?: boolean;
}

interface EnergyMetrics {
  savingPct: number;
  carbonReduction: number;
}

const PHASE_TARGETS: Record<number, EnergyMetrics> = {
  0: { savingPct: 12,  carbonReduction: 8.4  },
  1: { savingPct: 10,  carbonReduction: 7.8  },
  2: { savingPct: 8,   carbonReduction: 6.5  },
  3: { savingPct: 9,   carbonReduction: 7.2  },
  4: { savingPct: 14,  carbonReduction: 9.1  },
  5: { savingPct: 22,  carbonReduction: 14.2 },
  6: { savingPct: 28,  carbonReduction: 18.6 },
};

export default function EnergyInlineBar({ demoPhase = 0, isExecuting = false }: Props) {
  const [metrics, setMetrics] = useState<EnergyMetrics>({ savingPct: 12, carbonReduction: 8.4 });

  useEffect(() => {
    const target = PHASE_TARGETS[demoPhase] ?? PHASE_TARGETS[0];
    const obj = { ...metrics };
    gsap.to(obj, {
      savingPct: target.savingPct,
      carbonReduction: target.carbonReduction,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => setMetrics({ ...obj }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoPhase]);

  return (
    <div
      style={{
        padding: '5px 12px',
        borderBottom: '1px solid rgba(0,180,255,0.08)',
        background: 'rgba(0,8,30,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 8,
      }}
    >
      {/* 左侧标签 */}
      <span
        style={{
          fontSize: 9.5,
          color: 'rgba(100,160,220,0.6)',
          fontFamily: "'Noto Sans SC', sans-serif",
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        ⚡ AI能耗优化
      </span>

      {/* 右侧两个数据 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* 节能 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: 'rgba(100,160,220,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>节能</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Share Tech Mono', monospace",
              color: isExecuting ? '#34d399' : '#10b981',
              textShadow: isExecuting ? '0 0 8px rgba(52,211,153,0.6)' : 'none',
              transition: 'color 0.3s',
            }}
          >
            ↓ {metrics.savingPct.toFixed(0)}%
          </span>
        </div>

        {/* 分隔线 */}
        <div style={{ width: 1, height: 14, background: 'rgba(0,180,255,0.15)' }} />

        {/* 减碳 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: 'rgba(100,160,220,0.5)', fontFamily: "'Noto Sans SC', sans-serif" }}>减碳</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Share Tech Mono', monospace",
              color: '#06b6d4',
              textShadow: isExecuting ? '0 0 8px rgba(6,182,212,0.6)' : 'none',
              transition: 'color 0.3s',
            }}
          >
            {metrics.carbonReduction.toFixed(1)} <span style={{ fontSize: 9, fontWeight: 400 }}>kg/h</span>
          </span>
        </div>
      </div>
    </div>
  );
}
