const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');
// (auth desabilitada)

const router = express.Router();

// Public: Create client (registration)
router.post('/', (req, res) => {
  try {
    const { cpf, nome, nome_mae, nascimento, sexo, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, uf } = req.body;

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
      run(`UPDATE clients SET nome=?, nome_mae=?, nascimento=?, sexo=?, whatsapp=?, email=?, cep=?, rua=?, numero=?, complemento=?, bairro=?, cidade=?, uf=?, updated_at=datetime('now') WHERE id=?`,
        [nome, nome_mae || null, nascimento || null, sexo || null, whatsapp, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null, existing.id]);
      return res.json({ clientId: existing.id, status: existing.status, message: 'Dados atualizados' });
    }

    const id = uuidv4();
    run(`INSERT INTO clients (id, cpf, nome, nome_mae, nascimento, sexo, whatsapp, email, cep, rua, numero, complemento, bairro, cidade, uf, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
      [id, cleanCpf, nome, nome_mae || null, nascimento || null, sexo || null, whatsapp, email || null, cep || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, uf || null]);

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

module.exports = router;
