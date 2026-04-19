/**
 * ÖNEL BİLİŞİM - Servis Teslim Fişi
 * Google Apps Script Web App + JSON API (Android APK için backend)
 *
 * Web kullanımı: URL'yi tarayıcıda açın → HTML formu gelir.
 * API kullanımı:
 *   GET  ?action=listele&token=API_TOKEN&baslangic=YYYY-MM-DD&bitis=YYYY-MM-DD&arama=...
 *   GET  ?action=sheetBilgisi&token=API_TOKEN
 *   POST { action: "kaydet", token: "API_TOKEN", veri: {...} }
 */

// ============ AYARLAR ============
// Önce kurulum() fonksiyonunu çalıştırın; o sırada otomatik token üretilir
// ve Komut Dosyası Özelliklerine "API_TOKEN" adıyla kaydedilir.
// APK uygulamasından bu token'ı isteklere ekleyeceksiniz.

// ============ WEB UYGULAMASI ============
function doGet(e) {
  e = e || { parameter: {} };
  var action = (e.parameter && e.parameter.action) || '';

  if (action) {
    // JSON API
    return _jsonResponse(_apiCagir(action, e.parameter));
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ÖNEL BİLİŞİM - Servis Fişi')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return _jsonResponse({ ok: false, error: 'Geçersiz JSON: ' + err });
  }
  var action = body.action || (e && e.parameter && e.parameter.action) || '';
  if (!action) return _jsonResponse({ ok: false, error: 'action belirtilmedi.' });

  var params = Object.assign({}, e && e.parameter ? e.parameter : {}, body);
  return _jsonResponse(_apiCagir(action, params));
}

function _jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _apiCagir(action, params) {
  if (!_tokenKontrol(params)) {
    return { ok: false, error: 'Geçersiz veya eksik API token.' };
  }
  switch (action) {
    case 'kaydet':       return kaydet(params.veri || params);
    case 'listele':      return listele({
      baslangic: params.baslangic || '',
      bitis: params.bitis || '',
      arama: params.arama || ''
    });
    case 'sheetBilgisi': return sheetBilgisi();
    case 'ping':         return { ok: true, mesaj: 'pong', zaman: new Date().toISOString() };
    default:             return { ok: false, error: 'Bilinmeyen action: ' + action };
  }
}

function _tokenKontrol(params) {
  var beklenen = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!beklenen) return true; // Token tanımlı değilse açık erişim
  var gelen = params && (params.token || params.api_token);
  return gelen === beklenen;
}

// ============ KURULUM ============
function kurulum() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('SHEET_ID');

  // Sheet
  var ss;
  if (existingId) {
    try { ss = SpreadsheetApp.openById(existingId); }
    catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('ÖNEL BİLİŞİM - Servis Kayıtları');
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
  }

  // Token
  var token = props.getProperty('API_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_TOKEN', token);
  }

  Logger.log('Sheet URL: ' + ss.getUrl());
  Logger.log('API Token: ' + token);
  Logger.log('Bu token APK uygulamasında ayarlar ekranına girilmelidir.');

  return {
    ok: true,
    sheetUrl: ss.getUrl(),
    sheetId: ss.getId(),
    apiToken: token,
    mesaj: 'Kurulum tamam. Token\'ı APK uygulamasındaki ayarlara girin.'
  };
}

function tokenSifirla() {
  var token = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  Logger.log('Yeni API Token: ' + token);
  return { ok: true, apiToken: token };
}

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

// ============ İŞ MANTIĞI ============
function kaydet(veri) {
  try {
    veri = veri || {};
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
