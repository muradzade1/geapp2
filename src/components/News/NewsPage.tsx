import { useState } from 'react';
import { Newspaper, Calendar, User, ChevronRight, X } from 'lucide-react';
import { useNews, relativeTime, type NewsItem } from '../../lib/api/content';
import { imageUrl } from '../../lib/api/upload';

export function NewsPage() {
  const { items, loading, error } = useNews();
  const [open, setOpen] = useState<NewsItem | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-sky-200" />
            <h1 className="text-3xl font-bold text-white">Xəbərlər</h1>
          </div>
          <p className="text-lg text-sky-100">Ən son elanlar və yeniliklər</p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl space-y-4 px-4 sm:px-6">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Xəbərlər yüklənmədi: {error}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <Newspaper className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">
              Hələ xəbər yoxdur. Yeni elanlar burada görünəcək.
            </p>
          </div>
        )}

        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setOpen(item)}
            className="flex w-full items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
          >
            {imageUrl(item.image_path) && (
              <img
                src={imageUrl(item.image_path) as string}
                alt=""
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <span className="mb-2 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                {item.category}
              </span>
              <h3 className="font-bold text-gray-800">{item.title}</h3>
              {item.short_description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                  {item.short_description}
                </p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {relativeTime(item.published_at)}
                </span>
                {item.author && (
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    {item.author}
                  </span>
                )}
              </p>
            </div>
            <ChevronRight size={18} className="mt-1 shrink-0 text-gray-300" />
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
              <div className="min-w-0">
                <span className="mb-1 inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                  {open.category}
                </span>
                <h3 className="font-bold text-gray-800">{open.title}</h3>
                <p className="text-xs text-gray-400">
                  {new Date(open.published_at).toLocaleDateString('az-AZ', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {open.author && ` · ${open.author}`}
                </p>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {imageUrl(open.image_path) && (
              <img
                src={imageUrl(open.image_path) as string}
                alt=""
                className="h-56 w-full object-cover"
              />
            )}

            <div className="whitespace-pre-line px-5 py-5 text-sm leading-relaxed text-gray-700">
              {open.full_text || open.short_description || 'Mətn əlavə olunmayıb.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewsPage;
