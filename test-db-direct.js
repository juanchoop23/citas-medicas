require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log('✅ Conexión exitosa DIRECTA');
    const res = await client.query('SELECT NOW()');
    console.log('Hora del servidor:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();