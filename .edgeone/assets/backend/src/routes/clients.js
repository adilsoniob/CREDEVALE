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

    const existing = get('SELECT id, status FROM clients WHERE cpf = ?', [cleanCpf]);
    if (existing) {
      if (existing.status === 'aprovado' || existing.status === 'ativado') {
        return res.status(409).json({ error: 'CPF já cadastrado e aprovado', clientId: existing.id });
      }
      run(`UPDATE clients SET nome=?, nome_mae=?, nascimento=?, sexo=?, whatsapp=?, email=?, cep=?, rua=?, numero=?, complemento=?, bairro=?, cidade=?, uf=?, dispositivo=?, modelo=?, fabricante=?, os=?, navegador=?, navegador_versao=?, limite_aprovado=?, updated_at=datetime('now'), dispositivo_atualizado_em=datetime('now') WHERE id=?`,
        [nome, nome_mae || null, nascimento || null, sexo || null, whatsapp, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, dispositivo || null, modelo || null, fabricante || null, os || null, navegador || null, navegador_versao || null, limite_aprovado || null, existing.id]);
      return res.json({ clientId: existing.id, status: existing.status, message: 'Dados atualizados' });
    }

    const id = uuidv4();
    run(`INSERT INTO clients (id, cpf, nome, nome_mae, nascimento, sexo, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, uf, status, dispositivo, modelo, fabricante, os, navegador, navegador_versao, limite_aprovado, dispositivo_identificado_em, dispositivo_atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, cleanCpf, nome, nome_mae || null, nascimento || null, sexo || null, whatsapp, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, dispositivo || null, modelo || null, fabricante || null, os || null, navegador || null, navegador_versao || null, limite_aprovado || null]);

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
