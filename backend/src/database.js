const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'vale-saude.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let db = null;
let saveTimer = null;

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (db) {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  }, 1000);
}

function run(sql, params = []) {
  db.run(sql, params);
  scheduleSave();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    results.push(row);
  }
  stmt.free();
  return results;
}

async function initDatabase() {
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operador',
      permissions TEXT DEFAULT '[]',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      cpf TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      nome_mae TEXT,
      nascimento TEXT,
      sexo TEXT,
      whatsapp TEXT,
      email TEXT,
      cep TEXT,
      rua TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      status TEXT DEFAULT 'pendente',
      limite_aprovado REAL DEFAULT 0,
      produto_escolhido TEXT DEFAULT 'virtual',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL,
      preco REAL NOT NULL,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco_mensal REAL NOT NULL,
      limite REAL NOT NULL,
      beneficios TEXT DEFAULT '[]',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      product_id TEXT,
      plan_id TEXT,
      tipo_produto TEXT DEFAULT 'virtual',
      cep_entrega TEXT,
      prazo_entrega TEXT,
      taxa_emissao REAL DEFAULT 0,
      valor_total REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      aprovado_por TEXT,
      aprovado_em TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      metodo TEXT NOT NULL,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      transaction_id TEXT,
      pix_qr_code TEXT,
      pix_chave TEXT,
      card_last_four TEXT,
      card_brand TEXT,
      parcelas INTEGER DEFAULT 1,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reactivations (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      request_id TEXT,
      motivo TEXT,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      client_id TEXT,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensagem TEXT,
      lida INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS page_views (
      id TEXT PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      referrer TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add tracking columns (safe migration — ignores error if already exists)
  try { db.run(`ALTER TABLE clients ADD COLUMN pushinpay_click_count INTEGER DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN pix_copied_count INTEGER DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN last_active_at TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN pushinpay_clicked_at TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN pix_copied_at TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN dispositivo TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN modelo TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN fabricante TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN os TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN navegador TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN navegador_versao TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN dispositivo_identificado_em TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE clients ADD COLUMN dispositivo_atualizado_em TEXT`); } catch (e) {}
  // Session table migrations
  try { db.run(`ALTER TABLE sessions ADD COLUMN fabricante TEXT DEFAULT ''`); } catch (e) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN navegador_versao TEXT DEFAULT ''`); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      visitor_id TEXT,
      client_id TEXT,
      stage TEXT DEFAULT 'Visitando Landing Page',
      ip TEXT,
      user_agent TEXT,
      dispositivo TEXT DEFAULT '',
      modelo TEXT DEFAULT '',
      fabricante TEXT DEFAULT '',
      navegador TEXT DEFAULT '',
      navegador_versao TEXT DEFAULT '',
      os TEXT DEFAULT '',
      origem TEXT DEFAULT '',
      nome TEXT,
      cpf TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      last_heartbeat TEXT DEFAULT (datetime('now')),
      last_activity TEXT DEFAULT (datetime('now')),
      offline_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_versions (
      id TEXT PRIMARY KEY,
      file_name TEXT,
      original_name TEXT,
      version TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      file_type TEXT DEFAULT 'apk',
      external_link TEXT,
      status TEXT DEFAULT 'archived',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      uploaded_by TEXT
    )
  `);

  // Seed default admin user
  const crypto = require('crypto');
  const { v4: uuidv4 } = require('uuid');

  const existingAdmin = get('SELECT id FROM users WHERE email = ?', ['admin@valesaude.com.br']);
  if (!existingAdmin) {
    const hash = crypto.createHash('sha256').update('admin123').digest('hex');
    run(`INSERT INTO users (id, email, password_hash, name, role, permissions) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'admin@valesaude.com.br', hash, 'Administrador', 'admin', JSON.stringify(['*'])]);
    run(`INSERT INTO users (id, email, password_hash, name, role, permissions) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'operador@valesaude.com.br', hash, 'Operador', 'operador', JSON.stringify(['clients', 'requests'])]);
    run(`INSERT INTO users (id, email, password_hash, name, role, permissions) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'suporte@valesaude.com.br', hash, 'Suporte', 'suporte', JSON.stringify(['clients', 'notifications'])]);
  }

  // Seed default products
  const existingProduct = get('SELECT id FROM products LIMIT 1');
  if (!existingProduct) {
    run(`INSERT INTO products (id, nome, descricao, tipo, preco) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'Vale Saúde Virtual', 'Ativação imediata pelo aplicativo', 'virtual', 4.99]);
    run(`INSERT INTO products (id, nome, descricao, tipo, preco) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'Vale Saúde Físico', 'Cartão físico entregue em casa', 'fisico', 19.99]);
  }

  // Seed default plans
  const existingPlan = get('SELECT id FROM plans LIMIT 1');
  if (!existingPlan) {
    run(`INSERT INTO plans (id, nome, descricao, preco_mensal, limite, beneficios) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Básico', 'Limite para medicamentos essenciais', 0, 500, JSON.stringify(['Uso em farmácias parceiras', 'App mobile', 'Histórico de compras'])]);
    run(`INSERT INTO plans (id, nome, descricao, preco_mensal, limite, beneficios) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Premium', 'Limite ampliado com benefícios extras', 0, 1500, JSON.stringify(['Uso em farmácias parceiras', 'App mobile', 'Histórico de compras', 'Descontos exclusivos', 'Suporte prioritário'])]);
  }

  scheduleSave();
  console.log('[DB] Banco de dados inicializado com sucesso');
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('[DB] Banco salvo e encerrado');
  }
  process.exit(0);
});

module.exports = { getDb, initDatabase, run, get, all };
