import { useCallback, useEffect, useState } from 'react';
import { Check, Gift, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { relativeTime } from '../../lib/api/content';
import {
  STATUS_LABEL,
  deleteReward,
  deliverRedemption,
  fetchAllRedemptions,
  fetchHouseRedemptions,
  fetchManagedRewards,
  lookupRedemption,
  saveReward,
  type Redemption,
  type Reward,
} from '../../lib/api/rewards';

const msg = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

const STATUS_STYLE: Record<Redemption['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

type FormState = { id: string | null; title: string; description: string; cost: string; stock: string; active: boolean };
const EMPTY: FormState = { id: null, title: '', description: '', cost: '', stock: '', active: true };

/** Hədiyyə kataloqunun idarəsi. houseId=null → ümumi (admin), əks halda mərkəzin öz hədiyyələri. */
export function RewardsManager({ houseId }: { houseId: string | null }) {
  const [items, setItems] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchManagedRewards(houseId));
      setError(null);
    } catch (err) {
      setError(msg(err, 'Hədiyyələr yüklənmədi'));
    }
    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form) return;
    const title = form.title.trim();
    const cost = Number(form.cost);
    const stockRaw = form.stock.trim();
    const stock = stockRaw === '' ? null : Number(stockRaw);
    if (title.length < 2) return setError('Ad ən azı 2 simvol olmalıdır');
    if (!Number.isInteger(cost) || cost <= 0) return setError('Xal müsbət tam ədəd olmalıdır');
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return setError('Say 0 və ya müsbət tam ədəd olmalıdır');
    setSaving(true);
    setError(null);
    try {
      await saveReward(form.id, {
        title,
        description: form.description.trim() || null,
        cost,
        stock,
        is_active: form.active,
        house_id: houseId,
      });
      setForm(null);
      await load();
    } catch (err) {
      setError(msg(err, 'Yadda saxlanmadı'));
    }
    setSaving(false);
  };

  const remove = async (r: Reward) => {
    if (!window.confirm(`"${r.title}" silinsin? Verilmiş kuponlar qalacaq.`)) return;
    try {
      await deleteReward(r.id);
      await load();
    } catch (err) {
      setError(msg(err, 'Silinmədi'));
    }
  };

  const edit = (r: Reward) =>
    setForm({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      cost: String(r.cost),
      stock: r.stock === null ? '' : String(r.stock),
      active: r.is_active,
    });

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Hədiyyələr</h3>
          <p className="text-sm text-gray-500">
            {houseId ? 'Yalnız sizin mərkəzin gəncləri görür' : 'Bütün mərkəzlərin gəncləri görür'}
          </p>
        </div>
        <button
          onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={15} /> Yeni hədiyyə
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {form && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <input className={input} placeholder="Hədiyyənin adı" maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea className={input} placeholder="Təsvir (istəyə görə)" rows={2} maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={input} type="number" min={1} placeholder="Qiyməti (xal)" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            <input className={input} type="number" min={0} placeholder="Say (boş = limitsiz)" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Gənclərə göstərilsin
          </label>
          <div className="flex gap-2">
            <button onClick={() => void submit()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving && <Loader2 size={15} className="animate-spin" />} Yadda saxla
            </button>
            <button onClick={() => { setForm(null); setError(null); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600">
              Ləğv et
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Gift className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Hədiyyə əlavə olunmayıb.</p>
        </div>
      )}
      {items.map(r => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">
              {r.title} {!r.is_active && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">gizli</span>}
            </p>
            {r.description && <p className="text-sm text-gray-600">{r.description}</p>}
            <p className="mt-1 text-xs text-gray-500">
              {r.cost} xal · {r.stock === null ? 'Limitsiz' : `Qalıb: ${r.stock}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => edit(r)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Pencil size={14} /> Dəyiş
            </button>
            <button onClick={() => void remove(r)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              <Trash2 size={14} /> Sil
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mərkəz əməkdaşı: kodu yoxla və hədiyyəni təhvil ver. */
export function RedemptionDesk({ houseId }: { houseId: string }) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Awaited<ReturnType<typeof lookupRedemption>>>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<Redemption[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      setRecent(await fetchHouseRedemptions(houseId));
    } catch (err) {
      setError(msg(err, 'Siyahı yüklənmədi'));
    }
  }, [houseId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const check = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setFound(await lookupRedemption(houseId, code));
      setSearched(true);
    } catch (err) {
      setError(msg(err, 'Yoxlanmadı'));
    }
    setBusy(false);
  };

  const deliver = async () => {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      await deliverRedemption(found.id);
      setNotice(`"${found.reward_title}" təhvil verildi.`);
      setFound(null);
      setSearched(false);
      setCode('');
      await loadRecent();
    } catch (err) {
      setError(msg(err, 'Təhvil alınmadı'));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Kupon təhvili</h3>
        <p className="text-sm text-gray-500">Gəncin göstərdiyi 6 rəqəmli kodu daxil edin</p>
      </div>

      <div className="flex gap-2">
        <input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setSearched(false); setFound(null); }}
          placeholder="000000"
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-xl tracking-[0.3em] focus:border-emerald-500 focus:outline-none"
        />
        <button
          onClick={() => void check()}
          disabled={busy || code.length !== 6}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Yoxla
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div>}
      {searched && !found && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Bu kodla gözləyən kupon tapılmadı (kod səhvdir, artıq istifadə olunub və ya başqa mərkəzə aiddir).</div>}

      {found && (
        <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-lg font-bold text-gray-800">{found.reward_title}</p>
          <p className="text-sm text-gray-700">Gənc: {found.user_name ?? 'Adsız'} · {found.cost} xal</p>
          <button onClick={() => void deliver()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Təhvil ver
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">Son kuponlar</p>
        {recent.length === 0 && <p className="text-sm text-gray-500">Hələ kupon yoxdur.</p>}
        {recent.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{r.reward_title}</p>
              <p className="text-xs text-gray-500">{r.cost} xal · {relativeTime(r.created_at)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Admin: bütün kuponların siyahısı. */
export function AdminRedemptions() {
  const [rows, setRows] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAllRedemptions()
      .then(r => active && setRows(r))
      .catch(err => active && setError(msg(err, 'Kuponlar yüklənmədi')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const spent = rows.filter(r => r.status !== 'cancelled').reduce((sum, r) => sum + r.cost, 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Bütün kuponlar</h3>
        <p className="text-sm text-gray-500">Son 200 kupon · xərclənən xal (ləğv edilmiş istisna): {spent}</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-500">Hələ kupon yoxdur.</p>}
      {rows.map(r => (
        <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800">{r.reward_title}</p>
            <p className="text-xs text-gray-500">{r.youth_houses?.name ?? 'Mərkəz'} · {r.cost} xal · {relativeTime(r.created_at)}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
        </div>
      ))}
    </div>
  );
}

function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 flex gap-2 border-b border-gray-200">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${value === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Gənclər Evi panelində "Hədiyyələr" bölməsi. */
export function HouseRewards({ houseId }: { houseId: string | null }) {
  const [tab, setTab] = useState('desk');
  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra hədiyyələri idarə edə biləcəksiniz.
      </div>
    );
  }
  return (
    <div>
      <Tabs tabs={[{ id: 'desk', label: 'Kupon təhvili' }, { id: 'catalog', label: 'Hədiyyələrim' }]} value={tab} onChange={setTab} />
      {tab === 'desk' ? <RedemptionDesk houseId={houseId} /> : <RewardsManager houseId={houseId} />}
    </div>
  );
}

/** Admin panelində "Hədiyyələr" bölməsi. */
export function AdminRewards() {
  const [tab, setTab] = useState('catalog');
  return (
    <div>
      <Tabs tabs={[{ id: 'catalog', label: 'Ümumi hədiyyələr' }, { id: 'coupons', label: 'Kuponlar' }]} value={tab} onChange={setTab} />
      {tab === 'catalog' ? <RewardsManager houseId={null} /> : <AdminRedemptions />}
    </div>
  );
}

