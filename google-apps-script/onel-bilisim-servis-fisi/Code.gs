/**
 * ÖNEL BİLİŞİM - Servis Teslim Fişi
 * Google Apps Script Web App
 */

// Web uygulamasının ana girişi
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ÖNEL BİLİŞİM - Servis Fişi')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * İlk kurulum: Drive'da yeni bir Google Sheet oluşturur ve ID'sini saklar.
 * Apps Script editöründe üst menüden bu fonksiyonu bir kez seçip çalıştırmak
 * yeterlidir. İzin istendiğinde onaylayın.
 * Sheet zaten bağlıysa mevcut sheet URL'sini döndürür.
 */
function kurulum() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('SHEET_ID');

  if (existingId) {
    try {
      var ss2 = SpreadsheetApp.openById(existingId);
      Logger.log('Sheet zaten bağlı: ' + ss2.getUrl());
      return { ok: true, url: ss2.getUrl(), id: existingId, mesaj: 'Sheet zaten bağlı.' };
    } catch (e) {
      // silinmişse yeniden oluştur
    }
  }

  var ss = SpreadsheetApp.create('ÖNEL BİLİŞİM - Servis Kayıtları');
  var sheet = ss.getSheets()[0];
  sheet.setName('Kayitlar');
  sheet.appendRow([
    'Kayit Zamani', 'Tarih', 'Musteri/Firma', 'Telefon',
    'Cihaz/Urun', 'Sorun', 'Yapilan Is', 'Ucret', 'Yetkili'
  ]);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:I1').setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  sheet.setColumnWidths(1, 9, 130);

  props.setProperty('SHEET_ID', ss.getId());
  Logger.log('Yeni sheet oluşturuldu: ' + ss.getUrl());
  return { ok: true, url: ss.getUrl(), id: ss.getId(), mesaj: 'Yeni sheet oluşturuldu.' };
}

/**
 * Bağlı sheet URL'sini döndürür (raporlar sekmesinde "Sheet'i Aç" için).
 */
function sheetBilgisi() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) return { ok: false, error: 'Henüz sheet bağlı değil. Önce kurulum() fonksiyonunu çalıştırın.' };
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    return { ok: true, url: ss.getUrl(), id: sheetId, ad: ss.getName() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Fişi sheet'e kaydeder. SHEET_ID tanımlı değilse sessizce atlar.
 */
function kaydet(veri) {
  try {
    var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) return { ok: true, saved: false, mesaj: 'Sheet bağlı değil (kurulum yapılmamış).' };

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

/**
 * Sheet'teki kayıtları filtreleyerek döndürür.
 * filtre: { baslangic: 'YYYY-MM-DD', bitis: 'YYYY-MM-DD', arama: 'metin' }
 */
function listele(filtre) {
  filtre = filtre || {};
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) {
    return { ok: false, error: 'Henüz sheet bağlı değil. Apps Script editöründen kurulum() fonksiyonunu bir kez çalıştırın.' };
  }

  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: true, rows: [], toplam: 0, sayi: 0 };

    var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    var tz = Session.getScriptTimeZone();

    var rows = data.map(function (r) {
      var kz = r[0];
      return {
        kayitZamani: kz instanceof Date ? Utilities.formatDate(kz, tz, "dd.MM.yyyy HH:mm") : String(kz || ''),
        kayitZamaniMs: kz instanceof Date ? kz.getTime() : 0,
        tarih: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd") : String(r[1] || ''),
        musteri: String(r[2] || ''),
        telefon: String(r[3] || ''),
        cihaz: String(r[4] || ''),
        sorun: String(r[5] || ''),
        yapilanIs: String(r[6] || ''),
        ucret: String(r[7] || ''),
        yetkili: String(r[8] || '')
      };
    });

    if (filtre.baslangic) {
      var bas = new Date(filtre.baslangic + 'T00:00:00');
      rows = rows.filter(function (r) { return r.kayitZamaniMs >= bas.getTime(); });
    }
    if (filtre.bitis) {
      var bit = new Date(filtre.bitis + 'T23:59:59');
      rows = rows.filter(function (r) { return r.kayitZamaniMs <= bit.getTime(); });
    }
    if (filtre.arama) {
      var q = String(filtre.arama).toLocaleLowerCase('tr-TR');
      rows = rows.filter(function (r) {
        var hay = (r.musteri + ' ' + r.telefon + ' ' + r.cihaz + ' ' + r.sorun + ' ' + r.yapilanIs)
          .toLocaleLowerCase('tr-TR');
        return hay.indexOf(q) !== -1;
      });
    }

    rows.sort(function (a, b) { return b.kayitZamaniMs - a.kayitZamaniMs; });

    var toplam = rows.reduce(function (s, r) {
      var u = parseFloat(String(r.ucret).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
      return isNaN(u) ? s : s + u;
    }, 0);

    return { ok: true, rows: rows, toplam: toplam, sayi: rows.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
