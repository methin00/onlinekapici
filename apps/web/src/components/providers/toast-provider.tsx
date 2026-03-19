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
      return 'border-[var(--color-success)] bg-[rgba(107,191,115,0.14)] text-[var(--color-text)]';
    case 'warning':
      return 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.14)] text-[var(--color-text)]';
    case 'danger':
      return 'border-[var(--color-danger)] bg-[rgba(231,111,81,0.14)] text-[var(--color-text)]';
    case 'info':
      return 'border-[var(--color-info)] bg-[rgba(107,174,214,0.14)] text-[var(--color-text)]';
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
      <div className="pointer-events-none fixed bottom-4 right-4 z-[140] flex w-[min(92vw,420px)] flex-col gap-3 md:bottom-6 md:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            aria-live="polite"
            className={`pointer-events-auto rounded-md border-2 px-5 py-4 shadow-[8px_8px_0_0_rgba(0,0,0,0.28)] ${toastToneClass(
              toast.tone
            )}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold leading-relaxed">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md border-2 border-[var(--color-line)] bg-transparent px-2.5 py-1 text-xs font-semibold text-current transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
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
