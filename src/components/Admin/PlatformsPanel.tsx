import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, HelpCircle, Loader2, RefreshCcw, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type PlatformKey = 'android' | 'ios' | 'web' | 'unknown';
type Filter = PlatformKey | 'all';

interface SummaryRow {
  platform: PlatformKey;
  role: string;
  total: number;
  last_24h: number;
  last_7d: number;
}

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  city: string | null;
  platform: PlatformKey;
  created_at: string;
}

const PAGE = 100;

const platformLabels: Record<PlatformKey, string> = {
  android: 'Android',
  ios: 'iOS',
  web: 'Veb',
  unknown: 'Naməlum',
};

const platformTone: Record<PlatformKey, string> = {
  android: 'bg-emerald-100 text-emerald-700',
  ios: 'bg-sky-100 text-sky-700',
  web: 'bg-violet-100 text-violet-700',
  unknown: 'bg-gray-200 text-gray-700',
};

const roleLabels: Record<string, string> = {
  youth: 'Gənc',
  trainer: 'Təlimçi',
  youth_house: 'Gənclər Evi',
  admin: 'Admin',
};

const statusLabels: Record<string, string> = {
  pending: 'Gözləyir',
  approved: 'Təsdiqlənib',
  rejected: 'Rədd edilib',
  suspended: 'Dayandırılıb',
};

const ORDER: PlatformKey[] = ['android', 'ios', 'web', 'unknown'];

function PlatformIcon({ platform }: { platform: PlatformKey }) {
  if (platform === 'web') return <Globe size={20} />;
  if (platform === 'unknown') return <HelpCircle size={20} />;
  return <Smartphone size={20} />;
}

export function PlatformsPanel() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async (platform: Filter, offset: number) => {
    const { data, error: err } = await supabase.rpc('admin_platform_users', {
      p_platform: platform === 'all' ? null : platform,
      p_limit: PAGE,
      p_offset: offset,
    });
    if (err) throw err;
    return (data ?? []) as UserRow[];
  }, []);

  const load = useCallback(
    async (platform: Filter) => {
      setLoading(true);
      setError('');
      try {
        const [s, u] = await Promise.all([supabase.rpc('admin_platform_summary'), fetchUsers(platform, 0)]);
        if (s.error) throw s.error;
        setSummary((s.data ?? []) as SummaryRow[]);
        setUsers(u);
        setHasMore(u.length === PAGE);
      } catch {
        setError('Məlumatı yükləmək mümkün olmadı.');
        setSummary([]);
        setUsers([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [fetchUsers],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const more = await fetchUsers(filter, users.length);
      setUsers((current) => [...current, ...more]);
      setHasMore(more.length === PAGE);
    } catch {
      setError('Daha çox məlumat yüklənmədi.');
    } finally {
      setLoadingMore(false);
    }
  };

  const totals = useMemo(() => {
    const base: Record<PlatformKey, { total: number; last_24h: number; last_7d: number }> = {
      android: { total: 0, last_24h: 0, last_7d: 0 },
      ios: { total: 0, last_24h: 0, last_7d: 0 },
      web: { total: 0, last_24h: 0, last_7d: 0 },
      unknown: { total: 0, last_24h: 0, last_7d: 0 },
    };
    for (const row of summary) {
      const key = (ORDER.includes(row.platform) ? row.platform : 'unknown') as PlatformKey;
      base[key].total += Number(row.total);
      base[key].last_24h += Number(row.last_24h);
      base[key].last_7d += Number(row.last_7d);
    }
    return base;
  }, [summary]);

  const grandTotal = ORDER.reduce((sum, key) => sum + totals[key].total, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      const text = (u.first_name + ' ' + u.last_name + ' ' + u.email + ' ' + (u.city ?? '')).toLowerCase();
      return text.includes(q);
    });
  }, [users, roleFilter, query]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('az-AZ', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Platformalar</h2>
          <p className="text-sm text-gray-500">
            Hesabların hansı platformadan istifadə etdiyi. Cəmi {grandTotal.toLocaleString()} hesab.
          </p>
        </div>
        <button
          onClick={() => void load(filter)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
        >
          <RefreshCcw size={15} />
          Yenilə
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDER.map((key) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={
              'rounded-xl border bg-white p-4 text-left shadow-sm transition ' +
              (filter === key ? 'border-rose-400 ring-2 ring-rose-100' : 'border-gray-200 hover:border-gray-300')
            }
          >
            <div className={'mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ' + platformTone[key]}>
              <PlatformIcon platform={key} />
            </div>
            <div className="text-2xl font-bold text-gray-800">{totals[key].total.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-600">{platformLabels[key]}</div>
            <div className="mt-1 text-xs text-gray-500">
              Son 24 saat: {totals[key].last_24h} · Son 7 gün: {totals[key].last_7d}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...ORDER] as Filter[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
              (filter === key ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')
            }
          >
            {key === 'all' ? 'Hamısı' : platformLabels[key]}
          </button>
        ))}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600"
          aria-label="Rol"
        >
          <option value="all">Bütün rollar</option>
          <option value="youth">Gənclər</option>
          <option value="trainer">Təlimçilər</option>
          <option value="youth_house">Gənclər Evləri</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad, e-poçt və ya şəhər"
          className="min-w-[200px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yüklənir
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">Nəticə tapılmadı.</div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-semibold">Ad Soyad</th>
                <th className="px-4 py-3 font-semibold">E-poçt</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Şəhər</th>
                <th className="px-4 py-3 font-semibold">Platforma</th>
                <th className="px-4 py-3 font-semibold">Qeydiyyat</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-800">{(u.first_name + ' ' + u.last_name).trim() || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{roleLabels[u.role] ?? u.role}</td>
                  <td className="px-4 py-3 text-gray-600">{statusLabels[u.status] ?? u.status}</td>
                  <td className="px-4 py-3 text-gray-600">{u.city || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + platformTone[u.platform]}>
                      {platformLabels[u.platform] ?? u.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && hasMore && (
        <div className="text-center">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Daha çox göstər
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Köhnə hesablarda platforma ən son sessiyadan təxmin edilib. "Naməlum" hesablar növbəti girişdə dəqiqləşəcək.
      </p>
    </div>
  );
}
