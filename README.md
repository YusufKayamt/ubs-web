# UBS Danışmanlık – Kurumsal Web Sitesi

Savunma sanayii, medikal ve endüstriyel ekipman üreticilerine **MIL-STD-810, MIL-STD-461 ve MIL-STD-1275** kapsamında test danışmanlığı veren UBS Danışmanlık için geliştirdiğim kurumsal web sitesi ve içerik yönetim paneli.

## Özellikler

- **Çok dilli içerik:** Türkçe, İngilizce ve Arapça. Çevirisi girilmeyen alanlarda otomatik olarak Türkçe metin gösterilir.
- **Yönetim paneli (`/admin`):** Menü, hizmetler, referanslar, süreç adımları, değerler, özel bölümler ve site ayarları koddan bağımsız olarak panelden düzenlenir.
- **İletişim formu:** Gelen mesajlar panelde listelenir, okundu olarak işaretlenir veya silinir.
- **Görsel yönetimi:** Yüklenen görseller Supabase Storage'da saklanır.
- **SEO:** Açıklama etiketleri, `robots.txt` ve favicon.

## Güvenlik

- Yönetici şifresi `bcrypt` ile özetlenir, oturum JWT ile `httpOnly` çerezde tutulur.
- `helmet` ile güvenlik başlıkları, `express-rate-limit` ile istek sınırlama.
- CORS yalnızca tanımlı alan adına açıktır; istek gövdesi boyutu sınırlandırılmıştır.
- Tüm gizli bilgiler ortam değişkenlerinde tutulur (`.env.example`).

## Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| Ön yüz | HTML, CSS, JavaScript |
| Arka uç | Node.js, Express 5 (Vercel serverless fonksiyonu) |
| Veritabanı | PostgreSQL (Supabase) |
| Depolama | Supabase Storage |
| Yayın | Vercel |

## Kurulum

```bash
npm install
cp .env.example .env   # değerleri doldurun
npm run dev
```

Veritabanı tablolarını oluşturmak için `schema.sql` dosyasını Supabase SQL Editor'da çalıştırın.

## Proje Yapısı

```
├── api/
│   ├── index.js     # Express uygulaması ve REST uç noktaları
│   ├── db.js        # PostgreSQL bağlantı havuzu
│   └── storage.js   # Supabase Storage görsel yükleme/silme
├── public/
│   ├── index.html   # Site
│   └── admin.html   # Yönetim paneli
├── schema.sql
└── vercel.json
```

## Geliştirici

**Yusuf Mete Kaya** · [LinkedIn](https://www.linkedin.com/in/yusufmetekaya) · [GitHub](https://github.com/YusufKayamt)
