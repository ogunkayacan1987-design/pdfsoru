/**
 * ÖNEL BİLİŞİM - Servis Teslim Fişi
 * Google Apps Script Web App
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ÖNEL BİLİŞİM - Servis Fişi')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Opsiyonel: Fişleri bir Google Sheet'e kaydeder.
 * Kullanmak için:
 *   1) Yeni bir Google Sheet açın, kimliğini (ID) kopyalayın.
 *   2) Apps Script editöründe: Proje Ayarları -> Komut Dosyası Özellikleri
 *      ekleyip SHEET_ID adıyla sheet ID'sini yapıştırın.
 * SHEET_ID tanımlı değilse kaydetme atlanır, form yine de çalışır.
 */
function kaydet(veri) {
  try {
    var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) return { ok: true, saved: false };

    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Kayit Zamani', 'Tarih', 'Musteri/Firma', 'Telefon',
        'Cihaz/Urun', 'Sorun', 'Yapilan Is', 'Ucret', 'Yetkili'
      ]);
    }
    sheet.appendRow([
      new Date(),
      veri.tarih || '',
      veri.musteri || '',
      veri.telefon || '',
      veri.cihaz || '',
      veri.sorun || '',
      veri.yapilanIs || '',
      veri.ucret || '',
      veri.yetkili || ''
    ]);
    return { ok: true, saved: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
