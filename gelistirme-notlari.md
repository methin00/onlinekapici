# Geliştirme Notları

- Supabase bağlantısında uygulama çalışırken Prisma istemcisi `pg` bağdaştırıcısı ile kullanılacak.
- Bu projede Windows ortamında Prisma komutlarının doğrudan `db push` ve benzeri şema işlemlerinde `P1001` hatasına düşme durumu var.
- Projede düzenlenen uygun tüm dosyalarda Türkçe karakterler korunacak ve Türkçe metinler ASCII biçimine çevrilmeyecek.
- Şema değişikliği gerektiğinde önce veritabanı yedeği alınacak.
- Şema uygulama işlemleri gerekirse doğrudan PostgreSQL üzerinden yapılacak.
- Uygulama çalışma zamanı için bağlantı havuzu kullanılacak.
- Bu not sonraki geliştirme oturumlarında aynı bağlantı sorununu tekrar yaşamamak için tutuluyor.
