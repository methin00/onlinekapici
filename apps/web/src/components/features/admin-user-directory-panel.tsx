'use client';

import { useState } from 'react';
import { appFetch } from '@/lib/api';
import type { AdminDirectoryUser, Building } from '@/lib/types';
import { useToast } from '../providers/toast-provider';

type AdminUserDirectoryPanelProps = {
  superAdmins: AdminDirectoryUser[];
  concierges: AdminDirectoryUser[];
  buildings: Building[];
  onCreated: () => Promise<void> | void;
};

function UserEditModal({
  user,
  buildings,
  submitting,
  formState,
  onClose,
  onToggleBuilding,
  onChangeName,
  onChangePhone,
  onSubmit
}: {
  user: AdminDirectoryUser;
  buildings: Building[];
  submitting: boolean;
  formState: { name: string; phone: string; buildingIds: string[] };
  onClose: () => void;
  onToggleBuilding: (buildingId: string, checked: boolean) => void;
  onChangeName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2b1f13]/25 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[var(--bg-surface)] p-8 shadow-[0_30px_100px_-40px_rgba(74,53,30,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">Danışman Düzenle</p>
            <h3 className="mt-2 font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">{user.fullName}</h3>
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
              value={formState.name}
              onChange={(event) => onChangeName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/70 px-4 py-4 text-[var(--text-primary)] focus:border-cyan-500/40 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">Telefon</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={formState.phone}
              onChange={(event) => onChangePhone(event.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              className="w-full rounded-2xl border border-white/10 bg-white/70 px-4 py-4 text-[var(--text-primary)] focus:border-cyan-500/40 focus:outline-none"
            />
            <p className="text-xs text-[var(--text-secondary)]">Telefon numarası yalnızca 10 haneli olarak kaydedilir.</p>
          </div>

          <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/60 p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Site Atamaları</p>
            <div className="grid gap-2">
              {buildings.length ? (
                buildings.map((building) => (
                  <label
                    key={building.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)]"
                  >
                    <input
                      type="checkbox"
                      checked={formState.buildingIds.includes(building.id)}
                      onChange={(event) => onToggleBuilding(building.id, event.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-white/70"
                    />
                    <span>{building.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">Henüz atanabilir site bulunmuyor.</p>
              )}
            </div>
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
            disabled={submitting || formState.name.trim().length < 3 || formState.phone.length !== 10}
            onClick={() => void onSubmit()}
            className="rounded-2xl border border-cyan-500/40 bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Kaydediliyor...' : 'Güncelle'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserCard({
  user,
  editable = false,
  onEdit,
  onDelete
}: {
  user: AdminDirectoryUser;
  editable?: boolean;
  onEdit?: (user: AdminDirectoryUser) => void;
  onDelete?: (user: AdminDirectoryUser) => void;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-2xl font-semibold tracking-tight text-white">{user.fullName}</p>
          <p className="mt-2 text-sm text-zinc-400">{user.loginPhone}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            {user.role === 'super_admin' ? 'Sistem Yöneticisi' : 'Danışman'}
          </span>
          {editable ? (
            <>
              <button
                type="button"
                onClick={() => onEdit?.(user)}
                className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300"
              >
                Düzenle
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(user)}
                className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300"
              >
                Sil
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">İlk Şifre</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {user.temporaryPassword ?? 'Kullanıcı tarafından değiştirildi'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Son Giriş</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {user.lastLoginAt
              ? new Intl.DateTimeFormat('tr-TR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                }).format(new Date(user.lastLoginAt))
              : 'Henüz giriş yapılmadı'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Atama</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {user.assignedBuildings.length ? `${user.assignedBuildings.length} site` : 'Genel yetki'}
          </p>
        </div>
      </div>

      {user.assignedBuildings.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {user.assignedBuildings.map((building) => (
            <span key={building.id} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
              {building.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminUserDirectoryPanel({
  superAdmins,
  concierges,
  buildings,
  onCreated
}: AdminUserDirectoryPanelProps) {
  const { showToast } = useToast();
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'CONCIERGE' | 'SUPER_ADMIN'>('CONCIERGE');
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminDirectoryUser | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [editingBuildingIds, setEditingBuildingIds] = useState<string[]>([]);
  const [updatingUser, setUpdatingUser] = useState(false);

  function openEditModal(user: AdminDirectoryUser) {
    setEditingUser(user);
    setEditingName(user.fullName);
    setEditingPhone(user.loginPhone);
    setEditingBuildingIds(user.assignedBuildings.map((building) => building.id));
  }

  return (
    <>
      {editingUser ? (
        <UserEditModal
          user={editingUser}
          buildings={buildings}
          submitting={updatingUser}
          formState={{
            name: editingName,
            phone: editingPhone,
            buildingIds: editingBuildingIds
          }}
          onClose={() => {
            setEditingUser(null);
            setUpdatingUser(false);
          }}
          onChangeName={setEditingName}
          onChangePhone={setEditingPhone}
          onToggleBuilding={(buildingId, checked) =>
            setEditingBuildingIds((current) =>
              checked ? Array.from(new Set([...current, buildingId])) : current.filter((item) => item !== buildingId)
            )
          }
          onSubmit={async () => {
            if (!editingUser) {
              return;
            }

            if (editingPhone.length !== 10) {
              showToast({
                tone: 'warning',
                message: 'Telefon numarasını 10 haneli biçimde girin.'
              });
              return;
            }

            setUpdatingUser(true);

            try {
              const response = await appFetch<{ data: AdminDirectoryUser }>(`admin/users/${editingUser.id}`, {
                method: 'PATCH',
                body: {
                  name: editingName,
                  phone: editingPhone,
                  buildingIds: editingBuildingIds
                }
              });

              showToast({
                tone: 'success',
                message: `${response.data.fullName} bilgileri güncellendi.`
              });
              setEditingUser(null);
              await onCreated();
            } catch (error) {
              showToast({
                tone: 'danger',
                message: error instanceof Error ? error.message : 'Danışman bilgileri güncellenemedi.'
              });
            } finally {
              setUpdatingUser(false);
            }
          }}
        />
      ) : null}

      <section className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="glass-panel rounded-[32px] p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">Yeni Hesap</p>
        <h3 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white">Yönetici veya danışman ekle</h3>

        <form
          className="mt-8 space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();

            if (phone.length !== 10) {
              showToast({
                tone: 'warning',
                message: 'Telefon numarasını 10 haneli biçimde girin.'
              });
              return;
            }

            setSubmitting(true);

            try {
              const response = await appFetch<{ data: AdminDirectoryUser }>('admin/users', {
                method: 'POST',
                body: {
                  name,
                  phone,
                  role,
                  buildingIds: role === 'CONCIERGE' ? selectedBuildingIds : []
                }
              });

              showToast({
                tone: 'success',
                message: `${response.data.fullName} hesabı oluşturuldu. İlk şifre: ${response.data.temporaryPassword ?? 'hazır'}`
              });

              setName('');
              setPhone('');
              setRole('CONCIERGE');
              setSelectedBuildingIds([]);
              await onCreated();
            } catch (error) {
              showToast({
                tone: 'danger',
                message: error instanceof Error ? error.message : 'Kullanıcı oluşturulamadı.'
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Ad Soyad</label>
            <input
              type="text"
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn: Elif Yılmaz"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Telefon</label>
            <input
              type="tel"
              name="phone"
              required
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              placeholder="5xxxxxxxxx"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none"
            />
            <p className="text-xs text-zinc-500">Telefon numarası yalnızca 10 hane olarak girilir.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Rol</label>
            <select
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as 'CONCIERGE' | 'SUPER_ADMIN')}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white focus:border-emerald-500/40 focus:outline-none"
            >
              <option value="CONCIERGE">Danışman</option>
              <option value="SUPER_ADMIN">Sistem Yöneticisi</option>
            </select>
          </div>

          <div className="space-y-3 rounded-[24px] border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-medium text-zinc-300">Danışman Atamaları</p>
            <div className={`grid gap-2 ${role === 'SUPER_ADMIN' ? 'opacity-50' : ''}`}>
              {buildings.length ? (
                buildings.map((building) => {
                  const checked = selectedBuildingIds.includes(building.id);

                  return (
                    <label
                      key={building.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={role === 'SUPER_ADMIN'}
                        onChange={(event) =>
                          setSelectedBuildingIds((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, building.id]))
                              : current.filter((item) => item !== building.id)
                          )
                        }
                        className="h-4 w-4 rounded border-white/10 bg-black/40"
                      />
                      <span>{building.name}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">Önce site eklenmeli.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || name.trim().length < 3 || phone.length !== 10}
            className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500 px-6 py-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Kaydediliyor...' : 'Hesabı Oluştur'}
          </button>
        </form>
        </div>

        <div className="space-y-8">
          <section className="glass-panel rounded-[32px] p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">Sistem Yöneticileri</p>
              <h3 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white">Merkezi erişim</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {superAdmins.length} kişi
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            {superAdmins.length ? (
              superAdmins.map((user) => <UserCard key={user.id} user={user} />)
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-10 text-center text-sm text-zinc-500">
                Kayıtlı sistem yöneticisi bulunmuyor.
              </div>
            )}
          </div>
          </section>

          <section className="glass-panel rounded-[32px] p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">Danışmanlar</p>
              <h3 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white">Saha ekipleri</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {concierges.length} kişi
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            {concierges.length ? (
              concierges.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  editable
                  onEdit={openEditModal}
                  onDelete={async (targetUser) => {
                    const confirmed = window.confirm(`${targetUser.fullName} kaydı silinsin mi?`);

                    if (!confirmed) {
                      return;
                    }

                    try {
                      await appFetch<{ message: string }>(`admin/users/${targetUser.id}`, {
                        method: 'DELETE'
                      });
                      showToast({
                        tone: 'success',
                        message: `${targetUser.fullName} kaydı silindi.`
                      });
                      await onCreated();
                    } catch (error) {
                      showToast({
                        tone: 'danger',
                        message: error instanceof Error ? error.message : 'Danışman silinemedi.'
                      });
                    }
                  }}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-10 text-center text-sm text-zinc-500">
                Kayıtlı danışman bulunmuyor.
              </div>
            )}
          </div>
          </section>
        </div>
      </section>
    </>
  );
}
