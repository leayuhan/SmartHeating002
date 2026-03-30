/**
 * buildingPhysics.ts
 * 楼栋物理温度模型 - 生成一梯两户12户温度数据
 * 考虑：顶户散热 / 底户冷桥 / 边户外墙 / 策略影响
 */

export interface UnitData {
  floor: number;
  side: 'left' | 'right';
  temp: number;
  targetTemp: number;
  valveOpen: number;
  isEdge: boolean;
  isTop: boolean;
  isBottom: boolean;
}

export const generateUnitTemperatures = (
  buildingId: string,
  baseTemp = 22,
  outdoorTemp = -8,
  strategy: 'none' | 'supply' | 'flow' | 'pressure' | 'room' = 'none'
): UnitData[] => {
  const floors = 6;
  const units: UnitData[] = [];

  // 物理偏差参数
  const TOP_FLOOR_PENALTY = -1.8;   // 顶户：屋顶散热
  const BOTTOM_FLOOR_PENALTY = -1.2; // 底户：地面冷桥
  const EDGE_PENALTY = -1.0;         // 边户：外墙散热（一梯两户全是边户）

  // 策略对偏差的修正系数
  const strategyCorrection: Record<string, number> = {
    none: 1.0,
    supply: 0.75,   // 定供温：整体提升但不能解决户间不平衡
    flow: 0.6,      // 定流量：中等修正
    pressure: 0.5,  // 压差平衡：只保系统稳定
    room: 0.25,     // 室温反馈：精准调节，偏差最小
  };

  const correction = strategyCorrection[strategy] ?? 1.0;

  for (let floor = floors; floor >= 1; floor--) {
    for (const side of ['left', 'right'] as const) {
      const isTop = floor === floors;
      const isBottom = floor === 1;
      const isEdge = true; // 一梯两户全是边户

      let deviation = EDGE_PENALTY;
      if (isTop) deviation += TOP_FLOOR_PENALTY;
      if (isBottom) deviation += BOTTOM_FLOOR_PENALTY;

      // 室外温度影响（热惰性τ=2.5h，简化为线性）
      const outdoorEffect = (outdoorTemp + 5) * 0.08;

      const currentTemp = baseTemp + deviation * correction + outdoorEffect + (Math.random() - 0.5) * 0.3;

      // 阀门开度：温度越低开度越大
      const valveOpen = Math.max(30, Math.min(95, 60 - deviation * correction * 12));

      units.push({
        floor,
        side,
        temp: parseFloat(currentTemp.toFixed(1)),
        targetTemp: baseTemp,
        valveOpen: Math.round(valveOpen),
        isEdge,
        isTop,
        isBottom,
      });
    }
  }

  return units;
};

/**
 * 获取温度对应的颜色
 */
export const getTempColor = (temp: number): { bg: string; border: string; text: string } => {
  if (temp < 18) return { bg: 'rgba(30,58,138,0.7)', border: '#3b82f6', text: '#93c5fd' };
  if (temp < 20) return { bg: 'rgba(20,83,45,0.5)', border: '#22c55e', text: '#86efac' };
  if (temp <= 22) return { bg: 'rgba(20,83,45,0.7)', border: '#4ade80', text: '#bbf7d0' };
  if (temp <= 24) return { bg: 'rgba(120,53,15,0.5)', border: '#f59e0b', text: '#fcd34d' };
  return { bg: 'rgba(127,29,29,0.7)', border: '#ef4444', text: '#fca5a5' };
};
