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
export async function scanQr(code: string): Promise<ScanResult> {
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

  // Google Play Services modulu ilk dəfə endirilməli ola bilər.
  const available = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available.available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
  }

  const { barcodes } = await BarcodeScanner.scan({
    formats: [BarcodeFormat.QrCode],
  });

  return barcodes[0]?.rawValue ?? null;
}
