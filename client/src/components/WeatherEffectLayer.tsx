/**
 * WeatherEffectLayer - 天气动画覆盖层
 * 仅保留雨天动画，删除太阳和云彩
 */
import { useEffect, useState } from "react";
import { WeatherType } from "../pages/Home";

interface Props {
  weather: WeatherType;
  active: boolean;
}

// Rain drops
function RainDrops() {
  const drops = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${0.6 + Math.random() * 0.6}s`,
    opacity: 0.3 + Math.random() * 0.5,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {drops.map((d) => (
        <div
          key={d.id}
          className="absolute w-0.5 rounded-full"
          style={{
            left: d.left,
            top: "-20px",
            height: `${12 + Math.random() * 16}px`,
            background: "linear-gradient(180deg, transparent, #93c5fd)",
            opacity: d.opacity,
            animation: `rain-drop ${d.duration} linear ${d.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function WeatherEffectLayer({ weather, active }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0 }}
    >
      {weather === "rainy" && (
        <>
          <RainDrops />
          <div className="absolute inset-0" style={{ background: "rgba(59,130,246,0.06)" }} />
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-center"
            style={{
              background: "rgba(239,246,255,0.95)",
              border: "2px solid #3b82f6",
              boxShadow: "0 8px 24px rgba(59,130,246,0.2)",
              animation: "slide-up 0.4s ease-out forwards",
            }}
          >
            <div className="text-2xl mb-1">🌧️</div>
            <div className="font-bold text-base" style={{ color: "#1d4ed8" }}>下雨了！</div>
            <div className="text-sm mt-0.5" style={{ color: "#1e3a8a" }}>气温下降 → 室温降低 -2°C</div>
            <div className="text-xs mt-1" style={{ color: "#2563eb" }}>AI模型正在重新预测各楼栋室温...</div>
          </div>
        </>
      )}
    </div>
  );
}
