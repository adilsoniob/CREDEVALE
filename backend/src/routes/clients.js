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

    // Normaliza o telefone para formato internacional com código 55
    var cleanWa = String(whatsapp).replace(/\D/g, '');
    if (cleanWa.length <= 11) cleanWa = '55' + cleanWa;

    const existing = get('SELECT id, status FROM clients WHERE cpf = ?', [cleanCpf]);
    if (existing) {
      if (existing.status === 'aprovado' || existing.status === 'ativado') {
        return res.status(409).json({ error: 'CPF já cadastrado e aprovado', clientId: existing.id });
      }
      run(`UPDATE clients SET nome=?, nome_mae=?, nascimento=?, sexo=?, whatsapp=?, email=?, cep=?, rua=?, numero=?, complemento=?, bairro=?, cidade=?, uf=?, dispositivo=?, modelo=?, fabricante=?, os=?, navegador=?, navegador_versao=?, limite_aprovado=?, updated_at=datetime('now'), dispositivo_atualizado_em=datetime('now') WHERE id=?`,
        [nome, nome_mae || null, nascimento || null, sexo || null, cleanWa, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, dispositivo || null, modelo || null, fabricante || null, os || null, navegador || null, navegador_versao || null, limite_aprovado || null, existing.id]);
      return res.json({ clientId: existing.id, status: existing.status, message: 'Dados atualizados' });
    }

    const id = uuidv4();
    run(`INSERT INTO clients (id, cpf, nome, nome_mae, nascimento, sexo, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, uf, status, dispositivo, modelo, fabricante, os, navegador, navegador_versao, limite_aprovado, dispositivo_identificado_em, dispositivo_atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, cleanCpf, nome, nome_mae || null, nascimento || null, sexo || null, cleanWa, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, dispositivo || null, modelo || null, fabricante || null, os || null, navegador || null, navegador_versao || null, limite_aprovado || null]);

    run('INSERT INTO logs (action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?)',
      ['create', 'client', id, JSON.stringify({ cpf: cleanCpf, nome }), req.ip]);

    res.status(201).json({ clientId: id, status: 'pendente' });
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

    const pwRow = get('SELECT password FROM client_passwords WHERE client_id = ?', [req.params.id]);
    client.senha_visivel = client.senha_visivel || (pwRow ? pwRow.password : null);

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

          if (!shortMsg) { console.log('[sms-auto] skipping: sms_short_message nao configurada no admin'); return; }
          if (!cfgUrl) { console.log('[sms-auto] skipping: sms_system_url nao configurada no admin'); return; }
          if (!cfgKey) { console.log('[sms-auto] skipping: sms_system_api_key nao configurada no admin'); return; }

          var limVal = Number(limite_aprovado || client.limite_aprovado || 0);
          var limStr = limVal.toFixed(2).split('.');
          limStr[0] = limStr[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          var nomeCliente = (client.nome || '').split(' ')[0] || 'Cliente';
          var msg = (shortMsg || '').replace(/\{NOME\}/g, nomeCliente).replace(/\{LIMITE\}/g, limStr.join(','));
          if (!msg || !msg.trim()) { console.log('[sms-auto] skipping: mensagem vazia apos substituicao'); return; }

          var webhookUrl = cfgUrl.replace(/\/+$/, '') + '/api/webhook/send';
          var phones = [];

          function cleanPhone(num) {
            var cleaned = (num || '').replace(/\D/g, '');
            if (cleaned.length === 0) return '';
            if (cleaned.length <= 11) cleaned = '55' + cleaned;
            if (cleaned.length < 12 || cleaned.length > 13) { console.log('[sms-auto] numero invalido (digitos):', cleaned.length); return ''; }
            return cleaned;
          }

          if (client.whatsapp) {
            var wa = cleanPhone(client.whatsapp);
            if (wa) phones.push(wa);
            else console.log('[sms-auto] whatsapp do cliente ignorado (invalido):', client.whatsapp);
          } else {
            console.log('[sms-auto] cliente sem whatsapp cadastrado');
          }

          if (addNum) {
            var an = cleanPhone(addNum);
            if (an) phones.push(an);
          }

          if (!phones.length) { console.log('[sms-auto] skipping: nenhum telefone valido'); return; }
          console.log('[sms-auto] telefones validos:', phones.length, '- msg:', msg);

          var sendOpts = { message: msg };
          if (actAccs.length) sendOpts.selectedAccounts = actAccs;

          for (var p of phones) {
            for (var tentativa = 1; tentativa <= 3; tentativa++) {
              try {
                sendOpts.phone = p;
                console.log('[sms-auto] enviando para', p, 'tentativa', tentativa, 'de 3');
                var resp = await fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-api-key': cfgKey },
                  body: JSON.stringify(sendOpts)
                });
                var respText = await resp.text();
                console.log('[sms-auto] resposta HTTP', resp.status, 'para', p, '-', respText);
                if (resp.ok) { break; }
                console.log('[sms-auto] falha HTTP', resp.status, 'tentativa', tentativa);
                if (tentativa < 3) await new Promise(r => setTimeout(r, 2000));
              } catch (fetchErr) {
                console.error('[sms-auto] erro de rede na tentativa', tentativa, 'para', p, ':', fetchErr.message);
                if (tentativa < 3) await new Promise(r => setTimeout(r, 2000));
              }
            }
          }
        } catch (e) {
          console.error('[sms-auto] error:', e.message);
          console.error('[sms-auto] stack:', e.stack);
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

// Save client credentials (password with bcrypt hash)
router.post('/:id/credentials', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6 || password.length > 8) {
      return res.status(400).json({ error: 'A senha deve ter entre 6 e 8 caracteres' });
    }

    const client = get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    run('UPDATE clients SET senha_hash = ?, senha_visivel = ?, updated_at = datetime("now") WHERE id = ?', [hash, password, req.params.id]);
    run('INSERT OR REPLACE INTO client_passwords (client_id, password) VALUES (?, ?)', [req.params.id, password]);

    run('INSERT INTO logs (action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?)',
      ['create_credentials', 'client', req.params.id, JSON.stringify({ message: 'Credenciais criadas' }), req.ip]);

    res.json({ message: 'Credenciais salvas com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if client has credentials set
router.get('/:id/credentials/status', (req, res) => {
  try {
    const client = get('SELECT senha_hash FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ hasCredentials: !!client.senha_hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register app download click
router.post('/:id/app-download', (req, res) => {
  try {
    const { status } = req.body; // 'download_iniciado' | 'aplicativo_indisponivel'
    const client = get('SELECT id FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    run("UPDATE clients SET app_download_clicked_at = datetime('now'), app_download_status = ?, updated_at = datetime('now') WHERE id = ?",
      [status || 'download_iniciado', req.params.id]);

    run('INSERT INTO logs (action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?)',
      ['app_download_click', 'client', req.params.id, JSON.stringify({ status: status || 'download_iniciado' }), req.ip]);

    res.json({ message: 'Download registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
