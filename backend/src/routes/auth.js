const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vale-saude-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const user = get('SELECT * FROM users WHERE email = ? AND active = 1', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    run('INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [user.id, 'login', 'user', user.id, JSON.stringify({ email })]);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senhas são obrigatórias' });
    }

    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const hash = crypto.createHash('sha256').update(currentPassword).digest('hex');

    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [newHash, req.user.id]);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
