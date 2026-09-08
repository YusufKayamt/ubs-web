-- Supabase SQL Editor'da çalıştır. Güvenle tekrar çalıştırılabilir.

DROP TABLE IF EXISTS Hizmetler CASCADE;
DROP TABLE IF EXISTS Menu CASCADE;
DROP TABLE IF EXISTS Ayarlar CASCADE;
DROP TABLE IF EXISTS Degerler CASCADE;
DROP TABLE IF EXISTS Surec CASCADE;
DROP TABLE IF EXISTS Mesajlar CASCADE;
DROP TABLE IF EXISTS Referanslar CASCADE;
DROP TABLE IF EXISTS OzelBolumler CASCADE;

-- NOT: _en ve _ar sütunları isteğe bağlıdır. Boş bırakılırsa sitede otomatik
-- olarak Türkçe metin gösterilir (yedekli/fallback mantığı).

CREATE TABLE Hizmetler (
    ID SERIAL PRIMARY KEY,
    HizmetAdi VARCHAR(255) NOT NULL,
    Aciklama VARCHAR(800),
    HizmetAdi_en VARCHAR(255),
    Aciklama_en VARCHAR(800),
    HizmetAdi_ar VARCHAR(255),
    Aciklama_ar VARCHAR(800),
    ResimYolu VARCHAR(500)
);

CREATE TABLE Menu (
    ID SERIAL PRIMARY KEY,
    Baslik VARCHAR(100) NOT NULL,
    Hedef VARCHAR(255) NOT NULL,
    Sira INT NOT NULL,
    Baslik_en VARCHAR(100),
    Baslik_ar VARCHAR(100)
);

CREATE TABLE Ayarlar (
    Anahtar VARCHAR(60) PRIMARY KEY,
    Deger VARCHAR(600)
);

CREATE TABLE Degerler (
    ID SERIAL PRIMARY KEY,
    Baslik VARCHAR(100) NOT NULL,
    Aciklama VARCHAR(300),
    Sira INT NOT NULL,
    Baslik_en VARCHAR(100),
    Aciklama_en VARCHAR(300),
    Baslik_ar VARCHAR(100),
    Aciklama_ar VARCHAR(300)
);

CREATE TABLE Surec (
    ID SERIAL PRIMARY KEY,
    Baslik VARCHAR(100) NOT NULL,
    Aciklama VARCHAR(300),
    Sira INT NOT NULL,
    Baslik_en VARCHAR(100),
    Aciklama_en VARCHAR(300),
    Baslik_ar VARCHAR(100),
    Aciklama_ar VARCHAR(300)
);

CREATE TABLE Referanslar (
    ID SERIAL PRIMARY KEY,
    Baslik VARCHAR(150) NOT NULL,
    Aciklama VARCHAR(500),
    Baslik_en VARCHAR(150),
    Aciklama_en VARCHAR(500),
    Baslik_ar VARCHAR(150),
    Aciklama_ar VARCHAR(500),
    ResimYolu VARCHAR(500),
    Sira INT NOT NULL
);

CREATE TABLE Mesajlar (
    ID SERIAL PRIMARY KEY,
    Ad VARCHAR(150) NOT NULL,
    Firma VARCHAR(150),
    Eposta VARCHAR(200) NOT NULL,
    Mesaj VARCHAR(2000) NOT NULL,
    Tarih TIMESTAMP DEFAULT now(),
    Okundu BOOLEAN DEFAULT false
);

-- Admin panelden serbestçe eklenen, kendi başlı başına bölümü ve üst menü
-- öğesi olan özel içerik blokları (ör. "Ekibimiz", "Sertifikalarımız" vb.)
CREATE TABLE OzelBolumler (
    ID SERIAL PRIMARY KEY,
    Slug VARCHAR(80) NOT NULL UNIQUE,
    Baslik VARCHAR(150) NOT NULL,
    Aciklama VARCHAR(2000),
    ResimYolu VARCHAR(500),
    Sira INT NOT NULL,
    MenuID INT,
    Baslik_en VARCHAR(150),
    Aciklama_en VARCHAR(2000),
    Baslik_ar VARCHAR(150),
    Aciklama_ar VARCHAR(2000)
);

