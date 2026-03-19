'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  ChevronDown,
  Building2,
  CreditCard,
  Droplets,
  Hammer,
  KeyRound,
  LogOut,
  Megaphone,
  MoonStar,
  Package,
  Phone,
  ShieldAlert,
  SunMedium,
  Truck,
  UserPlus,
  Wrench
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import QRCode from 'qrcode';
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

type ResidentTab = 'home' | 'visitors' | 'packages' | 'payments' | 'services' | 'management' | 'announcements';
type ManagementView = 'menu' | 'announcements' | 'invoices' | 'packages' | 'units' | 'unit-detail';
type DisplayServiceCategory = 'Temizlik' | 'Tadilat' | 'Nakliyat' | 'Tesisat';

const TAB_ITEMS = [
  { id: 'home', label: 'Ana', title: 'Ana sayfa', icon: KeyRound },
  { id: 'visitors', label: 'Kapı', title: 'Kapı akışı', icon: UserPlus },
  { id: 'packages', label: 'Kargo', title: 'Kargo', icon: Package },
  { id: 'payments', label: 'Aidat', title: 'Aidat', icon: CreditCard },
  { id: 'services', label: 'Servis', title: 'Servis', icon: Wrench }
] as const;
const MANAGER_TAB_ITEM = { id: 'management', label: 'Yönetim', title: 'Yönetim', icon: Building2 } as const;

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

function invoiceStatusLabel(status: 'paid' | 'unpaid' | 'overdue') {
  if (status === 'paid') {
    return 'Ödendi';
  }

  if (status === 'overdue') {
    return 'Gecikmiş';
  }

  return 'Bekliyor';
}

function isQrPassActive(pass: { type: 'qr'; status: 'active' | 'used' | 'expired'; expiresAt: string }) {
  return pass.type === 'qr' && pass.status === 'active' && new Date(pass.expiresAt).getTime() > Date.now();
}

