// ============================================================
// API Client – Comunicação com o backend
// ============================================================
const API = (() => {
  const isExpressDev = window.location.port === '3000';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isEdgeOne = window.location.hostname.includes('edgeone.run');
  const BASE = isExpressDev
    ? window.location.origin + '/api'
    : isLocalhost
      ? 'http://localhost:3000/api'
      : isEdgeOne
        ? (sessionStorage.getItem('vs_api_url') || 'https://valle-production-105b.up.railway.app/api')
        : '/api';

  var _apiBase = BASE;
  if (isEdgeOne) {
    var stored = sessionStorage.getItem('vs_api_url');
    if (stored) _apiBase = stored;
  }

  function resolveBase() { return _apiBase; }

  // Expor base URL para outros scripts (cadastro.js, pagamento.js, etc.)
  window.__API_BASE = _apiBase;

  async function request(method, path, body = null) {
    var base = resolveBase();
    var opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    var token = localStorage.getItem('vs_token');
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;

    if (body) opts.body = JSON.stringify(body);

    var res = await fetch(base + path, opts);
    var ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html') || ct.includes('text/plain')) {
      throw new Error('API não encontrada em ' + base + '. Configure o servidor backend (Railway) no admin.');
    }
    var data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erro na requisição');
    }

    return data;
  }

  function setApiUrl(url) {
    if (!url) { sessionStorage.removeItem('vs_api_url'); _apiBase = window.location.origin + '/api'; window.__API_BASE = _apiBase; return; }
    var newBase = url.replace(/\/+$/, '') + '/api';
    sessionStorage.setItem('vs_api_url', newBase);
    _apiBase = newBase;
    window.__API_BASE = _apiBase;
  }

  function getApiUrl() { return resolveBase(); }

  return {
    setApiUrl,
    getApiUrl,
    request: (method, path, body) => request(method, path, body),
    // Auth
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    me: () => request('GET', '/auth/me'),
    changePassword: (currentPassword, newPassword) => request('POST', '/auth/change-password', { currentPassword, newPassword }),

    // Clients
    createClient: (data) => request('POST', '/clients', data),
    getClientByCpf: (cpf) => request('GET', `/clients/by-cpf/${cpf}`),
    getClients: (params = '') => request('GET', `/clients${params ? '?' + params : ''}`),
    getClient: (id) => request('GET', `/clients/${id}`),
    updateClientStatus: (id, status, limite_aprovado) => request('PATCH', `/clients/${id}/status`, { status, limite_aprovado }),
    deleteClient: (id) => request('DELETE', `/clients/${id}`),

    // Products
    getProducts: () => request('GET', '/products'),
    getPlans: () => request('GET', '/products/plans'),
    createProduct: (data) => request('POST', '/products', data),
    updateProduct: (id, data) => request('PUT', `/products/${id}`, data),
    deleteProduct: (id) => request('DELETE', `/products/${id}`),
    createPlan: (data) => request('POST', '/products/plans', data),
    updatePlan: (id, data) => request('PUT', `/products/plans/${id}`, data),

    // Requests
    createRequest: (data) => request('POST', '/requests', data),
    getRequests: (params = '') => request('GET', `/requests${params ? '?' + params : ''}`),
    updateRequestStatus: (id, status, limite_aprovado) => request('PATCH', `/requests/${id}/status`, { status, limite_aprovado }),

    // Payments
    createPixPayment: (request_id, client_id) => request('POST', '/payments/pix', { request_id, client_id }),
    createCardPayment: (data) => request('POST', '/payments/card', data),
    getPaymentStatus: (id) => request('GET', `/payments/${id}/status`),
    getPayments: (params = '') => request('GET', `/payments${params ? '?' + params : ''}`),
    generatePixCode: (data) => request('POST', '/payments/generate-pix-code', data),

    // Admin
    getDashboard: () => request('GET', '/admin/dashboard'),
    getLogs: (params = '') => request('GET', `/admin/logs${params ? '?' + params : ''}`),
    getNotifications: () => request('GET', '/admin/notifications'),
    markNotificationRead: (id) => request('PATCH', `/admin/notifications/${id}/read`),
    getUsers: () => request('GET', '/admin/users'),
    createUser: (data) => request('POST', '/admin/users', data),
    getSettings: () => request('GET', '/admin/settings'),
    saveSettings: (settings) => request('PUT', '/admin/settings', { settings }),
    cpfKeysStatus: () => request('GET', '/cpf/keys-status'),

    // WhatsApp (proxy via EdgeOne → WhatsApp Server)
    waStatus: () => request('GET', '/whatsapp/api/admin/status'),
    waDashboard: () => request('GET', '/whatsapp/api/admin/dashboard'),
    waAccounts: () => request('GET', '/whatsapp/api/accounts'),
    waAccountConnect: (index) => request('POST', `/whatsapp/api/account/${index}/connect`),
    waAccountReconnect: (index) => request('POST', `/whatsapp/api/account/${index}/reconnect`),
    waAccountDisconnect: (index) => request('POST', `/whatsapp/api/account/${index}/disconnect`),
    waAccountRemove: (index) => request('POST', `/whatsapp/api/account/${index}/remove`),
    waQRRefresh: (index) => request('POST', `/whatsapp/api/admin/qr/refresh/${index}`),
    waQRCancel: (index) => request('POST', `/whatsapp/api/admin/qr/cancel/${index}`),
    waMessages: (params = '') => request('GET', `/whatsapp/api/admin/messages${params ? '?' + params : ''}`),
    waMessageStats: () => request('GET', '/whatsapp/api/admin/messages/stats'),
    waMessageByPhone: (phone) => request('GET', `/whatsapp/api/admin/messages/${phone}`),
    waQueue: () => request('GET', '/whatsapp/api/queue'),
    waLogs: () => request('GET', '/whatsapp/api/admin/logs'),
    waContacts: () => request('GET', '/whatsapp/api/admin/contacts'),
    waTemplates: () => request('GET', '/whatsapp/api/admin/templates'),
    waCreateTemplate: (data) => request('POST', '/whatsapp/api/admin/templates', data),
    waUpdateTemplate: (id, data) => request('PUT', `/whatsapp/api/admin/templates/${id}`, data),
    waDeleteTemplate: (id) => request('DELETE', `/whatsapp/api/admin/templates/${id}`),
    waWAMessages: () => request('GET', '/whatsapp/api/admin/whatsapp-messages'),
    waCreateWAMessage: (data) => request('POST', '/whatsapp/api/admin/whatsapp-messages', data),
    waUpdateWAMessage: (id, data) => request('PUT', `/whatsapp/api/admin/whatsapp-messages/${id}`, data),
    waToggleWAMessage: (id) => request('POST', `/whatsapp/api/admin/whatsapp-messages/${id}/toggle`),
    waDeleteWAMessage: (id) => request('DELETE', `/whatsapp/api/admin/whatsapp-messages/${id}`),
    waCampaigns: () => request('GET', '/whatsapp/api/campaigns'),
    waCreateCampaign: (data) => request('POST', '/whatsapp/api/campaigns', data),
    waDeleteCampaign: (id) => request('DELETE', `/whatsapp/api/campaigns/${id}`),
    waGetStealth: () => request('GET', '/whatsapp/api/admin/stealth'),
    waSetStealth: (enabled) => request('POST', '/whatsapp/api/admin/stealth', { enabled }),
    waClearQueue: () => request('POST', '/whatsapp/api/admin/clear/queue'),
    waClearMessages: () => request('POST', '/whatsapp/api/admin/clear/messages'),
    waClearLogs: () => request('POST', '/whatsapp/api/admin/clear/logs'),
    waClearContacts: () => request('POST', '/whatsapp/api/admin/clear/contacts'),
    waClearTemplates: () => request('POST', '/whatsapp/api/admin/clear/templates'),
    waClearWAMessages: () => request('POST', '/whatsapp/api/admin/clear/whatsapp-messages'),
    waClearCampaigns: () => request('POST', '/whatsapp/api/admin/clear/campaigns'),
    waClearErrors: () => request('POST', '/whatsapp/api/admin/clear/errors'),
    waClearAllButTemplates: () => request('POST', '/whatsapp/api/admin/clear/all-but-templates'),
    detectDevice: () => {
      var ua = navigator.userAgent;
      var dispositivo = 'Desktop';
      var modelo = 'PC';

      if (/iPhone|iPad|iPod/.test(ua)) {
        dispositivo = 'iPhone'; modelo = 'iPhone';
      } else if (/Android/.test(ua)) {
        dispositivo = 'Android';
        var m = ua.match(/Android\s+[\d.]+\s*;\s*([^;)]+)/);
        modelo = m ? m[1].trim().replace(/\s*Build\/.*$/i, '') : 'Desconhecido';
      } else if (/Windows/.test(ua)) {
        dispositivo = 'Windows'; modelo = 'PC';
      } else if (/Mac/.test(ua)) {
        dispositivo = 'Mac'; modelo = 'Mac';
      }

      // Salva na sessionStorage
      try { sessionStorage.setItem('vs_dispositivo', dispositivo); } catch (e) {}
      try { sessionStorage.setItem('vs_modelo', modelo); } catch (e) {}

      return { dispositivo, modelo };
    }
  };
})();

// Auto-capture na carga da página
try { API.detectDevice(); } catch (e) {}

