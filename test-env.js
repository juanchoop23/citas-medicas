require('dotenv').config();
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ Cargada' : '❌ No cargada');
console.log('DB_HOST:', process.env.DB_HOST);