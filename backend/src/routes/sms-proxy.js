const express = require('express');
const { get, run } = require('../database');

const router = express.Router();

function getSmsConfig() {
  var url = '', key = '', accounts = [];
  var urlRow = get("SELECT value FROM settings WHERE key = 'sms_system_url'");
  if (urlRow) url = urlRow.value;
  var keyRow = get("SELECT value FROM settings WHERE key = 'sms_system_api_key'");
  if (keyRow) key = keyRow.value;
  var accRow = get("SELECT value FROM settings WHERE key = 'sms_accounts'");
  if (accRow) { try { accounts = JSON.parse(accRow.value); } catch {} }
  return { url, key, accounts };
}

// Send SMS via painel-shortcode webhook
router.post('/send', async (req, res) => {
  try {
    var cfg = getSmsConfig();
    if (!cfg.url || !cfg.key) return res.status(400).json({ error: 'SMS system not configured. Set URL and API key in settings.' });

    var { phone, message, selectedAccounts } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required.' });

    var webhookUrl = cfg.url.replace(/\/+$/, '') + '/api/webhook/send';
    var bodyPhone = phone.replace(/\D/g, '');
    // Garante formato internacional com código 55
    if (bodyPhone.length <= 11) bodyPhone = '55' + bodyPhone;
    var body = { phone: bodyPhone, message: message };
    if (selectedAccounts && selectedAccounts.length) body.selectedAccounts = selectedAccounts;

    var resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.key
      },
      body: JSON.stringify(body)
    });

    var text = await resp.text();
    var data;
    try { data = JSON.parse(text); } catch { data = text; }

    res.status(resp.status).json({ status: resp.status, data: data });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Get accounts list
router.get('/accounts', (req, res) => {
  try {
    var cfg = getSmsConfig();
    res.json({ accounts: cfg.accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save SMS system config
router.post('/config', (req, res) => {
  try {
    var { sms_system_url, sms_system_api_key, sms_accounts } = req.body;
    if (sms_system_url !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_system_url', ?, datetime('now'))", [sms_system_url]);
    if (sms_system_api_key !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_system_api_key', ?, datetime('now'))", [sms_system_api_key]);
    if (sms_accounts !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_accounts', ?, datetime('now'))", [JSON.stringify(sms_accounts)]);
    res.json({ message: 'SMS config saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get SMS system config
router.get('/config', (req, res) => {
  try {
    var cfg = getSmsConfig();
    res.json({ url: cfg.url, key: cfg.key ? 'defined' : '', accounts: cfg.accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
