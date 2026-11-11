import { Capacitor } from '@capacitor/core';

/**
 * Excel (.xlsx) və PDF ixracı.
 * Veb-də fayl birbaşa yüklənir, telefonda (Android/iOS) "Paylaş" menyusu açılır:
 * oradan "Faylları saxla", WhatsApp, e-poçt və s. seçilir.
 */

export type ExportCell = string | number | null | undefined;

export interface ExportTable {
  /** Fayl adı (uzantısız). */
  fileName: string;
  /** Sənədin başlığı (PDF-də başlıq, Excel-də birinci sətir). */
  title: string;
  /** Başlığın altındakı izahlı sətirlər (məs. tarix, mərkəz). */
  info?: string[];
  columns: { header: string; width?: number }[];
  rows: ExportCell[][];
}

function safeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'siyahi';
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Fayl oxunmadı'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function saveBlob(fileName: string, blob: Blob): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    try {
      await Share.share({ title: fileName, url: written.uri, dialogTitle: 'Faylı saxla və ya göndər' });
    } catch (err) {
      // İstifadəçi paylaşma pəncərəsini bağlayıb: xəta deyil.
      const text = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(text)) throw err;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportXlsx(table: ExportTable): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const colCount = Math.max(table.columns.length, 1);
  const data: unknown[][] = [];
  data.push([{ value: table.title, fontWeight: 'bold', fontSize: 14, columnSpan: colCount }]);
  for (const line of table.info ?? []) {
    data.push([{ value: line, columnSpan: colCount }]);
  }
  data.push([]);
  data.push(
    table.columns.map(column => ({
      value: column.header,
      fontWeight: 'bold',
      backgroundColor: '#E5E7EB',
      borderStyle: 'thin',
    })),
  );
  for (const row of table.rows) {
    data.push(
      table.columns.map((_, index) => {
        const value = row[index];
        if (value === null || value === undefined || value === '') return { value: '', borderStyle: 'thin' };
        if (typeof value === 'number') return { value, type: Number, borderStyle: 'thin' };
        return { value: String(value), type: String, borderStyle: 'thin' };
      }),
    );
  }
  const blob = await writeExcelFile(data as never, {
    sheet: 'Siyahı',
    columns: table.columns.map(column => ({ width: column.width ?? 18 })),
  } as never).toBlob();
  await saveBlob(`${safeName(table.fileName)} ${stamp()}.xlsx`, blob);
}

export async function exportPdf(table: ExportTable): Promise<void> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const maker = pdfMake as unknown as {
    addVirtualFileSystem?: (files: unknown) => void;
    vfs?: unknown;
    createPdf: (doc: unknown) => { getBlob: () => Promise<Blob> };
  };
  if (typeof maker.addVirtualFileSystem === 'function') maker.addVirtualFileSystem(vfs);
  else maker.vfs = vfs;

  const landscape = table.columns.length > 5;
  // Sütun enləri səhifənin faydalı enindən (A4) artıq olmasın deyə mütənasib kiçildilir.
  const available = (landscape ? 842 : 595) - 64 - table.columns.length * 8 - 4;
  const raw = table.columns.map(column => Math.max((column.width ?? 18) * 4.2, 24));
  const total = raw.reduce((sum, value) => sum + value, 0);
  const factor = total > available ? available / total : 1;
  const widths = raw.map(value => Math.floor(value * factor));
  const fontSize = table.columns.length > 9 ? 7 : table.columns.length > 6 ? 8 : 9;
  const header = table.columns.map(column => ({ text: column.header, bold: true, fillColor: '#E5E7EB' }));
  const body = [
    header,
    ...table.rows.map(row => table.columns.map((_, index) => String(row[index] ?? ''))),
  ];
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [32, 36, 32, 40],
    defaultStyle: { font: 'Roboto', fontSize },
    content: [
      { text: table.title, fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
      ...(table.info ?? []).map(line => ({ text: line, color: '#4B5563', margin: [0, 0, 0, 1] })),
      { text: '', margin: [0, 0, 0, 6] },
      {
        table: { headerRows: 1, widths, body },
        layout: { hLineColor: () => '#D1D5DB', vLineColor: () => '#D1D5DB' },
      },
    ],
    footer: (page: number, pages: number) => ({
      text: `${page} / ${pages}`,
      alignment: 'right',
      margin: [0, 10, 32, 0],
      fontSize: 8,
      color: '#6B7280',
    }),
  };
  const blob = await maker.createPdf(docDefinition).getBlob();
  await saveBlob(`${safeName(table.fileName)} ${stamp()}.pdf`, blob);
}
