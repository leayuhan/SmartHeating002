/**
 * useHeatSourceLogic.ts
 * 热源动态逻辑：热源充足→优化管网分配，热源不足→应急保障
 */
import { useState, useCallback } from 'react';

export interface HeatSourceState {
  capacity: number;      // 总装机容量 MW
  currentLoad: number;   // 当前负荷
  available: number;     // 余量
  isStressed: boolean;   // 是否满负荷/紧张
  mode: 'normal' | 'optimize_network' | 'emergency_boost';
  statusText: string;
}

export interface NetworkState {
  totalDemand: number;
  distributed: number;
  deficit: number;
}

export const useHeatSourceLogic = () => {
  const [heatSource, setHeatSource] = useState<HeatSourceState>({
    capacity: 3000,
    currentLoad: 1200,
    available: 1800,
    isStressed: false,
    mode: 'normal',
    statusText: '热源余量充足，系统正常运行',
  });

  const [network, setNetwork] = useState<NetworkState>({
    totalDemand: 1200,
    distributed: 1200,
    deficit: 0,
  });

  // 核心逻辑：热源不够→全网优化，热源够→局部分配
  const handleDemandChange = useCallback((newDemand: number) => {
    setNetwork(prev => ({
      ...prev,
      totalDemand: newDemand,
      deficit: Math.max(0, newDemand - 3000),
    }));

    if (newDemand <= 3000) {
      // 情况A：热源充足，优化管网分配（二网平衡）
      setHeatSource(prev => ({
        ...prev,
        currentLoad: newDemand,
        available: prev.capacity - newDemand,
        isStressed: false,
        mode: 'optimize_network',
        statusText: '热源余量充足，优化管网分配',
      }));
      return 'optimize_network';
    } else {
      // 情况B：热源不足，启动热源+管网双调
      setHeatSource(prev => ({
        ...prev,
        currentLoad: prev.capacity,
        available: 0,
        isStressed: true,
        mode: 'emergency_boost',
        statusText: '热源满负荷，启动应急保障',
      }));
      setNetwork(prev => ({
        ...prev,
        distributed: 3000,
        deficit: newDemand - 3000,
      }));
      return 'emergency_boost';
    }
  }, []);

  // 模拟演示阶段的热源变化
  const simulatePhase = useCallback((phase: number) => {
    switch (phase) {
      case 0: // 算法训练：正常状态
        handleDemandChange(1200);
        break;
      case 1: // 感知：开始检测到需求上升
        handleDemandChange(1400);
        break;
      case 2: // 预警：需求激增（9号楼低温，需要更多热量）
        handleDemandChange(1800);
        break;
      case 3: // 诊断：计算缺口
        handleDemandChange(2000);
        break;
      case 4: // 决策：策略选择
        handleDemandChange(2200);
        break;
      case 5: // 执行：热源响应
        handleDemandChange(2400);
        break;
      case 6: // 完成：恢复正常
        handleDemandChange(1600);
        break;
    }
  }, [handleDemandChange]);

  return { heatSource, network, handleDemandChange, simulatePhase };
};
