import { useEffect, useState } from 'react';
import type { SyncResult } from '../../lib/offline';

/** Oflayn qeydlər sistemə göndəriləndə qısa bildiriş göstərir. */
export function SyncToast() {
  const [text, setText] = useState('');

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SyncResult>).detail;
      if (!detail) return;
      const parts: string[] = [];
      if (detail.sent > 0) parts.push(detail.sent + ' oflayn qeyd sistemə göndərildi.');
      if (detail.failed.length > 0) parts.push(detail.failed.length + ' qeyd qəbul olunmadı.');
      if (parts.length === 0) return;
      setText(parts.join(' '));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setText(''), 6000);
    };
    window.addEventListener('offline-sync-result', handler);
    return () => {
      window.removeEventListener('offline-sync-result', handler);
      window.clearTimeout(timer);
    };
  }, []);

  if (!text) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-[100] w-[90%] max-w-sm -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm text-white shadow-lg">
      {text}
    </div>
  );
}
