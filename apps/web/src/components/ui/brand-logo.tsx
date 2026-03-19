type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
};

const sizeStyles = {
  sm: {
    frame: 'h-12 w-12 rounded-[14px]',
    icon: 'h-7 w-7',
    title: 'text-xl',
    subtitle: 'text-[10px]'
  },
  md: {
    frame: 'h-14 w-14 rounded-[16px]',
    icon: 'h-8 w-8',
    title: 'text-2xl',
    subtitle: 'text-[11px]'
  },
  lg: {
    frame: 'h-16 w-16 rounded-[18px]',
    icon: 'h-9 w-9',
    title: 'text-3xl',
    subtitle: 'text-xs'
  }
} as const;

export function BrandLogo({ size = 'md', showTagline = false, className = '' }: BrandLogoProps) {
  const styles = sizeStyles[size];

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div
        className={`relative flex shrink-0 items-center justify-center border-2 border-[var(--color-accent)] bg-[linear-gradient(135deg,rgba(212,163,115,0.2),rgba(212,163,115,0.05))] ${styles.frame}`}
      >
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className={`${styles.icon} text-[var(--color-accent)]`}
          fill="none"
        >
          <rect x="12" y="8" width="24" height="32" rx="8" stroke="currentColor" strokeWidth="2.4" />
          <path d="M18 40V17.5C18 14.46 20.46 12 23.5 12H30" stroke="currentColor" strokeWidth="2.4" />
          <path d="M29.5 22.5H22.5V40" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="27.2" cy="26.8" r="1.9" fill="currentColor" />
        </svg>
      </div>

      <div className="min-w-0">
        <p className={`font-heading font-bold leading-none tracking-tight text-[var(--color-text)] ${styles.title}`}>
          Online Kapıcı
        </p>
        <p
          className={`mt-1 font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] ${styles.subtitle}`}
        >
          {showTagline ? 'Site giriş ve yönetim sistemi' : 'Dijital site akışı'}
        </p>
      </div>
    </div>
  );
}
