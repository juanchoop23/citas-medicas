const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false // Necesario para Azure
  }
});

// Función para inicializar tablas
const initDB = async () => {
  const client = await pool.connect();
  try {
    // Crear tabla de usuarios
    await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100),
            apellido VARCHAR(100),
            cedula VARCHAR(50) UNIQUE,
            telefono VARCHAR(20),
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'paciente',
            estado VARCHAR(20) DEFAULT 'activo',
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    
    // Crear tabla de citas
    await client.query(`
      CREATE TABLE IF NOT EXISTS citas (
        id SERIAL PRIMARY KEY,
        paciente_email VARCHAR(255) REFERENCES usuarios(email),
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        motivo TEXT,
        estado VARCHAR(50) DEFAULT 'pendiente',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Crear índice único para evitar doble reserva
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_cita_activa 
      ON citas (fecha, hora) 
      WHERE estado != 'cancelada'
    `);
    
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error inicializando DB:', error);
  } finally {
    client.release();
  }
};

initDB();

module.exports = pool;