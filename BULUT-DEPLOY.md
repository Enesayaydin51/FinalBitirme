# Bulut Deploy — Sıfırdan (Render + APK)

Okul Wi‑Fi’sinden bağımsız çalışır. Telefonlar **internete** bağlı olmalı (aynı Wi‑Fi şart değil).

---

## Bölüm 1 — Render’da backend (≈30–45 dk)

### 1. GitHub’a yükle

```powershell
cd "C:\Users\enesz\OneDrive\Masaüstü\finalbitirme"
git init
git add .
git commit -m "chore: cloud deploy hazirligi"
```

GitHub’da boş repo oluşturup `git remote add origin ...` ve `git push -u origin main`.

### 2. Render hesabı

1. [render.com](https://render.com) → Sign up (GitHub ile).
2. **New +** → **Blueprint**.
3. Repo’yu seçin → `render.yaml` otomatik algılanır → **Apply**.

### 3. Ortam değişkeni (panel)

Deploy sırasında veya sonrası **gym-app-api** → **Environment**:

| Key | Değer |
|-----|--------|
| `GEMINI_API_KEY` | Google AI Studio anahtarınız |

`JWT_SECRET` ve `DATABASE_URL` Blueprint ile gelir.

### 4. Canlı URL

Deploy bitince: `https://gym-app-api-xxxx.onrender.com`  
Test: `https://gym-app-api-xxxx.onrender.com/health`

Bu URL’yi not edin: `________________________`

### 5. Veritabanı tabloları (migration)

Render Dashboard → **gym-app-db** → **Connect** → **External Database URL** kopyalayın.

Kendi bilgisayarınızda:

```powershell
cd gym-app-backend
$env:DATABASE_URL="postgresql://...."   # Render External URL
npm run migrate
```

`✅ Tüm migration dosyaları uygulandı` görmelisiniz.

---

## Bölüm 2 — APK build (≈20 dk)

### 1. Frontend API adresi

`gym-app-frontend\.env`:

```env
EXPO_PUBLIC_API_URL=https://gym-app-api-xxxx.onrender.com/api
```

`eas.json` içindeki `preview.env` satırını da aynı URL ile güncelleyin.

### 2. EAS

```powershell
npm install -g eas-cli
eas login
cd gym-app-frontend
eas build:configure
eas build -p android --profile preview
```

APK indir → Google Drive klasörüne yükle (afiş QR aynı kalır).

### 3. Test

Telefonda APK kur → kayıt ol → giriş (mobil veri veya herhangi Wi‑Fi).

---

## Bölüm 3 — Sunum günü

- [ ] `https://....onrender.com/health` açılıyor (ücretsiz planda 30–60 sn uyanma olabilir)
- [ ] Laptop’ta Docker **zorunlu değil**
- [ ] 5–6 kişi: internet + APK yeterli

---

## Sorun giderme

| Sorun | Çözüm |
|-------|--------|
| health 502 | Render deploy logları; `GEMINI_API_KEY`, `DATABASE_URL` |
| Migration hata | `DATABASE_URL` External URL; `npm run migrate` tekrar |
| Network Error (APK) | `.env` ve `eas.json` URL `https://.../api` mi? Yeniden build |
| İlk istek yavaş | Free tier uyandırma; sunum öncesi health’e istek atın |

---

## Yerel geliştirme

Docker ile yerelde çalışmaya devam: `docker compose up -d`  
Bulut URL’li APK yerelde `EXPO_PUBLIC_API_URL` ile buluta gider.
