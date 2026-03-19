'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  Droplets,
  Hammer,
  KeyRound,
  Megaphone,
  MoonStar,
  Package,
  Phone,
  QrCode,
  ScanLine,
  ShieldAlert,
  SunMedium,
  Truck,
  UserPlus,
  Wrench
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../providers/auth-provider';
import { usePanelTheme } from '../providers/panel-theme-provider';
import { usePortalData } from '../providers/portal-data-provider';
import { useToast } from '../providers/toast-provider';
import { UnlockSlider } from '../ui/unlock-slider';
import {
  buildUnitResidentRows,
  formatCurrency,
  formatDate,
  formatDateTime,
  getAnnouncementsForUser,
  getOpenRequests,
  getPendingRequest,
  getRequestsForUser,
  getServiceProvidersForUser,
  getVisibleBuildings,
  getVisibleSites,
  getVisibleUnits,
  packageStatusLabel,
  requestStatusLabel,
  requestTypeLabel,
  unitLabel
} from '@/lib/portal-selectors';

type ResidentTab = 'home' | 'visitors' | 'packages' | 'payments' | 'services' | 'announcements';
type DisplayServiceCategory = 'Temizlik' | 'Tadilat' | 'Nakliyat' | 'Tesisat';

const TAB_ITEMS = [
  { id: 'home', label: 'Ana', title: 'Ana sayfa', icon: KeyRound },
  { id: 'visitors', label: 'Kapı', title: 'Kapı akışı', icon: UserPlus },
  { id: 'packages', label: 'Kargo', title: 'Kargo', icon: Package },
  { id: 'payments', label: 'Aidat', title: 'Aidat', icon: CreditCard },
  { id: 'services', label: 'Servis', title: 'Servis', icon: Wrench }
] as const;

const SCREEN_MOTION = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.985 },
  transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
} as const;

const SECTION_CLASS = 'resident-section rounded-[24px] p-4';
const CARD_CLASS = 'resident-card rounded-[18px] p-3.5';
const SERVICE_CATEGORIES: Array<{
  id: DisplayServiceCategory;
  icon: LucideIcon;
}> = [
  { id: 'Temizlik', icon: Droplets },
  { id: 'Tadilat', icon: Hammer },
  { id: 'Nakliyat', icon: Truck },
  { id: 'Tesisat', icon: Wrench }
];

function normalizeServiceCategory(category: string): DisplayServiceCategory | null {
  switch (category) {
    case 'Temizlik':
      return 'Temizlik';
    case 'Nakliyat':
      return 'Nakliyat';
    case 'Tesisat':
    case 'Elektrik':
    case 'Asansör':
      return 'Tesisat';
    default:
      return null;
  }
}

function statusChipClass(
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'redirected'
    | 'expired'
    | 'paid'
    | 'unpaid'
    | 'overdue'
    | 'at_desk'
    | 'on_the_way'
    | 'delivered'
) {
  switch (status) {
    case 'approved':
    case 'paid':
    case 'delivered':
      return 'border-[rgba(107,191,115,0.4)] bg-[rgba(107,191,115,0.14)] text-[var(--color-success)]';
    case 'rejected':
    case 'overdue':
      return 'border-[rgba(231,111,81,0.4)] bg-[rgba(231,111,81,0.12)] text-[var(--color-danger)]';
    case 'redirected':
    case 'expired':
    case 'on_the_way':
      return 'border-[rgba(107,174,214,0.4)] bg-[rgba(107,174,214,0.12)] text-[var(--color-info)]';
    default:
      return 'border-[rgba(212,163,115,0.42)] bg-[rgba(212,163,115,0.12)] text-[var(--color-accent)]';
  }
}

