/**
 * WeatherBar.tsx — Top header: logo + weather + demo controls
 * Design: NEON Deep Blue Tech — glass segments, Lucide icons, glow typography
 * Mobile: Compact 2-row header with collapsible weather details
 */
import { useEffect, useState } from "react";
import { Sun, Cloud, CloudRain, Snowflake, Thermometer, Wind, Droplets, Zap } from "lucide-react";
import type { WeatherData, HourlyForecast } from "../hooks/useWeather";
import type { WeatherType } from "../pages/Home";

interface Props {
  weather: WeatherData;
  isDemoMode: boolean;
  isAutoDemo: boolean;
  onSetDemoWeather: (w: WeatherType) => void;
  onEnterDemo: (w: WeatherType) => void;
  onExitDemo: () => void;
  onToggleAutoDemo: () => void;
  onShowTechModal?: () => void;
}

const WEATHER_LABELS: Record<WeatherType, string> = {
  sunny: "晴天", cloudy: "多云", rainy: "雨天", snowy: "雪天",
};

const WEATHER_EMOJI: Record<WeatherType, string> = {
  sunny: "☀️", cloudy: "⛅", rainy: "🌧️", snowy: "❄️",
};

const NEON_ICON_STYLE = { filter: "drop-shadow(0 0 8px rgba(0,224,255,0.55))" };

function WeatherIcon({ type, size = 15 }: { type: WeatherType; size?: number }) {
  const style = { width: size, height: size, color: "#00eaff", ...NEON_ICON_STYLE };
  if (type === "sunny") return <Sun style={style} />;
  if (type === "cloudy") return <Cloud style={style} />;
  if (type === "rainy") return <CloudRain style={style} />;
  return <Snowflake style={style} />;
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // 供暖季日期展示：将实际日期前移2个月
  const heatingDate = new Date(time);
  heatingDate.setMonth(heatingDate.getMonth() - 2);
  const dateStr = heatingDate.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", weekday: "short" });
  const timeStr = time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 15, fontWeight: 700, color: "#00eaff",
        textShadow: "0 0 10px rgba(0,234,255,0.6), 0 0 20px rgba(0,234,255,0.3)",
        lineHeight: 1, letterSpacing: "0.05em",
      }}>{timeStr}</div>
      <div style={{ fontSize: 8, color: "rgba(100,200,255,0.55)", marginTop: 2, letterSpacing: "0.05em" }}>{dateStr}</div>
    </div>
  );
}

function Seg({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      background: "linear-gradient(176deg, rgba(255,255,255,0.08) 0%, rgba(0,234,255,0.05) 50%, rgba(7,18,38,0.60) 100%)",
      border: "1px solid rgba(0,234,255,0.22)",
      borderRadius: 8,
      flexShrink: 0,
      boxShadow: "0 0 8px rgba(0,100,255,0.08), inset 0 1px 0 rgba(255,255,255,0.10)",
      backdropFilter: "blur(12px)",
    }}>
      <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      <div>
        <div style={{
          fontSize: 8, color: "rgba(0,234,255,0.6)", letterSpacing: "0.08em",
          lineHeight: 1, fontFamily: "'Share Tech Mono', monospace",
        }}>{label}</div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: color ?? "#00eaff", lineHeight: 1.3,
          fontFamily: "'Share Tech Mono', monospace",
          textShadow: "0 0 8px rgba(0,234,255,0.5)",
        }}>{value}</div>
      </div>
    </div>
  );
}

