import { useEffect, useState } from 'react';
import { api, ayarOku, ayarKaydet, type Fis, type Kayit, type ApiAyar } from './lib/api';
import { pdfYazdir } from './lib/pdf';

type Tab = 'yeni' | 'rapor' | 'ayar';
type Toast = { msg: string; err?: boolean } | null;

const bugun = () => new Date().toISOString().slice(0, 10);

const bosFis: Fis = {
  musteri: '', telefon: '', tarih: bugun(), cihaz: '',
  sorun: '', yapilanIs: '', ucret: '', yetkili: 'Furkan ÖNEL',
};

export function App() {
  const [tab, setTab] = useState<Tab>('yeni');
  const [fis, setFis] = useState<Fis>(bosFis);
  const [ayar, setAyar] = useState<ApiAyar>({ url: '', token: '' });
  const [ayarYuklendi, setAyarYuklendi] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    ayarOku().then(a => {
      setAyar(a);
      setAyarYuklendi(true);
      if (!a.url) setTab('ayar');
    });
  }, []);

  const goster = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const u = <K extends keyof Fis>(k: K, v: Fis[K]) => setFis(s => ({ ...s, [k]: v }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="mark">03</span>
          <div>
            <div className="brand">ÖNEL BİLİŞİM</div>
            <div className="sub">Servis Yönetimi</div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'yeni' ? 'active' : ''} onClick={() => setTab('yeni')}>Yeni Fiş</button>
        <button className={tab === 'rapor' ? 'active' : ''} onClick={() => setTab('rapor')}>Raporlar</button>
        <button className={tab === 'ayar' ? 'active' : ''} onClick={() => setTab('ayar')}>Ayarlar</button>
      </nav>

      <main className="content">
        {tab === 'yeni' && (
          <FisForm
            fis={fis}
            update={u}
            onSifirla={() => setFis({ ...bosFis, tarih: bugun() })}
            onYazdir={async () => {
              if (!fis.musteri.trim()) return goster('Müşteri / firma adı zorunlu', true);
              try { await pdfYazdir(fis); }
              catch (e: any) { goster('Yazdırma hatası: ' + e.message, true); }
            }}
            onKaydet={async () => {
              if (!fis.musteri.trim()) return goster('Müşteri / firma adı zorunlu', true);
              setYukleniyor(true);
              try {
                await api.kaydet(fis);
                goster('Kaydedildi. Yazdırılıyor...');
                await pdfYazdir(fis);
              } catch (e: any) {
                goster('Kayıt hatası: ' + e.message, true);
              } finally {
                setYukleniyor(false);
              }
            }}
            yukleniyor={yukleniyor}
          />
        )}

        {tab === 'rapor' && (
          <Raporlar onYazdir={async (k) => {
            try { await pdfYazdir(k); }
            catch (e: any) { goster('Yazdırma hatası: ' + e.message, true); }
          }} onHata={(m) => goster(m, true)} />
        )}

        {tab === 'ayar' && ayarYuklendi && (
          <Ayarlar
            ayar={ayar}
            setAyar={setAyar}
            onKaydet={async () => {
              await ayarKaydet(ayar);
              goster('Ayarlar kaydedildi.');
            }}
            onTest={async () => {
              await ayarKaydet(ayar);
              try {
                const r = await api.ping();
                goster('Bağlantı OK: ' + r.zaman);
              } catch (e: any) {
                goster('Bağlantı hatası: ' + e.message, true);
              }
            }}
          />
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.err ? 'err' : ''}`}>{toast.msg}</div>
      )}
    </div>
  );
}

// ============ FİŞ FORMU ============
function FisForm(props: {
  fis: Fis;
  update: <K extends keyof Fis>(k: K, v: Fis[K]) => void;
  onSifirla: () => void;
  onYazdir: () => void;
  onKaydet: () => void;
  yukleniyor: boolean;
}) {
  const { fis, update } = props;
  return (
    <div className="form">
      <Field label="Müşteri / Firma Adı Soyadı" v={fis.musteri} on={(v) => update('musteri', v)} />
      <Field label="Telefon" v={fis.telefon} on={(v) => update('telefon', v)} type="tel" />
      <Field label="Teslim Alış Tarihi" v={fis.tarih} on={(v) => update('tarih', v)} type="date" />
      <Field label="Cihaz / Ürün" v={fis.cihaz} on={(v) => update('cihaz', v)} />
      <Field label="Müşteri Sorunu / Yapılacak İşler" v={fis.sorun} on={(v) => update('sorun', v)} multi />
      <Field label="Yapılan İş ve İşlemler" v={fis.yapilanIs} on={(v) => update('yapilanIs', v)} multi />
      <Field label="Ücret (₺)" v={fis.ucret} on={(v) => update('ucret', v)} type="text" />
      <Field label="Teslim Alan Yetkili" v={fis.yetkili} on={(v) => update('yetkili', v)} />

      <div className="actions">
        <button className="btn primary" disabled={props.yukleniyor} onClick={props.onKaydet}>
          {props.yukleniyor ? 'Bekleyin...' : 'Kaydet & Yazdır'}
        </button>
        <button className="btn" onClick={props.onYazdir}>Sadece Yazdır</button>
        <button className="btn ghost" onClick={props.onSifirla}>Temizle</button>
      </div>
    </div>
  );
}

function Field(props: {
  label: string; v: string; on: (v: string) => void;
  type?: string; multi?: boolean;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.multi ? (
        <textarea value={props.v} onChange={(e) => props.on(e.target.value)} rows={3} />
      ) : (
        <input type={props.type || 'text'} value={props.v} onChange={(e) => props.on(e.target.value)} />
      )}
    </label>
  );
}

// ============ RAPORLAR ============
function Raporlar(props: { onYazdir: (f: Kayit) => void; onHata: (m: string) => void }) {
  const [bas, setBas] = useState('');
  const [bit, setBit] = useState('');
  const [ara, setAra] = useState('');
  const [rows, setRows] = useState<Kayit[]>([]);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yuklendi, setYuklendi] = useState(false);

  const yukle = async () => {
    setYukleniyor(true);
    try {
      const r = await api.listele({ baslangic: bas, bitis: bit, arama: ara });
      setRows(r.rows);
      setToplam(r.toplam);
      setYuklendi(true);
    } catch (e: any) {
      props.onHata('Liste alınamadı: ' + e.message);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { yukle(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="rapor">
      <div className="filtreler">
        <label className="field"><span>Başlangıç</span><input type="date" value={bas} onChange={e => setBas(e.target.value)} /></label>
        <label className="field"><span>Bitiş</span><input type="date" value={bit} onChange={e => setBit(e.target.value)} /></label>
        <label className="field full"><span>Ara</span><input type="text" value={ara} onChange={e => setAra(e.target.value)} placeholder="Müşteri, telefon, cihaz..." /></label>
        <div className="actions">
          <button className="btn primary" onClick={yukle} disabled={yukleniyor}>
            {yukleniyor ? 'Yükleniyor...' : 'Listele'}
          </button>
          <button className="btn ghost" onClick={() => { setBas(''); setBit(''); setAra(''); setTimeout(yukle, 0); }}>
            Sıfırla
          </button>
        </div>
      </div>

      <div className="ozet">
        <div className="kart"><div className="lbl">Kayıt</div><div className="val">{rows.length}</div></div>
        <div className="kart"><div className="lbl">Toplam (₺)</div><div className="val">{toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div></div>
      </div>

      {!yuklendi && yukleniyor && <div className="bos">Yükleniyor...</div>}
      {yuklendi && rows.length === 0 && <div className="bos">Kayıt bulunamadı.</div>}

      <div className="liste">
        {rows.map((r, i) => (
          <div className="kayit" key={i}>
            <div className="kayit-ust">
              <div className="zaman">{r.kayitZamani}</div>
              <div className="ucret">{r.ucret} ₺</div>
            </div>
            <div className="musteri">{r.musteri}</div>
            <div className="cihaz">{r.cihaz}</div>
            {r.sorun && <div className="alan"><b>Sorun:</b> {r.sorun}</div>}
            {r.yapilanIs && <div className="alan"><b>Yapılan:</b> {r.yapilanIs}</div>}
            <div className="actions">
              <button className="btn" onClick={() => props.onYazdir(r)}>Yeniden Yazdır</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ AYARLAR ============
function Ayarlar(props: {
  ayar: ApiAyar;
  setAyar: (a: ApiAyar) => void;
  onKaydet: () => void;
  onTest: () => void;
}) {
  const { ayar, setAyar } = props;
  return (
    <div className="form">
      <p className="aciklama">
        Apps Script web uygulamasının URL'sini ve Apps Script editöründe <code>kurulum()</code> fonksiyonunu çalıştırınca üretilen API token'ını girin.
      </p>
      <label className="field">
        <span>Apps Script URL</span>
        <input type="url" value={ayar.url} onChange={(e) => setAyar({ ...ayar, url: e.target.value })}
          placeholder="https://script.google.com/macros/s/.../exec" />
      </label>
      <label className="field">
        <span>API Token</span>
        <input type="text" value={ayar.token} onChange={(e) => setAyar({ ...ayar, token: e.target.value })} />
      </label>
      <div className="actions">
        <button className="btn primary" onClick={props.onKaydet}>Kaydet</button>
        <button className="btn" onClick={props.onTest}>Bağlantıyı Test Et</button>
      </div>
    </div>
  );
}
