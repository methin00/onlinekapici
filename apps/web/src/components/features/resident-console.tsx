'use client';

import { useEffect, useMemo, useState } from 'react';
import { appFetch } from '@/lib/api';
import {
  activityTone,
  formatDateTime,
  guestStatusLabel,
  guestStatusTone,
  visitorTypeLabel
} from '@/lib/presenters';
import type { GuestDecisionResponse, ResidentOverview, ResidentOverviewResponse } from '@/lib/types';
import { StatusPill } from '../ui/status-pill';
import { UnlockSlider } from '../ui/unlock-slider';
import { ShieldCheck, History, PhoneForwarded, UserCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../providers/auth-provider';
import { useToast } from '../providers/toast-provider';

type NoticeState = {
  tone: 'success' | 'warning' | 'danger' | 'info';
  message: string;
} | null;

export function ResidentConsole() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const residentId = session?.user.id ?? '';
  const [overview, setOverview] = useState<ResidentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!residentId) {
      return;
    }

    void loadOverview(residentId);

    const interval = window.setInterval(() => {
      void loadOverview(residentId, false);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [residentId]);

  async function loadOverview(targetResidentId: string, showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    }

    try {
      const response = await appFetch<ResidentOverviewResponse>(`residents/${targetResidentId}/overview`);
      setOverview(response.data);
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Sakin verileri alınamadı.'
      });
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }

  async function handleDecision(decision: 'approved' | 'rejected') {
    const activeCall = overview?.waitingCalls[0];

    if (!activeCall) {
      setNotice({
        tone: 'warning',
        message: 'Şu anda bekleyen bir ziyaret çağrısı bulunmuyor.'
      });
      showToast({
        tone: 'warning',
        message: 'Şu anda bekleyen bir ziyaret çağrısı bulunmuyor.'
      });
      return;
    }

    setActionLoading(true);

    try {
      const response = await appFetch<GuestDecisionResponse>(`guest-calls/${activeCall.id}/decision`, {
        method: 'POST',
        body: {
          decision
        }
      });

      setNotice({
        tone: decision === 'approved' ? 'success' : 'info',
        message:
          decision === 'approved'
            ? `Kapı açma komutu başarıyla iletildi (${response.door?.mode ?? 'simulated'}).`
            : 'Çağrı danışma ekibine yönlendirildi.'
      });
      showToast({
        tone: decision === 'approved' ? 'success' : 'info',
        message:
          decision === 'approved'
            ? `Kapı açma komutu başarıyla iletildi (${response.door?.mode ?? 'simulated'}).`
            : 'Çağrı danışma ekibine yönlendirildi.'
      });
      await loadOverview(residentId);
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Karar kaydedilemedi.'
      });
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Karar kaydedilemedi.'
      });
    } finally {
      setActionLoading(false);
    }
  }

  const activeCall = overview?.waitingCalls[0] ?? null;
  const selectedResident = useMemo(() => overview?.resident ?? null, [overview?.resident]);

  return (
    <main className="min-h-screen bg-[var(--bg-deep)] px-4 py-6 text-white md:py-12 selection:bg-amber-500/20">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-6">
        <section className="glass-panel overflow-hidden rounded-[40px]">
          <div className="flex min-h-[680px] flex-col p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-amber-500" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500/90">Sakin Kontrolü</p>
                </div>
                <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight text-white">
                  Kapı Kararı
                </h1>
                <p className="text-sm text-zinc-400">{selectedResident?.fullName ?? 'Sakin bilgisi hazırlanıyor...'}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-[var(--bg-elevated)] px-4 py-2.5 text-right text-sm font-medium text-white">
                <p>{selectedResident?.unitNumber ?? 'Daire'}</p>
                {selectedResident?.unitCode ? <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{selectedResident.unitCode}</p> : null}
              </div>
            </div>

            {notice ? (
              <div className="mt-6 rounded-[20px] border border-white/10 bg-[var(--bg-elevated)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white/90">{notice.message}</p>
                  <StatusPill label="Sistem" tone={notice.tone} />
                </div>
              </div>
            ) : null}

            <div className="mt-auto pt-10">
              {loading ? (
                <div className="rounded-[32px] border border-white/10 bg-[var(--bg-elevated)] p-8 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-t-2 border-amber-500" />
                  <p className="font-heading text-2xl font-bold tracking-tight text-white">Bekleniyor...</p>
                  <p className="mt-2 text-sm text-white/50">Sakin verileri güncelleniyor.</p>
                </div>
              ) : activeCall ? (
                <div className="space-y-4">
                  <div className="rounded-[32px] border border-white/10 bg-[var(--bg-surface)] p-6">
                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Canlı Bildirim</p>
                        </div>
                        <h2 className="font-heading text-4xl font-bold tracking-tight text-white">
                          {activeCall.visitorLabel}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                          <span className="font-medium text-white">{activeCall.residentName}</span> için kapıda bekliyor.
                          Ziyaret tipi:{' '}
                          <span className="text-amber-300">{visitorTypeLabel(activeCall.visitorType).toLocaleLowerCase('tr-TR')}</span>.
                        </p>
                      </div>
                      <StatusPill label={guestStatusLabel(activeCall.status)} tone={guestStatusTone(activeCall.status)} />
                    </div>

                    <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/10 px-3 py-1.5 text-xs font-medium">
                        <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                        {selectedResident ? (
                          <>
                            Konum {selectedResident.unitNumber}
                            {selectedResident.unitCode ? (
                              <>
                                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                                <span className="font-mono text-amber-500">{selectedResident.unitCode}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          'Sakin Yok'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-amber-500/20 bg-amber-500/8 p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-amber-500" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Güvenli Açılış</p>
                    </div>

                    <UnlockSlider
                      disabled={!activeCall || actionLoading}
                      hint="Kapı açılacaktır"
                      label={actionLoading ? 'İşleniyor...' : 'Açmak İçin Kaydır'}
                      loading={actionLoading}
                      onComplete={() => handleDecision('approved')}
                      resetKey={`${residentId}-${activeCall.id}`}
                    />

                    <button
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition-all hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={actionLoading}
                      onClick={() => void handleDecision('rejected')}
                      type="button"
                    >
                      <PhoneForwarded className="h-4 w-4" />
                      Danışmaya Yönlendir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[32px] border border-white/10 bg-[var(--bg-elevated)] p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-surface)]">
                    <ShieldCheck className="mb-1 h-8 w-8 text-zinc-500" />
                  </div>
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-white">Bekleyen Çağrı Yok</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Şu anda bekleyen ziyaret bulunmuyor. Yeni çağrı geldiğinde burada belirecektir.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-[var(--bg-elevated)] p-2.5">
                <History className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">Hareket Geçmişi</p>
                <h2 className="mt-1 font-heading text-xl font-bold tracking-tight text-white">Son Kayıtlar</h2>
              </div>
            </div>
            <StatusPill label={`${overview?.activityLogs.length ?? 0} Kayıt`} tone="neutral" />
          </div>

          <div className="space-y-4">
            {overview?.activityLogs.length ? (
              overview.activityLogs.map((log) => (
                <div
                  className="glass-card flex flex-col justify-between gap-4 rounded-[24px] px-5 py-4 sm:flex-row sm:items-center"
                  key={log.id}
                >
                  <div>
                    <p className="text-lg font-bold tracking-tight text-white">{log.visitorLabel}</p>
                    <p className="mt-1 text-sm text-zinc-400">{log.summary}</p>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                  <div className="self-start sm:self-center">
                    <StatusPill label="Kayıt" tone={activityTone(log.type)} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-zinc-500">
                Görüntülenecek bir işlem kaydı bulunmuyor.
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}
