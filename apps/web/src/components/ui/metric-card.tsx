import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type MetricCardProps = {
  label: string;
  value: string | React.ReactNode;
  detail: string;
  icon?: LucideIcon;
  className?: string;
};

export function MetricCard({ label, value, detail, icon: Icon, className }: MetricCardProps) {
  return (
    <div className={cn("glass-card rounded-[28px] p-6 relative overflow-hidden group", className)}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">{label}</p>
        {Icon && (
          <div className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors">
             <Icon className="w-4 h-4 text-[var(--brand-primary)]" />
          </div>
         )}
      </div>

      <div>
        <p className="mt-1 text-4xl font-heading font-semibold tracking-tight text-white">
          {value}
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{detail}</p>
      </div>
    </div>
  );
}
