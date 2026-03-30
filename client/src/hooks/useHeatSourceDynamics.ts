/**
 * useHeatSourceDynamics.ts
 * 热源动态负荷逻辑 hook
 * 三种状态：normal / stressed / emergency
 * emergency时：非重点楼栋变灰（grayscale filter）
 */
import { useState, useCallback } from 'react';

export type HeatSourceStatus = 'normal' | 'stressed' | 'emergency';

export interface HeatSourceState {
  capacity: number;        // 总容量 MW
  currentLoad: number;     // 当前负荷 MW
  supplyTemp: number;      // 供水温度 ℃
  returnTemp: number;      // 回水温度 ℃
  status: HeatSourceStatus;
  grayedBuildings: string[]; // emergency时变灰的楼栋ID
  priorityBuildings: string[]; // 优先保障楼栋
}

const INITIAL_STATE: HeatSourceState = {
  capacity: 3000,
  currentLoad: 1240,
  supplyTemp: 45,
  returnTemp: 35,
  status: 'normal',
  grayedBuildings: [],
  priorityBuildings: ['11', '12', '13'], // 重点保障楼栋
};

// 非重点楼栋（emergency时变灰）
const NON_PRIORITY_BUILDINGS = ['A4', 'A5', 'B4', 'B5', 'C4', 'C5'];

export const useHeatSourceDynamics = () => {
  const [state, setState] = useState<HeatSourceState>(INITIAL_STATE);

  const simulatePhase = useCallback((demoPhase: number) => {
    setState(prev => {
      switch (demoPhase) {
        case 0: // 算法训练
          return {
            ...prev,
            currentLoad: 1240,
            supplyTemp: 45,
            status: 'normal',
            grayedBuildings: [],
          };
        case 1: // 感知
          return {
            ...prev,
            currentLoad: 1380,
            supplyTemp: 46,
            status: 'normal',
            grayedBuildings: [],
          };
        case 2: // 预警（低温检测）
          return {
            ...prev,
            currentLoad: 1680,
            supplyTemp: 45,
            status: 'stressed',
            grayedBuildings: [],
          };
        case 3: // 诊断
          return {
            ...prev,
            currentLoad: 1820,
            supplyTemp: 44,
            status: 'stressed',
            grayedBuildings: [],
          };
        case 4: // 决策
          return {
            ...prev,
            currentLoad: 2100,
            supplyTemp: 43,
            status: 'emergency',
            grayedBuildings: NON_PRIORITY_BUILDINGS, // 非重点楼变灰
          };
        case 5: // 执行
          return {
            ...prev,
            currentLoad: 2450,
            supplyTemp: 47,
            returnTemp: 36,
            status: 'emergency',
            grayedBuildings: NON_PRIORITY_BUILDINGS,
          };
        case 6: // 完成
          return {
            ...prev,
            currentLoad: 1680,
            supplyTemp: 47,
            returnTemp: 37,
            status: 'normal',
            grayedBuildings: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const setEmergency = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'emergency',
      currentLoad: prev.capacity * 0.95,
      grayedBuildings: NON_PRIORITY_BUILDINGS,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const loadPercent = Math.round((state.currentLoad / state.capacity) * 100);

  return {
    heatSource: state,
    loadPercent,
    simulatePhase,
    setEmergency,
    reset,
  };
};
