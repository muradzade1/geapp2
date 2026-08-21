import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { uploadImage, imageUrl, removeImage } from '../../lib/api/upload';

interface Props {
  label?: string;
  /** Storage-də alt qovluq: 'events', 'news', 'partners' */
  folder: string;
  /** Saxlanılan yol (`null` — şəkil yoxdur) */
  value: string | null;
  onChange: (path: string | null) => void;
}

/** Şəkil seçmə, yükləmə və önizləmə sahəsi. */
export function ImageUploadField({ label = 'Şəkil', folder, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = imageUrl(value);

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      // Köhnə şəkil varsa, yenisi uğurlu olandan sonra silinir.
      const previous = value;
      const path = await uploadImage(file, folder);
      onChange(path);
      if (previous) await removeImage(previous);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şəkil yüklənmədi');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = async () => {
    const previous = value;
    onChange(null);
    await removeImage(previous);
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-600">{label}</label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={pick}
        className="hidden"
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-gray-200">
          <img src={preview} alt="" className="h-40 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow hover:bg-white disabled:opacity-60"
            >
              Dəyiş
            </button>
            <button
              type="button"
              onClick={() => void clear()}
              disabled={busy}
              className="rounded-lg bg-white/90 p-1.5 text-rose-600 shadow hover:bg-white disabled:opacity-60"
              aria-label="Şəkli sil"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <ImagePlus size={22} className="text-gray-400" />
          )}
          {busy ? 'Yüklənir...' : 'Şəkil seçin'}
          <span className="text-xs text-gray-400">JPG, PNG və ya WEBP · 5 MB-a qədər</span>
        </button>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-rose-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
