'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { appFetch } from '@/lib/api';
import { formatDateTime, guestStatusLabel, visitorTypeLabel } from '@/lib/presenters';
import type {
  AdminOverviewResponse,
  AdminUsersResponse,
  Building,
  BuildingDetail,
  BuildingDetailResponse,
  BuildingDirectoryResponse,
  GuestCall,
  GuestStatus,
  Province
} from '@/lib/types';
import { StatusPill } from '../ui/status-pill';
import { Activity, Building2, Camera, Clock, KeySquare, PhoneCall, RefreshCw, ShieldAlert, Users, PhoneForwarded } from 'lucide-react';
import { MetricCard } from '../ui/metric-card';
import { SiteCreationPanel } from './site-creation-panel';
import { BuildingDirectoryPanel } from './building-directory-panel';
import { AdminUserDirectoryPanel } from './admin-user-directory-panel';
import { useAuth } from '../providers/auth-provider';
import { useToast } from '../providers/toast-provider';

type NoticeState = {
  tone: 'success' | 'warning' | 'danger' | 'info';
  message: string;
} | null;

function timelineDotClass(status: GuestStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]';
    case 'rejected':
      return 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.5)]';
    case 'escalated':
      return 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.5)]';
    case 'waiting':
      return 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]';
  }
}

function statusCardClass(status: GuestStatus) {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/20 bg-emerald-500/10 shadow-[inset_0_0_40px_rgba(16,185,129,0.05)]';
    case 'rejected':
      return 'border-rose-500/20 bg-rose-500/10 shadow-[inset_0_0_40px_rgba(244,63,94,0.05)]';
    case 'escalated':
      return 'border-sky-500/20 bg-sky-500/10 shadow-[inset_0_0_40px_rgba(14,165,233,0.05)]';
    case 'waiting':
      return 'border-amber-500/20 bg-amber-500/10 shadow-[inset_0_0_40px_rgba(245,158,11,0.05)]';
  }
}

