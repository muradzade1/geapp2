import { enqueueScan, isNetworkError, readStoredSession } from '../offline';
import { supabase } from '../supabase';

export type ScanResult = {
  direction: 'in' | 'out';
  house_id: string;
  house_name: string;
  at: string;
  duration_minutes?: number;
};

/**
 * QR kodu emal edir.
 *
 * Bir funksiya həm girişi, həm çıxışı idarə edir: açıq ziyarət varsa bağlayır,
 * yoxsa yenisini açır. Gənc "giriş" / "çıxış" seçmir.
 */
async function scanQrOnline(code: string): Promise<ScanResult> {
  const { data, error } = await supabase.rpc('scan_qr', { scanned_code: code });
  if (error) throw new Error(error.message);
  return data as ScanResult;
}

/** Gəncin son ziyarətləri. */
export async function fetchMyVisits(limit = 20) {
  const { data, error } = await supabase
    .from('house_visits')
    .select('id, house_id, entered_at, exited_at, auto_closed')
    .order('entered_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Cari xal balansı. */
export async function fetchMyPoints(): Promise<number> {
  const { data, error } = await supabase.rpc('user_points');
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * Kameranı açıb QR oxuyur.
 *
 * `@capacitor-mlkit/barcode-scanning` yalnız native platformada işləyir.
 * Brauzerdə (veb versiyada) istifadəçidən kodu əl ilə daxil etmək istənilir.
 */
export async function scanWithCamera(): Promise<string | null> {
  const { Capacitor } = await import('@capacitor/core');

  if (!Capacitor.isNativePlatform()) {
    const manual = window.prompt('QR kodu daxil edin:');
    return manual?.trim() || null;
  }

  const { BarcodeScanner, BarcodeFormat } = await import(
    '@capacitor-mlkit/barcode-scanning'
  );

  const supported = await BarcodeScanner.isSupported();
  if (!supported.supported) {
    throw new Error('Bu cihazda QR skan dəstəklənmir');
  }

  const permission = await BarcodeScanner.requestPermissions();
  if (permission.camera !== 'granted' && permission.camera !== 'limited') {
    throw new Error('Kamera icazəsi verilmədi');
  }

  // Google Play Services modulu yalnız Android-də mövcuddur və ilk dəfə endirilməli ola bilər.
  if (Capacitor.getPlatform() === 'android') {
    const available = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  }

  const { barcodes } = await BarcodeScanner.scan({
    formats: [BarcodeFormat.QrCode],
  });

  return barcodes[0]?.rawValue ?? null;
}

// OFFLINE-PATCH: internet yoxdursa skan növbəyə yazılır, internet qayıdanda avtomatik göndərilir.
export type QueuedScanResult = ScanResult & { queued?: boolean; pending?: number };

export async function scanQr(code: string): Promise<QueuedScanResult> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    return await scanQrOnline(code);
  } catch (err) {
    const offlineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (!offlineNow && !isNetworkError(err)) throw err;
    let userId: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user.id;
    } catch {
      userId = undefined;
    }
    if (!userId) userId = readStoredSession()?.user.id;
    if (!userId) throw err;
    const pending = enqueueScan(code, userId);
    return {
      direction: 'in',
      house_id: '',
      house_name: 'Oflayn qeyd — internet gələndə göndəriləcək',
      at: new Date().toISOString(),
      queued: true,
      pending,
    } as QueuedScanResult;
  }
}

/** Android: Google skaner modulunu internet olanda əvvəlcədən yükləyir ki, oflayn işləsin. */
export async function prepareScanner(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'android') return;
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const available = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available.available) await BarcodeScanner.installGoogleBarcodeScannerModule();
  } catch {
    /* vacib deyil */
  }
}
