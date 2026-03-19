'use client';

import {
  BellRing,
  Building2,
  Headset,
  LayoutDashboard,
  Megaphone,
  Plus,
  UserRoundCog,
  Wrench
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../providers/auth-provider';
import { usePortalData } from '../providers/portal-data-provider';
import { useToast } from '../providers/toast-provider';
import { BrandLogo } from '../ui/brand-logo';
import {
  buildUnitResidentRows,
  formatCurrency,
  formatDateTime,
  getAnnouncementsForUser,
  getRequestsForUser,
  getServiceProvidersForUser,
  getVisibleBuildings,
  getVisibleSites,
  getVisibleUnits,
  requestStatusLabel,
  requestTypeLabel,
  unitLabel
} from '@/lib/portal-selectors';
import type { Announcement, PortalRole, ProviderCategory } from '@/lib/portal-types';

type DashboardTab = 'overview' | 'structure' | 'assignments' | 'calls' | 'announcements' | 'services';
type SiteForm = { name: string; address: string; district: string; city: string };
type BuildingForm = { name: string; address: string; apiKey: string; doorLabel: string; kioskCode: string };
type UnitForm = { unitNumber: string; floor: string; buildingId: string };
type ResidentForm = { unitId: string; fullName: string; email: string; password: string; phone: string; title: string; loginId: string };
type ServiceForm = { fullName: string; category: ProviderCategory; phone: string; note: string };

const EMPTY_SITE_FORM: SiteForm = { name: '', address: '', district: '', city: '' };
const EMPTY_BUILDING_FORM: BuildingForm = { name: '', address: '', apiKey: '', doorLabel: '', kioskCode: '' };
const EMPTY_UNIT_FORM: UnitForm = { unitNumber: '', floor: '1', buildingId: '' };
const EMPTY_RESIDENT_FORM: ResidentForm = { unitId: '', fullName: '', email: '', password: '', phone: '', title: 'Daire Sakini', loginId: '' };
const EMPTY_SERVICE_FORM: ServiceForm = { fullName: '', category: 'Temizlik', phone: '', note: '' };

function roleTitle(role: PortalRole) {
  switch (role) {
    case 'super_admin':
      return 'Sistem yönetimi';
    case 'consultant':
      return 'Danışman operasyonu';
    case 'manager':
      return 'Site yönetimi';
    case 'resident':
      return 'Sakin paneli';
    case 'kiosk_device':
      return 'Giriş terminali';
  }
}

function at(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function newest<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((a, b) => at(b.createdAt) - at(a.createdAt));
}

function newestAnnouncements<T extends { publishedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => at(b.publishedAt) - at(a.publishedAt));
}

