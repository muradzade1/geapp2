import { useCallback, useEffect, useState } from 'react';
import { Bell, Send, Trash2, Loader2, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { relativeTime } from '../../lib/api/content';

interface Props {
  houseId: string | null;
}

type SentRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  recipients: number;
};

const TYPES = [
  { value: 'system', label: 'Elan' },
  { value: 'event', label: 'Tədbir' },
  { value: 'reminder', label: 'Xatırlatma' },
];

/**
 * Mərkəzin öz üzvlərinə bildiriş göndərməsi.
 *
 * Bildiriş yalnız bu Gənclər Evinə bağlı gənclərə çatır — platforma üzrə
 * bildirişi yalnız administrator göndərə bilər.
 */
export function HouseNotifications({ houseId }: Props) {
  const [rows, setRows] = useState<SentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('system');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.rpc('house_notifications', {
      target_house: houseId,
      limit_count: 50,
    });
    if (err) setError(err.message);
    else {
      setRows((data as SentRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!houseId) return;
    if (!title.trim() || !message.trim()) {
      setError('Başlıq və mətn mütləqdir');
      return;
    }

    setSending(true);
    setError(null);

    const { data: session } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('notifications').insert({
      title: title.trim(),
      message: message.trim(),
      type,
      house_id: houseId,
      user_id: null,
      created_by: session.user?.id ?? null,
    });

    if (err) setError(err.message);
    else {
      setTitle('');
      setMessage('');
      await load();
    }
    setSending(false);
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const { error: err } = await supabase.from('notifications').delete().eq('id', id);
    if (err) setError(err.message);
    else setRows(current => current.filter(row => row.id !== id));
    setBusyId(null);
  };

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra bildiriş göndərə biləcəksiniz.
      </div>
    );
  }

  const recipients = rows[0]?.recipients ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Bildirişlər</h3>
          <p className="text-sm text-gray-500">
            Yalnız mərkəzinizə bağlı gənclərə çatır
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yenilə
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Yeni bildiriş */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-600">Başlıq</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-600">Mətn</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-600">Növ</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          >
            {TYPES.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <p className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Users size={13} />
          Mərkəzinizə bağlı {recipients} gəncə göndəriləcək
        </p>

        <button
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Göndər
        </button>
      </div>

      {/* Göndərilənlər */}
      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Bell className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Hələ bildiriş göndərməmisiniz.</p>
        </div>
      )}

      {rows.map(row => (
        <div
          key={row.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">{row.title}</p>
            <p className="mt-0.5 text-sm text-gray-600">{row.message}</p>
            <p className="mt-1 text-xs text-gray-400">{relativeTime(row.created_at)}</p>
          </div>
          <button
            onClick={() => void remove(row.id)}
            disabled={busyId === row.id}
            className="shrink-0 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            {busyId === row.id ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
