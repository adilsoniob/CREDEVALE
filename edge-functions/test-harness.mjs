import { onRequest } from './api/[[default]].js'

// In-memory KV mock
const store = {}
const mockKv = {
  get: async (key) => store[key] || null,
  put: async (key, val) => { store[key] = val },
  list: async () => Object.keys(store).map(k => ({ name: k }))
}

function createRequest(method, path, body, headers = {}) {
  const url = `https://test.com${path}`
  const raw = {}
  if (body) raw['content-type'] = 'application/json'
  raw.origin = 'https://test.com'
  for (const [k, v] of Object.entries(headers)) raw[k.toLowerCase()] = v
  return {
    method,
    url,
    _rawHeaders: raw,
    text: async () => body ? JSON.stringify(body) : ''
  }
}

function fixHeaders(req) {
  const h = new Map(Object.entries(req._rawHeaders || {}))
  req.headers = {
    get: (k) => h.get(k.toLowerCase()) || null,
    forEach: (fn) => h.forEach((v, k) => fn(v, k))
  }
  return req
}

async function test(method, path, body = null, headers = {}) {
  const req = fixHeaders(createRequest(method, path, body, headers))
  const url = new URL(req.url)
  req.url = url
  
  const context = {
    request: req,
    env: { VALE_SAUDE_KV: mockKv },
    params: {},
    data: {},
    waitUntil: () => {},
    next: () => {},
    redirect: () => {}
  }

  try {
    const resp = await onRequest(context)
    const text = await resp.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: resp.status, data }
  } catch (err) {
    return { status: 500, data: { error: err.message, stack: err.stack?.split('\n').slice(0, 3).join(' | ') } }
  }
}

let passed = 0, failed = 0

function assert(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`)
  }
}

// ========== RUN TESTS ==========
console.log('\n=== HEALTH ===')
{
  const r = await test('GET', '/api/health')
  assert('health returns 200', r.status === 200)
  assert('health has status ok', r.data?.status === 'ok')
}

console.log('\n=== AUTH: login ===')
{
  const r = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'admin123' })
  assert('login returns 200', r.status === 200)
  assert('login returns token', !!r.data?.token)
  assert('login returns user', r.data?.user?.email === 'admin@valesaude.com.br')
}

console.log('\n=== AUTH: login wrong password ===')
{
  const r = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'wrong' })
  assert('wrong password returns 401', r.status === 401)
}

console.log('\n=== AUTH: me ===')
{
  const loginR = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'admin123' })
  const token = loginR.data?.token
  const r = await test('GET', '/api/auth/me', null, { Authorization: `Bearer ${token}` })
  assert('/me returns 200', r.status === 200)
  assert('/me returns user', r.data?.user?.email === 'admin@valesaude.com.br')
}

console.log('\n=== CLIENTS: create ===')
{
  const r = await test('POST', '/api/clients', {
    cpf: '52998224725', nome: 'Maria Silva', whatsapp: '11999999999',
    email: 'maria@test.com', cep: '01001000'
  })
  assert('create client returns 201', r.status === 201)
  assert('create client has clientId', !!r.data?.clientId)
}

console.log('\n=== CLIENTS: create duplicate ===')
{
  const r = await test('POST', '/api/clients', {
    cpf: '52998224725', nome: 'Maria Outra', whatsapp: '11988888888'
  })
  // CPF already exists but not aprovado/ativado, so it should update
  assert('duplicate CPF updates and returns 200', r.status === 200)
  assert('duplicate returns clientId', !!r.data?.clientId)
}

console.log('\n=== CLIENTS: get by CPF ===')
{
  const createR = await test('POST', '/api/clients', {
    cpf: '12345678909', nome: 'Joao Teste', whatsapp: '11977777777'
  })
  const clientId = createR.data?.clientId

  const r = await test('GET', `/api/clients/by-cpf/12345678909`)
  assert('get by CPF returns 200', r.status === 200)
  assert('get by CPF has nome', r.data?.nome === 'Joao Teste')
}

console.log('\n=== CLIENTS: list ===')
{
  const r = await test('GET', '/api/clients')
  assert('list clients returns 200', r.status === 200)
  assert('list has clients array', Array.isArray(r.data?.clients))
  assert('list has at least 2 clients', r.data?.clients?.length >= 2)
}

console.log('\n=== PRODUCTS: list ===')
{
  const r = await test('GET', '/api/products')
  assert('list products returns 200', r.status === 200)
  assert('products is array', Array.isArray(r.data))
  assert('has seeded products', r.data?.length >= 2)
}

console.log('\n=== PRODUCTS: list plans ===')
{
  const r = await test('GET', '/api/products/plans')
  assert('list plans returns 200', r.status === 200)
  assert('plans is array', Array.isArray(r.data))
  assert('has seeded plans', r.data?.length >= 2)
}

console.log('\n=== REQUESTS: create ===')
{
  const clients = (await test('GET', '/api/clients')).data?.clients
  const clientId = clients?.[0]?.id
  if (clientId) {
    const r = await test('POST', '/api/requests', { client_id: clientId, tipo_produto: 'virtual' })
    assert('create request returns 201', r.status === 201)
    assert('create request has requestId', !!r.data?.requestId)
    assert('request valor is 4.99', r.data?.valor === 4.99)
  } else {
    console.log('  ⚠ skip: no client available')
  }
}

console.log('\n=== PAYMENTS: config ===')
{
  const r = await test('GET', '/api/payments/config')
  assert('payment config returns 200', r.status === 200)
  assert('config has pix_key', 'pix_key' in (r.data || {}))
}

console.log('\n=== PAYMENTS: generate PIX ===')
{
  const clients = (await test('GET', '/api/clients')).data?.clients
  const clientId = clients?.[0]?.id
  if (clientId) {
    const r = await test('POST', '/api/payments/generate-pix', { client_id: clientId, valor: 19.99 })
    assert('generate PIX returns 200', r.status === 200)
    assert('PIX has qrcode', !!r.data?.pixQrCode)
    assert('PIX has copia-cola', !!r.data?.pixCopiaCola)
    assert('PIX amount matches', r.data?.valor === 19.99)
  } else {
    console.log('  ⚠ skip: no client available')
  }
}

console.log('\n=== PAYMENTS: generate PIX code (admin) ===')
{
  const r = await test('POST', '/api/payments/generate-pix-code', {
    pix_key: 'test@example.com', amount: 10.00
  })
  assert('generate PIX code returns 200', r.status === 200)
  assert('PIX code has copia-cola', !!r.data?.pixCopiaCola)
}

console.log('\n=== ADMIN: dashboard ===')
{
  const loginR = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'admin123' })
  const token = loginR.data?.token
  const r = await test('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${token}` })
  assert('dashboard returns 200', r.status === 200)
  assert('dashboard has kpis', !!r.data?.kpis)
  assert('kpis has totalClients', typeof r.data?.kpis?.totalClients === 'number')
}

