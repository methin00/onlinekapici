'use client';

import {
  BellRing,
  Building2,
  Headset,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  Plus,
  UserRoundCog,
  Wrench
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../providers/auth-provider';
import {
  usePortalData,
  type GeneratedAccountCredentials
} from '../providers/portal-data-provider';
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

type DashboardTab =
  | 'overview'
  | 'structure'
  | 'assignments'
  | 'calls'
  | 'announcements'
  | 'services';

type SiteForm = {
  name: string;
  address: string;
  district: string;
  city: string;
};

type BuildingForm = {
  name: string;
  address: string;
  apiKey: string;
  doorLabel: string;
  kioskCode: string;
};

type UnitForm = {
  unitNumber: string;
  floor: string;
  buildingId: string;
};

type ResidentForm = {
  unitId: string;
  fullName: string;
  phone: string;
  title: string;
};

type ConsultantForm = {
  fullName: string;
  phone: string;
};

type ServiceForm = {
  fullName: string;
  category: ProviderCategory;
  phone: string;
  note: string;
};

type SitePlanDistributionMode = 'equal' | 'custom';

type SitePlanBlockForm = {
  id: string;
  name: string;
  address: string;
  doorLabel: string;
  floorCount: string;
  distributionMode: SitePlanDistributionMode;
  totalUnits: string;
  floorUnitCounts: string[];
};

type SiteSetupForm = SiteForm & {
  blocks: SitePlanBlockForm[];
};

const EMPTY_SITE_FORM: SiteForm = {
  name: '',
  address: '',
  district: '',
  city: ''
};

const EMPTY_BUILDING_FORM: BuildingForm = {
  name: '',
  address: '',
  apiKey: '',
  doorLabel: '',
  kioskCode: ''
};

const EMPTY_UNIT_FORM: UnitForm = {
  unitNumber: '',
  floor: '1',
  buildingId: ''
};

const EMPTY_RESIDENT_FORM: ResidentForm = {
  unitId: '',
  fullName: '',
  phone: '',
  title: ''
};

const EMPTY_CONSULTANT_FORM: ConsultantForm = {
  fullName: '',
  phone: ''
};

const EMPTY_SERVICE_FORM: ServiceForm = {
  fullName: '',
  category: 'Temizlik',
  phone: '',
  note: ''
};

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSitePlanBlock(index: number): SitePlanBlockForm {
  return {
    id: createClientId(),
    name: '',
    address: '',
    doorLabel: '',
    floorCount: '',
    distributionMode: 'equal',
    totalUnits: '',
    floorUnitCounts: ['']
  };
}

function createEmptySiteSetupForm(): SiteSetupForm {
  return {
    ...EMPTY_SITE_FORM,
    blocks: [createSitePlanBlock(0)]
  };
}

function roleTitle(role: PortalRole) {
  switch (role) {
    case 'super_admin':
      return 'Sistem Yönetimi';
    case 'consultant':
      return 'Danışman Operasyonu';
    case 'manager':
      return 'Site Yönetimi';
    case 'resident':
      return 'Sakin paneli';
    case 'kiosk_device':
      return 'Giriş Terminali';
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

function parsePositiveInteger(value: string, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function resizeFloorUnitCounts(counts: string[], floorCountValue: string) {
  const floorCount = Math.max(1, parsePositiveInteger(floorCountValue, 1));
  return Array.from({ length: floorCount }, (_, index) => counts[index] ?? '0');
}

function getEqualDistribution(totalUnitsValue: string, floorCountValue: string) {
  const floorCount = Math.max(1, parsePositiveInteger(floorCountValue, 1));
  const totalUnits = parseNonNegativeInteger(totalUnitsValue, 0);

  if (totalUnits <= 0) {
    return Array.from({ length: floorCount }, () => 0);
  }

  const base = Math.floor(totalUnits / floorCount);
  const remainder = totalUnits % floorCount;

  return Array.from({ length: floorCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildPlannedUnitsForFloorCounts(floorCounts: number[]) {
  return floorCounts.flatMap((count, floorIndex) =>
    Array.from({ length: count }, (_, unitIndex) => ({
      floor: floorIndex + 1,
      unitNumber: `${floorIndex + 1}${String(unitIndex + 1).padStart(2, '0')}`
    }))
  );
}

function getPlannedUnitsForBlock(block: SitePlanBlockForm) {
  const floorCounts =
    block.distributionMode === 'equal'
      ? getEqualDistribution(block.totalUnits, block.floorCount)
      : resizeFloorUnitCounts(block.floorUnitCounts, block.floorCount).map((value) =>
          parseNonNegativeInteger(value, 0)
        );

  return buildPlannedUnitsForFloorCounts(floorCounts);
}

function getPlannedUnitCountForBlock(block: SitePlanBlockForm) {
  return getPlannedUnitsForBlock(block).length;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export function DashboardConsole() {
  const { session } = useAuth();
  const {
    state,
    refreshState,
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
    updateResident,
    deleteResident,
    createConsultant,
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
  const [selectedBuildingFilterId, setSelectedBuildingFilterId] = useState('all');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [siteSetupForm, setSiteSetupForm] = useState<SiteSetupForm>(createEmptySiteSetupForm());
  const [siteForm, setSiteForm] = useState<SiteForm>(EMPTY_SITE_FORM);
  const [buildingForms, setBuildingForms] = useState<Record<string, BuildingForm>>({});
  const [unitForms, setUnitForms] = useState<Record<string, UnitForm>>({});
  const [residentForm, setResidentForm] = useState<ResidentForm>(EMPTY_RESIDENT_FORM);
  const [consultantForm, setConsultantForm] = useState<ConsultantForm>(EMPTY_CONSULTANT_FORM);
  const [lastCreatedCredentials, setLastCreatedCredentials] =
    useState<GeneratedAccountCredentials | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    summary: '',
    category: 'Operasyon' as Announcement['category']
  });
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM);
  const [serviceEditForms, setServiceEditForms] = useState<Record<string, ServiceForm>>({});

  const visibleSites = useMemo(
    () => (user ? getVisibleSites(state, user) : []),
    [state, user]
  );
  const visibleBuildings = useMemo(
    () => (user ? getVisibleBuildings(state, user) : []),
    [state, user]
  );
  const visibleUnits = useMemo(
    () => (user ? getVisibleUnits(state, user) : []),
    [state, user]
  );
  const visibleRequests = useMemo(
    () => (user ? getRequestsForUser(state, user) : []),
    [state, user]
  );
  const visibleAnnouncements = useMemo(
    () => (user ? getAnnouncementsForUser(state, user) : []),
    [state, user]
  );
  const visibleServices = useMemo(
    () => (user ? getServiceProvidersForUser(state, user) : []),
    [state, user]
  );

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

  const siteBuildings = useMemo(
    () => sortByName(visibleBuildings.filter((building) => building.siteId === activeSiteId)),
    [activeSiteId, visibleBuildings]
  );
  const siteBuildingIds = useMemo(
    () => new Set(siteBuildings.map((building) => building.id)),
    [siteBuildings]
  );
  const siteUnits = useMemo(
    () => visibleUnits.filter((unit) => siteBuildingIds.has(unit.buildingId)),
    [siteBuildingIds, visibleUnits]
  );
  const siteUnitIds = useMemo(() => new Set(siteUnits.map((unit) => unit.id)), [siteUnits]);
  const siteRequests = useMemo(
    () => visibleRequests.filter((request) => siteBuildingIds.has(request.buildingId)),
    [siteBuildingIds, visibleRequests]
  );
  const siteAnnouncements = useMemo(
    () => visibleAnnouncements.filter((announcement) => announcement.siteId === activeSiteId),
    [activeSiteId, visibleAnnouncements]
  );
  const siteServices = useMemo(
    () => visibleServices.filter((service) => service.siteId === activeSiteId),
    [activeSiteId, visibleServices]
  );
  const siteInvoices = useMemo(
    () => state.invoices.filter((invoice) => siteUnitIds.has(invoice.unitId)),
    [siteUnitIds, state.invoices]
  );
  const siteLogs = useMemo(
    () => state.logs.filter((entry) => siteBuildingIds.has(entry.buildingId)).slice(0, 6),
    [siteBuildingIds, state.logs]
  );
  const residentRows = useMemo(
    () => buildUnitResidentRows(state, siteBuildings, siteUnits, state.profiles),
    [siteBuildings, siteUnits, state]
  );
  const siteResidents = useMemo(
    () =>
      state.profiles.filter(
        (profile) =>
          (profile.role === 'resident' || profile.role === 'manager') &&
          profile.unitId &&
          siteUnitIds.has(profile.unitId)
      ),
    [siteUnitIds, state.profiles]
  );
  const managerAssignment = useMemo(
    () =>
      state.managerSiteAssignments.find((assignment) => assignment.siteId === activeSiteId) ?? null,
    [activeSiteId, state.managerSiteAssignments]
  );
  const siteManager = useMemo(
    () => state.profiles.find((profile) => profile.id === managerAssignment?.profileId) ?? null,
    [managerAssignment?.profileId, state.profiles]
  );
  const siteConsultants = useMemo(() => {
    const ids = new Set(
      state.consultantSiteAssignments
        .filter((assignment) => assignment.siteId === activeSiteId)
        .map((assignment) => assignment.profileId)
    );

    return state.profiles.filter((profile) => ids.has(profile.id));
  }, [activeSiteId, state.consultantSiteAssignments, state.profiles]);
  const consultantProfiles = useMemo(
    () => state.profiles.filter((profile) => profile.role === 'consultant'),
    [state.profiles]
  );
  const openCalls = useMemo(
    () =>
      siteRequests.filter(
        (request) => request.status === 'pending' || request.status === 'redirected'
      ),
    [siteRequests]
  );
  const callMatches = useMemo(
    () =>
      openCalls.map((request, index) => ({
        request,
        consultant: siteConsultants.length
          ? siteConsultants[index % siteConsultants.length] ?? null
          : null
      })),
    [openCalls, siteConsultants]
  );
  const unpaidTotal = useMemo(
    () =>
      siteInvoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    [siteInvoices]
  );
  const totalPlannedUnits = useMemo(
    () => siteSetupForm.blocks.reduce((sum, block) => sum + getPlannedUnitCountForBlock(block), 0),
    [siteSetupForm.blocks]
  );

  const buildingUnitCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const unit of siteUnits) {
      counts.set(unit.buildingId, (counts.get(unit.buildingId) ?? 0) + 1);
    }

    return counts;
  }, [siteUnits]);

  const buildingOccupiedCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const row of residentRows) {
      if (!row.resident) {
        continue;
      }

      counts.set(row.unit.buildingId, (counts.get(row.unit.buildingId) ?? 0) + 1);
    }

    return counts;
  }, [residentRows]);

  const filteredResidentRows = useMemo(() => {
    const rows =
      selectedBuildingFilterId === 'all'
        ? residentRows
        : residentRows.filter((row) => row.unit.buildingId === selectedBuildingFilterId);

    return [...rows].sort((left, right) => {
      const buildingCompare = (left.building?.name ?? '').localeCompare(
        right.building?.name ?? '',
        'tr'
      );

      if (buildingCompare !== 0) {
        return buildingCompare;
      }

      if (left.unit.floor !== right.unit.floor) {
        return left.unit.floor - right.unit.floor;
      }

      return left.unit.unitNumber.localeCompare(right.unit.unitNumber, 'tr', {
        numeric: true
      });
    });
  }, [residentRows, selectedBuildingFilterId]);

  const emptyResidentRows = useMemo(
    () => residentRows.filter((row) => !row.resident),
    [residentRows]
  );

  const assignableResidentRows = useMemo(() => {
    const filteredEmpty = filteredResidentRows.filter((row) => !row.resident);
    return filteredEmpty.length ? filteredEmpty : emptyResidentRows;
  }, [emptyResidentRows, filteredResidentRows]);

  const selectedResidentRow = useMemo(() => {
    if (!filteredResidentRows.length) {
      return null;
    }

    return filteredResidentRows.find((row) => row.unit.id === selectedUnitId) ?? filteredResidentRows[0];
  }, [filteredResidentRows, selectedUnitId]);

  const selectedUnit = selectedResidentRow?.unit ?? null;
  const selectedBuilding = selectedResidentRow?.building ?? null;
  const selectedResident = selectedResidentRow?.resident ?? null;
  const selectedUnitForm = selectedUnit ? unitForms[selectedUnit.id] ?? EMPTY_UNIT_FORM : EMPTY_UNIT_FORM;

  useEffect(() => {
    if (selectedBuildingFilterId === 'all') {
      return;
    }

    if (!siteBuildings.some((building) => building.id === selectedBuildingFilterId)) {
      setSelectedBuildingFilterId('all');
    }
  }, [selectedBuildingFilterId, siteBuildings]);

  useEffect(() => {
    if (!filteredResidentRows.length) {
      setSelectedUnitId('');
      return;
    }

    if (!filteredResidentRows.some((row) => row.unit.id === selectedUnitId)) {
      setSelectedUnitId(filteredResidentRows[0].unit.id);
    }
  }, [filteredResidentRows, selectedUnitId]);

  useEffect(() => {
    if (!activeSite) {
      return;
    }

    setSiteForm({
      name: activeSite.name,
      address: activeSite.address,
      district: activeSite.district,
      city: activeSite.city
    });
    setBuildingForms(
      Object.fromEntries(
        siteBuildings.map((building) => [
          building.id,
          {
            name: building.name,
            address: building.address,
            apiKey: building.apiKey,
            doorLabel: building.doorLabel,
            kioskCode: building.kioskCode
          }
        ])
      )
    );
    setUnitForms(
      Object.fromEntries(
        siteUnits.map((unit) => [
          unit.id,
          {
            unitNumber: unit.unitNumber,
            floor: String(unit.floor),
            buildingId: unit.buildingId
          }
        ])
      )
    );
    setSelectedManagerId(managerAssignment?.profileId ?? '');
    setServiceEditForms(
      Object.fromEntries(
        siteServices.map((service) => [
          service.id,
          {
            fullName: service.fullName,
            category: service.category,
            phone: service.phone,
            note: service.note
          }
        ])
      )
    );
  }, [activeSite, managerAssignment?.profileId, siteBuildings, siteServices, siteUnits]);

  useEffect(() => {
    if (!selectedUnitId) {
      setResidentForm(EMPTY_RESIDENT_FORM);
      return;
    }

    if (selectedResident) {
      setResidentForm({
        unitId: selectedUnitId,
        fullName: selectedResident.fullName,
        phone: selectedResident.phone,
        title: selectedResident.title
      });
      return;
    }

    setResidentForm({
      ...EMPTY_RESIDENT_FORM,
      unitId: selectedUnitId
    });
  }, [selectedResident, selectedUnitId]);

  if (!user) {
    return null;
  }

  const menuItems = (
    [
      { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
      isSuperAdmin ? { id: 'structure', label: 'Siteler', icon: Building2 } : null,
      isSuperAdmin ? { id: 'assignments', label: 'Atamalar', icon: UserRoundCog } : null,
      { id: 'calls', label: 'Görüşmeler', icon: Headset },
      { id: 'announcements', label: 'Duyurular', icon: Megaphone },
      { id: 'services', label: 'Hizmetler', icon: Wrench }
    ] as const
  ).filter(Boolean) as Array<{
    id: DashboardTab;
    label: string;
    icon: typeof LayoutDashboard;
  }>;

  const isDbActionLocked = pendingAction !== null;

  function isActionPending(actionKey: string) {
    return pendingAction === actionKey;
  }

  function renderActionLabel(actionKey: string, idleLabel: string, loadingLabel: string) {
    if (!isActionPending(actionKey)) {
      return idleLabel;
    }

    return (
      <>
        <LoaderCircle className="h-4 w-4 animate-spin" />
        {loadingLabel}
      </>
    );
  }

  async function run(
    actionKey: string,
    task: () => Promise<void>,
    successMessage: string,
    tone: 'success' | 'info' = 'success'
  ) {
    setPendingAction(actionKey);

    try {
      await task();
      showToast({ tone, message: successMessage });
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Islem tamamlanamadi.'
      });
    } finally {
      setPendingAction((current) => (current === actionKey ? null : current));
    }
  }

  function updateSiteSetupBlock(
    blockId: string,
    updater: (current: SitePlanBlockForm) => SitePlanBlockForm
  ) {
    setSiteSetupForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === blockId ? updater(block) : block))
    }));
  }

  async function handleCreateSiteLayout() {
    const siteInput = {
      name: siteSetupForm.name.trim(),
      address: siteSetupForm.address.trim(),
      district: siteSetupForm.district.trim(),
      city: siteSetupForm.city.trim()
    };

    if (!siteInput.name || !siteInput.address || !siteInput.district || !siteInput.city) {
      throw new Error('Site bilgilerini eksiksiz girin.');
    }

    const preparedBlocks = siteSetupForm.blocks.map((block, index) => {
      const plannedUnits = getPlannedUnitsForBlock(block);

      if (!plannedUnits.length) {
        throw new Error(
          `${block.name || `${index + 1}. blok`} için en az bir daire oluşturun.`
        );
      }

      return {
        name: block.name.trim() || `${String.fromCharCode(65 + index)} Blok`,
        address: block.address.trim() || siteInput.address,
        doorLabel: block.doorLabel.trim() || block.name.trim() || `${index + 1}. Giriş`,
        units: plannedUnits
      };
    });

    let createdSiteId: string | null = null;
    let shouldRollback = true;

    try {
      const siteResult = await createSite(siteInput, { refresh: false });
      createdSiteId = siteResult.siteId;

      if (!createdSiteId) {
        throw new Error('Site kimligi alinamadi.');
      }

      for (const block of preparedBlocks) {
        const buildingResult = await createBuilding(
          {
            siteId: createdSiteId,
            name: block.name,
            address: block.address,
            doorLabel: block.doorLabel
          },
          { refresh: false }
        );

        if (!buildingResult.buildingId) {
          throw new Error(`${block.name} için blok kaydı oluşturulamadı.`);
        }

        for (const unit of block.units) {
          await createUnit(
            {
              buildingId: buildingResult.buildingId,
              unitNumber: unit.unitNumber,
              floor: unit.floor
            },
            { refresh: false }
          );
        }
      }

      shouldRollback = false;
      await refreshState();
      setSelectedSiteId(createdSiteId);
      setSelectedBuildingFilterId('all');
      setSiteSetupForm(createEmptySiteSetupForm());
    } catch (error) {
      if (createdSiteId && shouldRollback) {
        try {
          await deleteSite(createdSiteId);
        } catch {
          // Kurulum yarim kalirsa kaskad silme ile temizlemeyi deneriz.
        }
      }

      throw error;
    }
  }

  async function handleCreateResidentForSelectedUnit() {
    if (!selectedUnit) {
      throw new Error('Önce bir daire seçin.');
    }

    const fullName = residentForm.fullName.trim();
    const phone = residentForm.phone.trim();
    const title = residentForm.title.trim() || 'Daire sakini';

    if (!fullName || !phone) {
      throw new Error('Ad soyad ve telefon bilgisi gerekli.');
    }

    const credentials = await createResident({
      unitId: selectedUnit.id,
      fullName,
      phone,
      title
    });

    setLastCreatedCredentials(credentials);
    setResidentForm({
      ...EMPTY_RESIDENT_FORM,
      unitId: selectedUnit.id
    });
  }

  async function handleUpdateSelectedResident() {
    if (!selectedResident) {
      throw new Error('Bu dairede düzenlenecek sakin yok.');
    }

    await updateResident({
      profileId: selectedResident.id,
      fullName: residentForm.fullName.trim() || selectedResident.fullName,
      phone: residentForm.phone.trim() || selectedResident.phone,
      title: residentForm.title.trim() || selectedResident.title
    });

    setResidentForm({
      ...EMPTY_RESIDENT_FORM,
      unitId: selectedResident.unitId ?? selectedUnitId
    });
  }

  async function handleDeleteSelectedResident() {
    if (!selectedResident) {
      throw new Error('Bu dairede silinecek sakin yok.');
    }

    await deleteResident(selectedResident.id);
    setResidentForm({
      ...EMPTY_RESIDENT_FORM,
      unitId: selectedResident.unitId ?? selectedUnitId
    });
  }

  let content: ReactNode = null;

  if (activeTab === 'overview') {
    content = (
      <div className="space-y-6">
        <div className="metric-grid lg:grid-cols-4">
          <div className="app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Blok
            </p>
            <p className="mt-3 font-heading text-4xl font-bold">{siteBuildings.length}</p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Daire
            </p>
            <p className="mt-3 font-heading text-4xl font-bold">{siteUnits.length}</p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Açık görüşme
            </p>
            <p className="mt-3 font-heading text-4xl font-bold">{openCalls.length}</p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Açık bakiye
            </p>
            <p className="mt-3 font-heading text-4xl font-bold">{formatCurrency(unpaidTotal)}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="app-card p-5">
            <p className="app-kicker">Site detayı</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">
              {activeSite?.name ?? 'Site seçin'}
            </h3>
            <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
              {activeSite?.address ?? 'Soldan bir site seçerek detaylarını görüntüleyin.'}
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Yönetici
                </p>
                <p className="mt-3 font-semibold">{siteManager?.fullName ?? 'Atanmadı'}</p>
                {siteManager?.loginId ? (
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    Daire ID: {siteManager.loginId}
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Danışman
                </p>
                <p className="mt-3 font-semibold">{siteConsultants.length}</p>
              </div>
            </div>
            {isSuperAdmin && activeSite ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <input
                    className="app-input px-4 py-4"
                    value={siteForm.name}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Site adı"
                    type="text"
                  />
                  <input
                    className="app-input px-4 py-4"
                    value={siteForm.district}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, district: event.target.value }))
                    }
                    placeholder="İlçe"
                    type="text"
                  />
                  <input
                    className="app-input px-4 py-4 lg:col-span-2"
                    value={siteForm.address}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, address: event.target.value }))
                    }
                    placeholder="Adres"
                    type="text"
                  />
                  <input
                    className="app-input px-4 py-4"
                    value={siteForm.city}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, city: event.target.value }))
                    }
                    placeholder="Şehir"
                    type="text"
                  />
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={isDbActionLocked}
                    onClick={() =>
                      void run(
                        `update-site:${activeSiteId}`,
                        () =>
                          updateSiteDetails({
                            siteId: activeSiteId,
                            name: siteForm.name.trim() || activeSite.name,
                            address: siteForm.address.trim() || activeSite.address,
                            district: siteForm.district.trim() || activeSite.district,
                            city: siteForm.city.trim() || activeSite.city
                          }),
                        'Site güncellendi.'
                      )
                    }
                    className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {renderActionLabel(`update-site:${activeSiteId}`, 'Kaydet', 'Kaydediliyor')}
                  </button>
                  <button
                    type="button"
                    disabled={isDbActionLocked}
                    onClick={() =>
                      void run(
                        `delete-site:${activeSiteId}`,
                        () => deleteSite(activeSiteId),
                        'Site silindi.',
                        'info'
                      )
                    }
                    className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {renderActionLabel(`delete-site:${activeSiteId}`, 'Sil', 'Siliniyor')}
                  </button>
                </div>
              </>
            ) : null}
          </section>

          <section className="app-card p-5">
            <p className="app-kicker">Canlı akış</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">Ziyaretçi, sakin ve yayınlar</h3>
            <div className="mt-5 space-y-3">
              {siteRequests.slice(0, 3).map((request) => (
                <div
                  key={request.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{request.guestName}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {requestTypeLabel(request.type)} · {unitLabel(state, request.unitId)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-accent)]">
                      {requestStatusLabel(request.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">
                    {formatDateTime(request.createdAt)}
                  </p>
                </div>
              ))}
              {!siteRequests.length ? (
                <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Bu site için henüz hareket kaydı görünmüyor.
                </div>
              ) : null}
              {newest(siteResidents).slice(0, 2).map((resident) => (
                <div
                  key={resident.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <p className="font-semibold">{resident.fullName}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {resident.unitId ? unitLabel(state, resident.unitId) : 'Daire eşleşmesi yok'}
                  </p>
                </div>
              ))}
              {newestAnnouncements(siteAnnouncements).slice(0, 2).map((announcement) => (
                <div
                  key={announcement.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <p className="font-semibold">{announcement.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {announcement.summary}
                  </p>
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
        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="app-kicker">Yeni Site Kurulumu</p>
              <h3 className="mt-2 font-heading text-2xl font-bold">
                Site, blok ve daireleri tek akışta kur
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
                Önce site bilgisini girin, sonra blokları ekleyin. Her blok için kat sayısını
                belirleyip kat bazlı daire sayısı verebilir veya toplam daireyi katlara eşit
                dağıtabilirsiniz.
              </p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Kurulum özeti
              </p>
              <p className="mt-2 font-semibold">
                {siteSetupForm.blocks.length} blok · {totalPlannedUnits} daire
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <input
              className="app-input px-4 py-4"
              value={siteSetupForm.name}
              onChange={(event) =>
                setSiteSetupForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Site adı"
              type="text"
            />
            <input
              className="app-input px-4 py-4 lg:col-span-2"
              value={siteSetupForm.address}
              onChange={(event) =>
                setSiteSetupForm((current) => ({ ...current, address: event.target.value }))
              }
              placeholder="Adres"
              type="text"
            />
            <input
              className="app-input px-4 py-4"
              value={siteSetupForm.city}
              onChange={(event) =>
                setSiteSetupForm((current) => ({ ...current, city: event.target.value }))
              }
              placeholder="Şehir"
              type="text"
            />
            <input
              className="app-input px-4 py-4"
              value={siteSetupForm.district}
              onChange={(event) =>
                setSiteSetupForm((current) => ({ ...current, district: event.target.value }))
              }
              placeholder="İlçe"
              type="text"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Blok planı
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Her blok için kat ve daire düzenini burada belirleyin.
              </p>
            </div>
            <button
              type="button"
              disabled={isDbActionLocked}
              onClick={() =>
                setSiteSetupForm((current) => ({
                  ...current,
                  blocks: [...current.blocks, createSitePlanBlock(current.blocks.length)]
                }))
              }
              className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Blok ekle
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {siteSetupForm.blocks.map((block, index) => {
              const equalDistribution = getEqualDistribution(block.totalUnits, block.floorCount);
              const previewFloorCounts =
                block.distributionMode === 'equal'
                  ? equalDistribution
                  : resizeFloorUnitCounts(block.floorUnitCounts, block.floorCount).map((value) =>
                      parseNonNegativeInteger(value, 0)
                    );

              return (
                <div
                  key={block.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Blok {index + 1}
                      </p>
                      <h4 className="mt-2 font-heading text-xl font-bold">
                        {block.name || `Blok ${index + 1}`}
                      </h4>
                    </div>
                    {siteSetupForm.blocks.length > 1 ? (
                      <button
                        type="button"
                        disabled={isDbActionLocked}
                        onClick={() =>
                          setSiteSetupForm((current) => ({
                            ...current,
                            blocks: current.blocks.filter((item) => item.id !== block.id)
                          }))
                        }
                        className="app-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Kaldır
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <input
                      className="app-input px-4 py-4"
                      value={block.name}
                      onChange={(event) =>
                        updateSiteSetupBlock(block.id, (current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                      placeholder={`${String.fromCharCode(65 + (index % 26))} Blok`}
                      type="text"
                    />
                    <input
                      className="app-input px-4 py-4"
                      value={block.doorLabel}
                      onChange={(event) =>
                        updateSiteSetupBlock(block.id, (current) => ({
                          ...current,
                          doorLabel: event.target.value
                        }))
                      }
                      placeholder={`${String.fromCharCode(65 + (index % 26))} Giriş`}
                      type="text"
                    />
                    <input
                      className="app-input px-4 py-4"
                      value={block.floorCount}
                      onChange={(event) =>
                        updateSiteSetupBlock(block.id, (current) => ({
                          ...current,
                          floorCount: event.target.value,
                          floorUnitCounts: resizeFloorUnitCounts(
                            current.floorUnitCounts,
                            event.target.value
                          )
                        }))
                      }
                      min={1}
                      placeholder="Kat sayısı"
                      type="number"
                    />
                    <input
                      className="app-input px-4 py-4 lg:col-span-2"
                      value={block.address}
                      onChange={(event) =>
                        updateSiteSetupBlock(block.id, (current) => ({
                          ...current,
                          address: event.target.value
                        }))
                      }
                      placeholder="Blok adresi, boş kalırsa site adresi kullanılır"
                      type="text"
                    />
                    <select
                      className="app-select px-4 py-4"
                      value={block.distributionMode}
                      onChange={(event) =>
                        updateSiteSetupBlock(block.id, (current) => {
                          const nextMode = event.target.value as SitePlanDistributionMode;

                          if (nextMode === 'equal') {
                            return {
                              ...current,
                              distributionMode: 'equal',
                              totalUnits: String(Math.max(getPlannedUnitCountForBlock(current), 1))
                            };
                          }

                          return {
                            ...current,
                            distributionMode: 'custom',
                            floorUnitCounts:
                              current.distributionMode === 'equal'
                                ? getEqualDistribution(
                                    current.totalUnits,
                                    current.floorCount
                                  ).map(String)
                                : resizeFloorUnitCounts(
                                    current.floorUnitCounts,
                                    current.floorCount
                                  )
                          };
                        })
                      }
                    >
                      <option value="equal">Toplam daireyi katlara eşit dağıt</option>
                      <option value="custom">Kat kat daire belirle</option>
                    </select>
                    {block.distributionMode === 'equal' ? (
                      <input
                        className="app-input px-4 py-4"
                        value={block.totalUnits}
                        onChange={(event) =>
                          updateSiteSetupBlock(block.id, (current) => ({
                            ...current,
                            totalUnits: event.target.value
                          }))
                        }
                        min={1}
                        placeholder="Toplam daire"
                        type="number"
                      />
                    ) : (
                      <div className="rounded-md border-2 border-[var(--color-line)] bg-black/10 px-4 py-4 text-sm text-[var(--color-muted)]">
                        Kat bazlı plan aktif. Aşağıda her katın daire sayısını ayarlayın.
                      </div>
                    )}
                  </div>

                  {block.distributionMode === 'custom' ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {resizeFloorUnitCounts(block.floorUnitCounts, block.floorCount).map(
                        (count, floorIndex) => (
                          <label
                            key={`${block.id}-floor-${floorIndex + 1}`}
                            className="space-y-2 rounded-md border border-[var(--color-line)] bg-black/10 p-3"
                          >
                            <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                              {floorIndex + 1}. kat
                            </span>
                            <input
                              className="app-input px-4 py-3"
                              value={count}
                              onChange={(event) =>
                                updateSiteSetupBlock(block.id, (current) => {
                                  const nextCounts = resizeFloorUnitCounts(
                                    current.floorUnitCounts,
                                    current.floorCount
                                  );
                                  nextCounts[floorIndex] = event.target.value;

                                  return {
                                    ...current,
                                    floorUnitCounts: nextCounts
                                  };
                                })
                              }
                              min={0}
                              type="number"
                            />
                          </label>
                        )
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {previewFloorCounts.map((count, floorIndex) => (
                      <span
                        key={`${block.id}-preview-${floorIndex + 1}`}
                        className="rounded-full border border-[var(--color-line)] px-3 py-2 text-xs text-[var(--color-muted)]"
                      >
                        {floorIndex + 1}. kat: {count} daire
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 text-sm text-[var(--color-muted)]">
                    Bu bloktan toplam {getPlannedUnitCountForBlock(block)} daire oluşturulacak.
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-muted)]">
              Kurulum tamamlandığında site anında listeye düşer ve detay ekranı güncellenir.
            </p>
            <button
              type="button"
              disabled={isDbActionLocked}
              onClick={() =>
                void run(
                  'create-site-layout',
                  handleCreateSiteLayout,
                  'Site, bloklar ve daireler oluşturuldu.'
                )
              }
              className="app-button inline-flex items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renderActionLabel('create-site-layout', 'Siteyi kur', 'Kuruluyor')}
            </button>
          </div>
        </section>
        <section className="hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="app-kicker">Siteler</p>
              <h3 className="mt-2 font-heading text-2xl font-bold">Kayıtlı saha listesi</h3>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Bir site seçerek detay ve daire tablolarına geçebilirsiniz.
            </p>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleSites.map((site) => {
              const buildingCount = visibleBuildings.filter(
                (building) => building.siteId === site.id
              ).length;
              const buildingIds = new Set(
                visibleBuildings
                  .filter((building) => building.siteId === site.id)
                  .map((building) => building.id)
              );
              const unitCount = visibleUnits.filter((unit) => buildingIds.has(unit.buildingId)).length;

              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => {
                    setSelectedSiteId(site.id);
                    setSelectedBuildingFilterId('all');
                  }}
                  data-active={activeSiteId === site.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4 text-left transition hover:-translate-y-0.5 data-[active=true]:border-[var(--color-accent)] data-[active=true]:bg-[var(--color-accent-soft)]"
                >
                  <p className="font-semibold">{site.name}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {site.district} / {site.city}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {buildingCount} blok · {unitCount} daire
                  </p>
                </button>
              );
            })}
            {!visibleSites.length ? (
              <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
                Henüz site bulunmuyor. Yukarıdaki kurulum alanıyla ilk siteyi ekleyebilirsiniz.
              </div>
            ) : null}
          </div>
        </section>

        <section className="app-card overflow-hidden p-0">
          <div className="border-b-2 border-[var(--color-line)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="app-kicker">Siteler</p>
                <h3 className="mt-2 font-heading text-2xl font-bold">
                  {activeSite ? `${activeSite.name} daire listesi` : 'Daire listesi'}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  {activeSite
                    ? selectedBuildingFilterId === 'all'
                      ? 'Seçili sitedeki tüm daireler aşağıdaki tabloda listelenir.'
                      : `${siteBuildings.find((building) => building.id === selectedBuildingFilterId)?.name ?? 'Blok'} filtresi uygulanıyor.`
                    : 'Önce bir site seçin.'}
                </p>
              </div>
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Görüntülenen kayıt
                </p>
                <p className="mt-2 font-semibold">
                  {activeSite ? `${filteredResidentRows.length} daire` : '0 daire'}
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Blok</th>
                  <th>Daire No</th>
                  <th>Daire ID</th>
                  <th>Kat</th>
                  <th>Daire sakini</th>
                  <th>Tel. no</th>
                  <th>Durum</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {activeSite
                  ? filteredResidentRows.map((row) => {
                      const isSelected = row.unit.id === selectedUnitId;
                      const residentStatus = row.resident
                        ? row.resident.role === 'manager'
                          ? 'Dolu / Yönetici'
                          : 'Dolu'
                        : 'Boş';

                      return (
                        <tr
                          key={row.unit.id}
                          className={isSelected ? 'bg-[var(--color-accent-soft)]/60' : undefined}
                        >
                          <td>{row.building?.name ?? '-'}</td>
                          <td>{row.unit.unitNumber}</td>
                          <td className="text-xs font-semibold text-[var(--color-accent)]">
                            {row.unit.unitCode}
                          </td>
                          <td>{row.unit.floor}</td>
                          <td>
                            {row.resident ? (
                              <div>
                                <p className="font-semibold">{row.resident.fullName}</p>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                  {row.resident.title}
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-[var(--color-muted)]">Boş daire</span>
                            )}
                          </td>
                          <td>{row.resident?.phone ?? '-'}</td>
                          <td>{residentStatus}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedUnitId(row.unit.id)}
                              className="app-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
                            >
                              {isSelected ? 'Açık' : 'Detay'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  : null}
                {!activeSite ? (
                  <tr>
                    <td colSpan={8} className="text-center text-sm text-[var(--color-muted)]">
                      Görüntülenecek site yok.
                    </td>
                  </tr>
                ) : null}
                {activeSite && !filteredResidentRows.length ? (
                  <tr>
                    <td colSpan={8} className="text-center text-sm text-[var(--color-muted)]">
                      Bu filtre için daire bulunmuyor.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {activeSite ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="app-card p-5">
                <p className="app-kicker">Site Detay Sayfası</p>
                <h3 className="mt-2 font-heading text-2xl font-bold">{activeSite.name}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  {activeSite.address} · {activeSite.district} / {activeSite.city}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Blok
                    </p>
                    <p className="mt-3 font-heading text-3xl font-bold">{siteBuildings.length}</p>
                  </div>
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Daire
                    </p>
                    <p className="mt-3 font-heading text-3xl font-bold">{siteUnits.length}</p>
                  </div>
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Boş daire
                    </p>
                    <p className="mt-3 font-heading text-3xl font-bold">
                      {emptyResidentRows.length}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <input
                    className="app-input px-4 py-4"
                    value={siteForm.name}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Site adı"
                    type="text"
                  />
                  <input
                    className="app-input px-4 py-4"
                    value={siteForm.district}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, district: event.target.value }))
                    }
                    placeholder="İlçe"
                    type="text"
                  />
                  <input
                    className="app-input px-4 py-4 lg:col-span-2"
                    value={siteForm.address}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, address: event.target.value }))
                    }
                    placeholder="Adres"
                    type="text"
                  />
                  <input
                    className="app-input px-4 py-4"
                    value={siteForm.city}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, city: event.target.value }))
                    }
                    placeholder="Şehir"
                    type="text"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isDbActionLocked}
                    onClick={() =>
                      void run(
                        `update-site:${activeSiteId}`,
                        () =>
                          updateSiteDetails({
                            siteId: activeSiteId,
                            name: siteForm.name.trim() || activeSite.name,
                            address: siteForm.address.trim() || activeSite.address,
                            district: siteForm.district.trim() || activeSite.district,
                            city: siteForm.city.trim() || activeSite.city
                          }),
                        'Site güncellendi.'
                      )
                    }
                    className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {renderActionLabel(`update-site:${activeSiteId}`, 'Kaydet', 'Kaydediliyor')}
                  </button>
                  <button
                    type="button"
                    disabled={isDbActionLocked}
                    onClick={() =>
                      void run(
                        `delete-site:${activeSiteId}`,
                        () => deleteSite(activeSiteId),
                        'Site silindi.',
                        'info'
                      )
                    }
                    className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {renderActionLabel(`delete-site:${activeSiteId}`, 'Sil', 'Siliniyor')}
                  </button>
                </div>
              </section>

              <section className="hidden">
                <p className="app-kicker">Boş Daireye Sakin Ata</p>
                <h3 className="mt-2 font-heading text-2xl font-bold">
                  Daire sakini hesabını detay sayfasından aç
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  Aşağıdaki seçim listesi sadece boş daireleri gösterir. Blok filtresi seçiliyse
                  önce o bloğun boş daireleri önerilir.
                </p>
                <div className="mt-5 space-y-3">
                  <select
                    className="app-select px-4 py-4"
                    value={residentForm.unitId}
                    onChange={(event) =>
                      setResidentForm((current) => ({ ...current, unitId: event.target.value }))
                    }
                  >
                    {assignableResidentRows.map((row) => (
                      <option key={row.unit.id} value={row.unit.id}>
                        {row.building?.name ?? 'Blok'} / Daire {row.unit.unitNumber} /{' '}
                        {row.unit.unitCode}
                      </option>
                    ))}
                  </select>
                  <input
                    className="app-input px-4 py-4"
                    value={residentForm.fullName}
                    onChange={(event) =>
                      setResidentForm((current) => ({ ...current, fullName: event.target.value }))
                    }
                    placeholder="Ad soyad"
                    type="text"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="app-input px-4 py-4"
                      value={residentForm.phone}
                      onChange={(event) =>
                        setResidentForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="Telefon"
                      type="text"
                    />
                    <input
                      className="app-input px-4 py-4"
                      value={residentForm.title}
                      onChange={(event) =>
                        setResidentForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Daire sakini"
                      type="text"
                    />
                  </div>
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Giriş kimliği
                    </p>
                    <p className="mt-2 font-semibold">
                      {residentForm.unitId ? unitLabel(state, residentForm.unitId) : 'Daire seçin'}
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      Daire ID otomatik kullanılır. Şifre sistem tarafında otomatik oluşturulur.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isDbActionLocked || !assignableResidentRows.length}
                    onClick={() =>
                      void run(
                        'create-resident',
                        async () => {
                          const credentials = await createResident(residentForm);
                          setLastCreatedCredentials(credentials);
                          setResidentForm({
                            ...EMPTY_RESIDENT_FORM,
                            unitId: assignableResidentRows[0]?.unit.id ?? ''
                          });
                        },
                        'Yeni sakin oluşturuldu.'
                      )
                    }
                    className="app-button inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {renderActionLabel('create-resident', 'Sakin ekle', 'Oluşturuluyor')}
                  </button>
                  {lastCreatedCredentials?.role === 'resident' ? (
                    <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Oluşan giriş
                      </p>
                      <p className="mt-3 font-semibold">{lastCreatedCredentials.fullName}</p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Daire ID: {lastCreatedCredentials.identifier}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Şifre: {lastCreatedCredentials.password}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="app-card p-5">
                <p className="app-kicker">Daire Detayı</p>
                {selectedUnit ? (
                  <>
                    <h3 className="mt-2 font-heading text-2xl font-bold">
                      {selectedBuilding?.name ?? 'Blok'} / Daire {selectedUnit.unitNumber}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                      Daire ID: {selectedUnit.unitCode}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                          Kat
                        </p>
                        <p className="mt-2 font-semibold">{selectedUnit.floor}</p>
                      </div>
                      <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                          Durum
                        </p>
                        <p className="mt-2 font-semibold">{selectedResident ? 'Dolu' : 'Boş'}</p>
                      </div>
                      <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                          Blok
                        </p>
                        <p className="mt-2 font-semibold">{selectedBuilding?.name ?? '-'}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <input
                        className="app-input px-4 py-4"
                        value={selectedUnitForm.unitNumber}
                        onChange={(event) =>
                          setUnitForms((current) => ({
                            ...current,
                            [selectedUnit.id]: {
                              ...selectedUnitForm,
                              buildingId: selectedUnit.buildingId,
                              unitNumber: event.target.value
                            }
                          }))
                        }
                        placeholder="Daire numarası"
                        type="text"
                      />
                      <input
                        className="app-input px-4 py-4"
                        value={selectedUnitForm.floor}
                        onChange={(event) =>
                          setUnitForms((current) => ({
                            ...current,
                            [selectedUnit.id]: {
                              ...selectedUnitForm,
                              buildingId: selectedUnit.buildingId,
                              floor: event.target.value
                            }
                          }))
                        }
                        min={1}
                        placeholder="Kat"
                        type="number"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={isDbActionLocked}
                        className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() =>
                          void run(
                            `update-unit:${selectedUnit.id}`,
                            () =>
                              updateUnitDetails({
                                unitId: selectedUnit.id,
                                unitNumber:
                                  selectedUnitForm.unitNumber.trim() || selectedUnit.unitNumber,
                                floor: parsePositiveInteger(
                                  selectedUnitForm.floor,
                                  selectedUnit.floor
                                )
                              }),
                            'Daire güncellendi.'
                          )
                        }
                      >
                        {renderActionLabel(
                          `update-unit:${selectedUnit.id}`,
                          'Daireyi kaydet',
                          'Kaydediliyor'
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isDbActionLocked}
                        className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() =>
                          void run(
                            `delete-unit:${selectedUnit.id}`,
                            () => deleteUnit(selectedUnit.id),
                            'Daire silindi.',
                            'info'
                          )
                        }
                      >
                        {renderActionLabel(
                          `delete-unit:${selectedUnit.id}`,
                          'Daireyi sil',
                          'Siliniyor'
                        )}
                      </button>
                    </div>

                    <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                      <p className="app-kicker">
                        {selectedResident ? 'Daire Sakini' : 'Boş Daireye Sakin Ata'}
                      </p>

                      {selectedResident ? (
                        <>
                          <div className="mt-4 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                            <p className="font-semibold">{selectedResident.fullName}</p>
                            <p className="mt-2 text-sm text-[var(--color-muted)]">
                              {selectedResident.title} · {selectedResident.phone}
                            </p>
                            <p className="mt-1 text-sm text-[var(--color-muted)]">
                              Giriş kimliği: {selectedResident.loginId}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <input
                              className="app-input px-4 py-4"
                              value={residentForm.fullName}
                              onChange={(event) =>
                                setResidentForm((current) => ({
                                  ...current,
                                  fullName: event.target.value
                                }))
                              }
                              placeholder="Ad soyad"
                              type="text"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input
                                className="app-input px-4 py-4"
                                value={residentForm.phone}
                                onChange={(event) =>
                                  setResidentForm((current) => ({
                                    ...current,
                                    phone: event.target.value
                                  }))
                                }
                                placeholder="Telefon"
                                type="text"
                              />
                              <input
                                className="app-input px-4 py-4"
                                value={residentForm.title}
                                onChange={(event) =>
                                  setResidentForm((current) => ({
                                    ...current,
                                    title: event.target.value
                                  }))
                                }
                                placeholder="Unvan"
                                type="text"
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={isDbActionLocked}
                              className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() =>
                                void run(
                                  `update-resident:${selectedResident.id}`,
                                  handleUpdateSelectedResident,
                                  'Daire sakini güncellendi.'
                                )
                              }
                            >
                              {renderActionLabel(
                                `update-resident:${selectedResident.id}`,
                                'Sakini kaydet',
                                'Kaydediliyor'
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={isDbActionLocked}
                              className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() =>
                                void run(
                                  `delete-resident:${selectedResident.id}`,
                                  handleDeleteSelectedResident,
                                  'Daire sakini silindi.',
                                  'info'
                                )
                              }
                            >
                              {renderActionLabel(
                                `delete-resident:${selectedResident.id}`,
                                'Sakini sil',
                                'Siliniyor'
                              )}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
                            Bu dairede henüz sakin kaydı yok. Aşağıdaki formdan yeni sakin hesabı
                            oluşturabilirsiniz.
                          </p>
                          <div className="mt-4 grid gap-3">
                            <input
                              className="app-input px-4 py-4"
                              value={residentForm.fullName}
                              onChange={(event) =>
                                setResidentForm((current) => ({
                                  ...current,
                                  fullName: event.target.value
                                }))
                              }
                              placeholder="Ad soyad"
                              type="text"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input
                                className="app-input px-4 py-4"
                                value={residentForm.phone}
                                onChange={(event) =>
                                  setResidentForm((current) => ({
                                    ...current,
                                    phone: event.target.value
                                  }))
                                }
                                placeholder="Telefon"
                                type="text"
                              />
                              <input
                                className="app-input px-4 py-4"
                                value={residentForm.title}
                                onChange={(event) =>
                                  setResidentForm((current) => ({
                                    ...current,
                                    title: event.target.value
                                  }))
                                }
                                placeholder="Daire sakini"
                                type="text"
                              />
                            </div>
                            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                                Giriş kimliği
                              </p>
                              <p className="mt-2 font-semibold">
                                {unitLabel(state, selectedUnit.id)}
                              </p>
                              <p className="mt-2 text-sm text-[var(--color-muted)]">
                                Daire ID otomatik kullanılır. Şifre sistem tarafından otomatik
                                oluşturulur.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              disabled={isDbActionLocked}
                              onClick={() =>
                                void run(
                                  `create-resident:${selectedUnit.id}`,
                                  handleCreateResidentForSelectedUnit,
                                  'Yeni sakin oluşturuldu.'
                                )
                              }
                              className="app-button inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {renderActionLabel(
                                `create-resident:${selectedUnit.id}`,
                                'Sakin ekle',
                                'Oluşturuluyor'
                              )}
                            </button>
                          </div>
                        </>
                      )}

                      {lastCreatedCredentials?.role === 'resident' &&
                      lastCreatedCredentials.identifier === selectedUnit.unitCode ? (
                        <div className="mt-4 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                            Oluşan giriş
                          </p>
                          <p className="mt-3 font-semibold">{lastCreatedCredentials.fullName}</p>
                          <p className="mt-2 text-sm text-[var(--color-muted)]">
                            Daire ID: {lastCreatedCredentials.identifier}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-muted)]">
                            Şifre: {lastCreatedCredentials.password}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                    Detayları görüntülemek için tablodan bir daire seçin.
                  </p>
                )}
              </section>
            </div>

            <section className="app-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="app-kicker">Bloklar</p>
                  <h3 className="mt-2 font-heading text-2xl font-bold">
                    Blok bazlı güncelleme ve filtre
                  </h3>
                </div>
                <select
                  className="app-select min-w-[220px] px-4 py-3"
                  value={selectedBuildingFilterId}
                  onChange={(event) => setSelectedBuildingFilterId(event.target.value)}
                >
                  <option value="all">Tüm bloklar</option>
                  {siteBuildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {siteBuildings.map((building) => {
                  const form = buildingForms[building.id] ?? EMPTY_BUILDING_FORM;
                  const unitCount = buildingUnitCounts.get(building.id) ?? 0;
                  const occupiedCount = buildingOccupiedCounts.get(building.id) ?? 0;

                  return (
                    <div
                      key={building.id}
                      className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{building.name}</p>
                          <p className="mt-1 text-sm text-[var(--color-muted)]">
                            {unitCount} daire / {occupiedCount} dolu
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedBuildingFilterId(building.id)}
                          className="app-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
                        >
                          Filtrele
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <input
                          className="app-input px-4 py-4"
                          value={form.name}
                          onChange={(event) =>
                            setBuildingForms((current) => ({
                              ...current,
                              [building.id]: { ...form, name: event.target.value }
                            }))
                          }
                          placeholder="Blok adı"
                          type="text"
                        />
                        <input
                          className="app-input px-4 py-4"
                          value={form.doorLabel}
                          onChange={(event) =>
                            setBuildingForms((current) => ({
                              ...current,
                              [building.id]: { ...form, doorLabel: event.target.value }
                            }))
                          }
                          placeholder="Kapı etiketi"
                          type="text"
                        />
                        <input
                          className="app-input px-4 py-4 lg:col-span-2"
                          value={form.address}
                          onChange={(event) =>
                            setBuildingForms((current) => ({
                              ...current,
                              [building.id]: { ...form, address: event.target.value }
                            }))
                          }
                          placeholder="Adres"
                          type="text"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={isDbActionLocked}
                          className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() =>
                            void run(
                              `update-building:${building.id}`,
                              () =>
                                updateBuildingDetails({
                                  buildingId: building.id,
                                  name: form.name.trim() || building.name,
                                  address: form.address.trim() || building.address,
                                  apiKey: building.apiKey,
                                  doorLabel: form.doorLabel.trim() || building.doorLabel,
                                  kioskCode: building.kioskCode
                                }),
                              'Blok güncellendi.'
                            )
                          }
                        >
                          {renderActionLabel(
                            `update-building:${building.id}`,
                            'Kaydet',
                            'Kaydediliyor'
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isDbActionLocked}
                          className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() =>
                            void run(
                              `delete-building:${building.id}`,
                              () => deleteBuilding(building.id),
                              'Blok silindi.',
                              'info'
                            )
                          }
                        >
                          {renderActionLabel(
                            `delete-building:${building.id}`,
                            'Sil',
                            'Siliniyor'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="hidden">
              <div className="border-b-2 border-[var(--color-line)] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="app-kicker">Daire tablosu</p>
                    <h3 className="mt-2 font-heading text-2xl font-bold">
                      {selectedBuildingFilterId === 'all'
                        ? 'Tüm bloklardaki daireler'
                        : `${siteBuildings.find((building) => building.id === selectedBuildingFilterId)?.name ?? 'Blok'} daireleri`}
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--color-muted)]">
                    {filteredResidentRows.length} kayıt görüntüleniyor
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Blok</th>
                      <th>Daire ID</th>
                      <th>Daire</th>
                      <th>Kat</th>
                      <th>Durum</th>
                      <th>Sakin</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResidentRows.map((row) => {
                      const unit = row.unit;
                      const form = unitForms[unit.id] ?? EMPTY_UNIT_FORM;

                      return (
                        <tr key={unit.id}>
                          <td>{row.building?.name ?? '-'}</td>
                          <td className="text-xs font-semibold text-[var(--color-accent)]">
                            {unit.unitCode}
                          </td>
                          <td>
                            <input
                              className="app-input px-3 py-2"
                              value={form.unitNumber}
                              onChange={(event) =>
                                setUnitForms((current) => ({
                                  ...current,
                                  [unit.id]: { ...form, unitNumber: event.target.value }
                                }))
                              }
                              placeholder="Daire numarası"
                              type="text"
                            />
                          </td>
                          <td>
                            <input
                              className="app-input px-3 py-2"
                              value={form.floor}
                              onChange={(event) =>
                                setUnitForms((current) => ({
                                  ...current,
                                  [unit.id]: { ...form, floor: event.target.value }
                                }))
                              }
                              min={1}
                              placeholder="Kat"
                              type="number"
                            />
                          </td>
                          <td>{row.resident ? 'Dolu' : 'Boş'}</td>
                          <td>
                            {row.resident ? (
                              <div>
                                <p className="font-semibold">{row.resident.fullName}</p>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                  {row.resident.loginId}
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-[var(--color-muted)]">Atanmadı</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isDbActionLocked}
                                className="app-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() =>
                                  void run(
                                  `update-unit:${unit.id}`,
                                  () =>
                                    updateUnitDetails({
                                      unitId: unit.id,
                                      unitNumber: form.unitNumber.trim() || unit.unitNumber,
                                      floor: parsePositiveInteger(form.floor, unit.floor)
                                    }),
                                    'Daire güncellendi.'
                                  )
                                }
                              >
                                {renderActionLabel(
                                  `update-unit:${unit.id}`,
                                  'Kaydet',
                                  'Kaydediliyor'
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={isDbActionLocked}
                                className="app-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() =>
                                  void run(
                                    `delete-unit:${unit.id}`,
                                    () => deleteUnit(unit.id),
                                    'Daire silindi.',
                                    'info'
                                  )
                                }
                              >
                                {renderActionLabel(
                                  `delete-unit:${unit.id}`,
                                  'Sil',
                                  'Siliniyor'
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredResidentRows.length ? (
                      <tr>
                        <td colSpan={7} className="text-center text-sm text-[var(--color-muted)]">
                          Bu filtre için daire bulunmuyor.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    );
  }

  if (activeTab === 'assignments' && isSuperAdmin) {
    content = (
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="app-card p-5">
          <p className="app-kicker">Site Yöneticisi</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Sakinler arasından seç</h3>
          <div className="mt-5 space-y-3">
            <select
              className="app-select px-4 py-4"
              value={selectedManagerId}
              onChange={(event) => setSelectedManagerId(event.target.value)}
            >
              <option value="">Yönetici atanmasın</option>
              {siteResidents.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.fullName} / {profile.unitId ? unitLabel(state, profile.unitId) : 'Daire yok'}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isDbActionLocked}
              onClick={() =>
                void run(
                  `assign-manager:${activeSiteId}`,
                  () =>
                    assignSiteManager({
                      siteId: activeSiteId,
                      profileId: selectedManagerId || null
                    }),
                  selectedManagerId ? 'Site yöneticisi atandı.' : 'Yönetici kaldırıldı.'
                )
              }
              className="app-button inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renderActionLabel(`assign-manager:${activeSiteId}`, 'Kaydet', 'Kaydediliyor')}
            </button>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Mevcut yönetici
              </p>
              <p className="mt-3 font-semibold">{siteManager?.fullName ?? 'Atanmadı'}</p>
              {siteManager?.loginId ? (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Daire ID: {siteManager.loginId}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Danışmanlar</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Hesap ve site atamaları</h3>
          <div className="mt-5 space-y-4">
            <div className="space-y-3 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Yeni danışman hesabı
              </p>
              <input
                className="app-input px-4 py-4"
                value={consultantForm.fullName}
                onChange={(event) =>
                  setConsultantForm((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Ad soyad"
                type="text"
              />
              <input
                className="app-input px-4 py-4"
                value={consultantForm.phone}
                onChange={(event) =>
                  setConsultantForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="Telefon numarasi"
                type="text"
              />
              <button
                type="button"
                disabled={isDbActionLocked}
                onClick={() =>
                  void run(
                    'create-consultant',
                    async () => {
                      const credentials = await createConsultant(consultantForm);
                      setLastCreatedCredentials(credentials);
                      setConsultantForm(EMPTY_CONSULTANT_FORM);
                    },
                    'Danışman hesabı oluşturuldu.'
                  )
                }
                className="app-button inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {renderActionLabel('create-consultant', 'Danışman oluştur', 'Oluşturuluyor')}
              </button>
              {lastCreatedCredentials?.role === 'consultant' ? (
                <div className="rounded-md border border-[var(--color-line)] bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Oluşan giriş
                  </p>
                  <p className="mt-3 font-semibold">{lastCreatedCredentials.fullName}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    Telefon: {lastCreatedCredentials.identifier}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    Şifre: {lastCreatedCredentials.password}
                  </p>
                </div>
              ) : null}
            </div>
            {consultantProfiles.map((profile) => {
              const assigned = state.consultantSiteAssignments.some(
                (assignment) =>
                  assignment.siteId === activeSiteId && assignment.profileId === profile.id
              );

              return (
                <div
                  key={profile.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{profile.fullName}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{profile.phone}</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Giriş: {profile.loginId}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isDbActionLocked}
                      onClick={() =>
                        void run(
                          `consultant-assignment:${profile.id}:${assigned ? 'remove' : 'assign'}`,
                          () =>
                            setConsultantAssignment({
                              siteId: activeSiteId,
                              profileId: profile.id,
                              assigned: !assigned
                            }),
                          assigned ? 'Danışman ataması kaldırıldı.' : 'Danışman atandı.',
                          'info'
                        )
                      }
                      className={
                        assigned
                          ? 'app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60'
                          : 'app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60'
                      }
                    >
                      {renderActionLabel(
                        `consultant-assignment:${profile.id}:${assigned ? 'remove' : 'assign'}`,
                        assigned ? 'Kaldır' : 'Ata',
                        assigned ? 'Kaldırılıyor' : 'Atanıyor'
                      )}
                    </button>
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
          <p className="app-kicker">Canlı Görüşmeler</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Açık kayıtlar</h3>
          <div className="mt-5 space-y-3">
            {callMatches.length ? (
              callMatches.map(({ request, consultant }) => (
                <div
                  key={request.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{request.guestName}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {unitLabel(state, request.unitId)} / {requestTypeLabel(request.type)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Danışman
                      </p>
                      <p className="mt-2 font-semibold text-[var(--color-accent)]">
                        {consultant?.fullName ?? 'Havuz'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">
                    {formatDateTime(request.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
                Aktif görüşme görünmüyor.
              </div>
            )}
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Geçmiş</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Önceki log kayıtları</h3>
          <div className="mt-5 space-y-3">
            {siteLogs.length ? (
              siteLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <p className="text-sm leading-6">{log.eventDetails}</p>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">
                    {formatDateTime(log.timestamp)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
                Log kaydı bulunmuyor.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === 'announcements') {
    content = (
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="app-card p-5">
          <p className="app-kicker">Yeni Duyuru</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Siteye yayın yap</h3>
          <div className="mt-5 space-y-3">
            <input
              className="app-input px-4 py-4"
              value={announcementForm.title}
              onChange={(event) =>
                setAnnouncementForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Baslik"
              type="text"
            />
            <select
              className="app-select px-4 py-4"
              value={announcementForm.category}
              onChange={(event) =>
                setAnnouncementForm((current) => ({
                  ...current,
                  category: event.target.value as Announcement['category']
                }))
              }
            >
              <option value="Operasyon">Operasyon</option>
              <option value="Güvenlik">Güvenlik</option>
              <option value="Yönetim">Yönetim</option>
            </select>
            <textarea
              className="app-textarea min-h-[140px] px-4 py-4"
              value={announcementForm.summary}
              onChange={(event) =>
                setAnnouncementForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="Metin"
            />
            <button
              type="button"
              disabled={isDbActionLocked}
              onClick={() =>
                void run(
                  'create-announcement',
                  async () => {
                    await createAnnouncement({
                      siteId: activeSiteId,
                      title: announcementForm.title,
                      summary: announcementForm.summary,
                      category: announcementForm.category
                    });
                    setAnnouncementForm({
                      title: '',
                      summary: '',
                      category: 'Operasyon'
                    });
                  },
                    'Duyuru yayınlandı.'
                )
              }
              className="app-button inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renderActionLabel('create-announcement', 'Yayınla', 'Yayınlanıyor')}
            </button>
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Duyurular</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Yayın listesi</h3>
          <div className="mt-5 space-y-3">
            {newestAnnouncements(siteAnnouncements).map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{announcement.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                      {announcement.summary}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[var(--color-accent)]">
                    {announcement.category}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted)]">
                  {formatDateTime(announcement.publishedAt)}
                </p>
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
          <p className="app-kicker">Yeni Hizmet</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Siteye hizmet ekle</h3>
          <div className="mt-5 space-y-3">
            <input
              className="app-input px-4 py-4"
              value={serviceForm.fullName}
              onChange={(event) =>
                setServiceForm((current) => ({ ...current, fullName: event.target.value }))
              }
              placeholder="Firma veya kisi adi"
              type="text"
            />
            <select
              className="app-select px-4 py-4"
              value={serviceForm.category}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  category: event.target.value as ProviderCategory
                }))
              }
            >
              <option value="Temizlik">Temizlik</option>
              <option value="Elektrik">Elektrik</option>
              <option value="Tesisat">Tesisat</option>
              <option value="Asansör">Asansör</option>
              <option value="Nakliyat">Nakliyat</option>
              <option value="Peyzaj">Peyzaj</option>
            </select>
            <input
              className="app-input px-4 py-4"
              value={serviceForm.phone}
              onChange={(event) =>
                setServiceForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="Telefon"
              type="text"
            />
            <textarea
              className="app-textarea min-h-[120px] px-4 py-4"
              value={serviceForm.note}
              onChange={(event) =>
                setServiceForm((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="Not"
            />
            <button
              type="button"
              disabled={isDbActionLocked}
              onClick={() =>
                void run(
                  'create-service-provider',
                  async () => {
                    await createServiceProvider({ siteId: activeSiteId, ...serviceForm });
                    setServiceForm(EMPTY_SERVICE_FORM);
                  },
                  'Hizmet kaydı eklendi.'
                )
              }
              className="app-button inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renderActionLabel(
                'create-service-provider',
                'Kaydi ekle',
                'Ekleniyor'
              )}
            </button>
          </div>
        </section>

        <section className="app-card p-5">
          <p className="app-kicker">Hizmet Kayıtları</p>
          <h3 className="mt-2 font-heading text-2xl font-bold">Düzenle veya sil</h3>
          <div className="mt-5 space-y-3">
            {siteServices.map((service) => {
              const form = serviceEditForms[service.id] ?? EMPTY_SERVICE_FORM;

              return (
                <div
                  key={service.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      className="app-input px-4 py-4"
                      value={form.fullName}
                      onChange={(event) =>
                        setServiceEditForms((current) => ({
                          ...current,
                          [service.id]: { ...form, fullName: event.target.value }
                        }))
                      }
                      type="text"
                    />
                    <select
                      className="app-select px-4 py-4"
                      value={form.category}
                      onChange={(event) =>
                        setServiceEditForms((current) => ({
                          ...current,
                          [service.id]: {
                            ...form,
                            category: event.target.value as ProviderCategory
                          }
                        }))
                      }
                    >
                      <option value="Temizlik">Temizlik</option>
                      <option value="Elektrik">Elektrik</option>
                      <option value="Tesisat">Tesisat</option>
                      <option value="Asansör">Asansör</option>
                      <option value="Nakliyat">Nakliyat</option>
                      <option value="Peyzaj">Peyzaj</option>
                    </select>
                    <input
                      className="app-input px-4 py-4"
                      value={form.phone}
                      onChange={(event) =>
                        setServiceEditForms((current) => ({
                          ...current,
                          [service.id]: { ...form, phone: event.target.value }
                        }))
                      }
                      type="text"
                    />
                    <textarea
                      className="app-textarea min-h-[92px] px-4 py-4 lg:col-span-2"
                      value={form.note}
                      onChange={(event) =>
                        setServiceEditForms((current) => ({
                          ...current,
                          [service.id]: { ...form, note: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      disabled={isDbActionLocked}
                      onClick={() =>
                        void run(
                          `update-service:${service.id}`,
                          () => updateServiceProviderDetails({ providerId: service.id, ...form }),
                          'Hizmet güncellendi.'
                        )
                      }
                      className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {renderActionLabel(
                        `update-service:${service.id}`,
                        'Kaydet',
                        'Kaydediliyor'
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isDbActionLocked}
                      onClick={() =>
                        void run(
                          `delete-service:${service.id}`,
                          () => deleteServiceProvider(service.id),
                          'Hizmet silindi.',
                          'info'
                        )
                      }
                      className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {renderActionLabel(
                        `delete-service:${service.id}`,
                        'Sil',
                        'Siliniyor'
                      )}
                    </button>
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
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
            Siteleri seçin, akışı izleyin ve yönetim işlemlerini buradan yürütün.
          </p>
          <div className="mt-6 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Siteler
            </p>
            <div className="mt-4 space-y-3">
              {visibleSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSelectedSiteId(site.id)}
                  data-active={activeSiteId === site.id}
                  className="w-full rounded-md border-2 border-[var(--color-line)] px-3 py-3 text-left transition hover:-translate-y-0.5 data-[active=true]:border-[var(--color-accent)] data-[active=true]:bg-[var(--color-accent-soft)]"
                >
                  <p className="font-semibold">{site.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {site.district} · {site.city}
                  </p>
                </button>
              ))}
              {!visibleSites.length ? (
                <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Henüz site kaydı yok.
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-active={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="sidebar-link"
                >
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
                <p className="app-kicker">Aktif Saha</p>
                <h2 className="mt-3 font-heading text-4xl font-bold">
                  {activeSite?.name ?? 'Site seçin'}
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--color-muted)]">
                  {activeSite
                    ? `${activeSite.address} / ${activeSite.district} / ${activeSite.city}`
                    : 'Soldan bir site seçin.'}
                </p>
              </div>
              {activeTab === 'structure' && isSuperAdmin ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      Site seçin
                    </span>
                    <select
                      className="app-select min-w-[220px] px-4 py-3"
                      value={activeSiteId}
                      onChange={(event) => {
                        setSelectedSiteId(event.target.value);
                        setSelectedBuildingFilterId('all');
                      }}
                    >
                      {visibleSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      Blok filtresi
                    </span>
                    <select
                      className="app-select min-w-[220px] px-4 py-3"
                      value={selectedBuildingFilterId}
                      onChange={(event) => setSelectedBuildingFilterId(event.target.value)}
                    >
                      <option value="all">Tüm bloklar</option>
                      {siteBuildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div className="flex items-center gap-3 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3">
                <BellRing className="h-5 w-5 text-[var(--color-accent)]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    Açık görüşme
                  </p>
                  <p className="font-semibold">{openCalls.length}</p>
                </div>
              </div>
            </div>
          </header>
          {content}
        </section>
      </div>
    </main>
  );
}
