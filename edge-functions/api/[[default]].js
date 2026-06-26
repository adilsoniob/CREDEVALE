import { createHmac, createHash, randomUUID } from 'node:crypto'
import { getColl, findById, findOne, findBy, insertOne, updateOne, deleteOne, replaceColl, getSettings, saveSettings, seedData } from './_kv.js'

const JWT_SECRET = 'vale-saude-secret'
const JWT_EXPIRES_S = 8 * 3600

function b64url(s) {
  var bin = ''
  for (var i = 0; i < s.length; i++) bin += String.fromCharCode(s.charCodeAt(i))
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  var bin = atob(s), u8 = new Uint8Array(bin.length)
  for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder().decode(u8))
}
function b64urlFromBytes(buf) {
  var u8 = new Uint8Array(buf)
  var bin = ''
  for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJWT(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRES_S }))
  const sigBuf = createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest()
  const sig = b64urlFromBytes(sigBuf)
  return header + '.' + body + '.' + sig
}

function verifyJWT(token) {
  try {
    const p = token.split('.')
    if (p.length !== 3) return null
    const expected = b64urlFromBytes(createHmac('sha256', JWT_SECRET).update(p[0] + '.' + p[1]).digest())
    if (p[2] !== expected) return null
    const payload = b64urlDecode(p[1])
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  }
}

async function parseBody(request) {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const text = await request.text()
    return text ? JSON.parse(text) : {}
  }
  return {}
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json;charset=utf-8' }
  })
}

function error(msg, status = 400) {
  return json({ error: msg }, status)
}

async function authUser(kv, request) {
  const header = request.headers.get('Authorization') || ''
  if (!header.startsWith('Bearer ')) return null
  const decoded = verifyJWT(header.slice(7))
  if (!decoded) return null
  const user = await findById(kv, 'users', decoded.userId)
  if (!user || !user.active) return null
  return {
    id: user.id, email: user.email, name: user.name,
    role: user.role, permissions: user.permissions || []
  }
}

function hashPassword(pwd) {
  return createHash('sha256').update(pwd).digest('hex')
}

