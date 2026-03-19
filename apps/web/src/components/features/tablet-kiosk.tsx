'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlignHorizontalSpaceAround,
  ArrowLeft,
  Building2,
  Fingerprint,
  KeyRound,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Wrench
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../providers/auth-provider';
import { usePortalData } from '../providers/portal-data-provider';
import { useToast } from '../providers/toast-provider';
import { BrandLogo } from '../ui/brand-logo';
import {
  buildUnitResidentRows,
  getVisibleBuildings,
  getVisibleUnits,
  requestStatusLabel,
  requestTypeLabel
} from '@/lib/portal-selectors';

type KioskMode = 'courier' | 'service' | 'guest' | 'resident';
type KioskScreen = 'welcome' | 'mode' | 'wait' | 'success';
type ResidentMethod = 'password' | 'face';
type GuestAccessMode = 'call' | 'qr';

const MODE_OPTIONS = [
  {
    id: 'courier',
    title: 'Kargo / Kurye',
    icon: Truck
  },
  {
    id: 'service',
    title: 'Hizmet',
    icon: Wrench
  },
  {
    id: 'guest',
    title: 'Misafir',
    icon: UserRound
  },
  {
    id: 'resident',
    title: 'Ev sahibi',
    icon: ShieldCheck
  }
] as const satisfies ReadonlyArray<{
  id: KioskMode;
  title: string;
  icon: typeof UserRound;
}>;

const COURIER_SOURCES = ['Trendyol Express', 'Hepsijet', 'Yurtiçi Kargo', 'MNG Kargo', 'Aras Kargo', 'Diğer'];
const SERVICE_OPTIONS = ['Elektrik', 'Tesisat', 'Asansör', 'Temizlik', 'Nakliyat', 'Peyzaj', 'Diğer'];

