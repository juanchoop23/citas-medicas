const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { 
    getDisponibilidad, 
    agendarCita, 
    getMisCitas, 
    cancelarCita 
} = require('../controllers/citasController');

// Rutas públicas
router.get('/disponibilidad', getDisponibilidad);

// Rutas protegidas (requieren autenticación)
router.post('/agendar', verificarToken, agendarCita);
router.get('/mis-citas', verificarToken, getMisCitas);
router.put('/cancelar/:id', verificarToken, cancelarCita);

module.exports = router;