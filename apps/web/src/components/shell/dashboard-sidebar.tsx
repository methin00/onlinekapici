const items = [
  { href: '#overview', label: 'Genel Bakış' },
  { href: '#live-calls', label: 'Canlı Operasyon' },
  { href: '#camera', label: 'Kamera Akışı' },
  { href: '#buildings', label: 'Bina Durumu' },
  { href: '#actions', label: 'Operasyon Notları' }
];

export function DashboardSidebar() {
  return (
    <aside className="flex min-h-full w-full max-w-72 flex-col rounded-[32px] border border-slate-800/80 bg-slate-950 p-6 text-slate-100 shadow-[0_32px_90px_-48px_rgba(15,23,42,0.75)]">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Online Kapıcı</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Danışman Operasyon Paneli</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Bina giriş akışını, bekleyen onayları ve uzaktan müdahale işlemlerini tek panelden yönetin.
        </p>
      </div>

      <nav className="mt-8 space-y-2">
        {items.map((item, index) => (
          <a
            className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
              index === 0 ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="mt-auto rounded-[24px] border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Aktif Bina</p>
        <p className="mt-2 text-lg font-semibold text-white">Online Kapıcı Residence</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Bina bazlı ayrıştırma aktif. Yetkisiz erişim katman bazında engellenir.
        </p>
      </div>
    </aside>
  );
}