function normalizeValue(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

export function TabletKiosk() {
  const { session } = useAuth();
  const { state, createGuestRequest, createPackageRecord, consumeAccessPass, triggerGate } =
    usePortalData();
  const { showToast } = useToast();
  const [screen, setScreen] = useState<KioskScreen>('welcome');
  const [mode, setMode] = useState<KioskMode>('courier');
  const [searchValue, setSearchValue] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestAccessMode, setGuestAccessMode] = useState<GuestAccessMode>('call');
  const [residentMethod, setResidentMethod] = useState<ResidentMethod>('password');
  const [residentPassword, setResidentPassword] = useState('');
  const [oneTimePassword, setOneTimePassword] = useState('');
  const [serviceType, setServiceType] = useState('Elektrik');
  const [serviceLabel, setServiceLabel] = useState('');
  const [courierSource, setCourierSource] = useState('Trendyol Express');
  const [customCourierSource, setCustomCourierSource] = useState('');
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<{ title: string; body: string } | null>(null);
  const handledRequestIdsRef = useRef<Set<string>>(new Set());
  const screenHistoryRef = useRef<KioskScreen[]>([]);

  const user = session?.user;
  if (!user) {
    return null;
  }

  const currentUser = user;
  const visibleBuildings = getVisibleBuildings(state, currentUser);
  const visibleUnits = getVisibleUnits(state, currentUser);
  const visibleResidents = buildUnitResidentRows(state, visibleBuildings, visibleUnits, state.profiles);
  const selectedBuilding = visibleBuildings[0] ?? null;
  const selectedResidentRow = visibleResidents.find((row) => row.unit.id === selectedUnitId) ?? null;
  const searchQuery = normalizeValue(searchValue);
  const filteredResidents = visibleResidents.filter((row) =>
    normalizeValue(`${row.building?.name ?? ''} ${row.unit.unitNumber} ${row.resident?.fullName ?? ''}`).includes(
      searchQuery
    )
  );
  const selectedQrPasses = useMemo(
    () =>
      state.accessPasses.filter(
        (pass) =>
          pass.unitId === selectedUnitId &&
          pass.type === 'qr' &&
          pass.status === 'active' &&
          new Date(pass.expiresAt).getTime() > Date.now()
      ),
    [selectedUnitId, state.accessPasses]
  );
  const selectedResidentAwayMode = selectedResidentRow?.resident
    ? (state.residentPreferences.find((item) => item.profileId === selectedResidentRow.resident?.id)
        ?.awayModeEnabled ?? false)
    : false;
  const liveRequest = createdRequestId
    ? state.guestRequests.find((request) => request.id === createdRequestId) ?? null
    : null;

  useEffect(() => {
    if (!liveRequest || liveRequest.status === 'pending' || handledRequestIdsRef.current.has(liveRequest.id)) {
      return;
    }

    handledRequestIdsRef.current.add(liveRequest.id);

    if (liveRequest.status === 'approved' && selectedBuilding) {
      void triggerGate(
        selectedBuilding.id,
        `${selectedResidentRow?.resident?.fullName ?? 'Ev sahibi'} onayı`,
        liveRequest.id,
        'kiosk'
      ).finally(() => {
        setSuccessState({
          title: 'Kapı açılıyor',
          body: 'Ev sahibi girişe onay verdi. İyi ziyaretler.'
        });
        goToScreen('success');
      });
      return;
    }

    if (liveRequest.status === 'redirected') {
      setSuccessState({
        title: 'Danışma sizi bekliyor',
        body: 'Ev sahibi yönlendirmeyi danışmaya aktardı.'
      });
      goToScreen('success');
      return;
    }

    setSuccessState({
      title: 'Giriş kapatıldı',
      body: 'Ev sahibi bu çağrıyı onaylamadı.'
    });
    goToScreen('success');
  }, [liveRequest, selectedBuilding, selectedResidentRow?.resident?.fullName, triggerGate]);

  function resetFlow(nextScreen: KioskScreen = 'welcome') {
    screenHistoryRef.current = [];
    setScreen(nextScreen);
    setSearchValue('');
    setSelectedUnitId(null);
    setGuestName('');
    setGuestAccessMode('call');
    setResidentMethod('password');
    setResidentPassword('');
    setOneTimePassword('');
    setServiceType('Elektrik');
    setServiceLabel('');
    setCourierSource('Trendyol Express');
    setCustomCourierSource('');
    setCreatedRequestId(null);
    setSuccessState(null);
    setSubmitting(false);
  }

  function goToScreen(nextScreen: KioskScreen) {
    if (screen !== nextScreen) {
      screenHistoryRef.current.push(screen);
    }

    setScreen(nextScreen);
  }

  function goBack() {
    const previousScreen = screenHistoryRef.current.pop();

    if (!previousScreen) {
      resetFlow('welcome');
      return;
    }

    setScreen(previousScreen);
  }

  function startMode(nextMode: KioskMode) {
    resetFlow('mode');
    screenHistoryRef.current = ['welcome'];
    setMode(nextMode);
  }

  function openConcierge() {
    showToast({
      tone: 'info',
      message: 'Danışma masasına yönlendiriliyorsunuz.'
    });
  }

  function resolveCourierSource() {
    return courierSource === 'Diğer' ? customCourierSource.trim() : courierSource;
  }

  async function handleResidentEntry() {
    if (!selectedBuilding || !selectedUnitId) {
      showToast({ tone: 'warning', message: 'Lütfen önce daire seçin.' });
      return;
    }

    if (residentMethod === 'password' && residentPassword.trim().length < 4) {
      showToast({ tone: 'warning', message: 'Daire şifresini girin.' });
      return;
    }

    setSubmitting(true);
    try {
      await triggerGate(
        selectedBuilding.id,
        `${selectedResidentRow?.resident?.fullName ?? 'Ev sahibi'} girişi`,
        undefined,
        'kiosk'
      );
      setSuccessState({
        title: 'Kapı açılıyor',
        body:
          residentMethod === 'password'
            ? 'Daire şifresi doğrulandı. İyi girişler.'
            : 'Yüz doğrulama tamamlandı. Hoş geldiniz.'
      });
      goToScreen('success');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCourierEntry() {
    const source = resolveCourierSource();

    if (!selectedUnitId || source.trim().length < 2) {
      showToast({ tone: 'warning', message: 'Daire ve kurye bilgisini tamamlayın.' });
      return;
    }

    setSubmitting(true);
    try {
      await createPackageRecord({
        unitId: selectedUnitId,
        courierName: source
      });
      setSuccessState({
        title: 'Teslimat kaydı alındı',
        body: selectedResidentAwayMode
          ? 'Daire sakini güvenliğe bırakılmasını istiyor.'
          : 'Teslimat bilgisi daire sakinine iletildi.'
      });
      goToScreen('success');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleServiceEntry() {
    if (!selectedBuilding || !selectedUnitId || serviceType.trim().length < 2) {
      showToast({ tone: 'warning', message: 'Daire ve hizmet bilgisini seçin.' });
      return;
    }

    setSubmitting(true);
    try {
      const guestRequest = await createGuestRequest({
        buildingId: selectedBuilding.id,
        unitId: selectedUnitId,
        guestName: serviceLabel.trim() ? `${serviceType} · ${serviceLabel.trim()}` : serviceType,
        type: 'service',
        actorName: currentUser.fullName,
        actorProfileId: currentUser.id
      });
      setCreatedRequestId(guestRequest.id);
      goToScreen('wait');
      showToast({ tone: 'info', message: 'Ev sahibine hizmet bildirimi gönderildi.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuestEntry() {
    if (!selectedBuilding || !selectedUnitId || guestName.trim().length < 2) {
      showToast({ tone: 'warning', message: 'Daire ve ziyaretçi bilgisini girin.' });
      return;
    }

    if (guestAccessMode === 'qr') {
      const normalizedCode = oneTimePassword.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

      if (!selectedQrPasses.length) {
        showToast({ tone: 'warning', message: 'Bu daire için aktif QR daveti görünmüyor.' });
        return;
      }

      if (normalizedCode.length !== 6) {
        showToast({ tone: 'warning', message: '6 karakterli erişim şifresini girin.' });
        return;
      }

      const activePass = selectedQrPasses.find((pass) => pass.accessCode === normalizedCode);

      if (!activePass) {
        showToast({ tone: 'warning', message: 'QR şifresi doğrulanamadı.' });
        return;
      }

      setSubmitting(true);
      try {
        await consumeAccessPass(activePass.id);
        await triggerGate(selectedBuilding.id, `${activePass.holderName} QR girişi`, undefined, 'kiosk');
        setSuccessState({
          title: 'Kapı açılıyor',
          body: 'QR daveti doğrulandı. İyi ziyaretler.'
        });
        goToScreen('success');
      } finally {
        setSubmitting(false);
      }

      return;
    }

    setSubmitting(true);
    try {
      const guestRequest = await createGuestRequest({
        buildingId: selectedBuilding.id,
        unitId: selectedUnitId,
        guestName: guestName.trim(),
        type: 'guest',
        actorName: currentUser.fullName,
        actorProfileId: currentUser.id
      });
      setCreatedRequestId(guestRequest.id);
      goToScreen('wait');
      showToast({ tone: 'info', message: 'Ev sahibine bildirim gönderildi.' });
    } finally {
      setSubmitting(false);
    }
  }

  const currentMode = MODE_OPTIONS.find((item) => item.id === mode) ?? MODE_OPTIONS[0];
  const CurrentIcon = currentMode.icon;

  const unitSelectionPanel = (
    <section className="rounded-[30px] border border-white/10 bg-[#181a1f] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/42" />
        <input
          className="app-input rounded-[20px] border-white/10 bg-[#111317] px-12 py-4"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Daire numarası veya isim ile arayın"
          type="text"
        />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {filteredResidents.map((row) => {
          const isActive = row.unit.id === selectedUnitId;
          return (
            <motion.button
              key={row.unit.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedUnitId(row.unit.id)}
              className={`rounded-[24px] border p-4 text-left transition-all ${
                isActive
                  ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)]'
                  : 'border-white/8 bg-black/16'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">
                {row.building?.name ?? 'Blok'} · Daire {row.unit.unitNumber}
              </p>
              <p className="mt-3 font-heading text-2xl font-bold">
                {row.resident?.fullName ?? 'Atanmamış daire'}
              </p>
              <p className="mt-2 text-sm text-white/58">Kat {row.unit.floor}</p>
            </motion.button>
          );
        })}
      </div>
    </section>
  );

  let content = null;

  if (screen === 'welcome') {
    content = (
      <div className="grid gap-4 lg:grid-cols-2">
        {MODE_OPTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              type="button"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => startMode(item.id)}
              className="group min-h-[220px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,#181a1f_0%,#111317_100%)] p-6 text-left shadow-[0_20px_40px_rgba(0,0,0,0.26)] transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[rgba(212,163,115,0.4)] bg-[rgba(212,163,115,0.1)]">
                <Icon className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
              <h2 className="mt-6 font-heading text-3xl font-bold">{item.title}</h2>
            </motion.button>
          );
        })}
      </div>
    );
  }

  if (screen === 'mode') {
    content = (
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.88fr]">
        {unitSelectionPanel}
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#17191d_0%,#121418_100%)] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl font-bold">{currentMode.title}</h2>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-black/16">
              <CurrentIcon className="h-6 w-6 text-[var(--color-accent)]" />
            </div>
          </div>

          {selectedResidentAwayMode && mode === 'courier' ? (
            <div className="mt-5 rounded-[24px] border border-[rgba(212,163,115,0.36)] bg-[rgba(212,163,115,0.08)] p-4 text-sm leading-6 text-[#f4dfc2]">
              Daire sakini güvenliğe bırakılmasını istiyor.
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {mode === 'courier' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {COURIER_SOURCES.map((item) => (
                    <motion.button
                      key={item}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCourierSource(item)}
                      className={`rounded-[22px] border px-4 py-4 text-left text-sm font-semibold ${
                        courierSource === item
                          ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)] text-white'
                          : 'border-white/8 bg-black/16 text-white/72'
                      }`}
                    >
                      {item}
                    </motion.button>
                  ))}
                </div>
                {courierSource === 'Diğer' ? (
                  <input
                    className="app-input rounded-[20px] border-white/10 bg-[#111317] px-4 py-4"
                    value={customCourierSource}
                    onChange={(event) => setCustomCourierSource(event.target.value)}
                    placeholder="Kargo firmasını yazın"
                    type="text"
                  />
                ) : null}
              </>
            ) : null}
            {mode === 'service' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {SERVICE_OPTIONS.map((item) => (
                    <motion.button
                      key={item}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setServiceType(item)}
                      className={`rounded-[22px] border px-4 py-4 text-left text-sm font-semibold ${
                        serviceType === item
                          ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)] text-white'
                          : 'border-white/8 bg-black/16 text-white/72'
                      }`}
                    >
                      {item}
                    </motion.button>
                  ))}
                </div>
                <input
                  className="app-input rounded-[20px] border-white/10 bg-[#111317] px-4 py-4"
                  value={serviceLabel}
                  onChange={(event) => setServiceLabel(event.target.value)}
                  placeholder="Ekip veya şirket adı"
                  type="text"
                />
              </>
            ) : null}
            {mode === 'guest' ? (
              <>
                <input
                  className="app-input rounded-[20px] border-white/10 bg-[#111317] px-4 py-4"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Misafirin adı"
                  type="text"
                />
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGuestAccessMode('call')}
                    className={`rounded-[22px] border px-4 py-4 text-left ${
                      guestAccessMode === 'call'
                        ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)]'
                        : 'border-white/8 bg-black/16'
                    }`}
                  >
                    <p className="font-semibold">Ev sahibini ara</p>
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGuestAccessMode('qr')}
                    className={`rounded-[22px] border px-4 py-4 text-left ${
                      guestAccessMode === 'qr'
                        ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)]'
                        : 'border-white/8 bg-black/16'
                    }`}
                  >
                    <p className="font-semibold">QR ile geldim</p>
                  </motion.button>
                </div>
                {guestAccessMode === 'qr' ? (
                  <>
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-black/16 p-4 text-sm text-white/64">
                      {selectedQrPasses.length
                        ? `${selectedQrPasses.length} aktif QR daveti bulundu.`
                        : 'Bu daire için aktif QR daveti görünmüyor.'}
                    </div>
                    <input
                      className="app-input rounded-[20px] border-white/10 bg-[#111317] px-4 py-4"
                      value={oneTimePassword}
                      onChange={(event) =>
                        setOneTimePassword(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                      }
                      placeholder="6 karakterli şifre"
                      type="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            {mode === 'resident' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setResidentMethod('password')}
                    className={`rounded-[22px] border px-4 py-4 text-left ${
                      residentMethod === 'password'
                        ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)]'
                        : 'border-white/8 bg-black/16'
                    }`}
                  >
                    <KeyRound className="h-5 w-5 text-[var(--color-accent)]" />
                    <p className="mt-3 font-semibold">Daire şifresi</p>
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setResidentMethod('face')}
                    className={`rounded-[22px] border px-4 py-4 text-left ${
                      residentMethod === 'face'
                        ? 'border-[var(--color-accent)] bg-[rgba(212,163,115,0.12)]'
                        : 'border-white/8 bg-black/16'
                    }`}
                  >
                    <Fingerprint className="h-5 w-5 text-[var(--color-accent)]" />
                    <p className="mt-3 font-semibold">Yüz doğrulama</p>
                  </motion.button>
                </div>
                {residentMethod === 'password' ? (
                  <input
                    className="app-input rounded-[20px] border-white/10 bg-[#111317] px-4 py-4"
                    value={residentPassword}
                    onChange={(event) => setResidentPassword(event.target.value)}
                    placeholder="Daire giriş şifresi"
                    type="password"
                  />
                ) : (
                  <div className="rounded-[24px] border border-white/8 bg-black/16 p-5 text-sm font-medium text-white/72">
                    Yüz doğrulama hazır.
                  </div>
                )}
              </>
            ) : null}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={openConcierge}
                className="app-button-secondary rounded-[20px] px-4 py-4 text-sm uppercase tracking-[0.16em]"
              >
                Danışmaya bağlan
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={submitting}
                onClick={() => {
                  if (mode === 'courier') {
                    void handleCourierEntry();
                    return;
                  }
                  if (mode === 'service') {
                    void handleServiceEntry();
                    return;
                  }
                  if (mode === 'guest') {
                    void handleGuestEntry();
                    return;
                  }
                  void handleResidentEntry();
                }}
                className="app-button rounded-[20px] px-4 py-4 text-sm uppercase tracking-[0.16em] disabled:opacity-50"
              >
                {submitting ? 'Hazırlanıyor' : 'Devam et'}
              </motion.button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (screen === 'wait') {
    content = (
      <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#17191d_0%,#111317_100%)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
        <h2 className="font-heading text-4xl font-bold">Bekleniyor</h2>
        <div className="mt-6 rounded-[26px] border border-white/8 bg-black/16 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Çağrı durumu</p>
          <p className="mt-3 font-heading text-3xl font-bold">
            {liveRequest ? requestStatusLabel(liveRequest.status) : 'Hazırlanıyor'}
          </p>
          <p className="mt-3 text-sm text-white/58">
            {liveRequest ? `${requestTypeLabel(liveRequest.type)} · ${liveRequest.guestName}` : 'İstek oluşturuluyor'}
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={openConcierge}
            className="app-button-secondary mt-5 rounded-[18px] px-4 py-3 text-sm uppercase tracking-[0.16em]"
          >
            Danışmaya bağlan
          </motion.button>
        </div>
      </section>
    );
  }

  if (screen === 'success' && successState) {
    content = (
      <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#17191d_0%,#111317_100%)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
        <h2 className="font-heading text-4xl font-bold">{successState.title}</h2>
        <p className="mt-4 max-w-[38rem] text-base leading-8 text-white/64">{successState.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => resetFlow('welcome')}
            className="app-button rounded-[20px] px-5 py-4 text-sm uppercase tracking-[0.16em]"
          >
            Ana ekrana dön
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={openConcierge}
            className="app-button-secondary rounded-[20px] px-5 py-4 text-sm uppercase tracking-[0.16em]"
          >
            Danışmaya bağlan
          </motion.button>
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(212,163,115,0.18),transparent_22%),linear-gradient(180deg,#0d0e10_0%,#121418_100%)] px-4 py-4 text-[var(--color-text)] md:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-32px)] max-w-[1600px] overflow-hidden rounded-[36px] border border-white/8 bg-[#0f1114] shadow-[0_36px_90px_rgba(0,0,0,0.44)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-white/8 bg-[linear-gradient(180deg,#121418_0%,#0d0f12_100%)] px-6 py-6 text-white xl:border-b-0 xl:border-r xl:border-white/8">
          <BrandLogo size="md" />
          <div className="mt-8 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#181a1f_0%,#111317_100%)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Aktif terminal</p>
            <p className="mt-3 font-heading text-3xl font-bold">{selectedBuilding?.doorLabel ?? 'Lobi girişi'}</p>
            <div className="mt-4 flex items-start gap-3 text-sm text-white/62">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <div>
                <p className="font-semibold text-white">{selectedBuilding?.name ?? 'Giriş noktası'}</p>
                <p className="mt-1">{selectedBuilding?.address}</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative overflow-hidden p-5 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,163,115,0.1),transparent_24%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div />
              {screen !== 'welcome' ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting}
                  onClick={goBack}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/72 disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </motion.button>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="rounded-[34px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-4xl font-bold">
                      {screen === 'welcome' ? 'Nasıl yardımcı olalım?' : currentMode.title}
                    </h2>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-black/18">
                    {screen === 'welcome' ? (
                      <AlignHorizontalSpaceAround className="h-7 w-7 text-[var(--color-accent)]" />
                    ) : mode === 'guest' ? (
                      <PhoneCall className="h-7 w-7 text-[var(--color-accent)]" />
                    ) : (
                      <CurrentIcon className="h-7 w-7 text-[var(--color-accent)]" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${screen}-${mode}-${createdRequestId ?? 'base'}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  {content}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
