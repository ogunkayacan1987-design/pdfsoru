import { jsPDF } from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { Fis } from './api';

const W = 297;
const H = 210;
const HALF = W / 2;

function trDate(iso: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  if (!text) return [''];
  return doc.splitTextToSize(text, maxW) as string[];
}

function nusha(doc: jsPDF, x: number, fis: Fis, etiket: string) {
  const PAD = 7;
  const W2 = HALF - PAD * 2;
  const NAVY: [number, number, number] = [30, 58, 138];
  const RED: [number, number, number] = [185, 28, 28];
  const GREY: [number, number, number] = [100, 116, 139];

  // Header background mark for "03"
  doc.setFillColor(...NAVY);
  doc.rect(x + PAD, PAD, 8, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('03', x + PAD + 4, PAD + 5.5, { align: 'center' });

  // ÖNEL BİLİŞİM
  doc.setTextColor(...NAVY);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('ONEL BILISIM', x + PAD + 10, PAD + 6);

  // Sub
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('Furkan ONEL  -  0537 846 03 77', x + PAD, PAD + 12);

  // Title right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('SERVIS FISI', x + HALF - PAD, PAD + 6, { align: 'right' });

  // Copy label
  doc.setFontSize(8);
  doc.setTextColor(...RED);
  const labelW = doc.getTextWidth(etiket) + 4;
  doc.setDrawColor(...RED);
  doc.rect(x + HALF - PAD - labelW, PAD + 8, labelW, 5);
  doc.text(etiket, x + HALF - PAD - 2, PAD + 11.5, { align: 'right' });

  // Header divider
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(x + PAD, PAD + 15, x + HALF - PAD, PAD + 15);

  // Field rows
  let y = PAD + 22;
  const colW = (W2 - 4) / 2;

  const drawField = (lx: number, ly: number, w: number, label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), lx, ly);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(value || '', lx, ly + 5, { maxWidth: w });
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(lx, ly + 6.5, lx + w, ly + 6.5);
  };

  drawField(x + PAD, y, colW, 'Musteri / Firma', fis.musteri);
  drawField(x + PAD + colW + 4, y, colW, 'Telefon', fis.telefon);
  y += 12;

  drawField(x + PAD, y, colW, 'Tarih', trDate(fis.tarih));
  drawField(x + PAD + colW + 4, y, colW, 'Cihaz / Urun', fis.cihaz);
  y += 12;

  // Sorun box
  const drawBox = (lx: number, ly: number, w: number, h: number, label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), lx, ly);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.rect(lx, ly + 1.5, w, h);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    const lines = wrap(doc, value || '', w - 3);
    doc.text(lines, lx + 1.5, ly + 6);
  };

  drawBox(x + PAD, y, W2, 36, 'Musteri Sorunu / Yapilacak Isler', fis.sorun);
  y += 41;

  drawBox(x + PAD, y, W2, 28, 'Yapilan Is ve Islemler', fis.yapilanIs);
  y += 33;

  // Ücret
  drawField(x + PAD, y, colW, 'Ucret (TL)', fis.ucret);
  y += 12;

  // Note + signatures
  doc.setFontSize(7);
  doc.setTextColor(70, 85, 100);
  const note = 'Yukarida belirtilen cihaz/urunu yukaridaki sikayet ve islemler dogrultusunda teslim ettim/aldim. Cihaz 30 gun icinde teslim alinmadigi takdirde dogacak sorumluluk musteriye aittir.';
  doc.text(wrap(doc, note, W2), x + PAD, H - 32);

  // Signatures
  const sigY = H - 12;
  const sigW = (W2 - 6) / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(x + PAD, sigY, x + PAD + sigW, sigY);
  doc.line(x + PAD + sigW + 6, sigY, x + PAD + W2, sigY);
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('Teslim Eden (Musteri)', x + PAD + sigW / 2, sigY + 4, { align: 'center' });
  doc.text('Teslim Alan: ' + (fis.yetkili || ''), x + PAD + sigW + 6 + sigW / 2, sigY + 4, { align: 'center' });
}

export function fisPdfOlustur(fis: Fis): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  nusha(doc, 0, fis, 'MUSTERI NUSHASI');
  // dashed cut line
  doc.setLineDashPattern([2, 2], 0);
  doc.setDrawColor(150, 150, 150);
  doc.line(HALF, 5, HALF, H - 5);
  doc.setLineDashPattern([], 0);
  nusha(doc, HALF, fis, 'FIRMA NUSHASI');
  return doc;
}

function dosyaAdi(fis: Fis): string {
  const safe = (s: string) => (s || '').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_').slice(0, 30);
  const t = (fis.tarih || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `servis-${t}-${safe(fis.musteri) || 'fis'}.pdf`;
}

export async function pdfYazdir(fis: Fis): Promise<void> {
  const doc = fisPdfOlustur(fis);
  const ad = dosyaAdi(fis);

  if (Capacitor.isNativePlatform()) {
    const dataUrl = doc.output('datauristring');
    const base64 = dataUrl.split(',')[1];
    const file = await Filesystem.writeFile({
      path: ad,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: 'Servis Fişi',
      text: `${fis.musteri} - ${fis.cihaz}`,
      url: file.uri,
      dialogTitle: 'Yazdır veya Paylaş',
    });
  } else {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  }
}

export async function pdfPaylas(fis: Fis): Promise<void> {
  return pdfYazdir(fis);
}