-- Hizmetler
INSERT INTO Hizmetler (HizmetAdi, Aciklama, HizmetAdi_en, Aciklama_en, HizmetAdi_ar, Aciklama_ar) VALUES
(N'MIL-STD-810 Çevresel Testler', N'İklimlendirme, titreşim, irtifa, mekanik, toz, yağmurlama ve tuz sisi testleri ile ekipmanınızın sahada karşılaşacağı çevresel koşullara dayanıklılığını doğruluyoruz.',
 N'MIL-STD-810 Environmental Tests', N'We verify your equipment''s resistance to field conditions through climatic, vibration, altitude, mechanical, dust, rain and salt fog tests.',
 N'اختبارات بيئية MIL-STD-810', N'نتحقق من مقاومة معداتكم لظروف الميدان من خلال اختبارات المناخ والاهتزاز والارتفاع والميكانيكا والغبار والمطر ورذاذ الملح.'),
(N'MIL-STD-461 EMC/EMI Testleri', N'CE101, CE102, CS114, CS115, CS116, RE102, RS103 test metotları ile elektromanyetik uyumluluk ve girişim testleri.',
 N'MIL-STD-461 EMC/EMI Testing', N'Electromagnetic compatibility and interference testing using CE101, CE102, CS114, CS115, CS116, RE102, RS103 test methods.',
 N'اختبارات EMC/EMI حسب MIL-STD-461', N'اختبارات التوافق الكهرومغناطيسي والتداخل باستخدام طرق الاختبار CE101 وCE102 وCS114 وCS115 وCS116 وRE102 وRS103.'),
(N'MIL-STD-1275 Test Tasarımı ve Danışmanlığı', N'Araç elektrik güç karakteristiklerine uygunluk için test tasarımı, uygulama ve danışmanlık hizmeti.',
 N'MIL-STD-1275 Test Design & Consultancy', N'Test design, execution and consultancy services for compliance with vehicle electrical power characteristics.',
 N'تصميم واستشارات اختبار MIL-STD-1275', N'خدمات تصميم وتنفيذ الاختبارات والاستشارات للامتثال لخصائص الطاقة الكهربائية للمركبات.'),
(N'Medikal Cihazlar Test Hizmeti Danışmanlığı', N'Medikal cihazların ilgili standartlara uygunluğunun test edilmesi sürecinde uçtan uca danışmanlık.',
 N'Medical Device Testing Consultancy', N'End-to-end consultancy for testing medical devices for compliance with relevant standards.',
 N'استشارات اختبار الأجهزة الطبية', N'استشارات شاملة لاختبار الأجهزة الطبية للامتثال للمعايير ذات الصلة.'),
(N'Endüstriyel Cihazlar Test Hizmeti Danışmanlığı', N'Endüstriyel ekipman ve cihazların çevresel ve elektromanyetik uyumluluk testleri için danışmanlık.',
 N'Industrial Equipment Testing Consultancy', N'Consultancy for environmental and electromagnetic compatibility testing of industrial equipment and devices.',
 N'استشارات اختبار المعدات الصناعية', N'استشارات لاختبارات التوافق البيئي والكهرومغناطيسي للمعدات والأجهزة الصناعية.');

-- Üst Menü
INSERT INTO Menu (Baslik, Hedef, Sira, Baslik_en, Baslik_ar) VALUES
(N'Hizmetler', N'#hizmetler', 1, N'Services', N'الخدمات'),
(N'Hakkımızda', N'#hakkimizda', 2, N'About', N'من نحن'),
(N'Referanslar', N'#referanslar', 3, N'References', N'المراجع'),
(N'İletişim', N'#iletisim', 4, N'Contact', N'اتصل بنا');

