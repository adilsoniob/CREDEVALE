const express = require('express');
const { get, run, all } = require('../database');

const router = express.Router();
const QUERY_LIMIT = 10;
const RAILWAY_API = process.env.RAILWAY_API || 'https://valle-production-105b.up.railway.app/api';

function loadCounts() {
  const row = get("SELECT value FROM settings WHERE key = 'cpf_key_counts'");
  if (row) {
    try { return JSON.parse(row.value); } catch {}
  }
  return {};
}

function saveCounts(counts) {
  run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('cpf_key_counts', ?, datetime('now'))",
    [JSON.stringify(counts)]);
}

function saveKeys(keys) {
  run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('cpf_api_keys', ?, datetime('now'))",
    [JSON.stringify(keys)]);
}

router.post('/consult', async (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return res.status(400).json({ error: 'CPF inválido' });

    const rows = all("SELECT value FROM settings WHERE key = 'cpf_api_keys'");
    let keys = [];
    if (rows.length) {
      try { keys = JSON.parse(rows[0].value); } catch {}
    }

    const counts = loadCounts();

    let lastError = null;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const count = counts[key] || 0;
      if (count >= QUERY_LIMIT) continue;

      try {
        const url = `https://api.hydracpf.com/v1/cpf/${clean}`;
        console.log(`[CPF] Consultando ${clean} com chave ${key.slice(0,8)}...`);
        const resp = await fetch(url, {
          headers: { 'x-api-key': key }
        });
        console.log(`[CPF] Resposta HTTP ${resp.status}`);
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          console.log(`[CPF] Erro HTTP ${resp.status}: ${text.slice(0,200)}`);
          if (resp.status === 401 || resp.status === 403) {
            console.log(`[CPF] Chave ${key.slice(0,8)} inválida, removendo`);
            keys.splice(i, 1);
            i--;
            delete counts[key];
            saveKeys(keys);
            saveCounts(counts);
            continue;
          }
          const errBody = text || await resp.text().catch(() => '');
          lastError = `HydraCPF ${resp.status}: ${errBody.slice(0,100)}`;
          continue;
        }
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch {
          console.log(`[CPF] Resposta não-JSON: ${text.slice(0,200)}`);
          lastError = `Resposta inválida da HydraCPF: ${text.slice(0,100)}`;
          continue;
        }
        counts[key] = count + 1;
        if (counts[key] >= QUERY_LIMIT) {
          keys.splice(i, 1);
          delete counts[key];
        }
        saveKeys(keys);
        saveCounts(counts);
        return res.json(data);
      } catch (e) {
        console.log(`[CPF] Exceção: ${e.message}`);
        lastError = e.message;
      }
    }

    // Fallback: proxy para Railway quando todas as chaves locais falharem
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log(`[CPF] ⚠️ Todas as chaves falharam. Tentando proxy Railway...`);
        const r = await fetch(`${RAILWAY_API}/cpf/consult`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpf: clean })
        });
        const txt = await r.text();
        let d;
        try { d = JSON.parse(txt); } catch { d = null; }
        if (d) return res.json(d);
      } catch (e2) {
        console.log(`[CPF] Proxy Railway também falhou: ${e2.message}`);
      }
    }

    res.status(502).json({ error: lastError || 'Todas as chaves falharam' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/check', (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return res.status(400).json({ error: 'CPF inválido' });

    const client = get('SELECT id, nome, cpf, limite_aprovado FROM clients WHERE cpf = ?', [clean]);
    if (client) {
      return res.json({
        exists: true,
        cliente: {
          id: client.id,
          nome: client.nome,
          cpf: client.cpf,
          limite: client.limite_aprovado
        }
      });
    }
    return res.json({ exists: false });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/keys-status', (req, res) => {
  try {
    const rows = all("SELECT value FROM settings WHERE key = 'cpf_api_keys'");
    let keys = [];
    if (rows.length) {
      try { keys = JSON.parse(rows[0].value); } catch {}
    }
    const counts = loadCounts();
    const status = keys.map(k => ({
      masked: k.length > 12 ? k.slice(0, 8) + '****' + k.slice(-4) : k,
      count: counts[k] || 0,
      limit: QUERY_LIMIT,
      remaining: Math.max(0, QUERY_LIMIT - (counts[k] || 0))
    }));
    res.json({ status, active: status.length, queryLimit: QUERY_LIMIT });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
