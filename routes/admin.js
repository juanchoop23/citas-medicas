const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middleware/auth');
const { 
    getAllCitas, 
    confirmarCita, 
    cancelarCitaAdmin, 
    getEstadisticas,
    getPacientes,
    getAllUsers,
    updateUserStatus,
    updateUser,
    updateUserPassword
} = require('../controllers/adminController');

// Todas las rutas de admin requieren autenticación Y rol de administrador
router.use(verificarToken);
router.use(verificarAdmin);

// Rutas de citas
router.get('/todas-citas', getAllCitas);
router.put('/confirmar-cita/:id', confirmarCita);
router.put('/cancelar-cita/:id', cancelarCitaAdmin);
router.get('/estadisticas', getEstadisticas);
router.get('/pacientes', getPacientes);

// Rutas de gestión de usuarios
router.get('/usuarios', getAllUsers);
router.put('/usuarios/:id/estado', updateUserStatus);
router.put('/usuarios/:id', updateUser);
router.put('/usuarios/:id/password', updateUserPassword);

module.exports = router;