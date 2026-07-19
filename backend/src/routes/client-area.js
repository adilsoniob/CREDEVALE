const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { get } = require('../database');
const JWT_SECRET = process.env.JWT_SECRET || 'vale-saude-secret';

function authClientMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (!decoded.clientId) return res.status(401).json({ error: 'Token inválido' });
    req.clientId = decoded.clientId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

router.post('/login', async (req, res) => {
  try {
    const { cpf, credencial } = req.body;
    if (!cpf || !credencial) return res.status(400).json({ error: 'CPF e credencial são obrigatórios' });
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) return res.status(400).json({ error: 'CPF inválido' });
    const client = get('SELECT id, cpf, nome, whatsapp, email, limite_aprovado, status, plano_escolhido, senha_visivel, senha_hash, created_at, rua, numero, bairro, cidade, uf, cep FROM clients WHERE cpf = ? AND status != ?', [cpfClean, 'cancelado']);
    if (!client) return res.status(401).json({ error: 'CPF não encontrado' });
    const senhaValida = client.senha_visivel && credencial.trim() === client.senha_visivel;
    if (!senhaValida) return res.status(401).json({ error: 'Credencial inválida' });
    const token = jwt.sign({ clientId: client.id, cpf: client.cpf }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      client: {
        id: client.id,
        nome: client.nome,
        cpf: client.cpf,
        whatsapp: client.whatsapp,
        email: client.email,
        limite_aprovado: client.limite_aprovado || 0,
        status: client.status,
        plano_escolhido: client.plano_escolhido,
        endereco: {
          rua: client.rua,
          numero: client.numero,
          bairro: client.bairro,
          cidade: client.cidade,
          uf: client.uf,
          cep: client.cep
        },
        created_at: client.created_at
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/me', authClientMiddleware, async (req, res) => {
  try {
    const client = get('SELECT id, cpf, nome, whatsapp, email, limite_aprovado, status, plano_escolhido, senha_visivel, created_at, rua, numero, bairro, cidade, uf, cep FROM clients WHERE id = ?', [req.clientId]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({
      client: {
        id: client.id,
        nome: client.nome,
        cpf: client.cpf,
        whatsapp: client.whatsapp,
        email: client.email,
        limite_aprovado: client.limite_aprovado || 0,
        status: client.status,
        plano_escolhido: client.plano_escolhido,
        endereco: {
          rua: client.rua,
          numero: client.numero,
          bairro: client.bairro,
          cidade: client.cidade,
          uf: client.uf,
          cep: client.cep
        },
        created_at: client.created_at
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
