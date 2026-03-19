import Link from 'next/link';
import { ArrowRight, Building2, MonitorPlay, ShieldCheck, Smartphone, WavesLadder } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';

const entries = [
  {
    href: '/auth?role=kiosk_device&redirect=%2Ftablet',
    kicker: 'Giriş Terminali',
    title: 'Ziyaret akışını girişte başlatın',
    description: 'Misafir, kurye, teknik servis ve sakin geçişlerini tek ekrandan yönetin.',
    icon: MonitorPlay
  },
  {
    href: '/auth?role=resident&redirect=%2Fresident',
    kicker: 'Sakin',
    title: 'Onay, duyuru ve hizmetler cebinizde',
    description: 'Kapı çağrılarını yönetin, kargoları izleyin ve servis rehberine ulaşın.',
    icon: Smartphone
  },
  {
    href: '/auth?role=manager&redirect=%2Fresident',
    kicker: 'Yönetim',
    title: 'Siteyi tek panelden görün',
    description: 'Bina, daire, aidat, duyuru ve servis kayıtlarını aynı merkezde toplayın.',
    icon: Building2
  }
];

export default function HomePage() {
  return (
    <main className="app-shell min-h-screen px-4 py-8 md:py-12">
      <section className="app-panel overflow-hidden px-6 py-8 md:px-10 md:py-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <BrandLogo size="lg" showTagline />
            <h1 className="mt-6 max-w-4xl font-heading text-4xl font-bold tracking-tight md:text-6xl">
              Girişten yönetime kadar
              <br />
              tüm akış tek sistemde
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              Kiosk, sakin ekranı ve yönetim paneli aynı canlı veri akışı üzerinden çalışır. Kapıda başlayan işlem,
              saniyeler içinde doğru kişiye ulaşır.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/auth?role=resident&redirect=%2Fresident"
                className="app-button px-5 py-4 text-sm uppercase tracking-[0.16em]"
              >
                Sakin ekranını aç
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth?role=manager&redirect=%2Fresident"
                className="app-button-secondary px-5 py-4 text-sm uppercase tracking-[0.16em]"
              >
                Yönetim paneline geç
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="app-card p-5">
              <ShieldCheck className="h-6 w-6 text-[var(--color-accent)]" />
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Canlı onay
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">Anlık karar</p>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Kioskta başlayan çağrı, sakin ekranında anında görünür.
              </p>
            </div>
            <div className="app-card p-5">
              <WavesLadder className="h-6 w-6 text-[var(--color-accent)]" />
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Site görünümü
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">Tek merkez</p>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Yönetici, atandığı sitenin tüm blok ve daire yapısını izler.
              </p>
            </div>
            <div className="app-card p-5 md:col-span-2">
              <p className="app-kicker">Hazır modüller</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border-2 border-[var(--color-line)] px-4 py-4">
                  <p className="font-semibold">Duyurular</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">Yönetim açıklamaları ve operasyon notları</p>
                </div>
                <div className="rounded-md border-2 border-[var(--color-line)] px-4 py-4">
                  <p className="font-semibold">Aidat takibi</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">Kim ödedi, kim bekliyor tek tabloda görünür</p>
                </div>
                <div className="rounded-md border-2 border-[var(--color-line)] px-4 py-4">
                  <p className="font-semibold">Kargo masası</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">Girişte bırakılan paketler anında işlenir</p>
                </div>
                <div className="rounded-md border-2 border-[var(--color-line)] px-4 py-4">
                  <p className="font-semibold">Servis rehberi</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">Sakinler kayıtlı servisçilere doğrudan ulaşır</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link key={entry.href} href={entry.href} className="app-card p-6 transition-transform hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)]">
                <Icon className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                {entry.kicker}
              </p>
              <h2 className="mt-3 font-heading text-2xl font-bold">{entry.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{entry.description}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                İçeri gir
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
