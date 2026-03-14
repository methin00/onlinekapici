# Online Kapıcı

Kurumsal görünümlü, çok kiracılı bir bina giriş yönetimi MVP iskeleti.

## Seçilen Mimari

- `apps/web`: Next.js App Router tabanlı arayüz
- `apps/api`: Express + Socket.io tabanlı backend
- `apps/api/prisma/schema.prisma`: PostgreSQL için çok kiracılı veri modeli
- Yetkilendirme: `x-api-key` veya JWT
- Tenant izolasyonu: her API isteği `buildingId` bağlamıyla sınırlandırılır

## Ekranlar

- `/`: ürün vitrini ve rol bazlı girişler
- `/tablet`: girişteki tablet deneyimi
- `/resident`: sakin mobil arayüzü
- `/dashboard`: admin ve danışman paneli

## API Uçları

- `GET /health`
- `GET /api/residents/search?query=5`
- `GET /api/guest-calls`
- `POST /api/guest-calls`
- `POST /api/guest-calls/:callId/decision`
- `GET /api/admin/overview`
- `GET /api/admin/fallback-calls`

Korunan API örnek header'ları:

```http
x-api-key: dev-online-kapici-key
x-building-id: bldg-001
x-user-role: concierge
```

## Kurulum

1. Kök dizinde `.env.example` dosyasını `.env` olarak kopyalayın.
2. Gerekirse `apps/api/.env.example` içeriğini de API ortam değişkenleri için kullanın.
3. Geliştirme modunu çalıştırın:

```bash
npm run dev
```

Tek tek başlatmak için:

```bash
npm run dev -w apps/api
npm run dev -w apps/web
```

## MVP Notları

- Bildirim servisi şu an simüle edilir; Twilio WhatsApp Business API entegrasyonu için servis katmanı hazırlandı.
- Kapı açma çağrısı `ESP32_GATEWAY_URL` adresine HTTP ile gönderilir, başarısız olursa simüle moduna düşer.
- Prisma şeması PostgreSQL hedefiyle hazırdır; demo akış için in-memory store kullanılır.
- Gerçek zamanlı olaylar Socket.io oda mantığı ile bina bazında yayınlanır.

## Sonraki Adımlar

- Prisma migration ve seed akışını eklemek
- Twilio ve MQTT adaptörlerini canlı entegrasyona geçirmek
- QR doğrulama ve push notification uçlarını tamamlamak
- Web istemcisini API ve Socket.io ile canlı bağlamak
