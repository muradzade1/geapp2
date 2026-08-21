import { useEffect } from 'react';

/**
 * Geri düyməsi üçün handler yığını (stack).
 *
 * Hər ekran/komponent öz "geri" məntiqini qeydiyyatdan keçirir.
 * Android geri düyməsi basılanda ən son qeydiyyatdan keçən handler
 * birinci çağırılır. Handler `true` qaytarsa — hadisə emal olundu,
 * `false` qaytarsa — növbəti (daha alt) handler-ə ötürülür.
 * Heç biri emal etməsə, app bağlanır.
 */

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

export function registerBackHandler(fn: BackHandler): () => void {
  handlers.push(fn);
  return () => {
    const index = handlers.lastIndexOf(fn);
    if (index !== -1) handlers.splice(index, 1);
  };
}

/** Qeydiyyatdan keçmiş handler-ləri sondan əvvələ doğru yoxlayır. */
export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true;
    } catch {
      // Bir handler xəta versə, digərləri işləməyə davam etsin.
    }
  }
  return false;
}

/**
 * React hook.
 *
 * İstifadə:
 *   useBackHandler(() => {
 *     if (modalOpen) { setModalOpen(false); return true; }
 *     if (view !== 'dashboard') { setView('dashboard'); return true; }
 *     return false;
 *   });
 *
 * Qeyd: dependency array qəsdən yoxdur — hər render-də yenidən
 * qeydiyyatdan keçir ki, handler həmişə ən son state-i görsün.
 */
export function useBackHandler(fn: BackHandler): void {
  useEffect(() => registerBackHandler(fn));
}
