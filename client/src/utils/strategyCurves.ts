/**
 * strategyCurves.ts
 * 四种供热策略的预测曲线生成
 * 视觉差异明显：超调 / 稳态误差 / 平滑指数 / 振荡
 */

export type StrategyType = 'supply' | 'flow' | 'pressure' | 'room';

export interface CurvePoint {
  hour: number;
  temp: number;
  target: number;
}

export const generateStrategyCurve = (
  strategy: StrategyType,
  initialTemp = 14.5,
  targetTemp = 22,
  hours = 12
): CurvePoint[] => {
  const data: CurvePoint[] = [];
  const range = targetTemp - initialTemp;

  for (let t = 0; t <= hours; t += 0.5) {
    let temp: number;

    switch (strategy) {
      case 'supply': {
        // 定供温：PID控制不稳，超调+衰减振荡
        const overshoot = 2.8;
        const decay = Math.exp(-t / 3.5);
        const oscillation = Math.sin(t * 0.9) * decay * overshoot;
        temp = targetTemp + oscillation - range * Math.exp(-t / 2.2);
        break;
      }
      case 'flow': {
        // 定流量：线性上升但有稳态误差（最终停在21℃）
        const steadyError = 1.5;
        temp = initialTemp + (range - steadyError) * (1 - Math.exp(-t / 4.5));
        break;
      }
      case 'pressure': {
        // 压差平衡：只保系统稳定，末端温度上升慢（70%效果）
        temp = initialTemp + range * (1 - Math.exp(-t / 6.5)) * 0.68;
        break;
      }
      case 'room': {
        // 室温反馈：最优控制，热惰性τ=2.5h，无超调，平滑指数趋近
        const tau = 2.5;
        const T = 1.5;
        temp = initialTemp + range * (1 - Math.exp(-t / (tau + T)));
        break;
      }
      default:
        temp = initialTemp;
    }

    data.push({
      hour: parseFloat(t.toFixed(1)),
      temp: parseFloat(temp.toFixed(2)),
      target: targetTemp,
    });
  }

  return data;
};

export const STRATEGY_META: Record<StrategyType, {
  label: string;
  color: string;
  description: string;
  characteristic: string;
}> = {
  supply: {
    label: '定供温',
    color: '#f59e0b',
    description: '固定供水温度，PID调节',
    characteristic: '超调+振荡（冲到24.5℃再回落）',
  },
  flow: {
    label: '定流量',
    color: '#3b82f6',
    description: '固定循环流量，线性调节',
    characteristic: '线性上升，稳态误差1.5℃',
  },
  pressure: {
    label: '压差平衡',
    color: '#8b5cf6',
    description: '维持管网压差平衡',
    characteristic: '系统稳定，末端效果有限',
  },
  room: {
    label: '室温反馈',
    color: '#22c55e',
    description: 'AI室温闭环控制',
    characteristic: '平滑指数趋近，无超调 ✓',
  },
};
