# Gym App — Build ve Sunum Çizelgesi

Bu dosyayı build günü ve sunum günü elinizin altında tutun.  
Proje: `finalbitirme` | Android APK + Google Drive

> **Bulut deploy (önerilen):** Adım adım rehber → [`BULUT-DEPLOY.md`](BULUT-DEPLOY.md)  
> Projede hazır: `render.yaml`, `gym-app-backend/scripts/migrate.js`, `gym-app-frontend/eas.json`

---

## Hangi mod? (önce seçin)

| | **MOD B — Bulut (önerilen)** | MOD A — Laptop + okul Wi‑Fi |
|--|------------------------------|-----------------------------|
| Okul Wi‑Fi kötüyse | Uygun | Riskli |
| Sunumda laptop | Şart değil (sunucu bulutta) | Şart (Docker açık) |
| APK build yeri | Yurt / okul fark etmez | Sadece okul IP’si ile |
| API adresi | `https://xxx.railway.app/api` sabit | `http://PC_IP:3000/api` |
| Veritabanı | Railway/Render Postgres | PC’de Docker |

**Okul Wi‑Fi zayıfsa → MOD B (Railway / Render) kullanın.** Aşağıda önce MOD B, sonra MOD A var.

---

# MOD B — Backend bulutta (Railway / Render)

### Ne kazanırsınız?

- Telefonlar **aynı Wi‑Fi’de olmak zorunda değil** (internet yeterli).
- APK’yı **yurtta** bile build alabilirsiniz.
- Sunum günü bilgisayarınız kapalı olsa bile (servis ayaktaysa) uygulama çalışır.
- Afiş QR + APK planı aynı kalır.

### Doldurulacak notlar (bulut)

| Alan | Değeriniz |
|------|-----------|
| Bulut sağlayıcı | Railway / Render |
| Canlı API URL | `https://________________/api` |
| `EXPO_PUBLIC_API_URL` | Yukarıdaki ile aynı |
| Drive klasör linki | _______________ |
| Sunum tarihi | _______________ |

---

## FAZA B0 — Buluta deploy (sunumdan 3–7 gün önce, ~2–3 saat ilk sefer)

### 1) Hesap ve proje

