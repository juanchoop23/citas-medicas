const pool = require('../db');

// Listar todos los médicos disponibles (para pacientes al agendar)
const listarMedicosDisponibles = async (req, res) => {
    try {
        // Primero verificamos si existe la tabla medicos
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'medicos'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            // Si no existe la tabla, devolvemos médicos desde usuarios con role='medico'
            const result = await pool.query(
                `SELECT id, nombre, apellido, email, telefono, especialidad, consultorio
                 FROM usuarios 
                 WHERE role = 'medico' AND estado = 'activo'`
            );
            return res.json({ medicos: result.rows });
        }
        
        // Si existe la tabla medicos, hacemos JOIN
        const result = await pool.query(
            `SELECT m.id, m.consultorio, m.horario_atencion,
                    u.id as usuario_id, u.nombre, u.apellido, u.email, u.telefono,
                    COALESCE(e.nombre, u.especialidad) as especialidad
             FROM medicos m
             JOIN usuarios u ON m.usuario_id = u.id
             LEFT JOIN especialidades e ON m.especialidad_id = e.id
             WHERE u.estado = 'activo'
             ORDER BY especialidad, u.nombre`
        );
        
        res.json({ medicos: result.rows });
    } catch (error) {
        console.error('Error al listar médicos:', error);
        // Fallback: obtener médicos desde usuarios
        try {
            const fallback = await pool.query(
                `SELECT id, nombre, apellido, email, telefono, especialidad, consultorio
                 FROM usuarios 
                 WHERE role = 'medico' AND estado = 'activo'`
            );
            res.json({ medicos: fallback.rows });
        } catch (err) {
            res.status(500).json({ error: 'Error al obtener médicos' });
        }
    }
};

// Obtener horarios disponibles de un médico específico
const getHorariosMedico = async (req, res) => {
    const medicoId = req.params.id;
    const { fecha } = req.query;
    
    if (!fecha) {
        return res.status(400).json({ error: 'Fecha requerida' });
    }
    
    try {
        // Horarios predefinidos (8am a 5pm, cada 30 min)
        const todosHorarios = [];
        for (let h = 8; h < 17; h++) {
            for (let m of [0, 30]) {
                if (h === 8 && m === 0) continue; // empezamos 8:30
                if (h === 17 && m === 0) continue;
                todosHorarios.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
            }
        }
        
        // Consultar horarios ya ocupados para ese médico y fecha
        const ocupados = await pool.query(
            `SELECT hora FROM citas 
             WHERE medico_id = $1 AND fecha = $2 AND estado != 'cancelada'`,
            [medicoId, fecha]
        );
        
        const horariosOcupados = ocupados.rows.map(r => r.hora.slice(0, 5));
        const horariosDisponibles = todosHorarios.filter(h => !horariosOcupados.includes(h));
        
        res.json({
            medico_id: medicoId,
            fecha,
            horarios_disponibles: horariosDisponibles,
            horarios_ocupados: horariosOcupados
        });
    } catch (error) {
        console.error('Error en getHorariosMedico:', error);
        res.status(500).json({ error: 'Error al consultar horarios' });
    }
};

module.exports = { listarMedicosDisponibles, getHorariosMedico };