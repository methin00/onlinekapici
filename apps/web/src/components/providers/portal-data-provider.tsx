'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createEmptyPortalState, fetchPortalState } from '@/lib/supabase/portal';
import { withSupabaseTimeout } from '@/lib/supabase/runtime';
import type {
  Announcement,
  GateEvent,
  GuestRequest,
  GuestRequestStatus,
  GuestRequestType,
  PackageStatus,
  PortalState,
  ProviderCategory
} from '@/lib/portal-types';
import { useAuth } from './auth-provider';

type CreateGuestRequestInput = {
  buildingId: string;
  unitId: string;
  guestName: string;
  type: GuestRequestType;
  actorName: string;
  actorProfileId?: string;
};

type CreateAnnouncementInput = {
  siteId: string;
  title: string;
  summary: string;
  category: Announcement['category'];
};

type CreatePackageInput = {
  unitId: string;
  courierName: string;
  trackingCode?: string;
};

type CreateSiteInput = {
  name: string;
  address: string;
  district: string;
  city: string;
};

type UpdateSiteInput = {
  siteId: string;
  name: string;
  address: string;
  district: string;
  city: string;
};

type CreateBuildingInput = {
  siteId: string;
  name: string;
  address: string;
  apiKey: string;
  doorLabel: string;
  kioskCode: string;
};

type UpdateBuildingInput = {
  buildingId: string;
  name: string;
  address: string;
  apiKey: string;
  doorLabel: string;
  kioskCode: string;
};

type CreateUnitInput = {
  buildingId: string;
  unitNumber: string;
  floor: number;
};

type UpdateUnitInput = {
  unitId: string;
  unitNumber: string;
  floor: number;
};

type CreateResidentInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  title: string;
  loginId: string;
  unitId: string;
};

type CreateServiceProviderInput = {
  siteId: string;
  category: ProviderCategory;
  fullName: string;
  phone: string;
  note: string;
};

type UpdateServiceProviderInput = {
  providerId: string;
  category: ProviderCategory;
  fullName: string;
  phone: string;
  note: string;
};

type AssignSiteManagerInput = {
  siteId: string;
  profileId: string | null;
};

type SetConsultantAssignmentInput = {
  siteId: string;
  profileId: string;
  assigned: boolean;
};

type UpsertSiteInvoicePlanInput = {
  siteId: string;
  amount: number;
  dueDay: number;
  active: boolean;
};

type CreateAccessPassInput = {
  unitId: string;
  holderName: string;
  type: 'qr' | 'nfc';
};

type PortalDataContextValue = {
  ready: boolean;
  state: PortalState;
  refreshState: () => Promise<void>;
  createGuestRequest: (input: CreateGuestRequestInput) => Promise<GuestRequest>;
  updateGuestRequest: (
    requestId: string,
    status: Extract<GuestRequestStatus, 'approved' | 'rejected' | 'redirected'>,
    actorName: string
  ) => Promise<GuestRequest>;
  triggerGate: (
    buildingId: string,
    actorName: string,
    requestId?: string,
    source?: GateEvent['source']
  ) => Promise<GateEvent>;
  setInvoiceStatus: (
    invoiceId: string,
    status: 'paid' | 'unpaid' | 'overdue',
    actorName: string
  ) => Promise<void>;
  createAnnouncement: (input: CreateAnnouncementInput) => Promise<void>;
  markAnnouncementRead: (announcementId: string, profileId: string) => Promise<void>;
  createPackageRecord: (input: CreatePackageInput) => Promise<void>;
  updatePackageStatus: (packageId: string, status: PackageStatus) => Promise<void>;
  createSite: (input: CreateSiteInput) => Promise<void>;
  updateSiteDetails: (input: UpdateSiteInput) => Promise<void>;
  deleteSite: (siteId: string) => Promise<void>;
  createBuilding: (input: CreateBuildingInput) => Promise<void>;
  updateBuildingDetails: (input: UpdateBuildingInput) => Promise<void>;
  deleteBuilding: (buildingId: string) => Promise<void>;
  createUnit: (input: CreateUnitInput) => Promise<void>;
  updateUnitDetails: (input: UpdateUnitInput) => Promise<void>;
  deleteUnit: (unitId: string) => Promise<void>;
  createResident: (input: CreateResidentInput) => Promise<void>;
  assignSiteManager: (input: AssignSiteManagerInput) => Promise<void>;
  setConsultantAssignment: (input: SetConsultantAssignmentInput) => Promise<void>;
  upsertSiteInvoicePlan: (input: UpsertSiteInvoicePlanInput) => Promise<void>;
  syncInvoicePlans: (siteIds?: string[]) => Promise<void>;
  setResidentAwayMode: (profileId: string, awayModeEnabled: boolean) => Promise<void>;
  createServiceProvider: (input: CreateServiceProviderInput) => Promise<void>;
  updateServiceProviderDetails: (input: UpdateServiceProviderInput) => Promise<void>;
  deleteServiceProvider: (providerId: string) => Promise<void>;
  createAccessPass: (input: CreateAccessPassInput) => Promise<void>;
  consumeAccessPass: (passId: string) => Promise<void>;
};

