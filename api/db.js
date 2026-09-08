const { Pool } = require('pg');

// Supabase bağlantı dizesi: Supabase Dashboard > Connect > Transaction pooler
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

module.exports = pool;
