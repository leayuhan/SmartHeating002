import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMemo, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DemoPage from "./pages/DemoPage";
import NetworkDiagnosis from "./pages/NetworkDiagnosis";

type AppTab = "monitor" | "demo" | "diagnosis";

const NEON = {
  bg0: "#040B16",
  bg1: "#071524",
  bg2: "#0B1F36",
  line: "rgba(0, 234, 255, 0.20)",
  lineStrong: "rgba(0, 234, 255, 0.42)",
  cyan: "#00EAFF",
  cyanSoft: "#7CEBFF",
  blue: "#5AB6FF",
  text: "#DDFBFF",
  textSoft: "rgba(208, 244, 255, 0.78)",
  textDim: "rgba(138, 215, 255, 0.56)",
  green: "#39F6B0",
  orange: "#FFB86B",
  red: "#FF6B88",
  panel: "rgba(6, 18, 37, 0.58)",
  panelStrong: "rgba(7, 20, 42, 0.78)",
  blur: "blur(18px)",
  shadow: "0 0 24px rgba(0, 234, 255, 0.10), 0 0 60px rgba(0, 110, 255, 0.08)",
};

function TechIcon({
  children,
  size = 34,
  active = false,
}: {
  children: React.ReactNode;
  size?: number;
  active?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? NEON.cyan : NEON.textSoft,
        background: active
          ? "linear-gradient(180deg, rgba(0,234,255,0.18), rgba(0,120,255,0.10))"
          : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
        border: `1px solid ${active ? NEON.lineStrong : "rgba(255,255,255,0.08)"}`,
        boxShadow: active
          ? "0 0 18px rgba(0,234,255,0.25), inset 0 1px 0 rgba(255,255,255,0.10)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "all .2s ease",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, rgba(10,25,48,0.82), rgba(5,16,32,0.62))`,
        border: `1px solid ${NEON.line}`,
        boxShadow: NEON.shadow,
        backdropFilter: NEON.blur,
        WebkitBackdropFilter: NEON.blur,
        borderRadius: 20,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.00) 28%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          borderRadius: 20,
        }}
      />
      {children}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 10px ${color}`,
        display: "inline-block",
      }}
    />
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("monitor");

  const activeContent = useMemo(() => {
    if (activeTab === "monitor") return <Home />;
    if (activeTab === "demo") return <DemoPage />;
    return <NetworkDiagnosis />;
  }, [activeTab]);

  const navItems: {
    id: AppTab;
    label: string;
    sub: string;
    badge?: string;
  }[] = [
    { id: "monitor", label: "工程运行监控", sub: "Monitor" },
    { id: "demo", label: "AI推演展示", sub: "Simulation", badge: "NEW" },
    { id: "diagnosis", label: "管网诊断", sub: "Diagnosis", badge: "NEW" },
  ];

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        position: "relative",
        overflow: "hidden",
        background: `
          radial-gradient(circle at 50% 14%, rgba(0,234,255,0.12), transparent 28%),
          radial-gradient(circle at 82% 18%, rgba(65,135,255,0.10), transparent 22%),
          radial-gradient(circle at 18% 78%, rgba(0,234,255,0.08), transparent 24%),
          linear-gradient(180deg, ${NEON.bg2} 0%, ${NEON.bg1} 38%, ${NEON.bg0} 100%)
        `,
        color: NEON.text,
        fontFamily:
          "'Inter','Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
      }}
    >
      {/* soft grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.14,
          backgroundImage: `
            linear-gradient(rgba(100,180,255,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,180,255,0.10) 1px, transparent 1px)
          `,
          backgroundSize: "42px 42px",
          maskImage:
            "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.08) 42%, transparent 86%)",
        }}
      />

      {/* page content full bleed */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        {activeContent}
      </div>

      {/* top bar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 16,
          right: 16,
          height: 58,
          display: "flex",
          alignItems: "center",
          gap: 14,
          zIndex: 50,
        }}
      >
        <GlassPanel
          style={{
            height: "100%",
            minWidth: 290,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <TechIcon active>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="3.2" fill="currentColor" />
            </svg>
          </TechIcon>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "0.02em",
                color: NEON.text,
                textShadow: "0 0 16px rgba(0,234,255,0.18)",
              }}
            >
              智慧供热 · 室温辨识AI系统
            </div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: NEON.textDim,
                textTransform: "uppercase",
              }}
            >
              Sense · Predict · Decide · Act
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          style={{
            height: "100%",
            flex: 1,
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {[
              "☀",
              "☁",
              "☂",
              "❄",
              "↻",
            ].map((item, i) => (
              <TechIcon key={i} size={32} active={i === 0}>
                <span style={{ fontSize: 13 }}>{item}</span>
              </TechIcon>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 14,
              color: NEON.textSoft,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: NEON.cyan }}>−8°C</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: NEON.cyanSoft }}>14 km/h</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: NEON.cyanSoft }}>92%</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: NEON.cyanSoft }}>弱</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(57,246,176,0.26)",
                background: "rgba(57,246,176,0.10)",
                color: NEON.green,
                fontWeight: 700,
                fontSize: 12,
                boxShadow: "0 0 14px rgba(57,246,176,0.12)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Dot color={NEON.green} />
              系统正常
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* left rail */}
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 16,
          bottom: 18,
          width: 92,
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <GlassPanel
          style={{
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {navItems.map((item, index) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: "100%",
                  border: "none",
                  background: active
                    ? "linear-gradient(180deg, rgba(0,234,255,0.18), rgba(0,90,180,0.10))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                  color: active ? NEON.cyan : NEON.textSoft,
                  borderRadius: 16,
                  padding: "10px 8px",
                  cursor: "pointer",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: active ? NEON.lineStrong : "rgba(255,255,255,0.08)",
                  boxShadow: active
                    ? "0 0 18px rgba(0,234,255,0.18), inset 0 1px 0 rgba(255,255,255,0.08)"
                    : "inset 0 1px 0 rgba(255,255,255,0.04)",
                  transition: "all .18s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                }}
                title={item.label}
              >
                <TechIcon size={36} active={active}>
                  {index === 0 ? "⚙" : index === 1 ? "✦" : "⌁"}
                </TechIcon>

                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.15,
                    fontWeight: active ? 800 : 600,
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </div>

                <div
                  style={{
                    fontSize: 9,
                    color: active ? "rgba(180,245,255,0.86)" : NEON.textDim,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {item.sub}
                </div>

                {item.badge && (
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: "rgba(57,246,176,0.12)",
                      border: "1px solid rgba(57,246,176,0.22)",
                      color: NEON.green,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </GlassPanel>

        <GlassPanel
          style={{
            flex: 1,
            padding: "14px 10px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 220,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: NEON.textDim,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Core Status
            </div>

            {[
              ["热源", "运行", NEON.green],
              ["换热站", "3", NEON.cyan],
              ["异常", "1", NEON.orange],
            ].map(([k, v, c]) => (
              <div
                key={k}
                style={{
                  padding: "10px 8px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontSize: 10, color: NEON.textDim }}>{k}</div>
                <div
                  style={{
                    marginTop: 4,
                    fontWeight: 800,
                    fontSize: 16,
                    color: c,
                    textShadow: `0 0 12px ${c}22`,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 10,
              lineHeight: 1.6,
              color: NEON.textDim,
              textAlign: "center",
              paddingTop: 14,
            }}
          >
            SMART
            <br />
            HEATING
            <br />
            v2.0
          </div>
        </GlassPanel>
      </div>

      {/* right info quick panel */}
      <div
        style={{
          position: "absolute",
          top: 84,
          right: 16,
          bottom: 84,
          width: 320,
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        <GlassPanel
          style={{
            padding: "16px 16px 14px",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: NEON.text }}>
                B2栋
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: NEON.textDim,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>16层</span>
                <span>4800㎡</span>
                <span>东南朝向</span>
                <span>地暖</span>
              </div>
            </div>

            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                border: `1px solid ${NEON.line}`,
                background: "rgba(255,255,255,0.04)",
                color: NEON.textSoft,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {[
              ["室温", "18.6°C", NEON.cyan],
              ["回水", "17.8°C", NEON.cyanSoft],
              ["供暖", "19.1°C", NEON.red],
              ["风险", "2层", NEON.red],
            ].map(([k, v, c]) => (
              <div
                key={k}
                style={{
                  padding: "10px 8px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 10, color: NEON.textDim }}>{k}</div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 15,
                    fontWeight: 800,
                    color: c,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel
          style={{
            flex: 1,
            padding: "14px 14px 12px",
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>楼层温度</div>
              <div style={{ fontSize: 11, color: NEON.textDim, marginTop: 4 }}>
                24小时历史 · AI建议
              </div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(0,234,255,0.18)",
                background: "rgba(0,234,255,0.08)",
                fontSize: 11,
                color: NEON.cyan,
                fontWeight: 700,
              }}
            >
              自适应中
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflow: "auto",
              paddingRight: 4,
            }}
          >
            {Array.from({ length: 14 }).map((_, i) => {
              const floor = 16 - i;
              const percent = 48 + ((i * 7) % 42);
              const temp = (18.1 + (i % 5) * 0.25 + (i % 2 ? 0.1 : 0)).toFixed(1);
              return (
                <div
                  key={floor}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: NEON.textSoft }}>
                      {floor}层
                    </span>
                    <span style={{ fontSize: 12, color: NEON.cyanSoft }}>
                      {temp}°C
                    </span>
                  </div>

                  <div
                    style={{
                      height: 7,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, #7DE7FF 0%, #63C8FF 22%, #FFB16B 78%, #FF8D7A 100%)",
                        boxShadow: "0 0 12px rgba(126,231,255,0.35)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      {/* bottom bar */}
      <div
        style={{
          position: "absolute",
          left: 122,
          right: 350,
          bottom: 16,
          height: 56,
          zIndex: 46,
        }}
      >
        <GlassPanel
          style={{
            height: "100%",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              color: NEON.textDim,
              fontSize: 12,
            }}
          >
            <span style={{ color: NEON.cyan, fontWeight: 800 }}>
              智慧供热总控台
            </span>
            <span>建筑 / 换热站 / 热源 联动监测</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: `1px solid ${active ? NEON.lineStrong : "rgba(255,255,255,0.08)"}`,
                    background: active
                      ? "linear-gradient(180deg, rgba(0,234,255,0.16), rgba(0,90,180,0.10))"
                      : "rgba(255,255,255,0.03)",
                    color: active ? NEON.cyan : NEON.textSoft,
                    fontWeight: active ? 800 : 600,
                    fontSize: 12,
                    cursor: "pointer",
                    boxShadow: active ? "0 0 16px rgba(0,234,255,0.16)" : "none",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppShell />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
