import { useCallback, useEffect, useState } from 'react';
import { Gift, Loader2, Ticket, Coins } from 'lucide-react';
import { relativeTime } from '../../lib/api/content';
import { fetchMyPoints } from '../../lib/api/qr';
import {
  STATUS_LABEL,
  cancelRedemption,
  fetchAvailableRewards,
  fetchMyBalance,
  fetchMyRedemptions,
  redeemReward,
  type Redemption,
  type Reward,
} from '../../lib/api/rewards';

const STATUS_STYLE: Record<Redemption['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

/** Gəncin xalı hədiyyəyə çevirdiyi səhifə: balans, kataloq, kuponlar. */
export default function RewardsPage() {
  const [balance, setBalance] = useState(0);
  const [earned, setEarned] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [coupons, setCoupons] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, e, r, c] = await Promise.all([
        fetchMyBalance(),
        fetchMyPoints(),
        fetchAvailableRewards(),
        fetchMyRedemptions(),
      ]);
      setBalance(b);
      setEarned(e);
      setRewards(r);
      setCoupons(c);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumat yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const redeem = async (reward: Reward) => {
    if (!window.confirm(`"${reward.title}" üçün ${reward.cost} xal xərclənsin?`)) return;
    setBusyId(reward.id);
    setError(null);
    setNotice(null);
    try {
      const res = await redeemReward(reward.id);
      setNotice(
        `Kuponunuz hazırdır. Kod: ${res.code}. ` +
          (res.house_name ? `${res.house_name} mərkəzində ` : 'Mərkəzdə ') +
          'bu kodu göstərib hədiyyənizi alın.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat alınmadı');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (c: Redemption) => {
    if (!window.confirm('Kupon ləğv edilsin? Xalınız geri qaytarılacaq.')) return;
    setBusyId(c.id);
    setError(null);
    try {
      await cancelRedemption(c.id);
      setNotice('Kupon ləğv edildi, xalınız geri qaytarıldı.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ləğv alınmadı');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-emerald-100">
          <Coins size={18} />
          <span className="text-sm">Xərcləyə biləcəyiniz xal</span>
        </div>
        <p className="mt-1 text-4xl font-bold">{balance}</p>
        <p className="mt-1 text-xs text-emerald-100">
          Ümumi qazandığınız: {earned} xal. Xərclədiyiniz xal səviyyənizi və reytinqinizi azaltmır.
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <Gift size={18} /> Hədiyyələr
        </h2>
        {rewards.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
            Hələ hədiyyə əlavə olunmayıb.
          </div>
        )}
        {rewards.map(r => {
          const soldOut = r.stock !== null && r.stock <= 0;
          const short = balance < r.cost;
          const disabled = soldOut || short || busyId === r.id;
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{r.title}</p>
                {r.description && <p className="text-sm text-gray-600">{r.description}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  {r.house_id ? r.youth_houses?.name ?? 'Mərkəz' : 'Ümumi'} ·{' '}
                  {r.stock === null ? 'Limitsiz' : soldOut ? 'Bitib' : `Qalıb: ${r.stock}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{r.cost} xal</span>
                <button
                  onClick={() => void redeem(r)}
                  disabled={disabled}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {busyId === r.id ? <Loader2 size={15} className="animate-spin" /> : soldOut ? 'Bitib' : short ? 'Xal çatmır' : 'Al'}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <Ticket size={18} /> Kuponlarım
        </h2>
        {coupons.length === 0 && <p className="text-sm text-gray-500">Hələ kuponunuz yoxdur.</p>}
        {coupons.map(c => (
          <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{c.reward_title}</p>
                <p className="text-xs text-gray-500">
                  {c.youth_houses?.name ?? 'Mərkəz'} · {c.cost} xal · {relativeTime(c.created_at)}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            {c.status === 'pending' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Mərkəzdə bu kodu göstərin</p>
                  <p className="font-mono text-3xl font-bold tracking-[0.3em] text-emerald-700">{c.code}</p>
                </div>
                <button
                  onClick={() => void cancel(c)}
                  disabled={busyId === c.id}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  Ləğv et
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
