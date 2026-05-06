const pool = require('../db');
const bcrypt = require('bcrypt');

// Ver todas las citas del sistema (solo admin)
const getAllCitas = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.paciente_email, c.fecha, c.hora, c.motivo, c.estado, c.created_at,
                    u.email, u.role, u.nombre, u.apellido
             FROM citas c
             JOIN usuarios u ON c.paciente_email = u.email
             ORDER BY c.fecha DESC, c.hora DESC`
        );
        
        res.json({ 
            total: result.rows.length,
            citas: result.rows 
        });
    } catch (error) {
        console.error('Error en getAllCitas:', error);
        res.status(500).json({ error: 'Error al obtener citas' });
    }
};

// Confirmar una cita (solo admin)
const confirmarCita = async (req, res) => {
    const citaId = req.params.id;
    
    try {
        const result = await pool.query(
            `UPDATE citas SET estado = 'confirmada' 
             WHERE id = $1 RETURNING *`,
            [citaId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        
        res.json({ 
            message: 'Cita confirmada exitosamente',
            cita: result.rows[0]
        });
    } catch (error) {
        console.error('Error en confirmarCita:', error);
        res.status(500).json({ error: 'Error al confirmar cita' });
    }
};

// Cancelar cita de cualquier paciente (solo admin)
const cancelarCitaAdmin = async (req, res) => {
    const citaId = req.params.id;
    const { motivo_cancelacion } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE citas SET estado = 'cancelada' 
             WHERE id = $1 RETURNING *`,
            [citaId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        
        res.json({ 
            message: 'Cita cancelada por el administrador',
            cita: result.rows[0],
            motivo_cancelacion
        });
    } catch (error) {
        console.error('Error en cancelarCitaAdmin:', error);
        res.status(500).json({ error: 'Error al cancelar cita' });
    }
};

