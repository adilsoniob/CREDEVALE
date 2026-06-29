const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');
// (auth desabilitada)

const router = express.Router();

// Public: Create client (registration)
router.post('/', (req, res) => {
  try {
    const { cpf, nome, nome_mae, nascimento, sexo, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, uf, dispositivo, modelo, fabricante, os, navegador, navegador_versao, limite_aprovado } = req.body;

    if (!cpf || !nome || !whatsapp) {
      return res.status(400).json({ error: 'CPF, nome e WhatsApp são obrigatórios' });
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido' });
    }

    const existing = get('SELECT id, status, nome as existing_nome, whatsapp as existing_wa, limite_aprovado as existing_limite FROM clients WHERE cpf = ?', [cleanCpf]);
    if (existing) {
      if (existing.status === 'aprovado' || existing.status === 'ativado') {
        return res.status(409).json({ error: 'CPF já cadastrado e aprovado', clientId: existing.id });
      }
      run(`UPDATE clients SET status='aprovado', nome=?, nome_mae=?, nascimento=?, sexo=?, whatsapp=?, email=?, cep=?, rua=?, numero=?, complemento=?, bairro=?, cidade=?, uf=?, dispositivo=?, modelo=?, fabricante=?, os=?, navegador=?, navegador_versao=?, limite_aprovado=?, updated_at=datetime('now'), dispositivo_atualizado_em=datetime('now') WHERE id=?`,
        [nome, nome_mae || null, nascimento || null, sexo || null, whatsapp, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, dispositivo || null, modelo || null, fabricante || null, os || null, navegador || null, navegador_versao || null, limite_aprovado || null, existing.id]);
      res.json({ clientId: existing.id, status: 'aprovado', message: 'Dados atualizados' });
      // Auto-send SMS on re-registration approval
      setImmediate(async () => {
        try {
          var cfgUrl2 = '', cfgKey2 = '', shortMsg2 = '', addNum2 = '', actAccs2 = [];
          var uRow2 = get("SELECT value FROM settings WHERE key = 'sms_system_url'");
          if (uRow2) cfgUrl2 = uRow2.value;
          var kRow2 = get("SELECT value FROM settings WHERE key = 'sms_system_api_key'");
          if (kRow2) cfgKey2 = kRow2.value;
          var sRow2 = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
          if (sRow2) shortMsg2 = sRow2.value;
          var aRow2 = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
          if (aRow2) addNum2 = aRow2.value;
          var actRow2 = get("SELECT value FROM settings WHERE key = 'sms_active_accounts'");
          if (actRow2) { try { actAccs2 = JSON.parse(actRow2.value); } catch {} }
          if (!shortMsg2 || !cfgUrl2 || !cfgKey2) return;
          var limVal2 = Number(limite_aprovado || existing.existing_limite || 0);
          var limStr2 = limVal2.toFixed(2).split('.');
          limStr2[0] = limStr2[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          var nomeCliente2 = (nome || '').split(' ')[0] || 'Cliente';
          var msg2 = shortMsg2.replace(/\{NOME\}/g, nomeCliente2).replace(/\{LIMITE\}/g, limStr2.join(','));
          var waUrl2 = cfgUrl2.replace(/\/+$/, '') + '/api/webhook/send';
          var phones2 = [];
          if (whatsapp) { var w2 = whatsapp.replace(/\D/g, ''); if (w2.length <= 11) w2 = '55' + w2; phones2.push(w2); }
          if (addNum2) { var a2 = addNum2.replace(/\D/g, ''); if (a2.length <= 11) a2 = '55' + a2; phones2.push(a2); }
          if (!phones2.length) return;
          var opts2 = { message: msg2 };
          if (actAccs2.length) opts2.selectedAccounts = actAccs2;
          for (var p2 of phones2) { opts2.phone = p2; await fetch(waUrl2, { method:'POST', headers:{'Content-Type':'application/json','x-api-key':cfgKey2}, body:JSON.stringify(opts2) }); }
        } catch (e) { console.error('[sms-auto-update]', e.message); }
      });
      return;
    }

    const id = uuidv4();
    run(`INSERT INTO clients (id, cpf, nome, nome_mae, nascimento, sexo, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, uf, status, dispositivo, modelo, fabricante, os, navegador, navegador_versao, limite_aprovado, dispositivo_identificado_em, dispositivo_atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aprovado', ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, cleanCpf, nome, nome_mae || null, nascimento || null, sexo || null, whatsapp, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, dispositivo || null, modelo || null, fabricante || null, os || null, navegador || null, navegador_versao || null, limite_aprovado || null]);

    run('INSERT INTO logs (action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?)',
      ['create', 'client', id, JSON.stringify({ cpf: cleanCpf, nome }), req.ip]);

    res.status(201).json({ clientId: id, status: 'aprovado' });

    // Auto-send SMS on approval
    setImmediate(async () => {
      try {
        var cfgUrl = '', cfgKey = '', shortMsg = '', addNum = '', actAccs = [];
        var uRow = get("SELECT value FROM settings WHERE key = 'sms_system_url'");
        if (uRow) cfgUrl = uRow.value;
        var kRow = get("SELECT value FROM settings WHERE key = 'sms_system_api_key'");
        if (kRow) cfgKey = kRow.value;
        var sRow = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
        if (sRow) shortMsg = sRow.value;
        var aRow = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
        if (aRow) addNum = aRow.value;
        var actRow = get("SELECT value FROM settings WHERE key = 'sms_active_accounts'");
        if (actRow) { try { actAccs = JSON.parse(actRow.value); } catch {} }

        console.log('[sms-auto-create] shortMsg:', JSON.stringify(shortMsg), 'nome:', nome, 'limite:', limite_aprovado, 'addNum:', addNum);
        if (!shortMsg || !cfgUrl || !cfgKey) { console.log('[sms-auto-create] skipping: missing config'); return; }

        var limVal = Number(limite_aprovado || 0);
        var limStr = limVal.toFixed(2).split('.');
        limStr[0] = limStr[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        var nomeCliente = (nome || '').split(' ')[0] || 'Cliente';
        var msg = shortMsg.replace(/\{NOME\}/g, nomeCliente).replace(/\{LIMITE\}/g, limStr.join(','));
        console.log('[sms-auto-create] final msg:', msg);

        var webhookUrl = cfgUrl.replace(/\/+$/, '') + '/api/webhook/send';
        var phones = [];
        if (whatsapp) {
          var wa = whatsapp.replace(/\D/g, '');
          if (wa.length <= 11) wa = '55' + wa;
          phones.push(wa);
        }
        if (addNum) {
          var an = addNum.replace(/\D/g, '');
          if (an.length <= 11) an = '55' + an;
          phones.push(an);
        }
        console.log('[sms-auto-create] phones:', phones);
        if (!phones.length) return;

        var sendOpts = { message: msg };
        if (actAccs.length) sendOpts.selectedAccounts = actAccs;

        for (var p of phones) {
          sendOpts.phone = p;
          console.log('[sms-auto-create] sending to', p);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': cfgKey },
            body: JSON.stringify(sendOpts)
          });
        }
      } catch (e) {
        console.error('[sms-auto-create] error:', e.message);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Get client by CPF
router.get('/by-cpf/:cpf', (req, res) => {
  try {
    const cpf = req.params.cpf.replace(/\D/g, '');
    const client = get('SELECT id, cpf, nome, status, limite_aprovado, produto_escolhido FROM clients WHERE cpf = ?', [cpf]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: List all clients
router.get('/', (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (status) { where.push('status = ?'); params.push(status); }
    if (search) {
      where.push('(nome LIKE ? OR cpf LIKE ? OR whatsapp LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = get('SELECT COUNT(*) as total FROM clients' + whereClause, params).total;

    params.push(Number(limit), Number(offset));
    const clients = all('SELECT * FROM clients' + whereClause + ' ORDER BY created_at DESC LIMIT ? OFFSET ?', params);

    res.json({ clients, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const client = get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    const requests = all('SELECT * FROM requests WHERE client_id = ? ORDER BY created_at DESC', [req.params.id]);
    const payments = all('SELECT * FROM payments WHERE client_id = ? ORDER BY created_at DESC', [req.params.id]);

    res.json({ client, requests, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const { status, limite_aprovado } = req.body;
    const validStatuses = ['pendente', 'aprovado', 'reprovado', 'ativado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const client = get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    run('UPDATE clients SET status = ?, limite_aprovado = ?, updated_at = datetime("now") WHERE id = ?',
      [status, limite_aprovado || client.limite_aprovado, req.params.id]);

    run('INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      ['system', 'update_status', 'client', req.params.id, JSON.stringify({ old: client.status, new: status })]);

    run('INSERT INTO notifications (client_id, tipo, titulo, mensagem) VALUES (?, ?, ?, ?)',
      [req.params.id, 'status_change', `Status alterado para ${status}`, `Cliente ${client.nome} teve status alterado de ${client.status} para ${status}`]);

    res.json({ message: 'Status atualizado', client: { ...client, status } });

    if (status === 'aprovado' && client.status !== 'aprovado') {
      setImmediate(async () => {
        try {
          var cfgUrl = '', cfgKey = '', shortMsg = '', addNum = '', actAccs = [];
          var uRow = get("SELECT value FROM settings WHERE key = 'sms_system_url'");
          if (uRow) cfgUrl = uRow.value;
          var kRow = get("SELECT value FROM settings WHERE key = 'sms_system_api_key'");
          if (kRow) cfgKey = kRow.value;
          var sRow = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
          if (sRow) shortMsg = sRow.value;
          var aRow = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
          if (aRow) addNum = aRow.value;
          var actRow = get("SELECT value FROM settings WHERE key = 'sms_active_accounts'");
          if (actRow) { try { actAccs = JSON.parse(actRow.value); } catch {} }

          console.log('[sms-auto] shortMsg:', JSON.stringify(shortMsg), 'nome:', client.nome, 'limite_aprovado:', limite_aprovado, 'client.limite:', client.limite_aprovado, 'addNum:', addNum);
          if (!shortMsg || !cfgUrl || !cfgKey) { console.log('[sms-auto] skipping: missing config'); return; }

          var limVal = Number(limite_aprovado || client.limite_aprovado || 0);
var limStr = limVal.toFixed(2).split('.');
limStr[0] = limStr[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
var nomeCliente = (client.nome || '').split(' ')[0] || 'Cliente';
var msg = shortMsg.replace(/\{NOME\}/g, nomeCliente).replace(/\{LIMITE\}/g, limStr.join(','));
          console.log('[sms-auto] final msg:', msg);
          var webhookUrl = cfgUrl.replace(/\/+$/, '') + '/api/webhook/send';
          var phones = [];
          if (client.whatsapp) {
            var wa = client.whatsapp.replace(/\D/g, '');
            if (wa.length <= 11) wa = '55' + wa;
            phones.push(wa);
          }
          if (addNum) {
            var an = addNum.replace(/\D/g, '');
            if (an.length <= 11) an = '55' + an;
            phones.push(an);
          }
          console.log('[sms-auto] phones:', phones);
          if (!phones.length) return;

          var sendOpts = { message: msg };
          if (actAccs.length) sendOpts.selectedAccounts = actAccs;

          for (var p of phones) {
            sendOpts.phone = p;
            console.log('[sms-auto] sending to', p, 'msg:', msg);
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': cfgKey },
              body: JSON.stringify(sendOpts)
            });
          }
        } catch (e) {
          console.error('[sms-auto] error:', e.message);
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const client = get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    run('DELETE FROM clients WHERE id = ?', [req.params.id]);

    run('INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      ['system', 'delete', 'client', req.params.id, JSON.stringify({ cpf: client.cpf, nome: client.nome })]);

    res.json({ message: 'Cliente removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete all clients (and related data)
router.post('/delete-all', (req, res) => {
  try {
    run('DELETE FROM payments');
    run('DELETE FROM requests');
    run('DELETE FROM notifications');
    run('DELETE FROM clients');
    run("INSERT INTO logs (action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?)",
      ['delete_all', 'client', '*', JSON.stringify({ action: 'Todos os clientes excluídos' }), req.ip]);
    res.json({ message: 'Todos os clientes e dados relacionados foram excluídos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update client device info from session
router.patch('/:id/device', (req, res) => {
  try {
    const { dispositivo, modelo, fabricante, os, navegador, navegador_versao } = req.body;
    const client = get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    var sets = [];
    var params = [];
    if (dispositivo) { sets.push('dispositivo = ?'); params.push(dispositivo); }
    if (modelo) { sets.push('modelo = ?'); params.push(modelo); }
    if (fabricante) { sets.push('fabricante = ?'); params.push(fabricante); }
    if (os) { sets.push('os = ?'); params.push(os); }
    if (navegador) { sets.push('navegador = ?'); params.push(navegador); }
    if (navegador_versao) { sets.push('navegador_versao = ?'); params.push(navegador_versao); }
    if (sets.length) {
      sets.push("dispositivo_atualizado_em = datetime('now')");
      if (!client.dispositivo || !client.fabricante) {
        sets.push("dispositivo_identificado_em = COALESCE(dispositivo_identificado_em, datetime('now'))");
      }
      params.push(req.params.id);
      run(`UPDATE clients SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, params);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
