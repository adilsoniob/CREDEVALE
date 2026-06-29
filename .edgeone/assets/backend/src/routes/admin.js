const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');
// (auth temporariamente desabilitada)

const router = express.Router();

// Dashboard stats
router.get('/dashboard', (req, res) => {
  try {
    const totalClients = get('SELECT COUNT(*) as count FROM clients').count;
    const pendingClients = get('SELECT COUNT(*) as count FROM clients WHERE status = ?', ['pendente']).count;
    const approvedClients = get('SELECT COUNT(*) as count FROM clients WHERE status = ?', ['aprovado']).count;
    const activatedClients = get('SELECT COUNT(*) as count FROM clients WHERE status = ?', ['ativado']).count;
    const totalRequests = get('SELECT COUNT(*) as count FROM requests').count;
    const pendingRequests = get('SELECT COUNT(*) as count FROM requests WHERE status = ?', ['pendente']).count;
    const totalPayments = get('SELECT COUNT(*) as count FROM payments').count;
    const paidPayments = get('SELECT COUNT(*) as count FROM payments WHERE status = ?', ['pago']).count;
    const totalRevenue = get('SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = ?', ['pago']).total;
    const pixPayments = get('SELECT COUNT(*) as count FROM payments WHERE metodo = ? AND status = ?', ['pix', 'pago']).count;
    const cardPayments = get('SELECT COUNT(*) as count FROM payments WHERE metodo = ? AND status = ?', ['cartao', 'pago']).count;
    const conversionRate = totalClients > 0 ? ((activatedClients / totalClients) * 100).toFixed(1) : 0;

    const onlineAgora = get(`SELECT COUNT(*) as count FROM clients WHERE last_active_at >= datetime('now', '-5 minutes')`).count;
    const totalPixCopies = get(`SELECT COALESCE(SUM(pix_copied_count), 0) as total FROM clients`).total;
    const totalPushinpayClicks = get(`SELECT COALESCE(SUM(pushinpay_click_count), 0) as total FROM clients`).total;

    const supportClickRow = get(`SELECT value FROM settings WHERE key = 'support_click_count'`);
    const supportClickCount = parseInt(supportClickRow?.value || '0', 10);
    const pageViewCount = get('SELECT COUNT(*) as count FROM page_views').count;
    const monthlyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-30 days')`).total;
    const dailyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-1 day')`).total;
    const weeklyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-7 days')`).total;
    const expectativaReceita = monthlyRevenue;

    const onlineSessions = get(`SELECT COUNT(*) as count FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds')`).count;
    const onlineSessionList = all(`SELECT id, nome, cpf, stage, dispositivo, modelo, fabricante, navegador, navegador_versao, os, ip, origem, last_activity FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds') ORDER BY last_activity DESC`);

    const recentClients = all('SELECT id, cpf, nome, whatsapp, status, created_at, dispositivo, modelo, fabricante, os, navegador, navegador_versao FROM clients ORDER BY created_at DESC LIMIT 10');
    const recentPayments = all(`SELECT p.*, c.nome as client_nome FROM payments p JOIN clients c ON p.client_id = c.id ORDER BY p.created_at DESC LIMIT 10`);

    res.json({
      kpis: { totalClients, pendingClients, approvedClients, activatedClients, totalRequests, pendingRequests, totalPayments, paidPayments, totalRevenue, pixPayments, cardPayments, conversionRate, onlineAgora, onlineSessions, totalPixCopies, totalPushinpayClicks, supportClickCount, pageViewCount, expectativaReceita, dailyRevenue, weeklyRevenue, monthlyRevenue },
      onlineSessionList,
      recentClients, recentPayments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs
router.get('/logs', (req, res) => {
  try {
    const { action, entity, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    if (action) { where.push('l.action = ?'); params.push(action); }
    if (entity) { where.push('l.entity = ?'); params.push(entity); }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    params.push(Number(limit), Number(offset));
    const logs = all(`SELECT l.*, u.name as user_name FROM logs l LEFT JOIN users u ON l.user_id = u.id${whereClause} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, params);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications
router.get('/notifications', (req, res) => {
  try {
    const notifications = all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/:id/read', (req, res) => {
  try {
    run('UPDATE notifications SET lida = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users management
router.get('/users', (req, res) => {
  try {
    const users = all('SELECT id, email, name, role, permissions, active, created_at FROM users ORDER BY created_at DESC');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { email, password, name, role, permissions } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'E-mail, senha e nome são obrigatórios' });
    }
    const existing = get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const id = uuidv4();
    run('INSERT INTO users (id, email, password_hash, name, role, permissions) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, hash, name, role || 'operador', JSON.stringify(permissions || [])]);
    res.status(201).json({ id, message: 'Usuário criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
router.get('/settings', (req, res) => {
  try {
    const rows = all('SELECT * FROM settings');
    const obj = {};
    rows.forEach(s => { obj[s.key] = s.value; });
    res.json({ settings: obj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))', [key, String(value)]);
    }
    res.json({ message: 'Configurações salvas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset system (clear all data)
router.post('/reset', (req, res) => {
  try {
    run('DELETE FROM payments');
    run('DELETE FROM requests');
    run('DELETE FROM notifications');
    run('DELETE FROM logs');
    run('DELETE FROM clients');
    run("INSERT INTO logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)",
      ['system', 'reset', '*', JSON.stringify({ action: 'Sistema zerado' })]);
    res.json({ message: 'Sistema zerado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset support clicks counter
router.post('/reset-support-clicks', (req, res) => {
  try {
    run("UPDATE settings SET value = '0', updated_at = datetime('now') WHERE key = 'support_click_count'");
    res.json({ message: 'Contador de suporte zerado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
