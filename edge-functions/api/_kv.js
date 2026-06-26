import { createHash, randomUUID } from 'node:crypto'

const PREFIX = 'db:'

export async function getColl(kv, name) {
  const raw = await kv.get(PREFIX + name)
  try { return raw ? JSON.parse(raw) : [] } catch { return [] }
}

function saveColl(kv, name, data) {
  return kv.put(PREFIX + name, JSON.stringify(data))
}

export function findById(kv, coll, id) {
  return getColl(kv, coll).then(list => list.find(i => i.id === id) || null)
}

export function findOne(kv, coll, fn) {
  return getColl(kv, coll).then(list => list.find(fn) || null)
}

export function findBy(kv, coll, fn) {
  return getColl(kv, coll).then(list => list.filter(fn))
}

export async function insertOne(kv, coll, item) {
  const list = await getColl(kv, coll)
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  list.push({ ...item, created_at: now, updated_at: now })
  await saveColl(kv, coll, list)
  return item
}

export async function updateOne(kv, coll, id, updates) {
  const list = await getColl(kv, coll)
  const idx = list.findIndex(i => i.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }
  await saveColl(kv, coll, list)
  return list[idx]
}

export async function deleteOne(kv, coll, id) {
  const list = await getColl(kv, coll)
  const idx = list.findIndex(i => i.id === id)
  if (idx === -1) return false
  list.splice(idx, 1)
  await saveColl(kv, coll, list)
  return true
}

export async function replaceColl(kv, name, items = []) {
  await saveColl(kv, name, items)
}

export async function getSettings(kv) {
  const rows = await getColl(kv, 'settings')
  const obj = {}
  rows.forEach(s => { obj[s.key] = s.value })
  return obj
}

export async function saveSettings(kv, obj) {
  const existing = await getColl(kv, 'settings')
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  for (const [key, value] of Object.entries(obj)) {
    const idx = existing.findIndex(r => r.key === key)
    if (idx >= 0) {
      existing[idx] = { key, value: String(value), updated_at: now }
    } else {
      existing.push({ key, value: String(value), updated_at: now })
    }
  }
  await saveColl(kv, 'settings', existing)
}

export async function seedData(kv) {
  const users = await getColl(kv, 'users')
  if (users.length > 0) return

  const hash = (s) => createHash('sha256').update(s).digest('hex')
  const adminId = randomUUID()

  await insertOne(kv, 'users', {
    id: adminId, email: 'admin@valesaude.com.br',
    password_hash: hash('admin123'), name: 'Administrador',
    role: 'admin', permissions: ['*'], active: 1
  })
  await insertOne(kv, 'users', {
    id: randomUUID(), email: 'operador@valesaude.com.br',
    password_hash: hash('admin123'), name: 'Operador',
    role: 'operador', permissions: ['clients', 'requests'], active: 1
  })
  await insertOne(kv, 'users', {
    id: randomUUID(), email: 'suporte@valesaude.com.br',
    password_hash: hash('admin123'), name: 'Suporte',
    role: 'suporte', permissions: ['clients', 'notifications'], active: 1
  })

  await insertOne(kv, 'products', {
    id: randomUUID(), nome: 'Vale Saúde Virtual',
    descricao: 'Ativação imediata pelo aplicativo',
    tipo: 'virtual', preco: 4.99, ativo: 1
  })
  await insertOne(kv, 'products', {
    id: randomUUID(), nome: 'Vale Saúde Físico',
    descricao: 'Cartão físico entregue em casa',
    tipo: 'fisico', preco: 19.99, ativo: 1
  })

  await insertOne(kv, 'plans', {
    id: randomUUID(), nome: 'Básico',
    descricao: 'Limite para medicamentos essenciais',
    preco_mensal: 0, limite: 500, ativo: 1,
    beneficios: ['Uso em farmácias parceiras', 'App mobile', 'Histórico de compras']
  })
  await insertOne(kv, 'plans', {
    id: randomUUID(), nome: 'Premium',
    descricao: 'Limite ampliado com benefícios extras',
    preco_mensal: 0, limite: 1500, ativo: 1,
    beneficios: ['Uso em farmácias parceiras', 'App mobile', 'Histórico de compras', 'Descontos exclusivos', 'Suporte prioritário']
  })

  await saveSettings(kv, { payment_methods: '["pix","card","boleto"]' })
}
