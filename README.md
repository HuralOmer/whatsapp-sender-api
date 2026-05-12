# WhatsApp Sender License API

Excel/VBA + `sender.exe` tabanlı WhatsApp toplu mesaj gönderme uygulaması için Node.js lisans kontrol API'si.

MVP/demo aşamasında Vercel serverless endpointleri kullanılır. İş mantığı Vercel'e kilitli değildir:

- `api/`: İnce endpoint/controller katmanı
- `src/services/`: Lisans ve kullanım iş kuralları
- `src/repositories/`: Supabase tablo sorguları
- `src/utils/`: Ortak response, validasyon ve tarih yardımcıları

## Klasör Yapısı

```text
license-api/
├─ api/
│  ├─ license/
│  │  ├─ activate.js
│  │  └─ check.js
│  └─ usage/
│     └─ increment.js
├─ src/
│  ├─ config/
│  │  └─ env.js
│  ├─ lib/
│  │  └─ supabaseClient.js
│  ├─ repositories/
│  │  ├─ licenseRepository.js
│  │  ├─ deviceRepository.js
│  │  ├─ usageRepository.js
│  │  └─ logRepository.js
│  ├─ services/
│  │  ├─ licenseService.js
│  │  └─ usageService.js
│  └─ utils/
│     ├─ apiResponse.js
│     ├─ validators.js
│     └─ date.js
├─ package.json
├─ vercel.json
├─ .env.example
└─ README.md
```

## Kurulum

```bash
npm install
```

Local geliştirme için Vercel CLI proje bağımlılığı olarak eklenmiştir.

```bash
npx vercel dev
```

Vercel dev varsayılan olarak `http://localhost:3000` adresinde çalışır.

## .env Ayarları

`.env.example` dosyasını `.env` olarak kopyalayın:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_VERSION=1.0.0
NODE_ENV=development
```

Local test için `license-api` kök klasöründe `.env.local` dosyası oluşturulmalıdır:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_VERSION=1.0.0
NODE_ENV=development
```

Güvenlik notları:

- `SUPABASE_SERVICE_ROLE_KEY` Excel/VBA içine yazılmamalıdır.
- `SUPABASE_SERVICE_ROLE_KEY` `sender.exe` içine gömülmemelidir.
- EXE sadece API endpoint adresini bilmelidir.
- Lisans kararını EXE/VBA değil API vermelidir.

## Vercel Environment Variables

Vercel panelinde şu environment variable değerleri eklenmelidir:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_VERSION`

## Local Test

Örnek test lisansı:

- `license_key`: `TEST-1234-ABCD-5678`
- `customer_email`: `omer@example.com`
- Plan: `Starter`
- `max_devices`: `1`
- `daily_message_limit`: `50`

### POST /api/license/activate

```json
{
  "license_key": "TEST-1234-ABCD-5678",
  "customer_email": "omer@example.com",
  "device_fingerprint": "test-device-001",
  "device_name": "Omer Test PC",
  "app_version": "1.0.0"
}
```

```bash
curl -X POST http://localhost:3000/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "TEST-1234-ABCD-5678",
    "customer_email": "omer@example.com",
    "device_fingerprint": "test-device-001",
    "device_name": "Omer Test PC",
    "app_version": "1.0.0"
  }'
```

Başarılı response:

```json
{
  "ok": true,
  "code": "LICENSE_ACTIVATED",
  "message": "Lisans başarıyla doğrulandı.",
  "license": {
    "license_key": "TEST-1234-ABCD-5678",
    "customer_email": "omer@example.com",
    "status": "active",
    "expires_at": null
  },
  "plan": {
    "name": "Starter",
    "max_devices": 1,
    "daily_message_limit": 50
  },
  "device": {
    "device_fingerprint": "test-device-001",
    "device_name": "Omer Test PC",
    "status": "active"
  },
  "usage": {
    "usage_date": "YYYY-MM-DD",
    "used_today": 0,
    "remaining_today": 50
  }
}
```

### POST /api/license/check

```json
{
  "license_key": "TEST-1234-ABCD-5678",
  "customer_email": "omer@example.com",
  "device_fingerprint": "test-device-001",
  "device_name": "Omer Test PC",
  "app_version": "1.0.0"
}
```

```bash
curl -X POST http://localhost:3000/api/license/check \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "TEST-1234-ABCD-5678",
    "customer_email": "omer@example.com",
    "device_fingerprint": "test-device-001",
    "device_name": "Omer Test PC",
    "app_version": "1.0.0"
  }'
