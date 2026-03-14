'use client';

import { useMemo, useState } from 'react';
import { Building2, ChevronRight, DoorOpen, Fingerprint, Package, Search, User, Wrench } from 'lucide-react';
import { appFetch } from '@/lib/api';
import { formatDateTime, guestStatusLabel, guestStatusTone, userRoleLabel } from '@/lib/presenters';
import type { GuestCall, GuestCreateResponse, ResidentsResponse, Resident, VisitorType } from '@/lib/types';
import { useAuth } from '../providers/auth-provider';
import { useToast } from '../providers/toast-provider';
import { StatusPill } from '../ui/status-pill';

const visitorTypeOptions: Array<{
  value: VisitorType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'courier',
    label: 'Kurye / Kargo',
    description: 'Teslimat ve evrak işlemleri',
    icon: <Package className="h-6 w-6 text-amber-500" />
  },
  {
    value: 'guest',
    label: 'Misafir',
    description: 'Bireysel ziyaretler',
    icon: <User className="h-6 w-6 text-blue-400" />
  },
  {
    value: 'other',
    label: 'Diğer',
    description: 'Servis veya teknik ekip',
    icon: <Wrench className="h-6 w-6 text-zinc-400" />
  }
];

const visitorLabelMap: Record<VisitorType, string> = {
  courier: 'Kurye',
  guest: 'Misafir',
  other: 'Diğer Ziyaretçi',
  cargo: 'Kargo'
};

type NoticeState = {
  tone: 'success' | 'warning' | 'danger' | 'info';
  message: string;
} | null;

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatCompactUnitLabel(unitNumber: string) {
  const [blockPart = '', remainder = ''] = unitNumber.split('/');
  const segments = remainder.split('-').filter(Boolean);
  const unitPart = segments.at(-1) ?? unitNumber;

  return `${blockPart || 'D'}+${unitPart}`;
}

