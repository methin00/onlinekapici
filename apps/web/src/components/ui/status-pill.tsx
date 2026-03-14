import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type StatusPillProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
};

const toneClasses: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'border-white/10 bg-white/5 text-zinc-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-500'
};

const dotClasses: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'bg-zinc-400/80',
  success: 'bg-emerald-400',
  warning: 'bg-amber-500',
  danger: 'bg-rose-400',
  info: 'bg-cyan-500'
};

export function StatusPill({ label, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-300",
        toneClasses[tone],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full inline-block", dotClasses[tone])} />
      {label}
    </span>
  );
}
