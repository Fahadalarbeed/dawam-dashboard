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

  pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
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

export async function sharePdf(blob, filename) {
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    console.warn('navigator.share unavailable/failed, falling back to download', e);
  }
  downloadBlob(blob, filename);
  return false;
                                      }