// Obtener estadísticas del sistema (solo admin)
const getEstadisticas = async (req, res) => {
    try {
        const totalPacientes = await pool.query(
            "SELECT COUNT(*) FROM usuarios WHERE role = 'paciente'"
        );
        const totalMedicos = await pool.query(
            "SELECT COUNT(*) FROM usuarios WHERE role = 'medico'"
        );
        const totalAdmins = await pool.query(
            "SELECT COUNT(*) FROM usuarios WHERE role = 'admin'"
        );
        const citasHoy = await pool.query(
            'SELECT COUNT(*) FROM citas WHERE fecha = CURRENT_DATE'
        );
        const citasPendientes = await pool.query(
            "SELECT COUNT(*) FROM citas WHERE estado = 'pendiente'"
        );
        const citasConfirmadas = await pool.query(
            "SELECT COUNT(*) FROM citas WHERE estado = 'confirmada'"
        );
        const citasCanceladas = await pool.query(
            "SELECT COUNT(*) FROM citas WHERE estado = 'cancelada'"
        );
        
        res.json({
            total_pacientes: parseInt(totalPacientes.rows[0].count),
            total_medicos: parseInt(totalMedicos.rows[0].count),
            total_admins: parseInt(totalAdmins.rows[0].count),
            citas_hoy: parseInt(citasHoy.rows[0].count),
            citas_pendientes: parseInt(citasPendientes.rows[0].count),
            citas_confirmadas: parseInt(citasConfirmadas.rows[0].count),
            citas_canceladas: parseInt(citasCanceladas.rows[0].count)
        });
    } catch (error) {
        console.error('Error en getEstadisticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

// Listar todos los pacientes (solo admin)
const getPacientes = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, role, nombre, apellido, cedula, telefono, estado, created_at 
             FROM usuarios 
             WHERE role = 'paciente'
             ORDER BY created_at DESC`
        );
        
        res.json({ pacientes: result.rows });
    } catch (error) {
        console.error('Error en getPacientes:', error);
        res.status(500).json({ error: 'Error al obtener pacientes' });
    }
};

// ========== NUEVAS FUNCIONES PARA GESTIÓN DE USUARIOS ==========

// Listar todos los usuarios (admin)
const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.role, u.nombre, u.apellido, u.cedula, u.telefono, u.estado, u.created_at,
                    e.nombre as especialidad, m.consultorio, m.horario_atencion
             FROM usuarios u
             LEFT JOIN medicos m ON u.id = m.usuario_id
             LEFT JOIN especialidades e ON m.especialidad_id = e.id
             ORDER BY u.created_at DESC`
        );
        res.json({ usuarios: result.rows });
    } catch (error) {
        console.error('Error en getAllUsers:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

// Actualizar estado del usuario (habilitar/deshabilitar)
const updateUserStatus = async (req, res) => {
    const userId = req.params.id;
    const { estado } = req.body;
    
    if (!estado || !['activo', 'inactivo'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido. Debe ser "activo" o "inactivo"' });
    }
    
    try {
        const result = await pool.query(
            'UPDATE usuarios SET estado = $1 WHERE id = $2 RETURNING id, email, role, estado',
            [estado, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ 
            message: `Usuario ${estado === 'activo' ? 'habilitado' : 'deshabilitado'} correctamente`,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error en updateUserStatus:', error);
        res.status(500).json({ error: 'Error al actualizar estado del usuario' });
    }
};

// Actualizar usuario completo (email, rol, nombre, apellido, cedula, telefono)
// Actualizar usuario completo (incluyendo datos de médico)
const updateUser = async (req, res) => {
    const userId = req.params.id;
    const { 
        email, role, nombre, apellido, cedula, telefono, 
        especialidad, consultorio, horario_atencion, estado 
    } = req.body;
    
    try {
        // 1. Actualizar tabla usuarios
        const result = await pool.query(
            `UPDATE usuarios 
             SET email = $1, role = $2, nombre = $3, apellido = $4, 
                 cedula = $5, telefono = $6, estado = $7
             WHERE id = $8 
             RETURNING id, email, role, nombre, apellido, estado`,
            [email, role, nombre, apellido, cedula, telefono, estado || 'activo', userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // 2. Si es médico, actualizar tabla medicos
        if (role === 'medico' && especialidad) {
            // Obtener o crear especialidad_id
            let especialidadId = null;
            const espResult = await pool.query(
                'SELECT id FROM especialidades WHERE nombre = $1',
                [especialidad]
            );
            
            if (espResult.rows.length > 0) {
                especialidadId = espResult.rows[0].id;
            } else {
                const newEsp = await pool.query(
                    'INSERT INTO especialidades (nombre) VALUES ($1) RETURNING id',
                    [especialidad]
                );
                especialidadId = newEsp.rows[0].id;
            }
            
            // Verificar si ya existe registro en medicos
            const medicoExistente = await pool.query(
                'SELECT id FROM medicos WHERE usuario_id = $1',
                [userId]
            );
            
            if (medicoExistente.rows.length > 0) {
                // Actualizar registro existente
                await pool.query(
                    `UPDATE medicos 
                     SET especialidad_id = $1, consultorio = $2, horario_atencion = $3
                     WHERE usuario_id = $4`,
                    [especialidadId, consultorio || '', horario_atencion || '', userId]
                );
            } else {
                // Crear nuevo registro
                await pool.query(
                    `INSERT INTO medicos (usuario_id, especialidad_id, consultorio, horario_atencion) 
                     VALUES ($1, $2, $3, $4)`,
                    [userId, especialidadId, consultorio || '', horario_atencion || '']
                );
            }
        }
        
        res.json({ message: 'Usuario actualizado correctamente', user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'El email o cédula ya está en uso' });
        } else {
            console.error('Error en updateUser:', error);
            res.status(500).json({ error: 'Error al actualizar usuario' });
        }
    }
};

// Actualizar contraseña de usuario
const updateUserPassword = async (req, res) => {
    const userId = req.params.id;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE usuarios SET password = $1 WHERE id = $2',
            [hashedPassword, userId]
        );
        
        res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
        console.error('Error en updateUserPassword:', error);
        res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
};

// Exportar todas las funciones
module.exports = { 
    getAllCitas, 
    confirmarCita, 
    cancelarCitaAdmin, 
    getEstadisticas,
    getPacientes,
    getAllUsers,
    updateUserStatus,
    updateUser,
    updateUserPassword
};