const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');
// (auth desabilitada)

const router = express.Router();

// Public: List active products
router.get('/', (req, res) => {
  try {
    const products = all('SELECT * FROM products WHERE ativo = 1 ORDER BY preco ASC');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: List active plans
router.get('/plans', (req, res) => {
  try {
    const plans = all('SELECT * FROM plans WHERE ativo = 1 ORDER BY limite ASC');
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nome, descricao, tipo, preco } = req.body;
    if (!nome || !tipo || preco === undefined) {
      return res.status(400).json({ error: 'Nome, tipo e preço são obrigatórios' });
    }
    const id = uuidv4();
    run('INSERT INTO products (id, nome, descricao, tipo, preco) VALUES (?, ?, ?, ?, ?)',
      [id, nome, descricao || null, tipo, preco]);
    res.status(201).json({ id, message: 'Produto criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nome, descricao, tipo, preco, ativo } = req.body;
    const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    run('UPDATE products SET nome=?, descricao=?, tipo=?, preco=?, ativo=? WHERE id=?',
      [nome || product.nome, descricao ?? product.descricao, tipo || product.tipo, preco ?? product.preco, ativo ?? product.ativo, req.params.id]);
    res.json({ message: 'Produto atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Produto removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans', (req, res) => {
  try {
    const { nome, descricao, preco_mensal, limite, beneficios } = req.body;
    if (!nome || preco_mensal === undefined || !limite) {
      return res.status(400).json({ error: 'Nome, preço mensal e limite são obrigatórios' });
    }
    const id = uuidv4();
    run('INSERT INTO plans (id, nome, descricao, preco_mensal, limite, beneficios) VALUES (?, ?, ?, ?, ?, ?)',
      [id, nome, descricao || null, preco_mensal, limite, JSON.stringify(beneficios || [])]);
    res.status(201).json({ id, message: 'Plano criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans/:id', (req, res) => {
  try {
    const { nome, descricao, preco_mensal, limite, beneficios, ativo } = req.body;
    const plan = get('SELECT * FROM plans WHERE id = ?', [req.params.id]);
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });

    run('UPDATE plans SET nome=?, descricao=?, preco_mensal=?, limite=?, beneficios=?, ativo=? WHERE id=?',
      [nome || plan.nome, descricao ?? plan.descricao, preco_mensal ?? plan.preco_mensal, limite ?? plan.limite, beneficios ? JSON.stringify(beneficios) : plan.beneficios, ativo ?? plan.ativo, req.params.id]);
    res.json({ message: 'Plano atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