function generatePixPayload(pixKey, merchantName, merchantCity, amount, txid) {
  const fmt = (id, val) => {
    const len = String(val.length).padStart(2, '0')
    return `${id}${len}${val}`
  }
  const payloadFormat = '000201'
  const gui = '0014BR.GOV.BCB.PIX'
  const pixKeyField = fmt('01', pixKey)
  const merchantInfo = fmt('26', gui + pixKeyField)
  const mcc = '52040000'
  const currency = '5303986'
  const amt = amount > 0 ? fmt('54', amount.toFixed(2)) : ''
  const country = '5802BR'
  const mName = fmt('59', merchantName.slice(0, 25))
  const mCity = fmt('60', merchantCity.slice(0, 15))
  const txidField = fmt('05', (txid || randomUUID().replace(/-/g, '').slice(0, 25)))
  const addData = fmt('62', txidField)
  const crcPlace = '6304'

  const payload = payloadFormat + merchantInfo + mcc + currency + amt + country + mName + mCity + addData + crcPlace

  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
      else crc <<= 1
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

function paginate(list, page = 1, limit = 50) {
  const p = Number(page), l = Number(limit)
  const start = (p - 1) * l
  return { items: list.slice(start, start + l), total: list.length, page: p, pages: Math.ceil(list.length / l) }
}

// --- Route Handler ---

export async function onRequest(context) {
  const { request, env } = context
  const kv = env.MY_KV || env.VALE_SAUDE_KV
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method
  const origin = request.headers.get('Origin') || '*'
  const cors = corsHeaders(origin)

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // Validate KV binding
  if (!kv || typeof kv.get !== 'function') {
    return withCors(json({ error: 'KV namespace não configurado. Crie o binding VALE_SAUDE_KV no EdgeOne console.' }, 500), cors)
  }

  // Seed KV on first request
  try { await seedData(kv) } catch {}

  const segs = path.replace(/\/api\//, '').split('/').filter(Boolean)
  const route = segs.join('/')

  try {
    let result
    const handlers = {

      // --- Health ---
      'health': () => json({ status: 'ok', timestamp: new Date().toISOString() }),

      // --- Auth ---
      'auth/login': async () => {
        const { email, password } = await parseBody(request)
        if (!email || !password) return error('E-mail e senha são obrigatórios')
        const user = await findOne(kv, 'users', u => u.email === email && u.active === 1)
        if (!user || user.password_hash !== hashPassword(password)) return error('Credenciais inválidas', 401)
        const token = signJWT({ userId: user.id, role: user.role })
        await insertOne(kv, 'logs', {
          id: randomUUID(), user_id: user.id, action: 'login',
          entity: 'user', entity_id: user.id, details: JSON.stringify({ email }), ip: request.headers.get('x-forwarded-for') || ''
        })
        return json({
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions || [] }
        })
      },

      'auth/me': async () => {
        const user = await authUser(kv, request)
        if (!user) return error('Não autorizado', 401)
        return json({ user })
      },

      'auth/change-password': async () => {
        const user = await authUser(kv, request)
        if (!user) return error('Não autorizado', 401)
        const { currentPassword, newPassword } = await parseBody(request)
        if (!currentPassword || !newPassword) return error('Senhas são obrigatórias')
        const dbUser = await findById(kv, 'users', user.id)
        if (!dbUser || dbUser.password_hash !== hashPassword(currentPassword)) return error('Senha atual incorreta', 401)
        await updateOne(kv, 'users', user.id, { password_hash: hashPassword(newPassword) })
        return json({ message: 'Senha alterada com sucesso' })
      },

      // --- Clients ---
      'clients': async () => {
        if (method === 'POST') {
          const data = await parseBody(request)
          const { cpf, nome, whatsapp } = data
          if (!cpf || !nome || !whatsapp) return error('CPF, nome e WhatsApp são obrigatórios')
          const clean = cpf.replace(/\D/g, '')
          if (clean.length !== 11) return error('CPF inválido')
          const existing = await findOne(kv, 'clients', c => c.cpf === clean)
          if (existing) {
            if (existing.status === 'aprovado' || existing.status === 'ativado') {
              return json({ error: 'CPF já cadastrado e aprovado', clientId: existing.id }, 409)
            }
            await updateOne(kv, 'clients', existing.id, {
              nome, nome_mae: data.nome_mae || null, nascimento: data.nascimento || null,
              sexo: data.sexo || null, whatsapp, email: data.email || null, cep: data.cep || null,
              rua: data.rua || null, numero: data.numero || null, complemento: data.complemento || null,
              bairro: data.bairro || null, cidade: data.cidade || null, uf: data.uf || null,
              limite_aprovado: data.limite_aprovado || existing.limite_aprovado || 0
            })
            return json({ clientId: existing.id, status: existing.status, message: 'Dados atualizados' })
          }
          const limiteAprovado = typeof data.limite_aprovado === 'number' ? data.limite_aprovado : (parseInt(data.limite_aprovado) || 0)
          const id = randomUUID()
          await insertOne(kv, 'clients', {
            id, cpf: clean, nome, nome_mae: data.nome_mae || null, nascimento: data.nascimento || null,
            sexo: data.sexo || null, whatsapp, email: data.email || null, cep: data.cep || null,
            rua: data.rua || null, numero: data.numero || null, complemento: data.complemento || null,
            bairro: data.bairro || null, cidade: data.cidade || null, uf: data.uf || null,
            status: 'pendente', limite_aprovado: limiteAprovado, produto_escolhido: 'virtual',
            dispositivo: data.dispositivo || null, modelo: data.modelo || null,
            pix_copied_count: 0, pushinpay_click_count: 0, last_active_at: null
          })
          await insertOne(kv, 'logs', {
            id: randomUUID(), action: 'create', entity: 'client', entity_id: id,
            details: JSON.stringify({ cpf: clean, nome }), ip: request.headers.get('x-forwarded-for') || ''
          })
          return json({ clientId: id, status: 'pendente' }, 201)
        }

        if (method === 'GET') {
          const search = url.searchParams.get('search') || ''
          const status = url.searchParams.get('status') || ''
          const page = url.searchParams.get('page') || 1
          const limit = url.searchParams.get('limit') || 50
          let list = await getColl(kv, 'clients')
          if (status) list = list.filter(c => c.status === status)
          if (search) {
            const s = search.toLowerCase()
            list = list.filter(c => c.nome?.toLowerCase().includes(s) || c.cpf?.includes(s) || c.whatsapp?.includes(s))
          }
          list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          const p = paginate(list, page, limit)
          return json({ clients: p.items, total: p.total, page: p.page, pages: p.pages })
        }

        return error('Método não permitido', 405)
      },

      'clients/by-cpf': async () => {
        const cpf = (segs[2] || '').replace(/\D/g, '')
        const client = await findOne(kv, 'clients', c => c.cpf === cpf)
        if (!client) return error('Cliente não encontrado', 404)
        return json({ id: client.id, cpf: client.cpf, nome: client.nome, status: client.status, limite_aprovado: client.limite_aprovado, produto_escolhido: client.produto_escolhido })
      },

      'clients/status': async () => {
        const id = segs[1]
        const { status, limite_aprovado } = await parseBody(request)
        const valid = ['pendente', 'aprovado', 'reprovado', 'ativado', 'cancelado']
        if (!valid.includes(status)) return error('Status inválido')
        const client = await findById(kv, 'clients', id)
        if (!client) return error('Cliente não encontrado', 404)
        await updateOne(kv, 'clients', id, { status, limite_aprovado: limite_aprovado ?? client.limite_aprovado })
        await insertOne(kv, 'logs', {
          id: randomUUID(), user_id: 'system', action: 'update_status',
          entity: 'client', entity_id: id, details: JSON.stringify({ old: client.status, new: status })
        })
        await insertOne(kv, 'notifications', {
          id: randomUUID(), client_id: id, tipo: 'status_change',
          titulo: `Status alterado para ${status}`,
          mensagem: `Cliente ${client.nome} teve status alterado de ${client.status} para ${status}`,
          lida: 0
        })
        return json({ message: 'Status atualizado', client: { ...client, status } })
      }
    }

    // Dynamic route matching
    if (segs[0] === 'auth' && segs[1] === 'login' && method === 'POST') return withCors(await handlers['auth/login'](), cors)
    if (segs[0] === 'auth' && segs[1] === 'me' && method === 'GET') return withCors(await handlers['auth/me'](), cors)
    if (segs[0] === 'auth' && segs[1] === 'change-password' && method === 'POST') return withCors(await handlers['auth/change-password'](), cors)

    if (segs[0] === 'health') return withCors(await handlers['health'](), cors)

    // clients/...
    if (segs[0] === 'clients') {
      if (segs[1] === 'by-cpf' && segs[2] && method === 'GET') return withCors(await handlers['clients/by-cpf'](), cors)
      if (segs[1] && segs[2] === 'status' && method === 'PATCH') return withCors(await handlers['clients/status'](), cors)
      if (segs[1] === 'delete-all' && method === 'POST') return withCors(await clientsDeleteAll(kv), cors)
      if (segs[1] && !segs[2] && method === 'GET') return withCors(await clientGetById(segs[1], kv), cors)
      if (segs[1] && !segs[2] && method === 'DELETE') return withCors(await clientDelete(segs[1], kv), cors)
      if (!segs[1]) return withCors(await handlers['clients'](), cors)
    }

    // products/...
    if (segs[0] === 'products') {
      if (segs[1] === 'plans' && method === 'GET') return withCors(await getPlans(kv), cors)
      if (segs[1] === 'plans' && method === 'POST') return withCors(await createPlan(kv, request), cors)
      if (segs[1] === 'plans' && segs[2] && method === 'PUT') return withCors(await updatePlan(segs[2], kv, request), cors)
      if (segs[1] && method === 'GET') return withCors(await productGetById(segs[1], kv), cors)
      if (segs[1] && method === 'PUT') return withCors(await productUpdate(segs[1], kv, request), cors)
      if (segs[1] && method === 'DELETE') return withCors(await productDelete(segs[1], kv), cors)
      if (!segs[1] && method === 'GET') return withCors(await getProducts(kv), cors)
      if (!segs[1] && method === 'POST') return withCors(await createProduct(kv, request), cors)
    }

    // requests/...
    if (segs[0] === 'requests') {
      if (segs[1] && segs[2] === 'status' && method === 'PATCH') return withCors(await requestUpdateStatus(segs[1], kv, request), cors)
      if (segs[1] && method === 'GET') return withCors(await requestGetById(segs[1], kv), cors)
      if (!segs[1] && method === 'GET') return withCors(await getRequests(kv, url), cors)
      if (!segs[1] && method === 'POST') return withCors(await createRequest(kv, request), cors)
    }

    // payments/...
    if (segs[0] === 'payments') {
      if (segs[1] === 'config' && method === 'GET') return withCors(await getPaymentConfig(kv), cors)
      if ((segs[1] === 'generate-pix' || segs[1] === 'pix') && method === 'POST') return withCors(await generatePix(kv, request), cors)
      if (segs[1] === 'generate-pix-code' && method === 'POST') return withCors(await generatePixCode(kv, request), cors)
      if (segs[1] === 'card' && method === 'POST') return withCors(await createCardPayment(kv, request), cors)
      if (segs[1] && segs[2] === 'status' && method === 'GET') return withCors(await paymentGetStatus(segs[1], kv), cors)
      if (segs[1] && segs[2] === 'status' && method === 'PATCH') return withCors(await paymentApprove(segs[1], kv), cors)
      if (!segs[1] && method === 'GET') return withCors(await getPayments(kv, url), cors)
    }

    // whatsapp-messages (public endpoint for EdgeOne frontend)
    if (segs[0] === 'whatsapp-messages' && method === 'GET') return withCors(await publicWhatsAppMessages(kv), cors)

    // whatsapp/... (proxy autenticado para WhatsApp Server)
    if (segs[0] === 'whatsapp') {
      const user = await authUser(kv, request)
      if (!user) return withCors(error('Não autorizado', 401), cors)
      const settings = await getSettings(kv)
      const waUrl = settings.whatsapp_server_url
      if (!waUrl) return withCors(error('WhatsApp Server URL não configurada em Configurações > WhatsApp'), cors)
      const targetPath = path.replace('/api/whatsapp', '')
      return withCors(await proxyWhatsApp(request, targetPath, waUrl, settings.whatsapp_api_key), cors)
    }

    // admin/...
    if (segs[0] === 'admin') {
      const user = await authUser(kv, request)
      if (!user) return withCors(error('Não autorizado', 401), cors)
      if (segs[1] === 'dashboard') return withCors(await adminDashboard(kv), cors)
      if (segs[1] === 'reset' && method === 'POST') return withCors(await adminReset(kv), cors)
      if (segs[1] === 'logs') return withCors(await adminLogs(kv, url), cors)
      if (segs[1] === 'notifications' && segs[3] === 'read' && method === 'PATCH') return withCors(await markNotifRead(segs[2], kv), cors)
      if (segs[1] === 'notifications' && method === 'GET') return withCors(await adminNotifications(kv), cors)
      if (segs[1] === 'users' && method === 'GET') return withCors(await adminUsers(kv), cors)
      if (segs[1] === 'users' && method === 'POST') return withCors(await adminCreateUser(kv, request), cors)
      if (segs[1] === 'settings' && method === 'GET') return withCors(await adminGetSettings(kv), cors)
      if (segs[1] === 'settings' && method === 'PUT') return withCors(await adminSaveSettings(kv, request), cors)
      if (segs[1] === 'reset-support-clicks' && method === 'POST') return withCors(await resetSupportClicks(kv), cors)
    }

    // webhooks/...
    if (segs[0] === 'webhooks' && segs[1] === 'pushinpay' && method === 'POST') return withCors(await webhookPushinpay(kv, request), cors)

    // track/...
    if (segs[0] === 'track' && segs[1] === 'pix-copy' && method === 'POST') return withCors(await trackPixCopy(kv, request), cors)
    if (segs[0] === 'track' && segs[1] === 'pushinpay-click' && method === 'POST') return withCors(await trackPushinpayClick(kv, request), cors)
    if (segs[0] === 'track' && segs[1] === 'support-click' && method === 'POST') return withCors(await trackSupportClick(kv), cors)
    if (segs[0] === 'track' && segs[1] === 'page-view' && method === 'POST') return withCors(await trackPageView(kv), cors)

    // cpf/...
    if (segs[0] === 'cpf' && segs[1] === 'consult' && method === 'POST') return withCors(await cpfConsult(kv, request), cors)
    if (segs[0] === 'cpf' && segs[1] === 'keys-status' && method === 'GET') return withCors(await cpfKeysStatus(kv), cors)

    return withCors(error('Rota não encontrada', 404), cors)
  } catch (err) {
    return withCors(error(err.message || 'Erro interno', 500), cors)
  }
}

async function proxyWhatsApp(request, targetPath, baseUrl, apiKey) {
  const url = baseUrl.replace(/\/+$/, '') + targetPath + new URL(request.url).search
  const headers = new Headers(request.headers)
  headers.delete('host')
  if (apiKey) headers.set('authorization', 'Bearer ' + apiKey)
  const body = request.body ? await request.text() : null
  const resp = await fetch(url, {
    method: request.method,
    headers,
    body: body || undefined
  })
  const respBody = await resp.text()
  const respHeaders = new Headers(resp.headers)
  respHeaders.set('access-control-allow-origin', '*')
  return new Response(respBody, { status: resp.status, headers: respHeaders })
}

async function publicWhatsAppMessages(kv) {
  const settings = await getSettings(kv)
  const waUrl = settings.whatsapp_server_url
  if (!waUrl) return json({ success: true, messages: [] })
  try {
    const headers = {}
    if (settings.whatsapp_api_key) headers['authorization'] = 'Bearer ' + settings.whatsapp_api_key
    const resp = await fetch(waUrl.replace(/\/+$/, '') + '/api/whatsapp-messages', { headers })
    const data = await resp.json()
    return json(data)
  } catch {
    return json({ success: true, messages: [] })
  }
}

function withCors(response, cors) {
  const headers = { ...cors }
  response.headers.forEach((v, k) => { headers[k] = v })
  return new Response(response.body, { status: response.status, headers })
}

// --- Client handlers ---

async function clientGetById(id, kv) {
  const client = await findById(kv, 'clients', id)
  if (!client) return error('Cliente não encontrado', 404)
  const requests = await findBy(kv, 'requests', r => r.client_id === id)
  const payments = await findBy(kv, 'payments', p => p.client_id === id)
  return json({ client, requests, payments })
}

async function clientDelete(id, kv) {
  const client = await findById(kv, 'clients', id)
  if (!client) return error('Cliente não encontrado', 404)
  await deleteOne(kv, 'clients', id)
  await insertOne(kv, 'logs', {
    id: randomUUID(), user_id: 'system', action: 'delete',
    entity: 'client', entity_id: id, details: JSON.stringify({ cpf: client.cpf, nome: client.nome })
  })
  return json({ message: 'Cliente removido' })
}

async function clientsDeleteAll(kv) {
  const count = (await getColl(kv, 'clients')).length
  await replaceColl(kv, 'clients', [])
  await insertOne(kv, 'logs', {
    id: randomUUID(), user_id: 'system', action: 'delete_all',
    entity: 'clients', details: JSON.stringify({ count })
  })
  return json({ message: `${count} clientes removidos` })
}

async function adminReset(kv) {
  const clientCount = (await getColl(kv, 'clients')).length
  const paymentCount = (await getColl(kv, 'payments')).length
  const requestCount = (await getColl(kv, 'requests')).length
  await replaceColl(kv, 'clients', [])
  await replaceColl(kv, 'payments', [])
  await replaceColl(kv, 'requests', [])
  await insertOne(kv, 'logs', {
    id: randomUUID(), user_id: 'system', action: 'reset',
    entity: 'all', details: JSON.stringify({ clients: clientCount, payments: paymentCount, requests: requestCount })
  })
  return json({ message: `Sistema zerado: ${clientCount} clientes, ${paymentCount} pagamentos e ${requestCount} solicitações removidos` })
}

// --- Product handlers ---

async function getProducts(kv) {
  const list = await getColl(kv, 'products')
  return json(list.filter(p => p.ativo === 1).sort((a, b) => a.preco - b.preco))
}

async function createProduct(kv, request) {
  const { nome, descricao, tipo, preco } = await parseBody(request)
  if (!nome || !tipo || preco === undefined) return error('Nome, tipo e preço são obrigatórios')
  const id = randomUUID()
  await insertOne(kv, 'products', { id, nome, descricao: descricao || null, tipo, preco, ativo: 1 })
  return json({ id, message: 'Produto criado' }, 201)
}

async function productGetById(id, kv) {
  const prod = await findById(kv, 'products', id)
  if (!prod) return error('Produto não encontrado', 404)
  return json(prod)
}

async function productUpdate(id, kv, request) {
  const body = await parseBody(request)
  const prod = await findById(kv, 'products', id)
  if (!prod) return error('Produto não encontrado', 404)
  await updateOne(kv, 'products', id, {
    nome: body.nome || prod.nome, descricao: body.descricao ?? prod.descricao,
    tipo: body.tipo || prod.tipo, preco: body.preco ?? prod.preco,
    ativo: body.ativo ?? prod.ativo
  })
  return json({ message: 'Produto atualizado' })
}

async function productDelete(id, kv) {
  await deleteOne(kv, 'products', id)
  return json({ message: 'Produto removido' })
}

async function getPlans(kv) {
  const list = await getColl(kv, 'plans')
  return json(list.filter(p => p.ativo === 1).sort((a, b) => a.limite - b.limite))
}

async function createPlan(kv, request) {
  const { nome, descricao, preco_mensal, limite, beneficios } = await parseBody(request)
  if (!nome || preco_mensal === undefined || !limite) return error('Nome, preço mensal e limite são obrigatórios')
  const id = randomUUID()
  await insertOne(kv, 'plans', { id, nome, descricao: descricao || null, preco_mensal, limite, beneficios: beneficios || [], ativo: 1 })
  return json({ id, message: 'Plano criado' }, 201)
}

async function updatePlan(id, kv, request) {
  const body = await parseBody(request)
  const plan = await findById(kv, 'plans', id)
  if (!plan) return error('Plano não encontrado', 404)
  await updateOne(kv, 'plans', id, {
    nome: body.nome || plan.nome, descricao: body.descricao ?? plan.descricao,
    preco_mensal: body.preco_mensal ?? plan.preco_mensal, limite: body.limite ?? plan.limite,
    beneficios: body.beneficios ? body.beneficios : plan.beneficios,
    ativo: body.ativo ?? plan.ativo
  })
  return json({ message: 'Plano atualizado' })
}

// --- Request handlers ---

async function createRequest(kv, request) {
  const { client_id, product_id, tipo_produto, cep_entrega } = await parseBody(request)
  if (!client_id || !tipo_produto) return error('client_id e tipo_produto são obrigatórios')
  const client = await findById(kv, 'clients', client_id)
  if (!client) return error('Cliente não encontrado', 404)

  let preco = 4.99
  if (product_id) {
    const prod = await findById(kv, 'products', product_id)
    if (prod) preco = prod.preco
  } else if (tipo_produto === 'fisico') {
    const prods = await findBy(kv, 'products', p => p.tipo === 'fisico' && p.ativo === 1)
    if (prods.length) preco = prods[0].preco
  }

  const id = randomUUID()
  await insertOne(kv, 'requests', {
    id, client_id, product_id: product_id || null, tipo_produto,
    cep_entrega: cep_entrega || null, taxa_emissao: 0, valor_total: preco, status: 'pendente'
  })
  await updateOne(kv, 'clients', client_id, { produto_escolhido: tipo_produto })
  return json({ requestId: id, valor: preco }, 201)
}

async function getRequests(kv, url) {
  const status = url.searchParams.get('status') || ''
  const page = url.searchParams.get('page') || 1
  const limit = url.searchParams.get('limit') || 50
  let list = await getColl(kv, 'requests')
  if (status) list = list.filter(r => r.status === status)
  const clients = await getColl(kv, 'clients')
  const clientMap = {}
  clients.forEach(c => { clientMap[c.id] = c })
  list = list.map(r => ({
    ...r,
    client_nome: clientMap[r.client_id]?.nome || '',
    client_cpf: clientMap[r.client_id]?.cpf || '',
    client_whatsapp: clientMap[r.client_id]?.whatsapp || ''
  }))
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const p = paginate(list, page, limit)
  return json({ requests: p.items, total: p.total, page: p.page, pages: p.pages })
}

async function requestUpdateStatus(id, kv, request) {
  const { status, limite_aprovado } = await parseBody(request)
  const valid = ['pendente', 'aprovado', 'reprovado', 'pago', 'ativado', 'cancelado']
  if (!valid.includes(status)) return error('Status inválido')
  const req = await findById(kv, 'requests', id)
  if (!req) return error('Solicitação não encontrada', 404)

  await updateOne(kv, 'requests', id, { status, aprovado_por: 'admin', aprovado_em: new Date().toISOString() })

  if (status === 'aprovado' && limite_aprovado) {
    await updateOne(kv, 'clients', req.client_id, { status: 'aprovado', limite_aprovado })
  }
  if (status === 'ativado') {
    await updateOne(kv, 'clients', req.client_id, { status: 'ativado' })
  }

  await insertOne(kv, 'logs', {
    id: randomUUID(), user_id: 'system', action: 'update_request_status',
    entity: 'request', entity_id: id, details: JSON.stringify({ old: req.status, new: status })
  })
  return json({ message: 'Status atualizado' })
}

async function requestGetById(id, kv) {
  const req = await findById(kv, 'requests', id)
  if (!req) return error('Solicitação não encontrada', 404)
  return json(req)
}

// --- Payment handlers ---

async function getPaymentConfig(kv) {
  const s = await getSettings(kv)
  let methods = ['pix', 'card', 'boleto']
  try { if (s.payment_methods) methods = JSON.parse(s.payment_methods) } catch {}
  return json({
    pix_key: s.pix_key || '',
    pix_merchant_name: s.pix_merchant_name || '',
    pix_merchant_city: s.pix_merchant_city || '',
    pushinpay_url: methods.includes('pushinpay') ? (s.pushinpay_url || '') : '',
    payment_methods: methods,
    apk_url: s.apk_url || ''
  })
}

async function generatePix(kv, request) {
  const { request_id, client_id, valor } = await parseBody(request)
  if (!client_id) return error('client_id é obrigatório')
  const s = await getSettings(kv)
  const pixKey = s.pix_key || '00000000000'
  const mName = s.pix_merchant_name || 'Vale Saude'
  const mCity = s.pix_merchant_city || 'Sao Paulo'
  const amount = valor || 4.99
  const txid = randomUUID().replace(/-/g, '').slice(0, 25)
  const pixPayload = generatePixPayload(pixKey, mName, mCity, amount, txid)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`
  const paymentId = randomUUID()
  await insertOne(kv, 'payments', {
    id: paymentId, request_id: request_id || '', client_id, metodo: 'pix',
    valor: amount, status: 'pendente', pix_qr_code: qrUrl, pix_chave: pixPayload
  })
  return json({
    paymentId, valor: amount, pixQrCode: qrUrl,
    pixCopiaCola: pixPayload,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  })
}

async function generatePixCode(kv, request) {
  const { pix_key, merchant_name, merchant_city, amount } = await parseBody(request)
  if (!pix_key) return error('pix_key é obrigatório')
  const s = await getSettings(kv)
  const mName = merchant_name || s.pix_merchant_name || 'Vale Saude'
  const mCity = merchant_city || s.pix_merchant_city || 'Sao Paulo'
  const valor = amount || 4.99
  const txid = randomUUID().replace(/-/g, '').slice(0, 25)
  const pixPayload = generatePixPayload(pix_key, mName, mCity, valor, txid)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`
  return json({ pixQrCode: qrUrl, pixCopiaCola: pixPayload, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
}

async function createCardPayment(kv, request) {
  const { request_id, client_id, card_numero, card_nome, card_validade, card_cvv, parcelas } = await parseBody(request)
  if (!request_id || !client_id || !card_numero || !card_nome || !card_validade || !card_cvv) {
    return error('Todos os campos do cartão são obrigatórios')
  }
  const req = await findById(kv, 'requests', request_id)
  if (!req) return error('Solicitação não encontrada', 404)
  const lastFour = card_numero.replace(/\s/g, '').slice(-4)
  const firstDigit = (card_numero.replace(/\s/g, '') || '')[0]
  let brand = ''
  if (firstDigit === '4') brand = 'visa'
  else if (firstDigit === '5') brand = 'mastercard'
  else if (firstDigit === '3') brand = 'amex'
  else if (firstDigit === '6') brand = 'elo'
  const id = randomUUID()
  const paid = Math.random() > 0.1
  await insertOne(kv, 'payments', {
    id, request_id, client_id, metodo: 'cartao', valor: req.valor_total,
    status: paid ? 'pago' : 'falha', card_last_four: lastFour, card_brand: brand,
    parcelas: parcelas || 1, paid_at: paid ? new Date().toISOString() : null
  })
  if (paid) {
    await updateOne(kv, 'requests', request_id, { status: 'pago' })
    await updateOne(kv, 'clients', client_id, { status: 'ativado' })
  }
  return json({
    paymentId: id, status: paid ? 'pago' : 'falha',
    message: paid ? 'Pagamento confirmado' : 'Pagamento não processado'
  }, 201)
}

async function paymentGetStatus(id, kv) {
  const payment = await findById(kv, 'payments', id)
  if (!payment) return error('Pagamento não encontrado', 404)
  return json({ id: payment.id, status: payment.status, metodo: payment.metodo, valor: payment.valor, paid_at: payment.paid_at })
}

async function paymentApprove(id, kv) {
  const payment = await findById(kv, 'payments', id)
  if (!payment) return error('Pagamento não encontrado', 404)
  if (payment.status === 'pago') return error('Pagamento já foi aprovado', 400)
  await updateOne(kv, 'payments', id, { status: 'pago', paid_at: new Date().toISOString() })
  await updateOne(kv, 'requests', payment.request_id, { status: 'pago' })
  await updateOne(kv, 'clients', payment.client_id, { status: 'ativado' })
  await insertOne(kv, 'logs', {
    id: randomUUID(), action: 'payment_approve', entity: 'payment', entity_id: id,
    details: JSON.stringify({ client_id: payment.client_id, valor: payment.valor }),
    ip: ''
  })
  return json({ message: 'Pagamento aprovado com sucesso' })
}

async function getPayments(kv, url) {
  const status = url.searchParams.get('status') || ''
  const page = url.searchParams.get('page') || 1
  const limit = url.searchParams.get('limit') || 50
  let list = await getColl(kv, 'payments')
  if (status) list = list.filter(p => p.status === status)
  const clients = await getColl(kv, 'clients')
  const cmap = {}
  clients.forEach(c => { cmap[c.id] = c })
  list = list.map(p => ({ ...p, client_nome: cmap[p.client_id]?.nome || '', client_cpf: cmap[p.client_id]?.cpf || '' }))
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const p = paginate(list, page, limit)
  return json({ payments: p.items, total: p.total, page: p.page, pages: p.pages })
}

// --- Tracking handlers ---

async function trackPixCopy(kv, request) {
  const { client_id } = await parseBody(request)
  if (client_id) {
    const client = await findById(kv, 'clients', client_id)
    if (client) {
      const pixCopies = (client.pix_copied_count || 0) + 1
      await updateOne(kv, 'clients', client_id, { pix_copied_count: pixCopies, last_active_at: new Date().toISOString() })
    }
  }
  return json({ ok: true })
}

async function trackPushinpayClick(kv, request) {
  const { client_id } = await parseBody(request)
  if (client_id) {
    const client = await findById(kv, 'clients', client_id)
    if (client) {
      const clicks = (client.pushinpay_click_count || 0) + 1
      await updateOne(kv, 'clients', client_id, { pushinpay_click_count: clicks, last_active_at: new Date().toISOString() })
    }
  }
  return json({ ok: true })
}

async function trackSupportClick(kv) {
  const settings = await getSettings(kv)
  const current = parseInt(settings.support_click_count || '0', 10)
  await saveSettings(kv, { support_click_count: String(current + 1) })
  return json({ ok: true, count: current + 1 })
}

async function resetSupportClicks(kv) {
  await saveSettings(kv, { support_click_count: '0' })
  return json({ ok: true })
}

async function trackPageView(kv) {
  const settings = await getSettings(kv)
  const current = parseInt(settings.page_view_count || '0', 10)
  await saveSettings(kv, { page_view_count: String(current + 1) })
  return json({ ok: true, count: current + 1 })
}

// --- Admin handlers ---

async function adminDashboard(kv) {
  const clients = await getColl(kv, 'clients')
  const requests = await getColl(kv, 'requests')
  const payments = await getColl(kv, 'payments')

  const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const onlineAgora = clients.filter(c => c.last_active_at && c.last_active_at >= cincoMinAtras).length

  const settings = await getSettings(kv)
  const totalPixCopies = clients.reduce((s, c) => s + (c.pix_copied_count || 0), 0)
  const totalPushinpayClicks = clients.reduce((s, c) => s + (c.pushinpay_click_count || 0), 0)
  const kpis = {
    totalClients: clients.length,
    pendingClients: clients.filter(c => c.status === 'pendente').length,
    approvedClients: clients.filter(c => c.status === 'aprovado').length,
    activatedClients: clients.filter(c => c.status === 'ativado').length,
    totalPayments: payments.length,
    paidPayments: payments.filter(p => p.status === 'pago').length,
    pixPayments: payments.filter(p => p.metodo === 'pix' && p.status === 'pago').length,
    cardPayments: payments.filter(p => p.metodo === 'cartao' && p.status === 'pago').length,
    onlineAgora,
    totalPixCopies,
    totalPushinpayClicks,
    supportClickCount: parseInt(settings.support_click_count || '0', 10),
    pageViewCount: parseInt(settings.page_view_count || '0', 10),
    expectativaReceita: (totalPixCopies + totalPushinpayClicks) * 4.99
  }

  const recentClients = clients.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10)
  const cmap = {}
  clients.forEach(c => { cmap[c.id] = c })
  const recentPayments = payments.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10)
    .map(p => ({ ...p, client_nome: cmap[p.client_id]?.nome || '' }))

  return json({ kpis, recentClients, recentPayments })
}

async function adminLogs(kv, url) {
  const action = url.searchParams.get('action') || ''
  const entity = url.searchParams.get('entity') || ''
  const page = url.searchParams.get('page') || 1
  const limit = url.searchParams.get('limit') || 100
  let list = await getColl(kv, 'logs')
  if (action) list = list.filter(l => l.action === action)
  if (entity) list = list.filter(l => l.entity === entity)
  const users = await getColl(kv, 'users')
  const umap = {}
  users.forEach(u => { umap[u.id] = u })
  list = list.map(l => ({ ...l, user_name: umap[l.user_id]?.name || '' }))
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const p = paginate(list, page, limit)
  return json({ logs: p.items })
}

async function adminNotifications(kv) {
  const list = await getColl(kv, 'notifications')
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return json({ notifications: list.slice(0, 50) })
}

async function markNotifRead(id, kv) {
  await updateOne(kv, 'notifications', id, { lida: 1 })
  return json({ message: 'Notificação marcada como lida' })
}

async function adminUsers(kv) {
  const users = await getColl(kv, 'users')
  return json({ users: users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, permissions: u.permissions, active: u.active, created_at: u.created_at })) })
}

