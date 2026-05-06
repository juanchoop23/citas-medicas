const express = require('express');
const router = express.Router();
const pool = require('../db');

// Listar médicos disponibles (para pacientes al agendar) - Ruta PÚBLICA
router.get('/disponibles', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT m.id, m.consultorio, m.horario_atencion,
                    u.id as usuario_id, u.nombre, u.apellido, u.email, u.telefono,
                    COALESCE(e.nombre, 'Medicina General') as especialidad
             FROM medicos m
             JOIN usuarios u ON m.usuario_id = u.id
             LEFT JOIN especialidades e ON m.especialidad_id = e.id
             WHERE u.estado = 'activo'
             ORDER BY e.nombre, u.nombre`
        );
        
        res.json({ medicos: result.rows });
    } catch (error) {
        console.error('Error al listar médicos:', error);
        res.status(500).json({ error: 'Error al obtener médicos' });
    }
});

// Obtener horarios de un médico específico
router.get('/:id/horarios', async (req, res) => {
    const medicoId = req.params.id;
    const { fecha } = req.query;
    
    if (!fecha) {
        return res.status(400).json({ error: 'Fecha requerida' });
    }
    
    try {
        // Horarios predefinidos (8:30 AM a 5:00 PM, cada 30 min)
        const todosHorarios = [];
        for (let h = 8; h < 17; h++) {
            for (let m of [0, 30]) {
                if (h === 8 && m === 0) continue;
                if (h === 17 && m === 30) continue;
                todosHorarios.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
            }
        }
        
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
        console.error('Error en horarios:', error);
        res.status(500).json({ error: 'Error al consultar horarios' });
    }
});

module.exports = router;