export function TabletConsole() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [selectedVisitorType, setSelectedVisitorType] = useState<VisitorType | null>(null);
  const [lastCall, setLastCall] = useState<GuestCall | null>(null);
  const [notificationPreview, setNotificationPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const buildingName = session?.user.building?.name ?? 'Site';
  const apartmentLabel = session?.user.apartment?.label ?? 'Apartman';

  async function handleStart() {
    setStarted(true);

    if (residents.length > 0) {
      return;
    }

    setLoading(true);

    try {
      const residentResponse = await appFetch<ResidentsResponse>('residents/search?query=');
      setResidents(residentResponse.data);
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Tablet verileri yüklenemedi.'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRingBell() {
    if (!selectedResident || !selectedVisitorType) {
      setNotice({
        tone: 'warning',
        message: 'Önce daireyi ve ziyaret türünü seçin.'
      });
      showToast({
        tone: 'warning',
        message: 'Önce daireyi ve ziyaret türünü seçin.'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await appFetch<GuestCreateResponse>('guest-calls', {
        method: 'POST',
        body: {
          residentId: selectedResident.id,
          visitorLabel: visitorLabelMap[selectedVisitorType],
          visitorType: selectedVisitorType
        }
      });

      setLastCall(response.data);
      setNotificationPreview(response.notification.preview);
      setNotice({
        tone: 'success',
        message: `${selectedResident.fullName} için çağrı iletildi.`
      });
      showToast({
        tone: 'success',
        message: `${selectedResident.fullName} için çağrı iletildi.`
      });
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Zil çağrısı iletilemedi.'
      });
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Zil çağrısı iletilemedi.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetSelection() {
    setSearchValue('');
    setSelectedResident(null);
    setSelectedVisitorType(null);
    setLastCall(null);
    setNotificationPreview(null);
    setNotice(null);
  }

  const filteredResidents = useMemo(() => {
    const query = normalizeSearch(searchValue.trim());

    if (!query) {
      return residents;
    }

    return residents.filter((resident) => {
      const searchableResident = `${resident.unitNumber} ${resident.fullName}`;
      return normalizeSearch(searchableResident).includes(query);
    });
  }, [residents, searchValue]);

  return (
    <main className="min-h-screen bg-[var(--bg-deep)] px-4 py-4 text-white selection:bg-amber-500/20 md:px-8 md:py-8">
      <section className="mx-auto max-w-[1400px] overflow-hidden rounded-[40px] border border-white/10 bg-[var(--bg-surface)]">
        <div className="grid min-h-[90vh] lg:grid-cols-[400px_1fr] xl:grid-cols-[480px_1fr]">
          <aside className="relative flex flex-col justify-between overflow-hidden border-r border-white/10 bg-[var(--bg-surface)] px-8 py-10 md:px-12 md:py-14">
            <div className="relative z-10">
              <div className="mb-8 flex items-center gap-3">
                <div className="inline-flex rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                  <Fingerprint className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-500/80">Online Kapıcı</p>
                  <p className="mt-0.5 font-heading text-lg font-bold tracking-tight text-white">Apartman Terminali</p>
                </div>
              </div>

              <h1 className="mt-6 max-w-sm font-heading text-4xl font-bold leading-tight tracking-tight text-white">
                Hızlı karşılama
                <br />
                akışı
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-400">
                Tablet yalnızca giriş yapılan apartmanın sakinlerini gösterir ve ziyaretçi çağrısını doğrudan ilgili daireye iletir.
              </p>
            </div>

            <div className="relative z-10 mt-12">
              {started ? (
                <div className="mb-8 rounded-[24px] border border-white/10 bg-[var(--bg-elevated)] p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-zinc-400" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Apartman Kimliği</p>
                  </div>
                  <p className="font-heading text-xl font-bold tracking-tight text-white">{apartmentLabel}</p>
                  <p className="mt-2 text-sm text-zinc-400">{buildingName}</p>
                </div>
              ) : null}

              {!started ? (
                <div>
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Hazır mısınız?</p>
                  <button
                    className="btn-premium flex w-full items-center justify-center gap-3 rounded-full px-8 py-5 text-base font-bold"
                    onClick={() => void handleStart()}
                    type="button"
                  >
                    Terminali Başlat
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex w-fit items-center gap-3 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <span className="relative flex h-3 w-3">
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Sistem Aktif</span>
                </div>
              )}
            </div>
          </aside>

          <section className="relative flex min-h-[600px] flex-col bg-[var(--bg-deep)] px-6 py-8 md:px-12 md:py-12">
            {!started ? (
              <div className="m-auto flex w-full max-w-lg flex-col items-center justify-center text-center">
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-elevated)]">
                  <DoorOpen className="h-10 w-10 text-zinc-500" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500">Giriş Başlatma</p>
                <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-white">Terminal Beklemede</h2>
                <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-zinc-400">
                  Sol taraftaki düğmeye dokunarak ziyaretçi akışını aktif hale getirebilirsiniz.
                </p>
                {notice ? (
                  <div className="mt-8 rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-6 py-4 text-sm text-rose-400">
                    {notice.message}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full flex-col animate-in fade-in duration-500">
                <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-heading text-4xl font-bold tracking-tight text-white lg:text-5xl">Kimi aramıştınız?</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                      İsim veya daire bilgisi yazarak listedeki sakinleri anında filtreleyin.
                    </p>
                  </div>
                </div>

                <div className="group relative mb-8">
                  <div className="pointer-events-none absolute inset-y-0 left-6 flex items-center group-focus-within:text-amber-500">
                    <Search className="h-6 w-6 text-zinc-500" />
                  </div>
                  <input
                    className="h-20 w-full rounded-[24px] border border-white/10 bg-[var(--bg-elevated)] pl-16 pr-8 text-2xl font-semibold tracking-tight text-white outline-none placeholder:text-zinc-600 transition-all focus:border-amber-500/50"
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="İsim veya daire bilgisi..."
                    value={searchValue}
                  />
                </div>

                {notice ? (
                  <div className="mb-8 rounded-[24px] border border-white/10 bg-[var(--bg-elevated)] p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <p className="text-sm font-medium text-white/90">{notice.message}</p>
                      <StatusPill label="Sistem" tone={notice.tone} />
                    </div>
                  </div>
                ) : null}

                <div className="grid flex-1 gap-6 xl:grid-cols-[1fr_400px]">
                  <div className="glass-panel flex min-h-[500px] flex-col overflow-hidden rounded-[32px] p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Sakin Listesi</p>
                      </div>
                      <StatusPill label={`${filteredResidents.length} Kayıt`} tone="info" />
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                      {loading ? (
                        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/5">
                          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-t-2 border-amber-500" />
                          <p className="text-sm text-zinc-500">Kayıtlar yükleniyor...</p>
                        </div>
                      ) : filteredResidents.length === 0 ? (
                        <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-zinc-500">
                          Aramanıza uygun kayıt bulunamadı.
                        </div>
                      ) : (
                        <ul className="space-y-2 pb-6">
                          {filteredResidents.map((resident) => {
                            const isSelected = resident.id === selectedResident?.id;

                            return (
                              <li key={resident.id}>
                                <button
                                  className={`group flex w-full items-center justify-between rounded-2xl border p-5 text-left transition-all ${
                                    isSelected
                                      ? 'border-amber-500/40 bg-amber-500/10'
                                      : 'border-white/10 bg-[var(--bg-elevated)] hover:border-white/20 hover:bg-[var(--surface-hover)]'
                                  }`}
                                  onClick={() => {
                                    setSelectedResident(resident);
                                    setSelectedVisitorType(null);
                                    setLastCall(null);
                                    setNotificationPreview(null);
                                  }}
                                  type="button"
                                >
                                  <div className="flex items-center gap-5 text-left">
                                    <div
                                      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-heading transition-colors ${
                                        isSelected ? 'bg-amber-500 text-black' : 'bg-white/10 text-white group-hover:bg-white/20'
                                      }`}
                                    >
                                      <span className="mb-0.5 text-[10px] font-bold opacity-70">DAİRE</span>
                                      <span className="max-w-full px-1 text-center text-[11px] font-bold leading-none tracking-tight">
                                        {formatCompactUnitLabel(resident.unitNumber)}
                                      </span>
                                    </div>
                                    <div>
                                      <p className={`text-lg font-bold tracking-tight ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                        {resident.fullName}
                                      </p>
                                      <p className="mt-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                                        <span>{userRoleLabel(resident.role)}</span>
                                        {resident.unitCode ? (
                                          <>
                                            <span className="h-1 w-1 rounded-full bg-zinc-700" />
                                            <span className="font-mono tracking-widest text-zinc-400">{resident.unitCode}</span>
                                          </>
                                        ) : null}
                                      </p>
                                    </div>
                                  </div>
                                  {isSelected ? <div className="h-2.5 w-2.5 rounded-full bg-amber-500" /> : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="glass-panel relative overflow-hidden rounded-[32px] p-6">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Hedef Daire</p>
                      <p className="font-heading text-2xl font-bold tracking-tight text-white xl:text-3xl">
                        {selectedResident ? (
                          <>
                            <span className="text-amber-400">{formatCompactUnitLabel(selectedResident.unitNumber)}</span>
                            <br />
                            {selectedResident.fullName}
                          </>
                        ) : (
                          'Seçim Bekleniyor'
                        )}
                      </p>
                    </div>

                    <div className="glass-panel flex flex-1 flex-col rounded-[32px] p-6">
                      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Ziyaret Tipi</p>
                      <div className="grid flex-1 content-start gap-3">
                        {visitorTypeOptions.map((option) => {
                          const isSelected = selectedVisitorType === option.value;

                          return (
                            <button
                              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                                isSelected
                                  ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30'
                                  : 'border-white/10 bg-[var(--bg-elevated)] hover:border-white/20 hover:bg-[var(--surface-hover)]'
                              }`}
                              disabled={!selectedResident}
                              key={option.value}
                              onClick={() => {
                                setSelectedVisitorType(option.value);
                                setLastCall(null);
                                setNotificationPreview(null);
                              }}
                              type="button"
                            >
                              <div className={`rounded-xl p-3 ${isSelected ? 'bg-amber-500/20' : 'bg-white/5'}`}>{option.icon}</div>
                              <div>
                                <p className={`text-lg font-bold tracking-tight ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                  {option.label}
                                </p>
                                <p className="mt-0.5 text-xs text-zinc-500">{option.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedResident && selectedVisitorType ? (
                        <div className="mt-8">
                          <button
                            className="btn-premium flex h-[88px] w-full items-center justify-between rounded-[24px] px-6 text-xl font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={submitting}
                            onClick={() => void handleRingBell()}
                            type="button"
                          >
                            <div className="flex flex-col items-start gap-1">
                              <span>{submitting ? 'İletiliyor...' : 'Zili Çal'}</span>
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-black/60">Anında Bildirim</span>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                              <ChevronRight className="h-6 w-6 text-black" />
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-xs text-zinc-500">
                          Devam etmek için daire ve ziyaret türü seçin.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {lastCall ? (
                  <div className="relative mt-6 overflow-hidden rounded-[32px] border border-cyan-500/30 bg-cyan-500/10 p-6">
                    <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                          <p className="text-lg font-bold tracking-tight text-cyan-400">Çağrı iletildi</p>
                        </div>
                        <p className="max-w-xl text-sm leading-relaxed text-zinc-300">
                          <strong className="text-white">{lastCall.residentName}</strong> için{' '}
                          <strong className="text-white">{guestStatusLabel(lastCall.status)}</strong> kaydı oluşturuldu.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <StatusPill label={guestStatusLabel(lastCall.status)} tone={guestStatusTone(lastCall.status)} />
                          <span className="rounded-full border border-white/10 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-zinc-500">
                            {formatDateTime(lastCall.createdAt)}
                          </span>
                        </div>
                        {notificationPreview ? (
                          <p className="mt-4 rounded-xl border border-white/10 bg-[var(--bg-elevated)] p-3 font-mono text-xs text-cyan-200/70">
                            Giden: {notificationPreview}
                          </p>
                        ) : null}
                      </div>

                      <button
                        className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/20 md:self-auto"
                        onClick={resetSelection}
                        type="button"
                      >
                        Yeni İşlem Başlat
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
