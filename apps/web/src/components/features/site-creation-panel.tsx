'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, Layers3, MapPinned, Route, Users } from 'lucide-react';
import { appFetch } from '@/lib/api';
import type {
  CreateSitePayload,
  CreateSiteResponse,
  Province,
  SiteFloorPlanInput,
  SiteUnitInput
} from '@/lib/types';
import { useToast } from '../providers/toast-provider';

type UnitDraft = SiteUnitInput & {
  ownerName: string;
};

type BlockDraft = {
  name: string;
  apartmentNames: string[];
};

type DistributionMode = 'per-floor' | 'equal-total';

type SiteCreationPanelProps = {
  provinces: Province[];
  onCreated: () => Promise<void> | void;
};

function defaultBlockName(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : `Blok ${index + 1}`;
}

function defaultApartmentName(index: number) {
  return `Apartman ${index + 1}`;
}

function syncApartmentNames(count: number, current: string[] = []) {
  return Array.from({ length: count }, (_, index) => current[index] ?? defaultApartmentName(index));
}

function createBlocks(count: number, current: BlockDraft[] = []) {
  return Array.from({ length: count }, (_, index) => {
    const existing = current[index];
    const apartmentCount = existing?.apartmentNames.length ?? 1;

    return {
      name: existing?.name ?? defaultBlockName(index),
      apartmentNames: syncApartmentNames(apartmentCount, existing?.apartmentNames)
    };
  });
}

function createFloorPlans(
  floorCount: number,
  current: SiteFloorPlanInput[] = [],
  fallbackUnitCount = 2
): SiteFloorPlanInput[] {
  return Array.from({ length: floorCount }, (_, index) => {
    const floorNumber = index + 1;
    const existing = current.find((item) => item.floorNumber === floorNumber);

    return {
      floorNumber,
      unitCount: existing?.unitCount ?? fallbackUnitCount
    };
  });
}

function syncUnits(blocks: BlockDraft[], floorPlans: SiteFloorPlanInput[], current: UnitDraft[]) {
  const unitMap = new Map(
    current.map((unit) => [`${unit.blockSequence}:${unit.apartmentSequence}:${unit.floorNumber}:${unit.unitNumber}`, unit])
  );
  const nextUnits: UnitDraft[] = [];

  blocks.forEach((block, blockIndex) => {
    block.apartmentNames.forEach((_apartmentName, apartmentIndex) => {
      floorPlans.forEach((plan) => {
        for (let unitNumber = 1; unitNumber <= plan.unitCount; unitNumber += 1) {
          const key = `${blockIndex + 1}:${apartmentIndex + 1}:${plan.floorNumber}:${unitNumber}`;
          const previous = unitMap.get(key);

          nextUnits.push({
            blockSequence: blockIndex + 1,
            apartmentSequence: apartmentIndex + 1,
            floorNumber: plan.floorNumber,
            unitNumber,
            ownerName: previous?.ownerName ?? '',
            isVacant: previous?.isVacant ?? false
          });
        }
      });
    });
  });

  return nextUnits;
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
}

