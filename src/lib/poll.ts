/**
 * Dövri yeniləmə: tətbiq arxa planda olanda (səhifə gizlidirsə) sorğu göndərmir,
 * yenidən görünəndə dərhal bir dəfə yeniləyir. Bu, lazımsız trafikin qarşısını alır.
 * Qaytardığı funksiya yeniləməni dayandırır.
 */
export function startPolling(run: () => void, intervalMs: number): () => void {
  let timer: number | undefined;

  const start = () => {
    if (timer === undefined) timer = window.setInterval(run, intervalMs);
  };
  const stop = () => {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
  const onVisibility = () => {
    if (document.hidden) {
      stop();
    } else {
      run();
      start();
    }
  };

  if (!document.hidden) start();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
