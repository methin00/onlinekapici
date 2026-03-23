'use client';

import {
  ArrowLeft,
  ChevronDown,
  KeyRound,
  LoaderCircle,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  UserRound
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../providers/auth-provider';
import {
  usePortalData,
  type GeneratedAccountCredentials,
  type ResidentAccountSnapshot
} from '../providers/portal-data-provider';
import { useToast } from '../providers/toast-provider';
import {
  buildUnitResidentRows,
  formatCurrency,
  formatDateTime,
  getVisibleBuildings,
  getVisibleSites,
  getVisibleUnits,
  packageStatusLabel,
  requestStatusLabel,
  requestTypeLabel,
  unitLabel
} from '@/lib/portal-selectors';
import type { Building, Unit } from '@/lib/portal-types';

type SiteForm = {
  name: string;
  address: string;
  district: string;
  city: string;
};

type BuildingForm = {
  name: string;
  address: string;
  doorLabel: string;
};

type UnitForm = {
  unitNumber: string;
  floor: string;
};

type ResidentForm = {
  fullName: string;
  phone: string;
  title: string;
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

type ResidentRow = ReturnType<typeof buildUnitResidentRows>[number];
type SitesQueryState = {
  siteId: string;
  unitId: string;
  buildingId: string;
  createPageOpen: boolean;
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
  doorLabel: ''
};

const EMPTY_UNIT_FORM: UnitForm = {
  unitNumber: '',
  floor: '1'
};

const EMPTY_RESIDENT_FORM: ResidentForm = {
  fullName: '',
  phone: '',
  title: ''
};

const EMPTY_BUILDINGS: Building[] = [];
const EMPTY_UNITS: Unit[] = [];
const EMPTY_RESIDENT_ROWS: ResidentRow[] = [];
const RESIDENT_ACCOUNT_SNAPSHOT_STORAGE_KEY_PREFIX = 'portal-resident-account-snapshots';

function sameSiteForm(left: SiteForm, right: SiteForm) {
  return (
    left.name === right.name &&
    left.address === right.address &&
    left.district === right.district &&
    left.city === right.city
  );
}

function sameBuildingForm(left: BuildingForm | undefined, right: BuildingForm) {
  return (
    left?.name === right.name &&
    left?.address === right.address &&
    left?.doorLabel === right.doorLabel
  );
}

function sameBuildingForms(
  left: Record<string, BuildingForm>,
  right: Record<string, BuildingForm>
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return rightKeys.every((key) => sameBuildingForm(left[key], right[key]));
}

function sameUnitForm(left: UnitForm, right: UnitForm) {
  return left.unitNumber === right.unitNumber && left.floor === right.floor;
}

function sameResidentForm(left: ResidentForm, right: ResidentForm) {
  return (
    left.fullName === right.fullName &&
    left.phone === right.phone &&
    left.title === right.title
  );
}

function getResidentAccountSnapshotStorageKey(userId: string) {
  return `${RESIDENT_ACCOUNT_SNAPSHOT_STORAGE_KEY_PREFIX}:${userId}`;
}

function readSitesQueryState(): SitesQueryState {
  if (typeof window === 'undefined') {
    return {
      siteId: '',
      unitId: '',
      buildingId: '',
      createPageOpen: false
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    siteId: params.get('site') ?? '',
    unitId: params.get('unit') ?? '',
    buildingId: params.get('building') ?? '',
    createPageOpen: params.get('sitesView') === 'create'
  };
}

function writeSitesQueryState(state: SitesQueryState) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (state.siteId) {
    params.set('site', state.siteId);
  } else {
    params.delete('site');
  }

  if (state.unitId) {
    params.set('unit', state.unitId);
  } else {
    params.delete('unit');
  }

  if (state.buildingId) {
    params.set('building', state.buildingId);
  } else {
    params.delete('building');
  }

  if (state.createPageOpen) {
    params.set('sitesView', 'create');
  } else {
    params.delete('sitesView');
  }

  const nextSearch = params.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function readStoredResidentAccountSnapshots(storageKey: string) {
  if (!storageKey || typeof window === 'undefined') {
    return {} as Record<string, ResidentAccountSnapshot | undefined>;
  }

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);

    if (!rawValue) {
      return {} as Record<string, ResidentAccountSnapshot | undefined>;
    }

    const parsed = JSON.parse(rawValue) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([profileId, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return [];
        }

        const snapshot = value as Record<string, unknown>;
        const systemPassword = snapshot.systemPassword;
        const passwordUpdatedAt = snapshot.passwordUpdatedAt;

        if (
          (systemPassword !== null && typeof systemPassword !== 'string') ||
          (passwordUpdatedAt !== null && typeof passwordUpdatedAt !== 'string')
        ) {
          return [];
        }

        return [
          [
            profileId,
            {
              systemPassword:
                typeof systemPassword === 'string' || systemPassword === null
                  ? systemPassword
                  : null,
              passwordUpdatedAt:
                typeof passwordUpdatedAt === 'string' || passwordUpdatedAt === null
                  ? passwordUpdatedAt
                  : null
            } satisfies ResidentAccountSnapshot
          ]
        ];
      })
    );
  } catch {
    return {} as Record<string, ResidentAccountSnapshot | undefined>;
  }
}

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSitePlanBlock() {
  return {
    id: createClientId(),
    name: '',
    address: '',
    doorLabel: '',
    floorCount: '',
    distributionMode: 'equal',
    totalUnits: '',
    floorUnitCounts: ['']
  } satisfies SitePlanBlockForm;
}

