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

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { url, token } = await ayarOku();
  if (!url) throw new Error('Apps Script URL ayarlanmamış. Ayarlar ekranını açın.');

  // Apps Script /exec POST → 302 GET'e düşüyor ve body kayboluyor. GET
  // kullanıyoruz. Parametreleri hem URL'ye gömüyoruz hem de
  // CapacitorHttp.params alanına yazıyoruz — böylece native HTTP
  // katmanı hangisini kullanırsa kullansın query sunucuya ulaşır.
  const params: Record<string, string> = { action };
  if (token) params.token = token;
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue;
    if (typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (v2 != null && v2 !== '') params[k2] = String(v2);
      }
    } else if (v !== '') {
      params[k] = String(v);
    }
  }

  const qs = new URLSearchParams(params).toString();
  const finalUrl = url + (url.includes('?') ? '&' : '?') + qs;

  const res = await CapacitorHttp.get({
    url: finalUrl,
    params,
    connectTimeout: 30000,
    readTimeout: 60000,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status} · ${action}`);
  }
  let data: any = res.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      const onizleme = data.slice(0, 140).replace(/\s+/g, ' ');
      const urlKuyruk = finalUrl.slice(-80);
      throw new Error(
        `Geçersiz JSON. URL sonu: ...${urlKuyruk} · Gelen: ${onizleme}...`
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
