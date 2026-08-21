import { useState } from 'react';
import { Newspaper, Bell, Plus, Trash2, X, Loader2, Send } from 'lucide-react';
import { useNews, useNotifications, relativeTime } from '../../lib/api/content';
import { ImageUploadField } from '../shared/ImageUploadField';
import {
  createNews,
  deleteNews,
  createBroadcast,
  deleteNotification,
} from '../../lib/api/reports';

const NEWS_CATEGORIES = ['Xəbər', 'Elan', 'Tədbir', 'Layihə', 'Digər'];
const NOTIFICATION_TYPES = [
  { value: 'system', label: 'Sistem' },
  { value: 'event', label: 'Tədbir' },
  { value: 'news', label: 'Xəbər' },
  { value: 'reminder', label: 'Xatırlatma' },
];

/**
 * Admin panelində məzmun idarəsi.
 *
 * Bildiriş kütləvi göndərilir — bütün istifadəçilər görür.
 */
export function ContentManager() {
  const [tab, setTab] = useState<'news' | 'notifications'>('news');

  const { items: news, loading: newsLoading, reload: reloadNews } = useNews(50);
  const {
    items: notifications,
    loading: notificationsLoading,
    reload: reloadNotifications,
  } = useNotifications();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newsForm, setNewsForm] = useState({
    title: '',
    category: NEWS_CATEGORIES[0],
    short_description: '',
    full_text: '',
    author: '',
  });
  const [newsImage, setNewsImage] = useState<string | null>(null);

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'system',
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (tab === 'news') {
        if (!newsForm.title.trim()) throw new Error('Başlıq mütləqdir');
        await createNews({
          title: newsForm.title.trim(),
          category: newsForm.category,
          short_description: newsForm.short_description.trim() || undefined,
          full_text: newsForm.full_text.trim() || undefined,
          author: newsForm.author.trim() || undefined,
          image_path: newsImage,
        });
        setNewsForm({ ...newsForm, title: '', short_description: '', full_text: '' });
        setNewsImage(null);
        await reloadNews();
      } else {
        if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
          throw new Error('Başlıq və mətn mütləqdir');
        }
        await createBroadcast({
          title: notificationForm.title.trim(),
          message: notificationForm.message.trim(),
          type: notificationForm.type,
        });
        setNotificationForm({ ...notificationForm, title: '', message: '' });
        await reloadNotifications();
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yaradıla bilmədi');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      if (tab === 'news') {
        await deleteNews(id);
        await reloadNews();
      } else {
        await deleteNotification(id);
        await reloadNotifications();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinə bilmədi');
    } finally {
      setBusyId(null);
    }
  };

  const input = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    multiline = false,
  ) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-600">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            { key: 'news' as const, label: 'Xəbərlər', icon: Newspaper },
            { key: 'notifications' as const, label: 'Bildirişlər', icon: Bell },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => {
                setTab(item.key);
                setShowForm(false);
                setError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? 'bg-rose-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Bağla' : tab === 'news' ? 'Yeni xəbər' : 'Yeni bildiriş'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {tab === 'news' ? (
            <>
              {input('Başlıq', newsForm.title, v => setNewsForm({ ...newsForm, title: v }))}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Kateqoriya
                </label>
                <select
                  value={newsForm.category}
                  onChange={e => setNewsForm({ ...newsForm, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  {NEWS_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {input('Qısa təsvir', newsForm.short_description, v =>
                setNewsForm({ ...newsForm, short_description: v }),
              )}
              {input('Tam mətn', newsForm.full_text, v =>
                setNewsForm({ ...newsForm, full_text: v }), true,
              )}
              {input('Müəllif', newsForm.author, v => setNewsForm({ ...newsForm, author: v }))}
              <ImageUploadField
                label="Xəbər şəkli"
                folder="news"
                value={newsImage}
                onChange={setNewsImage}
              />
            </>
          ) : (
            <>
              {input('Başlıq', notificationForm.title, v =>
                setNotificationForm({ ...notificationForm, title: v }),
              )}
              {input('Mətn', notificationForm.message, v =>
                setNotificationForm({ ...notificationForm, message: v }), true,
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">Növ</label>
                <select
                  value={notificationForm.type}
                  onChange={e =>
                    setNotificationForm({ ...notificationForm, type: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  {NOTIFICATION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Bildiriş bütün istifadəçilərə göndəriləcək.
              </p>
            </>
          )}

          <button
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {tab === 'news' ? 'Dərc et' : 'Göndər'}
          </button>
        </div>
      )}

      {(newsLoading || notificationsLoading) && (
        <p className="text-sm text-gray-500">Yüklənir...</p>
      )}

      {tab === 'news' &&
        !newsLoading &&
        (news.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <Newspaper className="mx-auto mb-3 text-gray-300" size={32} />
            <p className="text-sm text-gray-500">Hələ xəbər dərc olunmayıb.</p>
          </div>
        ) : (
          news.map(item => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <span className="mb-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {item.category}
                </span>
                <p className="font-semibold text-gray-800">{item.title}</p>
                {item.short_description && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                    {item.short_description}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {relativeTime(item.published_at)}
                  {item.author && ` · ${item.author}`}
                </p>
              </div>
              <button
                onClick={() => void remove(item.id)}
                disabled={busyId === item.id}
                className="shrink-0 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                {busyId === item.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </div>
          ))
        ))}

      {tab === 'notifications' &&
        !notificationsLoading &&
        (notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <Bell className="mx-auto mb-3 text-gray-300" size={32} />
            <p className="text-sm text-gray-500">Hələ bildiriş göndərilməyib.</p>
          </div>
        ) : (
          notifications.map(item => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{item.title}</p>
                <p className="mt-0.5 text-sm text-gray-600">{item.message}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {relativeTime(item.created_at)}
                </p>
              </div>
              <button
                onClick={() => void remove(item.id)}
                disabled={busyId === item.id}
                className="shrink-0 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                {busyId === item.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </div>
          ))
        ))}
    </div>
  );
}
