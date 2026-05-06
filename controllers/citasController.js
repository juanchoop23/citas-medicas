const pool = require('../db');

// Ver horarios disponibles para una fecha
const getDisponibilidad = async (req, res) => {
    const { fecha } = req.query;
    
    if (!fecha) {
        return res.status(400).json({ error: 'La fecha es requerida' });
    }
    
    try {
        // Generar todos los horarios posibles (8:00 AM a 5:00 PM, cada 30 min)
        const todosHorarios = [];
        for (let h = 8; h < 17; h++) {
            for (let m of [0, 30]) {
                if (h === 17 && m === 30) continue;
                todosHorarios.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
            }
        }
        
        // Consultar horarios ya ocupados
        const result = await pool.query(
            `SELECT hora FROM citas 
             WHERE fecha = $1 AND estado != 'cancelada'`,
            [fecha]
        );
        
        const ocupados = result.rows.map(r => r.hora.slice(0, 5));
        const disponibles = todosHorarios.filter(h => !ocupados.includes(h));
        
        res.json({
            fecha,
            horarios_disponibles: disponibles,
            horarios_ocupados: ocupados
        });
    } catch (error) {
        console.error('Error en getDisponibilidad:', error);
        res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
};

// Agendar una nueva cita
// Agendar cita (ahora con médico seleccionado)
const agendarCita = async (req, res) => {
    const { fecha, hora, motivo, medico_id } = req.body;
    const paciente_email = req.user.email;
    
    if (!fecha || !hora || !medico_id) {
        return res.status(400).json({ error: 'Fecha, hora y médico son requeridos' });
    }
    
    try {
        // Verificar que el médico existe y está activo
        const medicoValido = await pool.query(
            `SELECT m.id FROM medicos m
             JOIN usuarios u ON m.usuario_id = u.id
             WHERE m.id = $1 AND u.estado = 'activo'`,
            [medico_id]
        );
        
        if (medicoValido.rows.length === 0) {
            return res.status(404).json({ error: 'Médico no disponible' });
        }
        
        // Verificar que el horario no esté ocupado para ese médico
        const ocupada = await pool.query(
            `SELECT * FROM citas 
             WHERE medico_id = $1 AND fecha = $2 AND hora = $3 AND estado != 'cancelada'`,
            [medico_id, fecha, hora]
        );
        
        if (ocupada.rows.length > 0) {
            return res.status(409).json({ error: 'Este horario ya no está disponible para este médico' });
        }
        
        // Crear la cita
        const result = await pool.query(
            `INSERT INTO citas (paciente_email, medico_id, fecha, hora, motivo, estado) 
             VALUES ($1, $2, $3, $4, $5, 'pendiente') 
             RETURNING id, fecha, hora, motivo, estado`,
            [paciente_email, medico_id, fecha, hora, motivo || '']
        );
        
        res.status(201).json({
            message: 'Cita agendada exitosamente',
            cita: result.rows[0]
        });
    } catch (error) {
        console.error('Error en agendarCita:', error);
        res.status(500).json({ error: 'Error al agendar cita' });
    }
};

// Obtener mis citas (del usuario autenticado)
const getMisCitas = async (req, res) => {
    const paciente_email = req.user.email;
    
    try {
        const result = await pool.query(
            `SELECT id, fecha, hora, motivo, estado, created_at 
             FROM citas 
             WHERE paciente_email = $1 
             ORDER BY fecha DESC, hora DESC`,
            [paciente_email]
        );
        
        res.json({ citas: result.rows });
    } catch (error) {
        console.error('Error en getMisCitas:', error);
        res.status(500).json({ error: 'Error al obtener citas' });
    }
};

// Cancelar una cita (solo la del usuario autenticado)
const cancelarCita = async (req, res) => {
    const citaId = req.params.id;
    const paciente_email = req.user.email;
    
    try {
        // Verificar que la cita pertenezca al usuario
        const cita = await pool.query(
            `SELECT * FROM citas WHERE id = $1 AND paciente_email = $2`,
            [citaId, paciente_email]
        );
        
        if (cita.rows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        
        // Cancelar la cita
        await pool.query(
            `UPDATE citas SET estado = 'cancelada' WHERE id = $1`,
            [citaId]
        );
        
        res.json({ message: 'Cita cancelada exitosamente' });
    } catch (error) {
        console.error('Error en cancelarCita:', error);
        res.status(500).json({ error: 'Error al cancelar cita' });
    }
};

module.exports = { 
    getDisponibilidad, 
    agendarCita, 
    getMisCitas, 
    cancelarCita 
};