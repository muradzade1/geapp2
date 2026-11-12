import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Job = {
  id: string;
  source: string;
  title: string;
  organization: string | null;
  location: string | null;
  category: string | null;
  deadline: string | null;
  url: string;
  summary: string | null;
  review_status: 'new' | 'suitable' | 'unsuitable';
  sent_at: string | null;
  send_count: number;
  created_at: string;
  expired: boolean;
};

type HouseOption = { id: string; name: string };
type Filter = 'all' | Job['review_status'];

const REVIEW_LABEL: Record<Job['review_status'], string> = { new: 'Yeni', suitable: 'Uyğundur', unsuitable: 'Uyğun deyil' };
const REVIEW_TONE: Record<Job['review_status'], string> = {
  new: 'bg-amber-100 text-amber-800',
  suitable: 'bg-emerald-100 text-emerald-800',
  unsuitable: 'bg-gray-200 text-gray-600',
};

const pad = (n: number) => String(n).padStart(2, '0');
function fmt(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const emptyForm = { id: null as string | null, url: '', title: '', organization: '', location: '', category: '', deadline: '', summary: '' };

/** Admin üçün: vakansiya elanlarını toplamaq, baxmaq, "uyğundur" etmək və bildiriş kimi göndərmək. */
export default function JobCenter() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [houses, setHouses] = useState<HouseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showExpired, setShowExpired] = useState(false);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<Job | null>(null);
  const [sendHouse, setSendHouse] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('job_postings_list', {
      p_review: filter === 'all' ? null : filter,
      p_search: search.trim() || null,
      p_show_expired: showExpired,
    });
    if (err) setError(err.message);
    else setJobs((data as Job[]) ?? []);
    setLoading(false);
  }, [filter, search, showExpired]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    void supabase
      .from('youth_houses')
      .select('id,name')
      .eq('status', 'approved')
      .order('name')
      .then(({ data }) => setHouses((data as HouseOption[]) ?? []));
  }, []);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 5000);
  };

  const save = async () => {
    if (!form) return;
    if (!/^https?:\/\//i.test(form.url.trim())) {
      setError('Link http:// və ya https:// ilə başlamalıdır');
      return;
    }
    if (form.title.trim().length < 3) {
      setError('Vəzifə / başlıq ən azı 3 simvol olmalıdır');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.rpc('job_posting_save', {
      p_id: form.id,
      p_title: form.title,
      p_org: form.organization,
      p_location: form.location,
      p_category: form.category,
      p_deadline: form.deadline || null,
      p_url: form.url,
      p_summary: form.summary,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(null);
    flash('Elan saxlanıldı');
    await load();
  };

  const review = async (job: Job, status: Job['review_status']) => {
    const { error: err } = await supabase.rpc('job_posting_review', { p_id: job.id, p_status: status });
    if (err) setError(err.message);
    else await load();
  };

  const remove = async (job: Job) => {
    if (!window.confirm(`"${job.title}" elanı silinsin?`)) return;
    const { error: err } = await supabase.rpc('job_posting_delete', { p_id: job.id });
    if (err) setError(err.message);
    else await load();
  };

  const send = async (audience: 'all' | 'house') => {
    if (!sending) return;
    if (audience === 'house' && !sendHouse) {
      setError('Gənclər Evini seçin');
      return;
    }
    const target = audience === 'all' ? 'bütün istifadəçilərə' : `"${houses.find(h => h.id === sendHouse)?.name ?? ''}" mərkəzinə`;
    const again = sending.send_count > 0 ? `\n(Bu elan artıq ${sending.send_count} dəfə göndərilib.)` : '';
    if (!window.confirm(`"${sending.title}" ${target} bildiriş kimi göndərilsin?${again}`)) return;
    const { error: err } = await supabase.rpc('job_posting_send', { p_id: sending.id, p_audience: audience, p_house: audience === 'house' ? sendHouse : null });
    if (err) {
      setError(err.message);
      return;
    }
    setSending(null);
    setSendHouse('');
    flash('Bildiriş göndərildi');
    await load();
  };

  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none';

  if (form) {
    return (
      <div className="space-y-3">
        <button onClick={() => setForm(null)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} /> Geri
        </button>
        <h3 className="text-lg font-semibold text-gray-800">{form.id ? 'Elanı redaktə et' : 'Yeni elan'}</h3>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <input className={input} placeholder="Elanın linki (mənbə) *  https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
        <input className={input} placeholder="Vəzifə / başlıq *" maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className={input} placeholder="Təşkilat" maxLength={160} value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Yer (şəhər/rayon)" maxLength={120} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <input className={input} placeholder="Kateqoriya (IT, təhsil...)" maxLength={60} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <input type="date" className={input} value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} aria-label="Son tarix" />
        </div>
        <textarea className={input} rows={4} maxLength={600} placeholder="Qısa xülasə (tam mətni kopyalamayın, mənbəyə link var)" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
        <button onClick={() => void save()} disabled={saving} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? 'Saxlanır...' : 'Yadda saxla'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Vakansiya mərkəzi</h3>
          <p className="text-sm text-gray-500">Elanları toplayın, baxın, uyğun olanları gənclərə göstərin və bildiriş göndərin.</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setForm(emptyForm);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={15} /> Yeni elan
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${input} pl-9`} placeholder="Vəzifə, təşkilat, yer üzrə axtarış..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={input} value={filter} onChange={e => setFilter(e.target.value as Filter)}>
          <option value="all">Bütün statuslar</option>
          <option value="new">Yeni (baxılmayıb)</option>
          <option value="suitable">Uyğundur</option>
          <option value="unsuitable">Uyğun deyil</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} /> Vaxtı bitmişləri də göstər (arxiv)
      </label>

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}
      {!loading && jobs.length === 0 && <p className="text-sm text-gray-500">Elan tapılmadı.</p>}

      {jobs.map(job => (
        <div key={job.id} className={`rounded-xl border bg-white p-4 shadow-sm ${job.expired ? 'border-gray-200 opacity-70' : 'border-gray-200'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{job.title}</p>
              <p className="text-sm text-gray-600">{[job.organization, job.location, job.category].filter(Boolean).join(' · ')}</p>
              <p className={`text-xs ${job.expired ? 'text-rose-600' : 'text-gray-500'}`}>
                {job.deadline ? `Son tarix: ${fmt(job.deadline)}${job.expired ? ' (bitib)' : ''}` : 'Son tarix göstərilməyib'}
                {job.send_count > 0 ? ` · göndərilib: ${job.send_count}× (son: ${fmt(job.sent_at)})` : ''}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REVIEW_TONE[job.review_status]}`}>{REVIEW_LABEL[job.review_status]}</span>
          </div>
          {job.summary && <p className="mt-2 text-sm text-gray-700">{job.summary}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <ExternalLink size={13} /> Mənbəyə get
            </a>
            <button onClick={() => void review(job, 'suitable')} disabled={job.review_status === 'suitable'} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
              <Check size={13} /> Uyğundur
            </button>
            <button onClick={() => void review(job, 'unsuitable')} disabled={job.review_status === 'unsuitable'} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              <X size={13} /> Uyğun deyil
            </button>
            {job.review_status === 'suitable' && !job.expired && (
              <button onClick={() => { setError(null); setSending(sending?.id === job.id ? null : job); }} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                <Send size={13} /> Göndər
              </button>
            )}
            <button
              onClick={() => {
                setError(null);
                setForm({ id: job.id, url: job.url, title: job.title, organization: job.organization ?? '', location: job.location ?? '', category: job.category ?? '', deadline: job.deadline ?? '', summary: job.summary ?? '' });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Pencil size={13} /> Redaktə
            </button>
            <button onClick={() => void remove(job)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
              <Trash2 size={13} /> Sil
            </button>
          </div>

          {sending?.id === job.id && (
            <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="font-semibold text-blue-900">Kimə göndərilsin?</p>
              <button onClick={() => void send('all')} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                Hamıya (gənclər, təlimçilər, rəhbərlər)
              </button>
              <div className="flex gap-2">
                <select className={input} value={sendHouse} onChange={e => setSendHouse(e.target.value)}>
                  <option value="">Gənclər Evini seçin</option>
                  {houses.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => void send('house')} className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                  Mərkəzə göndər
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
