# 🏋️ Gym App - Full Stack Mobile Application

Modern bir gym yönetim uygulaması. React Native (Expo) frontend, Node.js backend, PostgreSQL, Redis ve Docker Compose ile geliştirilmiştir. Takım çalışması için Git ve Docker Compose ile kolay kurulum sunar.

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Teknolojiler](#-teknolojiler)
- [Gereksinimler](#-gereksinimler)
- [Git ile Başlama](#-git-ile-başlama)
- [Ortam Değişkenleri (.env)](#-ortam-değişkenleri-env)
- [Docker ile Hızlı Başlangıç](#-docker-ile-hızlı-başlangıç)
- [Frontend (Expo) Geliştirme](#-frontend-expo-geliştirme)
- [Tema (Açık / Koyu)](#-tema-açık--koyu)
- [Backend (Opsiyonel) Manuel Çalıştırma](#-backend-opsiyonel-manuel-çalıştırma)
- [PgAdmin ve Veritabanı](#-pgadmin-ve-veritabanı)
- [AI Asistan (Google Gemini) Kurulumu](#-ai-asistan-google-gemini-kurulumu)
- [Veritabanı Migration ve Tablo Oluşturma](#-veritabanı-migration-ve-tablo-oluşturma)
- [Proje Yapısı](#-proje-yapısı)
- [Sorun Giderme](#-sorun-giderme)
- [Son Güncellemeler](#-son-güncellemeler)
- [Katkıda Bulunma](#-katkıda-bulunma)

## ✨ Özellikler

### Uygulama (Mobil)

- 🔐 Kullanıcı kaydı ve girişi
- 📱 React Native mobil uygulama
- 🏠 Ana sayfa: özet ve hızlı erişim
- 🏋️ Egzersizler: programlar, detay sayfası, AI ile program oluşturma
- 🥗 Beslenme / diyet: planlar, AI asistan sekmesi, beslenme yardımcıları
- 💧 Su takibi: haftalık kart ve yerel depolama (`WaterWeeklyCard`, `waterStorage`)
- 🚶 Adım özeti ekranı (`Steppage`)
- 👤 Profil: kullanıcı bilgileri, üyelik, görünüm seçimi
- 🏆 Başarımlar: rozetler, XP, seviye (`AchievementsPage`)
- 🎨 Açık / koyu tema desteği (AsyncStorage ile kalıcı)
- 📅 Antrenman süresi takibi (kayıt tarihinden itibaren)

### Sunucu

- 🚀 Node.js REST API
- 🗄️ PostgreSQL veritabanı
- 🔴 Redis önbellek / yardımcı servis
- 🔒 JWT token authentication
- 📊 Clean Architecture (DDD)
- 🤖 AI Asistan - Beslenme önerileri ve soru-cevap
- 📄 Swagger dokümantasyonu (`/api-docs`)

## 🛠️ Teknolojiler

### Frontend
- **React Native** - Mobil uygulama framework'ü
- **Expo 54** - Geliştirme ve deployment platformu
- **JavaScript** - Uygulamanın ana kaynak dili
- **Axios** - HTTP client
- **AsyncStorage** - Local storage
- **Redux Toolkit** - State management

> Not: Frontend ana kaynak kodu JavaScript (`.js`) dosyalarıdır. Önceki bazı dokümanlarda geçen “TypeScript” ifadesi bu repo için güncel değildir.

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - İlişkisel veritabanı
- **Redis** - Önbellek / yardımcı servis
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Password hashing
- **Swagger** - API dokümantasyonu
- **Google Gemini API** - Yapay zeka entegrasyonu (gemini-2.5-flash, gemini-2.5-pro)

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## 📋 Gereksinimler

### Sistem Gereksinimleri
- **Node.js** (v18+ önerilir)
- **npm**
- **Docker Desktop** (Compose ile postgres + redis + backend + pgadmin)
- **Git**

### Mobil Geliştirme
- **Expo CLI** (`npm install -g @expo/cli`)
- **Expo Go** uygulaması (Android/iOS) veya emülatör

## 🔧 Git ile Başlama

Takımınızla çalışmak için bu adımları izleyin (ilk kez kurulum yapan kişi için):

```bash
# 1) Yeni bir GitHub reposu oluşturun (boş, README olmadan)

# 2) Yerelde repo başlatın ve ilk commit'i yapın
git init
git add .
git commit -m "chore: initial project import"

# 3) Uzak repo adresini ekleyin ve gönderin
git remote add origin https://github.com/<org-or-username>/<repo-name>.git
git branch -M main
git push -u origin main

# 4) Takım arkadaşları repo'yu klonlar
git clone https://github.com/<org-or-username>/<repo-name>.git
cd <repo-name>
```

Branch akışı önerisi:
- `main`: kararlı sürüm
- `dev`: entegrasyon
- `feature/*`: özellik geliştirme dalları

### 5. Manuel Kurulum (Docker olmadan)

Eğer Docker kullanmak istemiyorsanız:

#### Backend
```bash
cd gym-app-backend
npm install
npm start
```

#### Frontend
```bash
cd gym-app-frontend
npm install
npm start
```

#### Veritabanı
```bash
# PostgreSQL'i manuel olarak kurun ve çalıştırın
# Port: 5432, Database: gym_app_db, User: postgres, Password: postgres
```

## 🔐 Ortam Değişkenleri (.env)

Repoda gerçek şifre ve API anahtarı tutulmaz. `.env`, `gym-app-backend/.env`, `gym-app-frontend/.env` dosyaları Git'e eklenmemelidir. Mümkünse `.env.example` dosyaları şablon olarak kullanılmalıdır.

### 1. Proje kökü — `.env` (Docker Compose)

`docker-compose.yml` içindeki `backend` servisi kök dizindeki `.env` dosyasını okur.

En önemli alan:
- `GEMINI_API_KEY` — Google AI Studio anahtarı

Örnek:
```env
GEMINI_API_KEY=your-gemini-api-key-here
```

### 2. Backend — `gym-app-backend/.env` (Docker olmadan)

Backend'i yerelde çalıştıracaksanız aşağıdaki alanlar gerekir:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gym_app_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-strong-secret
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your-gemini-api-key-here
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

İsteğe bağlı alanlar:
- `REDIS_CONNECT_TIMEOUT_MS`
- `REDIS_TTL_*_SECONDS`

### 3. Frontend — `gym-app-frontend/.env` (Opsiyonel)

Mobil uygulamanın API adresini sabitlemek için:

```env
EXPO_PUBLIC_API_URL=http://BILGISAYAR_IP:3000/api
```

### Git’e push etmeden önce

1. `git status` ile `.env` dosyalarının eklenmediğini doğrulayın
2. API anahtarı yanlışlıkla repoya girdiyse ilgili sağlayıcıdan iptal edilip yenilenmelidir
3. `.env.example` dosyaları varsa bunlar şablon olarak kullanılmalıdır

## 🐳 Docker ile Hızlı Başlangıç

Proje kök dizininde (bu dosyanın bulunduğu yer):

```bash
# Servisleri arka planda başlatın
docker compose up -d

# (İlk kurulumda image build etmek için)
docker compose up -d --build

# Container durumunu görün
docker compose ps

# Belirli bir servisin loglarını takip edin (örn. backend)
docker compose logs -f backend

# Tüm servisleri durdurun ve kaldırın
docker compose down
```

**Önemli:** İlk kez `docker compose up -d` çalıştırdığınızda, veritabanı migration dosyaları otomatik olarak çalıştırılır ve tüm tablolar oluşturulur. Detaylar için [Veritabanı Migration](#-veritabanı-migration-ve-tablo-oluşturma) bölümüne bakın.

### Servisler

| Servis | Açıklama |
|--------|----------|
| `postgres` | Veritabanı `gym_app_db`, init script’ler `gym-app-database/` |
| `redis` | Önbellek / yardımcı servis (`6379`) |
| `backend` | API `http://localhost:3000` |
| `pgadmin` | `http://localhost:5050` — giriş: `admin@gymapp.com` / `admin123` |

İlk `up` ile boş volume üzerinde SQL init dosyaları çalışır. Veriyi sıfırlamak için:

```bash
docker compose down -v
```

Erişim adresleri:
- **Backend API**: http://localhost:3000
- **PgAdmin**: http://localhost:5050 (kullanıcı: `admin@gymapp.com`, şifre: `admin123`)
- **Frontend (Expo)**: Terminalde çıkan QR kod ile Expo Go'dan açın

## 📱 Kullanım

### Backend API

Backend şu adreslerde çalışır:
- **API Base URL**: `http://localhost:3000/api`
- **Health Check**: `http://localhost:3000/health`
- **Swagger UI**: `http://localhost:3000/api-docs`

## 📱 Frontend (Expo) Geliştirme

```bash
cd gym-app-frontend
npm install
npx expo start
```

`package.json` içinde `prestart` ile `scripts/set-api-url.js` çalışır; API adresi geliştirme ortamına göre ayarlanır.

API tabanı `gym-app-frontend/src/services/api.js` içinde ayarlanır. Gerçek cihazda test için bilgisayar IP'nizi kullanın:

```js
// src/services/api.js
const baseURL = "http://192.168.1.102:3000/api";
```

### API Test

Backend ayakta iken `http://localhost:3000/health` veya mevcut endpointleri kullanarak test edebilirsiniz.

## 🎨 Tema (Açık / Koyu)

Projede açık ve koyu tema desteği bulunmaktadır.

- **Context:** `gym-app-frontend/src/theme/ThemeContext.js`
- **Paletler:** `gym-app-frontend/src/theme/palettes.js`
- **Kalıcılık:** `@gym_app_theme_mode` (AsyncStorage)

Tema; `Layout`, navigasyon, `HomePage`, `DietPage`, `ExercisesPage`, `ProfilePage`, `LoginPage`, `SignupPage`, `Steppage`, `AchievementsPage`, `ExercisesDetailPage`, `WaterWeeklyCard` gibi ekran ve bileşenlerde kullanılmaktadır.

Kullanıcı tercihi Profil ekranından değiştirilebilir.

## 🖥️ Backend (Opsiyonel) Manuel Çalıştırma

PostgreSQL ve Redis’in yerel veya uzak olarak ayakta olduğu varsayılarak:

```bash
cd gym-app-backend
npm install
npm start
```

## 🗄️ PgAdmin ve Veritabanı

PgAdmin ile veritabanını yönetebilirsiniz:
1. `http://localhost:5050` adresini açın
2. Giriş bilgileri: Email: `admin@gymapp.com`, Parola: `admin123`
3. Sol menüden Servers > Register > Server
4. General > Name: `gym-app-db`
5. Connection > Host: `postgres`, Port: `5432`, Username: `postgres`, Password: `postgres`

Not: `Host` alanında `postgres` kullanmamızın sebebi, Docker Compose ağında veritabanı servisi adının `postgres` olmasıdır.

## 🤖 AI Asistan (Google Gemini) Kurulumu

Projede beslenme önerileri ve soru-cevap için Google Gemini API entegrasyonu bulunmaktadır. Gemini API, OpenAI'ye göre daha uygun fiyatlı bir alternatiftir.

### 1. Google Gemini API Key Alma

1. **Google AI Studio hesabı oluşturun:**
   - https://aistudio.google.com/ adresine gidin
   - Google hesabınızla giriş yapın

2. **API Key oluşturun:**
   - Sol menüden "Get API key" veya "API Keys" seçeneğine tıklayın
   - "Create API key" butonuna tıklayın
   - Oluşturulan key'i kopyalayın (bir daha gösterilmeyecek!)

3. **Ücretsiz Kullanım:**
   - **Not:** Gemini API ücretsiz tier sunmaktadır (günlük limitlerle)
   - Ücretsiz kullanım için herhangi bir kredi kartı eklemenize gerek yok
   - Daha fazla kullanım için Google Cloud Console'dan billing ayarlayabilirsiniz

### 2. Proje Kök Dizinde .env Dosyası Oluşturma

**⚠️ ÖNEMLİ:** API key'ler artık kod dosyalarında hardcoded değil, güvenlik için `.env` dosyasında saklanıyor.

Proje kök dizininde `.env` adında bir dosya oluşturun:

```env
# Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key-here
```

**Adımlar:**

1. **Proje kök dizininde `.env` dosyası oluşturun:**
   ```bash
   # Windows PowerShell'de örnek:
   New-Item -Path ".env" -ItemType File
   ```

2. **Dosyayı açın ve API key'inizi ekleyin:**
   ```
   GEMINI_API_KEY=AIzaSy... (kendi key'inizi buraya yapıştırın)
   ```

3. **Dosyayı UTF-8 encoding ile kaydedin (BOM olmadan):**
   - VS Code/Cursor'da: Sağ alttaki encoding'i tıklayın → "Save with Encoding" → **"UTF-8"** seçin
   - Notepad'te: "Farklı Kaydet" → Encoding: **"UTF-8"** seçin

**⚠️ ÖNEMLİ GÜVENLİK NOTLARI:**
- `.env` dosyası `.gitignore`'da olduğu için Git'e commit edilmeyecek
- **ASLA** API key'leri kod dosyalarına hardcoded olarak yazmayın
- API key'inizi başkalarıyla paylaşmayın
- Eğer API key'iniz GitHub'a açığa çıkarsa, hemen Google AI Studio'dan revoke edin ve yeni bir key oluşturun

### 3. Docker Container'ları Başlatma

`.env` dosyasını oluşturduktan sonra Docker container'larını başlatın:

```bash
# Container'ları başlatın (ilk kez build için)
docker compose up -d --build

# Veya sadece başlatmak için
docker compose up -d
```

**Not:** `docker-compose.yml` dosyası otomatik olarak `.env` dosyasını okur ve `GEMINI_API_KEY` değişkenini container'a aktarır.

### 4. Kullanılan Modeller

Proje, Google Gemini API'nin v1 endpoint'ini kullanır ve şu modelleri sırayla dener:

1. **gemini-2.5-flash** (Öncelikli) - En hızlı ve ucuz model
2. **gemini-2.5-pro** - Daha karmaşık işler için
3. **gemini-2.0-flash** - Yedek flash model
4. **gemini-2.0-flash-001** - Alternatif

Sistem otomatik olarak çalışan ilk modeli kullanır. Eğer bir model başarısız olursa, bir sonrakini dener.

**Önemli:** SDK otomatik olarak v1 API endpoint'ini kullanır. Eski v1beta API kullanılmaz.

### 5. AI Özelliklerini Kullanma

1. **Frontend'de Beslenme sayfasına gidin**
2. **"🤖 AI Asistan" sekmesine tıklayın**
3. **İki özellik kullanılabilir:**
   - **💬 Soru Sor:** Beslenme ile ilgili sorular sorabilirsiniz
   - **📋 Kişiselleştirilmiş Plan:** AI tarafından oluşturulan beslenme planı

### 6. Sorun Giderme

#### "Gemini API key yapılandırılmamış" Hatası

Bu hata, `.env` dosyasında `GEMINI_API_KEY` değerinin bulunamadığını gösterir. Çözüm:

1. **`.env` dosyasının varlığını kontrol edin**
2. **`.env` dosyasının içeriğini kontrol edin**
3. **Dosya encoding'ini kontrol edin**
4. **Container'ı yeniden başlatın:**
   ```bash
   docker compose restart backend
   ```

#### "404 Not Found - models/... is not found" Hatası

Bu hata, API key'in geçersiz olduğunu veya model adının yanlış olduğunu gösterir. Çözüm:
- Google AI Studio'dan yeni bir API key oluşturun
- `.env` dosyasındaki `GEMINI_API_KEY` değerini güncelleyin
- `docker compose restart backend`

#### "Gemini API kotası aşıldı" Hatası
- Google AI Studio hesabınızda günlük limitinizi kontrol edin
- Ücretsiz tier'da günlük limitler vardır, ertesi gün sıfırlanır
- Daha fazla kullanım için Google Cloud Console'dan billing ayarlayın

#### "Gemini API anahtarı geçersiz" Hatası
- `.env` dosyasındaki `GEMINI_API_KEY` değerini kontrol edin
- API key'in doğru kopyalandığından emin olun
- Yeni bir key oluşturmayı deneyin
- `docker compose restart backend`

#### "Cannot find module '@google/generative-ai'" Hatası
- Container'ı yeniden build edin
- `npm install` komutunu backend klasöründe çalıştırın

#### "Tüm modeller başarısız" Hatası
- `.env` dosyasındaki `GEMINI_API_KEY` değerini kontrol edin
- Google AI Studio'da API key'inizin aktif olduğundan emin olun
- `docker compose logs -f backend`

### 7. AI Özelliklerini Devre Dışı Bırakma

Eğer Gemini API kullanmak istemiyorsanız:
- `.env` dosyasından `GEMINI_API_KEY` satırını kaldırın veya boş bırakın
- Uygulama çalışmaya devam eder, sadece AI özellikleri çalışmaz
- Backend loglarında uyarı görebilirsiniz

### 8. Firebase API Key (Opsiyonel - Frontend için)

Eğer Firebase kullanıyorsanız, frontend için de environment variable ekleyebilirsiniz:

**Frontend `.env` dosyası oluşturun** (`gym-app-frontend/.env`):
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key-here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

**Not:** Firebase API key'leri client-side'da kullanıldığı için public olabilir, ancak yine de environment variable kullanmak best practice'dir.

## 🗃️ Veritabanı Migration ve Tablo Oluşturma

### Otomatik Migration (İlk Kurulum)

Proje `docker compose up` ile ilk kez çalıştırıldığında, `gym-app-backend/gym-app-database/` klasöründeki tüm SQL dosyaları **otomatik olarak** çalıştırılır ve tablolar oluşturulur.

**Yeni Kullanıcılar için:**
```bash
# İlk kez çalıştırma - Tüm tablolar otomatik oluşturulur!
docker compose up -d
```

**Önemli Notlar:**
- Migration dosyaları sadece **ilk başlatmada** (veritabanı volume'u boşken) çalışır
- Eğer veritabanı daha önce oluşturulduysa, migration dosyaları tekrar çalışmaz
- Mevcut veritabanını sıfırlamak için (⚠️ TÜM VERİLER SİLİNİR):

```bash
docker compose down -v
docker compose up -d
```

### Manuel Migration (Gerekirse)

Eğer migration dosyalarını manuel olarak çalıştırmak isterseniz:

```bash
docker compose exec postgres psql -U postgres -d gym_app_db -f /docker-entrypoint-initdb.d/06_add_goal_to_user_details.sql
```

### Yeni Migration Ekleme

Yeni bir migration eklemek için:
1. `gym-app-backend/gym-app-database/` klasörüne yeni bir SQL dosyası ekleyin
2. Dosya adını numara ile başlatın (örn: `07_add_new_column.sql`)
3. Dosyalar alfabetik sırayla çalıştırılır, numaralandırma önemlidir
4. Git'e commit ve push yapın
5. Takım arkadaşları `docker compose down -v && docker compose up -d` ile güncellemeleri alabilir

### Ek Tablo Notları

Örnek güncel tablolar:
- başarımlar (`14_achievements.sql`)
- XP defteri (`15_user_xp_ledger.sql`)
- üyelik, avatar, beslenme ve AI egzersiz programı tabloları

## 🔐 Örnek Auth İstekleri

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

## 🏗️ Proje Yapısı

```text
BitirmeProjeNewFrontend/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── gym-app-backend/
│   ├── src/
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── presentation/
│   ├── gym-app-database/
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
└── gym-app-frontend/
    ├── App.js
    ├── package.json
    ├── scripts/
    │   └── set-api-url.js
    └── src/
        ├── theme/
        │   ├── ThemeContext.js
        │   └── palettes.js
        ├── navigation/
        ├── screens/
        ├── components/
        ├── services/
        ├── redux/
        ├── storage/
        └── utils/
```

## 🔧 Sorun Giderme

### Backend Sorunları

#### Veritabanı Bağlantı Hatası
```bash
docker compose ps
docker compose down
docker compose up -d
```

#### Redis Sorunları
- Backend manuel çalıştırılıyorsa Redis bağlantısını da kontrol edin
- Docker kullanıyorsanız `docker compose ps` ile `redis` servisinin ayakta olduğundan emin olun

#### Port Zaten Kullanımda
```bash
# Windows örneği
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

### Frontend Sorunları

#### Metro Bundler Hatası
```bash
npx expo start --clear
rm -rf node_modules
npm install
```

#### Network Bağlantı Hatası
- Backend'in çalıştığından emin olun
- API URL'inin doğru olduğunu kontrol edin
- Firewall ayarlarını kontrol edin

### Docker Sorunları

#### Docker Desktop Çalışmıyor
- Docker Desktop'ı yeniden başlatın
- Windows'ta WSL2'nin etkin olduğundan emin olun

#### Container Başlamıyor
```bash
docker compose logs
docker compose up --build -d
```

## 🌐 Network Konfigürasyonu

### Gerçek Cihaz İçin

1. **Bilgisayarınızın IP adresini öğrenin:**
```bash
ipconfig
```

2. **API URL'ini güncelleyin:**
```typescript
const baseURL = 'http://YOUR_IP:3000/api';
```

3. **Cihaz ve bilgisayarın aynı Wi-Fi ağında olduğundan emin olun**

### Emülatör İçin

```typescript
const baseURL = 'http://10.0.2.2:3000/api';
```

## 🚀 Production Deployment

### Backend Deployment (Özet)

1. Environment değişkenlerini ayarlayın (DB bilgileri, JWT, Redis ve Gemini bilgileri)
2. Docker image oluşturun ve bir registry'e push edip orkestrasyon ortamında çalıştırın

### Frontend Deployment (Özet)

1. Expo EAS ile build alın (`eas build -p android/ios`)
2. Mağazalara yükleyin veya dağıtın

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Anlamlı commit mesajları kullanın
4. Commit yapın (`git commit -m 'Add amazing feature'`)
5. Push yapın (`git push origin feature/amazing-feature`)
6. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 İletişim

- **Geliştirici**: Takımınız
- **Email**:
- **GitHub**:

---

## 📝 Son Güncellemeler

### 🆕 2026 - Tema Sistemi ve UI Uyumu

- Açık / koyu tema tüm uygulama genelinde `ThemeContext` + paletler ile birleştirildi
- Giriş / kayıt, ana sekmeler, diyet, egzersiz, profil, adım özeti, başarımlar ve egzersiz detay ekranları tema ile uyumlu hale getirildi
- Navigasyon ve durum çubuğu tema ile uyumlu çalışacak şekilde düzenlendi
- Tema tercihi `AsyncStorage` ile saklanıyor

### 🔄 Veri Modeli ve Altyapı Güncellemeleri

- Başarımlar, XP, üyelik, avatar, beslenme ve AI egzersiz programı tabloları eklendi
- Redis Docker ile projeye dahil edildi

### 🆕 2025-11-25 - Gemini API Güncellemeleri

#### ✨ Yeni Özellikler

1. **🔒 Güvenlik İyileştirmeleri**
   - API key'ler artık kod dosyalarında hardcoded değil
   - Tüm API key'ler `.env` dosyasına taşındı
   - `.env` dosyası `.gitignore`'da
   - GitHub secret scanning uyarıları önlendi

2. **🔄 Model Fallback Mekanizması**
   - Birden fazla model sırayla denenir
   - İlk çalışan model otomatik kullanılır
   - Hata durumunda bir sonraki modele geçer
   - Tüm modeller başarısız olursa detaylı hata mesajı verir

3. **📊 Güncel Model Desteği**
   - `gemini-2.5-flash` (öncelikli, test edildi ✅)
   - `gemini-2.5-pro`
   - `gemini-2.0-flash`
   - `gemini-2.0-flash-001`

#### 🔧 Teknik İyileştirmeler

- SDK artık v1 API endpoint'ini kullanıyor
- v1beta API sorunları giderildi
- ListModels API ile mevcut modeller kontrol ediliyor
- `AIService.js` refactor edildi
- JSON temizleme yardımcı fonksiyonu eklendi
- Hata yönetimi merkezileştirildi

### 📅 2025-11-07 - İlk Gemini Entegrasyonu

#### ✨ Yeni Özellikler

1. **🤖 AI Asistan Entegrasyonu**
   - Beslenme sayfasına AI Asistan sekmesi eklendi
   - Kullanıcılar beslenme ile ilgili sorular sorabilir
   - AI tarafından kişiselleştirilmiş beslenme planları oluşturulabilir
   - Google Gemini API kullanılıyor
   - Kullanıcı bilgilerine göre özelleştirilmiş öneriler

2. **📅 Antrenman Süresi Takibi**
   - Profil sayfasında kullanıcının kayıt tarihinden itibaren geçen gün sayısı gösteriliyor
   - "X gündür gym app ile antrenman yapıyorsunuz 💪" formatında mesaj
   - Otomatik hesaplama yapılıyor

#### 🔧 Teknik Değişiklikler

- **Backend:**
  - Google Gemini API paketi eklendi (`@google/generative-ai@^0.24.1`)
  - AI servisi oluşturuldu (`AIService.js`)
  - AI controller ve route'ları eklendi
  - Hata yönetimi iyileştirildi
  - OpenAI'den Gemini API'ye geçiş yapıldı

- **Frontend:**
  - DietPage'e AI Asistan sekmesi eklendi
  - API servisine AI endpoint'leri eklendi
  - ProfilePage'de antrenman süresi hesaplama fonksiyonu eklendi

- **Docker:**
  - Backend servisi docker-compose.yml'e eklendi
  - `.env` dosyası volume olarak mount edildi

## 🎯 Gelecek Özellikler

- [ ] Gym salonu yönetimi
- [ ] Antrenman takibi
- [ ] Üyelik yönetimi
- [ ] Push notifications
- [ ] Offline mode
- [ ] Social features
- [ ] AI ile antrenman programı önerileri
- [ ] AI ile ilerleme analizi

### Step Page

```bash
# Adım sayar (pedometer)
npx expo install expo-sensors

# Progress ring (SVG circle)
npx expo install react-native-svg

# Android Health Connect
npm install react-native-health-connect expo-health-connect
npm install -D expo-build-properties
```

### Android Build Notu

Android Health Connect entegrasyonu için development build gerekir. Gerekli durumlarda:

```bash
# JDK 17 önerilir
npx expo prebuild --platform android
npx expo run:android
```

---

**Not**: Bu proje eğitim amaçlı geliştirilmiştir. Production kullanımı için ek güvenlik önlemleri alınması önerilir.
