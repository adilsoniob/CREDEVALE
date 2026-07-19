// ============================================================
// API Client – Comunicação com o backend
// ============================================================
const API = (() => {
  const isExpressDev = window.location.port === '3000';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const RAIL = 'https://credevale-production.up.railway.app/api';
  const isEdgeOne = window.location.hostname.includes('edgeone.run');
  const BASE = isExpressDev
    ? window.location.origin + '/api'
    : isLocalhost
      ? 'http://localhost:3000/api'
      : isEdgeOne
        ? RAIL
        : '/api';

  var _apiBase = BASE;

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
    updateClientPlan: (id, plano_escolhido) => request('PATCH', `/clients/${id}/plan`, { plano_escolhido }),
    updateClientDevice: (id, device) => request('PATCH', `/clients/${id}/device`, device),
    deleteClient: (id) => request('DELETE', `/clients/${id}`),
    getClientNotes: (id) => request('GET', `/clients/${id}/notes`),
    saveClientNotes: (id, observacoes) => request('PUT', `/clients/${id}/notes`, { observacoes }),

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
    updateUser: (id, data) => request('PUT', '/admin/users/' + id, data),
    deleteUser: (id) => request('DELETE', '/admin/users/' + id),
    changeUserPassword: (id, newPassword) => request('POST', '/admin/users/' + id + '/change-password', { newPassword }),
    toggleUserActive: (id) => request('POST', '/admin/users/' + id + '/toggle-active'),
    getSettings: () => request('GET', '/admin/settings'),
    saveSettings: (settings) => request('PUT', '/admin/settings', { settings }),
    cpfKeysStatus: () => request('GET', '/cpf/keys-status'),

    // SMS (proxy via Railway backend)
    smsSend: (data) => request('POST', '/admin/sms/send', data),
    smsAccounts: () => request('GET', '/admin/sms/accounts'),
    getSmsConfig: () => request('GET', '/admin/sms/config'),
    saveSmsConfig: (data) => request('POST', '/admin/sms/config', data),

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
    // Session tracking (real-time monitoring)
    trackSessionStart: (data) => request('POST', '/track/session/start', data),
    trackSessionHeartbeat: (sessionId) => request('POST', '/track/session/heartbeat', { session_id: sessionId }),
    trackSessionStage: (sessionId, stage, extra) => request('POST', '/track/session/stage', Object.assign({ session_id: sessionId, stage: stage }, extra || {})),
    getActiveSessions: () => request('GET', '/track/sessions/active'),
    updateSessionDevice: (sessionId, deviceData) => request('POST', '/track/session/update-device', Object.assign({ session_id: sessionId }, deviceData)),

    detectDevice: () => {
      var ua = navigator.userAgent;
      var dispositivo = 'Desktop';
      var modelo = 'PC';
      var os = '';
      var fabricante = '';
      var navegador = '';
      var navegadorVersao = '';
      var osVersao = '';

      try {
        // Try User-Agent Client Hints first (Chrome 90+)
        if (navigator.userAgentData) {
          var uaData = navigator.userAgentData;
          dispositivo = uaData.mobile ? 'Celular' : 'Desktop';
          var brands = uaData.brands || [];
          var chromeBrand = brands.find(function(b){ return b.brand === 'Google Chrome' || b.brand === 'Chromium'; });
          if (chromeBrand) { navegador = 'Chrome'; navegadorVersao = chromeBrand.version; }
          uaData.getHighEntropyValues(['model', 'platform', 'platformVersion', 'fullVersionList']).then(function(high){
            try {
              if (high.model && !sessionStorage.getItem('vs_modelo_high')) {
                sessionStorage.setItem('vs_modelo_high', high.model);
                sessionStorage.setItem('vs_modelo', high.model || sessionStorage.getItem('vs_modelo'));
              }
              if (high.platformVersion && !sessionStorage.getItem('vs_os_v_high')) {
                sessionStorage.setItem('vs_os_v_high', high.platformVersion);
              }
            } catch(e){}
          }).catch(function(){});
        }

        // Parse user-agent for all fields
        if (/iPhone|iPad|iPod/.test(ua)) {
          dispositivo = 'Celular';
          if (/iPad/.test(ua)) dispositivo = 'Tablet';
          var idMatch = ua.match(/\(([a-zA-Z]+[\d]+,[\d]+)/);
          var IPHONE_MAP = { 'iPhone16,1':'iPhone 15 Pro','iPhone16,2':'iPhone 15 Pro Max','iPhone16,3':'iPhone 15','iPhone16,4':'iPhone 15 Plus','iPhone15,2':'iPhone 14 Pro','iPhone15,3':'iPhone 14 Pro Max','iPhone15,4':'iPhone 14','iPhone15,5':'iPhone 14 Plus','iPhone14,2':'iPhone 13 Pro','iPhone14,3':'iPhone 13 Pro Max','iPhone14,4':'iPhone 13 mini','iPhone14,5':'iPhone 13','iPhone13,1':'iPhone 12 mini','iPhone13,2':'iPhone 12','iPhone13,3':'iPhone 12 Pro','iPhone13,4':'iPhone 12 Pro Max','iPad14,1':'iPad mini 6','iPad14,2':'iPad mini 6','iPad13,1':'iPad Air 4','iPad13,2':'iPad Air 4','iPad13,4':'iPad Pro 11 (3rd)','iPad13,8':'iPad Pro 12.9 (5th)' };
          if (idMatch && IPHONE_MAP[idMatch[1]]) { modelo = IPHONE_MAP[idMatch[1]]; }
          else if (idMatch) { modelo = idMatch[1]; }
          else { modelo = dispositivo === 'Celular' ? 'iPhone' : 'iPad'; }
          var o = ua.match(/iPhone OS ([\d_]+)/);
          os = o ? 'iOS ' + o[1].replace(/_/g, '.') : '';
          osVersao = o ? 'iOS ' + o[1].replace(/_/g, '.') : '';
          fabricante = 'Apple';
        } else if (/Android/.test(ua)) {
          dispositivo = 'Celular';
          if (/Tablet|SM-X|Tab\s\d/.test(ua)) dispositivo = 'Tablet';

          var am = ua.match(/Android\s+[\d.]+\s*;\s*([^;)]+)/);
          if (am) { modelo = am[1].trim().replace(/\s*Build\/[^/]+/gi, '').trim(); modelo = modelo.replace(/\s+RP1\.\S+/g, '').replace(/\s+[A-Z]\.[A-Z0-9]+\s*$/g, '').trim(); }

          // Fabricante detection
          if (/SM-|SAMSUNG|GT-|Galaxy/.test(ua)) { fabricante = 'Samsung'; }
          else if (/Moto|motorola/.test(ua)) { fabricante = 'Motorola'; }
          else if (/Xiaomi|Redmi|Mi\s[0-9]|POCO/.test(ua)) { fabricante = /POCO/.test(ua) ? 'POCO' : 'Xiaomi'; }
          else if (/Pixel/.test(ua)) { fabricante = 'Google'; }
          else if (/Realme|RMX/.test(ua)) { fabricante = 'Realme'; }
          else if (/OnePlus|ONEPLUS/.test(ua)) { fabricante = 'OnePlus'; }
          else if (/ASUS|Asus/.test(ua)) { fabricante = 'Asus'; }
          else if (/HUAWEI|Honor/.test(ua)) { fabricante = /Honor/i.test(ua) ? 'Honor' : 'Huawei'; }
          else if (/LG-|LGE/.test(ua)) { fabricante = 'LG'; }
          else if (/Sony/.test(ua)) { fabricante = 'Sony'; }
          else if (/Nokia/.test(ua)) { fabricante = 'Nokia'; }
          else if (/HTC/.test(ua)) { fabricante = 'HTC'; }
          else if (/Lenovo/.test(ua)) { fabricante = 'Lenovo'; }
          else if (/Alcatel/.test(ua)) { fabricante = 'Alcatel'; }
          else if (/TECNO|Infinix|itel/.test(ua)) { fabricante = 'Tecno'; }
          else if (/POSITIVO|Positivo/.test(ua)) { fabricante = 'Positivo'; }
          else if (/Multilaser/.test(ua)) { fabricante = 'Multilaser'; }
          else if (/GM\s|GME/.test(ua)) { fabricante = 'Gradiente'; }

          if (!fabricante) {
            var fbMatch = ua.match(/(Samsung|Motorola|Xiaomi|Google|Huawei|LG|Sony|Nokia|Realme|OnePlus|Asus|Lenovo|Alcatel|HTC|TECNO|Infinix|itel|Positivo|Multilaser)/i);
            if (fbMatch) fabricante = fbMatch[1].charAt(0).toUpperCase() + fbMatch[1].slice(1).toLowerCase();
          }

          var sm = ua.match(/SM-[A-Z0-9]+/);
          if (sm) modelo = sm[0];
          if (!modelo || modelo.length < 3) {
            var fb = ua.match(/Android[\s\S]*?(?:;|\))\s*([A-Za-z][A-Za-z0-9\s-]+?)(?:\s*Build|\s*;|\s*\)|$)/);
            if (fb) modelo = fb[1].trim();
          }
          if (!modelo || modelo.length < 3) {
            var highMdl = sessionStorage.getItem('vs_modelo_high');
            if (highMdl) modelo = highMdl;
          }
          if (!modelo || modelo.length < 3) { modelo = fabricante || 'Android'; }

          var o = ua.match(/Android\s+([\d.]+)/);
          os = o ? 'Android ' + o[1] : '';
          osVersao = os;
        } else if (/Windows/.test(ua)) {
          dispositivo = 'Desktop';
          modelo = 'PC';
          var winMap = { '10.0':'10/11', '6.3':'8.1', '6.2':'8', '6.1':'7' };
          var o = ua.match(/Windows NT ([\d.]+)/);
          os = o ? 'Windows ' + (winMap[o[1]] || o[1]) : '';
          osVersao = os;
          fabricante = 'Microsoft';
        } else if (/Mac/.test(ua)) {
          dispositivo = 'Desktop';
          modelo = 'Mac';
          var o = ua.match(/Mac OS X ([\d_]+)/);
          os = o ? 'macOS ' + o[1].replace(/_/g, '.') : '';
          osVersao = os;
          fabricante = 'Apple';
        } else if (/Linux/.test(ua)) {
          dispositivo = 'Desktop';
          modelo = 'PC';
          os = 'Linux';
          osVersao = 'Linux';
        }

        // Browser detection
        if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
          navegador = 'Chrome';
          var cv = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
          if (cv) navegadorVersao = cv[1];
        } else if (/Firefox/.test(ua)) {
          navegador = 'Firefox';
          var fv = ua.match(/Firefox\/([\d.]+)/);
          if (fv) navegadorVersao = fv[1];
        } else if (/SamsungBrowser/.test(ua)) {
          navegador = 'Samsung Internet';
          var sv = ua.match(/SamsungBrowser\/([\d.]+)/);
          if (sv) navegadorVersao = sv[1];
        } else if (/Edg/.test(ua)) {
          navegador = 'Edge';
          var ev = ua.match(/Edg\/([\d.]+)/);
          if (ev) navegadorVersao = ev[1];
        } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
          navegador = 'Safari';
          var sa = ua.match(/Version\/([\d.]+)/);
          if (sa) navegadorVersao = sa[1];
        } else if (/OPR|Opera/.test(ua)) {
          navegador = 'Opera';
          var op = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
          if (op) navegadorVersao = op[1];
        } else {
          navegador = 'Desconhecido';
        }
      } catch (e) {}

      // Fallback: userAgentData might have already set some values
      try {
        if (navigator.userAgentData && navigator.userAgentData.platform && !os) {
          var plat = navigator.userAgentData.platform;
          if (plat === 'macOS' || plat === 'MacIntel') { os = 'macOS'; osVersao = 'macOS'; fabricante = fabricante || 'Apple'; }
          else if (plat === 'Windows') { os = 'Windows'; osVersao = 'Windows'; fabricante = fabricante || 'Microsoft'; }
          else if (plat === 'Linux') { os = 'Linux'; osVersao = 'Linux'; }
          else if (plat === 'Android') { if (!os) { os = 'Android'; osVersao = 'Android'; } }
          else if (plat === 'iOS' || plat === 'iPhone' || plat === 'iPad') { if (!os) { os = 'iOS'; osVersao = 'iOS'; fabricante = 'Apple'; } }
        }
      } catch(e) {}

      if (!navegador) {
        navegador = /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) && !/Chrome/.test(ua) ? 'Safari' : /Edg/.test(ua) ? 'Edge' : 'Desconhecido';
      }
      if (!fabricante) {
        if (dispositivo === 'iPhone' || dispositivo === 'iPad' || dispositivo === 'Mac') fabricante = 'Apple';
        else if (/Android/.test(ua) || dispositivo === 'Android') { /* already tried above */ }
      }

      try { sessionStorage.setItem('vs_dispositivo', dispositivo); } catch (e) {}
      try { sessionStorage.setItem('vs_modelo', modelo); } catch (e) {}
      try { sessionStorage.setItem('vs_fabricante', fabricante); } catch (e) {}
      if (os) { try { sessionStorage.setItem('vs_os', os); } catch (e) {} }
      if (navegador) { try { sessionStorage.setItem('vs_navegador', navegador); } catch (e) {} }
      if (navegadorVersao) { try { sessionStorage.setItem('vs_navegador_versao', navegadorVersao); } catch (e) {} }
      if (osVersao) { try { sessionStorage.setItem('vs_os_versao', osVersao); } catch (e) {} }

        return { dispositivo, modelo, fabricante, os, osVersao, navegador, navegadorVersao };
    },

    // ========== Download App Modal (compartilhado entre Index, app.html e Cadastro) ==========
    showDownloadModal: function(clientData) {
      clientData = clientData || {};
      var apiBase = window.__API_BASE || '/api';

      // 1° Registrar clique imediatamente
      try {
        var payload = {
          client_id: clientData.clientId || '',
          client_cpf: clientData.cpf || '',
          client_nome: clientData.nome || '',
          apk_available: true,
          device_info: navigator.userAgent || ''
        };
        navigator.sendBeacon(apiBase + '/app/register-download', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch (e) {}

      // 2° Buscar WhatsApp de suporte
      (function() {
        if (sessionStorage.getItem('vs_support_wa')) return;
        fetch(apiBase + '/payments/config').then(function(r) { return r.json(); }).then(function(cfg) {
          if (cfg && cfg.whatsapp) sessionStorage.setItem('vs_support_wa', String(cfg.whatsapp).replace(/\D/g, ''));
        }).catch(function() {});
      })();

      // 3° Criar overlay
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease;';

      var box = document.createElement('div');
      box.style.cssText = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:24px 22px;max-width:360px;width:100%;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.15);animation:modalIn 0.3s ease;position:relative;';

      // 4° Mostrar loading com progresso
      box.innerHTML =
        '<div style="padding:12px 0;">' +
          '<div style="width:48px;height:48px;margin:0 auto 16px;border:4px solid #dbeafe;border-top-color:#0B6CF4;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
          '<p style="font-size:0.95rem;font-weight:700;color:#1F2937;margin:0 0 4px;">Preparando a instalação do CredVale App...</p>' +
          '<p style="font-size:0.78rem;color:#6B7280;margin:0 0 16px;">Estamos preparando o aplicativo para o seu dispositivo.</p>' +
          '<div style="width:100%;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">' +
            '<div style="height:100%;width:0%;background:linear-gradient(90deg,#0B6CF4,#059669);border-radius:3px;transition:width 0.3s;" id="dlSharedBar"></div>' +
          '</div>' +
          '<p style="font-size:0.72rem;color:#6B7280;margin:8px 0 0;" id="dlSharedText">Preparando a instalação... 0%</p>' +
        '</div>';

      overlay.appendChild(box);
      document.body.appendChild(overlay);
      overlay.onclick = function(e) { if (e.target === overlay) { overlay.remove(); } };

      // 5° Simular progresso por 8 segundos
      var simPct = 0;
      var simInt = setInterval(function() {
        simPct += Math.floor(Math.random() * 12) + 5;
        if (simPct >= 100) simPct = 100;
        var bar = document.getElementById('dlSharedBar');
        var txt = document.getElementById('dlSharedText');
        if (bar) bar.style.width = simPct + '%';
        if (txt) txt.textContent = 'Preparando a instalação... ' + simPct + '%';
      }, 200);

      // 6° Após 8s, mostrar erro + WhatsApp
      setTimeout(function() {
        clearInterval(simInt);
        var waNum = sessionStorage.getItem('vs_support_wa') || '';
        var waUrl = waNum ? 'https://wa.me/' + waNum.replace(/\D/g, '') + '?text=Ol%C3%A1%21+Quero+ajuda+para+baixar+o+aplicativo+CredVale.' : '#';
        box.innerHTML =
          '<div style="padding:12px 0;">' +
            '<h3 style="font-family:inherit;font-size:1rem;font-weight:800;color:#DC2626;margin:0 0 12px;">📱 Instalar CredVale App</h3>' +
            '<p style="font-size:0.82rem;color:#DC2626;font-weight:600;line-height:1.5;margin:0 0 10px;">😕 ⚠️ Houve um problema ao baixar o aplicativo.</p>' +
            '<p style="font-size:0.78rem;color:#4B5563;line-height:1.5;margin:0 0 10px;">Isso normalmente acontece quando a versão disponível não é compatível com o seu dispositivo.</p>' +
            '<p style="font-size:0.78rem;color:#4B5563;line-height:1.5;margin:0 0 10px;">Nossa equipe pode enviar a versão correta para você e ajudar na instalação.</p>' +
            '<p style="font-size:0.78rem;color:#4B5563;line-height:1.5;margin:0 0 20px;">Clique no botão abaixo e fale agora com um de nossos atendentes.</p>' +
            '<a href="' + waUrl + '" target="_blank" rel="noopener" style="display:block;width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;text-decoration:none;text-align:center;margin-bottom:8px;">💬 Falar com um atendente</a>' +
            '<button id="dlSharedClose" style="width:100%;padding:10px;border-radius:12px;border:none;background:transparent;color:#9CA3AF;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Fechar</button>' +
          '</div>';
        var closeBtn = document.getElementById('dlSharedClose');
        if (closeBtn) closeBtn.onclick = function() { overlay.remove(); };
      }, 8000);
    }
  };
})();

// Auto-capture na carga da página
try { API.detectDevice(); } catch (e) {}

