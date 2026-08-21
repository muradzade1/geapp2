import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, Trash2, X, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PlatformProfile } from '../../lib/profile';


/** Hesabın profil şəkillərini Storage API ilə silir. */
async function removeAccountPhotos(userId: string) {
  try {
    const { data } = await supabase.storage.from('account-photos').list(userId);
    if (!data || data.length === 0) return;
    await supabase.storage
      .from('account-photos')
      .remove(data.map((file) => `${userId}/${file.name}`));
  } catch {
    // Şəkil silinməsə də hesabın silinməsi dayanmamalıdır.
  }
}

type RoleFilter = 'youth' | 'trainer' | 'youth_house';
type StatusFilter = 'pending' | 'approved' | 'rejected' | 'suspended' | 'all';

const roleLabels: Record<RoleFilter, string> = {
  youth: 'Gənclər',
  trainer: 'Təlimçilər',
  youth_house: 'Gənclər Evləri',
};

const statusLabels: Record<Exclude<StatusFilter, 'all'>, string> = {
  pending: 'Gözləyir',
  approved: 'Təsdiqlənib',
  rejected: 'Rədd edilib',
  suspended: 'Dayandırılıb',
};

const statusTone: Record<Exclude<StatusFilter, 'all'>, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  suspended: 'bg-gray-200 text-gray-700',
};

export function RegistrationsPanel() {
  const [rows, setRows] = useState<PlatformProfile[]>([]);
  const [role, setRole] = useState<RoleFilter>('youth');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase.rpc('admin_list_profiles');
    if (fetchError) {
      setError('Qeydiyyatları yükləmək mümkün olmadı.');
      setRows([]);
    } else {
      setRows((data ?? []) as PlatformProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => row.role === role && (status === 'all' || row.status === status));
  }, [rows, role, status]);

  const counts = useMemo(() => {
    const byRole = { youth: 0, trainer: 0, youth_house: 0 } as Record<RoleFilter, number>;
    rows.forEach((row) => {
      if (row.role !== 'admin' && row.status === 'pending') {
        byRole[row.role as RoleFilter] = (byRole[row.role as RoleFilter] ?? 0) + 1;
      }
    });
    return byRole;
  }, [rows]);

  const [deleteTarget, setDeleteTarget] = useState<PlatformProfile | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);

    await removeAccountPhotos(deleteTarget.id);

    const { error: rpcError } = await supabase.rpc('admin_delete_account', {
      target_id: deleteTarget.id,
    });

    if (rpcError) {
      setDeleteError(rpcError.message);
      setDeleting(false);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
    setDeleteTarget(null);
    setConfirmWord('');
    setDeleting(false);
  };

  const updateStatus = async (id: string, nextStatus: 'approved' | 'rejected') => {
    setPendingIds((current) => new Set(current).add(id));
    const { error: updateError } = await supabase.rpc('admin_set_profile_status', { target_id: id, new_status: nextStatus });
    if (!updateError) {
      setRows((current) => current.map((row) => row.id === id ? { ...row, status: nextStatus } : row));
    }
    setPendingIds((current) => {
      const copy = new Set(current);
      copy.delete(id);
      return copy;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Qeydiyyatlar</h2>
          <p className="text-sm text-gray-500">Yeni müraciətləri təsdiqləyin və ya rədd edin.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCcw className="h-4 w-4" />Yenilə
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(roleLabels) as RoleFilter[]).map((key) => (
          <button key={key} onClick={() => setRole(key)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${role === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300'}`}>
            {roleLabels[key]}
            {counts[key] > 0 && <span className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${role === key ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{counts[key]}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'suspended', 'all'] as StatusFilter[]).map((key) => (
          <button key={key} onClick={() => setStatus(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${status === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
            {key === 'all' ? 'Hamısı' : statusLabels[key]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Yüklənir...</div>
        ) : error ? (
          <div className="px-6 py-10 text-center"><p className="text-sm text-rose-700">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Yenidən cəhd et</button></div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">Məlumat yoxdur.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((row) => {
              const displayName = row.role === 'youth_house' ? (row.house_name ?? '—') : `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—';
              const isBusy = pendingIds.has(row.id);
              return (
                <div key={row.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{displayName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[row.status]}`}>{statusLabels[row.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{row.email || '—'}{row.phone ? ` · ${row.phone}` : ''}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {row.city ? `${row.city} · ` : ''}
                      {new Date(row.created_at).toLocaleDateString('az-AZ')}
                      {row.role === 'trainer' && row.specialization ? ` · ${row.specialization}` : ''}
                      {row.role === 'youth' && row.youth_house_name ? ` · ${row.youth_house_name}` : ''}
                      {row.role === 'youth_house' && row.responsible_name ? ` · ${row.responsible_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button disabled={isBusy || row.status === 'approved'} onClick={() => void updateStatus(row.id, 'approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" />Təsdiqlə
                    </button>
                    <button disabled={isBusy || row.status === 'rejected'} onClick={() => void updateStatus(row.id, 'rejected')} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <XCircle className="h-4 w-4" />Rədd et
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => { setDeleteTarget(row); setConfirmWord(''); setDeleteError(null); }}
                      title="Hesabı həmişəlik sil"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-500 hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-600" size={20} />
                <h3 className="font-semibold text-gray-800">Hesabı silmək</h3>
              </div>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-600">
                <strong>
                  {deleteTarget.role === 'youth_house'
                    ? (deleteTarget.house_name ?? 'Gənclər Evi')
                    : `${deleteTarget.first_name ?? ''} ${deleteTarget.last_name ?? ''}`.trim() || deleteTarget.email}
                </strong>{' '}
                hesabı və ona bağlı bütün məlumatlar həmişəlik silinir. Bu əməliyyat geri qaytarılmır.
              </p>

              {deleteTarget.role === 'youth_house' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Diqqət: bu hesabın Gənclər Evi qeydi, həmin mərkəzin bütün ziyarət
                  və tədbir tarixçəsi ilə birlikdə silinəcək.
                </div>
              )}

              <p className="text-sm text-gray-600">
                Davam etmək üçün aşağıya <strong>SİL</strong> yazın.
              </p>

              <input
                type="text"
                value={confirmWord}
                onChange={(event) => setConfirmWord(event.target.value)}
                placeholder="SİL"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />

              {deleteError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  İmtina
                </button>
                <button
                  onClick={() => void deleteAccount()}
                  disabled={deleting || confirmWord.trim().toUpperCase() !== 'SİL'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-gray-300"
                >
                  {deleting && <Loader2 size={15} className="animate-spin" />}
                  Həmişəlik sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
