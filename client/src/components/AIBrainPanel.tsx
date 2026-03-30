/**
 * AIBrainPanel.tsx — AI智脑控制中枢（GSAP版）
 * 特性：
 * - GSAP呼吸灯：box-shadow脉冲，三态颜色
 *   standby: #00f0ff 慢速 | alarm: #ff0040 快速+scale 1.1 | active: #00ff9d 中速
 * - SVG贝塞尔数据流线：从智脑向目标楼栋发射流动虚线（strokeDashoffset循环）
 * - GSAP策略卡片轮播：阶段4依次高亮，间隔0.5s，最终锁定"室温调控"
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

interface Props {
  demoPhase: number;
  isDemoRunning: boolean;
  alertBuilding?: string;
  alertTemp?: number;
  // 数据流线目标（楼栋元素ID或坐标）
  beamTargetId?: string;
}

const STRATEGY_CARDS = [
  { id: "supply_temp", icon: "🌡️", title: "供温调节",  desc: "45°C → 47°C",    color: "#EF4444" },
  { id: "flow",        icon: "💧", title: "流量调节",  desc: "100 → 110 t/h",  color: "#3B82F6" },
  { id: "pressure",    icon: "⚡", title: "压差控制",  desc: "28 → 32 kPa",    color: "#F59E0B" },
  { id: "room_temp",   icon: "🏠", title: "室温调控",  desc: "14.5°C → 22°C",  color: "#22C55E", recommended: true },
];

const STATE_COLORS = {
  normal: "#00f0ff",
  alert:  "#ff0040",
  active: "#00ff9d",
};

export default function AIBrainPanel({ demoPhase, isDemoRunning, alertBuilding, beamTargetId }: Props) {
  const brainRef   = useRef<HTMLDivElement>(null);
  const beamRef    = useRef<SVGPathElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const brainTween = useRef<gsap.core.Tween | null>(null);
  const beamTween  = useRef<gsap.core.Tween | null>(null);

  const [lockedCard, setLockedCard] = useState(-1);
  const [activeCard, setActiveCard] = useState(-1);

  // 当前脑状态
  const pulseState = !isDemoRunning
    ? "normal"
    : demoPhase === 1
    ? "alert"
    : demoPhase >= 2 && demoPhase <= 4
    ? "active"
    : "normal";

  // ── GSAP 呼吸灯 ──
  useEffect(() => {
    if (!brainRef.current) return;
    brainTween.current?.kill();

    const color = STATE_COLORS[pulseState as keyof typeof STATE_COLORS];
    const dur   = pulseState === "alert" ? 0.4 : pulseState === "active" ? 1.0 : 2.0;
    const scale = pulseState === "alert" ? 1.1 : 1;

    brainTween.current = gsap.to(brainRef.current, {
      boxShadow: `0 0 30px ${color}, 0 0 60px ${color}40`,
      scale,
      duration: dur,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });

    return () => { brainTween.current?.kill(); };
  }, [pulseState]);

  // ── GSAP 策略卡片轮播（阶段3/决策） ──
  useEffect(() => {
    if (demoPhase !== 3 || !isDemoRunning) {
      setActiveCard(-1);
      setLockedCard(-1);
      return;
    }

    setLockedCard(-1);
    const tl = gsap.timeline();

    STRATEGY_CARDS.forEach((_, i) => {
      tl.call(() => setActiveCard(i), undefined, i * 0.5);
    });

    // 最终锁定室温调控（第4张，index 3）
    tl.call(() => {
      setLockedCard(3);
      setActiveCard(3);
    }, undefined, STRATEGY_CARDS.length * 0.5 + 0.3);

    return () => { tl.kill(); };
  }, [demoPhase, isDemoRunning]);

  // ── SVG 贝塞尔数据流线 ──
  useEffect(() => {
    if (!beamRef.current || !svgRef.current || !brainRef.current) return;
    beamTween.current?.kill();

    const shouldShow = isDemoRunning && (demoPhase === 1 || demoPhase === 4) && beamTargetId;
    if (!shouldShow) {
      gsap.set(beamRef.current, { opacity: 0 });
      return;
    }

    const updateBeam = () => {
      if (!brainRef.current || !beamRef.current) return;
      const brainRect = brainRef.current.getBoundingClientRect();
      const bx = brainRect.left + brainRect.width / 2;
      const by = brainRect.bottom;

      const targetEl = beamTargetId ? document.getElementById(beamTargetId) : null;
      let tx = bx, ty = by + 120;
      if (targetEl) {
        const tr = targetEl.getBoundingClientRect();
        tx = tr.left + tr.width / 2;
        ty = tr.top + tr.height / 2;
      }

      const cx = (bx + tx) / 2 - 60;
      const cy = (by + ty) / 2;
      const d  = `M ${bx} ${by} Q ${cx} ${cy} ${tx} ${ty}`;
      beamRef.current.setAttribute("d", d);

      const pathLen = (beamRef.current as SVGPathElement).getTotalLength?.() ?? 200;
      gsap.set(beamRef.current, {
        strokeDasharray: `${pathLen * 0.18} ${pathLen * 0.82}`,
        strokeDashoffset: 0,
        opacity: 0.9,
      });

      beamTween.current?.kill();
      beamTween.current = gsap.to(beamRef.current, {
        strokeDashoffset: -pathLen,
        duration: 1.6,
        repeat: -1,
        ease: "none",
      });
    };

    updateBeam();
    window.addEventListener("resize", updateBeam);
    return () => {
      window.removeEventListener("resize", updateBeam);
      beamTween.current?.kill();
    };
  }, [isDemoRunning, demoPhase, beamTargetId]);

  const brainColor = STATE_COLORS[pulseState as keyof typeof STATE_COLORS];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: "10px 12px",
      background: "rgba(0,10,35,0.85)",
      borderBottom: "1px solid rgba(0,180,255,0.12)",
    }}>
      {/* ── AI Brain Icon ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Brain orb — GSAP targets this */}
        <div
          ref={brainRef}
          id="ai-brain"
          style={{
            width: 44, height: 44,
            borderRadius: "50%",
            background: pulseState === "alert"
              ? "radial-gradient(circle, rgba(80,0,0,0.8) 0%, rgba(20,0,0,0.95) 100%)"
              : pulseState === "active"
              ? "radial-gradient(circle, rgba(0,40,100,0.8) 0%, rgba(0,10,40,0.95) 100%)"
              : "radial-gradient(circle, rgba(0,20,60,0.8) 0%, rgba(0,5,25,0.95) 100%)",
            border: `2px solid ${brainColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
            position: "relative",
            transition: "border-color 0.5s",
          }}
        >
          {/* 科技感机器人脑SVG */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: brainColor }}>
            {/* 机器人头部外框 */}
            <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" fill="rgba(0,212,255,0.1)"/>
            {/* 天线 */}
            <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="2" r="1" fill="currentColor"/>
            {/* 眼睛（LED灯） */}
            <circle cx="9" cy="11" r="1.5" fill="currentColor" opacity="0.9"/>
            <circle cx="15" cy="11" r="1.5" fill="currentColor" opacity="0.9"/>
            {/* 嘴部（数据线） */}
            <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
            {/* 耳朵（接口） */}
            <rect x="1" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1" fill="rgba(0,212,255,0.15)"/>
            <rect x="20" y="9" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1" fill="rgba(0,212,255,0.15)"/>
          </svg>
          {/* Orbit ring */}
          <div style={{
            position: "absolute", inset: -6,
            borderRadius: "50%",
            border: `1px solid ${brainColor}`,
            opacity: 0.4,
            animation: "orbit-spin 4s linear infinite",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 800,
            color: brainColor,
            fontFamily: "'Noto Sans SC', sans-serif",
            textShadow: `0 0 10px ${brainColor}80`,
            letterSpacing: 1,
          }}>AI 智脑中枢</div>
          <div style={{
            fontSize: 9.5, color: "rgba(100,180,255,0.6)",
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 0.5,
          }}>
            {pulseState === "alert"  ? "⚠ ALERT — 低温异常检测" :
             pulseState === "active" ? "◉ ACTIVE — 调控指令下发中" :
             "● STANDBY — 实时监控中"}
          </div>
        </div>

        <div style={{
          padding: "3px 8px", borderRadius: 6,
          background: pulseState === "alert" ? "rgba(80,0,0,0.5)" : "rgba(0,30,80,0.5)",
          border: `1px solid ${brainColor}50`,
          fontSize: 9, fontWeight: 700,
          color: brainColor,
          fontFamily: "'Share Tech Mono', monospace",
          flexShrink: 0,
          textShadow: `0 0 6px ${brainColor}60`,
        }}>
          {pulseState === "alert" ? "ALERT" : pulseState === "active" ? "RUN" : "OK"}
        </div>
      </div>

      {/* ── Strategy Cards (Phase 3 — 决策) ── */}
      {isDemoRunning && demoPhase === 3 && (
        <div>
          <div style={{
            fontSize: 9.5, color: "rgba(100,180,255,0.55)", marginBottom: 6,
            fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 1,
          }}>
            系统正在评估最优策略...
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {STRATEGY_CARDS.map((card, i) => {
              const isActive = activeCard === i;
              const isLocked = lockedCard === i;
              const isDimmed = lockedCard >= 0 && !isLocked;
              return (
                <div
                  key={card.id}
                  id={`strategy-${card.id}`}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${isActive || isLocked ? card.color : "rgba(0,100,200,0.2)"}`,
                    background: isActive || isLocked ? `${card.color}18` : "rgba(0,15,50,0.5)",
                    opacity: isDimmed ? 0.4 : 1,
                    transform: isLocked ? "scale(1.1)" : isActive ? "scale(1.05)" : "scale(1)",
                    transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: isActive || isLocked ? `0 0 16px ${card.color}50` : "none",
                    position: "relative",
                  }}
                >
                  {card.recommended && isLocked && (
                    <div style={{
                      position: "absolute", top: -7, right: 6,
                      padding: "1px 6px", borderRadius: 3,
                      background: card.color, color: "white",
                      fontSize: 8, fontWeight: 700,
                      fontFamily: "'Noto Sans SC', sans-serif",
                    }}>AI推荐 ✓</div>
                  )}
                  <div style={{ fontSize: 14, marginBottom: 3 }}>{card.icon}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: isActive || isLocked ? card.color : "rgba(148,210,255,0.6)",
                    fontFamily: "'Noto Sans SC', sans-serif",
                    textShadow: isActive || isLocked ? `0 0 8px ${card.color}80` : "none",
                  }}>{card.title}</div>
                  <div style={{
                    fontSize: 8.5, color: "rgba(100,160,220,0.7)",
                    fontFamily: "'Share Tech Mono', monospace",
                    marginTop: 1,
                  }}>{card.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Data flow indicators (Phase 4 — 执行) ── */}
      {isDemoRunning && demoPhase === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 9.5, color: "rgba(0,212,255,0.6)", fontFamily: "'Noto Sans SC', sans-serif", letterSpacing: 1 }}>
            三级联动指令下发中
          </div>
          {[
            { from: "AI智脑", to: "换热站",  action: "供温↑2°C",  color: "#EF4444" },
            { from: "换热站", to: "主管网",  action: "流量↑10%",  color: "#3B82F6" },
            { from: "主管网", to: "户端阀门", action: "开度↑55%", color: "#22C55E" },
          ].map((flow, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 6,
              background: "rgba(0,20,60,0.5)",
              border: `1px solid ${flow.color}30`,
              animation: `flow-in 0.3s ease ${i * 0.2}s both`,
            }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(148,210,255,0.8)", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap" }}>
                {flow.from}
              </span>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${flow.color}80, ${flow.color})`, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", top: -1, left: 0,
                  width: 8, height: 3, borderRadius: 2,
                  background: flow.color,
                  animation: "data-flow 1s linear infinite",
                }} />
              </div>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(148,210,255,0.8)", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap" }}>
                {flow.to}
              </span>
              <span style={{ fontSize: 8, color: flow.color, fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap", textShadow: `0 0 6px ${flow.color}80` }}>
                {flow.action}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* SVG 数据流线层（全屏） */}
      <svg
        ref={svgRef}
        style={{
          position: "fixed", inset: 0,
          width: "100vw", height: "100vh",
          pointerEvents: "none",
          zIndex: 45,
        }}
      >
        <defs>
          <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#00f0ff" />
            <stop offset="100%" stopColor={pulseState === "alert" ? "#ff0040" : "#00ff9d"} />
          </linearGradient>
          <filter id="beamGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path
          ref={beamRef}
          fill="none"
          stroke="url(#beamGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#beamGlow)"
          opacity="0"
        />
      </svg>

      <style>{`
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes data-flow {
          from { left: -10px; }
          to   { left: calc(100% + 10px); }
        }
        @keyframes flow-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
