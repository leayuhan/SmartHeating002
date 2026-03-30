/**
 * CameraController.tsx
 * GSAP镜头控制器：推拉缩放 + 非焦点虚化
 * 核心原则：一次只讲一件事，镜头推近时其他东西虚化
 */
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import gsap from 'gsap';

export interface CameraTarget {
  id: string;           // 目标元素ID
  scale?: number;       // 放大倍数（默认2.5）
  duration?: number;    // 动画时长（默认1.2s）
  ease?: string;
  offsetX?: number;     // 额外X偏移
  offsetY?: number;     // 额外Y偏移
}

export interface CameraControllerRef {
  focusOn: (target: CameraTarget) => Promise<void>;
  resetCamera: (duration?: number) => Promise<void>;
  panTo: (x: number, y: number, scale?: number) => Promise<void>;
}

interface CameraControllerProps {
  children: React.ReactNode;
  className?: string;
}

const CameraController = forwardRef<CameraControllerRef, CameraControllerProps>(
  ({ children, className = '' }, ref) => {
    const sceneRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      focusOn: (target: CameraTarget) => {
        return new Promise<void>((resolve) => {
          const scene = sceneRef.current;
          if (!scene) { resolve(); return; }

          const targetEl = document.getElementById(target.id);
          if (!targetEl) { resolve(); return; }

          const sceneRect = scene.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          // 计算目标中心相对于场景中心的偏移
          const sceneCenterX = sceneRect.left + sceneRect.width / 2;
          const sceneCenterY = sceneRect.top + sceneRect.height / 2;
          const targetCenterX = targetRect.left + targetRect.width / 2;
          const targetCenterY = targetRect.top + targetRect.height / 2;

          const scale = target.scale ?? 2.5;
          const deltaX = (sceneCenterX - targetCenterX) * scale + (target.offsetX ?? 0);
          const deltaY = (sceneCenterY - targetCenterY) * scale + (target.offsetY ?? 0);

          // 虚化所有场景层
          gsap.to('.camera-layer', {
            opacity: 0.15,
            filter: 'blur(3px)',
            duration: 0.4,
          });

          // 目标元素高亮
          gsap.to(targetEl, {
            opacity: 1,
            filter: 'blur(0px)',
            duration: 0.3,
          });

          // 镜头推近
          gsap.to(scene, {
            x: deltaX,
            y: deltaY,
            scale,
            duration: target.duration ?? 1.2,
            ease: target.ease ?? 'power3.inOut',
            onComplete: resolve,
          });
        });
      },

      resetCamera: (duration = 0.8) => {
        return new Promise<void>((resolve) => {
          const scene = sceneRef.current;
          if (!scene) { resolve(); return; }

          gsap.to(scene, {
            x: 0, y: 0, scale: 1,
            duration,
            ease: 'power2.out',
            onComplete: resolve,
          });

          gsap.to('.camera-layer', {
            opacity: 1,
            filter: 'blur(0px)',
            duration: duration * 0.6,
          });
        });
      },

      panTo: (x: number, y: number, scale = 1) => {
        return new Promise<void>((resolve) => {
          const scene = sceneRef.current;
          if (!scene) { resolve(); return; }

          gsap.to(scene, {
            x, y, scale,
            duration: 1.0,
            ease: 'power2.inOut',
            onComplete: resolve,
          });
        });
      },
    }));

    return (
      <div
        ref={sceneRef}
        className={`w-full h-full origin-center ${className}`}
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    );
  }
);

CameraController.displayName = 'CameraController';
export default CameraController;
