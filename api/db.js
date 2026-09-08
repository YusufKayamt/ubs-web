const { Pool } = require('pg');

// Neon bağlantı dizesi: Neon Dashboard > Connection Details (pooled connection)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

module.exports = pool;
