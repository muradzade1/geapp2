import { useState } from 'react';
import { UserPlus, Trash2, RefreshCw, Users, Loader2, X } from 'lucide-react';
import { useHouseTeam, addTrainer, removeTrainer } from '../../lib/api/trainer';

interface Props {
  houseId: string | null;
}

/**
 * Mərkəzin təlimçi komandası.
 *
 * Təlimçi yalnız komandasında olduğu mərkəzdə tədbir yarada bilər — bu qayda
 * bazada RLS səviyyəsində tətbiq olunur, ona görə siyahıdan çıxarılan təlimçi
 * dərhal həmin imkanı itirir.
 */
export function HouseTrainersManager({ houseId }: Props) {
  const { team, available, loading, error, reload } = useHouseTeam(houseId);
  const [showPicker, setShowPicker] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const add = async (trainerId: string) => {
    if (!houseId) return;
    setBusyId(trainerId);
    setActionError(null);
    try {
      await addTrainer(houseId, trainerId);
      await reload();
      setShowPicker(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Əlavə edilmədi');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (trainerId: string) => {
    if (!houseId) return;
    setBusyId(trainerId);
    setActionError(null);
    try {
      await removeTrainer(houseId, trainerId);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Çıxarıla bilmədi');
    } finally {
      setBusyId(null);
    }
  };

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra təlimçi əlavə edə biləcəksiniz.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Təlimçilər</h3>
          <p className="text-sm text-gray-500">{team.length} təlimçi komandada</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void reload()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
          >
            <RefreshCw size={15} />
            Yenilə
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <UserPlus size={15} />
            Təlimçi əlavə et
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError ?? error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && team.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Users className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Komandanızda hələ təlimçi yoxdur. Təlimçi əlavə edin ki, mərkəzinizdə
            tədbir yarada bilsin.
          </p>
        </div>
      )}

      {team.map(member => (
        <div
          key={member.trainer_id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">
              {member.full_name ?? 'Ad göstərilməyib'}
            </p>
            <p className="text-sm text-gray-500">
              {[member.specialization, member.email, member.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {member.events_count} tədbir keçirib
            </p>
          </div>
          <button
            onClick={() => void remove(member.trainer_id)}
            disabled={busyId === member.trainer_id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            {busyId === member.trainer_id ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            Çıxar
          </button>
        </div>
      ))}

      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h4 className="font-semibold text-gray-800">Təlimçi əlavə et</h4>
                <p className="text-sm text-gray-500">
                  Təsdiqlənmiş təlimçilər siyahısı
                </p>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {available.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-gray-500">
                Əlavə edilə biləcək təlimçi yoxdur. Təlimçi əvvəlcə qeydiyyatdan
                keçib administrator tərəfindən təsdiqlənməlidir.
              </p>
            )}

            <div className="divide-y divide-gray-50">
              {available.map(trainer => (
                <div
                  key={trainer.trainer_id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {trainer.full_name ?? 'Ad göstərilməyib'}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[trainer.specialization, trainer.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => void add(trainer.trainer_id)}
                    disabled={busyId === trainer.trainer_id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busyId === trainer.trainer_id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    Əlavə et
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