async function adminCreateUser(kv, request) {
  const { email, password, name, role, permissions } = await parseBody(request)
  if (!email || !password || !name) return error('E-mail, senha e nome são obrigatórios')
  const existing = await findOne(kv, 'users', u => u.email === email)
  if (existing) return error('E-mail já cadastrado', 409)
  const id = randomUUID()
  await insertOne(kv, 'users', {
    id, email, password_hash: hashPassword(password), name,
    role: role || 'operador', permissions: permissions || [], active: 1
  })
  return json({ id, message: 'Usuário criado' }, 201)
}

async function adminGetSettings(kv) {
  const s = await getSettings(kv)
  return json({ settings: s })
}

async function adminSaveSettings(kv, request) {
  const { settings } = await parseBody(request)
  await saveSettings(kv, settings)
  return json({ message: 'Configurações salvas' })
}

// --- Webhook handlers ---

async function webhookPushinpay(kv, request) {
  const { transaction_id, status, amount } = await parseBody(request)
  if (!transaction_id) return error('transaction_id obrigatório')
  const payment = await findOne(kv, 'payments', p => p.id === transaction_id || p.pix_chave === transaction_id)
  if (!payment) return error('Pagamento não encontrado', 404)
  if (status === 'paid' || status === 'confirmed') {
    await updateOne(kv, 'payments', payment.id, { status: 'pago', paid_at: new Date().toISOString() })
    await updateOne(kv, 'requests', payment.request_id, { status: 'pago' })
    await updateOne(kv, 'clients', payment.client_id, { status: 'ativado' })
    await insertOne(kv, 'notifications', {
      id: randomUUID(), client_id: payment.client_id, tipo: 'payment',
      titulo: 'Pagamento confirmado',
      mensagem: 'Seu pagamento foi confirmado com sucesso', lida: 0
    })
  }
  return json({ received: true })
}

