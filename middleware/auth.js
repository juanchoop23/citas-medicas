const jwt = require('jsonwebtoken');

// Verificar que el usuario esté autenticado
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

// Verificar que sea administrador
const verificarAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Acceso denegado. Se requieren privilegios de administrador.' 
    });
  }
  next();
};

module.exports = { verificarToken, verificarAdmin };