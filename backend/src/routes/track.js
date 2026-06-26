const express = require('express');
const { get, run } = require('../database');

const router = express.Router();

router.post('/pushinpay-click', (req, res) => {
  try {
    const { client_id } = req.body;
    if (client_id) {
      run(`UPDATE clients SET pushinpay_clicked_at = datetime('now'), pushinpay_click_count = COALESCE(pushinpay_click_count, 0) + 1 WHERE id = ?`, [client_id]);
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
      run(`UPDATE clients SET pix_copied_at = datetime('now'), pix_copy_count = COALESCE(pix_copy_count, 0) + 1 WHERE id = ?`, [client_id]);
    }
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
