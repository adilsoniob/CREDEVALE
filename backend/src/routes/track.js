const express = require('express');
const { get, run, all } = require('../database');

const router = express.Router();

router.post('/pushinpay-click', (req, res) => {
  try {
    const { client_id } = req.body;
    if (client_id) {
      run(`UPDATE clients SET pushinpay_clicked_at = datetime('now'), pushinpay_click_count = COALESCE(pushinpay_click_count, 0) + 1, last_active_at = datetime('now') WHERE id = ?`, [client_id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pix-copy', (req, res) => {
  try {
    const { client_id } = req.body;
    if (client_id) {
      run(`UPDATE clients SET pix_copied_at = datetime('now'), pix_copied_count = COALESCE(pix_copied_count, 0) + 1, last_active_at = datetime('now') WHERE id = ?`, [client_id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session/start', (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const { visitor_id, dispositivo, modelo, fabricante, navegador, navegador_versao, os, origem, client_id } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    run(`INSERT INTO sessions (id, visitor_id, client_id, stage, ip, user_agent, dispositivo, modelo, fabricante, navegador, navegador_versao, os, origem) VALUES (?, ?, ?, 'Visitando Landing Page', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, visitor_id || id, client_id || null, ip, userAgent, dispositivo || '', modelo || '', fabricante || '', navegador || '', navegador_versao || '', os || '', origem || '']);
    res.json({ session_id: id, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session/heartbeat', (req, res) => {
  try {
    const { session_id } = req.body;
    if (session_id) {
      run(`UPDATE sessions SET last_heartbeat = datetime('now'), last_activity = datetime('now'), offline_at = NULL WHERE id = ?`, [session_id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session/stage', (req, res) => {
  try {
    const { session_id, stage, nome, cpf, dispositivo, modelo, fabricante, navegador, navegador_versao, os } = req.body;
    if (session_id) {
      var extras = `, last_activity = datetime('now'), last_heartbeat = datetime('now'), offline_at = NULL`;
      var params = [stage];
      if (nome) { extras += `, nome = ?`; params.push(nome); }
      if (cpf) { extras += `, cpf = ?`; params.push(cpf); }
      if (dispositivo) { extras += `, dispositivo = ?`; params.push(dispositivo); }
      if (modelo) { extras += `, modelo = ?`; params.push(modelo); }
      if (fabricante) { extras += `, fabricante = ?`; params.push(fabricante); }
      if (navegador) { extras += `, navegador = ?`; params.push(navegador); }
      if (navegador_versao) { extras += `, navegador_versao = ?`; params.push(navegador_versao); }
      if (os) { extras += `, os = ?`; params.push(os); }
      params.push(session_id);
      run(`UPDATE sessions SET stage = ?${extras} WHERE id = ?`, params);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session/update-device', (req, res) => {
  try {
    const { session_id, dispositivo, modelo, fabricante, navegador, navegador_versao, os } = req.body;
    if (session_id && (dispositivo || modelo || fabricante || navegador || navegador_versao || os)) {
      var sets = [];
      var params = [];
      if (dispositivo) { sets.push('dispositivo = ?'); params.push(dispositivo); }
      if (modelo) { sets.push('modelo = ?'); params.push(modelo); }
      if (fabricante) { sets.push('fabricante = ?'); params.push(fabricante); }
      if (navegador) { sets.push('navegador = ?'); params.push(navegador); }
      if (navegador_versao) { sets.push('navegador_versao = ?'); params.push(navegador_versao); }
      if (os) { sets.push('os = ?'); params.push(os); }
      if (sets.length) {
        params.push(session_id);
        run(`UPDATE sessions SET ${sets.join(', ')}, last_activity = datetime('now'), last_heartbeat = datetime('now'), offline_at = NULL WHERE id = ?`, params);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/active', (req, res) => {
  try {
    run(`UPDATE sessions SET offline_at = datetime('now') WHERE offline_at IS NULL AND last_heartbeat < datetime('now', '-60 seconds')`);
    const active = all(`SELECT * FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds') ORDER BY last_activity DESC`);
    const recent = all(`SELECT * FROM sessions WHERE offline_at IS NOT NULL AND last_activity >= datetime('now', '-24 hours') ORDER BY last_activity DESC LIMIT 20`);
    res.json({ sessions: active, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/page-view', (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    const referrer = (req.body?.referrer || req.headers['referer'] || '').slice(0, 500);
    run('INSERT INTO page_views (id, ip, user_agent, referrer) VALUES (?, ?, ?, ?)',
      [id, ip, userAgent, referrer]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: test HydraCPF key directly
router.post('/debug-hydra', async (req, res) => {
  try {
    const { key, cpf } = req.body;
    if (!key) return res.status(400).json({ error: 'key é obrigatório' });
    const clean = (cpf || '36686949825').replace(/\D/g, '');
    const url = `https://api.hydracpf.com/v1/cpf/${clean}`;
    const resp = await fetch(url, { headers: { 'x-api-key': key } });
    const body = await resp.text().catch(() => '');
    res.json({ status: resp.status, ok: resp.ok, body: body.slice(0,500) });
  } catch (err) {
    res.json({ error: err.message });
  }
});

module.exports = router;