function createEmptySiteSetupForm() {
  return {
    ...EMPTY_SITE_FORM,
    blocks: [createSitePlanBlock()]
  } satisfies SiteSetupForm;
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
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'tr'));
}

function sortUnits<T extends { floor: number; unitNumber: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (left.floor !== right.floor) {
      return left.floor - right.floor;
    }

    return left.unitNumber.localeCompare(right.unitNumber, 'tr', { numeric: true });
  });
}

function formatLongDate(value?: string | null) {
  if (!value) {
    return 'Bilgi yok';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function formatShortDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase('tr');
}

function newest<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightValue = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightValue - leftValue;
  });
}

export function SitesManagementConsole() {
  const { session } = useAuth();
  const {
    ready,
    state,
    refreshState,
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
    getResidentAccountSnapshot,
    resetResidentPassword
  } = usePortalData();
  const { showToast } = useToast();

  const user = session?.user ?? null;
  const isSuperAdmin = user?.role === 'super_admin';
  const accountSnapshotStorageKey = user?.id ? getResidentAccountSnapshotStorageKey(user.id) : '';

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [expandedBuildingId, setExpandedBuildingId] = useState('');
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [siteForm, setSiteForm] = useState<SiteForm>(EMPTY_SITE_FORM);
  const [buildingForms, setBuildingForms] = useState<Record<string, BuildingForm>>({});
  const [unitForm, setUnitForm] = useState<UnitForm>(EMPTY_UNIT_FORM);
  const [residentForm, setResidentForm] = useState<ResidentForm>(EMPTY_RESIDENT_FORM);
  const [siteSetupForm, setSiteSetupForm] = useState<SiteSetupForm>(createEmptySiteSetupForm());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastCreatedCredentials, setLastCreatedCredentials] =
    useState<GeneratedAccountCredentials | null>(null);
  const [accountSnapshots, setAccountSnapshots] = useState<
    Record<string, ResidentAccountSnapshot | undefined>
  >({});
  const [loadingAccountProfileId, setLoadingAccountProfileId] = useState<string | null>(null);
  const hasInitializedQuerySyncRef = useRef(false);
  const deferredSiteSearchQuery = useDeferredValue(siteSearchQuery);

  const visibleSites = useMemo(
    () => (user ? sortByName(getVisibleSites(state, user)) : []),
    [state, user]
  );
  const visibleBuildings = useMemo(
    () => (user ? getVisibleBuildings(state, user) : []),
    [state, user]
  );
  const visibleUnits = useMemo(() => (user ? getVisibleUnits(state, user) : []), [state, user]);

  const siteSummaries = useMemo(
    () =>
      visibleSites.map((site) => {
        const buildings = sortByName(visibleBuildings.filter((building) => building.siteId === site.id));
        const buildingIdSet = new Set(buildings.map((building) => building.id));
        const units = sortUnits(visibleUnits.filter((unit) => buildingIdSet.has(unit.buildingId)));
        const residentRows = buildUnitResidentRows(state, buildings, units, state.profiles);
        const managerAssignment =
          state.managerSiteAssignments.find((assignment) => assignment.siteId === site.id) ?? null;
        const manager =
          state.profiles.find((profile) => profile.id === managerAssignment?.profileId) ?? null;

        return {
          site,
          buildings,
          units,
          residentRows,
          occupiedUnits: residentRows.filter((row) => row.resident).length,
          manager
        };
      }),
    [state, visibleBuildings, visibleSites, visibleUnits]
  );
  const normalizedSiteSearchQuery = useMemo(
    () => normalizeSearchValue(deferredSiteSearchQuery),
    [deferredSiteSearchQuery]
  );
  const filteredSiteSummaries = useMemo(() => {
    if (!normalizedSiteSearchQuery) {
      return siteSummaries;
    }

    return siteSummaries.filter((summary) => {
      const searchableParts = [
        summary.site.name,
        summary.site.address,
        summary.site.district,
        summary.site.city,
        summary.manager?.fullName ?? '',
        ...summary.buildings.flatMap((building) => [
          building.name,
          building.address,
          building.doorLabel
        ])
      ];

      return searchableParts.some((part) =>
        normalizeSearchValue(part).includes(normalizedSiteSearchQuery)
      );
    });
  }, [normalizedSiteSearchQuery, siteSummaries]);

  const selectedSiteSummary =
    siteSummaries.find((summary) => summary.site.id === selectedSiteId) ?? null;
  const selectedSite = selectedSiteSummary?.site ?? null;
  const selectedSiteBuildings = selectedSiteSummary?.buildings ?? EMPTY_BUILDINGS;
  const selectedSiteUnits = selectedSiteSummary?.units ?? EMPTY_UNITS;
  const selectedSiteResidentRows = selectedSiteSummary?.residentRows ?? EMPTY_RESIDENT_ROWS;
  const selectedSiteUnitIds = new Set(selectedSiteUnits.map((unit) => unit.id));
  const selectedSiteBuildingIds = new Set(selectedSiteBuildings.map((building) => building.id));
  const selectedUnitRow =
    selectedSiteResidentRows.find((row) => row.unit.id === selectedUnitId) ?? null;
  const selectedUnit = selectedUnitRow?.unit ?? null;
  const selectedResident = selectedUnitRow?.resident ?? null;
  const selectedBuilding = selectedUnitRow?.building ?? null;
  const selectedSiteRequests = state.guestRequests.filter((request) =>
    selectedSiteBuildingIds.has(request.buildingId)
  );
  const selectedSiteInvoices = state.invoices.filter((invoice) =>
    selectedSiteUnitIds.has(invoice.unitId)
  );
  const selectedSitePayments = state.payments.filter((payment) =>
    selectedSiteUnitIds.has(payment.unitId)
  );

  const unitRequests = selectedUnit
    ? state.guestRequests.filter((request) => request.unitId === selectedUnit.id)
    : [];
  const unitInvoices = selectedUnit
    ? state.invoices.filter((invoice) => invoice.unitId === selectedUnit.id)
    : [];
  const unitPayments = selectedUnit
    ? state.payments.filter((payment) => payment.unitId === selectedUnit.id)
    : [];
  const unitPackages = selectedUnit
    ? state.packages.filter((item) => item.unitId === selectedUnit.id)
    : [];
  const unitAccessPasses = selectedUnit
    ? state.accessPasses.filter((item) => item.unitId === selectedUnit.id)
    : [];
  const unitOutstandingBalance = unitInvoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((total, invoice) => total + invoice.amount, 0);

  const selectedResidentId = selectedResident?.id ?? '';
  const selectedResidentAccountSnapshot = selectedResidentId
    ? accountSnapshots[selectedResidentId]
    : undefined;
  const latestVisiblePassword =
    selectedResidentAccountSnapshot?.systemPassword ??
    (selectedResident &&
    selectedUnit &&
    lastCreatedCredentials?.role === 'resident' &&
    lastCreatedCredentials.identifier === selectedUnit.unitCode
      ? lastCreatedCredentials.password
      : null);

  const totalPlannedUnits = siteSetupForm.blocks.reduce(
    (sum, block) => sum + getPlannedUnitCountForBlock(block),
    0
  );
  const filteredBuildingCount = filteredSiteSummaries.reduce(
    (sum, summary) => sum + summary.buildings.length,
    0
  );
  const filteredUnitCount = filteredSiteSummaries.reduce(
    (sum, summary) => sum + summary.units.length,
    0
  );
  const filteredOccupiedUnitCount = filteredSiteSummaries.reduce(
    (sum, summary) => sum + summary.occupiedUnits,
    0
  );

  useEffect(() => {
    const queryState = readSitesQueryState();

    setSelectedSiteId((current) => (current === queryState.siteId ? current : queryState.siteId));
    setSelectedUnitId((current) => (current === queryState.unitId ? current : queryState.unitId));
    setExpandedBuildingId((current) =>
      current === queryState.buildingId ? current : queryState.buildingId
    );
    setCreatePageOpen((current) =>
      current === queryState.createPageOpen ? current : queryState.createPageOpen
    );
  }, []);

  useEffect(() => {
    if (!accountSnapshotStorageKey) {
      setAccountSnapshots({});
      return;
    }

    setAccountSnapshots(readStoredResidentAccountSnapshots(accountSnapshotStorageKey));
  }, [accountSnapshotStorageKey]);

  useEffect(() => {
    if (!accountSnapshotStorageKey || typeof window === 'undefined') {
      return;
    }

    const serializableSnapshots = Object.fromEntries(
      Object.entries(accountSnapshots).filter((entry): entry is [string, ResidentAccountSnapshot] =>
        Boolean(entry[1])
      )
    );

    if (!Object.keys(serializableSnapshots).length) {
      window.sessionStorage.removeItem(accountSnapshotStorageKey);
      return;
    }

    window.sessionStorage.setItem(accountSnapshotStorageKey, JSON.stringify(serializableSnapshots));
  }, [accountSnapshotStorageKey, accountSnapshots]);

  useEffect(() => {
    if (!hasInitializedQuerySyncRef.current) {
      hasInitializedQuerySyncRef.current = true;
      return;
    }

    writeSitesQueryState({
      siteId: createPageOpen ? '' : selectedSiteId,
      unitId: createPageOpen ? '' : selectedUnitId,
      buildingId: createPageOpen ? '' : expandedBuildingId,
      createPageOpen
    });
  }, [createPageOpen, expandedBuildingId, selectedSiteId, selectedUnitId]);

  useEffect(() => {
    if (!visibleSites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId('');
      setSelectedUnitId('');
      setExpandedBuildingId('');
    }
  }, [selectedSiteId, visibleSites]);

  useEffect(() => {
    if (!selectedSite) {
      setSiteForm((current) => (sameSiteForm(current, EMPTY_SITE_FORM) ? current : EMPTY_SITE_FORM));
      setBuildingForms((current) => (sameBuildingForms(current, {}) ? current : {}));
      return;
    }

    const nextSiteForm = {
      name: selectedSite.name,
      address: selectedSite.address,
      district: selectedSite.district,
      city: selectedSite.city
    };
    const nextBuildingForms = Object.fromEntries(
      selectedSiteBuildings.map((building) => [
        building.id,
        {
          name: building.name,
          address: building.address,
          doorLabel: building.doorLabel
        }
      ])
    );

    setSiteForm((current) => (sameSiteForm(current, nextSiteForm) ? current : nextSiteForm));
    setBuildingForms((current) =>
      sameBuildingForms(current, nextBuildingForms) ? current : nextBuildingForms
    );
  }, [selectedSite, selectedSiteBuildings]);

  useEffect(() => {
    if (!selectedSiteBuildings.length) {
      setExpandedBuildingId('');
      return;
    }

    if (!selectedSiteBuildings.some((building) => building.id === expandedBuildingId)) {
      setExpandedBuildingId(selectedSiteBuildings[0].id);
    }
  }, [expandedBuildingId, selectedSiteBuildings]);

  useEffect(() => {
    if (!selectedSiteResidentRows.some((row) => row.unit.id === selectedUnitId)) {
      setSelectedUnitId('');
    }
  }, [selectedSiteResidentRows, selectedUnitId]);

  useEffect(() => {
    if (!selectedUnit) {
      setUnitForm((current) => (sameUnitForm(current, EMPTY_UNIT_FORM) ? current : EMPTY_UNIT_FORM));
      setResidentForm((current) =>
        sameResidentForm(current, EMPTY_RESIDENT_FORM) ? current : EMPTY_RESIDENT_FORM
      );
      return;
    }

    const nextUnitForm = {
      unitNumber: selectedUnit.unitNumber,
      floor: String(selectedUnit.floor)
    };

    setUnitForm((current) => (sameUnitForm(current, nextUnitForm) ? current : nextUnitForm));

    if (selectedResident) {
      const nextResidentForm = {
        fullName: selectedResident.fullName,
        phone: selectedResident.phone,
        title: selectedResident.title
      };

      setResidentForm((current) =>
        sameResidentForm(current, nextResidentForm) ? current : nextResidentForm
      );
      return;
    }

    setResidentForm((current) =>
      sameResidentForm(current, EMPTY_RESIDENT_FORM) ? current : EMPTY_RESIDENT_FORM
    );
  }, [selectedResident, selectedUnit]);

  useEffect(() => {
    if (!selectedResidentId) {
      setLoadingAccountProfileId((current) => (current === null ? current : null));
      return;
    }

    if (
      selectedResidentAccountSnapshot !== undefined &&
      loadingAccountProfileId === selectedResidentId
    ) {
      setLoadingAccountProfileId(null);
    }
  }, [loadingAccountProfileId, selectedResidentAccountSnapshot, selectedResidentId]);

  useEffect(() => {
    if (
      !selectedResidentId ||
      selectedResidentAccountSnapshot !== undefined ||
      loadingAccountProfileId === selectedResidentId
    ) {
      return;
    }

    let cancelled = false;
    const residentId = selectedResidentId;
    setLoadingAccountProfileId(residentId);

    void getResidentAccountSnapshot(residentId)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setAccountSnapshots((current) => ({
          ...current,
          [residentId]: snapshot
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        showToast({
          tone: 'warning',
          message: error instanceof Error ? error.message : 'Sakin hesap bilgileri alınamadı.'
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAccountProfileId((current) => (current === residentId ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    getResidentAccountSnapshot,
    loadingAccountProfileId,
    selectedResidentId,
    selectedResidentAccountSnapshot,
    showToast
  ]);

  function openSiteDetails(siteId: string) {
    setCreatePageOpen(false);
    setSelectedSiteId(siteId);
    setSelectedUnitId('');
  }

  function openCreatePage() {
    setSelectedSiteId('');
    setSelectedUnitId('');
    setExpandedBuildingId('');
    setCreatePageOpen(true);
  }

  function closeCreatePage() {
    setCreatePageOpen(false);
  }

  function closeSiteDetails() {
    setSelectedSiteId('');
    setSelectedUnitId('');
    setExpandedBuildingId('');
    setCreatePageOpen(false);
  }

  function openUnitDetails(buildingId: string, unitId: string) {
    setExpandedBuildingId(buildingId);
    setSelectedUnitId(unitId);
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
        message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.'
      });
    } finally {
      setPendingAction((current) => (current === actionKey ? null : current));
    }
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
        throw new Error(`${block.name || `${index + 1}. blok`} için en az bir daire oluşturun.`);
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
        throw new Error('Site kimliği alınamadı.');
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
      setCreatePageOpen(false);
      openSiteDetails(createdSiteId);
      setExpandedBuildingId('');
      setSiteSetupForm(createEmptySiteSetupForm());
    } catch (error) {
      if (createdSiteId && shouldRollback) {
        try {
          await deleteSite(createdSiteId);
        } catch {
          // Yarım kalan kurulumda kaskad silme ile temizlemeyi deneriz.
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
    setResidentForm(EMPTY_RESIDENT_FORM);
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
  }

  async function handleDeleteSelectedResident() {
    if (!selectedResident) {
      throw new Error('Bu dairede silinecek sakin yok.');
    }

    const deletedProfileId = selectedResident.id;
    await deleteResident(deletedProfileId);
    setAccountSnapshots((current) => {
      const next = { ...current };
      delete next[deletedProfileId];
      return next;
    });
    setResidentForm(EMPTY_RESIDENT_FORM);
  }

  async function handleResetSelectedResidentPassword() {
    if (!selectedResident || !selectedUnit) {
      throw new Error('Şifresi güncellenecek sakin bulunamadı.');
    }

    const snapshot = await resetResidentPassword(selectedResident.id);

    setAccountSnapshots((current) => ({
      ...current,
      [selectedResident.id]: snapshot
    }));

    if (snapshot.systemPassword) {
      setLastCreatedCredentials({
        fullName: selectedResident.fullName,
        identifier: selectedUnit.unitCode,
        password: snapshot.systemPassword,
        role: 'resident'
      });
    }
  }

  if (!user || !isSuperAdmin) {
    return null;
  }

  if (!ready) {
    return (
      <section className="app-card p-6">
        <p className="app-kicker">Siteler</p>
        <h3 className="mt-2 font-heading text-2xl font-bold">Veriler hazırlanıyor</h3>
      </section>
    );
  }

  let content: ReactNode = null;

  if (!selectedSite) {
    content = (
      <div className="space-y-6">
        {!createPageOpen ? (
          <section className="app-card overflow-hidden p-0">
            <div className="border-b-2 border-[var(--color-line)] px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="app-kicker">Siteler</p>
                  <h3 className="mt-1 font-heading text-2xl font-bold">Site listesi</h3>
                </div>

                <div className="flex w-full flex-col gap-3 xl:max-w-[760px]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                    <div className="relative w-full lg:max-w-[360px]">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                      <input
                        className="app-input px-11 py-3"
                        value={siteSearchQuery}
                        onChange={(event) => setSiteSearchQuery(event.target.value)}
                        placeholder="Site ara"
                        type="search"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={openCreatePage}
                      className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      Yeni site
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-soft)] px-3 py-1 font-semibold text-[var(--color-text)]">
                      {filteredSiteSummaries.length} site
                    </span>
                    <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-soft)] px-3 py-1 font-semibold text-[var(--color-text)]">
                      {filteredBuildingCount} blok
                    </span>
                    <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-soft)] px-3 py-1 font-semibold text-[var(--color-text)]">
                      {filteredUnitCount} daire
                    </span>
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
                      {filteredOccupiedUnitCount}/{filteredUnitCount || 0} dolu
                    </span>
                    {normalizedSiteSearchQuery ? (
                      <span className="rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-1 font-semibold text-[var(--color-accent)]">
                        Filtre aktif
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <table className="data-table text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[var(--color-panel-strong)] [&_th]:px-4 [&_th]:py-3">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Konum</th>
                    <th>Oluşturulma</th>
                    <th>Blok</th>
                    <th>Daire</th>
                    <th>Doluluk</th>
                    <th>Yönetici</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSiteSummaries.map((summary) => (
                    <tr
                      key={summary.site.id}
                      tabIndex={0}
                      onClick={() => openSiteDetails(summary.site.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openSiteDetails(summary.site.id);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      <td>
                        <div>
                          <p className="font-semibold">{summary.site.name}</p>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            {summary.site.address}
                          </p>
                        </div>
                      </td>
                      <td>
                        {summary.site.district} / {summary.site.city}
                      </td>
                      <td>{formatShortDate(summary.site.createdAt)}</td>
                      <td>{summary.buildings.length}</td>
                      <td>{summary.units.length}</td>
                      <td>
                        <span
                          className={`inline-flex min-w-[68px] items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold ${
                            summary.units.length === 0
                              ? 'border-[var(--color-line)] bg-[var(--color-panel-soft)] text-[var(--color-muted)]'
                              : summary.occupiedUnits === summary.units.length
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                                : summary.occupiedUnits > 0
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                                  : 'border-sky-500/40 bg-sky-500/10 text-sky-700'
                          }`}
                        >
                          {summary.occupiedUnits}/{summary.units.length}
                        </span>
                      </td>
                      <td>{summary.manager?.fullName ?? 'Atanmadı'}</td>
                    </tr>
                  ))}
                  {!filteredSiteSummaries.length ? (
                    <tr>
                      <td colSpan={7} className="text-center text-sm text-[var(--color-muted)]">
                        {normalizedSiteSearchQuery
                          ? 'Aramaya uygun site bulunamadı.'
                          : 'Henüz kayıtlı site bulunmuyor.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {createPageOpen ? (
          <section className="app-card p-6">
            <button
              type="button"
              onClick={closeCreatePage}
              className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em]"
            >
              <ArrowLeft className="h-4 w-4" />
              Site listesi
            </button>

            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-kicker">Yeni site</p>
              <h3 className="mt-2 font-heading text-2xl font-bold">Site oluştur</h3>
            </div>

            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Özet
              </p>
              <p className="mt-2 font-semibold">
                {siteSetupForm.blocks.length} blok · {totalPlannedUnits} daire
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-4">
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
                Her blok için kat ve daire düzenini belirleyin.
              </p>
            </div>

            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() =>
                setSiteSetupForm((current) => ({
                  ...current,
                  blocks: [...current.blocks, createSitePlanBlock()]
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
              const previewFloorCounts =
                block.distributionMode === 'equal'
                  ? getEqualDistribution(block.totalUnits, block.floorCount)
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
                        disabled={pendingAction !== null}
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
                        Kat bazlı dağılım
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
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={pendingAction !== null}
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
        ) : null}
      </div>
    );
  } else if (!selectedUnit || !selectedBuilding) {
    content = (
      <div className="space-y-6">
        <section className="app-card p-6">
          <button
            type="button"
            onClick={closeSiteDetails}
            className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em]"
          >
            <ArrowLeft className="h-4 w-4" />
            Site listesi
          </button>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-kicker">Site</p>
              <h3 className="mt-2 font-heading text-3xl font-bold">{selectedSite.name}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
                {selectedSite.address} · {selectedSite.district} / {selectedSite.city}
              </p>
            </div>

            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Özet
              </p>
              <p className="mt-2 font-semibold">
                {selectedSiteBuildings.length} blok · {selectedSiteUnits.length} daire
              </p>
            </div>
          </div>

          <div className="mt-6 metric-grid lg:grid-cols-4">
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Dolu daire
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">
                {selectedSiteSummary?.occupiedUnits ?? 0}
              </p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Açık bakiye
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">
                {formatCurrency(
                  selectedSiteInvoices
                    .filter((invoice) => invoice.status !== 'paid')
                    .reduce((total, invoice) => total + invoice.amount, 0)
                )}
              </p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Ziyaret kaydı
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">{selectedSiteRequests.length}</p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Yönetici
              </p>
              <p className="mt-3 font-semibold">
                {selectedSiteSummary?.manager?.fullName ?? 'Atanmadı'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
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
              disabled={pendingAction !== null}
              onClick={() =>
                void run(
                  `update-site:${selectedSite.id}`,
                  () =>
                    updateSiteDetails({
                      siteId: selectedSite.id,
                      name: siteForm.name.trim() || selectedSite.name,
                      address: siteForm.address.trim() || selectedSite.address,
                      district: siteForm.district.trim() || selectedSite.district,
                      city: siteForm.city.trim() || selectedSite.city
                    }),
                  'Site güncellendi.'
                )
              }
              className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renderActionLabel(`update-site:${selectedSite.id}`, 'Kaydet', 'Kaydediliyor')}
            </button>
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() =>
                void run(
                  `delete-site:${selectedSite.id}`,
                  async () => {
                    await deleteSite(selectedSite.id);
                    setSelectedSiteId('');
                    setSelectedUnitId('');
                    setExpandedBuildingId('');
                  },
                  'Site silindi.',
                  'info'
                )
              }
              className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {renderActionLabel(`delete-site:${selectedSite.id}`, 'Siteyi sil', 'Siliniyor')}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-kicker">Bloklar</p>
              <h3 className="mt-2 font-heading text-2xl font-bold">Blok listesi</h3>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Ödemeler
              </p>
              <p className="mt-2 font-semibold">{selectedSitePayments.length} kayıt</p>
            </div>
          </div>

          {selectedSiteBuildings.map((building) => {
            const isOpen = expandedBuildingId === building.id;
            const form = buildingForms[building.id] ?? EMPTY_BUILDING_FORM;
            const buildingRows = selectedSiteResidentRows.filter(
              (row) => row.building?.id === building.id
            );
            const occupiedCount = buildingRows.filter((row) => row.resident).length;

            return (
              <section key={building.id} className="app-card overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBuildingId((current) => (current === building.id ? '' : building.id))
                  }
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Blok
                    </p>
                    <h4 className="mt-2 font-heading text-2xl font-bold">{building.name}</h4>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      {buildingRows.length} daire · {occupiedCount} dolu · Kapı etiketi:{' '}
                      {building.doorLabel}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[var(--color-accent)] transition ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen ? (
                  <div className="border-t-2 border-[var(--color-line)] px-6 py-5">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <input
                        className="app-input px-4 py-4"
                        value={form.name}
                        onChange={(event) =>
                          setBuildingForms((current) => ({
                            ...current,
                            [building.id]: {
                              ...form,
                              name: event.target.value
                            }
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
                            [building.id]: {
                              ...form,
                              doorLabel: event.target.value
                            }
                          }))
                        }
                        placeholder="Kapı etiketi"
                        type="text"
                      />
                      <input
                        className="app-input px-4 py-4 lg:col-span-3"
                        value={form.address}
                        onChange={(event) =>
                          setBuildingForms((current) => ({
                            ...current,
                            [building.id]: {
                              ...form,
                              address: event.target.value
                            }
                          }))
                        }
                        placeholder="Blok adresi"
                        type="text"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={pendingAction !== null}
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
                        className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {renderActionLabel(
                          `update-building:${building.id}`,
                          'Bloğu kaydet',
                          'Kaydediliyor'
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() =>
                          void run(
                            `delete-building:${building.id}`,
                            async () => {
                              await deleteBuilding(building.id);
                              if (expandedBuildingId === building.id) {
                                setExpandedBuildingId('');
                              }
                            },
                            'Blok silindi.',
                            'info'
                          )
                        }
                        className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {renderActionLabel(
                          `delete-building:${building.id}`,
                          'Bloğu sil',
                          'Siliniyor'
                        )}
                      </button>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Daire</th>
                            <th>Kat</th>
                            <th>Durum</th>
                            <th>Sakin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {buildingRows.map((row) => {
                            const isOccupied = Boolean(row.resident);
                            return (
                              <tr
                                key={row.unit.id}
                                tabIndex={0}
                                onClick={() => openUnitDetails(building.id, row.unit.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    openUnitDetails(building.id, row.unit.id);
                                  }
                                }}
                                className="cursor-pointer transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                              >
                                <td className="font-semibold">{row.unit.unitNumber}</td>
                                <td>{row.unit.floor}</td>
                                <td>{isOccupied ? 'Dolu' : 'Boş'}</td>
                                <td>{row.resident?.fullName ?? '-'}</td>
                              </tr>
                            );
                          })}
                          {!buildingRows.length ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="text-center text-sm text-[var(--color-muted)]"
                              >
                                Bu blokta daire kaydı yok.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}

          {!selectedSiteBuildings.length ? (
            <div className="app-card p-6 text-sm text-[var(--color-muted)]">
              Blok kaydı yok.
            </div>
          ) : null}
        </section>
      </div>
    );
  } else {
    content = (
      <div className="space-y-6">
        <section className="app-card p-6">
          <button
            type="button"
            onClick={() => setSelectedUnitId('')}
            className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em]"
          >
            <ArrowLeft className="h-4 w-4" />
            Site
          </button>

          <div className="mt-5">
            <p className="app-kicker">Daire</p>
            <h3 className="mt-2 font-heading text-3xl font-bold">
              {selectedBuilding.name} / Daire {selectedUnit.unitNumber}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
              {selectedSite.name} · Daire ID: {selectedUnit.unitCode}
            </p>
          </div>

          <div className="mt-6 metric-grid md:grid-cols-4">
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Kat
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">{selectedUnit.floor}</p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Durum
              </p>
              <p className="mt-3 font-semibold">{selectedResident ? 'Dolu' : 'Boş'}</p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Açık bakiye
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">
                {formatCurrency(unitOutstandingBalance)}
              </p>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Kayıt tarihi
              </p>
              <p className="mt-3 font-semibold">{formatLongDate(selectedUnit.createdAt)}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="app-card p-6">
            <p className="app-kicker">Daire Bilgileri</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">Kimlik ve konum</h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                className="app-input px-4 py-4"
                value={unitForm.unitNumber}
                onChange={(event) =>
                  setUnitForm((current) => ({
                    ...current,
                    unitNumber: event.target.value
                  }))
                }
                placeholder="Daire numarası"
                type="text"
              />
              <input
                className="app-input px-4 py-4"
                value={unitForm.floor}
                onChange={(event) =>
                  setUnitForm((current) => ({
                    ...current,
                    floor: event.target.value
                  }))
                }
                min={1}
                placeholder="Kat"
                type="number"
              />
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Konum
                </p>
                <p className="mt-2 font-semibold">
                  {selectedSite.name} / {selectedBuilding.name} / Daire {selectedUnit.unitNumber}
                </p>
              </div>
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Daire ID
                </p>
                <p className="mt-2 font-semibold text-[var(--color-accent)]">
                  {selectedUnit.unitCode}
                </p>
              </div>
              <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Etiket
                </p>
                <p className="mt-2 font-semibold">{unitLabel(state, selectedUnit.id)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() =>
                  void run(
                    `update-unit:${selectedUnit.id}`,
                    () =>
                      updateUnitDetails({
                        unitId: selectedUnit.id,
                        unitNumber: unitForm.unitNumber.trim() || selectedUnit.unitNumber,
                        floor: parsePositiveInteger(unitForm.floor, selectedUnit.floor)
                      }),
                    'Daire güncellendi.'
                  )
                }
                className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {renderActionLabel(`update-unit:${selectedUnit.id}`, 'Kaydet', 'Kaydediliyor')}
              </button>
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() =>
                  void run(
                    `delete-unit:${selectedUnit.id}`,
                    async () => {
                      await deleteUnit(selectedUnit.id);
                      setSelectedUnitId('');
                    },
                    'Daire silindi.',
                    'info'
                  )
                }
                className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {renderActionLabel(`delete-unit:${selectedUnit.id}`, 'Daireyi sil', 'Siliniyor')}
              </button>
            </div>
          </section>

          <section className="app-card p-6">
            <p className="app-kicker">Sakin ve Hesap</p>
            <h3 className="mt-2 font-heading text-2xl font-bold">
              {selectedResident ? 'Oturan bilgileri' : 'Bu daire için sakin oluştur'}
            </h3>

            {selectedResident ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-[var(--color-accent)]" />
                      <p className="font-semibold">{selectedResident.fullName}</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      {selectedResident.title}
                    </p>
                    {selectedResident.role === 'manager' ? (
                      <p className="mt-2 inline-flex rounded-full border border-[var(--color-accent)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent)]">
                        Site yöneticisi
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[var(--color-accent)]" />
                      <p className="font-semibold">Hesap erişimi</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      Giriş kimliği: {selectedResident.loginId}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Telefon: {selectedResident.phone}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
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

                <div className="mt-5 space-y-3">
                  <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Sakin kayıt bilgisi
                    </p>
                    <p className="mt-2 font-semibold">
                      Kayıt / yerleşim tarihi: {formatLongDate(selectedResident.createdAt)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      Sistem şifresi: {latestVisiblePassword ?? 'Görüntülenebilir kayıt yok'}
                    </p>
                    {selectedResidentAccountSnapshot?.passwordUpdatedAt ? (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Son üretim: {formatDateTime(selectedResidentAccountSnapshot.passwordUpdatedAt)}
                      </p>
                    ) : null}
                    {loadingAccountProfileId === selectedResident.id &&
                    selectedResidentAccountSnapshot === undefined ? (
                      <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Hesap detayı yükleniyor...
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      void run(
                        `update-resident:${selectedResident.id}`,
                        handleUpdateSelectedResident,
                        'Sakin bilgileri güncellendi.'
                      )
                    }
                    className="app-button inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {renderActionLabel(
                      `update-resident:${selectedResident.id}`,
                      'Bilgileri kaydet',
                      'Kaydediliyor'
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      void run(
                        `reset-password:${selectedResident.id}`,
                        handleResetSelectedResidentPassword,
                        'Yeni şifre üretildi.'
                      )
                    }
                    className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <KeyRound className="h-4 w-4" />
                    {renderActionLabel(
                      `reset-password:${selectedResident.id}`,
                      'Şifreyi değiştir',
                      'Üretiliyor'
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      void run(
                        `delete-resident:${selectedResident.id}`,
                        handleDeleteSelectedResident,
                        'Sakin hesabı silindi.',
                        'info'
                      )
                    }
                    className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
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
                <div className="mt-5 rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Sakin kaydı yok.
                </div>

                <div className="mt-5 grid gap-3">
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
                </div>

                <div className="mt-5 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Oluşacak giriş
                  </p>
                  <p className="mt-2 font-semibold">Daire ID: {selectedUnit.unitCode}</p>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
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
                      'Sakin oluştur',
                      'Oluşturuluyor'
                    )}
                  </button>
                </div>

                {lastCreatedCredentials?.role === 'resident' &&
                lastCreatedCredentials.identifier === selectedUnit.unitCode ? (
                  <div className="mt-5 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Oluşan hesap
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
              </>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="app-card p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <p className="app-kicker">Ziyaret Geçmişi</p>
                <h3 className="mt-1 font-heading text-xl font-bold">Çağrılar</h3>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {unitRequests.length ? (
                newest(
                  unitRequests.map((request) => ({
                    ...request,
                    createdAt: request.createdAt
                  }))
                ).map((request) => (
                  <div
                    key={request.id}
                    className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                  >
                    <p className="font-semibold">{request.guestName}</p>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      {requestTypeLabel(request.type)} · {requestStatusLabel(request.status)}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-muted)]">
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Bu daire için ziyaret veya kurye kaydı bulunmuyor.
                </div>
              )}
            </div>
          </section>

          <section className="app-card p-6">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <p className="app-kicker">Finans</p>
                <h3 className="mt-1 font-heading text-xl font-bold">Aidat ve ödemeler</h3>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {unitInvoices.length ? (
                newest(
                  unitInvoices.map((invoice) => ({
                    ...invoice,
                    createdAt: invoice.paidAt ?? invoice.dueDate
                  }))
                ).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{invoice.periodLabel}</p>
                        <p className="mt-2 text-sm text-[var(--color-muted)]">
                          Vade: {formatLongDate(invoice.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(invoice.amount)}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                          {invoice.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Bu daire için aidat kaydı bulunmuyor.
                </div>
              )}
            </div>

            {unitPayments.length ? (
              <div className="mt-5 rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Son ödeme
                </p>
                <p className="mt-2 font-semibold">{formatCurrency(unitPayments[0].amount)}</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {unitPayments[0].recordedBy} · {formatDateTime(unitPayments[0].recordedAt)}
                </p>
              </div>
            ) : null}
          </section>

          <section className="app-card p-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <p className="app-kicker">Diğer Kayıtlar</p>
                <h3 className="mt-1 font-heading text-xl font-bold">Kargo ve erişim</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {unitPackages.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <p className="font-semibold">{item.courierName}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {packageStatusLabel(item.status)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {formatDateTime(item.arrivedAt)}
                  </p>
                </div>
              ))}
              {!unitPackages.length ? (
                <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Kargo kaydı bulunmuyor.
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {unitAccessPasses.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] p-4"
                >
                  <p className="font-semibold">{item.holderName}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    Kod: {item.accessCode} · {item.status}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Son kullanım: {formatLongDate(item.expiresAt)}
                  </p>
                </div>
              ))}
              {!unitAccessPasses.length ? (
                <div className="rounded-md border-2 border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                  Bu daire için erişim kodu kaydı bulunmuyor.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return <div className="space-y-6">{content}</div>;
}
