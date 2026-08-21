import { useMemo, useState } from 'react';
import { QrCode, RefreshCw, LogIn, LogOut } from 'lucide-react';
import { useAdminVisitLogs } from '../../lib/api/adminLogs';
import { formatDuration, dateClock, clock } from '../../lib/api/stats';

type Filter = 'all' | 'inside' | 'closed' | 'auto';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Hamısı' },
  { key: 'inside', label: 'Hazırda içəridə' },
  { key: 'closed', label: 'Çıxıb' },
  { key: 'auto', label: 'Avtomatik bağlanıb' },
];

/** Platforma üzrə bütün giriş-çıxış qeydləri. */
export function AdminQrLogs() {
  const { rows, loading, error, reload } = useAdminVisitLogs(300);
  const [filter, setFilter] = useState<Filter>('all');
  const [house, setHouse] = useState('Hamısı');

  const houses = useMemo(
    () => ['Hamısı', ...Array.from(new Set(rows.map(r => r.house_name ?? '—'))).sort()],
    [rows],
  );

  const visible = rows.filter(row => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'inside' && row.is_inside) ||
      (filter === 'closed' && !row.is_inside && !row.auto_closed) ||
      (filter === 'auto' && row.auto_closed);
    const matchesHouse = house === 'Hamısı' || (row.house_name ?? '—') === house;
    return matchesFilter && matchesHouse;
  });

  const insideNow = rows.filter(r => r.is_inside).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">QR skan logları</h3>
          <p className="text-sm text-gray-500">
            {rows.length} qeyd · hazırda içəridə {insideNow} nəfər
          </p>
        </div>
        <button
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yenilə
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(item => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === item.key
                ? 'bg-rose-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600'
            }`}
          >
            {item.label}
          </button>
        ))}

        {houses.length > 2 && (
          <select
            value={house}
            onChange={e => setHouse(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
          >
            {houses.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <QrCode className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Hələ QR skan qeydi yoxdur. Gənclər mərkəzlərə daxil olduqca burada
            görünəcək.
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">İstifadəçi</th>
                <th className="px-4 py-3">Gənclər Evi</th>
                <th className="px-4 py-3">Giriş</th>
                <th className="px-4 py-3">Çıxış</th>
                <th className="px-4 py-3">Müddət</th>
                <th className="px-4 py-3 text-center">Xal</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(row => (
                <tr key={row.visit_id} className="transition hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {row.full_name ?? 'Ad göstərilməyib'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {row.house_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {dateClock(row.entered_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {row.exited_at ? clock(row.exited_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDuration(row.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-amber-600">
                    {row.points_awarded > 0 ? `+${row.points_awarded}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.is_inside ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <LogIn size={12} />
                        Məkanda
                      </span>
                    ) : row.auto_closed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Avtomatik bağlanıb
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <LogOut size={12} />
                        Çıxıb
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
