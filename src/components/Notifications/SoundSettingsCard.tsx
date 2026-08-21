import { Volume2, VolumeX, Play, Check, Loader2 } from 'lucide-react';
import { SOUND_OPTIONS, playSound, useSoundSettings, type SoundId } from '../../lib/api/sound';

/** Bildiriş səsinin açıq/bağlı vəziyyəti və ton seçimi. */
export function SoundSettingsCard() {
  const { settings, loading, saving, save } = useSoundSettings();

  const toggle = () => void save({ ...settings, enabled: !settings.enabled });

  const choose = (sound: SoundId) => {
    playSound(sound);
    void save({ ...settings, sound });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              settings.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {settings.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Bildiriş səsi</h3>
            <p className="text-sm text-gray-500">
              {settings.enabled ? 'Yeni bildiriş gələndə səs çalınır' : 'Səs söndürülüb'}
            </p>
          </div>
        </div>

        <button
          onClick={toggle}
          disabled={loading || saving}
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Bildiriş səsi"
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${
            settings.enabled ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              settings.enabled ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {settings.enabled && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-600">Səsi seçin</p>

          {SOUND_OPTIONS.map(option => {
            const active = settings.sound === option.id;
            return (
              <button
                key={option.id}
                onClick={() => choose(option.id)}
                disabled={saving}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                  active
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      active ? 'text-emerald-800' : 'text-gray-800'
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>

                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {active ? <Check size={15} /> : <Play size={14} />}
                </span>
              </button>
            );
          })}

          <p className="pt-1 text-xs text-gray-400">
            Seçdiyiniz səs dərhal çalınır — bəyənmədiyinizi dəyişə bilərsiniz.
          </p>
        </div>
      )}

      {(loading || saving) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 size={12} className="animate-spin" />
          {loading ? 'Yüklənir...' : 'Saxlanılır...'}
        </p>
      )}
    </div>
  );
}