const PortalDataContext = createContext<PortalDataContextValue | null>(null);
const PORTAL_STATE_TIMEOUT_MESSAGE = 'Veriler şu anda alınamıyor. Lütfen sayfayı yenileyin.';

function assertAuthenticated() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  return client;
}

function createRealtimeTables() {
  return [
    'sites',
    'buildings',
    'units',
    'profiles',
    'resident_preferences',
    'manager_site_assignments',
    'consultant_site_assignments',
    'guest_requests',
    'logs',
    'announcements',
    'announcement_reads',
    'site_invoice_plans',
    'invoices',
    'payment_records',
    'packages',
    'package_events',
    'service_providers',
    'access_passes',
    'notifications',
    'gate_events',
    'emergency_alerts'
  ];
}

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [state, setState] = useState<PortalState>(createEmptyPortalState());
  const [ready, setReady] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refreshState() {
    if (!session?.user) {
      setState(createEmptyPortalState());
      setReady(true);
      return;
    }

    const client = assertAuthenticated();

    if (session.user.siteIds.length) {
      try {
        await syncInvoicePlans(session.user.siteIds);
      } catch {
        // Aidat planı henüz kurulmamış olabilir; ana veri akışını bloklamayalım.
      }
    }

    const nextState = await withSupabaseTimeout(
      fetchPortalState(client, session.user),
      12000,
      PORTAL_STATE_TIMEOUT_MESSAGE
    );
    setState(nextState);
    setReady(true);
  }

  async function adminPortalAction(action: string, payload: Record<string, unknown>) {
    if (!session?.token) {
      throw new Error('Bu işlem için geçerli yönetici oturumu gerekiyor.');
    }

    const response = await fetch('/api/admin/portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ action, payload })
    });

    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(result?.error ?? 'Yönetim işlemi tamamlanamadı.');
    }
  }

  async function syncInvoicePlans(siteIds?: string[]) {
    if (!session?.token) {
      return;
    }

    await adminPortalAction('syncInvoicePlans', {
      siteIds: siteIds?.length ? siteIds : session.user.siteIds
    });
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!session?.user) {
      setState(createEmptyPortalState());
      setReady(true);
      return;
    }

    setReady(false);
    void refreshState().catch(() => {
      setState(createEmptyPortalState());
      setReady(true);
    });
  }, [authLoading, session?.user]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();

    if (!client || !session?.user) {
      return;
    }

    const channel = client.channel(`portal-sync-${session.user.id}`);

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        void refreshState().catch(() => undefined);
      }, 250);
    };

    for (const table of createRealtimeTables()) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table
        },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      void client.removeChannel(channel);
    };
  }, [session?.user]);

  async function createGuestRequest(input: CreateGuestRequestInput) {
    const client = assertAuthenticated();
    const { data, error } = await client
      .from('guest_requests')
      .insert({
        building_id: input.buildingId,
        unit_id: input.unitId,
        guest_name: input.guestName.trim(),
        type: input.type,
        created_by_profile_id: input.actorProfileId ?? null
      })
      .select('id, building_id, unit_id, guest_name, type, status, created_at, expires_at, decided_at, created_by_profile_id, last_action_by')
      .single();

    if (error || !data) {
      throw new Error('Çağrı iletilemedi. Lütfen yeniden deneyin.');
    }

    await refreshState();

    return {
      id: data.id,
      buildingId: data.building_id,
      unitId: data.unit_id,
      guestName: data.guest_name,
      type: data.type,
      status: data.status,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      decidedAt: data.decided_at ?? undefined,
      createdByProfileId: data.created_by_profile_id ?? undefined,
      lastActionBy: data.last_action_by ?? undefined
    };
  }

  async function updateGuestRequest(
    requestId: string,
    status: Extract<GuestRequestStatus, 'approved' | 'rejected' | 'redirected'>,
    actorName: string
  ) {
    const client = assertAuthenticated();
    const { data, error } = await client
      .from('guest_requests')
      .update({
        status,
        decided_at: new Date().toISOString(),
        last_action_by: actorName
      })
      .eq('id', requestId)
      .select('id, building_id, unit_id, guest_name, type, status, created_at, expires_at, decided_at, created_by_profile_id, last_action_by')
      .single();

    if (error || !data) {
      throw new Error('Çağrı güncellenemedi.');
    }

    await refreshState();

    return {
      id: data.id,
      buildingId: data.building_id,
      unitId: data.unit_id,
      guestName: data.guest_name,
      type: data.type,
      status: data.status,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      decidedAt: data.decided_at ?? undefined,
      createdByProfileId: data.created_by_profile_id ?? undefined,
      lastActionBy: data.last_action_by ?? undefined
    };
  }

  async function triggerGate(
    buildingId: string,
    actorName: string,
    requestId?: string,
    source: GateEvent['source'] = 'dashboard'
  ) {
    const client = assertAuthenticated();

    const { data, error } = await client
      .from('gate_events')
      .insert({
        building_id: buildingId,
        request_id: requestId ?? null,
        source,
        result: 'simulated',
        actor_name: actorName
      })
      .select('id, building_id, request_id, source, result, actor_name, created_at')
      .single();

    if (error || !data) {
      throw new Error('Kapı komutu kaydedilemedi.');
    }

    await refreshState();

    return {
      id: data.id,
      buildingId: data.building_id,
      requestId: data.request_id ?? undefined,
      source: data.source,
      result: data.result,
      createdAt: data.created_at,
      actorName: data.actor_name
    };
  }

  async function setInvoiceStatus(invoiceId: string, status: 'paid' | 'unpaid' | 'overdue', actorName: string) {
    const client = assertAuthenticated();
    const targetInvoice = state.invoices.find((entry) => entry.id === invoiceId);

    if (!targetInvoice) {
      throw new Error('Aidat kaydı bulunamadı.');
    }

    const paidAt = status === 'paid' ? new Date().toISOString() : null;

    const { error: invoiceError } = await client
      .from('invoices')
      .update({
        status,
        paid_at: paidAt
      })
      .eq('id', invoiceId);

    if (invoiceError) {
      throw new Error('Aidat kaydı güncellenemedi.');
    }

    if (status === 'paid') {
      const paymentPayload = {
        invoice_id: targetInvoice.id,
        unit_id: targetInvoice.unitId,
        amount: targetInvoice.amount,
        recorded_at: paidAt ?? new Date().toISOString(),
        recorded_by: actorName
      };

      const { error: paymentError } = await client.from('payment_records').upsert(paymentPayload, {
        onConflict: 'invoice_id'
      });

      if (paymentError) {
        throw new Error('Ödeme kaydı oluşturulamadı.');
      }
    } else {
      const { error: deleteError } = await client.from('payment_records').delete().eq('invoice_id', invoiceId);

      if (deleteError) {
        throw new Error('Eski ödeme kaydı temizlenemedi.');
      }
    }

    await refreshState();
  }

  async function createAnnouncement(input: CreateAnnouncementInput) {
    const client = assertAuthenticated();
    const { error } = await client.from('announcements').insert({
      site_id: input.siteId,
      title: input.title.trim(),
      summary: input.summary.trim(),
      category: input.category,
      pinned: false
    });

    if (error) {
      throw new Error('Duyuru yayınlanamadı.');
    }

    await refreshState();
  }

  async function markAnnouncementRead(announcementId: string, profileId: string) {
    const client = assertAuthenticated();
    const { error } = await client.from('announcement_reads').upsert(
      {
        announcement_id: announcementId,
        profile_id: profileId,
        read_at: new Date().toISOString()
      },
      {
        onConflict: 'announcement_id,profile_id'
      }
    );

    if (error) {
      throw new Error('Duyuru okundu bilgisi kaydedilemedi.');
    }

    await refreshState();
  }

  async function createPackageRecord(input: CreatePackageInput) {
    const client = assertAuthenticated();
    const { error } = await client.from('packages').insert({
      unit_id: input.unitId,
      courier_name: input.courierName.trim(),
      tracking_code: input.trackingCode?.trim() ?? ''
    });

    if (error) {
      throw new Error('Kargo kaydı oluşturulamadı.');
    }

    await refreshState();
  }

  async function createSite(input: CreateSiteInput) {
    await adminPortalAction('createSite', input);
    await refreshState();
  }

  async function updateSiteDetails(input: UpdateSiteInput) {
    const client = assertAuthenticated();
    const { error } = await client
      .from('sites')
      .update({
        name: input.name.trim(),
        address: input.address.trim(),
        district: input.district.trim(),
        city: input.city.trim()
      })
      .eq('id', input.siteId);

    if (error) {
      throw new Error('Site ayarları güncellenemedi.');
    }

    await refreshState();
  }

  async function deleteSite(siteId: string) {
    await adminPortalAction('deleteSite', { siteId });
    await refreshState();
  }

  async function createBuilding(input: CreateBuildingInput) {
    await adminPortalAction('createBuilding', input);
    await refreshState();
  }

  async function updateBuildingDetails(input: UpdateBuildingInput) {
    const client = assertAuthenticated();
    const { error } = await client
      .from('buildings')
      .update({
        name: input.name.trim(),
        address: input.address.trim(),
        api_key: input.apiKey.trim(),
        door_label: input.doorLabel.trim(),
        kiosk_code: input.kioskCode.trim()
      })
      .eq('id', input.buildingId);

    if (error) {
      throw new Error('Blok detayları güncellenemedi.');
    }

    await refreshState();
  }

  async function deleteBuilding(buildingId: string) {
    await adminPortalAction('deleteBuilding', { buildingId });
    await refreshState();
  }

  async function createUnit(input: CreateUnitInput) {
    await adminPortalAction('createUnit', input);
    await refreshState();
  }

  async function updateUnitDetails(input: UpdateUnitInput) {
    await adminPortalAction('updateUnit', input);
    await refreshState();
  }

  async function deleteUnit(unitId: string) {
    await adminPortalAction('deleteUnit', { unitId });
    await refreshState();
  }

  async function createResident(input: CreateResidentInput) {
    await adminPortalAction('createResident', input);
    await refreshState();
  }

  async function assignSiteManager(input: AssignSiteManagerInput) {
    await adminPortalAction('assignSiteManager', input);
    await refreshState();
  }

  async function setConsultantAssignment(input: SetConsultantAssignmentInput) {
    await adminPortalAction('setConsultantAssignment', input);
    await refreshState();
  }

  async function upsertSiteInvoicePlan(input: UpsertSiteInvoicePlanInput) {
    await adminPortalAction('upsertSiteInvoicePlan', input);
    await syncInvoicePlans([input.siteId]);
    await refreshState();
  }

  async function setResidentAwayMode(profileId: string, awayModeEnabled: boolean) {
    const client = assertAuthenticated();
    const { error } = await client.from('resident_preferences').upsert(
      {
        profile_id: profileId,
        away_mode_enabled: awayModeEnabled,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'profile_id'
      }
    );

    if (error) {
      throw new Error('Evde yokum tercihi güncellenemedi.');
    }

    await refreshState();
  }

  async function updatePackageStatus(packageId: string, status: PackageStatus) {
    const client = assertAuthenticated();
    const deliveredAt = status === 'delivered' ? new Date().toISOString() : null;
    const { error } = await client
      .from('packages')
      .update({
        status,
        delivered_at: deliveredAt
      })
      .eq('id', packageId);

    if (error) {
      throw new Error('Kargo durumu güncellenemedi.');
    }

    await refreshState();
  }

  async function createServiceProvider(input: CreateServiceProviderInput) {
    const client = assertAuthenticated();
    const { error } = await client.from('service_providers').insert({
      site_id: input.siteId,
      category: input.category,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      note: input.note.trim()
    });

    if (error) {
      throw new Error('Servis rehberi kaydı oluşturulamadı.');
    }

    await refreshState();
  }

  async function updateServiceProviderDetails(input: UpdateServiceProviderInput) {
    await adminPortalAction('updateServiceProvider', input);
    await refreshState();
  }

  async function deleteServiceProvider(providerId: string) {
    await adminPortalAction('deleteServiceProvider', { providerId });
    await refreshState();
  }

  async function createAccessPass(input: CreateAccessPassInput) {
    const client = assertAuthenticated();
    const { error } = await client.from('access_passes').insert({
      unit_id: input.unitId,
      holder_name: input.holderName.trim(),
      type: input.type,
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    if (error) {
      throw new Error('Geçiş kaydı oluşturulamadı.');
    }

    await refreshState();
  }

  async function consumeAccessPass(passId: string) {
    const client = assertAuthenticated();
    const { error } = await client
      .from('access_passes')
      .update({
        status: 'used'
      })
      .eq('id', passId);

    if (error) {
      throw new Error('Geçiş kaydı güncellenemedi.');
    }

    await refreshState();
  }

  const value = useMemo<PortalDataContextValue>(
    () => ({
      ready,
      state,
      refreshState,
      createGuestRequest,
      updateGuestRequest,
      triggerGate,
      setInvoiceStatus,
      createAnnouncement,
      markAnnouncementRead,
      createPackageRecord,
      updatePackageStatus,
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
      upsertSiteInvoicePlan,
      syncInvoicePlans,
      setResidentAwayMode,
      createServiceProvider,
      updateServiceProviderDetails,
      deleteServiceProvider,
      createAccessPass,
      consumeAccessPass
    }),
    [ready, state]
  );

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData() {
  const context = useContext(PortalDataContext);

  if (!context) {
    throw new Error('usePortalData yalnızca PortalDataProvider içinde kullanılabilir.');
  }

  return context;
}
