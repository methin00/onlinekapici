'use client';

import { useState } from 'react';
import { Building2, KeyRound, Layers3, MapPinned, MonitorSmartphone, Pencil, UserPlus, Users } from 'lucide-react';
import { appFetch } from '@/lib/api';
import type { Building, BuildingApartmentDetail, BuildingBlockDetail, BuildingDetail, BuildingUnitDetail } from '@/lib/types';
import { useToast } from '../providers/toast-provider';

type BuildingDirectoryPanelProps = {
  buildings: Building[];
  selectedBuildingId: string | null;
  selectedBuilding: BuildingDetail | null;
  loading: boolean;
  onSelect: (buildingId: string) => void;
  onUpdated: (buildingId?: string) => Promise<void> | void;
};

type NameEditorState =
  | {
      type: 'building' | 'block' | 'apartment';
      id: string;
      title: string;
      label: string;
      value: string;
    }
  | null;

type UnitEditorState = {
  unit: BuildingUnitDetail;
  ownerName: string;
  phone: string;
} | null;

function NameEditModal({
  state,
  submitting,
  onChange,
  onClose,
  onSubmit
}: {
  state: Exclude<NameEditorState, null>;
  submitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2b1f13]/25 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[var(--bg-surface)] p-8 shadow-[0_30px_100px_-40px_rgba(74,53,30,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">Düzenleme</p>
            <h3 className="mt-2 font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">{state.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            Kapat
          </button>
        </div>

        <div className="mt-8 space-y-2">
          <label className="text-sm font-medium text-[var(--text-primary)]">{state.label}</label>
          <input
            type="text"
            value={state.value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/70 px-4 py-4 text-[var(--text-primary)] focus:border-cyan-500/40 focus:outline-none"
          />
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[var(--text-primary)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={submitting || state.value.trim().length < 1}
            onClick={() => void onSubmit()}
            className="rounded-2xl border border-cyan-500/40 bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnitResidentModal({
  state,
  submitting,
  onChangeOwnerName,
  onChangePhone,
  onClose,
  onSubmit
}: {
  state: Exclude<UnitEditorState, null>;
  submitting: boolean;
  onChangeOwnerName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2b1f13]/25 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[var(--bg-surface)] p-8 shadow-[0_30px_100px_-40px_rgba(74,53,30,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/80">Daire Sakini</p>
            <h3 className="mt-2 font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {state.unit.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            Kapat
          </button>
        </div>

        <div className="mt-8 grid gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">Ad Soyad</label>
            <input
              type="text"
              value={state.ownerName}
              onChange={(event) => onChangeOwnerName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/70 px-4 py-4 text-[var(--text-primary)] focus:border-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">Telefon Numarası</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={state.phone}
              onChange={(event) => onChangePhone(event.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              placeholder="İsteğe bağlı"
              className="w-full rounded-2xl border border-white/10 bg-white/70 px-4 py-4 text-[var(--text-primary)] focus:border-emerald-500/40 focus:outline-none"
            />
            <p className="text-xs text-[var(--text-secondary)]">
              Telefon girilmezse sistem giriş numarasını otomatik oluşturur.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[var(--text-primary)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={submitting || state.ownerName.trim().length < 2}
            onClick={() => void onSubmit()}
            className="rounded-2xl border border-emerald-500/40 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Kaydediliyor...' : state.unit.isVacant ? 'Sakini Ekle' : 'Bilgileri Güncelle'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BuildingDirectoryPanel({
  buildings,
  selectedBuildingId,
  selectedBuilding,
  loading,
  onSelect,
  onUpdated
}: BuildingDirectoryPanelProps) {
  const { showToast } = useToast();
  const [nameEditor, setNameEditor] = useState<NameEditorState>(null);
  const [unitEditor, setUnitEditor] = useState<UnitEditorState>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleNameUpdate() {
    if (!nameEditor || !selectedBuildingId) {
      return;
    }

    setSubmitting(true);

    try {
      const endpoint =
        nameEditor.type === 'building'
          ? `admin/buildings/${nameEditor.id}`
          : nameEditor.type === 'block'
            ? `admin/blocks/${nameEditor.id}`
            : `admin/apartments/${nameEditor.id}`;

      await appFetch(endpoint, {
        method: 'PATCH',
        body: {
          name: nameEditor.value
        }
      });

      showToast({
        tone: 'success',
        message: `${nameEditor.label} güncellendi.`
      });
      setNameEditor(null);
      await onUpdated(selectedBuildingId);
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Güncelleme tamamlanamadı.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResidentUpdate() {
    if (!unitEditor || !selectedBuildingId) {
      return;
    }

    if (unitEditor.phone.length > 0 && unitEditor.phone.length !== 10) {
      showToast({
        tone: 'warning',
        message: 'Telefon numarasını 10 haneli biçimde girin.'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await appFetch<{ data: BuildingUnitDetail }>(`admin/units/${unitEditor.unit.id}/resident`, {
        method: 'PATCH',
        body: {
          ownerName: unitEditor.ownerName,
          phone: unitEditor.phone
        }
      });

      showToast({
        tone: 'success',
        message: `${response.data.resident?.fullName ?? 'Daire sakini'} bilgileri kaydedildi.`
      });
      setUnitEditor(null);
      await onUpdated(selectedBuildingId);
    } catch (error) {
      showToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Daire sakini bilgileri kaydedilemedi.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openBlockEditor(block: BuildingBlockDetail) {
    setNameEditor({
      type: 'block',
      id: block.id,
      title: `${block.name} Bloğunu Düzenle`,
      label: 'Blok Adı',
      value: block.name
    });
  }

  function openApartmentEditor(apartment: BuildingApartmentDetail) {
    setNameEditor({
      type: 'apartment',
      id: apartment.id,
      title: `${apartment.name} Apartmanını Düzenle`,
      label: 'Apartman Adı',
      value: apartment.name
    });
  }

  return (
    <>
      {nameEditor ? (
        <NameEditModal
          state={nameEditor}
          submitting={submitting}
          onChange={(value) => setNameEditor((current) => (current ? { ...current, value } : current))}
          onClose={() => setNameEditor(null)}
          onSubmit={handleNameUpdate}
        />
      ) : null}

      {unitEditor ? (
        <UnitResidentModal
          state={unitEditor}
          submitting={submitting}
          onChangeOwnerName={(value) => setUnitEditor((current) => (current ? { ...current, ownerName: value } : current))}
          onChangePhone={(value) => setUnitEditor((current) => (current ? { ...current, phone: value } : current))}
          onClose={() => setUnitEditor(null)}
          onSubmit={handleResidentUpdate}
        />
      ) : null}

      <section className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="glass-panel rounded-[32px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">Site Listesi</p>
              <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">Tüm Kayıtlar</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              {buildings.length} site
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {buildings.length ? (
              buildings.map((building) => {
                const active = building.id === selectedBuildingId;

                return (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => onSelect(building.id)}
                    className={`w-full rounded-[24px] border px-5 py-5 text-left transition-all ${
                      active
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-heading text-xl font-semibold tracking-tight text-white">{building.name}</p>
                        <p className="mt-2 text-sm text-zinc-400">
                          {building.district?.province?.name} / {building.district?.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                          {building.apartmentCount ?? 0} apartman
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                          {building.unitCount ?? 0} daire
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-zinc-500">
                Henüz site kaydı bulunmuyor.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-8">
          {loading ? (
            <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-16 text-center text-sm text-zinc-500">
              Site detayları hazırlanıyor...
            </div>
          ) : selectedBuilding ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">Site Detayı</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h3 className="font-heading text-4xl font-bold tracking-tight text-white">{selectedBuilding.name}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setNameEditor({
                          type: 'building',
                          id: selectedBuilding.id,
                          title: 'Siteyi Düzenle',
                          label: 'Site Adı',
                          value: selectedBuilding.name
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Siteyi Düzenle
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">
                    {selectedBuilding.district?.province?.name} / {selectedBuilding.district?.name}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Blok</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{selectedBuilding.blockCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Apartman</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{selectedBuilding.apartmentCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Dolu Daire</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{selectedBuilding.occupiedUnitCount}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-6">
                {selectedBuilding.blocks.map((block) => (
                  <div key={block.id} className="rounded-[28px] border border-white/10 bg-black/20 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Blok</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                          <h4 className="font-heading text-2xl font-semibold text-white">{block.name}</h4>
                          <button
                            type="button"
                            onClick={() => openBlockEditor(block)}
                            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Düzenle
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Kat: {block.floorCount}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Apartman: {block.apartmentCount}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Daire: {block.unitCount}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Dolu: {block.occupiedUnitCount}</span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5">
                      {block.apartments.map((apartment) => (
                        <div key={apartment.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Apartman</p>
                              <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h5 className="text-xl font-semibold text-white">{apartment.name}</h5>
                                <button
                                  type="button"
                                  onClick={() => openApartmentEditor(apartment)}
                                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Düzenle
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-zinc-400">
                                {apartment.floorCount} kat, {apartment.unitCount} daire, {apartment.occupiedUnitCount} dolu daire
                              </p>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                  <Layers3 className="h-3.5 w-3.5" /> Apartman Kimliği
                                </p>
                                <p className="mt-2 break-all text-sm font-semibold text-white">{apartment.tablet.loginId}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                  <KeyRound className="h-3.5 w-3.5" /> Tablet Şifresi
                                </p>
                                <p className="mt-2 text-sm font-semibold text-white">
                                  {apartment.tablet.temporaryPassword ?? 'Tablet şifresi değiştirildi'}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                  <MonitorSmartphone className="h-3.5 w-3.5" /> Son Tablet Girişi
                                </p>
                                <p className="mt-2 text-sm font-semibold text-white">
                                  {apartment.tablet.lastLoginAt
                                    ? new Intl.DateTimeFormat('tr-TR', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }).format(new Date(apartment.tablet.lastLoginAt))
                                    : 'Henüz giriş yapılmadı'}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                  <MapPinned className="h-3.5 w-3.5" /> Apartman Kodu
                                </p>
                                <p className="mt-2 break-all text-sm font-semibold text-white">{apartment.code}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4">
                            {apartment.units.map((unit) => (
                              <div key={unit.id} className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <p className="font-semibold text-white">{unit.label}</p>
                                    <p className="mt-2 text-sm text-zinc-400">
                                      {unit.isVacant ? 'Daire boş.' : unit.ownerName || 'Malik bilgisi girilmedi.'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                        unit.isVacant
                                          ? 'border-white/10 bg-white/5 text-zinc-400'
                                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                      }`}
                                    >
                                      {unit.isVacant ? 'Boş' : 'Dolu'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setUnitEditor({
                                          unit,
                                          ownerName: unit.ownerName ?? '',
                                          phone: unit.resident?.loginPhone ?? ''
                                        })
                                      }
                                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                        unit.isVacant
                                          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                          : 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
                                      }`}
                                    >
                                      {unit.isVacant ? <UserPlus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                      {unit.isVacant ? 'Sakin Ekle' : 'Sakini Düzenle'}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                    <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                      <Layers3 className="h-3.5 w-3.5" /> Daire Kimliği
                                    </p>
                                    <p className="mt-2 break-all text-sm font-semibold text-white">{unit.code}</p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                    <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                      <Users className="h-3.5 w-3.5" /> Giriş Numarası
                                    </p>
                                    <p className="mt-2 text-sm font-semibold text-white">
                                      {unit.resident?.loginPhone ?? 'Henüz oluşturulmadı'}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                    <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                      <KeyRound className="h-3.5 w-3.5" /> İlk Şifre
                                    </p>
                                    <p className="mt-2 text-sm font-semibold text-white">
                                      {unit.resident?.temporaryPassword ?? (unit.resident ? 'Sakin tarafından değiştirildi' : 'Yok')}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                    <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                      <Building2 className="h-3.5 w-3.5" /> Son Giriş
                                    </p>
                                    <p className="mt-2 text-sm font-semibold text-white">
                                      {unit.resident?.lastLoginAt
                                        ? new Intl.DateTimeFormat('tr-TR', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          }).format(new Date(unit.resident.lastLoginAt))
                                        : 'Henüz giriş yapılmadı'}
                                    </p>
                                  </div>
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
            </>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-16 text-center text-sm text-zinc-500">
              Detay görmek için soldan bir site seçin.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
