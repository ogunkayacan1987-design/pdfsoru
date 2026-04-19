# ÖNEL BİLİŞİM — Servis Fişi (Google Apps Script)

A4 kağıda iki nüsha (müşteri + firma) A5 boyutunda servis fişi basan Google Apps Script web uygulaması.

## Özellikler

- Müşteri / firma adı, telefon, tarih, cihaz alanları
- "Müşteri Sorunu / Yapılacak İşler" ve "Yapılan İş ve İşlemler" için geniş notlandırma alanları
- Ücret ve yetkili alanı
- **Yazdır** butonu: A4 yatay üzerinde 2 adet A5 nüsha (MÜŞTERİ NÜSHASI + FİRMA NÜSHASI) üretir
- Opsiyonel olarak her fişi bir Google Sheet'e kaydeder

## Kurulum

1. <https://script.google.com> adresine gidin, **Yeni Proje** oluşturun.
2. Proje adını `ÖNEL BİLİŞİM - Servis Fişi` yapın.
3. Sol menüden **Code.gs** dosyasını açın, içeriğini bu klasördeki `Code.gs` ile değiştirin.
4. Sol menüde **+** butonu → **HTML** → dosya adı `Index` olsun. İçeriğini bu klasördeki `Index.html` ile değiştirin.
5. Sağ üstten **Dağıt → Yeni dağıtım** seçin.
   - Tür: **Web uygulaması**
   - Kim erişebilir: **Yalnız kendim** (veya ihtiyaca göre)
   - **Dağıt** butonuna basın, açılan URL'yi kaydedin.
6. URL'yi tarayıcıda açın. Form hazır.

## (Opsiyonel) Google Sheet'e Kayıt

Her fişi kayıt altına almak isterseniz:

1. Yeni bir Google Sheet oluşturun, URL'den **sheet ID**'sini kopyalayın
   (`https://docs.google.com/spreadsheets/d/**BU_KISIM**/edit`).
2. Apps Script projesinde **Proje Ayarları (⚙)** → **Komut Dosyası Özellikleri** bölümüne gidin.
3. **Özellik Ekle** → `SHEET_ID` adıyla sheet kimliğini yapıştırın, kaydedin.
4. Formda **💾 Kaydet & Yazdır** butonunu kullanın.

İlk çalıştırmada izinler istenecektir (Sheet yazma izni için).

## Yazdırma Ayarları

- Tarayıcının yazdırma diyaloğunda şu ayarları yapın:
  - **Kağıt boyutu:** A4
  - **Yön:** Yatay (landscape)
  - **Kenar boşlukları:** Yok / None
  - **Ölçek:** %100 (Varsayılan)
  - **Arkaplan grafikleri:** Açık (logo ve çerçeveler doğru çıkması için)

## Logo

Logo HTML/CSS ile yeniden oluşturulmuştur (mavi "**03** ÖNEL BİLİŞİM" + altında
"Furkan ÖNEL · 0537 846 03 77"). Gerçek görsel logonuzu kullanmak isterseniz:

- Logoyu Google Drive'a yükleyip herkese açık hale getirin.
- `Index.html` dosyasında `<div class="logo">...` bölümünü şu şekilde değiştirin:

```html
<img src="LOGO_URL" style="height: 18mm;">
```

## Dosyalar

- `Code.gs` — sunucu tarafı (sayfayı sunar, opsiyonel sheet kaydı)
- `Index.html` — form + yazdırma şablonu
- `KURULUM.md` — bu dosya
