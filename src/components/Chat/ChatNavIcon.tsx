import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Bütün menyu nişanları bir ümumi sorğudan istifadə edir (hər 12 saniyədən bir).
let current = 0;
let timer: number | null = null;
let inflight = false;
const listeners = new Set<(n: number) => void>();

async function refresh() {
  if (inflight) return;
  inflight = true;
  try {
    const { data, error } = await supabase.rpc('chat_unread_total');
    if (!error && typeof data === 'number' && data !== current) {
      current = data;
      listeners.forEach(fn => fn(current));
    }
  } finally {
    inflight = false;
  }
}

/** Çatda mesaj oxunanda və ya göndəriləndə dərhal yeniləmək üçün. */
export function refreshChatUnread() {
  void refresh();
}

function subscribe(fn: (n: number) => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    void refresh();
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 12000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** Menyudakı "Çat" nişanı: oxunmamış mesaj sayı qırmızı dairədə göstərilir. */
export function ChatMenuIcon({ size = 20, className }: { size?: number; className?: string }) {
  const [count, setCount] = useState(current);
  useEffect(() => subscribe(setCount), []);
  return (
    <span className="relative inline-flex">
      <MessageCircle size={size} className={className} />
      {count > 0 && (
        <span className="absolute -right-2.5 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  );
}