- [ ] [railway.app](https://railway.app) veya [render.com](https://render.com) hesabı
- [ ] GitHub’a proje push (veya Railway CLI ile deploy)
- [ ] Yeni proje → **Deploy `gym-app-backend`** (Dockerfile: `gym-app-backend/Dockerfile`)

### 2) PostgreSQL

- [ ] Bulutta **PostgreSQL** ekle (Railway: PostgreSQL plugin / Render: PostgreSQL)
- [ ] Ortam değişkenlerini backend’e bağla:
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- [ ] İlk kurulumda SQL migration: `gym-app-backend/gym-app-database/` içindeki script’ler (pgAdmin veya `psql` ile — README’deki migration bölümü)

### 3) Redis (isteğe bağlı ama önerilir)

- [ ] Bulut Redis ekle **veya** geçici `REDIS_ENABLED=false` (AI önbellek kapanır, uygulama çalışır)
- [ ] `REDIS_HOST`, `REDIS_PORT` veya `REDIS_URL`

### 4) Backend ortam değişkenleri (panelden)

```
PORT=3000
NODE_ENV=production
JWT_SECRET=guclu_rastgele_bir_sifre
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=...
DB_HOST=...
DB_PORT=5432
DB_NAME=gym_app_db
DB_USER=...
DB_PASSWORD=...
REDIS_ENABLED=true
REDIS_HOST=...
REDIS_PORT=6379
```

- [ ] Deploy tamamlandı
- [ ] Tarayıcıda: `https://SIZIN-URL/health` → OK

### 5) Frontend — sabit API URL

Dosya: `gym-app-frontend\.env`

```env
EXPO_PUBLIC_API_URL=https://SIZIN-URL/api
```

Örnek: `https://gym-app-backend-production.up.railway.app/api`  
- [ ] **https** ve sonunda `/api` olsun
- [ ] Kaydet

> **Not:** React Native APK için CORS genelde sorun olmaz. Web demo yapacaksanız `gym-app-backend/src/app.js` içindeki `cors` listesine bulut URL’nizi eklemeniz gerekebilir.

### 6) APK build (artık yurt/okul fark etmez)

```powershell
cd gym-app-frontend
eas build -p android --profile preview
```

- [ ] APK indir → Drive klasörüne yükle
- [ ] Telefonda test (mobil veri veya herhangi Wi‑Fi)

### 7) Sunum günü (bulut)

- [ ] `https://SIZIN-URL/health` açılıyor mu?
- [ ] Ücretsiz planda uyku varsa 10 dk önce bir kez health’e istek atın
- [ ] Laptop: sadece slayt için; Docker açmak **zorunlu değil**
- [ ] 5–6 kişi: internet + APK yeterli

**Ücretsiz plan uyarısı:** Railway/Render uyku moduna geçebilir; ilk istek 30–60 sn sürebilir. Sunum öncesi “ısındırın”.

---

# MOD A — Laptop + okul Wi‑Fi (eski plan)

## Önemli kavramlar (MOD A)

| Ne | Nerede | Değişir mi? |
|----|--------|-------------|
| **Afiş QR** | Google Drive **klasör** linki | Hayır (klasör sabit) |
| **APK dosyası** | Drive klasörünün içi | Build günü yüklersiniz |
| **API adresi (APK içi)** | `EXPO_PUBLIC_API_URL` | Build anında sabitlenir → **okul IP** olmalı |
| **Veritabanı** | Sizin PC, Docker Postgres | Sunumda PC açık + Docker |
| **5–6 kullanıcı** | Aynı backend + aynı DB | Aynı okul Wi‑Fi şart |

**Yurtta build alırsanız** → Okulda API çalışmaz.  
**Build = okul Wi‑Fi’sinde**, sunumdan 1–2 gün önce veya sunum haftası.

---

## Doldurulacak notlar — MOD A (kaleminizle yazın)

| Alan | Değeriniz |
|------|-----------|
| Sunum tarihi | _______________ |
| Build tarihi (okul) | _______________ |
| Okul Wi‑Fi adı | _______________ |
| Build günü IP (`ipconfig`) | _______________ |
| Sunum günü IP (`ipconfig`) | _______________ |
| Drive klasör linki | _______________ |
| Expo hesabı | _______________ |

---

# FAZA 1 — Afiş (MOD A ve B ortak, build öncesi)

- [ ] Google Drive’da klasör oluştur (ör. `GymApp-APK`)
- [ ] Paylaşım: **Bağlantıya sahip olan herkes** (indirebilsin)
- [ ] Klasör linkini yukarı tabloya yaz
- [ ] QR üret → afişe bas  
  - https://www.qr-code-generator.com  
  - veya: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=DRIVE_LINK`
- [ ] Klasör şimdilik boş olabilir (APK sonra yüklenecek)

---

# FAZA 2 — BUILD GÜNÜ — MOD A only (okul Wi‑Fi, ~1 saat)

**Ön koşul:** Bilgisayar **okul ağına** bağlı (yurt değil).

## Saat 0:00 — Hazırlık (10 dk)

```powershell
cd "C:\Users\enesz\OneDrive\Masaüstü\finalbitirme"
docker compose up -d
docker compose ps
```

- [ ] `gym-app-backend` → Up (healthy)
- [ ] `gym-app-postgres` → Up (healthy)
- [ ] `gym-app-redis` → Up (healthy)

```powershell
ipconfig
```

- [ ] IPv4 Address: `________________` (Wi‑Fi satırı)
- [ ] Telefon tarayıcısından aç: `http://BU_IP:3000/health` → JSON / OK

## Saat 0:10 — .env ayarı (5 dk)

Dosya: `gym-app-frontend\.env`

```env
EXPO_PUBLIC_API_URL=http://BU_IP:3000/api
```

Örnek: `http://10.50.1.88:3000/api` — kendi IP’nizi yazın.  
- [ ] Dosyayı **kaydet** (Ctrl+S)

Gemini (AI) için kök `.env` ve `gym-app-backend\.env` içinde `GEMINI_API_KEY` dolu olsun:

```powershell
docker compose up -d --force-recreate backend
```

## Saat 0:15 — EAS (ilk seferde bir kez, 15 dk)

```powershell
npm install -g eas-cli
eas login
cd gym-app-frontend
eas build:configure
```

`eas.json` içinde **preview + apk** profili olmalı (yoksa aşağıdaki gibi):

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

- [ ] Expo hesabına giriş yapıldı
- [ ] `eas.json` oluşturuldu

## Saat 0:20 — APK build (15–25 dk, bulutta)

```powershell
cd "C:\Users\enesz\OneDrive\Masaüstü\finalbitirme\gym-app-frontend"
eas build -p android --profile preview
```

- [ ] Build expo.dev üzerinde başladı
- [ ] Build **finished** → `.apk` indirildi
- [ ] İndirilen dosya adı: `________________`

## Saat 0:45 — Drive’a yükle + test (15 dk)

- [ ] APK’yı **afişteki aynı Drive klasörüne** yükle
- [ ] Telefonda QR tara → indir → kur (bilinmeyen kaynak izni)
- [ ] Uygulama aç → kayıt / giriş dene
- [ ] AI egzersiz programı dene (isteğe bağlı)

**Build günü IP’sini not edin:** `________________`  
(Bu IP, APK’nın içine gömülüdür.)

---

# FAZA 3 — SUNUM GÜNÜ — MOD A (sabah, ~15 dk)

## Sunumdan 1 saat önce

```powershell
cd "C:\Users\enesz\OneDrive\Masaüstü\finalbitirme"
docker compose up -d
docker compose ps
ipconfig
```

| Kontrol | Tamam |
|---------|--------|
| IP, build günüyle **aynı** mı? | [ ] Evet [ ] Hayır → aşağıya bak |
| `http://GUNCEL_IP:3000/health` telefonda açılıyor | [ ] |
| Bilgisayar uyku kapalı / prize takılı | [ ] |
| Windows güvenlik duvarı 3000 izinli | [ ] |

### IP değiştiyse (Hayır işaretlediyseniz)

1. `gym-app-frontend\.env` → yeni IP
2. `eas build -p android --profile preview` (yeniden, ~20 dk)
3. Yeni APK’yı Drive klasörüne yükle  
   **veya** yedek: Expo Go + `npx expo start` (geliştirme demosu)

## Sunum sırasında (5–6 kişi)

Sizin bilgisayar:
- [ ] Docker açık
- [ ] Okul Wi‑Fi
- [ ] Bu bilgisayar kapanmasın

Katılımcılara söyle:
1. **Aynı okul Wi‑Fi** (mobil veri kapalı)
2. Afiş QR → APK indir → yükle
3. Uygulamayı aç, kayıt ol

---

# Komut özeti (kopyala-yapıştır)

```powershell
# Proje kökü
cd "C:\Users\enesz\OneDrive\Masaüstü\finalbitirme"
docker compose up -d
docker compose ps
docker logs gym-app-backend --tail 20

# IP
ipconfig

# Frontend build
cd gym-app-frontend
eas build -p android --profile preview
```

---

# Sorun giderme

| Belirti | Olası neden | Çözüm |
|---------|-------------|--------|
| Network Error | Farklı Wi‑Fi / PC kapalı / yanlış IP | Aynı ağ, `docker compose up`, `ipconfig` |
| 500 / AI hata | Gemini anahtar yok | `.env` `GEMINI_API_KEY`, `docker compose restart backend` |
| Redis ECONNREFUSED | Sadece backend ayakta | `docker compose up -d` (redis + postgres da) |
| Drive APK inmiyor | Drive kısıtı | APK’yı ZIP yap, ZIP paylaş |
| Yurtta build, okulda patlıyor | Yanlış IP gömülü | Okulda yeniden build |

---

# Yedek plan (APK çalışmazsa)

1. Bilgisayarda `docker compose up -d`
2. `cd gym-app-frontend` → `npx expo start`
3. Katılımcılar **Expo Go** kurar, terminal QR ile bağlanır  
   (Aynı Wi‑Fi; geliştirme modu — afiş APK’sı değil)

---

# Kontrol listesi — tek sayfa özet

**MOD B (bulut — önerilen):** Railway/Render deploy → `https://.../api` → `.env` → eas build (her yerde) → Drive → sunumda sadece health kontrol  
**MOD A (laptop):** Afiş Drive QR → okulda build → docker sunum günü → aynı Wi‑Fi  

**Okul Wi‑Fi kötüyse:** MOD B  
**Asla (MOD A):** Yurt IP’si ile build  
**Her zaman:** Afiş QR = Drive klasörü (APK sonra yüklenir)

---

*Son güncelleme: proje dağıtım planına göre oluşturuldu.*