-- Hakkımızda Değerleri
INSERT INTO Degerler (Baslik, Aciklama, Sira, Baslik_en, Aciklama_en, Baslik_ar, Aciklama_ar) VALUES
(N'Uluslararası Standart Uyumu', N'MIL-STD ve ilgili sivil standartlara tam uyumlu test süreçleri.', 1,
 N'International Standard Compliance', N'Test processes fully compliant with MIL-STD and related civil standards.',
 N'الامتثال للمعايير الدولية', N'عمليات اختبار متوافقة تمامًا مع معايير MIL-STD والمعايير المدنية ذات الصلة.'),
(N'Deneyimli Mühendis Kadrosu', N'Savunma sanayi test ve danışmanlık alanında uzman ekip.', 2,
 N'Experienced Engineering Team', N'A team of experts in defense industry testing and consultancy.',
 N'فريق هندسي ذو خبرة', N'فريق من الخبراء في اختبارات واستشارات الصناعات الدفاعية.'),
(N'Hızlı Raporlama', N'Test sonrası detaylı ve zamanında teknik raporlama.', 3,
 N'Fast Reporting', N'Detailed and timely technical reporting after testing.',
 N'تقارير سريعة', N'تقارير فنية مفصلة وفي الوقت المناسب بعد الاختبار.'),
(N'Gizlilik ve Güvenilirlik', N'Savunma sanayi projelerine özel gizlilik prensipleriyle çalışıyoruz.', 4,
 N'Confidentiality & Reliability', N'We operate with confidentiality principles specific to defense industry projects.',
 N'السرية والموثوقية', N'نعمل بمبادئ سرية خاصة بمشاريع الصناعات الدفاعية.');

-- Çalışma Süreci
INSERT INTO Surec (Baslik, Aciklama, Sira, Baslik_en, Aciklama_en, Baslik_ar, Aciklama_ar) VALUES
(N'Talep ve İhtiyaç Analizi', N'Ekipmanınız, kullanım ortamı ve hedeflenen standartlar (MIL-STD-810, MIL-STD-461, MIL-STD-1275 vb.) birlikte değerlendirilir; hangi test metotlarının uygulanması gerektiği netleştirilir.', 1,
 N'Request & Needs Analysis', N'Your equipment, operating environment and target standards (MIL-STD-810, MIL-STD-461, MIL-STD-1275, etc.) are evaluated together to clarify which test methods apply.',
 N'الطلب وتحليل الاحتياجات', N'يتم تقييم معداتكم وبيئة التشغيل والمعايير المستهدفة (MIL-STD-810، MIL-STD-461، MIL-STD-1275 وغيرها) معًا لتحديد طرق الاختبار المطلوبة بوضوح.'),
(N'Test Planı ve Laboratuvar Seçimi', N'İlgili standartlara uygun detaylı test planı, takvimi ve bütçe tahmini hazırlanır; ihtiyaca en uygun akredite laboratuvar seçiminde danışmanlık verilir.', 2,
 N'Test Plan & Laboratory Selection', N'A detailed test plan, schedule and cost estimate is prepared per relevant standards, with consultancy on selecting the most suitable accredited laboratory.',
 N'خطة الاختبار واختيار المختبر', N'يتم إعداد خطة اختبار مفصلة وجدول زمني وتقدير للتكلفة وفقًا للمعايير ذات الصلة، مع تقديم الاستشارة لاختيار المختبر المعتمد الأنسب.'),
(N'Test Sürecinin Yönetimi', N'Laboratuvardaki test uygulaması süresince teknik danışmanlık sağlanır; ölçüm sonuçları ve olası uygunsuzluklar süreç içinde birlikte değerlendirilir.', 3,
 N'Test Process Management', N'Technical consultancy is provided throughout the laboratory test execution; measurement results and potential non-conformities are evaluated jointly during the process.',
 N'إدارة عملية الاختبار', N'تُقدَّم الاستشارة الفنية طوال تنفيذ الاختبار في المختبر؛ ويتم تقييم نتائج القياس وحالات عدم المطابقة المحتملة معًا أثناء العملية.'),