export function SiteCreationPanel({ provinces, onCreated }: SiteCreationPanelProps) {
  const { showToast } = useToast();
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [blockCount, setBlockCount] = useState(1);
  const [floorCount, setFloorCount] = useState(5);
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('per-floor');
  const [equalTotalUnits, setEqualTotalUnits] = useState('10');
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => createBlocks(1));
  const [floorPlans, setFloorPlans] = useState<SiteFloorPlanInput[]>(() => createFloorPlans(5));
  const [units, setUnits] = useState<UnitDraft[]>(() => syncUnits(createBlocks(1), createFloorPlans(5), []));
  const [submitting, setSubmitting] = useState(false);

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.id === provinceId) ?? null,
    [provinceId, provinces]
  );
  const availableDistricts = selectedProvince?.districts ?? [];

  const equalDistributionError = useMemo(() => {
    if (distributionMode !== 'equal-total') {
      return null;
    }

    const totalValue = Number.parseInt(equalTotalUnits, 10);
    if (!Number.isFinite(totalValue) || totalValue <= 0) {
      return 'Toplam daire sayısını girin.';
    }

    if (totalValue % floorCount !== 0) {
      return 'Toplam daire sayısı kat sayısına eşit bölünmelidir.';
    }

    return null;
  }, [distributionMode, equalTotalUnits, floorCount]);

  const totalApartmentCount = useMemo(
    () => blocks.reduce((total, block) => total + block.apartmentNames.length, 0),
    [blocks]
  );

  const totalUnitCount = useMemo(
    () => totalApartmentCount * floorPlans.reduce((total, plan) => total + plan.unitCount, 0),
    [floorPlans, totalApartmentCount]
  );

  const unitsByKey = useMemo(
    () =>
      new Map(
        units.map((unit) => [`${unit.blockSequence}:${unit.apartmentSequence}:${unit.floorNumber}:${unit.unitNumber}`, unit])
      ),
    [units]
  );

  useEffect(() => {
    setBlocks((current) => createBlocks(blockCount, current));
  }, [blockCount]);

  useEffect(() => {
    setDistrictId('');
  }, [provinceId]);

  useEffect(() => {
    if (distributionMode === 'equal-total') {
      const totalValue = Number.parseInt(equalTotalUnits, 10);

      if (Number.isFinite(totalValue) && totalValue > 0 && totalValue % floorCount === 0) {
        const unitsPerFloor = totalValue / floorCount;
        setFloorPlans(
          Array.from({ length: floorCount }, (_, index) => ({
            floorNumber: index + 1,
            unitCount: unitsPerFloor
          }))
        );
        return;
      }
    }

    setFloorPlans((current) => createFloorPlans(floorCount, current));
  }, [distributionMode, equalTotalUnits, floorCount]);

  useEffect(() => {
    setUnits((current) => syncUnits(blocks, floorPlans, current));
  }, [blocks, floorPlans]);

  function updateBlockName(index: number, value: string) {
    setBlocks((current) =>
      current.map((block, blockIndex) => (blockIndex === index ? { ...block, name: value } : block))
    );
  }

  function updateApartmentCount(blockIndex: number, apartmentCount: number) {
    setBlocks((current) =>
      current.map((block, currentIndex) =>
        currentIndex === blockIndex
          ? {
              ...block,
              apartmentNames: syncApartmentNames(apartmentCount, block.apartmentNames)
            }
          : block
      )
    );
  }

  function updateApartmentName(blockIndex: number, apartmentIndex: number, value: string) {
    setBlocks((current) =>
      current.map((block, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...block,
              apartmentNames: block.apartmentNames.map((name, currentApartmentIndex) =>
                currentApartmentIndex === apartmentIndex ? value : name
              )
            }
          : block
      )
    );
  }

  function updateFloorPlan(floorNumber: number, unitCount: number) {
    setFloorPlans((current) =>
      current.map((plan) => (plan.floorNumber === floorNumber ? { ...plan, unitCount } : plan))
    );
  }

  function updateUnit(
    blockSequence: number,
    apartmentSequence: number,
    floorNumber: number,
    unitNumber: number,
    updater: (current: UnitDraft) => UnitDraft
  ) {
    setUnits((current) =>
      current.map((unit) => {
        if (
          unit.blockSequence !== blockSequence ||
          unit.apartmentSequence !== apartmentSequence ||
          unit.floorNumber !== floorNumber ||
          unit.unitNumber !== unitNumber
        ) {
          return unit;
        }

        return updater(unit);
      })
    );
  }

  function resetForm() {
    setSiteName('');
    setBlockCount(1);
    setFloorCount(5);
    setDistributionMode('per-floor');
    setEqualTotalUnits('10');
    const nextBlocks = createBlocks(1);
    const nextFloorPlans = createFloorPlans(5);
    setBlocks(nextBlocks);
    setFloorPlans(nextFloorPlans);
    setUnits(syncUnits(nextBlocks, nextFloorPlans, []));
  }

  const isFormValid =
    provinceId.length > 0 &&
    districtId.length > 0 &&
    siteName.trim().length >= 2 &&
    blocks.every(
      (block) =>
        block.name.trim().length > 0 && block.apartmentNames.length > 0 && block.apartmentNames.every((name) => name.trim().length > 0)
    ) &&
    floorPlans.every((plan) => plan.unitCount > 0) &&
    !equalDistributionError &&
    units.every((unit) => unit.isVacant || unit.ownerName.trim().length >= 2);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isFormValid) {
      showToast({
        tone: 'warning',
        message: 'Formdaki zorunlu alanları ve daire bilgilerini kontrol edin.'
      });
      return;
    }

    const payload: CreateSitePayload = {
      provinceId,
      districtId,
      name: siteName.trim(),
      floorCount,
      blocks: blocks.map((block) => ({
        name: block.name.trim(),
        apartments: block.apartmentNames.map((name) => ({ name: name.trim() }))
      })),
      floorPlans,
      units: units.map((unit) => ({
        blockSequence: unit.blockSequence,
        apartmentSequence: unit.apartmentSequence,
        floorNumber: unit.floorNumber,
        unitNumber: unit.unitNumber,
        ownerName: unit.isVacant ? undefined : unit.ownerName.trim(),
        isVacant: unit.isVacant
      }))
    };

    setSubmitting(true);

    try {
      const response = await appFetch<CreateSiteResponse>('admin/buildings', {
        method: 'POST',
        body: payload
      });

      showToast({
        tone: 'success',
        message: `${response.data.name} başarıyla eklendi.`
      });
      resetForm();
      await onCreated();
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Site kaydı tamamlanamadı.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!provinces.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-6 py-12 text-center text-sm text-zinc-500">
        İl ve ilçe bilgileri hazırlanıyor...
      </div>
    );
  }

  return (
    <form className="grid gap-8 rounded-3xl border border-white/5 bg-white/[0.02] p-8" onSubmit={handleSubmit}>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">İl</label>
          <div className="relative">
            <MapPinned className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <select
              value={provinceId}
              onChange={(event) => setProvinceId(event.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white focus:border-amber-500/50 focus:outline-none"
              required
            >
              <option value="">İl seçin...</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.code} - {province.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">İlçe</label>
          <div className="relative">
            <Route className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <select
              value={districtId}
              onChange={(event) => setDistrictId(event.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white focus:border-amber-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedProvince}
              required
            >
              <option value="">İlçe seçin...</option>
              {availableDistricts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="text-sm font-medium text-zinc-300">Site Adı</label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder="Örn: Akasya Yaşam Sitesi"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
              required
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Blok Sayısı</label>
            <div className="relative">
              <Layers3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="number"
                min={1}
                max={99}
                value={blockCount}
                onChange={(event) => setBlockCount(parsePositiveInt(event.target.value, 1))}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">Blok ve Apartman</p>
                <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight text-white">Her blok içindeki apartmanlar</h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Toplam Apartman</p>
                <p className="mt-1 text-2xl font-semibold text-white">{totalApartmentCount}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              {blocks.map((block, blockIndex) => (
                <div key={`block-${blockIndex + 1}`} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Blok {blockIndex + 1} Adı</label>
                      <input
                        type="text"
                        value={block.name}
                        onChange={(event) => updateBlockName(blockIndex, event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Apartman Sayısı</label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={block.apartmentNames.length}
                        onChange={(event) => updateApartmentCount(blockIndex, parsePositiveInt(event.target.value, 1))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {block.apartmentNames.map((apartmentName, apartmentIndex) => (
                      <div className="space-y-2" key={`block-${blockIndex + 1}-apartment-${apartmentIndex + 1}`}>
                        <label className="text-sm font-medium text-zinc-300">Apartman {apartmentIndex + 1} Adı</label>
                        <input
                          type="text"
                          value={apartmentName}
                          onChange={(event) => updateApartmentName(blockIndex, apartmentIndex, event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-black/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">Kat Planı</p>
            <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight text-white">Her apartman için ortak kat dağılımı</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Toplam Daire</p>
            <p className="mt-1 text-2xl font-semibold text-white">{totalUnitCount}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Kat Sayısı</label>
            <input
              type="number"
              min={1}
              max={99}
              value={floorCount}
              onChange={(event) => setFloorCount(parsePositiveInt(event.target.value, 1))}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  distributionMode === 'per-floor'
                    ? 'border border-cyan-700/20 bg-cyan-700 text-white'
                    : 'border border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                }`}
                onClick={() => setDistributionMode('per-floor')}
                type="button"
              >
                Kata Göre Giriş
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  distributionMode === 'equal-total'
                    ? 'border border-cyan-700/20 bg-cyan-700 text-white'
                    : 'border border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                }`}
                onClick={() => setDistributionMode('equal-total')}
                type="button"
              >
                Toplamdan Eşit Dağıt
              </button>
            </div>

            {distributionMode === 'equal-total' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Bir apartmandaki toplam daire sayısı</label>
                <input
                  type="number"
                  min={1}
                  value={equalTotalUnits}
                  onChange={(event) => setEqualTotalUnits(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
                />
                <p className={`text-xs ${equalDistributionError ? 'text-rose-400' : 'text-zinc-500'}`}>
                  {equalDistributionError ?? 'Toplam daire sayısı tüm katlara eşit dağıtılır.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {floorPlans.map((plan) => (
                  <div className="space-y-2" key={`floor-plan-${plan.floorNumber}`}>
                    <label className="text-sm font-medium text-zinc-300">{plan.floorNumber}. Kat</label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={plan.unitCount}
                      onChange={(event) => updateFloorPlan(plan.floorNumber, parsePositiveInt(event.target.value, 1))}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-black/20 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">Daire Bilgileri</p>
            <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight text-white">Malik adı veya boş daire seçimi</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Her blok ve apartman için daireler otomatik hazırlanır. Dolu dairelerde malik adı zorunludur.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Özet</p>
            <p className="mt-1 text-sm font-medium text-white">
              {blocks.length} blok / {totalApartmentCount} apartman / {floorCount} kat / {totalUnitCount} daire
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          {blocks.map((block, blockIndex) => (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5" key={`block-section-${blockIndex + 1}`}>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Blok {blockIndex + 1}</p>
                  <h4 className="font-heading text-xl font-semibold text-white">{block.name}</h4>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-zinc-300">
                  {block.apartmentNames.length} apartman
                </span>
              </div>

              <div className="mt-6 space-y-6">
                {block.apartmentNames.map((apartmentName, apartmentIndex) => (
                  <div key={`apartment-section-${blockIndex + 1}-${apartmentIndex + 1}`} className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Apartman {apartmentIndex + 1}</p>
                        <h5 className="text-lg font-semibold text-white">{apartmentName}</h5>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                        {floorPlans.reduce((total, plan) => total + plan.unitCount, 0)} daire
                      </span>
                    </div>

                    <div className="space-y-6">
                      {floorPlans.map((plan) => (
                        <div key={`unit-floor-${blockIndex + 1}-${apartmentIndex + 1}-${plan.floorNumber}`}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-200">{plan.floorNumber}. Kat</p>
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{plan.unitCount} daire</p>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            {Array.from({ length: plan.unitCount }, (_, unitIndex) => {
                              const unitNumber = unitIndex + 1;
                              const unit =
                                unitsByKey.get(`${blockIndex + 1}:${apartmentIndex + 1}:${plan.floorNumber}:${unitNumber}`) ?? null;

                              if (!unit) {
                                return null;
                              }

                              return (
                                <div
                                  className={`rounded-2xl border p-4 transition-colors ${
                                    unit.isVacant ? 'border-amber-500/20 bg-amber-500/10' : 'border-white/10 bg-black/20'
                                  }`}
                                  key={`unit-${blockIndex + 1}-${apartmentIndex + 1}-${plan.floorNumber}-${unitNumber}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-white">Daire {unitNumber}</p>
                                      <p className="text-xs text-zinc-500">
                                        Konum: {block.name} / {apartmentName} / {plan.floorNumber}. Kat / Daire {unitNumber}
                                      </p>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                                      <input
                                        type="checkbox"
                                        checked={unit.isVacant}
                                        onChange={(event) =>
                                          updateUnit(blockIndex + 1, apartmentIndex + 1, plan.floorNumber, unitNumber, (current) => ({
                                            ...current,
                                            isVacant: event.target.checked,
                                            ownerName: event.target.checked ? '' : current.ownerName
                                          }))
                                        }
                                        className="h-4 w-4 rounded border-white/10 bg-black/40 text-amber-500 focus:ring-amber-500/50"
                                      />
                                      Boş
                                    </label>
                                  </div>

                                  <div className="mt-4 space-y-2">
                                    <label className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Ev Sahibi</label>
                                    <div className="relative">
                                      <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                      <input
                                        type="text"
                                        value={unit.ownerName}
                                        disabled={unit.isVacant}
                                        onChange={(event) =>
                                          updateUnit(blockIndex + 1, apartmentIndex + 1, plan.floorNumber, unitNumber, (current) => ({
                                            ...current,
                                            ownerName: event.target.value,
                                            isVacant: event.target.value.trim().length > 0 ? false : current.isVacant
                                          }))
                                        }
                                        placeholder={unit.isVacant ? 'Daire boş' : 'Ad Soyad'}
                                        className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
        <p className="text-sm text-zinc-400">
          Dolu daireler için sakin hesabı, her apartman için de tablet giriş bilgisi sistem tarafından otomatik oluşturulur.
        </p>
        <button
          type="submit"
          disabled={submitting || !isFormValid}
          className="btn-premium rounded-xl border border-amber-500/50 bg-amber-500 px-8 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Kaydediliyor...' : 'Siteyi Oluştur'}
        </button>
      </div>
    </form>
  );
}