export function DashboardConsole() {
  const { session } = useAuth();
  const {
    state,
    createAnnouncement,
    createServiceProvider,
    createSite,
    updateSiteDetails,
    deleteSite,
    createBuilding,
    updateBuildingDetails,
    deleteBuilding,
    createUnit,
    updateUnitDetails,
    deleteUnit,
    createResident,
    assignSiteManager,
    setConsultantAssignment,
    updateServiceProviderDetails,
    deleteServiceProvider
  } = usePortalData();
  const { showToast } = useToast();

  const user = session?.user ?? null;
  const isSuperAdmin = user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [newSiteForm, setNewSiteForm] = useState<SiteForm>(EMPTY_SITE_FORM);
  const [siteForm, setSiteForm] = useState<SiteForm>(EMPTY_SITE_FORM);
  const [newBuildingForm, setNewBuildingForm] = useState<BuildingForm>(EMPTY_BUILDING_FORM);
  const [buildingForms, setBuildingForms] = useState<Record<string, BuildingForm>>({});
  const [newUnitForm, setNewUnitForm] = useState<UnitForm>(EMPTY_UNIT_FORM);
  const [unitForms, setUnitForms] = useState<Record<string, UnitForm>>({});
  const [residentForm, setResidentForm] = useState<ResidentForm>(EMPTY_RESIDENT_FORM);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', summary: '', category: 'Operasyon' as Announcement['category'] });
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM);
  const [serviceEditForms, setServiceEditForms] = useState<Record<string, ServiceForm>>({});

  const visibleSites = useMemo(() => (user ? getVisibleSites(state, user) : []), [state, user]);
  const visibleBuildings = useMemo(() => (user ? getVisibleBuildings(state, user) : []), [state, user]);
  const visibleUnits = useMemo(() => (user ? getVisibleUnits(state, user) : []), [state, user]);
  const visibleRequests = useMemo(() => (user ? getRequestsForUser(state, user) : []), [state, user]);
  const visibleAnnouncements = useMemo(() => (user ? getAnnouncementsForUser(state, user) : []), [state, user]);
  const visibleServices = useMemo(() => (user ? getServiceProvidersForUser(state, user) : []), [state, user]);

  useEffect(() => {
    if (!visibleSites.length) {
      setSelectedSiteId('');
      return;
    }

    if (!visibleSites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId(visibleSites[0].id);
    }
  }, [selectedSiteId, visibleSites]);

  useEffect(() => {
    if (!isSuperAdmin && ['structure', 'assignments'].includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, isSuperAdmin]);

  const activeSite = useMemo(
    () => visibleSites.find((site) => site.id === selectedSiteId) ?? visibleSites[0] ?? null,
    [selectedSiteId, visibleSites]
  );
  const activeSiteId = activeSite?.id ?? '';
  const siteBuildings = useMemo(() => visibleBuildings.filter((building) => building.siteId === activeSiteId), [activeSiteId, visibleBuildings]);
  const siteBuildingIds = useMemo(() => new Set(siteBuildings.map((building) => building.id)), [siteBuildings]);
  const siteUnits = useMemo(() => visibleUnits.filter((unit) => siteBuildingIds.has(unit.buildingId)), [siteBuildingIds, visibleUnits]);
  const siteUnitIds = useMemo(() => new Set(siteUnits.map((unit) => unit.id)), [siteUnits]);
  const siteRequests = useMemo(() => visibleRequests.filter((request) => siteBuildingIds.has(request.buildingId)), [siteBuildingIds, visibleRequests]);
  const siteAnnouncements = useMemo(() => visibleAnnouncements.filter((announcement) => announcement.siteId === activeSiteId), [activeSiteId, visibleAnnouncements]);
  const siteServices = useMemo(() => visibleServices.filter((service) => service.siteId === activeSiteId), [activeSiteId, visibleServices]);
  const siteInvoices = useMemo(() => state.invoices.filter((invoice) => siteUnitIds.has(invoice.unitId)), [siteUnitIds, state.invoices]);
  const siteLogs = useMemo(() => state.logs.filter((entry) => siteBuildingIds.has(entry.buildingId)).slice(0, 6), [siteBuildingIds, state.logs]);
  const residentRows = useMemo(() => buildUnitResidentRows(state, siteBuildings, siteUnits, state.profiles), [siteBuildings, siteUnits, state]);
  const siteResidents = useMemo(() => state.profiles.filter((profile) => (profile.role === 'resident' || profile.role === 'manager') && profile.unitId && siteUnitIds.has(profile.unitId)), [siteUnitIds, state.profiles]);
  const managerAssignment = useMemo(() => state.managerSiteAssignments.find((assignment) => assignment.siteId === activeSiteId) ?? null, [activeSiteId, state.managerSiteAssignments]);
  const siteManager = useMemo(() => state.profiles.find((profile) => profile.id === managerAssignment?.profileId) ?? null, [managerAssignment?.profileId, state.profiles]);
  const siteConsultants = useMemo(() => {
    const ids = new Set(state.consultantSiteAssignments.filter((assignment) => assignment.siteId === activeSiteId).map((assignment) => assignment.profileId));
    return state.profiles.filter((profile) => ids.has(profile.id));
  }, [activeSiteId, state.consultantSiteAssignments, state.profiles]);
  const consultantProfiles = useMemo(() => state.profiles.filter((profile) => profile.role === 'consultant'), [state.profiles]);
  const openCalls = useMemo(() => siteRequests.filter((request) => request.status === 'pending' || request.status === 'redirected'), [siteRequests]);
  const callMatches = useMemo(() => openCalls.map((request, index) => ({ request, consultant: siteConsultants.length ? siteConsultants[index % siteConsultants.length] ?? null : null })), [openCalls, siteConsultants]);
  const unpaidTotal = useMemo(() => siteInvoices.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0), [siteInvoices]);

  useEffect(() => {
    if (!activeSite) {
      return;
    }

    setSiteForm({ name: activeSite.name, address: activeSite.address, district: activeSite.district, city: activeSite.city });
    setBuildingForms(Object.fromEntries(siteBuildings.map((building) => [building.id, { name: building.name, address: building.address, apiKey: building.apiKey, doorLabel: building.doorLabel, kioskCode: building.kioskCode }])));
    setUnitForms(Object.fromEntries(siteUnits.map((unit) => [unit.id, { unitNumber: unit.unitNumber, floor: String(unit.floor), buildingId: unit.buildingId }])));
    setNewUnitForm((current) => ({ ...current, buildingId: current.buildingId || siteBuildings[0]?.id || '' }));
    setResidentForm((current) => ({ ...current, unitId: current.unitId || siteUnits[0]?.id || '' }));
    setSelectedManagerId(managerAssignment?.profileId ?? '');
    setServiceEditForms(Object.fromEntries(siteServices.map((service) => [service.id, { fullName: service.fullName, category: service.category, phone: service.phone, note: service.note }])));
  }, [activeSite, managerAssignment?.profileId, siteBuildings, siteServices, siteUnits]);

  if (!user) {
    return null;
  }

  const menuItems = ([{ id: 'overview', label: 'Genel görünüm', icon: LayoutDashboard }, isSuperAdmin ? { id: 'structure', label: 'Yerleşim', icon: Building2 } : null, isSuperAdmin ? { id: 'assignments', label: 'Atamalar', icon: UserRoundCog } : null, { id: 'calls', label: 'Görüşmeler', icon: Headset }, { id: 'announcements', label: 'Duyurular', icon: Megaphone }, { id: 'services', label: 'Hizmetler', icon: Wrench }] as const).filter(Boolean) as Array<{ id: DashboardTab; label: string; icon: typeof LayoutDashboard }>;

  async function run(task: () => Promise<void>, successMessage: string, tone: 'success' | 'info' = 'success') {
    try {
      await task();
      showToast({ tone, message: successMessage });
    } catch (error) {
      showToast({ tone: 'danger', message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' });
    }
  }

  let content: ReactNode = null;

  if (activeTab === 'overview') {
    content = (
      <div className="space-y-6">
        {isSuperAdmin ? (
          <section className="app-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="app-kicker">Yeni site</p>
                <h3 className="mt-2 font-heading text-2xl font-bold">Site ekle</h3>
              </div>
              <Plus className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.2fr_0.7fr_0.7fr_auto]">
              <input className="app-input px-4 py-4" value={newSiteForm.name} onChange={(event) => setNewSiteForm((current) => ({ ...current, name: event.target.value }))} placeholder="Site adı" type="text" />
              <input className="app-input px-4 py-4" value={newSiteForm.address} onChange={(event) => setNewSiteForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" type="text" />
              <input className="app-input px-4 py-4" value={newSiteForm.district} onChange={(event) => setNewSiteForm((current) => ({ ...current, district: event.target.value }))} placeholder="İlçe" type="text" />
              <input className="app-input px-4 py-4" value={newSiteForm.city} onChange={(event) => setNewSiteForm((current) => ({ ...current, city: event.target.value }))} placeholder="Şehir" type="text" />
              <button type="button" onClick={() => void run(async () => { await createSite(newSiteForm); setNewSiteForm(EMPTY_SITE_FORM); }, 'Site oluşturuldu.')} className="app-button px-5 py-4 text-sm uppercase tracking-[0.16em]">Ekle</button>
            </div>
          </section>
        ) : null}

        <div className="metric-grid lg:grid-cols-4">
          <div className="app-card p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Blok</p><p className="mt-3 font-heading text-4xl font-bold">{siteBuildings.length}</p></div>
          <div className="app-card p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Daire</p><p className="mt-3 font-heading text-4xl font-bold">{siteUnits.length}</p></div>
          <div className="app-card p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Açık görüşme</p><p className="mt-3 font-heading text-4xl font-bold">{openCalls.length}</p></div>
          <div className="app-card p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Açık bakiye</p><p className="mt-3 font-heading text-4xl font-bold">{formatCurrency(unpaidTotal)}</p></div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="app-card p-5">
            <p className="app-kicker">Site detayı</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">{activeSite?.name ?? 'Site seçin'}</h3>
            <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">{activeSite?.address}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Yönetici</p><p className="mt-3 font-semibold">{siteManager?.fullName ?? 'Atanmadı'}</p></div>
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Danışman</p><p className="mt-3 font-semibold">{siteConsultants.length}</p></div>
            </div>
            {isSuperAdmin ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <input className="app-input px-4 py-4" value={siteForm.name} onChange={(event) => setSiteForm((current) => ({ ...current, name: event.target.value }))} placeholder="Site adı" type="text" />
                  <input className="app-input px-4 py-4" value={siteForm.district} onChange={(event) => setSiteForm((current) => ({ ...current, district: event.target.value }))} placeholder="İlçe" type="text" />
                  <input className="app-input px-4 py-4 lg:col-span-2" value={siteForm.address} onChange={(event) => setSiteForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" type="text" />
                  <input className="app-input px-4 py-4" value={siteForm.city} onChange={(event) => setSiteForm((current) => ({ ...current, city: event.target.value }))} placeholder="Şehir" type="text" />
                </div>
                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={() => void run(() => updateSiteDetails({ siteId: activeSiteId, ...siteForm }), 'Site güncellendi.')} className="app-button px-4 py-3 text-xs uppercase tracking-[0.16em]">Kaydet</button>
                  <button type="button" onClick={() => void run(() => deleteSite(activeSiteId), 'Site silindi.', 'info')} className="app-button-secondary px-4 py-3 text-xs uppercase tracking-[0.16em]">Sil</button>
                </div>
              </>
            ) : null}
          </section>

          <section className="app-card p-5">
            <p className="app-kicker">Canlı akış</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">Ziyaretçi, sakin ve yayınlar</h3>
            <div className="mt-5 space-y-3">
              {siteRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold">{request.guestName}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{requestTypeLabel(request.type)} · {unitLabel(state, request.unitId)}</p></div>
                    <span className="text-xs font-semibold text-[var(--color-accent)]">{requestStatusLabel(request.status)}</span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">{formatDateTime(request.createdAt)}</p>
                </div>
              ))}
              {newest(siteResidents).slice(0, 2).map((resident) => (
                <div key={resident.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                  <p className="font-semibold">{resident.fullName}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{resident.unitId ? unitLabel(state, resident.unitId) : 'Daire eşleşmesi yok'}</p>
                </div>
              ))}
              {newestAnnouncements(siteAnnouncements).slice(0, 2).map((announcement) => (
                <div key={announcement.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                  <p className="font-semibold">{announcement.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{announcement.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (activeTab === 'structure' && isSuperAdmin) {
    content = (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="app-card p-5">
            <p className="app-kicker">Yeni sakin</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">Sakin hesabı aç</h3>
            <div className="mt-5 space-y-3">
              <select className="app-select px-4 py-4" value={residentForm.unitId} onChange={(event) => setResidentForm((current) => ({ ...current, unitId: event.target.value }))}>{siteUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(state, unit.id)}</option>)}</select>
              <input className="app-input px-4 py-4" value={residentForm.fullName} onChange={(event) => setResidentForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ad soyad" type="text" />
              <div className="grid gap-3 md:grid-cols-2">
                <input className="app-input px-4 py-4" value={residentForm.phone} onChange={(event) => setResidentForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon" type="text" />
                <input className="app-input px-4 py-4" value={residentForm.loginId} onChange={(event) => setResidentForm((current) => ({ ...current, loginId: event.target.value }))} placeholder="Giriş kimliği" type="text" />
              </div>
              <input className="app-input px-4 py-4" value={residentForm.email} onChange={(event) => setResidentForm((current) => ({ ...current, email: event.target.value }))} placeholder="E-posta" type="email" />
              <div className="grid gap-3 md:grid-cols-2">
                <input className="app-input px-4 py-4" value={residentForm.password} onChange={(event) => setResidentForm((current) => ({ ...current, password: event.target.value }))} placeholder="Geçici şifre" type="text" />
                <input className="app-input px-4 py-4" value={residentForm.title} onChange={(event) => setResidentForm((current) => ({ ...current, title: event.target.value }))} placeholder="Unvan" type="text" />
              </div>
              <button type="button" onClick={() => void run(async () => { await createResident(residentForm); setResidentForm({ ...EMPTY_RESIDENT_FORM, unitId: siteUnits[0]?.id ?? '' }); }, 'Yeni sakin oluşturuldu.')} className="app-button w-full px-5 py-4 text-sm uppercase tracking-[0.16em]">Sakin ekle</button>
            </div>
          </section>

          <section className="app-card p-5">
            <p className="app-kicker">Blok ve daire</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">Yerleşim CRUD</h3>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <input className="app-input px-4 py-4" value={newBuildingForm.name} onChange={(event) => setNewBuildingForm((current) => ({ ...current, name: event.target.value }))} placeholder="Blok adı" type="text" />
              <input className="app-input px-4 py-4" value={newBuildingForm.doorLabel} onChange={(event) => setNewBuildingForm((current) => ({ ...current, doorLabel: event.target.value }))} placeholder="Kapı etiketi" type="text" />
              <input className="app-input px-4 py-4 lg:col-span-2" value={newBuildingForm.address} onChange={(event) => setNewBuildingForm((current) => ({ ...current, address: event.target.value }))} placeholder="Blok adresi" type="text" />
              <input className="app-input px-4 py-4" value={newBuildingForm.apiKey} onChange={(event) => setNewBuildingForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder="API anahtarı" type="text" />
              <input className="app-input px-4 py-4" value={newBuildingForm.kioskCode} onChange={(event) => setNewBuildingForm((current) => ({ ...current, kioskCode: event.target.value }))} placeholder="Terminal kodu" type="text" />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void run(async () => { await createBuilding({ siteId: activeSiteId, ...newBuildingForm }); setNewBuildingForm(EMPTY_BUILDING_FORM); }, 'Blok oluşturuldu.')} className="app-button px-4 py-3 text-xs uppercase tracking-[0.16em]">Blok ekle</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.7fr_0.9fr_auto]">
              <select className="app-select px-4 py-4" value={newUnitForm.buildingId} onChange={(event) => setNewUnitForm((current) => ({ ...current, buildingId: event.target.value }))}>{siteBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select>
              <input className="app-input px-4 py-4" value={newUnitForm.unitNumber} onChange={(event) => setNewUnitForm((current) => ({ ...current, unitNumber: event.target.value }))} placeholder="Daire no" type="text" />
              <input className="app-input px-4 py-4" value={newUnitForm.floor} onChange={(event) => setNewUnitForm((current) => ({ ...current, floor: event.target.value }))} placeholder="Kat" type="number" />
              <button type="button" onClick={() => void run(async () => { await createUnit({ buildingId: newUnitForm.buildingId, unitNumber: newUnitForm.unitNumber, floor: Number(newUnitForm.floor) }); setNewUnitForm((current) => ({ ...EMPTY_UNIT_FORM, buildingId: current.buildingId })); }, 'Daire oluşturuldu.')} className="app-button px-4 py-3 text-xs uppercase tracking-[0.16em]">Daire ekle</button>
            </div>
          </section>
        </div>

        <section className="app-card overflow-hidden p-0">
          <div className="border-b-2 border-[var(--color-line)] px-5 py-4"><p className="app-kicker">Yerleşim listesi</p><h3 className="mt-2 font-heading text-2xl font-bold">Bloklar ve daireler</h3></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Blok</th><th>Daire</th><th>Kat</th><th>Sakin</th><th>İşlem</th></tr></thead>
              <tbody>
                {siteUnits.map((unit) => {
                  const form = unitForms[unit.id] ?? EMPTY_UNIT_FORM;
                  const building = siteBuildings.find((entry) => entry.id === unit.buildingId);
                  const resident = residentRows.find((row) => row.unit.id === unit.id)?.resident ?? null;
                  return (
                    <tr key={unit.id}>
                      <td>{building?.name ?? '-'}</td>
                      <td><input className="app-input px-3 py-2" value={form.unitNumber} onChange={(event) => setUnitForms((current) => ({ ...current, [unit.id]: { ...form, unitNumber: event.target.value } }))} type="text" /></td>
                      <td><input className="app-input px-3 py-2" value={form.floor} onChange={(event) => setUnitForms((current) => ({ ...current, [unit.id]: { ...form, floor: event.target.value } }))} type="number" /></td>
                      <td>{resident?.fullName ?? 'Atanmadı'}</td>
                      <td><div className="flex flex-wrap gap-2"><button type="button" className="app-button-secondary px-3 py-2 text-[11px] uppercase tracking-[0.16em]" onClick={() => void run(() => updateUnitDetails({ unitId: unit.id, unitNumber: form.unitNumber, floor: Number(form.floor) }), 'Daire güncellendi.')}>Kaydet</button><button type="button" className="app-button-secondary px-3 py-2 text-[11px] uppercase tracking-[0.16em]" onClick={() => void run(() => deleteUnit(unit.id), 'Daire silindi.', 'info')}>Sil</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t-2 border-[var(--color-line)] px-5 py-4">
            <div className="grid gap-3">
              {siteBuildings.map((building) => {
                const form = buildingForms[building.id] ?? EMPTY_BUILDING_FORM;
                return (
                  <div key={building.id} className="rounded-md border-2 border-[var(--color-line)] p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_1fr_1fr_auto]">
                      <input className="app-input px-4 py-4" value={form.name} onChange={(event) => setBuildingForms((current) => ({ ...current, [building.id]: { ...form, name: event.target.value } }))} type="text" />
                      <input className="app-input px-4 py-4" value={form.address} onChange={(event) => setBuildingForms((current) => ({ ...current, [building.id]: { ...form, address: event.target.value } }))} type="text" />
                      <input className="app-input px-4 py-4" value={form.doorLabel} onChange={(event) => setBuildingForms((current) => ({ ...current, [building.id]: { ...form, doorLabel: event.target.value } }))} type="text" />
                      <input className="app-input px-4 py-4" value={form.kioskCode} onChange={(event) => setBuildingForms((current) => ({ ...current, [building.id]: { ...form, kioskCode: event.target.value } }))} type="text" />
                      <div className="flex flex-wrap gap-2"><button type="button" className="app-button px-3 py-2 text-[11px] uppercase tracking-[0.16em]" onClick={() => void run(() => updateBuildingDetails({ buildingId: building.id, ...form }), 'Blok güncellendi.')}>Kaydet</button><button type="button" className="app-button-secondary px-3 py-2 text-[11px] uppercase tracking-[0.16em]" onClick={() => void run(() => deleteBuilding(building.id), 'Blok silindi.', 'info')}>Sil</button></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'assignments' && isSuperAdmin) {
    content = (
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="app-card p-5">
          <p className="app-kicker">Site yöneticisi</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Sakinler arasından seç</h3>
          <div className="mt-5 space-y-3">
            <select className="app-select px-4 py-4" value={selectedManagerId} onChange={(event) => setSelectedManagerId(event.target.value)}>
              <option value="">Yönetici atanmasın</option>
              {siteResidents.map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName} · {profile.unitId ? unitLabel(state, profile.unitId) : 'Daire yok'}</option>)}
            </select>
            <button type="button" onClick={() => void run(() => assignSiteManager({ siteId: activeSiteId, profileId: selectedManagerId || null }), selectedManagerId ? 'Site yöneticisi atandı.' : 'Yönetici kaldırıldı.')} className="app-button w-full px-5 py-4 text-sm uppercase tracking-[0.16em]">Kaydet</button>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Mevcut yönetici</p><p className="mt-3 font-semibold">{siteManager?.fullName ?? 'Atanmadı'}</p></div>
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Danışmanlar</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Site atamaları</h3>
          <div className="mt-5 space-y-3">
            {consultantProfiles.map((profile) => {
              const assigned = state.consultantSiteAssignments.some((assignment) => assignment.siteId === activeSiteId && assignment.profileId === profile.id);
              return (
                <div key={profile.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="font-semibold">{profile.fullName}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{profile.phone}</p></div>
                    <button type="button" onClick={() => void run(() => setConsultantAssignment({ siteId: activeSiteId, profileId: profile.id, assigned: !assigned }), assigned ? 'Danışman ataması kaldırıldı.' : 'Danışman atandı.', 'info')} className={assigned ? 'app-button-secondary px-4 py-3 text-xs uppercase tracking-[0.16em]' : 'app-button px-4 py-3 text-xs uppercase tracking-[0.16em]'}>{assigned ? 'Kaldır' : 'Ata'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'calls') {
    content = (
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="app-card p-5">
          <p className="app-kicker">Canlı görüşmeler</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Açık kayıtlar</h3>
          <div className="mt-5 space-y-3">
            {callMatches.length ? callMatches.map(({ request, consultant }) => (
              <div key={request.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{request.guestName}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{unitLabel(state, request.unitId)} · {requestTypeLabel(request.type)}</p></div>
                  <div className="text-right"><p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Danışman</p><p className="mt-2 font-semibold text-[var(--color-accent)]">{consultant?.fullName ?? 'Havuz'}</p></div>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted)]">{formatDateTime(request.createdAt)}</p>
              </div>
            )) : <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">Aktif görüşme görünmüyor.</div>}
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Geçmiş</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Önceki log kayıtları</h3>
          <div className="mt-5 space-y-3">
            {siteLogs.length ? siteLogs.map((log) => (
              <div key={log.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-sm leading-6">{log.eventDetails}</p>
                <p className="mt-3 text-xs text-[var(--color-muted)]">{formatDateTime(log.timestamp)}</p>
              </div>
            )) : <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">Log kaydı bulunmuyor.</div>}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'announcements') {
    content = (
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="app-card p-5">
          <p className="app-kicker">Yeni duyuru</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Siteye yayın yap</h3>
          <div className="mt-5 space-y-3">
            <input className="app-input px-4 py-4" value={announcementForm.title} onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))} placeholder="Başlık" type="text" />
            <select className="app-select px-4 py-4" value={announcementForm.category} onChange={(event) => setAnnouncementForm((current) => ({ ...current, category: event.target.value as Announcement['category'] }))}><option value="Operasyon">Operasyon</option><option value="Güvenlik">Güvenlik</option><option value="Yönetim">Yönetim</option></select>
            <textarea className="app-textarea min-h-[140px] px-4 py-4" value={announcementForm.summary} onChange={(event) => setAnnouncementForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Metin" />
            <button type="button" onClick={() => void run(async () => { await createAnnouncement({ siteId: activeSiteId, title: announcementForm.title, summary: announcementForm.summary, category: announcementForm.category }); setAnnouncementForm({ title: '', summary: '', category: 'Operasyon' }); }, 'Duyuru yayınlandı.')} className="app-button w-full px-5 py-4 text-sm uppercase tracking-[0.16em]">Yayınla</button>
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Duyurular</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Yayın listesi</h3>
          <div className="mt-5 space-y-3">
            {newestAnnouncements(siteAnnouncements).map((announcement) => (
              <div key={announcement.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{announcement.title}</p><p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{announcement.summary}</p></div>
                  <span className="text-xs font-semibold text-[var(--color-accent)]">{announcement.category}</span>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted)]">{formatDateTime(announcement.publishedAt)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'services') {
    content = (
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="app-card p-5">
          <p className="app-kicker">Yeni hizmet</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Siteye hizmet ekle</h3>
          <div className="mt-5 space-y-3">
            <input className="app-input px-4 py-4" value={serviceForm.fullName} onChange={(event) => setServiceForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Firma veya kişi adı" type="text" />
            <select className="app-select px-4 py-4" value={serviceForm.category} onChange={(event) => setServiceForm((current) => ({ ...current, category: event.target.value as ProviderCategory }))}><option value="Temizlik">Temizlik</option><option value="Elektrik">Elektrik</option><option value="Tesisat">Tesisat</option><option value="Asansör">Asansör</option><option value="Nakliyat">Nakliyat</option><option value="Peyzaj">Peyzaj</option></select>
            <input className="app-input px-4 py-4" value={serviceForm.phone} onChange={(event) => setServiceForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon" type="text" />
            <textarea className="app-textarea min-h-[120px] px-4 py-4" value={serviceForm.note} onChange={(event) => setServiceForm((current) => ({ ...current, note: event.target.value }))} placeholder="Not" />
            <button type="button" onClick={() => void run(async () => { await createServiceProvider({ siteId: activeSiteId, ...serviceForm }); setServiceForm(EMPTY_SERVICE_FORM); }, 'Hizmet kaydı eklendi.')} className="app-button w-full px-5 py-4 text-sm uppercase tracking-[0.16em]">Kaydı ekle</button>
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Hizmet kayıtları</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Düzenle veya sil</h3>
          <div className="mt-5 space-y-3">
            {siteServices.map((service) => {
              const form = serviceEditForms[service.id] ?? EMPTY_SERVICE_FORM;
              return (
                <div key={service.id} className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input className="app-input px-4 py-4" value={form.fullName} onChange={(event) => setServiceEditForms((current) => ({ ...current, [service.id]: { ...form, fullName: event.target.value } }))} type="text" />
                    <select className="app-select px-4 py-4" value={form.category} onChange={(event) => setServiceEditForms((current) => ({ ...current, [service.id]: { ...form, category: event.target.value as ProviderCategory } }))}><option value="Temizlik">Temizlik</option><option value="Elektrik">Elektrik</option><option value="Tesisat">Tesisat</option><option value="Asansör">Asansör</option><option value="Nakliyat">Nakliyat</option><option value="Peyzaj">Peyzaj</option></select>
                    <input className="app-input px-4 py-4" value={form.phone} onChange={(event) => setServiceEditForms((current) => ({ ...current, [service.id]: { ...form, phone: event.target.value } }))} type="text" />
                    <textarea className="app-textarea min-h-[92px] px-4 py-4 lg:col-span-2" value={form.note} onChange={(event) => setServiceEditForms((current) => ({ ...current, [service.id]: { ...form, note: event.target.value } }))} />
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => void run(() => updateServiceProviderDetails({ providerId: service.id, ...form }), 'Hizmet güncellendi.')} className="app-button px-4 py-3 text-xs uppercase tracking-[0.16em]">Kaydet</button>
                    <button type="button" onClick={() => void run(() => deleteServiceProvider(service.id), 'Hizmet silindi.', 'info')} className="app-button-secondary px-4 py-3 text-xs uppercase tracking-[0.16em]">Sil</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="app-shell grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="app-panel h-fit px-5 py-6">
          <BrandLogo size="md" />
          <h1 className="mt-5 font-heading text-4xl font-bold">{roleTitle(user.role)}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">Siteleri seçin, akışı izleyin ve yönetim işlemlerini buradan yürütün.</p>
          <div className="mt-6 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Siteler</p>
            <div className="mt-4 space-y-3">
              {visibleSites.map((site) => (
                <button key={site.id} type="button" onClick={() => setSelectedSiteId(site.id)} data-active={activeSiteId === site.id} className="w-full rounded-md border-2 border-[var(--color-line)] px-3 py-3 text-left transition hover:-translate-y-0.5 data-[active=true]:border-[var(--color-accent)] data-[active=true]:bg-[var(--color-accent-soft)]">
                  <p className="font-semibold">{site.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{site.district} · {site.city}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" data-active={activeTab === item.id} onClick={() => setActiveTab(item.id)} className="sidebar-link">
                  <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-6">
          <header className="app-panel px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="app-kicker">Aktif saha</p>
                <h2 className="mt-3 font-heading text-4xl font-bold">{activeSite?.name ?? 'Site seçin'}</h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--color-muted)]">{activeSite ? `${activeSite.address} · ${activeSite.district} / ${activeSite.city}` : 'Soldan bir site seçin.'}</p>
              </div>
              <div className="flex items-center gap-3 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3">
                <BellRing className="h-5 w-5 text-[var(--color-accent)]" />
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Açık görüşme</p><p className="font-semibold">{openCalls.length}</p></div>
              </div>
            </div>
          </header>
          {content}
        </section>
      </div>
    </main>
  );
}
