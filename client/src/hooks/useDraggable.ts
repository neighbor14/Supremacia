import { useState, useRef, useCallback, useEffect } from 'react';

interface Pos { x: number; y: number }

export function useDraggable(defaultPos: Pos | (() => Pos)) {
  const [pos, setPos] = useState<Pos>(defaultPos);
  const posRef = useRef(pos);
  posRef.current = pos;
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep pos inside viewport — uses actual rendered element size
  const clamp = useCallback((x: number, y: number): Pos => {
    const el = containerRef.current;
    const pw = el?.offsetWidth ?? 80;
    const ph = el?.offsetHeight ?? 40;
    return {
      x: Math.max(0, Math.min(x, window.innerWidth - pw)),
      y: Math.max(0, Math.min(y, window.innerHeight - ph)),
    };
  }, []);

  // Re-clamp when device rotates or window resizes
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p.x, p.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = { ...posRef.current };
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      setPos(clamp(startPos.x + ev.clientX - startX, startPos.y + ev.clientY - startY));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clamp]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startPos = { ...posRef.current };
    const startX = touch.clientX;
    const startY = touch.clientY;

    const onMove = (ev: TouchEvent) => {
      ev.preventDefault();
      const t = ev.touches[0];
      setPos(clamp(startPos.x + t.clientX - startX, startPos.y + t.clientY - startY));
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }, [clamp]);

  return {
    pos,
    containerRef,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      style: { cursor: 'grab', userSelect: 'none' as const, touchAction: 'none' as const },
    },
    containerStyle: {
      position: 'absolute' as const,
      left: `${pos.x}px`,
      top: `${pos.y}px`,
    },
  };
}
