'use client';
import { DOC_STYLES } from './templates';

// Renders an HTML string (produced by the template builders) into a PDF Blob,
// using a real browser's html2canvas + jsPDF — this only runs client-side.
export async function htmlToPdfBlob(innerHtml, orientation = 'p', scale = 3.5, quality = 0.97) {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '0';
  host.style.zIndex = '-9999';
  host.style.background = '#fff';

  const style = document.createElement('style');
  style.textContent = DOC_STYLES;

  host.appendChild(style);
  host.insertAdjacentHTML('beforeend', innerHtml);
  document.body.appendChild(host);

  const el = host.querySelector('.doc');

  try {
    await Promise.all([
      document.fonts.load('400 16px Cairo'),
      document.fonts.load('700 16px Cairo'),
      document.fonts.load('800 16px Cairo'),
      document.fonts.load('400 16px "IBM Plex Mono"'),
    ]);
    await document.fonts.ready;
  } catch (e) { console.warn('font preload issue', e); }
  await new Promise((r) => setTimeout(r, 300));

  const canvas = await html2canvas(el, {
    scale: scale,
    backgroundColor: '#ffffff',
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  document.body.removeChild(host);

  const imgData = canvas.toDataURL('image/jpeg', quality);
  const pdf = new jsPDF(orientation, 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  const overflowThreshold = 24; // pt — ignore tiny slivers so a near-fit page doesn't spawn an almost-empty extra page

  pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > overflowThreshold) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output('blob');
}

export async function mergePdfBlobs(blobs) {
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  for (const blob of blobs) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const mergedBytes = await merged.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// أسماء الملفات العربية تطلع ملخبطة لما تنشارك للواتساب من الجوال (ترميز الاسم)
// فوقت المشاركة نحوّل الاسم لحروف إنجليزية — الكلمات المعروفة تترجم والباقي يتحول حرف بحرف
const NAME_WORDS = {
  'مولدات': 'Generators', 'الفروانية': 'Farwaniya', 'تقرير': 'Report', 'تقارير': 'Reports', 'ملخص': 'Summary',
  'الأعطال': 'Faults', 'الاعطال': 'Faults', 'أعطال': 'Faults', 'العدادات': 'Meters', 'عدادات': 'Meters',
  'التشغيل': 'Operations', 'تشغيل': 'Operations', 'بلاغات': 'Complaints', 'البلاغات': 'Complaints', 'بلاغ': 'Complaint',
  'تفاصيل': 'Details', 'المتكررة': 'Repeated', 'المحطات': 'Stations', 'حسب': 'by', 'المنطقة': 'Area',
  'نتائج': 'Results', 'البحث': 'Search', 'مجمعة': 'Combined', 'يومي': 'Daily', 'مدمج': 'Merged',
  'إحصائية': 'Stats', 'المحروقة': 'Burnt', 'العطل': 'Fault', 'المواد': 'Materials', 'مواد': 'Materials',
};
const LETTERS = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ء': '', 'ؤ': 'o', 'ئ': 'e',
};
export function asciiFileName(name) {
  const m = String(name || 'file').match(/^(.*?)(\.[A-Za-z0-9]+)?$/);
  let base = m[1];
  const ext = m[2] || '.pdf';
  base = base.split(/([\s_\-]+)/).map((w) => NAME_WORDS[w] || w).join('');
  base = base.replace(/[؀-ۿ]/g, (c) => LETTERS[c] ?? '');
  base = base.replace(/[^\w\-.]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return (base || 'file') + ext;
}

export async function sharePdf(blob, filename) {
  try {
    const file = new File([blob], asciiFileName(filename), { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return true;
    }
  } catch (e) {
    console.warn('navigator.share unavailable/failed, falling back to download', e);
  }
  downloadBlob(blob, filename);
  return false;
}
