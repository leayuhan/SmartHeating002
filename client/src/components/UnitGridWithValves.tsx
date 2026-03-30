/**
 * UnitGridWithValves.tsx
 * 户端网格（一梯两户5层）+ 智能阀门SVG
 * 特性：
 * - 阀门手柄旋转：0%=-90°，100%=0°（GSAP控制）
 * - 开度环：SVG strokeDasharray环形进度条
 * - 调节时：黄色高亮+脉冲放大（scale 1.2）+"调节中..."
 * - 调节完成：绿色+扩散圆环动画
 * - 阶段5执行：从5楼到1楼依次调节（每层间隔1.5秒）
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export interface UnitValveData {
  floor: number;
  left: {
    temp: number;
    valveOpen: number;
    isAdjusting: boolean;
    targetOpen: number;
  };
  right: {
    temp: number;
    valveOpen: number;
    isAdjusting: boolean;
    targetOpen: number;
  };
  isEdge: boolean;
  isTop: boolean;
}

// 默认模拟数据
export const mockValveData: UnitValveData[] = [
  {
    floor: 5,
    left:  { temp: 17.5, valveOpen: 30, isAdjusting: false, targetOpen: 85 },
    right: { temp: 18.2, valveOpen: 35, isAdjusting: false, targetOpen: 80 },
    isTop: true, isEdge: true,
  },
  {
    floor: 4,
    left:  { temp: 19.8, valveOpen: 60, isAdjusting: false, targetOpen: 75 },
    right: { temp: 20.5, valveOpen: 65, isAdjusting: false, targetOpen: 70 },
    isTop: false, isEdge: true,
  },
  {
    floor: 3,
    left:  { temp: 21.2, valveOpen: 70, isAdjusting: false, targetOpen: 70 },
    right: { temp: 21.5, valveOpen: 75, isAdjusting: false, targetOpen: 70 },
    isTop: false, isEdge: false,
  },
  {
    floor: 2,
    left:  { temp: 20.8, valveOpen: 68, isAdjusting: false, targetOpen: 72 },
    right: { temp: 21.0, valveOpen: 70, isAdjusting: false, targetOpen: 72 },
    isTop: false, isEdge: false,
  },
  {
    floor: 1,
    left:  { temp: 19.5, valveOpen: 45, isAdjusting: false, targetOpen: 85 },
    right: { temp: 20.2, valveOpen: 50, isAdjusting: false, targetOpen: 80 },
    isTop: false, isEdge: true,
  },
];

// 单个阀门SVG组件
const SmartValve = ({
  openDegree,
  isAdjusting,
  isTarget,
  valveId,
}: {
  openDegree: number;
  isAdjusting: boolean;
  isTarget: boolean;
  valveId: string;
}) => {
  const handleRef = useRef<SVGLineElement>(null);

  // GSAP控制手柄旋转
  useEffect(() => {
    if (handleRef.current) {
      const rotation = -90 + openDegree * 0.9; // 0%=-90°, 100%=0°
      gsap.to(handleRef.current, {
        rotation,
        transformOrigin: '20px 20px',
        duration: isAdjusting ? 0.5 : 1,
        ease: isAdjusting ? 'power1.inOut' : 'elastic.out(1, 0.5)',
      });
    }
  }, [openDegree, isAdjusting]);

  const strokeColor = isAdjusting
    ? '#ffb800'
    : openDegree > 80
    ? '#00ff9d'
    : '#ff0040';

  // 环形进度：周长 = 2π×18 ≈ 113
  const circumference = 113;
  const dashArray = `${(openDegree / 100) * circumference} ${circumference}`;

  return (
    <motion.div
      id={valveId}
      className="relative flex flex-col items-center"
      animate={
        isAdjusting
          ? { scale: isTarget ? [1, 1.3, 1.2] : [1, 1.1, 1.05] }
          : { scale: 1 }
      }
      transition={{ repeat: isAdjusting ? Infinity : 0, duration: 0.8 }}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 40 40"
        className={`drop-shadow-lg ${isAdjusting ? 'animate-pulse' : ''}`}
      >
        {/* 阀体 */}
        <circle
          cx="20" cy="20" r="16"
          fill="#1a1a2e"
          stroke={strokeColor}
          strokeWidth="3"
        />

        {/* 开度环（环形进度条） */}
        <circle
          cx="20" cy="20" r="18"
          fill="none"
          stroke="url(#valveGrad)"
          strokeWidth="2"
          strokeDasharray={dashArray}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          opacity="0.85"
        />

        {/* 手柄（GSAP旋转） */}
        <line
          ref={handleRef}
          x1="20" y1="20" x2="20" y2="8"
          stroke={isAdjusting ? '#ffb800' : '#ffffff'}
          strokeWidth="4"
          strokeLinecap="round"
        />

        <defs>
          <linearGradient id="valveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff0040" />
            <stop offset="50%" stopColor="#ffb800" />
            <stop offset="100%" stopColor="#00ff9d" />
          </linearGradient>
        </defs>
      </svg>

      {/* 开度文字 */}
      <div
        className={`mt-1 text-xs font-mono font-bold ${
          isAdjusting
            ? 'text-yellow-400 animate-pulse'
            : openDegree > 80
            ? 'text-green-400'
            : 'text-red-400'
        }`}
      >
        {isAdjusting ? '调节中' : `${openDegree.toFixed(0)}%`}
      </div>

      {/* 调节完成扩散圆环 */}
      <AnimatePresence>
        {!isAdjusting && openDegree > 88 && (
          <motion.div
            key="done-ring"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{}}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 border-2 border-green-400 rounded-full pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface UnitGridWithValvesProps {
  buildingId: string;
  data?: UnitValveData[];
  adjustingFloor?: number | null;
  isBalancing?: boolean;
  onClose?: () => void;
}

export const UnitGridWithValves = ({
  buildingId,
  data: externalData,
  adjustingFloor,
  isBalancing = false,
  onClose,
}: UnitGridWithValvesProps) => {
  const [data, setData] = useState<UnitValveData[]>(externalData ?? mockValveData);
  const balancingStarted = useRef(false);

  // 同步外部数据
  useEffect(() => {
    if (externalData) setData(externalData);
  }, [externalData]);

  // 执行阶段：从顶楼到底楼依次调节（每层1.5秒）
  useEffect(() => {
    if (!isBalancing || balancingStarted.current) return;
    balancingStarted.current = true;

    const floors = [...data].sort((a, b) => b.floor - a.floor);
    floors.forEach((unit, index) => {
      const delay = index * 1.5;

      // 开始调节
      gsap.delayedCall(delay, () => {
        setData(prev =>
          prev.map(u =>
            u.floor === unit.floor
              ? {
                  ...u,
                  left:  { ...u.left,  isAdjusting: true },
                  right: { ...u.right, isAdjusting: true },
                }
              : u
          )
        );
      });

      // 阀门开度动画
      gsap.delayedCall(delay + 0.3, () => {
        const leftObj  = { val: unit.left.valveOpen };
        const rightObj = { val: unit.right.valveOpen };

        gsap.to(leftObj, {
          val: unit.left.targetOpen,
          duration: 2,
          ease: 'power1.inOut',
          onUpdate() {
            setData(prev =>
              prev.map(u =>
                u.floor === unit.floor
                  ? { ...u, left: { ...u.left, valveOpen: parseFloat(leftObj.val.toFixed(0)) } }
                  : u
              )
            );
          },
          onComplete() {
            setData(prev =>
              prev.map(u =>
                u.floor === unit.floor
                  ? { ...u, left: { ...u.left, isAdjusting: false } }
                  : u
              )
            );
          },
        });

        gsap.to(rightObj, {
          val: unit.right.targetOpen,
          duration: 2,
          ease: 'power1.inOut',
          onUpdate() {
            setData(prev =>
              prev.map(u =>
                u.floor === unit.floor
                  ? { ...u, right: { ...u.right, valveOpen: parseFloat(rightObj.val.toFixed(0)) } }
                  : u
              )
            );
          },
          onComplete() {
            setData(prev =>
              prev.map(u =>
                u.floor === unit.floor
                  ? { ...u, right: { ...u.right, isAdjusting: false } }
                  : u
              )
            );
          },
        });
      });

      // 温度回升
      gsap.delayedCall(delay + 1.5, () => {
        const leftTemp  = { temp: unit.left.temp };
        const rightTemp = { temp: unit.right.temp };
        const targetTemp = 22 + (Math.random() - 0.5) * 0.6;

        gsap.to(leftTemp, {
          temp: targetTemp,
          duration: 3,
          ease: 'power2.out',
          onUpdate() {
            setData(prev =>
              prev.map(u =>
                u.floor === unit.floor
                  ? { ...u, left: { ...u.left, temp: parseFloat(leftTemp.temp.toFixed(1)) } }
                  : u
              )
            );
          },
        });

        gsap.to(rightTemp, {
          temp: targetTemp + (Math.random() - 0.5) * 0.4,
          duration: 3,
          ease: 'power2.out',
          onUpdate() {
            setData(prev =>
              prev.map(u =>
                u.floor === unit.floor
                  ? { ...u, right: { ...u.right, temp: parseFloat(rightTemp.temp.toFixed(1)) } }
                  : u
              )
            );
          },
        });
      });
    });
  }, [isBalancing]);

  const avgTemp =
    data.reduce((a, b) => a + b.left.temp + b.right.temp, 0) / (data.length * 2);
  const avgValve =
    data.reduce((a, b) => a + b.left.valveOpen + b.right.valveOpen, 0) / (data.length * 2);

  return (
    <div className="bg-black/95 p-6 rounded-xl border-2 border-cyan-500/30 backdrop-blur-md max-w-2xl mx-auto relative">
      {/* 关闭按钮 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl z-10"
        >
          ✕
        </button>
      )}

      {/* 标题 */}
      <div className="flex justify-between items-center mb-5 pr-8">
        <h3 className="text-cyan-400 text-xl font-bold flex items-center gap-2">
          <span className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
          楼栋{buildingId} | 户端智能阀控系统
        </h3>
        <div className="text-xs text-gray-400">
          {isBalancing ? '二网平衡调节中...' : '实时监测'}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex gap-4 mb-4 text-xs text-gray-400 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />阀门关闭(低温)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />正在调节
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />阀门全开(达标)
        </span>
      </div>

      {/* 楼层列表 */}
      <div className="space-y-3">
        {[...data].sort((a, b) => b.floor - a.floor).map((unit, idx) => (
          <motion.div
            key={unit.floor}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${
              unit.left.temp < 18 || unit.right.temp < 18
                ? 'bg-red-950/30 border-red-500/30'
                : 'bg-cyan-950/20 border-cyan-500/20'
            }`}
          >
            {/* 楼层标记 */}
            <div className="col-span-1 text-center">
              <span className="text-gray-400 font-bold text-lg">{unit.floor}</span>
              <span className="text-xs text-gray-500 block">F</span>
              {unit.isTop && (
                <span className="text-xs bg-purple-600 text-white px-1 rounded mt-1 block">顶</span>
              )}
            </div>

            {/* 左户 */}
            <div className="col-span-5 flex items-center justify-between bg-black/40 p-2 rounded-lg">
              <div className="flex flex-col">
                <div
                  className={`text-2xl font-mono font-bold ${
                    unit.left.temp < 18
                      ? 'text-red-400'
                      : unit.left.temp < 20
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  {unit.left.temp}℃
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {unit.isEdge ? '边户' : '中间户'}
                  {unit.left.temp < 18 && (
                    <span className="text-red-400 ml-1">需加热</span>
                  )}
                </div>
              </div>
              <SmartValve
                openDegree={unit.left.valveOpen}
                isAdjusting={unit.left.isAdjusting}
                isTarget={adjustingFloor === unit.floor}
                valveId={`valve-left-${unit.floor}`}
              />
            </div>

            {/* 电梯井 */}
            <div className="col-span-1 flex justify-center">
              <div className="w-8 h-12 bg-gray-800 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-600">
                梯
              </div>
            </div>

            {/* 右户 */}
            <div className="col-span-5 flex items-center justify-between bg-black/40 p-2 rounded-lg">
              <div className="flex flex-col">
                <div
                  className={`text-2xl font-mono font-bold ${
                    unit.right.temp < 18
                      ? 'text-red-400'
                      : unit.right.temp < 20
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  {unit.right.temp}℃
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {unit.isEdge ? '边户' : '中间户'}
                </div>
              </div>
              <SmartValve
                openDegree={unit.right.valveOpen}
                isAdjusting={unit.right.isAdjusting}
                isTarget={adjustingFloor === unit.floor}
                valveId={`valve-right-${unit.floor}`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* 统计 */}
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div className="bg-black/40 p-3 rounded-lg border border-cyan-500/20">
          <div className="text-xs text-gray-400">平均室温</div>
          <div className="text-xl font-bold text-cyan-400">{avgTemp.toFixed(1)}℃</div>
        </div>
        <div className="bg-black/40 p-3 rounded-lg border border-cyan-500/20">
          <div className="text-xs text-gray-400">阀门平均开度</div>
          <div className="text-xl font-bold text-green-400">{avgValve.toFixed(0)}%</div>
        </div>
        <div className="bg-black/40 p-3 rounded-lg border border-cyan-500/20">
          <div className="text-xs text-gray-400">二网平衡率</div>
          <div className="text-xl font-bold text-yellow-400">
            {isBalancing ? '优化中...' : '95%'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitGridWithValves;
