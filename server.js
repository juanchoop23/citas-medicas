require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const citasRoutes = require('./routes/citas');
const adminRoutes = require('./routes/admin');
// Después de las otras rutas
const medicoRoutes = require('./routes/medico');
const medicosRoutes = require('./routes/medicos');



const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares de seguridad
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting para evitar ataques de fuerza bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Demasiadas peticiones desde esta IP, intente más tarde'
});
app.use('/api/', limiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/medico', medicoRoutes);


app.use('/api/medicos', medicosRoutes);

// Health check para Azure
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date(),
    database: 'PostgreSQL on Azure'
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});