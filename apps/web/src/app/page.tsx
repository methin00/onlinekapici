import Link from 'next/link';
import { MetricCard } from '@/components/ui/metric-card';
import { Smartphone, MonitorPlay, LayoutDashboard, Zap, ShieldCheck, Database, ArrowRight } from 'lucide-react';

const roleCards = [
  {
    href: '/auth?role=tablet&redirect=%2Ftablet',
    title: 'Tablet Karşılama Ekranı',
    description: 'Bina girişinde ziyaretçiyi hızlı, net ve kontrollü bir akışla yöneten terminal deneyimi.',
    cta: 'Terminali Başlat',
    icon: <MonitorPlay className="w-8 h-8 text-amber-500" />
  },
  {
    href: '/auth?role=resident&redirect=%2Fresident',
    title: 'Sakin Mobil Arayüzü',
    description: 'Kapı onayı, ziyaretçi geçmişi ve geçici erişim izinlerini tek ekranda toplayan mobil görünüm.',
    cta: 'Mobil Ekranı Aç',
    icon: <Smartphone className="w-8 h-8 text-blue-400" />
  },
  {
    href: '/auth?role=super_admin&redirect=%2Fdashboard',
    title: 'Yönetim Paneli',
    description: 'Canlı çağrı akışı, bina durumu ve uzaktan müdahale adımlarını aynı operasyon merkezinde birleştirir.',
    cta: 'Paneli Görüntüle',
    icon: <LayoutDashboard className="w-8 h-8 text-emerald-400" />
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--bg-deep)] py-10 md:py-20 px-4 sm:px-8 selection:bg-amber-500/20">
      <div className="mx-auto max-w-[1400px]">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-[40px] border border-white/5 bg-[#0a0a0c] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] px-8 py-16 md:px-16 md:py-24 text-white">
          <div className="absolute inset-0 bg-transparent pointer-events-none" />
          <div className="absolute -top-[500px] -right-[500px] w-[1000px] h-[1000px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-500">Akıllı Bina Teknolojisi</p>
              </div>

              <h1 className="mt-5 max-w-3xl text-5xl font-extrabold tracking-tight md:text-6xl lg:text-7xl leading-[1.1]">
                Dijital <span className="text-amber-500">Karşılama</span><br />Deneyimi
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading- relaxed text-zinc-400">
                Ziyaretçiden sakine, danışmadan kapı kontrolüne kadar tüm akışı tek tasarım diliyle yöneten modern bir operasyon altyapısı. Temiz tipografi, kurumsal renkler ve anlık veri akışı.
              </p>

              <div className="mt-12 flex flex-wrap gap-4">
                {roleCards.map((item) => (
                  <Link
                    href={item.href}
                    key={item.href}
                    className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                  >
                    {item.cta}
                    <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>

              {/* TECH STACK CARDS */}
              <div className="mt-16 grid gap-6 sm:grid-cols-3">
                <div className="glass-card p-6">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Gerçek Zamanlı</p>
                  <p className="text-xl font-bold text-white mb-2">Socket.io</p>
                  <p className="text-xs leading-relaxed text-zinc-400">Çağrı akışı ve operasyon listesi anlık güncellenir.</p>
                </div>
                <div className="glass-card p-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 border border-purple-500/20">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Yetkilendirme</p>
                  <p className="text-xl font-bold text-white mb-2">Güvenli JWT</p>
                  <p className="text-xs leading-relaxed text-zinc-400">Bina bazlı erişim ve tenant izolasyonu aktif.</p>
                </div>
                <div className="glass-card p-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
                    <Database className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Veri Katmanı</p>
                  <p className="text-xl font-bold text-white mb-2">Prisma ORM</p>
                  <p className="text-xs leading-relaxed text-zinc-400">PostgreSQL için hazır çok kiracılı veri modeli.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 lg:pl-10">
              <div className="p-8 rounded-[32px] border border-white/5 bg-black/40 backdrop-blur-sm self-start w-full relative overflow-hidden group">
                <div className="absolute inset-0 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Sistem Metrikleri</p>
                <div className="grid gap-4 relative z-10">
                  <MetricCard label="Danışman Görünümü" value="Canlı İzleme" detail="Bekleyen, düşen ve sonuçlanan çağrılar aynı panelde." />
                  <MetricCard label="Sakin Deneyimi" value="Tek Dokunuş" detail="Kapı açma, reddetme ve erişim üretimi tek ekranda." />
                  <MetricCard label="Giriş Terminali" value="Kiosk Akışı" detail="Büyük butonlar ve sade akış ile ziyaretçi işlemleri." />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MODULES GRID */}
        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {roleCards.map((item) => (
            <Link
              className="glass-card group p-8 flex flex-col justify-between min-h-[320px] transition-all duration-500 hover:border-amber-500/30 hover:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.15)]"
              href={item.href}
              key={item.href}
            >
              <div>
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-amber-500/10 transition-all duration-500">
                  {item.icon}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-3 group-hover:text-amber-500/70 transition-colors">Modül</p>
                <h2 className="text-2xl font-bold tracking-tight text-white mb-4 group-hover:text-amber-400 transition-colors">{item.title}</h2>
                <p className="text-sm leading-relaxed text-zinc-400">{item.description}</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm font-bold text-amber-500 opacity-80 group-hover:opacity-100 group-hover:translate-x-2 transition-all">
                {item.cta}
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
