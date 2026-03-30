/**
 * ZoomableElement.tsx
 * 点击任意元素 → 3D飞出放大到屏幕中央
 * translateZ + scale + perspective，可无限放大/缩小
 * 点击背景或按ESC退出
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';

interface ZoomableElementProps {
  children: React.ReactNode;
  zoomedContent?: React.ReactNode; // 放大后显示的内容，默认同children
  label?: string;
  zIndex?: number;
  disabled?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export default function ZoomableElement({
  children,
  zoomedContent,
  label,
  zIndex = 100,
  disabled = false,
  onZoomIn,
  onZoomOut,
}: ZoomableElementProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    const rect = triggerRef.current?.getBoundingClientRect();
    setOriginRect(rect || null);
    setIsZoomed(true);
    onZoomIn?.();
  }, [disabled, onZoomIn]);

  const handleClose = useCallback(() => {
    setIsZoomed(false);
    onZoomOut?.();
  }, [onZoomOut]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isZoomed, handleClose]);

  // GSAP entrance animation for overlay content
  useEffect(() => {
    if (isZoomed && overlayRef.current) {
      gsap.fromTo(
        overlayRef.current.querySelector('.zoom-content'),
        { scale: 0.3, rotateX: 25, rotateY: -15, z: -400, opacity: 0 },
        {
          scale: 1,
          rotateX: 0,
          rotateY: 0,
          z: 0,
          opacity: 1,
          duration: 0.55,
          ease: 'back.out(1.2)',
        }
      );
    }
  }, [isZoomed]);

  return (
    <>
      {/* 触发元素 */}
      <div
        ref={triggerRef}
        onClick={handleClick}
        className={`relative ${disabled ? '' : 'cursor-pointer'}`}
        style={{
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => {
          if (!disabled) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        }}
      >
        {children}
        {!disabled && (
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs"
            style={{
              background: 'rgba(6,182,212,0.9)',
              color: '#fff',
              fontSize: 8,
              lineHeight: 1,
              boxShadow: '0 0 6px rgba(6,182,212,0.8)',
            }}
          >
            ⊕
          </div>
        )}
      </div>

      {/* 全屏放大覆盖层 */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 flex items-center justify-center"
            style={{
              zIndex: 9000,
              background: 'rgba(2,11,26,0.92)',
              backdropFilter: 'blur(8px)',
              perspective: '1200px',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
          >
            {/* 关闭提示 */}
            <div
              className="absolute top-4 right-4 text-xs font-mono flex items-center gap-2"
              style={{ color: '#475569' }}
            >
              <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>ESC</kbd>
              或点击背景关闭
            </div>

            {/* 标签 */}
            {label && (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 text-sm font-mono tracking-wider"
                style={{ color: '#06b6d4' }}
              >
                {label}
              </div>
            )}

            {/* 放大内容 */}
            <div
              className="zoom-content"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '85vw',
                maxHeight: '85vh',
                overflow: 'auto',
                transformStyle: 'preserve-3d',
              }}
            >
              {zoomedContent || children}
            </div>

            {/* 扫描线装饰 */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
