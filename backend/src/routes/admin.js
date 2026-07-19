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
    const totalClicks = (parseInt(totalPixCopies || 0) + parseInt(totalPushinpayClicks || 0) + parseInt(supportClickCount || 0));
    const monthlyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-30 days')`).total;
    const dailyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-1 day')`).total;
    const weeklyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-7 days')`).total;
    const expectativaReceita = monthlyRevenue;

    const onlineSessions = get(`SELECT COUNT(*) as count FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds')`).count;
    const onlineSessionList = all(`SELECT id, nome, cpf, stage, dispositivo, modelo, fabricante, navegador, navegador_versao, os, ip, origem, last_activity FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds') ORDER BY last_activity DESC`);

    const recentClients = all('SELECT id, cpf, nome, whatsapp, status, created_at, dispositivo, modelo, fabricante, os, navegador, navegador_versao FROM clients ORDER BY created_at DESC LIMIT 10');
    const recentPayments = all(`SELECT p.*, c.nome as client_nome FROM payments p JOIN clients c ON p.client_id = c.id ORDER BY p.created_at DESC LIMIT 10`);

    res.json({
      kpis: { totalClients, pendingClients, approvedClients, activatedClients, totalRequests, pendingRequests, totalPayments, paidPayments, totalRevenue, pixPayments, cardPayments, conversionRate, onlineAgora, onlineSessions, totalPixCopies, totalPushinpayClicks, supportClickCount, pageViewCount, totalClicks, expectativaReceita, dailyRevenue, weeklyRevenue, monthlyRevenue },
      onlineSessionList,
      recentClients, recentPayments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs
router.post('/logs', (req, res) => {
  try {
    const { action, entity, entity_id, details } = req.body;
    if (!action || !entity) return res.status(400).json({ error: 'action e entity são obrigatórios' });
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [req.user?.id || 'system', action, entity, entity_id || null, details || null, req.ip || null]);
    res.status(201).json({ message: 'Log registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const users = all('SELECT id, email, name, login, role, permissions, active, nivel, telefone, ultimo_acesso, created_at FROM users ORDER BY created_at DESC');
    const permissoes = all('SELECT * FROM permissoes ORDER BY nome');
    res.json({ users, permissoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { email, password, name, login, role, nivel, permissions, telefone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'E-mail, senha e nome são obrigatórios' });
    }
    const existing = get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const id = uuidv4();
    run('INSERT INTO users (id, email, password_hash, name, login, role, nivel, permissions, telefone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, email, hash, name, login || email, role || 'operador', nivel || 1, JSON.stringify(permissions || []), telefone || null]);
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_create', 'users', id, 'Criado: ' + name + ' (' + email + ')']);
    res.status(201).json({ id, message: 'Usuário criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', (req, res) => {
  try {
    const existing = get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { name, email, login, role, nivel, permissions, telefone, active } = req.body;
    if (name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', [name, req.params.id]);
    if (email !== undefined) run('UPDATE users SET email = ? WHERE id = ?', [email, req.params.id]);
    if (login !== undefined) run('UPDATE users SET login = ? WHERE id = ?', [login, req.params.id]);
    if (role !== undefined) run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (nivel !== undefined) run('UPDATE users SET nivel = ? WHERE id = ?', [nivel, req.params.id]);
    if (permissions !== undefined) run('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), req.params.id]);
    if (telefone !== undefined) run('UPDATE users SET telefone = ? WHERE id = ?', [telefone, req.params.id]);
    if (active !== undefined) run('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, req.params.id]);
    run("UPDATE users SET updated_at = datetime('now') WHERE id = ?", [req.params.id]);

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_update', 'users', req.params.id, 'Atualizado: ' + (name || '')]);
    res.json({ message: 'Usuário atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    const existing = get('SELECT id, name, email FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (existing.email === 'admin@valesaude.com.br') return res.status(400).json({ error: 'Não é possível excluir o administrador principal' });

    run('DELETE FROM users WHERE id = ?', [req.params.id]);
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_delete', 'users', req.params.id, 'Excluído: ' + existing.name]);
    res.json({ message: 'Usuário excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/change-password', (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });

    const existing = get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
    run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, req.params.id]);

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_password_change', 'users', req.params.id, 'Senha alterada']);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/toggle-active', (req, res) => {
  try {
    const existing = get('SELECT id, email, active FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (existing.email === 'admin@valesaude.com.br') return res.status(400).json({ error: 'Não é possível desativar o administrador principal' });

    const newActive = existing.active ? 0 : 1;
    run('UPDATE users SET active = ?, updated_at = datetime("now") WHERE id = ?', [newActive, req.params.id]);
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', newActive ? 'user_activate' : 'user_deactivate', 'users', req.params.id, 'Status alterado para ' + (newActive ? 'ativo' : 'inativo')]);
    res.json({ message: newActive ? 'Usuário ativado' : 'Usuário desativado', active: newActive });
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

// Admin: Reset dashboard counters (Pix, Push, page views, sessions) — keeps clients
router.post('/reset-counters', (req, res) => {
  try {
    run("UPDATE clients SET pix_copied_count = 0, pushinpay_click_count = 0, pix_copied_at = NULL");
    run('DELETE FROM sessions');
    run('DELETE FROM page_views');
    run("UPDATE settings SET value = '0', updated_at = datetime('now') WHERE key = 'support_click_count'");
    run("INSERT INTO logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)",
      ['system', 'reset-counters', '*', JSON.stringify({ action: 'Contadores do dashboard zerados' })]);
    res.json({ message: 'Contadores zerados com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SMS System Proxy
// ============================================================

function getSmsConfig() {
  var url = '', key = '', accounts = [], shortMessage = '', additionalNumber = '', activeAccounts = [];
  var urlRow = get("SELECT value FROM settings WHERE key = 'sms_system_url'");
  if (urlRow) url = urlRow.value;
  var keyRow = get("SELECT value FROM settings WHERE key = 'sms_system_api_key'");
  if (keyRow) key = keyRow.value;
  var accRow = get("SELECT value FROM settings WHERE key = 'sms_accounts'");
  if (accRow) { try { accounts = JSON.parse(accRow.value); } catch {} }
  var shortRow = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
  if (shortRow) shortMessage = shortRow.value;
  var addRow = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
  if (addRow) additionalNumber = addRow.value;
  var actRow = get("SELECT value FROM settings WHERE key = 'sms_active_accounts'");
  if (actRow) { try { activeAccounts = JSON.parse(actRow.value); } catch {} }
  return { url, key, accounts, shortMessage, additionalNumber, activeAccounts };
}

router.post('/sms/send', async (req, res) => {
  try {
    var cfg = getSmsConfig();
    if (!cfg.url || !cfg.key) return res.status(400).json({ error: 'SMS system not configured. Set URL and API key in settings.' });

    var { phone, message, selectedAccounts } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required.' });

    var webhookUrl = cfg.url.replace(/\/+$/, '') + '/api/webhook/send';
    var bodyPhone = phone.replace(/\D/g, '');
    if (bodyPhone.length <= 11) bodyPhone = '55' + bodyPhone;
    var body = { phone: bodyPhone, message: message };
    if (selectedAccounts && selectedAccounts.length) body.selectedAccounts = selectedAccounts;

    var resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key },
      body: JSON.stringify(body)
    });

    var text = await resp.text();
    var data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!resp.ok) {
      console.error('[SMS] Error:', resp.status, text, 'URL:', webhookUrl);
    }

    res.status(resp.status).json({ status: resp.status, data: data, sent_to: webhookUrl });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/sms/accounts', (req, res) => {
  try {
    var cfg = getSmsConfig();
    res.json({ accounts: cfg.accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sms/config', (req, res) => {
  try {
    var { sms_system_url, sms_system_api_key, sms_accounts, sms_short_message, sms_additional_number, sms_active_accounts } = req.body;
    if (sms_system_url !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_system_url', ?, datetime('now'))", [sms_system_url]);
    if (sms_system_api_key !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_system_api_key', ?, datetime('now'))", [sms_system_api_key]);
    if (sms_accounts !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_accounts', ?, datetime('now'))", [JSON.stringify(sms_accounts)]);
    if (sms_short_message !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_short_message', ?, datetime('now'))", [sms_short_message]);
    if (sms_additional_number !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_additional_number', ?, datetime('now'))", [sms_additional_number]);
    if (sms_active_accounts !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_active_accounts', ?, datetime('now'))", [JSON.stringify(sms_active_accounts)]);
    res.json({ message: 'SMS config saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sms/config', (req, res) => {
  try {
    var cfg = getSmsConfig();
    res.json({ url: cfg.url, key: cfg.key ? 'defined' : '', accounts: cfg.accounts, shortMessage: cfg.shortMessage, additionalNumber: cfg.additionalNumber, activeAccounts: cfg.activeAccounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