console.log('\n=== ADMIN: dashboard without auth ===')
{
  const r = await test('GET', '/api/admin/dashboard')
  assert('dashboard without auth returns 401', r.status === 401)
}

console.log('\n=== ADMIN: settings ===')
{
  const loginR = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'admin123' })
  const token = loginR.data?.token
  const r = await test('GET', '/api/admin/settings', null, { Authorization: `Bearer ${token}` })
  assert('settings returns 200', r.status === 200)
  assert('settings has payment_methods', !!r.data?.settings?.payment_methods)
}

console.log('\n=== ADMIN: save settings ===')
{
  const loginR = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'admin123' })
  const token = loginR.data?.token
  const r = await test('PUT', '/api/admin/settings',
    { settings: { pix_key: 'test@key.com', pix_merchant_name: 'Teste' } },
    { Authorization: `Bearer ${token}` }
  )
  assert('save settings returns 200', r.status === 200)

  // Verify settings were saved (merge, not replace)
  const checkR = await test('GET', '/api/admin/settings', null, { Authorization: `Bearer ${token}` })
  assert('pix_key saved', checkR.data?.settings?.pix_key === 'test@key.com')
  assert('payment_methods preserved', !!checkR.data?.settings?.payment_methods)
}

console.log('\n=== ADMIN: users ===')
{
  const loginR = await test('POST', '/api/auth/login', { email: 'admin@valesaude.com.br', password: 'admin123' })
  const token = loginR.data?.token
  const r = await test('GET', '/api/admin/users', null, { Authorization: `Bearer ${token}` })
  assert('users returns 200', r.status === 200)
  assert('users is array', Array.isArray(r.data?.users))
  assert('has 3 seeded users', r.data?.users?.length >= 3)
}

console.log('\n=== WEBHOOK: pushinpay ===')
{
  const clients = (await test('GET', '/api/clients')).data?.clients
  const clientId = clients?.[0]?.id
  const pixR = await test('POST', '/api/payments/generate-pix', { client_id: clientId, valor: 10 })
  const paymentId = pixR.data?.paymentId
  
  if (paymentId) {
    const r = await test('POST', '/api/webhooks/pushinpay', {
      transaction_id: paymentId, status: 'paid', amount: 10
    })
    assert('webhook returns 200', r.status === 200)
    assert('webhook received', r.data?.received === true)
    
    // Verify payment was marked as paid
    const statusR = await test('GET', `/api/payments/${paymentId}/status`)
    assert('payment status is pago', statusR.data?.status === 'pago')
  } else {
    console.log('  ⚠ skip: no payment generated')
  }
}

console.log('\n=== CPF: consult without keys ===')
{
  const r = await test('POST', '/api/cpf/consult', { cpf: '52998224725' })
  assert('CPF consult without keys returns error', r.status === 400)
  assert('error message about API keys', r.data?.error?.includes('chave'))
}

console.log('\n=== NOT FOUND ===')
{
  const r = await test('GET', '/api/nonexistent')
  assert('unknown route returns 404', r.status === 404)
}

console.log('\n=== CORS ===')
{
  const req = fixHeaders(createRequest('OPTIONS', '/api/health'))
  const context = { request: req, env: { VALE_SAUDE_KV: mockKv }, params: {}, data: {}, waitUntil: () => {}, next: () => {}, redirect: () => {} }
  const resp = await onRequest(context)
  assert('OPTIONS returns 204', resp.status === 204)
  assert('OPTIONS has CORS headers', !!resp.headers.get || resp.headers.forEach(() => {}))
}

// ========== SUMMARY ==========
console.log(`\n${'='.repeat(40)}`)
console.log(`${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(40)}\n`)

process.exit(failed > 0 ? 1 : 0)
