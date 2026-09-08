require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const pool = require('./db');
const { gorselYukle, gorselSil } = require('./storage');

const app = express();
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Çok fazla istek atıldı."
});
app.use('/api', limiter);

// Girişe özel, daha sıkı limit (kaba kuvvet saldırılarına karşı)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: "Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.",
    standardHeaders: true,
    legacyHeaders: false
});

// İletişim formuna özel limit (spam'e karşı)
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin.",
    standardHeaders: true,
    legacyHeaders: false
});

const IZINLI_UZANTILAR = ['.jpg', '.jpeg', '.png'];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const uzanti = path.extname(file.originalname).toLowerCase();
        const mimeUygun = file.mimetype === 'image/jpeg' || file.mimetype === 'image/png';
        const uzantiUygun = IZINLI_UZANTILAR.includes(uzanti);
        if (mimeUygun && uzantiUygun) {
            cb(null, true);
        } else {
            cb(new Error('Sadece JPG veya PNG yüklenebilir.'));
        }
    }
});

const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS_HASH = process.env.ADMIN_PASSWORD_HASH;
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

// Basit sunucu tarafı metin doğrulaması: boşsa/çok uzunsa null döner
function metinDogrula(deger, maksUzunluk) {
    if (typeof deger !== 'string') return null;
    const temiz = deger.trim();
    if (temiz.length === 0 || temiz.length > maksUzunluk) return null;
    return temiz;
}
// İsteğe bağlı çeviri alanı: boşsa null (kaydedilmez/temizlenir), doluysa doğrulanır
function cevinDogrula(deger, maksUzunluk) {
    if (deger === undefined || deger === null || deger === '') return '';
    const gecerli = metinDogrula(deger, maksUzunluk);
    return gecerli === null ? null : gecerli;
}

// Başlıktan URL/çapa dostu bir slug üretir (ör. "Ekibimiz Kimdir?" -> "ekibimiz-kimdir")
function slugUret(baslik) {
    const harfler = { ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u' };
    let s = baslik.replace(/[çÇğĞıİöÖşŞüÜ]/g, ch => harfler[ch] || ch).toLowerCase();
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s.slice(0, 60) || 'bolum';
}
async function benzersizSlugUret(baslik) {
    const taban = slugUret(baslik);
    let aday = taban;
    let sayac = 2;
    while (true) {
        const mevcut = await pool.query('SELECT 1 FROM OzelBolumler WHERE Slug = $1', [aday]);
        if (mevcut.rows.length === 0) return aday;
        aday = `${taban}-${sayac++}`;
    }
}

const verifyToken = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: "Erişim reddedildi. Giriş yapın." });
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: "Geçersiz oturum." });
    }
};

// Admin Girişi
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 8) return res.status(400).json({ error: "Geçersiz giriş bilgileri." });
    const validPassword = await bcrypt.compare(password, ADMIN_PASS_HASH);
    if (username === ADMIN_USER && validPassword) {
        const token = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.cookie('admin_token', token, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'strict', maxAge: 2 * 60 * 60 * 1000 });
        return res.status(200).json({ message: "Giriş başarılı." });
    }
    res.status(401).json({ error: "Hatalı kullanıcı veya şifre." });
});

// Admin Çıkışı
app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_token', { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'strict' });
    res.status(200).json({ message: "Çıkış yapıldı." });
});

