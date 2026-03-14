import type { PropsWithChildren, ReactNode } from 'react';

type PanelProps = PropsWithChildren<{
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  id?: string;
}>;

export function Panel({ title, description, action, className = '', children, id }: PanelProps) {
  return (
    <section
      id={id}
      className={`glass-panel p-6 ${className}`}
    >
      {(title || description || action) && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2> : null}
            {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
