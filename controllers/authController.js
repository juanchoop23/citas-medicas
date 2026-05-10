const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// Registro de usuario (ahora con más campos y creación automática en medicos)
const register = async (req, res) => {
    const { 
        email, 
        password, 
        role = 'paciente',
        nombre,
        apellido,
        cedula,
        telefono,
        especialidad,
        consultorio,
        horario_atencion
    } = req.body;
    
    // Validaciones
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    // Verificar quien crea (solo admin puede crear admin o medico)
    let rolAsignado = role;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role !== 'admin' && (role === 'admin' || role === 'medico')) {
                return res.status(403).json({ error: 'No tienes permisos para crear este rol' });
            }
        } catch (error) {
            if (role === 'admin' || role === 'medico') {
                return res.status(401).json({ error: 'No autorizado para crear este rol' });
            }
            rolAsignado = 'paciente';
        }
    } else {
        if (role === 'admin' || role === 'medico') {
            return res.status(401).json({ error: 'No autorizado para crear este rol' });
        }
        rolAsignado = 'paciente';
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insertar usuario
        const result = await pool.query(
            `INSERT INTO usuarios (email, password, role, nombre, apellido, cedula, telefono, estado) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo') 
             RETURNING id, email, role, nombre, apellido, estado`,
            [email, hashedPassword, rolAsignado, nombre, apellido, cedula, telefono]
        );
        
        const nuevoUsuario = result.rows[0];
        
        // ========== NUEVO: Si es médico, crear registro en tabla medicos ==========
        // Si es médico, crear registro en tabla medicos
        if (rolAsignado === 'medico') {
            let especialidadId = 1; // Por defecto Medicina General
            if (especialidad) {
                const espResult = await pool.query('SELECT id FROM especialidades WHERE nombre = $1', [especialidad]);
                if (espResult.rows.length > 0) {
                    especialidadId = espResult.rows[0].id;
                } else {
                    const newEsp = await pool.query('INSERT INTO especialidades (nombre) VALUES ($1) RETURNING id', [especialidad]);
                    especialidadId = newEsp.rows[0].id;
                }
            }
            
            await pool.query(
                `INSERT INTO medicos (usuario_id, especialidad_id, consultorio, horario_atencion) 
                VALUES ($1, $2, $3, $4)`,
                [nuevoUsuario.id, especialidadId, consultorio || 'Consultorio General', horario_atencion || 'Lun-Vie 8:00-17:00']
            );
        }
        // ================================================================
        
        res.status(201).json({ 
            message: 'Usuario creado exitosamente', 
            user: nuevoUsuario 
        });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'El email o cédula ya está registrado' });
        } else {
            console.error('Error en register:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
};

// Login
const login = async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const user = result.rows[0];
        
        // Verificar si el usuario está deshabilitado
        if (user.estado === 'inactivo') {
            return res.status(401).json({ error: 'Usuario deshabilitado. Contacta al administrador.' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                nombre: user.nombre,
                apellido: user.apellido
            } 
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = { register, login };