(N'Raporlama', N'Test sonuçları, uygunsuzluklar ve iyileştirme önerilerini içeren kapsamlı bir teknik rapor hazırlanıp teslim edilir.', 4,
 N'Reporting', N'A comprehensive technical report containing test results, non-conformities and improvement recommendations is prepared and delivered.',
 N'إعداد التقارير', N'يتم إعداد وتسليم تقرير فني شامل يتضمن نتائج الاختبار وحالات عدم المطابقة وتوصيات التحسين.'),
(N'Takip ve Sürekli Destek', N'Uygunsuzluk tespit edilen noktalarda düzeltici faaliyet ve yeniden test süreçlerinde danışmanlık desteği sunmaya devam ederiz.', 5,
 N'Follow-up & Ongoing Support', N'We continue to provide consultancy support for corrective actions and retesting processes at any points where non-conformities are identified.',
 N'المتابعة والدعم المستمر', N'نواصل تقديم الدعم الاستشاري لإجراءات التصحيح وعمليات إعادة الاختبار عند اكتشاف أي حالات عدم مطابقة.');

-- Referanslar tablosu bilerek boş bırakıldı — gerçek bir proje/referans olmadan
-- örnek/sahte veri gösterilmemesi için. Referanslar sekmesi boşken sitede otomatik
-- gizlenir; admin panelden ilk referans eklendiğinde kendiliğinden görünür olur.

-- Site Ayarları
INSERT INTO Ayarlar (Anahtar, Deger) VALUES
(N'telefon1', N'0312 000 00 00'),
(N'telefon2', N''),
(N'whatsapp', N''),
(N'adres', N'Ankara'),
(N'calisma_saatleri', N'Pazartesi - Cuma: 09:00 - 18:00'),
(N'deneyim_yili', N'10'),
(N'site_adi', N'UBS Danışmanlık'),
(N'site_slogan', N'Savunma Sanayii Test Danışmanlığı'),
(N'hero_etiket', N'Savunma Sanayii Test Danışmanlığı'),
(N'hero_baslik', N'Standartlara Uygunluğu Sahada Değil, Laboratuvarda Kanıtlayın'),
(N'hero_aciklama', N'MIL-STD-810, MIL-STD-461 ve MIL-STD-1275 kapsamında çevresel ve elektromanyetik uyumluluk testleri için uçtan uca mühendislik danışmanlığı.'),
(N'hakkimizda_baslik', N'Test Süreçlerinizde Güvenilir Çözüm Ortağınız'),
(N'hakkimizda_aciklama', N'Savunma sanayii, medikal ve endüstriyel ekipman üreticilerine MIL-STD standartları kapsamında test tasarımı, test takibi ve sertifikasyon danışmanlığı sunuyoruz.'),
(N'site_slogan_en', N'Defense Industry Test Consultancy'),
(N'hero_etiket_en', N'Defense Industry Test Consultancy'),
(N'hero_baslik_en', N'Prove Compliance in the Lab, Not in the Field'),
(N'hero_aciklama_en', N'End-to-end engineering consultancy for environmental and electromagnetic compatibility testing under MIL-STD-810, MIL-STD-461 and MIL-STD-1275.'),
(N'hakkimizda_baslik_en', N'Your Reliable Partner in Test Processes'),
(N'hakkimizda_aciklama_en', N'We provide test design, tracking and certification consultancy under MIL-STD standards to defense, medical and industrial equipment manufacturers.'),
(N'site_slogan_ar', N'استشارات اختبار الصناعات الدفاعية'),
(N'hero_etiket_ar', N'استشارات اختبار الصناعات الدفاعية'),
(N'hero_baslik_ar', N'أثبت المطابقة في المختبر، وليس في الميدان'),
(N'hero_aciklama_ar', N'استشارات هندسية شاملة لاختبارات التوافق البيئي والكهرومغناطيسي بموجب MIL-STD-810 وMIL-STD-461 وMIL-STD-1275.'),
(N'hakkimizda_baslik_ar', N'شريككم الموثوق في عمليات الاختبار'),
(N'hakkimizda_aciklama_ar', N'نقدم استشارات تصميم الاختبارات ومتابعتها واعتمادها بموجب معايير MIL-STD لمصنعي المعدات الدفاعية والطبية والصناعية.');
