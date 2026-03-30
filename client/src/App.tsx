import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DemoPage from "./pages/DemoPage";
import NetworkDiagnosis from "./pages/NetworkDiagnosis";

type AppTab = "monitor" | "demo" | "diagnosis";
function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("monitor");

  return (
    <div style={{
      width: "100vw", height: "100dvh",
      display: "flex", flexDirection: "column",
      background: "#020B1A", overflow: "hidden",
    }}>
      {/* Global tab switcher — deep blue tech style */}
      <div style={{
        display: "flex", alignItems: "center",
        background: "rgba(2,11,26,0.97)",
        borderBottom: "1px solid rgba(0,180,255,0.2)",
        boxShadow: "0 2px 20px rgba(0,50,150,0.3), inset 0 -1px 0 rgba(0,180,255,0.15)",
        padding: "0 16px",
        gap: 0,
        zIndex: 100,
        flexShrink: 0,
        height: 44,
        position: "relative",
      }}>
        {/* Bottom glow line */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.5) 30%, rgba(0,212,255,0.8) 50%, rgba(0,180,255,0.5) 70%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Brand logo + title */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginRight: 24, paddingRight: 24,
          borderRight: "1px solid rgba(0,180,255,0.15)",
          flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #0A2050 0%, #1A3A70 100%)",
            border: "1px solid rgba(0,180,255,0.35)",
            boxShadow: "0 0 14px rgba(0,180,255,0.35), inset 0 1px 0 rgba(0,180,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="18" height="18" rx="5" fill="rgba(0,212,255,0.15)" stroke="rgba(0,212,255,0.6)" strokeWidth="1"/>
              <circle cx="11" cy="11" r="4.5" stroke="#00D4FF" strokeWidth="1.5" fill="none"/>
              <circle cx="11" cy="11" r="1.5" fill="#00D4FF"/>
            </svg>
          </div>
          <span style={{
            fontSize: 14, fontWeight: 800, color: "#E0F4FF",
            fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            textShadow: "0 0 20px rgba(0,180,255,0.4)",
          }}>智慧供热·室温辨识与自适应调控AI系统</span>
        </div>

        {/* Tab buttons */}
        {[
          { id: "monitor" as const, icon: "⚙️", label: "工程运行监控" },
          { id: "demo" as const, icon: "robot", label: "AI推演展示", badge: "NEW" },
          { id: "diagnosis" as const, icon: "🔍", label: "管网诊断", badge: "NEW" },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "0 16px", height: 44,
                fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#00D4FF" : "rgba(148,210,255,0.6)",
                background: isActive ? "rgba(0,100,200,0.12)" : "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #00D4FF" : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "'Noto Sans SC', sans-serif",
                whiteSpace: "nowrap",
                textShadow: isActive ? "0 0 10px rgba(0,212,255,0.5)" : "none",
                boxShadow: isActive ? "inset 0 -2px 0 rgba(0,212,255,0.3)" : "none",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = "rgba(148,210,255,0.9)";
                  e.currentTarget.style.background = "rgba(0,80,180,0.08)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = "rgba(148,210,255,0.6)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {tab.icon === 'robot' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
                  <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="2" r="1.2" fill="currentColor"/>
                  <circle cx="9" cy="11" r="1.8" fill="currentColor"/>
                  <circle cx="15" cy="11" r="1.8" fill="currentColor"/>
                  <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="1" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <rect x="20" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              ) : (
                <span style={{ fontSize: 13 }}>{tab.icon}</span>
              )}
              {tab.label}
              {tab.badge && (
                <span style={{
                  padding: "1px 5px", borderRadius: 3,
                  fontSize: 8, fontWeight: 700,
                  background: "rgba(0,255,157,0.12)",
                  color: "#00FF9D",
                  border: "1px solid rgba(0,255,157,0.3)",
                  marginLeft: 2,
                  textShadow: "0 0 6px rgba(0,255,157,0.5)",
                }}>{tab.badge}</span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Version tag */}
        <div style={{
          fontSize: 9, color: "rgba(100,180,255,0.4)",
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: "0.08em",
        }}>
          SMART HEATING · AI PLATFORM v2.0
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "monitor" ? <Home /> : activeTab === "demo" ? <DemoPage /> : <NetworkDiagnosis />}
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
