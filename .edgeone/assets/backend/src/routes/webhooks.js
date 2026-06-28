const express = require('express');
const { get, run } = require('../database');

const router = express.Router();

// PushinPay webhook
router.post('/pushinpay', (req, res) => {
  try {
    const { transaction_id, status, amount } = req.body;
    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id obrigatório' });
    }

    const payment = get('SELECT * FROM payments WHERE id = ? OR pix_chave = ?', [transaction_id, transaction_id]);
    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    if (status === 'paid' || status === 'confirmed') {
      run('UPDATE payments SET status = "pago", paid_at = datetime("now") WHERE id = ?', [payment.id]);
      run('UPDATE requests SET status = "pago", updated_at = datetime("now") WHERE id = ?', [payment.request_id]);
      run('UPDATE clients SET status = "ativado", updated_at = datetime("now") WHERE id = ?', [payment.client_id]);
      run('INSERT INTO notifications (client_id, tipo, titulo, mensagem) VALUES (?, "payment", "Pagamento confirmado", "Seu pagamento foi confirmado com sucesso")', [payment.client_id]);
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
