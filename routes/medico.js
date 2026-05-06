const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const pool = require('../db');
const bcrypt = require('bcrypt');

router.use(verificarToken);

// Verificar que el usuario sea médico
router.use(async (req, res, next) => {
    if (req.user.role !== 'medico') {
        return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de médico.' });
    }
    next();
});

// Obtener mi perfil completo (datos de usuario + datos de médico)
router.get('/mi-perfil', async (req, res) => {
    const usuario_id = req.user.id;
    
    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.nombre, u.apellido, u.cedula, u.telefono, u.role,
                    m.id as medico_id, m.consultorio, m.horario_atencion,
                    e.id as especialidad_id, e.nombre as especialidad
             FROM usuarios u
             LEFT JOIN medicos m ON u.id = m.usuario_id
             LEFT JOIN especialidades e ON m.especialidad_id = e.id
             WHERE u.id = $1`,
            [usuario_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ medico: result.rows[0] });
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// Actualizar mi perfil (datos básicos del usuario)
router.put('/mi-perfil', async (req, res) => {
    const usuario_id = req.user.id;
    const { nombre, apellido, cedula, telefono } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE usuarios 
             SET nombre = $1, apellido = $2, cedula = $3, telefono = $4
             WHERE id = $5
             RETURNING id, email, nombre, apellido, cedula, telefono, role`,
            [nombre, apellido, cedula, telefono, usuario_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ message: 'Perfil actualizado correctamente', medico: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

// Actualizar datos específicos del médico (consultorio, horario, especialidad)
router.put('/mi-perfil-medico', async (req, res) => {
    const usuario_id = req.user.id;
    const { especialidad, consultorio, horario_atencion } = req.body;
    
    try {
        // Obtener o crear el registro en medicos
        let medico = await pool.query(
            'SELECT id FROM medicos WHERE usuario_id = $1',
            [usuario_id]
        );
        
        // Obtener especialidad_id
        let especialidad_id = null;
        if (especialidad) {
            const espResult = await pool.query(
                'SELECT id FROM especialidades WHERE nombre = $1',
                [especialidad]
            );
            if (espResult.rows.length > 0) {
                especialidad_id = espResult.rows[0].id;
            } else {
                // Crear nueva especialidad si no existe
                const newEsp = await pool.query(
                    'INSERT INTO especialidades (nombre) VALUES ($1) RETURNING id',
                    [especialidad]
                );
                especialidad_id = newEsp.rows[0].id;
            }
        }
        
        if (medico.rows.length === 0) {
            // Crear registro en medicos
            await pool.query(
                `INSERT INTO medicos (usuario_id, especialidad_id, consultorio, horario_atencion) 
                 VALUES ($1, $2, $3, $4)`,
                [usuario_id, especialidad_id, consultorio, horario_atencion]
            );
        } else {
            // Actualizar registro existente
            await pool.query(
                `UPDATE medicos 
                 SET especialidad_id = COALESCE($1, especialidad_id),
                     consultorio = COALESCE($2, consultorio),
                     horario_atencion = COALESCE($3, horario_atencion)
                 WHERE usuario_id = $4`,
                [especialidad_id, consultorio, horario_atencion, usuario_id]
            );
        }
        
        res.json({ message: 'Datos médicos actualizados correctamente' });
    } catch (error) {
        console.error('Error al actualizar datos médicos:', error);
        res.status(500).json({ error: 'Error al actualizar datos médicos' });
    }
});

// Actualizar contraseña
router.put('/mi-password', async (req, res) => {
    const usuario_id = req.user.id;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE usuarios SET password = $1 WHERE id = $2',
            [hashedPassword, usuario_id]
        );
        
        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
});

// Obtener citas asignadas al médico
router.get('/mis-citas', async (req, res) => {
    const usuario_id = req.user.id;
    
    try {
        const medicoResult = await pool.query(
            `SELECT id FROM medicos WHERE usuario_id = $1`,
            [usuario_id]
        );
        
        const medico_id = medicoResult.rows[0]?.id;
        
        if (!medico_id) {
            return res.json({ citas: [] });
        }
        
        const result = await pool.query(
            `SELECT c.id, c.paciente_email, c.fecha, c.hora, c.motivo, c.estado, c.created_at,
                    u.nombre, u.apellido, u.telefono, u.cedula
             FROM citas c
             JOIN usuarios u ON c.paciente_email = u.email
             WHERE c.medico_id = $1
             ORDER BY c.fecha DESC, c.hora DESC`,
            [medico_id]
        );
        
        res.json({ citas: result.rows });
    } catch (error) {
        console.error('Error en mis-citas medico:', error);
        res.status(500).json({ error: 'Error al obtener citas' });
    }
});

// Actualizar estado de cita
router.put('/cita/:id/estado', async (req, res) => {
    const citaId = req.params.id;
    const usuario_id = req.user.id;
    const { estado } = req.body;
    
    if (!estado || !['confirmada', 'completada', 'cancelada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
    }
    
    try {
        const medicoResult = await pool.query(
            `SELECT id FROM medicos WHERE usuario_id = $1`,
            [usuario_id]
        );
        
        const medico_id = medicoResult.rows[0]?.id;
        
        if (!medico_id) {
            return res.status(404).json({ error: 'Médico no encontrado' });
        }
        
        const result = await pool.query(
            `UPDATE citas 
             SET estado = $1 
             WHERE id = $2 AND medico_id = $3 
             RETURNING *`,
            [estado, citaId, medico_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada o no autorizado' });
        }
        
        res.json({ message: `Cita ${estado} exitosamente`, cita: result.rows[0] });
    } catch (error) {
        console.error('Error en update cita medico:', error);
        res.status(500).json({ error: 'Error al actualizar cita' });
    }
});

module.exports = router;