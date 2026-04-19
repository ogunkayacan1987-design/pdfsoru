# ÖNEL Servis — Mobil Uygulama (APK)

Apps Script'e bağlanan, fiş oluşturan, kaydeden ve PDF olarak yazdıran/paylaşan Android uygulaması.

## Mimari

```
[Android APK (Capacitor + React)]
         │  HTTPS / JSON
         ▼
[Google Apps Script Web App]  ─►  [Google Sheets (kayıtlar)]
```

- UI: React + Vite, Capacitor 8 ile Android'e paketleniyor
- Backend: `google-apps-script/onel-bilisim-servis-fisi/Code.gs` (JSON API)
- Yazdırma: jsPDF ile A4 yatay 2 nüsha PDF üret → Capacitor Share ile paylaş/yazdır
- Veri: Google Sheets'e yazılır, raporlar oradan listelenir

---

## 1. Apps Script tarafı (sunucu)

1. <https://script.google.com> → Yeni Proje.
2. `Kod.gs` içeriğini bu repodaki `google-apps-script/onel-bilisim-servis-fisi/Code.gs` ile değiştirin.
3. Yeni HTML dosyası ekleyin (ad: **Index**), içine `Index.html` içeriğini yapıştırın.
4. Üstteki fonksiyon seçicisinden **`kurulum`** seçip **Çalıştır** → izin verin.
5. **Yürütme günlüğü**'nde **Sheet URL** ve **API Token**'ı göreceksiniz. Token'ı bir kenara not edin.
6. **Dağıt → Yeni dağıtım**:
   - Tür: **Web uygulaması**
   - Çalıştırma: **Ben**
   - Erişim: **Herkes** (APK'nın anonim olarak erişebilmesi için — token koruması var)
   - **Dağıt** → açılan **/exec** URL'sini kopyalayın.

> Token sıfırlamak için Apps Script editöründe `tokenSifirla()` fonksiyonunu çalıştırın.

---

## 2. Bilgisayarınızda kurulum (geliştirme makinesi)

Gerekenler:
- Node.js 18+ (`node -v`)
- Java 17 (Android için)
- Android Studio (SDK + platform tools)

```bash
cd mobile-app
npm install
```

Vite dev sunucusu (tarayıcıda önizleme):
```bash
npm run dev
```

---

## 3. Android'i ekleyin (ilk kez)

```bash
npm run build              # /dist üretir
npx cap add android        # android/ klasörü oluşturulur
npx cap sync android       # web içerik + pluginler eşitlenir
```

> Not: `android/` klasörü `.gitignore`'da. Üretilmesi gerekiyor.

---

## 4. APK üretimi

### A) Hızlı Debug APK (test için)

```bash
npm run android:apk
```

Çıktı:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Bu APK'yı telefona yükleyin (USB veya `adb install ...`).

### B) Yayınlanabilir Release APK (signed)

1. `android/app/build.gradle` içine signing config ekleyin:
   ```gradle
   android {
     signingConfigs {
       release {
         storeFile file("path/to/keystore.jks")
         storePassword "..."
         keyAlias "..."
         keyPassword "..."
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
         minifyEnabled false
       }
     }
   }
   ```
2. Release APK:
   ```bash
   cd android && ./gradlew assembleRelease
   ```
   Çıktı: `android/app/build/outputs/apk/release/app-release.apk`

Keystore üretimi:
```bash
keytool -genkey -v -keystore servis.jks -keyalg RSA -keysize 2048 -validity 10000 -alias servis
```

---

## 5. APK kurulumu sonrası

1. APK'yı telefona yükleyip açın.
2. Açılışta **Ayarlar** sekmesi gelir (URL boş olduğu için).
3. **Apps Script URL** ve **API Token** alanlarını doldurun:
   - URL: `https://script.google.com/macros/s/AKfycb.../exec`
   - Token: `kurulum()` çıktısındaki uzun token
4. **Bağlantıyı Test Et** → "Bağlantı OK: ..." görmelisiniz.
5. **Yeni Fiş** sekmesinden form doldurup **Kaydet & Yazdır** deyin.
6. Yazdırma: PDF üretilir, Android'in paylaş menüsü açılır → Yazdır / Drive'a kaydet / WhatsApp ile gönder vs. seçebilirsiniz.

---

## Komut özeti

| Komut | Ne yapar |
|---|---|
| `npm install` | Bağımlılıkları yükler |
| `npm run dev` | Tarayıcıda geliştirme sunucusu |
| `npm run build` | `dist/` üretir |
| `npm run android:init` | Android projesini ekler (ilk kez) |
| `npm run android:sync` | Build + Capacitor sync |
| `npm run android:open` | Android Studio'da açar |
| `npm run android:run` | Bağlı cihazda çalıştırır |
| `npm run android:apk` | Debug APK üretir |

---

## Sorun giderme

- **"Apps Script URL ayarlanmamış"** → Ayarlar sekmesinden URL ve token girin.
- **"HTTP 401"** veya **"Geçersiz API token"** → Token'ı yanlış girdiniz; Apps Script editöründe `kurulum()` veya `tokenSifirla()` çıktısındaki token'ı tekrar yapıştırın.
- **"HTTP 0" / Bağlantı yok** → Web uygulamasının dağıtımında **Erişim: Herkes** olduğundan ve URL'nin `/exec` ile bittiğinden emin olun.
- **PDF Türkçe karakterler** → jsPDF'in varsayılan fontu Helvetica; ş/ğ/ı için TTF font eklemek gerekir. Şu an Türkçe karakterler ASCII'ye düşürülerek basılıyor (cihaz/sorun alanları korunur ama başlıklar latin). Daha sonra DejaVu Sans gibi bir font ekleyebiliriz.