export function ResidentConsole() {
  const { session } = useAuth();
  const { mode, toggleMode } = usePanelTheme();
  const {
    state,
    updateGuestRequest,
    triggerGate,
    createAccessPass,
    setResidentAwayMode,
    createAnnouncement
  } = usePortalData();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ResidentTab>('home');
  const [passHolderName, setPassHolderName] = useState('');
  const [passType, setPassType] = useState<'qr' | 'nfc'>('qr');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalRequestId, setModalRequestId] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementSummary, setAnnouncementSummary] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState<'Operasyon' | 'Güvenlik' | 'Yönetim'>(
    'Operasyon'
  );
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<DisplayServiceCategory | null>(null);

  const currentUser = session?.user ?? null;
  const isManager = currentUser?.role === 'manager';

  const residentUnitLabel = useMemo(
    () => (currentUser?.unitId ? unitLabel(state, currentUser.unitId) : 'Daire bilgisi bulunmuyor'),
    [currentUser?.unitId, state]
  );
  const residentRequests = useMemo(
    () =>
      currentUser?.unitId
        ? state.guestRequests.filter((request) => request.unitId === currentUser.unitId)
        : [],
    [currentUser?.unitId, state.guestRequests]
  );
  const pendingRequest = useMemo(() => getPendingRequest(residentRequests), [residentRequests]);
  const activeRequests = useMemo(() => getOpenRequests(residentRequests), [residentRequests]);
  const visibleSites = useMemo(
    () => (currentUser ? getVisibleSites(state, currentUser) : []),
    [currentUser, state]
  );
  const visibleBuildings = useMemo(
    () => (currentUser ? getVisibleBuildings(state, currentUser) : []),
    [currentUser, state]
  );
  const visibleUnits = useMemo(
    () => (currentUser ? getVisibleUnits(state, currentUser) : []),
    [currentUser, state]
  );
  const siteRows = useMemo(
    () => buildUnitResidentRows(state, visibleBuildings, visibleUnits, state.profiles),
    [state, visibleBuildings, visibleUnits]
  );
  const managedSite = visibleSites[0] ?? null;
  const managedRequests = useMemo(
    () => (currentUser && isManager ? getRequestsForUser(state, currentUser) : []),
    [currentUser, isManager, state]
  );
  const announcements = useMemo(
    () => (currentUser ? getAnnouncementsForUser(state, currentUser) : []),
    [currentUser, state]
  );
  const providers = useMemo(
    () => (currentUser ? getServiceProvidersForUser(state, currentUser) : []),
    [currentUser, state]
  );
  const ownInvoices = useMemo(
    () =>
      currentUser?.unitId ? state.invoices.filter((invoice) => invoice.unitId === currentUser.unitId) : [],
    [currentUser?.unitId, state.invoices]
  );
  const ownPackages = useMemo(
    () =>
      currentUser?.unitId ? state.packages.filter((item) => item.unitId === currentUser.unitId) : [],
    [currentUser?.unitId, state.packages]
  );
  const visiblePackages = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (!isManager) {
      return ownPackages;
    }

    const unitIds = new Set(visibleUnits.map((unit) => unit.id));
    return state.packages.filter((item) => unitIds.has(item.unitId));
  }, [currentUser, isManager, ownPackages, state.packages, visibleUnits]);
  const notifications = useMemo(
    () =>
      currentUser
        ? state.notifications.filter((item) => item.profileId === currentUser.id).slice(0, 4)
        : [],
    [currentUser?.id, state.notifications]
  );
  const awayModeEnabled = useMemo(
    () =>
      currentUser
        ? state.residentPreferences.find((item) => item.profileId === currentUser.id)?.awayModeEnabled ?? false
        : false,
    [currentUser?.id, state.residentPreferences]
  );
  const passes = useMemo(
    () =>
      currentUser?.unitId
        ? state.accessPasses
            .filter((item) => item.unitId === currentUser.unitId)
            .sort((left, right) => new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime())
        : [],
    [currentUser?.unitId, state.accessPasses]
  );

  const currentInvoice = ownInvoices[0] ?? null;
  const ownAtDeskPackages = ownPackages.filter((item) => item.status === 'at_desk');
  const visibleAtDeskPackages = visiblePackages.filter((item) => item.status === 'at_desk');
  const activePasses = passes.filter((item) => item.status === 'active');
  const latestAnnouncement = announcements[0] ?? null;
  const latestManagedRequest = managedRequests[0] ?? null;
  const managerCards = useMemo(
    () => ({
      buildingCount: visibleBuildings.length,
      residentCount: siteRows.filter((row) => row.resident).length,
      packageCount: visibleAtDeskPackages.length,
      providerCount: providers.length
    }),
    [providers.length, siteRows, visibleAtDeskPackages.length, visibleBuildings.length]
  );
  const managedPendingCount = useMemo(
    () => managedRequests.filter((request) => request.status === 'pending').length,
    [managedRequests]
  );
  const serviceCategories = useMemo(
    () =>
      SERVICE_CATEGORIES.map((item) => ({
        ...item,
        count: providers.filter((provider) => normalizeServiceCategory(provider.category) === item.id).length
      })),
    [providers]
  );
  const filteredProviders = useMemo(
    () =>
      selectedServiceCategory
        ? providers.filter((provider) => normalizeServiceCategory(provider.category) === selectedServiceCategory)
        : [],
    [providers, selectedServiceCategory]
  );
  const statusTime = useMemo(
    () => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    []
  );

  useEffect(() => {
    if (pendingRequest?.id) {
      setModalRequestId(pendingRequest.id);
    }
  }, [pendingRequest?.id]);

  useEffect(() => {
    if (activeTab !== 'services') {
      setSelectedServiceCategory(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isManager && activeTab === 'announcements') {
      setActiveTab('home');
    }
  }, [activeTab, isManager]);

  if (!currentUser) {
    return null;
  }

  const user = currentUser;

  async function handleApprove() {
    if (!pendingRequest) {
      return;
    }

    setActionLoading(true);
    try {
      await updateGuestRequest(pendingRequest.id, 'approved', user.fullName);
      await triggerGate(pendingRequest.buildingId, user.fullName, pendingRequest.id, 'resident');
      showToast({ tone: 'success', message: 'Kapı açıldı.' });
      setModalRequestId(null);
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'İşlem şu anda tamamlanamadı.'
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecision(status: 'rejected' | 'redirected') {
    if (!pendingRequest) {
      return;
    }

    setActionLoading(true);
    try {
      await updateGuestRequest(pendingRequest.id, status, user.fullName);
      showToast({
        tone: status === 'rejected' ? 'warning' : 'info',
        message: status === 'rejected' ? 'Çağrı kapatıldı.' : 'Ziyaretçi danışmaya yönlendirildi.'
      });
      setModalRequestId(null);
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'İşlem şu anda tamamlanamadı.'
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleQuickDoorOpen() {
    const buildingId = user.buildingIds[0];
    if (!buildingId) {
      return;
    }

    setActionLoading(true);
    try {
      await triggerGate(buildingId, user.fullName, undefined, 'resident');
      showToast({ tone: 'success', message: 'Kapı açma komutu gönderildi.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreatePass() {
    if (!user.unitId || passHolderName.trim().length < 2) {
      showToast({ tone: 'warning', message: 'Lütfen geçiş sahibinin adını yazın.' });
      return;
    }

    await createAccessPass({
      unitId: user.unitId,
      holderName: passHolderName.trim(),
      type: passType
    });

    setPassHolderName('');
    showToast({
      tone: 'success',
      message: passType === 'qr' ? 'Yeni QR geçişi oluşturuldu.' : 'Yeni NFC geçişi oluşturuldu.'
    });
  }

  async function handleToggleAwayMode() {
    setActionLoading(true);
    try {
      await setResidentAwayMode(user.id, !awayModeEnabled);
      showToast({
        tone: 'info',
        message: !awayModeEnabled
          ? 'Evde yokum modu açıldı. Kurye ekranında teslimat notunuz gösterilecek.'
          : 'Evde yokum modu kapatıldı.'
      });
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Tercihiniz güncellenemedi.'
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateAnnouncement() {
    if (!managedSite || announcementTitle.trim().length < 3 || announcementSummary.trim().length < 6) {
      showToast({ tone: 'warning', message: 'Lütfen duyuru alanlarını tamamlayın.' });
      return;
    }

    await createAnnouncement({
      siteId: managedSite.id,
      title: announcementTitle.trim(),
      summary: announcementSummary.trim(),
      category: announcementCategory
    });

    setAnnouncementTitle('');
    setAnnouncementSummary('');
    showToast({ tone: 'success', message: 'Duyuru paylaşıldı.' });
  }

  let tabContent: ReactNode = null;

  if (activeTab === 'home') {
    tabContent = (
      <div className="space-y-3.5">
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
              {residentUnitLabel}
            </span>
            {isManager ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                {managedSite?.name ?? 'Site'}
              </span>
            ) : null}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={() => void handleQuickDoorOpen()}
            disabled={actionLoading}
            className="app-button mt-4 w-full rounded-[18px] px-4 py-3.5 text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {actionLoading ? 'Hazırlanıyor' : 'Kapımı aç'}
          </motion.button>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-[16px] border border-white/10 bg-black/18 px-3 py-3 text-center">
              <p className="text-[1.2rem] font-bold leading-none">{activeRequests.length}</p>
              <p className="mt-1 text-[10px] text-white/54">Kapı</p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-black/18 px-3 py-3 text-center">
              <p className="text-[1.2rem] font-bold leading-none">{ownAtDeskPackages.length}</p>
              <p className="mt-1 text-[10px] text-white/54">Kargo</p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-black/18 px-3 py-3 text-center">
              <p className="text-[1.2rem] font-bold leading-none">{activePasses.length}</p>
              <p className="mt-1 text-[10px] text-white/54">Geçiş</p>
            </div>
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Son bildirimler</p>
          <div className="mt-4 space-y-3">
            {notifications.length ? (
              notifications.map((item) => (
                <div key={item.id} className={CARD_CLASS}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-white/62">{item.body}</p>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                Bildirim yok.
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          <div className={CARD_CLASS}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Kapıda</p>
            <p className="mt-2 font-heading text-[1.7rem] font-bold">{activeRequests.length}</p>
            <p className="mt-1 text-[11px] text-[var(--color-accent)]">Yanıt bekleyen ziyaret</p>
          </div>
          <div className={CARD_CLASS}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Masada</p>
            <p className="mt-2 font-heading text-[1.7rem] font-bold">{ownAtDeskPackages.length}</p>
            <p className="mt-1 text-[11px] text-[var(--color-accent)]">Teslim alınacak kargo</p>
          </div>
          <div className={CARD_CLASS}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Geçiş</p>
            <p className="mt-2 font-heading text-[1.7rem] font-bold">{activePasses.length}</p>
            <p className="mt-1 text-[11px] text-[var(--color-accent)]">Aktif QR ve NFC</p>
          </div>
          <div className={CARD_CLASS}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Bu ay</p>
            <p className="mt-3 font-heading text-[1.35rem] font-bold">
              {currentInvoice ? formatCurrency(currentInvoice.amount) : 'Kayıt yok'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-accent)]">
              {currentInvoice?.status === 'paid'
                ? 'Ödendi'
                : currentInvoice?.status === 'overdue'
                  ? 'Gecikmiş'
                  : 'Bekliyor'}
            </p>
          </div>
        </section>

        {isManager ? (
          <section className={SECTION_CLASS}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Ek yetkiler</p>
                <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Site görünümü</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                {managedSite?.name ?? 'Site'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Blok</p>
                <p className="mt-2 font-heading text-[1.6rem] font-bold">{managerCards.buildingCount}</p>
              </div>
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Sakin</p>
                <p className="mt-2 font-heading text-[1.6rem] font-bold">{managerCards.residentCount}</p>
              </div>
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Kargo</p>
                <p className="mt-2 font-heading text-[1.6rem] font-bold">{managerCards.packageCount}</p>
              </div>
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Servis</p>
                <p className="mt-2 font-heading text-[1.6rem] font-bold">{managerCards.providerCount}</p>
              </div>
            </div>
            <div className={`${CARD_CLASS} mt-3`}>
              <p className="text-sm font-semibold">Son site hareketi</p>
              <p className="mt-2 text-[13px] leading-6 text-white/62">
                {latestManagedRequest
                  ? `${requestTypeLabel(latestManagedRequest.type)} · ${latestManagedRequest.guestName}`
                  : 'Şu anda yeni site hareketi görünmüyor.'}
              </p>
            </div>
          </section>
        ) : null}

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Bugün</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Güncel gelişmeler</h2>
          <div className="mt-4 space-y-3">
            {latestAnnouncement ? (
              <div className={CARD_CLASS}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{latestAnnouncement.title}</p>
                    <p className="mt-2 text-[13px] leading-6 text-white/66">{latestAnnouncement.summary}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
                    {latestAnnouncement.category}
                  </span>
                </div>
              </div>
            ) : null}
            {!latestAnnouncement ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                Şimdilik yeni duyuru görünmüyor.
              </div>
            ) : null}
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Hızlı erişim</p>
          <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Kısayollar</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {TAB_ITEMS.filter((item) => item.id !== 'home').map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveTab(item.id)}
                  className={`${CARD_CLASS} text-left transition-transform duration-200 hover:-translate-y-0.5`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-black/18">
                    <Icon className="h-4.5 w-4.5 text-[var(--color-accent)]" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                </motion.button>
              );
            })}
          </div>
        </section>

        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          onClick={() => showToast({ tone: 'warning', message: 'Acil durum bildiriminiz alındı.' })}
          className="flex w-full items-center justify-center gap-3 rounded-[20px] border border-[rgba(231,111,81,0.42)] bg-[rgba(231,111,81,0.1)] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-danger)]"
        >
          <ShieldAlert className="h-5 w-5" />
          Acil durum bildir
        </motion.button>
      </div>
    );
  }

  if (activeTab === 'visitors') {
    tabContent = (
      <div className="space-y-4">
        {isManager ? (
          <section className={SECTION_CLASS}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Ek görünüm</p>
            <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Sitedeki daireler ve sakinler</h2>
            <div className="mt-4 space-y-3">
              {siteRows.length ? (
                siteRows.map((row) => (
                  <div key={row.unit.id} className={CARD_CLASS}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {row.building?.name ?? 'Blok'} · Daire {row.unit.unitNumber}
                        </p>
                        <p className="mt-2 text-[13px] text-white/62">
                          {row.resident?.fullName ?? 'Henüz sakin atanmamış'}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/54">
                        Kat {row.unit.floor}
                      </span>
                    </div>
                    <p className="mt-3 text-[12px] text-white/48">{row.resident?.phone ?? 'Telefon bilgisi yok'}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                  Görüntülenecek daire kaydı bulunmuyor.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Kapı akışı</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Ziyaret ve girişler</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={CARD_CLASS}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Aktif çağrı</p>
              <p className="mt-3 font-heading text-[1.8rem] font-bold">{residentRequests.length}</p>
            </div>
            <div className={CARD_CLASS}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Aktif geçiş</p>
              <p className="mt-3 font-heading text-[1.8rem] font-bold">{activePasses.length}</p>
            </div>
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Canlı kayıtlar</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Kapıdaki akış</h2>
          <div className="mt-4 space-y-3">
            {residentRequests.length ? (
              residentRequests.map((request) => (
                <div key={request.id} className={CARD_CLASS}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{request.guestName}</p>
                      <p className="mt-1 text-sm text-white/58">{requestTypeLabel(request.type)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(request.status)}`}>
                      {requestStatusLabel(request.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] text-white/46">{formatDateTime(request.createdAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                Henüz görüntülenecek ziyaret kaydı yok.
              </div>
            )}
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Geçici erişim</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">QR ve NFC oluştur</h2>
          <div className="mt-4 space-y-3">
            <input
              className="app-input rounded-[18px] px-4 py-3.5"
              value={passHolderName}
              onChange={(event) => setPassHolderName(event.target.value)}
              placeholder="Geçiş sahibinin adı"
              type="text"
            />
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setPassType('qr')}
                className={`${CARD_CLASS} ${passType === 'qr' ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.14)]' : ''}`}
              >
                <QrCode className="mx-auto h-5 w-5 text-[var(--color-accent)]" />
                <p className="mt-2 text-sm font-semibold">QR geçişi</p>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setPassType('nfc')}
                className={`${CARD_CLASS} ${passType === 'nfc' ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.14)]' : ''}`}
              >
                <ScanLine className="mx-auto h-5 w-5 text-[var(--color-accent)]" />
                <p className="mt-2 text-sm font-semibold">NFC geçişi</p>
              </motion.button>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => void handleCreatePass()}
              className="app-button w-full rounded-[18px] px-4 py-3.5 text-[11px] uppercase tracking-[0.16em]"
            >
              Geçiş oluştur
            </motion.button>
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'packages') {
    tabContent = (
      <div className="space-y-4">
        <section className={SECTION_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Teslimat</p>
              <h2 className="mt-2 font-heading text-[1.2rem] font-bold">
                {isManager ? 'Site kargoları' : 'Kargolarım'}
              </h2>
            </div>
            {!isManager ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => void handleToggleAwayMode()}
                disabled={actionLoading}
                className={`relative h-11 min-w-[78px] rounded-full border ${
                  awayModeEnabled
                    ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.22)]'
                    : 'border-white/12 bg-black/20'
                }`}
              >
                <motion.span
                  animate={{ x: awayModeEnabled ? 32 : 4 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute top-[4px] flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#181818]"
                >
                  <MoonStar className="h-4 w-4" />
                </motion.span>
              </motion.button>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={CARD_CLASS}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Bekleyen</p>
              <p className="mt-2 font-heading text-[1.6rem] font-bold">
                {isManager ? visibleAtDeskPackages.length : ownAtDeskPackages.length}
              </p>
            </div>
            <div className={`${CARD_CLASS} flex items-center justify-between`}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Teslimat modu</p>
                <p className="mt-2 text-sm font-semibold">{awayModeEnabled ? 'Evde yokum' : 'Standart'}</p>
              </div>
              {!isManager ? <MoonStar className="h-5 w-5 text-[var(--color-accent)]" /> : <Package className="h-5 w-5 text-[var(--color-accent)]" />}
            </div>
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Kayıtlar</p>
          <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Liste</h2>
          <div className="mt-4 space-y-3">
            {visiblePackages.length ? (
              visiblePackages.map((item) => (
                <div key={item.id} className={CARD_CLASS}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.courierName}</p>
                      {isManager ? (
                        <p className="mt-1 text-[13px] text-white/58">{unitLabel(state, item.unitId)}</p>
                      ) : null}
                      <p className="mt-2 text-[13px] text-white/58">Giriş zamanı: {formatDateTime(item.arrivedAt)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(item.status)}`}>
                      {packageStatusLabel(item.status)}
                    </span>
                  </div>
                  {item.deliveredAt ? (
                    <p className="mt-3 text-[12px] text-white/46">Teslim: {formatDateTime(item.deliveredAt)}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                Görüntülenecek kargo kaydı bulunmuyor.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'payments') {
    tabContent = (
      <div className="space-y-4">
        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Aidat özeti</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Bu ayın durumu</h2>
          {currentInvoice ? (
            <div className={`${CARD_CLASS} mt-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white/58">{currentInvoice.periodLabel}</p>
                  <p className="mt-2 font-heading text-[1.9rem] font-bold">{formatCurrency(currentInvoice.amount)}</p>
                  <p className="mt-2 text-[13px] text-white/58">Son ödeme: {formatDate(currentInvoice.dueDate)}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(currentInvoice.status)}`}>
                  {currentInvoice.status === 'paid'
                    ? 'Ödendi'
                    : currentInvoice.status === 'overdue'
                      ? 'Gecikmiş'
                      : 'Bekliyor'}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/58">Bu dönem için görünen aidat kaydı yok.</p>
          )}
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Tüm dönemler</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Ödeme geçmişi</h2>
          <div className="mt-4 space-y-3">
            {ownInvoices.length ? (
              ownInvoices.map((invoice) => (
                <div key={invoice.id} className={CARD_CLASS}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{invoice.periodLabel}</p>
                      <p className="mt-1 text-sm text-white/58">{formatCurrency(invoice.amount)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(invoice.status)}`}>
                      {invoice.status === 'paid'
                        ? 'Ödendi'
                        : invoice.status === 'overdue'
                          ? 'Gecikmiş'
                          : 'Bekliyor'}
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] text-white/46">Son ödeme: {formatDate(invoice.dueDate)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                Aidat kaydı bulunmuyor.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'announcements' && isManager) {
    tabContent = (
      <div className="space-y-4">
        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Duyuru</p>
          <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Yayınla</h2>
          <div className="mt-4 space-y-3">
            <input
              className="app-input rounded-[18px] px-4 py-3.5"
              value={announcementTitle}
              onChange={(event) => setAnnouncementTitle(event.target.value)}
              placeholder="Başlık"
              type="text"
            />
            <select
              className="app-select rounded-[18px] px-4 py-3.5"
              value={announcementCategory}
              onChange={(event) =>
                setAnnouncementCategory(event.target.value as 'Operasyon' | 'Güvenlik' | 'Yönetim')
              }
            >
              <option value="Operasyon">Operasyon</option>
              <option value="Güvenlik">Güvenlik</option>
              <option value="Yönetim">Yönetim</option>
            </select>
            <textarea
              className="app-textarea min-h-[110px] rounded-[18px] px-4 py-3.5"
              value={announcementSummary}
              onChange={(event) => setAnnouncementSummary(event.target.value)}
              placeholder="Metin"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => void handleCreateAnnouncement()}
              className="app-button w-full rounded-[18px] px-4 py-3.5 text-[11px] uppercase tracking-[0.16em]"
            >
              Paylaş
            </motion.button>
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Son duyurular</p>
          <div className="mt-4 space-y-3">
            {announcements.length ? (
              announcements.map((item) => (
                <div key={item.id} className={CARD_CLASS}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-white/62">{item.summary}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
                      {item.category}
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] text-white/46">{formatDateTime(item.publishedAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                Duyuru yok.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'services') {
    tabContent = (
      <div className="space-y-4">
        {!selectedServiceCategory ? (
          <section className={SECTION_CLASS}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Servisler</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {serviceCategories.map((category) => {
                const Icon = category.icon;
                return (
                <motion.button
                  key={category.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedServiceCategory(category.id)}
                  className="aspect-square rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 text-left shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-[rgba(212,163,115,0.24)] bg-[rgba(212,163,115,0.08)]">
                      <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">{category.id}</p>
                      <p className="mt-1 text-[11px] text-white/54">{category.count}</p>
                    </div>
                  </div>
                </motion.button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className={SECTION_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Kategori</p>
                <h2 className="mt-2 font-heading text-[1.2rem] font-bold">{selectedServiceCategory}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServiceCategory(null)}
                className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
              >
                Geri
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {filteredProviders.length ? (
                filteredProviders.map((provider) => (
                  <div key={provider.id} className={CARD_CLASS}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{provider.fullName}</p>
                        <p className="mt-2 text-[13px] leading-6 text-white/58">{provider.note}</p>
                      </div>
                      <motion.a
                        whileTap={{ scale: 0.97 }}
                        href={`tel:${provider.phone}`}
                        className="inline-flex items-center gap-2 rounded-[16px] border border-[var(--color-accent)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]"
                      >
                        <Phone className="h-4 w-4" />
                        Ara
                      </motion.a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                  Kayıt yok.
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    );
  }

  return (
    <main className="phone-stage flex min-h-screen items-center justify-center px-2 py-1 text-[var(--color-text)] sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="phone-shell"
      >
        <div className="phone-screen">
          <div className="resident-top-glow pointer-events-none absolute inset-x-0 top-0 h-44" />
          <div className="phone-island" />
          <div className="phone-statusbar">
            <span>{statusTime}</span>
            <div className="flex items-center gap-2 text-[11px] text-white/72">
              <span>5G</span>
              <div className="flex items-end gap-[2px]">
                <span className="h-1.5 w-[3px] rounded-full bg-white/50" />
                <span className="h-2.5 w-[3px] rounded-full bg-white/60" />
                <span className="h-3.5 w-[3px] rounded-full bg-white/70" />
                <span className="h-4.5 w-[3px] rounded-full bg-white/80" />
              </div>
              <div className="h-3.5 w-6 rounded-[5px] border border-white/34 p-[1px]">
                <div className="h-full w-[68%] rounded-[3px] bg-white/78" />
              </div>
            </div>
          </div>

          <div className="relative flex h-full flex-col px-3 pb-3 pt-9">
            <header className="resident-header mb-2 flex items-center justify-between gap-3 px-1 pb-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <img src="/icon.svg" alt="Online Kapıcı logosu" className="h-8 w-8 shrink-0 rounded-[10px]" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold tracking-[0.02em] text-white">Online Kapıcı</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isManager ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'announcements' ? 'home' : 'announcements')}
                    className="resident-card inline-flex h-9 items-center justify-center gap-1.5 rounded-[14px] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)] transition-transform active:scale-95"
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    <span>{activeTab === 'announcements' ? 'Kapat' : 'Duyuru'}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="resident-card inline-flex h-9 w-9 items-center justify-center rounded-[14px] text-[var(--color-accent)] transition-transform active:scale-95"
                  aria-label={mode === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
                >
                  {mode === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                </button>
                <div className="min-w-0 text-right">
                  <p className="truncate text-[12px] font-medium text-white/78">{user.fullName}</p>
                </div>
              </div>
            </header>

            <div className="phone-scroll min-h-0 flex-1 overflow-y-auto px-0.5">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...SCREEN_MOTION} className="pb-28">
                  {tabContent}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="resident-bottom-fade pointer-events-none absolute inset-x-0 bottom-0 h-32" />
            <div className="relative mt-auto px-1">
              <div className="phone-tabbar p-2">
                <div className="grid grid-cols-5 gap-1">
                  {TAB_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab(item.id)}
                        className={`rounded-[15px] px-1.5 py-2 text-center transition-all duration-300 ${
                          isActive
                            ? 'bg-[linear-gradient(180deg,rgba(212,163,115,0.2),rgba(212,163,115,0.08))] text-white'
                            : 'text-white/56'
                        }`}
                      >
                        <Icon className={`mx-auto h-3.5 w-3.5 ${isActive ? 'text-[var(--color-accent)]' : 'text-white/64'}`} />
                        <span className="mt-1 block text-[9px] font-semibold tracking-[0.08em]">{item.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              <div className="phone-home-indicator mt-3" />
            </div>
          </div>

          <AnimatePresence>
            {pendingRequest && modalRequestId === pendingRequest.id ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[120] bg-black/66 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ opacity: 0, y: 34 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 18 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-3 bottom-4 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,#1b1c1f_0%,#111214_100%)] p-5"
                >
                  <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/12" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Kapıda bekleyen var</p>
                  <h2 className="mt-2 font-heading text-[1.9rem] font-bold">{pendingRequest.guestName}</h2>
                  <p className="mt-3 text-[13px] leading-6 text-white/66">
                    {requestTypeLabel(pendingRequest.type)} için onay bekleniyor.
                  </p>
                  <div className={`${CARD_CLASS} mt-5`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">Konum</p>
                    <p className="mt-2 font-semibold">{residentUnitLabel}</p>
                  </div>
                  <div className="mt-5">
                    <UnlockSlider
                      disabled={actionLoading}
                      hint="Kapı komutu gönderilir"
                      label={actionLoading ? 'Hazırlanıyor' : 'Kapıyı açmak için kaydır'}
                      loading={actionLoading}
                      onComplete={() => void handleApprove()}
                      resetKey={pendingRequest.id}
                    />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void handleDecision('redirected')}
                      className="app-button-secondary rounded-[18px] px-4 py-4 text-[11px] uppercase tracking-[0.18em]"
                    >
                      Danışmaya aktar
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void handleDecision('rejected')}
                      className="rounded-[18px] border border-[rgba(231,111,81,0.5)] bg-[rgba(231,111,81,0.08)] px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-danger)]"
                    >
                      Çağrıyı kapat
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  );
}
