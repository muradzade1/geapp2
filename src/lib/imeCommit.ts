/**
 * Android klaviaturalarında (WebView) yazılmaqda olan sonuncu hərf (məs. "ə", "ı")
 * input-un DOM dəyərində görünsə də, React state-ə çatmaya bilir və düyməyə basanda
 * itir (Məmmədzadə → Məmmədzad). Bu qoruyucu bütün tətbiq üçün bir dəfə qurulur:
 * düyməyə basılanda və ya Enter-dən əvvəl aktiv xananın cari DOM dəyəri
 * React-ə yenidən "input" hadisəsi ilə ötürülür.
 */

const ACTION_SELECTOR = 'button, a[href], [role="button"], input[type="submit"], input[type="button"], summary, label';

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(el.type);
}

/** Xananın cari DOM dəyərini React-in dəyər izləyicisini keçərək yenidən göndərir. */
function resyncField(el: HTMLInputElement | HTMLTextAreaElement) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) return;
  setter.call(el, el.value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function commitActiveField(blur: boolean) {
  const el = document.activeElement;
  if (!isTextField(el)) return;
  if (blur) el.blur(); // yazılmaqda olan hərfi tamamlayır
  resyncField(el);
}

let installed = false;

export function installImeCommitGuard() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || isTextField(target)) return;
      if (!target.closest(ACTION_SELECTOR)) return;
      commitActiveField(true);
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      commitActiveField(false);
    },
    true,
  );

  // Form hər hansı yolla göndərilərsə, son çarə kimi hamısını yenidən sinxronlaşdır.
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((el) => {
        if (isTextField(el)) resyncField(el);
      });
    },
    true,
  );
}
