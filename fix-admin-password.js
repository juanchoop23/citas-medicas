require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db');

async function fixAdminPassword() {
    const email = 'admin@clinica.com';
    const newPassword = 'admin123'; // Cambia si quieres otra contraseña
    
    // Cifrar la contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    try {
        // Actualizar la contraseña en la BD
        const result = await pool.query(
            'UPDATE usuarios SET password = $1 WHERE email = $2 RETURNING email, role',
            [hashedPassword, email]
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Contraseña actualizada correctamente');
            console.log('📧 Email:', email);
            console.log('🔑 Nueva contraseña:', newPassword);
            console.log('👤 Rol:', result.rows[0].role);
        } else {
            console.log('❌ Usuario no encontrado');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

fixAdminPassword();