import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => Capacitor.isNativePlatform();

export async function initNativeShell() {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#059669' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Status bar plugin not available; ignore.
  }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setScroll({ isDisabled: false });

    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-visible');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-visible');
    });
  } catch {
    // Keyboard plugin not available; ignore.
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // Splash plugin not available; ignore.
  }

  try {
    const { App: CapApp } = await import('@capacitor/app');
    const { runBackHandlers } = await import('./backHandler');

    CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1) Əvvəlcə ekranların öz geri məntiqi
      if (runBackHandlers()) return;
      // 2) Sonra brauzer tarixçəsi (əgər varsa)
      if (canGoBack) {
        window.history.back();
        return;
      }
      // 3) Heç nə qalmayıbsa — app-dən çıx
      CapApp.exitApp();
    });
  } catch {
    // App plugin not available; ignore.
  }
}