export function DashboardConsole() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const isSuperAdmin = session?.user.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'sites' | 'add-site' | 'users'>('dashboard');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [directoryBuildings, setDirectoryBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingDetail | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [accountDirectory, setAccountDirectory] = useState<AdminUsersResponse>({
    superAdmins: [],
    concierges: []
  });
  const [loading, setLoading] = useState(true);
  const [actionCallId, setActionCallId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [cameraTick, setCameraTick] = useState(() => new Date().toISOString());

  useEffect(() => {
    void loadOverview();

    const interval = window.setInterval(() => {
      void loadOverview(false);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedBuildingId) {
      if (!selectedBuildingId) {
        setSelectedBuilding(null);
      }
      return;
    }

    void loadBuildingDetail(selectedBuildingId);
  }, [isSuperAdmin, selectedBuildingId]);

  async function loadOverview(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    }

    try {
      const [overviewData, locationsData, buildingsData, usersData] = await Promise.all([
        appFetch<AdminOverviewResponse>('admin/overview'),
        isSuperAdmin ? appFetch<Province[]>('admin/locations').catch(() => []) : Promise.resolve([]),
        isSuperAdmin
          ? appFetch<BuildingDirectoryResponse>('admin/buildings').catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        isSuperAdmin
          ? appFetch<AdminUsersResponse>('admin/users').catch(() => ({ superAdmins: [], concierges: [] }))
          : Promise.resolve({ superAdmins: [], concierges: [] })
      ]);

      setOverview(overviewData);
      setProvinces(locationsData);
      setDirectoryBuildings(buildingsData.data);
      setAccountDirectory(usersData);
      setSelectedBuildingId((currentValue) => {
        if (currentValue && buildingsData.data.some((building) => building.id === currentValue)) {
          return currentValue;
        }

        return buildingsData.data[0]?.id ?? null;
      });
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Panel verileri alınamadı.'
      });
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }

  async function loadBuildingDetail(buildingId: string) {
    setDirectoryLoading(true);

    try {
      const response = await appFetch<BuildingDetailResponse>(`admin/buildings/${buildingId}`);
      setSelectedBuilding(response.data);
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Site detayları alınamadı.'
      });
    } finally {
      setDirectoryLoading(false);
    }
  }

  async function handleManualOpen(callId: string) {
    setActionCallId(callId);

    try {
      const response = await appFetch<{ data: GuestCall; door: { ok: boolean; mode: 'http' | 'simulated' } }>(
        `admin/calls/${callId}/manual-open`,
        {
          method: 'POST'
        }
      );

      showToast({
        tone: 'success',
        message: `Kapı açma komutu başarıyla iletildi (${response.door.mode}).`
      });
      await loadOverview(false);
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Kapı açma komutu gönderilemedi.'
      });
    } finally {
      setActionCallId(null);
    }
  }

  async function handleConnect(callId: string) {
    setActionCallId(callId);

    try {
      await appFetch<{ data: GuestCall }>(`admin/calls/${callId}/connect`, {
        method: 'POST'
      });

      showToast({
        tone: 'info',
        message: 'Çağrı danışman görüşmesine aktarıldı.'
      });
      await loadOverview(false);
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Danışman aksiyonu tamamlanamadı.'
      });
    } finally {
      setActionCallId(null);
    }
  }

  const calls = overview?.latestCalls ?? [];
  const fallbackCalls = overview?.fallbackCalls ?? [];
  const buildings = overview?.buildings ?? [];
  const featuredBuilding = useMemo(
    () => buildings.find((building) => building.status === 'ONLINE') ?? buildings[0] ?? null,
    [buildings]
  );
  const cameraPreviewCall = useMemo(
    () => calls.find((call) => call.imageUrl) ?? fallbackCalls.find((call) => call.imageUrl) ?? null,
    [calls, fallbackCalls]
  );
  const cameraPreviewBuilding = useMemo(() => {
    if (!cameraPreviewCall) {
      return featuredBuilding;
    }

    return buildings.find((building) => building.id === cameraPreviewCall.buildingId) ?? featuredBuilding;
  }, [buildings, cameraPreviewCall, featuredBuilding]);

  return (
    <main className="min-h-screen bg-[var(--bg-deep)] text-white selection:bg-cyan-500/20">
      <div className="app-shell py-8 md:py-12">
        <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">

          {/* SIDEBAR */}
          <aside className="glass-panel rounded-[32px] p-8 flex flex-col gap-8 h-fit sticky top-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <h1 className="font-heading text-4xl font-bold tracking-tight text-white mb-6">
                {isSuperAdmin ? 'Sistem Yönetimi' : 'Operasyon Merkezi'}
              </h1>

              {isSuperAdmin && (
                <div className="flex flex-col gap-2 border-y border-white/10 py-6 mb-4">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`text-left px-5 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'dashboard' ? 'border border-cyan-700/20 bg-cyan-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Canlı İzleme
                  </button>
                  <button
                    onClick={() => setActiveTab('sites')}
                    className={`text-left px-5 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'sites' ? 'border border-stone-700/20 bg-[var(--text-primary)] text-[var(--bg-surface)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Siteler, Apartmanlar ve Daireler
                  </button>
                  <button
                    onClick={() => setActiveTab('add-site')}
                    className={`text-left px-5 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'add-site' ? 'border border-amber-700/20 bg-amber-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Yeni Site Ekle
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`text-left px-5 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'users' ? 'border border-emerald-700/20 bg-emerald-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Kullanıcı / Danışman Yönetimi
                  </button>
                </div>
              )}

              <p className="text-sm leading-relaxed text-zinc-400">
                {isSuperAdmin
                  ? 'Tüm bağlı lokasyonları ve kullanıcı yetkilerini yönetin.'
                  : 'Gece odaklı panel. Binalar, çağrılar ve manuel müdahaleler tek akışta izlenir.'}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-zinc-500" /> Bağlı Lokasyonlar
              </h3>
              {buildings.length ? (
                buildings.map((building) => (
                  <div
                    className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-white/5 px-5 py-5 pl-10 transition-all hover:bg-white/10 hover:border-white/10"
                    key={building.id}
                  >
                    <span
                      className={`absolute bottom-5 left-4 top-5 w-[3px] rounded-full shadow-[0_0_12px_currentColor] ${building.status === 'ONLINE' ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-400 text-rose-400'
                        }`}
                    />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-heading text-xl font-semibold tracking-tight text-white group-hover:text-cyan-300 transition-colors">{building.name}</p>
                        <StatusPill
                          label={building.status === 'ONLINE' ? 'Online' : 'Offline'}
                          tone={building.status === 'ONLINE' ? 'success' : 'danger'}
                        />
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-400">{building.district?.name ?? 'İlçe bilgisi yok'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-zinc-500">
                  Bina verisi bulunmuyor.
                </div>
              )}
            </div>

            <div className="rounded-[24px] glass-card p-6 mt-auto">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                <ShieldAlert className="w-3 h-3 text-amber-500" /> Aktif Odak
              </p>
              <p className="font-heading mt-3 text-2xl font-bold tracking-tight text-white">
                {featuredBuilding?.name ?? 'Atanmış bina yok'}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                Tüm çağrılar bina kimliği ile ayrıştırılır. Yetkili kullanıcı yalnızca kendi kapsamındaki kayıtları görür.
              </p>
            </div>
          </aside>

          {/* MAIN SECTION */}
          <section className="space-y-8 min-w-0">
            {activeTab === 'dashboard' ? (
              <>
                {/* HEADER AREA */}
                <header className="glass-panel rounded-[32px] px-8 py-8">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Canlı Operasyon</p>
                      </div>
                      <h2 className="font-heading text-4xl font-bold tracking-tight text-white lg:text-5xl lg:leading-[1.1]">
                        Kapı Akışı ve <br /><span className="text-[var(--brand-primary)]">Danışma Müdahalesi</span>
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-zinc-400 max-w-xl">
                        Bekleyen çağrılar, düşen talepler ve kamera görüntüsü aynı yüzeyde tutulur. Böylece danışman
                        aksiyonu gecikmeden alınır.
                      </p>
                    </div>
                    <button
                      className="btn-surface rounded-full px-6 py-3.5 text-sm font-semibold flex items-center gap-2 group"
                      onClick={() => {
                        setCameraTick(new Date().toISOString());
                        void loadOverview(false);
                      }}
                      type="button"
                    >
                      <RefreshCw className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors group-hover:rotate-180 duration-500" />
                      Görünümü Yenile
                    </button>
                  </div>

                  {notice ? (
                    <div className="mt-6 rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white/90">{notice.message}</p>
                        <StatusPill label="Sistem" tone={notice.tone} />
                      </div>
                    </div>
                  ) : null}
                </header>

                {/* METRICS */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Bağlı Bina"
                    value={overview?.metrics.totalBuildings ?? 0}
                    detail={`${overview?.metrics.onlineBuildings ?? 0} bina şu anda çevrimiçi.`}
                    icon={Building2}
                  />
                  <MetricCard
                    label="Bekleyen"
                    value={overview?.metrics.waitingCalls ?? 0}
                    detail="Sakin kararını bekleyen aktif talepler."
                    icon={Clock}
                  />
                  <MetricCard
                    label="Düşen Çağrı"
                    value={overview?.metrics.droppedCalls ?? 0}
                    detail="Red veya zaman aşımı sonrası."
                    icon={PhoneForwarded}
                  />
                  <MetricCard
                    label="Onay Oranı"
                    value={`${overview?.metrics.approvalRate ?? 0}%`}
                    detail="Karara bağlanan çağrıların onay payı."
                    icon={Activity}
                  />
                </div>

                {/* SPLIT VIEWS */}
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* TIMELINE */}
                  <section className="glass-panel rounded-[32px] p-8 flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between gap-3 mb-8">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                          <Clock className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">Zaman Çizgisi</p>
                          <h3 className="font-heading mt-1 text-2xl font-bold tracking-tight text-white">Operasyon Akışı</h3>
                        </div>
                      </div>
                      <StatusPill label={`${calls.length} Olay`} tone="neutral" />
                    </div>

                    <div className="flex-1 space-y-6">
                      {loading ? (
                        <div className="h-full rounded-[24px] border border-dashed border-white/10 flex items-center justify-center text-sm text-zinc-500">
                          Operasyon akışı yükleniyor...
                        </div>
                      ) : calls.length ? (
                        calls.map((call, index) => {
                          const callBuilding = buildings.find((building) => building.id === call.buildingId);

                          return (
                            <div className="relative pl-10" key={call.id}>
                              {index < calls.length - 1 ? (
                                <span className="absolute left-[11px] top-6 h-[calc(100%+8px)] w-[2px] bg-white/10" />
                              ) : null}
                              <span className={`absolute left-0 top-3 h-6 w-6 rounded-full border-4 border-[var(--bg-deep)] ${timelineDotClass(call.status)}`} />

                              <div className={`rounded-[24px] border p-5 transition-all hover:scale-[1.01] ${statusCardClass(call.status)}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-3">
                                    <h4 className="font-heading text-xl font-bold tracking-tight text-white">
                                      {call.visitorLabel}
                                    </h4>
                                  </div>
                                  <StatusPill label={guestStatusLabel(call.status)} tone={call.status === 'approved' ? 'success' : call.status === 'rejected' ? 'danger' : call.status === 'escalated' ? 'info' : 'warning'} />
                                </div>
                                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
                                  <Building2 className="w-4 h-4 text-zinc-500" />
                                  <span>{callBuilding?.name ?? 'Bilinmeyen Site'}</span>
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-black/20 px-4 py-2 text-sm text-zinc-400">
                                  <span className="flex items-center gap-1.5 font-medium"><Users className="w-3.5 h-3.5" />Konum {call.unitNumber}</span>
                                  <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                  <span>{call.residentName}</span>
                                  <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                  <span className="text-zinc-300 font-medium">{visitorTypeLabel(call.visitorType)}</span>
                                </div>
                                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                  {formatDateTime(call.decidedAt ?? call.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-full rounded-[24px] border border-dashed border-white/10 flex items-center justify-center text-sm text-zinc-500 p-8 text-center">
                          Görüntülenecek çağrı bulunmuyor.
                        </div>
                      )}
                    </div>
                  </section>

                  {/* RIGHT COLUMN */}
                  <div className="flex flex-col gap-8">
                    {/* CAMERA STREAM */}
                    <section className="glass-panel overflow-hidden rounded-[32px] p-2">
                      <div className="px-6 py-6 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <Camera className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">Kamera Akışı</p>
                            <h3 className="font-heading mt-1 text-xl font-bold tracking-tight text-white">Lobi Görüntüsü</h3>
                          </div>
                        </div>
                        <StatusPill label="720p LIVE" tone="success" />
                      </div>

                      {cameraPreviewCall?.imageUrl ? (
                        <div className="relative mx-2 mb-2 overflow-hidden rounded-[24px] border border-white/10 bg-black">
                          <Image
                            alt="Kapı kamerası ön izlemesi"
                            className="h-[280px] w-full object-cover"
                            height={280}
                            src={cameraPreviewCall.imageUrl}
                            width={1200}
                          />
                          <div className="absolute left-4 top-4 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                            Canlı Ön İzleme
                          </div>
                          <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              REC
                            </span>
                            <span className="rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white">
                              {formatDateTime(cameraTick)}
                            </span>
                          </div>
                          <div className="absolute bottom-4 right-4 rounded-2xl bg-black/75 px-4 py-3 text-right text-white">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Site</p>
                            <p className="mt-1 text-sm font-semibold">{cameraPreviewBuilding?.name ?? 'Bilinmeyen Site'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mx-2 mb-2 flex h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-[var(--bg-elevated)] px-6 text-center">
                          <Camera className="h-10 w-10 text-zinc-500" />
                          <p className="mt-4 text-base font-semibold text-white">Canlı ön izleme bekleniyor</p>
                          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                            Yeni ziyaret kaydı geldiğinde kamera görüntüsü burada gösterilecektir.
                          </p>
                        </div>
                      )}
                    </section>

                    {/* FALLBACK CALLS */}
                    <section className="glass-panel rounded-[32px] p-8 flex-1">
                      <div className="flex items-center justify-between gap-3 mb-6">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <PhoneCall className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/80">Düşen Çağrılar</p>
                            <h3 className="font-heading mt-1 text-xl font-bold tracking-tight text-white">Danışma Kuyruğu</h3>
                          </div>
                        </div>
                        <StatusPill label={`${fallbackCalls.length} Bekleyen`} tone="info" />
                      </div>

                      <div className="space-y-3">
                        {fallbackCalls.length ? (
                          fallbackCalls.map((call) => {
                            const callBuilding = buildings.find(b => b.id === call.buildingId);

                            return (
                              <div
                                className="group rounded-[20px] border border-white/5 bg-white-[0.02] hover:bg-white/5 px-5 py-4 transition-colors"
                                key={call.id}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-white tracking-tight">{call.visitorLabel}</p>
                                    <p className="mt-1 text-xs text-zinc-400 flex items-center gap-2">
                                      <Building2 className="w-3 h-3" />
                                      <span className="text-zinc-300">{callBuilding?.name ?? 'Bilinmeyen Site'}</span>
                                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                      Konum {call.unitNumber}
                                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                      {call.residentName}
                                    </p>
                                  </div>
                                  <StatusPill label={guestStatusLabel(call.status)} tone={call.status === 'rejected' ? 'danger' : 'info'} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-[20px] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-zinc-500">
                            Şu anda danışmaya düşen çağrı bulunmuyor.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>

                {/* ACTION CARDS (Anlık Müdahale) */}
                <section className="glass-panel rounded-[32px] p-8 mt-8">
                  <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                        <KeySquare className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">Anlık Müdahale</p>
                        <h3 className="font-heading mt-1 text-2xl font-bold tracking-tight text-white">Operasyon Kartları</h3>
                      </div>
                    </div>
                    <StatusPill label={`${calls.length} Aktif Akış`} tone="warning" />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2 relative z-10">
                    {loading ? (
                      <div className="col-span-full rounded-[24px] border border-dashed border-white/10 px-6 py-12 text-center text-sm text-zinc-500">
                        Operasyon kartları yükleniyor...
                      </div>
                    ) : calls.length ? (
                      calls.map((call) => (
                        <div className={`rounded-[28px] border p-6 flex flex-col justify-between gap-6 transition-all hover:-translate-y-1 ${statusCardClass(call.status)}`} key={call.id}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h4 className="font-heading text-2xl font-bold tracking-tight text-white">
                                  {call.visitorLabel}
                                </h4>
                                <span className="px-2 py-1 rounded bg-white/10 text-xs font-medium text-zinc-300">
                                  {visitorTypeLabel(call.visitorType)}
                                </span>
                              </div>
                              {(() => {
                                const callBuilding = buildings.find(b => b.id === call.buildingId);
                                return (
                                  <p className="text-sm leading-relaxed text-zinc-400 flex flex-wrap items-center gap-2">
                                    <Building2 className="w-4 h-4 text-zinc-500 shrink-0" />
                                    <span className="text-zinc-300">{callBuilding?.name ?? 'Bilinmeyen Site'}</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                    Konum {call.unitNumber}
                                    <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                    {call.residentName}
                                  </p>
                                );
                              })()}
                            </div>
                            <StatusPill
                              label={guestStatusLabel(call.status)}
                              tone={
                                call.status === 'approved'
                                  ? 'success'
                                  : call.status === 'rejected'
                                    ? 'danger'
                                    : call.status === 'escalated'
                                      ? 'info'
                                      : 'warning'
                              }
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
                            <button
                              className="flex-1 min-w-[180px] btn-premium rounded-xl px-5 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale transition-all"
                              disabled={actionCallId === call.id}
                              onClick={() => void handleManualOpen(call.id)}
                              type="button"
                            >
                              <KeySquare className="w-4 h-4" />
                              {actionCallId === call.id ? 'İşleniyor...' : 'Kapıyı Uzaktan Aç'}
                            </button>
                            <button
                              className="flex-1 min-w-[180px] btn-surface rounded-xl px-5 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30"
                              disabled={actionCallId === call.id}
                              onClick={() => void handleConnect(call.id)}
                              type="button"
                            >
                              <PhoneCall className="w-4 h-4" />
                              Görüşmeyi Devral
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-[24px] border border-dashed border-white/10 px-6 py-12 text-center text-sm text-zinc-500">
                        Müdahale gerektiren aktif çağrı bulunmuyor.
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : activeTab === 'sites' ? (
              <>
                <header className="glass-panel rounded-[32px] px-8 py-8">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-[var(--text-primary)]" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">Operasyon Haritası</p>
                    </div>
                    <h2 className="font-heading text-4xl font-bold tracking-tight text-white">Site, apartman ve daire listesi</h2>
                    <p className="mt-4 text-base leading-relaxed text-zinc-400 max-w-xl">
                      Tüm siteleri, blok yapılarını, apartman tablet girişlerini ve daire doluluk durumunu tek ekrandan inceleyin.
                    </p>
                  </div>
                </header>

                <BuildingDirectoryPanel
                  buildings={directoryBuildings}
                  selectedBuildingId={selectedBuildingId}
                  selectedBuilding={selectedBuilding}
                  loading={directoryLoading}
                  onSelect={(buildingId) => {
                    setSelectedBuildingId(buildingId);
                    void loadBuildingDetail(buildingId);
                  }}
                  onUpdated={async (buildingId) => {
                    await loadOverview(false);
                    if (buildingId) {
                      setSelectedBuildingId(buildingId);
                      await loadBuildingDetail(buildingId);
                    }
                  }}
                />
              </>
            ) : activeTab === 'add-site' ? (
                <header className="glass-panel rounded-[32px] px-8 py-8">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/80">Sistem Genişlemesi</p>
                  </div>
                  <h2 className="font-heading text-4xl font-bold tracking-tight text-white">
                    Yeni Site Tanımlama
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-zinc-400 max-w-xl">
                    Yeni bir rezidans, site veya bağımsız binayı sisteme dahil edin ve yönetimini başlatın.
                  </p>
                </div>

                <div className="mt-8 relative z-10">
                  <SiteCreationPanel
                    provinces={provinces}
                    onCreated={async () => {
                      await loadOverview(false);
                      if (selectedBuildingId) {
                        await loadBuildingDetail(selectedBuildingId);
                      }
                    }}
                  />
                </div>
              </header>
            ) : (
              <>
                <header className="glass-panel rounded-[32px] px-8 py-8">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80">Güvenlik ve Yetki</p>
                    </div>
                    <h2 className="font-heading text-4xl font-bold tracking-tight text-white">Danışman ve yönetici listesi</h2>
                    <p className="mt-4 text-base leading-relaxed text-zinc-400 max-w-xl">
                      Merkezi yetkileri yönetin, ilk şifreleri görüntüleyin ve saha ekiplerinin atamalarını düzenleyin.
                    </p>
                  </div>
                </header>

                <AdminUserDirectoryPanel
                  superAdmins={accountDirectory.superAdmins}
                  concierges={accountDirectory.concierges}
                  buildings={directoryBuildings}
                  onCreated={async () => {
                    await loadOverview(false);
                  }}
                />
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
