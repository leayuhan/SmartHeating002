/**
 * CinematicScene.tsx
 * 常态2.5D电影感场景包裹组件
 * - CSS perspective: 1200px + rotateX: 15度俯视
 * - 鼠标视差已禁用，保持固定视角
 * - 提供 focusOn / resetView / montageCut 命令式API
 */
import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import gsap from 'gsap';

export interface CinematicSceneHandle {
  focusOn: (targetId: string, zoomLevel?: number, duration?: number) => void;
  resetView: (duration?: number) => void;
  montageCut: (targets: string[], interval?: number) => void;
  panTo: (x: number, y: number, scale?: number, duration?: number) => void;
}

interface Props {
  children: React.ReactNode;
  enableParallax?: boolean;
  baseRotateX?: number;
  baseRotateY?: number;
}

const CinematicScene = forwardRef<CinematicSceneHandle, Props>(({
  children,
  enableParallax = false,
  baseRotateX = 8,
  baseRotateY = -3,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isFocusedRef = useRef(false);

  // 初始化2.5D俯视角度
  useEffect(() => {
    if (!sceneRef.current) return;
    gsap.set(sceneRef.current, {
      rotateX: baseRotateX,
      rotateY: baseRotateY,
      transformPerspective: 1200,
      transformOrigin: 'center center',
    });
  }, [baseRotateX, baseRotateY]);

  // 鼠标视差 - 已禁用
  useEffect(() => {
    // 视差效果已禁用，保持固定视角
    return () => {};
  }, []);

  const focusOn = useCallback((targetId: string, zoomLevel = 2.5, duration = 1.2) => {
    const target = document.getElementById(targetId);
    const scene = sceneRef.current;
    if (!target || !scene) return;

    isFocusedRef.current = true;

    const rect = target.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const deltaX = centerX - (rect.left + rect.width / 2);
    const deltaY = centerY - (rect.top + rect.height / 2);

    // 虚化非焦点元素
    gsap.to('.cinematic-layer', {
      filter: 'blur(3px) brightness(0.35)',
      opacity: 0.25,
      duration: duration * 0.4,
      ease: 'power2.in',
    });

    // 高亮目标
    gsap.to(target, {
      filter: 'blur(0px) brightness(1.3)',
      opacity: 1,
      zIndex: 100,
      duration: duration * 0.5,
      delay: duration * 0.2,
      ease: 'power2.out',
    });

    // 推近场景
    gsap.to(scene, {
      x: deltaX,
      y: deltaY,
      scale: zoomLevel,
      duration,
      ease: 'power2.inOut',
    });
  }, []);

  const resetView = useCallback((duration = 1.2) => {
    isFocusedRef.current = false;

    gsap.to('.cinematic-layer', {
      filter: 'blur(0px) brightness(1)',
      opacity: 1,
      duration: duration * 0.5,
      ease: 'power2.out',
    });

    gsap.to(sceneRef.current, {
      x: 0,
      y: 0,
      scale: 1,
      duration,
      ease: 'power2.inOut',
    });
  }, []);

  const montageCut = useCallback((targets: string[], interval = 1.5) => {
    targets.forEach((id, i) => {
      gsap.delayedCall(i * interval, () => focusOn(id, 2.5, 0.8));
    });
    gsap.delayedCall(targets.length * interval + 1, () => resetView(0.8));
  }, [focusOn, resetView]);

  const panTo = useCallback((x: number, y: number, scale = 1, duration = 1.2) => {
    gsap.to(sceneRef.current, {
      x,
      y,
      scale,
      duration,
      ease: 'power2.inOut',
    });
  }, []);

  useImperativeHandle(ref, () => ({
    focusOn,
    resetView,
    montageCut,
    panTo,
  }), [focusOn, resetView, montageCut, panTo]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        perspective: '1200px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={sceneRef}
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
});

CinematicScene.displayName = 'CinematicScene';

export default CinematicScene;
