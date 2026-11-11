import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Send, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { relativeTime } from '../../lib/api/content';

type HouseOption = { id: string; name: string };

type RawRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  user_id: string | null;
  house_id: string | null;
};

type SentGroup = {
  key: string;
  title: string;
  message: string;
  created_at: string;
  target: string;
  count: number;
};

const AUDIENCES = [
  { value: 'all', label: 'Bütün istifadəçilər' },
  { value: 'house', label: 'Bir Gənclər Evinin gəncləri' },
  { value: 'youth', label: 'Yalnız gənclər' },
  { value: 'trainer', label: 'Yalnız təlimçilər' },
  { value: 'youth_house', label: 'Yalnız Gənclər Evi hesabları' },
];

/**
 * Administrator elanları: bütün istifadəçilərə, bir Gənclər Evinə və ya yalnız
 * müəyyən rola (gənc, təlimçi, Gənclər Evi) göndərilir.
 */
export function AdminAnnouncements() {
  const [houses, setHouses] = useState<HouseOption[]>([]);
  const [groups, setGroups] = useState<SentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [houseId, setHouseId] = useState('');
  const [sending, setSending] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [housesRes, rowsRes] = await Promise.all([
      supabase.from('youth_houses').select('id, name').order('name'),
      supabase
        .from('notifications')
        .select('id, title, message, created_at, user_id, house_id')
        .eq('type', 'system')
        .not('created_by', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1500),
    ]);
    const houseList = (housesRes.data as HouseOption[]) ?? [];
    setHouses(houseList);
    if (rowsRes.error) {
      setError(rowsRes.error.message);
    } else {
      const names = new Map(houseList.map(h => [h.id, h.name]));
      const map = new Map<string, SentGroup>();
      for (const row of (rowsRes.data as RawRow[]) ?? []) {
        const key = `${row.title}||${row.message}||${row.created_at}`;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        let target = 'Seçilmiş istifadəçilər';
        if (!row.user_id && !row.house_id) target = 'Bütün istifadəçilər';
        else if (!row.user_id && row.house_id) target = names.get(row.house_id) ?? 'Gənclər Evi';
        map.set(key, { key, title: row.title, message: row.message, created_at: row.created_at, target, count: 1 });
      }
      setGroups(Array.from(map.values()).slice(0, 40));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    setError(null);
    setNotice(null);
    if (!title.trim() || !message.trim()) {
      setError('Başlıq və mətn mütləqdir');
      return;
    }
    if (audience === 'house' && !houseId) {
      setError('Gənclər Evini seçin');
      return;
    }
    const label = AUDIENCES.find(a => a.value === audience)?.label ?? '';
    if (!window.confirm(`Elan göndərilsin?\n\nAuditoriya: ${label}\nBaşlıq: ${title.trim()}`)) return;

    setSending(true);
    const { data, error: err } = await supabase.rpc('admin_send_announcement', {
      p_title: title.trim(),
      p_message: message.trim(),
      p_audience: audience,
      p_house_id: audience === 'house' ? houseId : null,
    });
    if (err) setError(err.message);
    else {
      setTitle('');
      setMessage('');
      const count = typeof data === 'number' ? data : 0;
      setNotice(count > 1 ? `Elan ${count} istifadəçiyə göndərildi.` : 'Elan göndərildi.');
      await load();
    }
    setSending(false);
  };

  const remove = async (group: SentGroup) => {
    if (!window.confirm('Bu elan hamıdan silinsin?')) return;
    setBusyKey(group.key);
    const { error: err } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'system')
      .eq('title', group.title)
      .eq('message', group.message)
      .eq('created_at', group.created_at);
    if (err) setError(err.message);
    else setGroups(current => current.filter(item => item.key !== group.key));
    setBusyKey(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Elan istifadəçilərin tətbiqindəki bildirişlər siyahısında görünür.
        </p>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yenilə
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      )}

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-600">Kimə</label>
          <select
            value={audience}
            onChange={e => setAudience(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          >
            {AUDIENCES.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {audience === 'house' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-600">Gənclər Evi</label>
            <select
              value={houseId}
              onChange={e => setHouseId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            >
              <option value="">Seçin...</option>
              {houses.map(house => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-600">Başlıq</label>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-600">Mətn</label>
          <textarea
            value={message}
            maxLength={1000}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>

        <button
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Göndər
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Megaphone className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Hələ elan göndərilməyib.</p>
        </div>
      )}

      {groups.map(group => (
        <div
          key={group.key}
          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">{group.title}</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-gray-600">{group.message}</p>
            <p className="mt-1 text-xs text-gray-400">
              {group.target}
              {group.count > 1 ? ` · ${group.count} nəfər` : ''} · {relativeTime(group.created_at)}
            </p>
          </div>
          <button
            onClick={() => void remove(group)}
            disabled={busyKey === group.key}
            className="shrink-0 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            {busyKey === group.key ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
      ))}
    </div>
  );
}
