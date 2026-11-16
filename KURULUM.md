# ITU Racing Kural Portalı — Mobil uygulama (PWA) kurulumu

Bu klasör, sitenin telefona uygulama gibi kurulabilen ve internetsiz de çalışan sürümüdür.
Kurulabilmesi için klasörün bir kez HTTPS bir adreste yayınlanması gerekir (ücretsiz).

## 1) Yayınla (bir kez)

**GitHub Pages (önerilen, kalıcı)**
1. github.com'da yeni bir public depo aç (örn. `itu-racing-portal`).
2. "Add file → Upload files" ile bu klasörün İÇİNDEKİ her şeyi sürükle (index.html en üst seviyede olmalı) ve Commit.
3. Settings → Pages → Source: "Deploy from a branch", Branch: `main` / `(root)` → Save.
4. 1–2 dakika sonra adres: `https://KULLANICI_ADIN.github.io/itu-racing-portal/`

**Netlify Drop (en hızlı)**
app.netlify.com/drop adresine klasörü sürükle; hesap açarsan kalıcı olur.

## 2) Telefona kur

- **Android (Chrome):** Adresi aç → sağ üst ⋮ → "Uygulamayı yükle" / "Ana ekrana ekle".
- **iPhone (Safari):** Adresi aç → Paylaş düğmesi → "Ana Ekrana Ekle".

Kurulduktan sonra ana ekranda ITU Racing simgesiyle, tarayıcı çubuğu olmadan tam ekran açılır.
İlk açılışta tüm sayfa ve görseller telefona kaydedilir; sonra internet olmadan da çalışır.

## 3) Güncelleme

Siteyi değiştirdiğinde yeni klasörü aynı yere tekrar yükle. Uygulama bir sonraki
internetli açılışta yeni sürümü indirir, ondan sonraki açılışta onu gösterir.

## Notlar

- Checklist / PCB işaretleri ve notlar o telefonda saklanır; başka cihaza geçmez.
- PDF indirme Android'de normal çalışır; iPhone'da uygulama modunda PDF yeni bir
  önizleme olarak açılabilir, oradan "Paylaş → Dosyalara Kaydet" ile kaydedebilirsin.
