const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

// service_role anahtarı SADECE burada, sunucu tarafında kullanılır. Asla frontend'e verilmez.
// Tembel (lazy) oluşturulur: env değişkenleri eksikse modül yüklenirken değil, sadece
// gerçekten bir dosya yükleme/silme işlemi yapılmaya çalışıldığında hata verir.
let _supabase = null;
function supabaseClient() {
    if (!_supabase) {
        _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    return _supabase;
}
const BUCKET = process.env.SUPABASE_BUCKET || 'gorseller';

// Dosyayı Supabase Storage'a yükler, herkese açık (public) URL'sini döner.
async function gorselYukle(dosya) {
    const uzanti = path.extname(dosya.originalname).toLowerCase();
    const dosyaAdi = `${crypto.randomUUID()}${uzanti}`;
    const { error } = await supabaseClient().storage.from(BUCKET).upload(dosyaAdi, dosya.buffer, {
        contentType: dosya.mimetype,
        upsert: false
    });
    if (error) throw error;
    const { data } = supabaseClient().storage.from(BUCKET).getPublicUrl(dosyaAdi);
    return data.publicUrl;
}

// ResimYolu kolonunda tam public URL saklanır; silerken sondaki dosya adını ayıklayıp bucket'tan kaldırır.
async function gorselSil(publicUrl) {
    if (!publicUrl) return;
    const dosyaAdi = publicUrl.split('/').pop();
    if (!dosyaAdi) return;
    await supabaseClient().storage.from(BUCKET).remove([dosyaAdi]).catch(() => {});
}

module.exports = { gorselYukle, gorselSil };
