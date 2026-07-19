const jwt = require('jsonwebtoken');
const { get } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'vale-saude-secret';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = get('SELECT id, email, name, login, role, permissions, active, nivel, telefone, foto, ultimo_acesso FROM users WHERE id = ?', [decoded.userId]);

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      login: user.login,
      role: user.role,
      nivel: user.nivel || 1,
      telefone: user.telefone,
      foto: user.foto,
      ultimo_acesso: user.ultimo_acesso,
      permissions: JSON.parse(user.permissions || '[]')
    };

    // Update ultimo_acesso
    try {
      const { run } = require('../database');
      run("UPDATE users SET ultimo_acesso = datetime('now') WHERE id = ?", [user.id]);
    } catch (e) {}

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user.permissions.includes('*')) return next();
    const has = perms.some(p => req.user.permissions.includes(p));
    if (!has) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

function requireNivel(minNivel) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user.permissions.includes('*')) return next();
    if ((req.user.nivel || 1) >= minNivel) return next();
    return res.status(403).json({ error: 'Acesso negado. Nível insuficiente.' });
  };
}

module.exports = { authMiddleware, requirePermission, requireAdmin, requireNivel };
