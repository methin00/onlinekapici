# Online Kapıcı

Online Kapıcı, Supabase tabanlı giriş kontrolü ve site yönetim uygulamasıdır.

## Mimari

- `apps/web`: Next.js App Router arayüzü
- `supabase/schema.sql`: veritabanı şeması, RLS kuralları ve tetikleyiciler
- `apps/web/scripts/seed-supabase.ts`: örnek kullanıcılar ve örnek veri kurulumu
- Kimlik doğrulama, veritabanı, gerçek zamanlı güncellemeler ve işlem kayıtları doğrudan Supabase üzerinden çalışır

## Ekranlar

- `/`: ürün vitrini ve yönlendirme
- `/auth`: rol bazlı giriş ekranı
- `/tablet`: giriş terminali
- `/resident`: sakin uygulaması
- `/dashboard`: yönetim ve operasyon ekranı

## Kurulum

1. `.env.example` dosyasını temel alarak Supabase bilgilerinizi girin.
2. [supabase/schema.sql](./supabase/schema.sql) dosyasını Supabase SQL Editor içinde çalıştırın.
3. Örnek hesapları yüklemek için `npm run seed:supabase -w apps/web` komutunu çalıştırın.
4. Uygulamayı başlatmak için `npm run dev` komutunu kullanın.

## Notlar

- Kapı açma işlemleri ilk fazda simülasyon olarak `gate_events` tablosuna kaydedilir.
- Kiosk, sakin ve yönetim ekranları aynı Supabase veri akışını paylaşır.
- Demo giriş bilgileri giriş ekranında otomatik doldurulur.
