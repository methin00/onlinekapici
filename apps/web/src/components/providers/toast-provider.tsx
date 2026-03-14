'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
};

type ToastInput = {
  tone: ToastTone;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  dismissToast: (toastId: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastToneClass(tone: ToastTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-700/15 bg-[#e4f4e8] text-[#245437]';
    case 'warning':
      return 'border-amber-700/15 bg-[#fbf0dd] text-[#7a5322]';
    case 'danger':
      return 'border-rose-700/15 bg-[#f9e3e5] text-[#8a3139]';
    case 'info':
      return 'border-cyan-700/15 bg-[#e2f0f6] text-[#245875]';
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutMapRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((toastId: string) => {
    const timeoutId = timeoutMapRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(toastId);
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback(
    ({ tone, message, durationMs = 4200 }: ToastInput) => {
      const id = crypto.randomUUID();

      setToasts((current) => [...current, { id, tone, message }]);

      const timeoutId = setTimeout(() => {
        dismissToast(id);
      }, durationMs);

      timeoutMapRef.current.set(id, timeoutId);
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast
    }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[140] flex w-[min(92vw,420px)] flex-col gap-3 md:right-6 md:top-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            aria-live="polite"
            className={`pointer-events-auto rounded-[24px] border px-5 py-4 shadow-[0_18px_36px_-24px_rgba(0,0,0,0.28)] ${toastToneClass(
              toast.tone
            )}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold leading-relaxed">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-full border border-black/10 bg-white/65 px-2.5 py-1 text-xs font-semibold text-current transition hover:bg-white/90"
              >
                Kapat
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast yalnızca ToastProvider içinde kullanılabilir.');
  }

  return context;
}