// Üst Menüyü Ana Sayfaya Çekme
app.get('/api/menu', async (req, res) => {
    try {
        const result = await pool.query('SELECT ID AS "ID", Baslik AS "Baslik", Hedef AS "Hedef", Sira AS "Sira", Baslik_en AS "Baslik_en", Baslik_ar AS "Baslik_ar" FROM Menu ORDER BY Sira ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Menü alınamadı." });
    }
});

// Hedef sadece sayfa-içi bağlantı, http(s) adresi, tel: veya mailto: olabilir (javascript: gibi tehlikeli şemalar reddedilir)
const GUVENLI_HEDEF_REGEX = /^(#[\w-]*|\/[\w\-./?=&%#]*|https?:\/\/[^\s"'<>]+|tel:[\d+() -]+|mailto:[^\s"'<>]+)$/i;
function hedefDogrula(deger) {
    const temiz = metinDogrula(deger, 255);
    if (!temiz || !GUVENLI_HEDEF_REGEX.test(temiz)) return null;
    return temiz;
}

app.post('/api/menu', verifyToken, async (req, res) => {
    try {
        const baslik = metinDogrula(req.body.baslik, 100);
        const hedef = hedefDogrula(req.body.hedef);
        const baslik_en = cevinDogrula(req.body.baslik_en, 100);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 100);
        if (!baslik || !hedef || baslik_en === null || baslik_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya hedef geçersiz (# ile sayfa içi ya da http(s):// ile tam adres kullanın)." });
        }

        const maxSira = await pool.query('SELECT COALESCE(MAX(Sira), 0) AS maks FROM Menu');
        const siradaki = maxSira.rows[0].maks + 1;

        await pool.query(
            'INSERT INTO Menu (Baslik, Hedef, Sira, Baslik_en, Baslik_ar) VALUES ($1, $2, $3, $4, $5)',
            [baslik, hedef, siradaki, baslik_en || null, baslik_ar || null]
        );
        res.status(200).json({ message: "Menü öğesi eklendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.put('/api/menu/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const baslik = metinDogrula(req.body.baslik, 100);
        const hedef = hedefDogrula(req.body.hedef);
        const baslik_en = cevinDogrula(req.body.baslik_en, 100);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 100);
        const sira = Number.isFinite(Number(req.body.sira)) ? Number(req.body.sira) : 0;
        if (!baslik || !hedef || baslik_en === null || baslik_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya hedef geçersiz (# ile sayfa içi ya da http(s):// ile tam adres kullanın)." });
        }

        await pool.query(
            'UPDATE Menu SET Baslik = $1, Hedef = $2, Sira = $3, Baslik_en = $4, Baslik_ar = $5 WHERE ID = $6',
            [baslik, hedef, sira, baslik_en || null, baslik_ar || null, id]
        );
        res.status(200).json({ message: "Menü öğesi güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.delete('/api/menu/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM Menu WHERE ID = $1', [id]);
        res.status(200).json({ message: "Menü öğesi silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Dinamik Hizmetleri Ana Sayfaya Çekme
app.get('/api/services', async (req, res) => {
    try {
        const result = await pool.query(`SELECT ID AS "ID", HizmetAdi AS "HizmetAdi", Aciklama AS "Aciklama",
            HizmetAdi_en AS "HizmetAdi_en", Aciklama_en AS "Aciklama_en",
            HizmetAdi_ar AS "HizmetAdi_ar", Aciklama_ar AS "Aciklama_ar",
            ResimYolu AS "ResimYolu" FROM Hizmetler ORDER BY ID ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Hizmetler alınamadı." });
    }
});

app.post('/api/services', verifyToken, upload.single('gorsel'), async (req, res) => {
    try {
        const hizmetAdi = metinDogrula(req.body.hizmetAdi, 255);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 800) : '';
        const hizmetAdi_en = cevinDogrula(req.body.hizmetAdi_en, 255);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 800);
        const hizmetAdi_ar = cevinDogrula(req.body.hizmetAdi_ar, 255);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 800);
        if (!hizmetAdi || aciklama === null || hizmetAdi_en === null || aciklama_en === null || hizmetAdi_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Hizmet adı boş olamaz veya bir alan çok uzun." });
        }

        const resimUrl = req.file ? await gorselYukle(req.file) : null;

        await pool.query(
            `INSERT INTO Hizmetler (HizmetAdi, Aciklama, HizmetAdi_en, Aciklama_en, HizmetAdi_ar, Aciklama_ar, ResimYolu)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [hizmetAdi, aciklama || null, hizmetAdi_en || null, aciklama_en || null, hizmetAdi_ar || null, aciklama_ar || null, resimUrl]
        );
        res.status(200).json({ message: "Yeni hizmet sekmesi başarıyla eklendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.put('/api/services/:id', verifyToken, upload.single('gorsel'), async (req, res) => {
    try {
        const { id } = req.params;
        const hizmetAdi = metinDogrula(req.body.hizmetAdi, 255);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 800) : '';
        const hizmetAdi_en = cevinDogrula(req.body.hizmetAdi_en, 255);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 800);
        const hizmetAdi_ar = cevinDogrula(req.body.hizmetAdi_ar, 255);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 800);
        if (!hizmetAdi || aciklama === null || hizmetAdi_en === null || aciklama_en === null || hizmetAdi_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Hizmet adı boş olamaz veya bir alan çok uzun." });
        }

        const mevcut = await pool.query('SELECT ResimYolu FROM Hizmetler WHERE ID = $1', [id]);
        if (mevcut.rows.length === 0) return res.status(404).json({ error: "Hizmet bulunamadı." });
        const eskiResim = mevcut.rows[0].resimyolu;
        const yeniResim = req.file ? await gorselYukle(req.file) : eskiResim;

        await pool.query(
            `UPDATE Hizmetler SET HizmetAdi = $1, Aciklama = $2, HizmetAdi_en = $3, Aciklama_en = $4,
             HizmetAdi_ar = $5, Aciklama_ar = $6, ResimYolu = $7 WHERE ID = $8`,
            [hizmetAdi, aciklama || null, hizmetAdi_en || null, aciklama_en || null, hizmetAdi_ar || null, aciklama_ar || null, yeniResim, id]
        );

        if (req.file && eskiResim) await gorselSil(eskiResim);

        res.status(200).json({ message: "Hizmet güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.delete('/api/services/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const mevcut = await pool.query('SELECT ResimYolu FROM Hizmetler WHERE ID = $1', [id]);
        await pool.query('DELETE FROM Hizmetler WHERE ID = $1', [id]);
        if (mevcut.rows[0]) await gorselSil(mevcut.rows[0].resimyolu);
        res.status(200).json({ message: "Hizmet silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Referanslar (görselli) — Ana Sayfaya Çekme
app.get('/api/referanslar', async (req, res) => {
    try {
        const result = await pool.query(`SELECT ID AS "ID", Baslik AS "Baslik", Aciklama AS "Aciklama",
            Baslik_en AS "Baslik_en", Aciklama_en AS "Aciklama_en",
            Baslik_ar AS "Baslik_ar", Aciklama_ar AS "Aciklama_ar",
            ResimYolu AS "ResimYolu", Sira AS "Sira" FROM Referanslar ORDER BY Sira ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Referanslar alınamadı." });
    }
});

app.post('/api/referanslar', verifyToken, upload.single('gorsel'), async (req, res) => {
    try {
        const baslik = metinDogrula(req.body.baslik, 150);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 500) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 150);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 500);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 150);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 500);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }

        const resimUrl = req.file ? await gorselYukle(req.file) : null;
        const maxSira = await pool.query('SELECT COALESCE(MAX(Sira), 0) AS maks FROM Referanslar');
        const siradaki = maxSira.rows[0].maks + 1;

        await pool.query(
            `INSERT INTO Referanslar (Baslik, Aciklama, Baslik_en, Aciklama_en, Baslik_ar, Aciklama_ar, ResimYolu, Sira)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [baslik, aciklama || null, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null, resimUrl, siradaki]
        );
        res.status(200).json({ message: "Referans eklendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.put('/api/referanslar/:id', verifyToken, upload.single('gorsel'), async (req, res) => {
    try {
        const { id } = req.params;
        const baslik = metinDogrula(req.body.baslik, 150);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 500) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 150);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 500);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 150);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 500);
        const sira = Number.isFinite(Number(req.body.sira)) ? Number(req.body.sira) : 0;
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }

        const mevcut = await pool.query('SELECT ResimYolu FROM Referanslar WHERE ID = $1', [id]);
        if (mevcut.rows.length === 0) return res.status(404).json({ error: "Referans bulunamadı." });
        const eskiResim = mevcut.rows[0].resimyolu;
        const yeniResim = req.file ? await gorselYukle(req.file) : eskiResim;

        await pool.query(
            `UPDATE Referanslar SET Baslik = $1, Aciklama = $2, Baslik_en = $3, Aciklama_en = $4,
             Baslik_ar = $5, Aciklama_ar = $6, ResimYolu = $7, Sira = $8 WHERE ID = $9`,
            [baslik, aciklama || null, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null, yeniResim, sira, id]
        );

        if (req.file && eskiResim) await gorselSil(eskiResim);

        res.status(200).json({ message: "Referans güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.delete('/api/referanslar/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const mevcut = await pool.query('SELECT ResimYolu FROM Referanslar WHERE ID = $1', [id]);
        await pool.query('DELETE FROM Referanslar WHERE ID = $1', [id]);
        if (mevcut.rows[0]) await gorselSil(mevcut.rows[0].resimyolu);
        res.status(200).json({ message: "Referans silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Site Ayarlarını (Telefon, Adres vb.) Ana Sayfaya Çekme
app.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT Anahtar, Deger FROM Ayarlar');
        const ayarlar = {};
        result.rows.forEach(row => { ayarlar[row.anahtar] = row.deger; });
        res.json(ayarlar);
    } catch (err) {
        res.status(500).json({ error: "Ayarlar alınamadı." });
    }
});

const AYAR_ANAHTARLARI = {
    telefon1: 30, telefon2: 30, whatsapp: 30,
    adres: 300, calisma_saatleri: 100, deneyim_yili: 10,
    site_adi: 60, site_slogan: 100,
    hero_etiket: 60, hero_baslik: 150, hero_aciklama: 400,
    hakkimizda_baslik: 150, hakkimizda_aciklama: 500,
    site_slogan_en: 100, hero_etiket_en: 60, hero_baslik_en: 150, hero_aciklama_en: 400,
    hakkimizda_baslik_en: 150, hakkimizda_aciklama_en: 500,
    site_slogan_ar: 100, hero_etiket_ar: 60, hero_baslik_ar: 150, hero_aciklama_ar: 400,
    hakkimizda_baslik_ar: 150, hakkimizda_aciklama_ar: 500
};
app.put('/api/settings', verifyToken, async (req, res) => {
    try {
        for (const anahtar of Object.keys(AYAR_ANAHTARLARI)) {
            if (Object.prototype.hasOwnProperty.call(req.body, anahtar)) {
                const deger = req.body[anahtar];
                if (typeof deger !== 'string' || deger.length > AYAR_ANAHTARLARI[anahtar]) {
                    return res.status(400).json({ error: `${anahtar} alanı geçersiz veya çok uzun.` });
                }
                await pool.query(
                    `INSERT INTO Ayarlar (Anahtar, Deger) VALUES ($1, $2)
                     ON CONFLICT (Anahtar) DO UPDATE SET Deger = EXCLUDED.Deger`,
                    [anahtar, deger.trim()]
                );
            }
        }
        res.status(200).json({ message: "Ayarlar güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Hakkımızda Değerlerini Ana Sayfaya Çekme
app.get('/api/degerler', async (req, res) => {
    try {
        const result = await pool.query(`SELECT ID AS "ID", Baslik AS "Baslik", Aciklama AS "Aciklama", Sira AS "Sira",
            Baslik_en AS "Baslik_en", Aciklama_en AS "Aciklama_en",
            Baslik_ar AS "Baslik_ar", Aciklama_ar AS "Aciklama_ar" FROM Degerler ORDER BY Sira ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Değerler alınamadı." });
    }
});

app.post('/api/degerler', verifyToken, async (req, res) => {
    try {
        const baslik = metinDogrula(req.body.baslik, 100);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 300) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 100);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 300);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 100);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 300);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }

        const maxSira = await pool.query('SELECT COALESCE(MAX(Sira), 0) AS maks FROM Degerler');
        const siradaki = maxSira.rows[0].maks + 1;

        await pool.query(
            'INSERT INTO Degerler (Baslik, Aciklama, Sira, Baslik_en, Aciklama_en, Baslik_ar, Aciklama_ar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [baslik, aciklama, siradaki, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null]
        );
        res.status(200).json({ message: "Değer eklendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.put('/api/degerler/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const baslik = metinDogrula(req.body.baslik, 100);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 300) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 100);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 300);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 100);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 300);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }
        const sira = Number.isFinite(Number(req.body.sira)) ? Number(req.body.sira) : 0;

        await pool.query(
            'UPDATE Degerler SET Baslik = $1, Aciklama = $2, Sira = $3, Baslik_en = $4, Aciklama_en = $5, Baslik_ar = $6, Aciklama_ar = $7 WHERE ID = $8',
            [baslik, aciklama, sira, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null, id]
        );
        res.status(200).json({ message: "Değer güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.delete('/api/degerler/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM Degerler WHERE ID = $1', [id]);
        res.status(200).json({ message: "Değer silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Çalışma Sürecini Ana Sayfaya Çekme
app.get('/api/surec', async (req, res) => {
    try {
        const result = await pool.query(`SELECT ID AS "ID", Baslik AS "Baslik", Aciklama AS "Aciklama", Sira AS "Sira",
            Baslik_en AS "Baslik_en", Aciklama_en AS "Aciklama_en",
            Baslik_ar AS "Baslik_ar", Aciklama_ar AS "Aciklama_ar" FROM Surec ORDER BY Sira ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Süreç alınamadı." });
    }
});

app.post('/api/surec', verifyToken, async (req, res) => {
    try {
        const baslik = metinDogrula(req.body.baslik, 100);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 300) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 100);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 300);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 100);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 300);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }

        const maxSira = await pool.query('SELECT COALESCE(MAX(Sira), 0) AS maks FROM Surec');
        const siradaki = maxSira.rows[0].maks + 1;

        await pool.query(
            'INSERT INTO Surec (Baslik, Aciklama, Sira, Baslik_en, Aciklama_en, Baslik_ar, Aciklama_ar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [baslik, aciklama, siradaki, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null]
        );
        res.status(200).json({ message: "Süreç adımı eklendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.put('/api/surec/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const baslik = metinDogrula(req.body.baslik, 100);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 300) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 100);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 300);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 100);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 300);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }
        const sira = Number.isFinite(Number(req.body.sira)) ? Number(req.body.sira) : 0;

        await pool.query(
            'UPDATE Surec SET Baslik = $1, Aciklama = $2, Sira = $3, Baslik_en = $4, Aciklama_en = $5, Baslik_ar = $6, Aciklama_ar = $7 WHERE ID = $8',
            [baslik, aciklama, sira, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null, id]
        );
        res.status(200).json({ message: "Süreç adımı güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.delete('/api/surec/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM Surec WHERE ID = $1', [id]);
        res.status(200).json({ message: "Süreç adımı silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// İletişim Formu Gönderimi (herkese açık, spam limiti var)
const EPOSTA_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post('/api/contact', contactLimiter, async (req, res) => {
    try {
        const ad = metinDogrula(req.body.ad, 150);
        const firma = req.body.firma ? metinDogrula(req.body.firma, 150) : '';
        const eposta = metinDogrula(req.body.eposta, 200);
        const mesaj = metinDogrula(req.body.mesaj, 2000);
        if (!ad || !eposta || !mesaj || firma === null || !EPOSTA_REGEX.test(eposta)) {
            return res.status(400).json({ error: "Lütfen tüm zorunlu alanları geçerli şekilde doldurun." });
        }

        await pool.query(
            'INSERT INTO Mesajlar (Ad, Firma, Eposta, Mesaj) VALUES ($1, $2, $3, $4)',
            [ad, firma || null, eposta, mesaj]
        );
        res.status(200).json({ message: "Mesajınız alındı. En kısa sürede dönüş yapacağız." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Mesajları Listeleme (sadece admin)
app.get('/api/contact', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT ID AS "ID", Ad AS "Ad", Firma AS "Firma", Eposta AS "Eposta", Mesaj AS "Mesaj", Tarih AS "Tarih", Okundu AS "Okundu" FROM Mesajlar ORDER BY Tarih DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Mesajlar alınamadı." });
    }
});

app.put('/api/contact/:id/okundu', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE Mesajlar SET Okundu = true WHERE ID = $1', [id]);
        res.status(200).json({ message: "Güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

app.delete('/api/contact/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM Mesajlar WHERE ID = $1', [id]);
        res.status(200).json({ message: "Mesaj silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Özel Bölümleri Ana Sayfaya Çekme
app.get('/api/ozel-bolumler', async (req, res) => {
    try {
        const result = await pool.query(`SELECT ID AS "ID", Slug AS "Slug", Baslik AS "Baslik", Aciklama AS "Aciklama",
            ResimYolu AS "ResimYolu", Sira AS "Sira",
            Baslik_en AS "Baslik_en", Aciklama_en AS "Aciklama_en",
            Baslik_ar AS "Baslik_ar", Aciklama_ar AS "Aciklama_ar" FROM OzelBolumler ORDER BY Sira ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Özel bölümler alınamadı." });
    }
});

// Yeni Özel Bölüm Ekleme — otomatik olarak Üst Menü'ye de bir öğe ekler
app.post('/api/ozel-bolumler', verifyToken, upload.single('gorsel'), async (req, res) => {
    try {
        const baslik = metinDogrula(req.body.baslik, 150);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 2000) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 150);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 2000);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 150);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 2000);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }

        const slug = await benzersizSlugUret(baslik);
        const resimUrl = req.file ? await gorselYukle(req.file) : null;

        const maxSiraBolum = await pool.query('SELECT COALESCE(MAX(Sira), 0) AS maks FROM OzelBolumler');
        const maxSiraMenu = await pool.query('SELECT COALESCE(MAX(Sira), 0) AS maks FROM Menu');

        const menuSonuc = await pool.query(
            'INSERT INTO Menu (Baslik, Hedef, Sira, Baslik_en, Baslik_ar) VALUES ($1, $2, $3, $4, $5) RETURNING ID',
            [baslik, `#${slug}`, maxSiraMenu.rows[0].maks + 1, baslik_en || null, baslik_ar || null]
        );
        const menuId = menuSonuc.rows[0].id;

        await pool.query(
            `INSERT INTO OzelBolumler (Slug, Baslik, Aciklama, ResimYolu, Sira, MenuID, Baslik_en, Aciklama_en, Baslik_ar, Aciklama_ar)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [slug, baslik, aciklama || null, resimUrl, maxSiraBolum.rows[0].maks + 1, menuId, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null]
        );

        res.status(200).json({ message: "Yeni bölüm eklendi ve üst menüye yerleştirildi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Özel Bölüm Düzenleme (başlık değişse bile anchor/slug sabit kalır, sadece görünen ad güncellenir)
app.put('/api/ozel-bolumler/:id', verifyToken, upload.single('gorsel'), async (req, res) => {
    try {
        const { id } = req.params;
        const baslik = metinDogrula(req.body.baslik, 150);
        const aciklama = req.body.aciklama ? metinDogrula(req.body.aciklama, 2000) : '';
        const baslik_en = cevinDogrula(req.body.baslik_en, 150);
        const aciklama_en = cevinDogrula(req.body.aciklama_en, 2000);
        const baslik_ar = cevinDogrula(req.body.baslik_ar, 150);
        const aciklama_ar = cevinDogrula(req.body.aciklama_ar, 2000);
        if (!baslik || aciklama === null || baslik_en === null || aciklama_en === null || baslik_ar === null || aciklama_ar === null) {
            return res.status(400).json({ error: "Başlık boş olamaz veya bir alan çok uzun." });
        }
        const sira = Number.isFinite(Number(req.body.sira)) ? Number(req.body.sira) : 0;

        const mevcut = await pool.query('SELECT ResimYolu, MenuID FROM OzelBolumler WHERE ID = $1', [id]);
        if (mevcut.rows.length === 0) return res.status(404).json({ error: "Bölüm bulunamadı." });
        const eskiResim = mevcut.rows[0].resimyolu;
        const menuId = mevcut.rows[0].menuid;
        const yeniResim = req.file ? await gorselYukle(req.file) : eskiResim;

        await pool.query(
            `UPDATE OzelBolumler SET Baslik = $1, Aciklama = $2, ResimYolu = $3, Sira = $4,
             Baslik_en = $5, Aciklama_en = $6, Baslik_ar = $7, Aciklama_ar = $8 WHERE ID = $9`,
            [baslik, aciklama || null, yeniResim, sira, baslik_en || null, aciklama_en || null, baslik_ar || null, aciklama_ar || null, id]
        );
        if (menuId) {
            await pool.query('UPDATE Menu SET Baslik = $1, Baslik_en = $2, Baslik_ar = $3 WHERE ID = $4', [baslik, baslik_en || null, baslik_ar || null, menuId]);
        }
        if (req.file && eskiResim) await gorselSil(eskiResim);

        res.status(200).json({ message: "Bölüm güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Özel Bölüm Silme — bağlı üst menü öğesini de siler
app.delete('/api/ozel-bolumler/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const mevcut = await pool.query('SELECT ResimYolu, MenuID FROM OzelBolumler WHERE ID = $1', [id]);
        if (mevcut.rows.length === 0) return res.status(404).json({ error: "Bölüm bulunamadı." });

        await pool.query('DELETE FROM OzelBolumler WHERE ID = $1', [id]);
        if (mevcut.rows[0].menuid) await pool.query('DELETE FROM Menu WHERE ID = $1', [mevcut.rows[0].menuid]);
        await gorselSil(mevcut.rows[0].resimyolu);

        res.status(200).json({ message: "Bölüm silindi." });
    } catch (err) {
        res.status(500).json({ error: "İşlem başarısız." });
    }
});

// Tanımsız API rotaları
app.use('/api', (req, res) => res.status(404).json({ error: "Bulunamadı." }));

// Genel hata yakalayıcı: istemciye asla stack trace / iç detay sızdırmaz
app.use((err, req, res, next) => {
    console.error("[HATA]", err.message);
    if (err instanceof multer.MulterError || /jpg|png/i.test(err.message || '')) {
        return res.status(400).json({ error: "Dosya yükleme hatası: " + (err.message.includes('File too large') ? "Dosya çok büyük (maks 5MB)." : "Sadece JPG veya PNG yüklenebilir.") });
    }
    res.status(500).json({ error: "Sunucu hatası." });
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[ALTYAPI AKTİF - YEREL TEST] Port: ${PORT}`));
}

module.exports = app;
