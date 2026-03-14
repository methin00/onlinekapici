'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './metric-card';

type UnlockSliderProps = {
  label: string;
  hint?: string;
  onComplete: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  resetKey?: string | number;
};

const HANDLE_SIZE = 64;
const TRACK_PADDING = 12;

export function UnlockSlider({
  label,
  hint,
  onComplete,
  disabled = false,
  loading = false,
  resetKey
}: UnlockSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef(0);
  const pointerStartRef = useRef(0);
  const maxPositionRef = useRef(0);
  const draggingRef = useRef(false);
  const completedRef = useRef(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    setPosition(0);
    completedRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!draggingRef.current || disabled || loading) {
        return;
      }

      const delta = event.clientX - pointerStartRef.current;
      const nextPosition = Math.min(Math.max(0, dragStartRef.current + delta), maxPositionRef.current);
      setPosition(nextPosition);
    }

    function handlePointerUp() {
      if (!draggingRef.current) {
        return;
      }

      draggingRef.current = false;

      const threshold = maxPositionRef.current * 0.82;
      if (position >= threshold && !completedRef.current) {
        completedRef.current = true;
        setPosition(maxPositionRef.current);
        void onComplete();
      } else {
        setPosition(0);
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [disabled, loading, onComplete, position]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || loading) {
      return;
    }

    const trackWidth = trackRef.current?.offsetWidth ?? 0;
    maxPositionRef.current = Math.max(trackWidth - HANDLE_SIZE - TRACK_PADDING * 2, 0);
    pointerStartRef.current = event.clientX;
    dragStartRef.current = position;
    draggingRef.current = true;
  }

  return (
    <div className="space-y-3">
      <div
        ref={trackRef}
        className="relative flex h-20 items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-elevated)] px-3 cursor-pointer"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full border-r border-amber-500/40 bg-amber-500/12 transition-all duration-200"
          style={{ width: `${position + HANDLE_SIZE + TRACK_PADDING}px` }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-20 text-center">
          <span className="font-heading text-lg font-bold tracking-[0.05em] text-white">{label}</span>
          {hint ? <span className="mt-1 text-[10px] uppercase font-bold tracking-[0.2em] text-amber-500/80">{hint}</span> : null}
        </div>
        <button
          aria-label={label}
          className={cn(
            "absolute left-3 top-1/2 flex h-[64px] w-[64px] -translate-y-1/2 touch-none items-center justify-center rounded-full transition-transform duration-150 border",
            disabled || loading ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed" : "bg-amber-500 text-black border-amber-400 cursor-grab active:cursor-grabbing hover:scale-105"
          )}
          disabled={disabled || loading}
          onPointerDown={handlePointerDown}
          style={{ left: `${TRACK_PADDING + position}px` }}
          type="button"
        >
          <ChevronRight className={cn("w-8 h-8", disabled || loading ? "text-zinc-500" : "text-black")} />
        </button>
      </div>
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Geri Dönülmez İşlem</p>
    </div>
  );
}