function AccessPassQrPreview({ value, alt }: { value: string; alt: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(value, {
      margin: 1,
      width: 168,
      color: {
        dark: '#111111',
        light: '#ffffff'
      }
    }).then((url: string) => {
      if (!cancelled) {
        setDataUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className="h-28 w-28 animate-pulse rounded-[16px] bg-black/6" />;
  }

  return <img src={dataUrl} alt={alt} className="h-28 w-28 rounded-[16px]" />;
}

export function ResidentConsole() {
  const { session, logout } = useAuth();
  const { mode, toggleMode } = usePanelTheme();
  const {
    state,
    updateGuestRequest,
    triggerGate,
    createAccessPass,
    updatePackageStatus,
    setResidentAwayMode,
    createAnnouncement,
    setInvoiceStatus,
    upsertSiteInvoicePlan
  } = usePortalData();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ResidentTab>('home');
  const [passHolderName, setPassHolderName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalRequestId, setModalRequestId] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementSummary, setAnnouncementSummary] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState<'Operasyon' | 'Güvenlik' | 'Yönetim'>(
    'Operasyon'
  );
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<DisplayServiceCategory | null>(null);
  const [managementView, setManagementView] = useState<ManagementView>('menu');
  const [selectedManagedUnitId, setSelectedManagedUnitId] = useState<string | null>(null);
  const [unitDetailBackView, setUnitDetailBackView] = useState<'invoices' | 'units' | 'packages'>(
    'invoices'
  );
  const [invoiceAmountInput, setInvoiceAmountInput] = useState('');
  const [invoiceDueDayInput, setInvoiceDueDayInput] = useState('10');
  const [invoicePlanActive, setInvoicePlanActive] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const currentUser = session?.user ?? null;
  const isManager = currentUser?.role === 'manager';
  const navigationItems = isManager ? [...TAB_ITEMS, MANAGER_TAB_ITEM] : TAB_ITEMS;

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

    return ownPackages;
  }, [currentUser, ownPackages]);
  const managedPackages = useMemo(() => {
    if (!isManager) {
      return [];
    }

    const unitIds = new Set(visibleUnits.map((unit) => unit.id));
    return state.packages.filter((item) => unitIds.has(item.unitId));
  }, [isManager, state.packages, visibleUnits]);
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
  const managedAtDeskPackages = managedPackages.filter((item) => item.status === 'at_desk');
  const activePasses = passes.filter((item) => isQrPassActive(item));
  const latestAnnouncement = announcements[0] ?? null;
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
  const managedSiteInvoicePlan = useMemo(
    () => (managedSite ? state.siteInvoicePlans.find((plan) => plan.siteId === managedSite.id) ?? null : null),
    [managedSite, state.siteInvoicePlans]
  );
  const managedInvoices = useMemo(() => {
    if (!isManager) {
      return [];
    }

    const unitIds = new Set(visibleUnits.map((unit) => unit.id));
    return state.invoices
      .filter((invoice) => unitIds.has(invoice.unitId))
      .sort((left, right) => new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime());
  }, [isManager, state.invoices, visibleUnits]);
  const latestInvoiceByUnit = useMemo(() => {
    const map = new Map<string, (typeof managedInvoices)[number]>();

    for (const invoice of managedInvoices) {
      const current = map.get(invoice.unitId);
      if (!current || new Date(invoice.dueDate).getTime() > new Date(current.dueDate).getTime()) {
        map.set(invoice.unitId, invoice);
      }
    }

    return map;
  }, [managedInvoices]);
  const latestManagedInvoices = useMemo(() => Array.from(latestInvoiceByUnit.values()), [latestInvoiceByUnit]);
  const managedUnitsByBuilding = useMemo(
    () =>
      visibleBuildings
        .map((building) => ({
          building,
          rows: siteRows
            .filter((row) => row.unit.buildingId === building.id)
            .sort(
              (left, right) =>
                left.unit.floor - right.unit.floor ||
                left.unit.unitNumber.localeCompare(right.unit.unitNumber, 'tr-TR', { numeric: true })
            )
        }))
        .filter((section) => section.rows.length > 0),
    [siteRows, visibleBuildings]
  );
  const selectedManagedUnitRow = useMemo(
    () => siteRows.find((row) => row.unit.id === selectedManagedUnitId) ?? null,
    [selectedManagedUnitId, siteRows]
  );
  const selectedManagedUnitInvoices = useMemo(
    () =>
      selectedManagedUnitId
        ? managedInvoices.filter((invoice) => invoice.unitId === selectedManagedUnitId)
        : [],
    [managedInvoices, selectedManagedUnitId]
  );
  const invoiceSnapshot = useMemo(
    () => ({
      paid: latestManagedInvoices.filter((invoice) => invoice.status === 'paid').length,
      waiting: latestManagedInvoices.filter((invoice) => invoice.status === 'unpaid').length,
      overdue: latestManagedInvoices.filter((invoice) => invoice.status === 'overdue').length
    }),
    [latestManagedInvoices]
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
    if (activeTab !== 'management') {
      setManagementView('menu');
      setSelectedManagedUnitId(null);
      setUnitDetailBackView('invoices');
    }
  }, [activeTab]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isManager && activeTab === 'management') {
      setActiveTab('home');
    }
  }, [activeTab, isManager]);

  useEffect(() => {
    if (!isManager) {
      return;
    }

    if (managedSiteInvoicePlan) {
      setInvoiceAmountInput(String(managedSiteInvoicePlan.amount));
      setInvoiceDueDayInput(String(managedSiteInvoicePlan.dueDay));
      setInvoicePlanActive(managedSiteInvoicePlan.active);
      return;
    }

    setInvoiceAmountInput('');
    setInvoiceDueDayInput('10');
    setInvoicePlanActive(true);
  }, [isManager, managedSiteInvoicePlan]);

  if (!currentUser) {
    return null;
  }

  const user = currentUser;
  const canToggleAwayMode = user.role === 'resident';

  function openManagedUnitDetail(unitId: string, backView: 'invoices' | 'units' | 'packages') {
    setSelectedManagedUnitId(unitId);
    setUnitDetailBackView(backView);
    setManagementView('unit-detail');
  }

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
      holderName: passHolderName.trim()
    });

    setPassHolderName('');
    showToast({
      tone: 'success',
      message: 'Yeni QR geçişi oluşturuldu.'
    });
  }

  async function handleReceivePackage(packageId: string) {
    setActionLoading(true);
    try {
      await updatePackageStatus(packageId, 'delivered');
      showToast({ tone: 'success', message: 'Kargo teslim alındı olarak işaretlendi.' });
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Kargo kaydı güncellenemedi.'
      });
    } finally {
      setActionLoading(false);
    }
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

  async function handleSaveInvoicePlan() {
    if (!managedSite) {
      return;
    }

    const amount = Number(invoiceAmountInput.replace(',', '.'));
    const dueDay = Number(invoiceDueDayInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ tone: 'warning', message: 'Lütfen geçerli bir aidat tutarı girin.' });
      return;
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      showToast({ tone: 'warning', message: 'Aidat günü 1 ile 28 arasında olmalı.' });
      return;
    }

    setActionLoading(true);
    try {
      await upsertSiteInvoicePlan({
        siteId: managedSite.id,
        amount,
        dueDay,
        active: invoicePlanActive
      });

      showToast({
        tone: 'success',
        message: invoicePlanActive
          ? 'Aidat planı kaydedildi ve güncel kayıtlar oluşturuldu.'
          : 'Aidat planı pasife alındı.'
      });
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Aidat planı kaydedilemedi.'
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkInvoicePaid(invoiceId: string) {
    setActionLoading(true);
    try {
      await setInvoiceStatus(invoiceId, 'paid', user.fullName);
      showToast({ tone: 'success', message: 'Aidat ödendi olarak işaretlendi.' });
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Aidat kaydı güncellenemedi.'
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    setProfileMenuOpen(false);
    await logout();
  }

  let tabContent: ReactNode = null;

  if (activeTab === 'home') {
    tabContent = (
      <div className="space-y-3.5">
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2">
            <span className="truncate rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
              {residentUnitLabel}
            </span>
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
              <p className="mt-1 text-[10px] text-white/54">QR</p>
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
                      <p className="mt-3 text-[12px] text-white/46">{formatDateTime(item.createdAt)}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">QR</p>
            <p className="mt-2 font-heading text-[1.7rem] font-bold">{activePasses.length}</p>
            <p className="mt-1 text-[11px] text-[var(--color-accent)]">Aktif geçici erişim</p>
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
            {navigationItems.filter((item) => item.id !== 'home').map((item) => {
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
        <section className={SECTION_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Kapı akışı</p>
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Ziyaret ve girişler</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={CARD_CLASS}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Aktif çağrı</p>
              <p className="mt-3 font-heading text-[1.8rem] font-bold">{residentRequests.length}</p>
            </div>
            <div className={CARD_CLASS}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Aktif QR</p>
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
          <h2 className="mt-2 font-heading text-[1.35rem] font-bold">QR erişimi oluştur</h2>
          <div className="mt-4 space-y-3">
            <input
              className="app-input rounded-[18px] px-4 py-3.5"
              value={passHolderName}
              onChange={(event) => setPassHolderName(event.target.value)}
              placeholder="Misafir adı"
              type="text"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => void handleCreatePass()}
              className="app-button w-full rounded-[18px] px-4 py-3.5 text-[11px] uppercase tracking-[0.16em]"
            >
              QR oluştur
            </motion.button>
            <div className="space-y-3">
              {activePasses.length ? (
                activePasses.map((pass) => (
                  <div key={pass.id} className="rounded-[22px] border border-white/10 bg-black/12 p-4">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      <div className="rounded-[20px] bg-white p-3 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                        <AccessPassQrPreview value={pass.accessCode} alt={`${pass.holderName} için QR erişim kodu`} />
                      </div>
                      <div className="w-full min-w-0 flex-1 text-center sm:text-left">
                        <div>
                          <p className="font-semibold">{pass.holderName}</p>
                          <p className="mt-2 break-all font-mono text-[1.2rem] font-bold tracking-[0.24em] text-[var(--color-accent)] sm:text-[1.45rem]">
                            {pass.accessCode}
                          </p>
                        </div>
                        <p className="mt-3 text-[12px] text-white/46">Son geçerlilik: {formatDateTime(pass.expiresAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                  Aktif QR erişimi bulunmuyor.
                </div>
              )}
            </div>
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
              <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Kargolarım</h2>
            </div>
            {canToggleAwayMode ? (
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
              <p className="mt-2 font-heading text-[1.6rem] font-bold">{ownAtDeskPackages.length}</p>
            </div>
            <div className={`${CARD_CLASS} flex items-center justify-between`}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Teslimat modu</p>
                <p className="mt-2 text-sm font-semibold">{awayModeEnabled ? 'Evde yokum' : 'Standart'}</p>
              </div>
              <MoonStar className="h-5 w-5 text-[var(--color-accent)]" />
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
                      <p className="mt-2 text-[13px] text-white/58">Giriş zamanı: {formatDateTime(item.arrivedAt)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(item.status)}`}>
                      {packageStatusLabel(item.status)}
                    </span>
                  </div>
                  {item.status === 'at_desk' ? (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void handleReceivePackage(item.id)}
                      disabled={actionLoading}
                      className="mt-4 rounded-[14px] border border-[var(--color-accent)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] disabled:opacity-50"
                    >
                      TESLİM ALDIM
                    </motion.button>
                  ) : null}
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

  if (activeTab === 'management' && isManager) {
    tabContent = (
      <div className="space-y-4">
        {managementView === 'menu' ? (
          <>
            <section className={SECTION_CLASS}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Yönetim</p>
              <h2 className="mt-2 font-heading text-[1.35rem] font-bold">Site yönetim merkezi</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setManagementView('announcements')}
                  className={`${CARD_CLASS} text-left`}
                >
                  <Megaphone className="h-5 w-5 text-[var(--color-accent)]" />
                  <p className="mt-3 text-sm font-semibold">Duyuru Yap</p>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setManagementView('invoices')}
                  className={`${CARD_CLASS} text-left`}
                >
                  <CreditCard className="h-5 w-5 text-[var(--color-accent)]" />
                  <p className="mt-3 text-sm font-semibold">Aidatlar</p>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setManagementView('packages')}
                  className={`${CARD_CLASS} text-left`}
                >
                  <Package className="h-5 w-5 text-[var(--color-accent)]" />
                  <p className="mt-3 text-sm font-semibold">Site Kargoları</p>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setManagementView('units')}
                  className={`${CARD_CLASS} text-left`}
                >
                  <Building2 className="h-5 w-5 text-[var(--color-accent)]" />
                  <p className="mt-3 text-sm font-semibold">Siteler ve Daireler</p>
                </motion.button>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2.5">
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Bekleyen</p>
                <p className="mt-2 font-heading text-[1.55rem] font-bold">{managedPendingCount}</p>
              </div>
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Blok</p>
                <p className="mt-2 font-heading text-[1.55rem] font-bold">{visibleBuildings.length}</p>
              </div>
              <div className={CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">Plan</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-accent)]">
                  {managedSiteInvoicePlan ? `${managedSiteInvoicePlan.dueDay}. gün` : 'Hazır değil'}
                </p>
              </div>
            </section>
          </>
        ) : null}

        {managementView === 'announcements' ? (
          <>
            <section className={SECTION_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Duyuru Yap</p>
                  <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Yeni yayın oluştur</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setManagementView('menu')}
                  className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
                >
                  Geri
                </button>
              </div>
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
                  disabled={actionLoading}
                  className="app-button w-full rounded-[18px] px-4 py-3.5 text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
                >
                  Yayınla
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
                    Henüz duyuru yok.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}

        {managementView === 'invoices' ? (
          <>
            <section className={SECTION_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Aidat planı</p>
                  <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Aylık otomasyon</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setManagementView('menu')}
                  className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
                >
                  Geri
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className={CARD_CLASS}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Aylık tutar</span>
                  <input
                    className="app-input mt-3 rounded-[16px] px-3 py-3"
                    value={invoiceAmountInput}
                    onChange={(event) => setInvoiceAmountInput(event.target.value)}
                    inputMode="decimal"
                    placeholder="1850"
                    type="text"
                  />
                </label>
                <label className={CARD_CLASS}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Ayın günü</span>
                  <select
                    className="app-select mt-3 rounded-[16px] px-3 py-3"
                    value={invoiceDueDayInput}
                    onChange={(event) => setInvoiceDueDayInput(event.target.value)}
                  >
                    {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}. gün
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={`${CARD_CLASS} mt-3 flex items-center justify-between gap-3`}>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Plan durumu</p>
                  <p className="mt-2 text-sm font-semibold">
                    {invoicePlanActive
                      ? `Her ayın ${invoiceDueDayInput}. günü otomatik aidat oluşturulur.`
                      : 'Otomatik aidat üretimi kapalı.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoicePlanActive((current) => !current)}
                  className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    invoicePlanActive
                      ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.14)] text-[var(--color-accent)]'
                      : 'border-white/12 text-white/58'
                  }`}
                >
                  {invoicePlanActive ? 'Açık' : 'Kapalı'}
                </button>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => void handleSaveInvoicePlan()}
                disabled={actionLoading}
                className="app-button mt-3 w-full rounded-[18px] px-4 py-3.5 text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
              >
                Planı kaydet
              </motion.button>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className={CARD_CLASS}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Ödendi</p>
                  <p className="mt-2 font-heading text-[1.5rem] font-bold">{invoiceSnapshot.paid}</p>
                </div>
                <div className={CARD_CLASS}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Bekliyor</p>
                  <p className="mt-2 font-heading text-[1.5rem] font-bold">{invoiceSnapshot.waiting}</p>
                </div>
                <div className={CARD_CLASS}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Gecikmiş</p>
                  <p className="mt-2 font-heading text-[1.5rem] font-bold">{invoiceSnapshot.overdue}</p>
                </div>
              </div>
            </section>

            <section className={SECTION_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Aidat takibi</p>
                  <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Blok bazlı görünüm</h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                  {managedUnitsByBuilding.length} blok
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {managedUnitsByBuilding.length ? (
                  managedUnitsByBuilding.map(({ building, rows }) => (
                    <div key={building.id} className="rounded-[22px] border border-white/10 bg-black/12 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Blok</p>
                          <h3 className="mt-2 font-heading text-[1.1rem] font-bold">{building.name}</h3>
                        </div>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/58">
                          {rows.length} daire
                        </span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {rows.map((row) => {
                          const latestInvoice = latestInvoiceByUnit.get(row.unit.id) ?? null;

                          return (
                            <div key={row.unit.id} className={CARD_CLASS}>
                                <button
                                  type="button"
                                  onClick={() => openManagedUnitDetail(row.unit.id, 'invoices')}
                                  className="w-full text-left"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="inline-flex items-center gap-2 font-semibold text-[var(--color-accent)] underline decoration-white/0 underline-offset-4 transition hover:decoration-[var(--color-accent)]">
                                        {building.name} · Daire {row.unit.unitNumber}
                                        <ArrowUpRight className="h-4 w-4" />
                                      </p>
                                      <p className="mt-2 text-[13px] text-white/62">
                                        {row.resident?.fullName ?? 'Sakin atanmamış'}
                                    </p>
                                    <p className="mt-2 text-[12px] text-white/48">
                                      {latestInvoice
                                        ? `${latestInvoice.periodLabel} · ${formatCurrency(latestInvoice.amount)}`
                                        : 'Henüz aidat kaydı oluşmadı'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    {latestInvoice ? (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(latestInvoice.status)}`}
                                      >
                                        {invoiceStatusLabel(latestInvoice.status)}
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-white/54">
                                        Plan bekliyor
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                                      Kat {row.unit.floor}
                                    </span>
                                  </div>
                                </div>
                              </button>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <p className="text-[12px] text-white/48">
                                  {latestInvoice?.paidAt
                                    ? `Ödeme: ${formatDateTime(latestInvoice.paidAt)}`
                                    : latestInvoice
                                      ? `Son ödeme: ${formatDate(latestInvoice.dueDate)}`
                                      : 'Detay sayfasından geçmişi görüntüleyin'}
                                </p>
                                {latestInvoice && latestInvoice.status !== 'paid' ? (
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => void handleMarkInvoicePaid(latestInvoice.id)}
                                    disabled={actionLoading}
                                    className="rounded-[14px] border border-[var(--color-accent)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] disabled:opacity-50"
                                  >
                                    ÖDENDİ
                                  </motion.button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openManagedUnitDetail(row.unit.id, 'invoices')}
                                    className="rounded-[14px] border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/58"
                                  >
                                    Detay
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                    Görüntülenecek daire bulunmuyor.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}

        {managementView === 'packages' ? (
          <>
            <section className={SECTION_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Site kargoları</p>
                  <h2 className="mt-2 font-heading text-[1.2rem] font-bold">Genel teslimat görünümü</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setManagementView('menu')}
                  className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
                >
                  Geri
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className={CARD_CLASS}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Bekleyen</p>
                  <p className="mt-2 font-heading text-[1.5rem] font-bold">{managedAtDeskPackages.length}</p>
                </div>
                <div className={CARD_CLASS}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Toplam</p>
                  <p className="mt-2 font-heading text-[1.5rem] font-bold">{managedPackages.length}</p>
                </div>
                <div className={CARD_CLASS}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Blok</p>
                  <p className="mt-2 font-heading text-[1.5rem] font-bold">{visibleBuildings.length}</p>
                </div>
              </div>
            </section>

            <section className={SECTION_CLASS}>
              <div className="mt-1 space-y-3">
                {managedPackages.length ? (
                  managedPackages.map((item) => (
                    <div key={item.id} className={CARD_CLASS}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <button
                            type="button"
                            onClick={() => openManagedUnitDetail(item.unitId, 'packages')}
                            className="inline-flex items-center gap-2 text-left font-semibold text-[var(--color-accent)] underline decoration-white/0 underline-offset-4 transition hover:decoration-[var(--color-accent)]"
                          >
                            {unitLabel(state, item.unitId)}
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                          <p className="mt-2 text-[13px] text-white/62">{item.courierName}</p>
                          <p className="mt-2 text-[12px] text-white/48">Giriş: {formatDateTime(item.arrivedAt)}</p>
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
                    Görüntülenecek site kargosu bulunmuyor.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}

        {managementView === 'units' ? (
          <>
            <section className={SECTION_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Siteler ve daireler</p>
                  <h2 className="mt-2 font-heading text-[1.2rem] font-bold">{managedSite?.name ?? 'Site görünümü'}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setManagementView('menu')}
                  className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
                >
                  Geri
                </button>
              </div>
            </section>

            <section className={SECTION_CLASS}>
              <div className="space-y-4">
                {managedUnitsByBuilding.length ? (
                  managedUnitsByBuilding.map(({ building, rows }) => (
                    <div key={building.id} className="rounded-[22px] border border-white/10 bg-black/12 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-heading text-[1.1rem] font-bold">{building.name}</h3>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/58">
                          {rows.length} daire
                        </span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {rows.map((row) => (
                          <div key={row.unit.id} className={CARD_CLASS}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openManagedUnitDetail(row.unit.id, 'units')}
                                  className="inline-flex items-center gap-2 text-left font-semibold text-[var(--color-accent)] underline decoration-white/0 underline-offset-4 transition hover:decoration-[var(--color-accent)]"
                                >
                                  {building.name} · Daire {row.unit.unitNumber}
                                  <ArrowUpRight className="h-4 w-4" />
                                </button>
                                <p className="mt-2 text-[13px] text-white/62">
                                  {row.resident?.fullName ?? 'Sakin atanmamış'}
                                </p>
                              </div>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/54">
                                Kat {row.unit.floor}
                              </span>
                            </div>
                            <p className="mt-3 text-[12px] text-white/48">{row.resident?.phone ?? 'Telefon bilgisi yok'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                    Görüntülenecek daire kaydı bulunmuyor.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}

        {managementView === 'unit-detail' ? (
          selectedManagedUnitRow ? (
            <>
              <section className={SECTION_CLASS}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Daire detayı</p>
                    <h2 className="mt-2 font-heading text-[1.2rem] font-bold">
                      {(selectedManagedUnitRow.building?.name ?? 'Blok') + ` · Daire ${selectedManagedUnitRow.unit.unitNumber}`}
                    </h2>
                    <p className="mt-2 text-[13px] text-white/58">Kat {selectedManagedUnitRow.unit.floor}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManagementView(unitDetailBackView)}
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
                  >
                    Geri
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className={CARD_CLASS}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Sakin</p>
                    <p className="mt-2 font-semibold">
                      {selectedManagedUnitRow.resident?.fullName ?? 'Sakin atanmamış'}
                    </p>
                    <p className="mt-2 text-[12px] text-white/48">
                      {selectedManagedUnitRow.resident?.title ?? 'Daire sakini'}
                    </p>
                  </div>
                  <div className={CARD_CLASS}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Telefon</p>
                    <p className="mt-2 font-semibold">
                      {selectedManagedUnitRow.resident?.phone ?? 'Telefon bilgisi yok'}
                    </p>
                    {selectedManagedUnitRow.resident?.phone ? (
                      <a
                        href={`tel:${selectedManagedUnitRow.resident.phone}`}
                        className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]"
                      >
                        <Phone className="h-4 w-4" />
                        Ara
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className={SECTION_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">Aidat geçmişi</p>
                <div className="mt-4 space-y-3">
                  {selectedManagedUnitInvoices.length ? (
                    selectedManagedUnitInvoices.map((invoice) => (
                      <div key={invoice.id} className={CARD_CLASS}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{invoice.periodLabel}</p>
                            <p className="mt-2 text-[13px] text-white/58">{formatCurrency(invoice.amount)}</p>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusChipClass(invoice.status)}`}
                          >
                            {invoiceStatusLabel(invoice.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-[12px] text-white/46">Son ödeme: {formatDate(invoice.dueDate)}</p>
                        {invoice.paidAt ? (
                          <p className="mt-1 text-[12px] text-white/46">Ödendi: {formatDateTime(invoice.paidAt)}</p>
                        ) : null}
                        {invoice.status !== 'paid' ? (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.97 }}
                            onClick={() => void handleMarkInvoicePaid(invoice.id)}
                            disabled={actionLoading}
                            className="mt-4 rounded-[14px] border border-[var(--color-accent)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] disabled:opacity-50"
                          >
                            ÖDENDİ
                          </motion.button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-black/12 p-6 text-sm text-white/54">
                      Bu daire için aidat geçmişi bulunmuyor.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className={SECTION_CLASS}>
              <p className="text-sm text-white/58">Seçilen daire bulunamadı.</p>
            </section>
          )
        ) : null}
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
                <button
                  type="button"
                  onClick={toggleMode}
                  className="resident-card inline-flex h-9 w-9 items-center justify-center rounded-[14px] text-[var(--color-accent)] transition-transform active:scale-95"
                  aria-label={mode === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
                >
                  {mode === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                </button>
                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((current) => !current)}
                    className="resident-card inline-flex max-w-[160px] items-center gap-2 rounded-[14px] px-3 py-2 text-[12px] font-medium text-white/78 transition-transform active:scale-95"
                  >
                    <span className="truncate">{user.fullName}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {profileMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[156px] rounded-[16px] border border-white/10 bg-[#111317] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.3)]">
                      {user.unitCode ? (
                        <div className="rounded-[12px] border border-white/8 px-3 py-2 text-[11px] text-white/62">
                          Daire ID: {user.unitCode}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        className="mt-2 flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[12px] font-semibold text-white/78 transition hover:bg-white/6"
                      >
                        <LogOut className="h-4 w-4 text-[var(--color-accent)]" />
                        Çıkış yap
                      </button>
                    </div>
                  ) : null}
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
                <div className={`grid gap-1 ${isManager ? 'grid-cols-6' : 'grid-cols-5'}`}>
                  {navigationItems.map((item) => {
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