```

Başarılı response:

```json
{
  "ok": true,
  "code": "LICENSE_VALID",
  "message": "Lisans geçerli.",
  "license": {
    "license_key": "TEST-1234-ABCD-5678",
    "customer_email": "omer@example.com",
    "status": "active",
    "expires_at": null
  },
  "plan": {
    "name": "Starter",
    "max_devices": 1,
    "daily_message_limit": 50
  },
  "device": {
    "device_fingerprint": "test-device-001",
    "device_name": "Omer Test PC",
    "status": "active"
  },
  "usage": {
    "usage_date": "YYYY-MM-DD",
    "used_today": 10,
    "remaining_today": 40
  }
}
```

### POST /api/usage/increment

Bu endpoint yalnızca başarılı WhatsApp mesaj gönderiminden sonra çağrılmalıdır. Başarısız numara, dosya hatası, WhatsApp hatası veya limit nedeniyle gönderilmeyen satırlar kullanım hakkından düşülmemelidir.

```json
{
  "license_key": "TEST-1234-ABCD-5678",
  "customer_email": "omer@example.com",
  "device_fingerprint": "test-device-001",
  "increment_by": 1,
  "app_version": "1.0.0"
}
```

```bash
curl -X POST http://localhost:3000/api/usage/increment \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "TEST-1234-ABCD-5678",
    "customer_email": "omer@example.com",
    "device_fingerprint": "test-device-001",
    "increment_by": 1,
    "app_version": "1.0.0"
  }'
```

Başarılı response:

```json
{
  "ok": true,
  "code": "USAGE_INCREMENTED",
  "message": "Günlük kullanım güncellendi.",
  "usage": {
    "usage_date": "YYYY-MM-DD",
    "used_today": 11,
    "remaining_today": 39
  }
}
```

## Hata Response Formatı

```json
{
  "ok": false,
  "code": "LICENSE_EXPIRED",
  "message": "Lisans süreniz dolmuştur. Lütfen yeni lisans alın."
}
```

Email eşleşmezse API şu hata kodunu döndürür:

```json
{
  "ok": false,
  "code": "LICENSE_EMAIL_MISMATCH",
  "message": "Lisans e-posta adresi eşleşmiyor."
}
```

HTTP status önerileri bu projede uygulanır:

- `200`: Başarılı işlem
- `400`: Validasyon hatası
- `401`: Lisans yok/geçersiz/süresi dolmuş
- `403`: Blocked, cihaz limiti, plan pasif, günlük limit
- `405`: Method not allowed
- `500`: Internal server error

## Client/AppData Notu

EXE tarafında AppData içine lisans bilgisi yazılırken `license_key` yanında normalize edilmiş `customer_email` de saklanmalıdır. Sonraki `/api/license/check` ve `/api/usage/increment` çağrılarında ikisi birlikte gönderilmelidir. API email değerini trim + lowercase normalize eder ve `licenses.customer_email` ile eşleştirir.

## Supabase Tabloları Varsayımı

Supabase project name: `whatsappSender`

Bu API şu hazır tabloları kullanır:

- `public.plans`
- `public.licenses`
- `public.license_devices`
- `public.license_daily_usage`
- `public.license_logs`

Önemli unique constraint'ler:

- `license_devices`: `unique (license_id, device_fingerprint)`
- `license_daily_usage`: `unique (license_id, usage_date)`

## Deploy

Vercel CLI ile deploy:

```bash
vercel
```

Production deploy:

```bash
vercel --prod
```

Deploy öncesinde Vercel Environment Variables kısmına Supabase değerlerini ekleyin.

## Production'a Taşıma Notu

Bu proje Vercel'e kilitli yazılmadı. Production aşamasında VPS/Docker/Express server yapısına geçerken:

- `src/services` aynı kalabilir.
- `src/repositories` aynı Supabase erişimini kullanmaya devam edebilir.
- `api/*` handler dosyaları yerine Express route/controller dosyaları yazılır.
- Request body ve response formatı korunursa `sender.exe` tarafı minimum değişiklikle çalışır.
- `usage increment` akışı production'da Supabase RPC veya transaction benzeri atomik yöntemle güçlendirilmelidir.