export default function WeatherBar({
  weather, isDemoMode, isAutoDemo,
  onSetDemoWeather, onEnterDemo, onExitDemo, onToggleAutoDemo, onShowTechModal,
}: Props) {
  const displayWeather: WeatherType = weather.currentWeatherType;
  const demoWeather: WeatherType = weather.demoWeather;
  const activeWeather = isDemoMode ? demoWeather : displayWeather;
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const tempColor = weather.currentTemp > 0 ? "#FFB347"
    : weather.currentTemp > -5 ? "#7DD3FC"
    : "#A5B4FC";

  return (
    <header className="top-header" style={{ flexDirection: "column", height: "auto", padding: 0 }}>
      {/* ── Main row ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", height: 52, width: "100%", boxSizing: "border-box",
      }}>
        {/* Desktop weather segments */}
        <div className="header-desktop-weather">
          <div className="header-divider" />

          {/* 天气 */}
          <Seg
            icon={<WeatherIcon type={activeWeather} size={14} />}
            label="天气"
            value={WEATHER_LABELS[activeWeather]}
          />

          {/* 室外温度 */}
          <Seg
            icon={<Thermometer style={{ width: 14, height: 14, color: tempColor, filter: `drop-shadow(0 0 6px ${tempColor}88)` }} />}
            label="室外温度"
            value={`${weather.currentTemp > 0 ? "+" : ""}${weather.currentTemp.toFixed(1)}°C`}
            color={tempColor}
          />

          {/* 风速 */}
          <Seg
            icon={<Wind style={{ width: 14, height: 14, color: "#00eaff", ...NEON_ICON_STYLE }} />}
            label="风速"
            value={`${weather.windSpeed.toFixed(1)} m/s`}
          />

          {/* 湿度 */}
          <Seg
            icon={<Droplets style={{ width: 14, height: 14, color: "#7DD3FC", filter: "drop-shadow(0 0 6px rgba(125,211,252,0.55))" }} />}
            label="湿度"
            value={`${weather.humidity}%`}
          />

          {/* 日照 */}
          <Seg
            icon={<Sun style={{ width: 14, height: 14, color: "#FFD700", filter: "drop-shadow(0 0 6px rgba(255,215,0,0.55))" }} />}
            label="日照"
            value={`${weather.sunshine} W/m²`}
          />

          {/* 12h forecast strip (real mode only) */}
          {!isDemoMode && weather.forecast12h.length > 0 && (
            <>
              <div className="header-divider" />
              <div className="forecast-strip">
                <span style={{ fontSize: 8, color: "rgba(0,234,255,0.6)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, whiteSpace: "nowrap" }}>
                  12H预报
                </span>
                {weather.forecast12h.slice(0, 5).map((h: HourlyForecast, i: number) => (
                  <div key={i} className="forecast-item">
                    <div className="forecast-hour">{i === 0 ? "现在" : `${h.hour}`}</div>
                    <div className="forecast-icon" style={{ display: "flex", justifyContent: "center" }}>
                      <WeatherIcon type={h.weatherType} size={10} />
                    </div>
                    <div className="forecast-temp" style={{
                      color: h.temp > 0 ? "#FFB347" : h.temp > -5 ? "#7DD3FC" : "#A5B4FC",
                    }}>
                      {h.temp > 0 ? "+" : ""}{h.temp.toFixed(0)}°
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Demo weather buttons */}
          {isDemoMode && (
            <>
              <div className="header-divider" />
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {(["sunny", "cloudy", "rainy", "snowy"] as WeatherType[]).map(w => (
                  <button key={w}
                    className={`weather-mode-btn ${demoWeather === w ? "selected" : "unselected"}`}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                    onClick={() => onSetDemoWeather(w)}>
                    <WeatherIcon type={w} size={11} />
                    {WEATHER_LABELS[w]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Mobile weather compact */}
        <div className="header-mobile-weather">
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 8px", borderRadius: 6,
            background: "rgba(0,30,80,0.5)", border: "1px solid rgba(0,234,255,0.2)",
          }}>
            <WeatherIcon type={activeWeather} size={16} />
            <span style={{ fontSize: 12, fontWeight: 700, color: tempColor, fontFamily: "'Share Tech Mono', monospace" }}>
              {weather.currentTemp > 0 ? "+" : ""}{weather.currentTemp.toFixed(1)}°C
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Status pills */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 8px",
          background: "rgba(0,60,30,0.4)", border: "1px solid rgba(0,200,100,0.3)", borderRadius: 5,
        }}>
          <div className="status-dot online" />
          <span style={{ fontSize: 9, color: "#00FF9D", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, textShadow: "0 0 6px rgba(0,220,100,0.5)" }}>AI运行中</span>
        </div>

        <div className="header-desktop-weather" style={{ display: "flex" }}>
          <div style={{
            padding: "3px 10px",
            background: "rgba(0,40,100,0.4)", border: "1px solid rgba(0,150,255,0.25)", borderRadius: 5,
          }}>
            <span style={{ fontSize: 9, color: "rgba(100,180,255,0.8)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>R²=0.9996</span>
          </div>

          <div className="header-divider" />

          {isDemoMode && (
            <button className={`demo-mode-btn ${isAutoDemo ? "active" : "inactive"}`} onClick={onToggleAutoDemo}>
              {isAutoDemo ? "⏹ 停止循环" : "▶ 自动循环"}
            </button>
          )}

          <button
            className={`demo-mode-btn ${isDemoMode ? "active" : "inactive"}`}
            onClick={isDemoMode ? onExitDemo : () => onEnterDemo("cloudy")}
            style={isDemoMode ? {
              borderColor: "rgba(255,180,50,0.5)", color: "#FFB347", background: "rgba(40,20,0,0.4)",
            } : {}}
          >
            {isDemoMode ? "📡 实时模式" : "🎬 演示模式"}
          </button>

          {onShowTechModal && (
            <button className="demo-mode-btn inactive" onClick={onShowTechModal} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
                <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
                <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="2" r="1.2" fill="currentColor"/>
                <circle cx="9" cy="11" r="1.8" fill="currentColor"/>
                <circle cx="15" cy="11" r="1.8" fill="currentColor"/>
                <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="1" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <rect x="20" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
              技术说明
            </button>
          )}

          <div className="header-divider" />
          <LiveClock />
        </div>

        {/* Mobile controls row */}
        <div className="header-mobile-controls">
          <button
            className={`demo-mode-btn ${isDemoMode ? "active" : "inactive"}`}
            onClick={isDemoMode ? onExitDemo : () => onEnterDemo("cloudy")}
            style={isDemoMode ? { borderColor: "rgba(255,180,50,0.5)", color: "#FFB347", background: "rgba(40,20,0,0.4)", fontSize: 9, padding: "3px 8px" } : { fontSize: 9, padding: "3px 8px" }}
          >
            {isDemoMode ? "📡 实时" : "🎬 演示"}
          </button>
          <button
            onClick={() => setMobileExpanded(v => !v)}
            style={{
              padding: "3px 8px", borderRadius: 5, fontSize: 9, fontWeight: 600,
              border: "1px solid rgba(0,150,255,0.2)", background: mobileExpanded ? "rgba(0,40,100,0.4)" : "rgba(0,20,60,0.3)",
              color: mobileExpanded ? "#00D4FF" : "rgba(100,160,220,0.6)",
            }}
          >
            {mobileExpanded ? "▲ 收起" : "▼ 更多"}
          </button>
        </div>
      </div>

      {/* ── Mobile expanded row ── */}
      {mobileExpanded && (
        <div className="header-mobile-expanded">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Seg icon={<Wind style={{ width: 12, height: 12, color: "#00eaff", ...NEON_ICON_STYLE }} />} label="风速" value={`${weather.windSpeed.toFixed(1)} m/s`} />
            <Seg icon={<Droplets style={{ width: 12, height: 12, color: "#7DD3FC" }} />} label="湿度" value={`${weather.humidity}%`} />
            <Seg icon={<Sun style={{ width: 12, height: 12, color: "#FFD700" }} />} label="日照" value={`${weather.sunshine} W/m²`} />
            <div style={{
              padding: "3px 8px",
              background: "rgba(0,40,100,0.4)", border: "1px solid rgba(0,150,255,0.25)", borderRadius: 5,
            }}>
              <span style={{ fontSize: 9, color: "rgba(100,180,255,0.8)", fontFamily: "'Share Tech Mono', monospace" }}>R²=0.9996</span>
            </div>
          </div>
          {isDemoMode && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
              {(["sunny", "cloudy", "rainy", "snowy"] as WeatherType[]).map(w => (
                <button key={w}
                  className={`weather-mode-btn ${demoWeather === w ? "selected" : "unselected"}`}
                  style={{ fontSize: 9, padding: "3px 8px", display: "flex", alignItems: "center", gap: 3 }}
                  onClick={() => onSetDemoWeather(w)}>
                  <WeatherIcon type={w} size={10} />
                  {WEATHER_LABELS[w]}
                </button>
              ))}
              <button className={`demo-mode-btn ${isAutoDemo ? "active" : "inactive"}`}
                style={{ fontSize: 9, padding: "3px 8px" }}
                onClick={onToggleAutoDemo}>
                {isAutoDemo ? "⏹ 停止" : "▶ 自动"}
              </button>
            </div>
          )}
          {onShowTechModal && (
            <button className="demo-mode-btn inactive" style={{ marginTop: 6, fontSize: 9, padding: "3px 8px", display: 'flex', alignItems: 'center', gap: 3 }} onClick={onShowTechModal}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
                <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
                <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="2" r="1.2" fill="currentColor"/>
                <circle cx="9" cy="11" r="1.8" fill="currentColor"/>
                <circle cx="15" cy="11" r="1.8" fill="currentColor"/>
                <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="1" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <rect x="20" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
              技术说明
            </button>
          )}
        </div>
      )}
    </header>
  );
}
