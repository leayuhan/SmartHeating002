/**
 * UnitTemperatureMap.tsx
 * 全楼户端温度分布热力图
 * 特性：
 * - 顶户/边户/底户物理偏差自动计算（真实供热特性）
 * - 预警时低温户脉冲闪烁
 * - 执行阶段逐户调节动画（GSAP delayedCall）
 * - 底部温度热力条（颜色梯度）
 * - 统计：最低温、户间温差、达标户数
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface RoomData {
  id: string;
  floor: number;
  unit: 'left' | 'right';
  temp: number;
  targetTemp: number;
  valveOpen: number;
  isEdge: boolean;
  isTop: boolean;
  isBottom: boolean;
  isAdjusting?: boolean;
}

// 生成带自然偏差的模拟数据（物理真实性）
const generateBuildingData = (baseTemp: number = 22, floors = 6): RoomData[] => {
  const data: RoomData[] = [];
  for (let floor = floors; floor >= 1; floor--) {
    (['left', 'right'] as const).forEach((side) => {
      let deviation = 0;
      // 顶户：屋顶散热 -1.2~-1.8℃
      if (floor === floors) deviation -= 1.2 + Math.random() * 0.6;
      // 底户：地面返潮 -0.8~-1.2℃
      if (floor === 1) deviation -= 0.8 + Math.random() * 0.4;
      // 边户：外墙散热 -0.7~-1.2℃
      deviation -= 0.7 + Math.random() * 0.5;
      // 中间楼层中间户：略高 +0.2~+0.5℃
      if (floor !== floors && floor !== 1) {
        deviation += 0.2 + Math.random() * 0.3;
      }
      // 随机波动 ±0.3℃
      deviation += (Math.random() - 0.5) * 0.6;

      const currentTemp = baseTemp + deviation;
      // 阀门开度：低温户开得大（体现失衡状态）
      const valveOpen = Math.max(30, Math.min(95,
        100 - (currentTemp - 18) * 8
      ));

      data.push({
        id: `${floor}-${side}`,
        floor,
        unit: side,
        temp: parseFloat(currentTemp.toFixed(1)),
        targetTemp: 22,
        valveOpen: Math.round(valveOpen),
        isEdge: true,
        isTop: floor === floors,
        isBottom: floor === 1,
        isAdjusting: false,
      });
    });
  }
  return data;
};

// 温度颜色映射
const getTempColor = (temp: number, target: number) => {
  const diff = temp - target;
  if (diff < -2)  return { bg: '#1e3a8a', text: '#60a5fa', label: '过冷', glow: '#3b82f6' };
  if (diff < -1)  return { bg: '#2563eb', text: '#bfdbfe', label: '偏冷', glow: '#60a5fa' };
  if (diff < -0.5) return { bg: '#d97706', text: '#fef3c7', label: '微凉', glow: '#fbbf24' };
  if (diff <= 0.5) return { bg: '#059669', text: '#d1fae5', label: '舒适', glow: '#34d399' };
  if (diff <= 1)  return { bg: '#ea580c', text: '#ffedd5', label: '偏热', glow: '#fb923c' };
  return { bg: '#dc2626', text: '#fee2e2', label: '过热', glow: '#f87171' };
};

// 单个房间单元格
const RoomCell = ({
  room,
  isAlert,
  onClick,
}: {
  room: RoomData;
  isAlert: boolean;
  onClick: () => void;
}) => {
  const color = getTempColor(room.temp, room.targetTemp);
  const isAbnormal = Math.abs(room.temp - room.targetTemp) > 1;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      animate={
        isAlert && isAbnormal
          ? { scale: [1, 1.05, 1], borderColor: [color.glow, '#ffffff', color.glow] }
          : {}
      }
      transition={{ repeat: isAlert && isAbnormal ? Infinity : 0, duration: 1.5 }}
      className="col-span-4 relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all"
      style={{
        backgroundColor: color.bg,
        borderColor: isAbnormal ? color.glow : 'transparent',
        boxShadow: isAbnormal ? `0 0 20px ${color.glow}40` : 'none',
      }}
    >
      <div className="p-3">
        {/* 标签行 */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex gap-1 flex-wrap">
            {room.isTop && (
              <span className="text-xs bg-purple-600 text-white px-1 rounded">顶</span>
            )}
            {room.isBottom && (
              <span className="text-xs bg-blue-600 text-white px-1 rounded">底</span>
            )}
            {room.isEdge && (
              <span className="text-xs bg-orange-600 text-white px-1 rounded">边</span>
            )}
          </div>
          <div className="text-xs" style={{ color: color.text }}>
            {color.label}
          </div>
        </div>

        {/* 温度大字 */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold" style={{ color: color.text }}>
            {room.temp}℃
          </div>
          <div className="text-xs mt-1" style={{ color: color.text, opacity: 0.8 }}>
            目标: {room.targetTemp}℃ | 偏差:{' '}
            {room.temp - room.targetTemp > 0 ? '+' : ''}
            {(room.temp - room.targetTemp).toFixed(1)}℃
          </div>
        </div>

        {/* 阀门小图标 */}
        <div
          className="mt-2 flex items-center justify-center gap-2 text-xs"
          style={{ color: color.text }}
        >
          <svg width="20" height="20" viewBox="0 0 40 40" className="inline-block">
            <circle cx="20" cy="20" r="15" fill="none" stroke={color.text} strokeWidth="2" />
            <line
              x1="20" y1="20" x2="20" y2="8"
              stroke={color.text}
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${-90 + room.valveOpen * 0.9} 20 20)`}
            />
          </svg>
          <span>阀: {room.valveOpen}%</span>
          {room.valveOpen > 80 && (
            <span className="text-yellow-300">(已开大)</span>
          )}
        </div>
      </div>

      {/* 调节中覆盖层 */}
      {room.isAdjusting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center"
        >
          <div className="bg-black/80 px-3 py-1 rounded text-yellow-400 text-sm font-bold animate-pulse">
            调节中...
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

interface UnitTemperatureMapProps {
  buildingId: string;
  isAlert?: boolean;
  isBalancing?: boolean;
  onRoomClick?: (room: RoomData) => void;
  onClose?: () => void;
}

export const UnitTemperatureMap = ({
  buildingId,
  isAlert = false,
  isBalancing = false,
  onRoomClick,
  onClose,
}: UnitTemperatureMapProps) => {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const balancingRef = useRef(false);

  // 初始化数据
  useEffect(() => {
    const baseTemp = isAlert ? 16 : 22;
    setRooms(generateBuildingData(baseTemp, 6));
  }, [isAlert, buildingId]);

  // 调节动画：逐户从顶楼到底楼
  useEffect(() => {
    if (isBalancing && rooms.length > 0 && !balancingRef.current) {
      balancingRef.current = true;
      const targetTemp = 22;
      const sortedRooms = [...rooms].sort((a, b) => b.floor - a.floor);

      sortedRooms.forEach((room, index) => {
        const delay = index * 0.8;

        gsap.delayedCall(delay, () => {
          setRooms(prev =>
            prev.map(r => r.id === room.id ? { ...r, isAdjusting: true } : r)
          );
        });

        gsap.delayedCall(delay + 0.3, () => {
          const obj = { temp: room.temp };
          gsap.to(obj, {
            temp: targetTemp + (Math.random() - 0.5) * 0.8,
            duration: 3,
            ease: 'power2.out',
            onUpdate() {
              const newTemp = parseFloat(obj.temp.toFixed(1));
              setRooms(prev =>
                prev.map(r =>
                  r.id === room.id
                    ? { ...r, temp: newTemp, valveOpen: Math.min(95, r.valveOpen + 2) }
                    : r
                )
              );
            },
            onComplete() {
              setRooms(prev =>
                prev.map(r => r.id === room.id ? { ...r, isAdjusting: false } : r)
              );
            },
          });
        });
      });
    }
  }, [isBalancing, rooms.length]);

  const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => b - a);
  const avgTemp = rooms.length
    ? rooms.reduce((a, b) => a + b.temp, 0) / rooms.length
    : 0;
  const minTemp = rooms.length ? Math.min(...rooms.map(r => r.temp)) : 0;
  const maxTemp = rooms.length ? Math.max(...rooms.map(r => r.temp)) : 0;
  const okCount = rooms.filter(r => Math.abs(r.temp - 22) <= 1).length;
  const topRooms = rooms.filter(r => r.isTop);
  const edgeRooms = rooms.filter(r => r.isEdge);
  const midRooms = rooms.filter(r => !r.isEdge && !r.isTop && !r.isBottom);

  return (
    <div className="bg-black/95 p-6 rounded-xl border-2 border-cyan-500/30 backdrop-blur-md w-full max-w-4xl relative">
      {/* 关闭按钮 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl z-10"
        >
          ✕
        </button>
      )}

      {/* 标题行 */}
      <div className="flex justify-between items-center mb-6 pr-8">
        <div>
          <h3 className="text-cyan-400 text-xl font-bold flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isAlert ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            {buildingId}栋 | 全户温度分布图
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            共{rooms.length}户 | 目标温度 22℃ | 当前平均{' '}
            <span className={avgTemp < 20 ? 'text-red-400' : 'text-green-400'}>
              {avgTemp.toFixed(1)}℃
            </span>
          </p>
        </div>

        {/* 统计数据 */}
        <div className="flex gap-4 text-xs">
          <div className="text-center">
            <div className="text-blue-400 font-bold text-lg">{minTemp.toFixed(1)}℃</div>
            <div className="text-gray-500">最低(顶/边户)</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-bold text-lg">
              {(maxTemp - minTemp).toFixed(1)}℃
            </div>
            <div className="text-gray-500">户间温差</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-bold text-lg">{okCount}</div>
            <div className="text-gray-500">达标户数</div>
          </div>
        </div>
      </div>

      {/* 热力图网格 */}
      <div className="space-y-2">
        {floors.map((floor, idx) => {
          const floorRooms = rooms.filter(r => r.floor === floor);
          const leftRoom = floorRooms.find(r => r.unit === 'left');
          const rightRoom = floorRooms.find(r => r.unit === 'right');

          return (
            <motion.div
              key={floor}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="grid grid-cols-12 gap-2 items-center"
            >
              {/* 楼层标识 */}
              <div className="col-span-1 text-center">
                <div
                  className={`text-lg font-bold ${
                    floor === Math.max(...floors)
                      ? 'text-purple-400'
                      : floor === 1
                      ? 'text-blue-400'
                      : 'text-gray-400'
                  }`}
                >
                  {floor}F
                </div>
                {floor === Math.max(...floors) && (
                  <span className="text-xs bg-purple-900 text-purple-200 px-1 rounded">顶</span>
                )}
                {floor === 1 && (
                  <span className="text-xs bg-blue-900 text-blue-200 px-1 rounded">底</span>
                )}
              </div>

              {/* 左户 */}
              {leftRoom && (
                <RoomCell
                  room={leftRoom}
                  isAlert={isAlert}
                  onClick={() => onRoomClick?.(leftRoom)}
                />
              )}

              {/* 电梯井 */}
              <div className="col-span-2 flex flex-col items-center justify-center h-20 bg-gray-900/50 rounded border border-gray-700">
                <span className="text-gray-500 text-xs">电梯</span>
              </div>

              {/* 右户 */}
              {rightRoom && (
                <RoomCell
                  room={rightRoom}
                  isAlert={isAlert}
                  onClick={() => onRoomClick?.(rightRoom)}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 底部温度热力条 */}
      <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>温度分布热力图（点击查看详情）</span>
          <span>蓝=冷 绿=舒适 红=热</span>
        </div>
        <div className="flex h-8 rounded-lg overflow-hidden">
          {[...rooms]
            .sort((a, b) => a.temp - b.temp)
            .map((room, idx) => {
              const color = getTempColor(room.temp, 22);
              return (
                <motion.div
                  key={room.id}
                  initial={{ width: 0 }}
                  animate={{ width: `${100 / rooms.length}%` }}
                  transition={{ delay: idx * 0.04 }}
                  className="h-full relative group cursor-pointer"
                  style={{ backgroundColor: color.bg }}
                  title={`${room.floor}F-${room.unit === 'left' ? '左' : '右'}: ${room.temp}℃`}
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black border border-gray-600 p-2 rounded text-xs whitespace-nowrap z-10">
                    {room.floor}F {room.isTop ? '顶户' : room.isBottom ? '底户' : '标准层'}{' '}
                    {room.isEdge ? '边户' : ''}: {room.temp}℃
                  </div>
                </motion.div>
              );
            })}
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-blue-400">{minTemp.toFixed(1)}℃</span>
          <span className="text-green-400">22℃(目标)</span>
          <span className="text-red-400">{maxTemp.toFixed(1)}℃</span>
        </div>
      </div>

      {/* 预警说明 */}
      <AnimatePresence>
        {isAlert && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-3 bg-red-950/30 border border-red-500/30 rounded text-sm text-red-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠</span>
              <span className="font-bold">
                检测到显著户间温差（{(maxTemp - minTemp).toFixed(1)}℃）
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-300">
              {topRooms.length > 0 && (
                <div>
                  • 顶户平均{(topRooms.reduce((a, b) => a + b.temp, 0) / topRooms.length).toFixed(1)}℃：屋顶散热损失+热压作用导致供热量不足
                </div>
              )}
              {edgeRooms.length > 0 && (
                <div>
                  • 边户平均{(edgeRooms.reduce((a, b) => a + b.temp, 0) / edgeRooms.length).toFixed(1)}℃：外墙围护结构散热面大，热负荷高
                </div>
              )}
              {midRooms.length > 0 && (
                <div>
                  • 中间户平均{(midRooms.reduce((a, b) => a + b.temp, 0) / midRooms.length).toFixed(1)}℃：被其他户型包围，热环境最佳
                </div>
              )}
              <div>• 建议：启用二网户端平衡调节，增大顶/边户阀门开度</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UnitTemperatureMap;
