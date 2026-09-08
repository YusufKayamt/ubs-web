const { put, del } = require('@vercel/blob');
const crypto = require('crypto');
const path = require('path');

// Dosyayı Vercel Blob'a yükler, herkese açık (public) URL'sini döner.
async function gorselYukle(dosya) {
    const uzanti = path.extname(dosya.originalname).toLowerCase();
    const dosyaAdi = `${crypto.randomUUID()}${uzanti}`;
    const { url } = await put(dosyaAdi, dosya.buffer, {
        access: 'public',
        contentType: dosya.mimetype,
        addRandomSuffix: false
    });
    return url;
}

// ResimYolu kolonunda tam public URL saklanır; silerken doğrudan bu URL ile kaldırılır.
async function gorselSil(publicUrl) {
    if (!publicUrl) return;
    await del(publicUrl).catch(() => {});
}

module.exports = { gorselYukle, gorselSil };