// --- CPF handlers ---

async function cpfConsult(kv, request) {
  const { cpf } = await parseBody(request)
  if (!cpf) return error('CPF é obrigatório')
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return error('CPF inválido')

  const s = await getSettings(kv)
  let keys = []
  try { if (s.cpf_api_keys) keys = JSON.parse(s.cpf_api_keys) } catch {}
  if (!keys.length) return error('Nenhuma chave de API configurada no admin')

  let lastError = null
  for (const key of keys) {
    try {
      const resp = await fetch(`https://api.hydracpf.com/v1/cpf/${clean}`, {
        headers: { 'x-api-key': key }
      })
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) continue
        const errData = await resp.json().catch(() => ({}))
        lastError = errData.error || `HTTP ${resp.status}`
        continue
      }
      const data = await resp.json()
      return json(data)
    } catch (e) {
      lastError = e.message
    }
  }
  return json({ error: lastError || 'Todas as chaves falharam' }, 502)
}

async function cpfKeysStatus(kv) {
  const s = await getSettings(kv)
  let keys = []
  try { if (s.cpf_api_keys) keys = JSON.parse(s.cpf_api_keys) } catch {}
  const status = keys.map(k => ({
    masked: k.length > 12 ? k.slice(0, 8) + '****' + k.slice(-4) : k,
    count: 0,
    limit: 10,
    remaining: 10
  }))
  return json({ status, active: status.length, queryLimit: 10 })
}
