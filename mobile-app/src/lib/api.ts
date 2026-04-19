import { CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type Fis = {
  musteri: string;
  telefon: string;
  tarih: string;
  cihaz: string;
  sorun: string;
  yapilanIs: string;
  ucret: string;
  yetkili: string;
};

export type Kayit = Fis & {
  kayitZamani: string;
  kayitZamaniMs: number;
};

export type Filtre = { baslangic?: string; bitis?: string; arama?: string };

export type ApiAyar = { url: string; token: string };

const KEY_URL = 'apps_script_url';
const KEY_TOKEN = 'apps_script_token';

export async function ayarOku(): Promise<ApiAyar> {
  const [u, t] = await Promise.all([
    Preferences.get({ key: KEY_URL }),
    Preferences.get({ key: KEY_TOKEN }),
  ]);
  return { url: u.value || '', token: t.value || '' };
}

export async function ayarKaydet(ayar: ApiAyar): Promise<void> {
  await Preferences.set({ key: KEY_URL, value: ayar.url.trim() });
  await Preferences.set({ key: KEY_TOKEN, value: ayar.token.trim() });
}

async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { url, token } = await ayarOku();
  if (!url) throw new Error('Apps Script URL ayarlanmamış. Ayarlar ekranını açın.');

  // GET ile çağır: Apps Script /exec POST → 302 ile GET'e düşüyor ve
  // body kayboluyor. GET + query string her durumda çalışır.
  const qs = new URLSearchParams();
  qs.set('action', action);
  if (token) qs.set('token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (v2 != null) qs.set(k2, String(v2));
      }
    } else {
      qs.set(k, String(v));
    }
  }
  const finalUrl = url + (url.includes('?') ? '&' : '?') + qs.toString();

  const res = await CapacitorHttp.get({
    url: finalUrl,
    connectTimeout: 30000,
    readTimeout: 60000,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  let data: any = res.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      const onizleme = data.slice(0, 180).replace(/\s+/g, ' ');
      throw new Error(
        `Geçersiz JSON cevabı. Dağıtımda "Erişim: Herkes" seçili mi? Gelen: ${onizleme}...`
      );
    }
  }
  if (!data || data.ok !== true) {
    throw new Error(data?.error || 'Bilinmeyen sunucu hatası');
  }
  return data as T;
}

export const api = {
  ping: () => call<{ ok: true; mesaj: string; zaman: string }>('ping'),
  kaydet: (veri: Fis) => call<{ ok: true; saved: boolean }>('kaydet', { veri }),
  listele: (filtre: Filtre = {}) =>
    call<{ ok: true; rows: Kayit[]; toplam: number; sayi: number }>('listele', filtre),
  sheetBilgisi: () => call<{ ok: true; url: string; id: string; ad: string }>('sheetBilgisi'),
};
