(() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const show = el => el && (el.hidden = false);
  const hide = el => el && (el.hidden = true);
  const fmtMoney = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  const fmtDate = d => d ? new Date(d + 'Z').toLocaleDateString('pt-BR') : '—';
  const fmtDateTime = d => d ? new Date(d + 'Z').toLocaleString('pt-BR') : '—';

  const SMS_TEMPLATE = `Ol\u00e1, {NOME}! \ud83c\udf89\n\nParab\u00e9ns! Seu cadastro foi aprovado com sucesso no CredVale.\n\n\ud83d\udcb3 Seu limite dispon\u00edvel \u00e9 de R$ {LIMITE}.\n\nAgora voc\u00ea j\u00e1 pode baixar o aplicativo do CredVale e come\u00e7ar a aproveitar todos os benef\u00edcios:\n\n\u2705 At\u00e9 75% de desconto em medicamentos\n\u2705 Parcelamento em at\u00e9 15x\n\u2705 Fatura com at\u00e9 45 dias para pagar\n\u2705 Cart\u00e3o virtual com libera\u00e7\u00e3o imediata\n\nBaixe agora:\n{LINK_APP}\n\nSe precisar de ajuda, nossa equipe est\u00e1 \u00e0 disposi\u00e7\u00e3o.\n\nSeja bem-vindo ao CredVale! \ud83d\udc99`;

  function fillSmsTemplate(nome, limite, linkApp) {
    return SMS_TEMPLATE
      .replace(/\{NOME\}/g, nome)
      .replace(/\{LIMITE\}/g, limite)
      .replace(/\{LINK_APP\}/g, linkApp);
  }

  let currentRoute = 'dashboard';
  let currentUser = null;
  let currentPage = { clients: 1, pagamentos: 1 };
  let currentFilter = { clients: '', pagamentos: '' };

  // --- Auth ---
  function getToken() { return localStorage.getItem('vs_token'); }
  function setToken(t) { localStorage.setItem('vs_token', t); }
  function clearToken() { localStorage.removeItem('vs_token'); localStorage.removeItem('vs_user'); }
  function getStoredUser() { try { return JSON.parse(localStorage.getItem('vs_user')); } catch { return null; } }
  function storeUser(u) { localStorage.setItem('vs_user', JSON.stringify(u)); }

  async function checkAuth() {
    const loginScreen = $('#loginScreen');
    const adminScreen = $('#adminScreen');
    const token = getToken();
    if (!token) { loginScreen.style.display = 'flex'; adminScreen.style.display = 'none'; return false; }
    try {
      const data = await API.me();
      if (!data.user) throw new Error('No user');
      currentUser = data.user;
      storeUser(data.user);
      $('#sidebarUserName').textContent = '👤 ' + (data.user.name || data.user.email);
      loginScreen.style.display = 'none';
      adminScreen.style.display = '';
      return true;
    } catch (e) {
      clearToken();
      loginScreen.style.display = 'flex';
      adminScreen.style.display = 'none';
      var apiArea = $('#apiConfigArea');
      if (apiArea && (e.message || '').includes('API não encontrada')) {
        apiArea.style.display = '';
        $('#loginError').textContent = 'Servidor backend não encontrado. Configure a URL abaixo.';
        $('#loginError').style.display = '';
      }
      return false;
    }
  }

  async function doLogin(email, password) {
    try {
      const data = await API.login(email, password);
      setToken(data.token);
      storeUser(data.user);
      currentUser = data.user;
      $('#sidebarUserName').textContent = '👤 ' + (data.user.name || data.user.email);
      $('#loginScreen').style.display = 'none';
      $('#adminScreen').style.display = '';
      $('#loginError').style.display = 'none';
      initApp();
    } catch (e) {
      $('#loginError').textContent = e.message || 'Erro ao fazer login';
      $('#loginError').style.display = '';
      var apiArea = $('#apiConfigArea');
      if (apiArea && (e.message || '').includes('API não encontrada')) {
        apiArea.style.display = '';
      }
    }
  }

  function showToast(msg, type = 'success') {
    const old = $('#adminToast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'adminToast';
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:14px 24px;border-radius:12px;font-size:0.875rem;font-weight:600;color:#fff;background:${type === 'success' ? '#16C65B' : '#DC2626'};box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:toastIn 0.3s ease;max-width:90%;text-align:center;backdrop-filter:blur(8px);`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
    const style = document.createElement('style');
    style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    if (!document.getElementById('toastStyle')) { style.id = 'toastStyle'; document.head.appendChild(style); }
  }

  function showConfirmModal(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px;animation:modalIn 0.2s ease;';
      overlay.innerHTML = `
        <div style="background:#203A57;border-radius:24px;padding:32px 24px;max-width:380px;width:100%;text-align:center;border:1px solid rgba(255,255,255,0.08);box-shadow:0 30px 80px rgba(0,0,0,0.45);">
          <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
          <h3 style="font-size:1.125rem;font-weight:700;color:#fff;margin-bottom:8px;">${title}</h3>
          <p style="font-size:0.875rem;color:#B7C5D8;margin-bottom:24px;line-height:1.5;">${message}</p>
          <div style="display:flex;gap:10px;">
            <button class="c-no" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#B7C5D8;font-size:0.9375rem;font-weight:600;cursor:pointer;">${cancelText}</button>
            <button class="c-yes" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(90deg,#3B82F6,#4CC8A4);color:#fff;font-size:0.9375rem;font-weight:700;cursor:pointer;">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('.c-yes').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('.c-no').onclick = () => { overlay.remove(); resolve(false); };
      overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
  }

  function showPromptModal(title, defaultValue = '', placeholder = '') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px;';
      overlay.innerHTML = `
        <div style="background:#203A57;border-radius:24px;padding:32px 24px;max-width:380px;width:100%;text-align:center;border:1px solid rgba(255,255,255,0.08);">
          <h3 style="font-size:1.125rem;font-weight:700;color:#fff;margin-bottom:16px;">${title}</h3>
          <input class="p-input" type="text" value="${defaultValue}" placeholder="${placeholder}" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;font-size:1rem;text-align:center;margin-bottom:16px;">
          <div style="display:flex;gap:10px;">
            <button class="p-no" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#B7C5D8;font-size:0.9375rem;font-weight:600;cursor:pointer;">Cancelar</button>
            <button class="p-yes" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(90deg,#3B82F6,#4CC8A4);color:#fff;font-size:0.9375rem;font-weight:700;cursor:pointer;">Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const inp = overlay.querySelector('.p-input');
      setTimeout(() => inp?.focus(), 100);
      overlay.querySelector('.p-yes').onclick = () => { const v = inp?.value; overlay.remove(); resolve(v); };
      overlay.querySelector('.p-no').onclick = () => { overlay.remove(); resolve(null); };
      inp?.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = inp?.value; overlay.remove(); resolve(v); } });
      overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
    });
  }

  function showSmsModal(msg, waNum, onSendSms) {
    var isSending = false;
    
    // Remove modais SMS anteriores para evitar empilhamento
    document.querySelectorAll('.sms-modal-overlay').forEach(function(el){ el.remove(); });
    
    const overlay = document.createElement('div');
    overlay.className = 'sms-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:#203A57;border-radius:24px;padding:28px 20px;max-width:440px;width:100%;border:1px solid rgba(255,255,255,0.08);box-shadow:0 30px 80px rgba(0,0,0,0.45);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h3 style="font-size:1.125rem;font-weight:700;color:#fff;margin:0;">📩 Mensagem SMS</h3>
          <button class="s-close" style="background:none;border:none;color:#B7C5D8;font-size:1.25rem;cursor:pointer;padding:4px;">✕</button>
        </div>
        <textarea class="s-msg" style="width:100%;min-height:200px;background:rgba(0,0,0,0.25);border-radius:16px;padding:16px;margin-bottom:16px;font-size:0.875rem;color:#e2e8f0;line-height:1.6;white-space:pre-wrap;word-break:break-word;text-align:left;resize:vertical;border:1px solid rgba(255,255,255,0.1);font-family:inherit;">${escHtml(msg)}</textarea>
        <div class="s-status" style="display:none;font-size:0.8rem;color:#B7C5D8;text-align:center;padding:8px;margin-bottom:8px;background:rgba(0,0,0,0.15);border-radius:12px;"></div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="s-wa" style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(90deg,#25D366,#128C7E);color:#fff;font-size:0.9375rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">Enviar no WhatsApp</button>
          <button class="s-copy" style="width:100%;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#B7C5D8;font-size:0.9375rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">Copiar Mensagem</button>
          ${onSendSms ? `<button class="s-sms" style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(90deg,#3B82F6,#4CC8A4);color:#fff;font-size:0.9375rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">📨 Enviar SMS</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(overlay);

    var txtMsg = overlay.querySelector('.s-msg');
    var statusEl = overlay.querySelector('.s-status');

    // Fecha com 1 clique no X ou no fundo
    var close = function(){ overlay.remove(); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    overlay.querySelector('.s-close').onclick = function() { close(); };

    overlay.querySelector('.s-wa').addEventListener('click', function(e) {
      e.stopPropagation();
      var texto = txtMsg ? txtMsg.value : msg;
      var waLink = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(texto);
      window.open(waLink, '_blank');
      close();
    });

    overlay.querySelector('.s-copy').addEventListener('click', async function(e) {
      e.stopPropagation();
      var texto = txtMsg ? txtMsg.value : msg;
      try {
        await navigator.clipboard.writeText(texto);
        const btn = overlay.querySelector('.s-copy');
        btn.textContent = '✓ Copiado!';
        btn.style.background = 'rgba(16,185,129,0.2)';
        btn.style.borderColor = '#10B981';
        btn.style.color = '#10B981';
        setTimeout(close, 1200);
      } catch {
        const btn = overlay.querySelector('.s-copy');
        btn.textContent = 'Erro ao copiar';
        btn.style.color = '#EF4444';
      }
    });

    if (onSendSms) {
      var smsBtn = overlay.querySelector('.s-sms');
      smsBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        if (isSending) return;
        isSending = true;
        var texto = txtMsg ? txtMsg.value : msg;
        smsBtn.disabled = true;
        smsBtn.textContent = '⏳ Enviando...';
        statusEl.style.display = '';
        statusEl.textContent = '⏳ Enviando SMS...';
        try {
          await onSendSms(texto);
          statusEl.textContent = '✅ SMS enviado com sucesso!';
          statusEl.style.color = '#10B981';
          setTimeout(close, 1200);
        } catch (err) {
          statusEl.textContent = '❌ Erro: ' + (err.message || 'Falha ao enviar');
          statusEl.style.color = '#EF4444';
          smsBtn.disabled = false;
          smsBtn.textContent = '📨 Enviar SMS';
          isSending = false;
        }
      });
    }
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderPagination(totalPages, current, onChange) {
    if (totalPages <= 1) return '';
    let html = '<div class="pagination">';
    html += `<button data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}>◀</button>`;
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);
    if (start > 1) html += `<button data-page="1">1</button>${start > 2 ? '<span style="color:var(--color-text-muted);font-size:0.78rem;">…</span>' : ''}`;
    for (let i = start; i <= end; i++) {
      html += `<button data-page="${i}" class="${i === current ? 'active' : ''}">${i}</button>`;
    }
    if (end < totalPages) html += `${end < totalPages - 1 ? '<span style="color:var(--color-text-muted);font-size:0.78rem;">…</span>' : ''}<button data-page="${totalPages}">${totalPages}</button>`;
    html += `<button data-page="${current + 1}" ${current >= totalPages ? 'disabled' : ''}>▶</button>`;
    html += '</div>';
    return html;
  }

  function initApp() {
    const isOperator = currentUser && currentUser.role === 'operador';

    const navItems = isOperator ? [
      { key: 'fichas', icon: '📋', label: 'Fichas CredVale' },
      { key: 'online', icon: '🟢', label: 'Online' },
    ] : [
      { key: 'dashboard', icon: '📊', label: 'Dashboard' },
      { key: 'separator-geral', separator: true, label: 'GERENCIAR' },
      { key: 'configuracoes', icon: '⚙️', label: 'Configurações' },
      { key: 'aplicativo', icon: '📱', label: 'Aplicativo' },
      { key: 'pagamento-config', icon: '🟢', label: 'PIX' },

      { key: 'sms', icon: '📨', label: 'SMS' },
      { key: 'pagamentos', icon: '💳', label: 'Pagamentos' },
      { key: 'clients', icon: '👥', label: 'Clientes' },
      { key: 'online', icon: '🟢', label: 'Online' },
      { key: 'separator-sistema', separator: true, label: 'SISTEMA' },
      { key: 'api', icon: '🔑', label: 'API CPF' },
      { key: 'notificacoes', icon: '🔔', label: 'Notificações' },
      { key: 'usuarios', icon: '👤', label: 'Usuários' },
      { key: 'logs-sistema', icon: '📋', label: 'Logs Sistema' },
      { key: 'trocar-senha', icon: '🔐', label: 'Trocar Senha' },
    ];

    var brand = $('#adminSidebar .admin-sidebar__brand span');
    if (brand && isOperator) brand.textContent = '📋 Fichas CredVale';

    const nav = $('#adminNav');
    nav.innerHTML = navItems
      .map(item => item.separator
        ? `<div class="admin-nav__separator">${item.label}</div>`
        : `<a href="#" class="admin-nav__link" data-route="${item.key}"><span class="admin-nav__icon">${item.icon}</span>${item.label}</a>`)
      .join('');

    $$('.admin-nav__link[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.route);
      });
    });

    const menuToggle = $('#menuToggle');
    show(menuToggle);
    menuToggle.addEventListener('click', () => {
      $('#adminSidebar').classList.toggle('admin-sidebar--open');
    });

    $('#btnLogout').addEventListener('click', async () => {
      if (await showConfirmModal('Sair', 'Tem certeza que deseja sair?', 'Sair', 'Cancelar')) {
        clearToken(); location.reload();
      }
    });

    window.addEventListener('hashchange', () => {
      const route = location.hash.replace('#', '') || 'dashboard';
      navigateTo(route);
    });

    const defaultRoute = isOperator ? 'fichas' : 'dashboard';
    const initialRoute = location.hash.replace('#', '') || defaultRoute;
    navigateTo(initialRoute);
  }

  function navigateTo(route) {
    currentRoute = route;
    location.hash = '#' + route;
    $$('.admin-nav__link').forEach(a => a.classList.toggle('admin-nav__link--active', a.dataset.route === route));
    renderRoute(route);
  }

  async function renderRoute(route) {
    const main = $('#adminMain');
    const authed = await checkAuth();
    if (!authed) return;
    main.innerHTML = '<div class="loading-spinner">Carregando…</div>';
    try {
      var isOp = currentUser && currentUser.role === 'operador';
      if (isOp && route === 'fichas') { await renderFichas(main); return; }
      if (isOp && route !== 'online') { await renderFichas(main); return; }
      switch (route) {
        case 'dashboard': await renderDashboard(main); break;
        case 'configuracoes': await renderConfiguracoes(main); break;
        case 'aplicativo': await renderAplicativo(main); break;
        case 'pagamento-config': await renderPagamentoConfig(main); break;

        case 'sms': await renderSmsPage(main); break;
        case 'pagamentos': await renderPagamentos(main); break;
        case 'clients': await renderClients(main, null, isOp); break;
        case 'fichas':
        case 'online': renderOnline(main); break;
        case 'api': await renderApiPage(main); break;
        case 'notificacoes': await renderNotificacoes(main); break;
        case 'usuarios': await renderUsuarios(main); break;
        case 'logs-sistema': await renderLogsSistema(main); break;
        case 'trocar-senha': await renderTrocarSenha(main); break;
        default: main.innerHTML = '<p>Módulo não encontrado</p>';
      }
    } catch (err) {
      main.innerHTML = `<div style="color:#DC2626; padding:40px;">Erro: ${err.message}</div>`;
    }
  }

  async function renderDashboard(container) {
    const data = await API.getDashboard();
    const k = data.kpis;
    var onlineOnline = data.onlineSessionList || [];
    var visitantes = onlineOnline.filter(function(s){ return !s.nome; });
    var clientesOnline = onlineOnline.filter(function(s){ return s.nome; });
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">Dashboard</h1>
        <button class="btn btn--danger btn--sm" onclick="zerarContadores()" title="Zera PIX, Push, visitantes e page views — mantém clientes">🧹 Limpar Dashboard</button>
      </header>
      <div class="admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 24px;">
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.2);">
          <div class="admin-card__label">Total de Clientes</div>
          <div class="admin-card__value" style="font-size:2rem;">${k.totalClients}</div>
        </article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.2);">
          <div class="admin-card__label">Visitantes Online</div>
          <div class="admin-card__value" style="font-size:2rem;color:#f59e0b;">${k.onlineSessions ?? 0}</div>
          <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;">usuários ativos agora</div>
        </article>

        <article class="admin-card" style="background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.05));border:1px solid rgba(139,92,246,0.2);">
          <div class="admin-card__label">Visitantes na Tela</div>
          <div class="admin-card__value" style="font-size:2rem;color:#a78bfa;">${visitantes.length}</div>
          <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;max-height:80px;overflow-y:auto;">${visitantes.length ? visitantes.map(function(s){ return '<div style="padding:1px 0;">' + (s.dispositivo||'') + (s.modelo ? ' ' + s.modelo : '') + '</div>'; }).join('') : '<span style="font-style:italic;">Nenhum</span>'}</div>
        </article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(236,72,153,0.12),rgba(236,72,153,0.05));border:1px solid rgba(236,72,153,0.2);">
          <div class="admin-card__label">Clientes Online</div>
          <div class="admin-card__value" style="font-size:2rem;color:#f472b6;">${clientesOnline.length}</div>
          <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;max-height:80px;overflow-y:auto;">${clientesOnline.length ? clientesOnline.map(function(s){ return '<div style="padding:1px 0;">' + (s.nome||'') + (s.dispositivo ? ' · ' + s.dispositivo : '') + '</div>'; }).join('') : '<span style="font-style:italic;">Nenhum</span>'}</div>
        </article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.2);">
          <div class="admin-card__label">Visitas Totais</div>
          <div class="admin-card__value" style="font-size:2rem;color:#f59e0b;">${k.pageViewCount ?? 0}</div>
        </article>
      </div>
      <section class="admin-card" style="grid-column:1/-1; margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 class="admin-form__section-title" style="margin:0;">Últimos cadastros</h2>
          <button class="btn btn--primary btn--sm" onclick="navigateTo('clients')">Ver todos →</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>WhatsApp</th><th>Dispositivo</th><th>Modelo</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>${data.recentClients.map(function(c) {
              var isOnline = onlineOnline.some(function(s){ return s.cpf && c.cpf && s.cpf.replace(/\D/g,'') === c.cpf.replace(/\D/g,''); });
              var disp = c.dispositivo || '—';
              var modelo = c.modelo || '—';
              var fab = c.fabricante ? c.fabricante : '';
              return '<tr>' +
                '<td>' + (isOnline ? '<span class="online-dot" style="margin-right:6px;vertical-align:middle;"></span>' : '') + c.nome + '</td>' +
                '<td>' + formatCpf(c.cpf) + '</td>' +
                '<td>' + (c.whatsapp || '—') + '</td>' +
                '<td style="font-size:0.75rem;">' + disp + '</td>' +
                '<td style="font-size:0.75rem;color:var(--color-text-muted);">' + (fab ? fab + ' ' : '') + modelo + '</td>' +
                '<td>' + fmtDate(c.created_at) + '</td>' +
                '<td><span class="badge badge--' + statusColor(c.status) + '">' + c.status + '</span></td>' +
                '<td><button class="admin-btn-icon" onclick="viewClient(\'' + c.id + '\')" title="Ver detalhes">👁️</button></td>' +
              '</tr>';
            }).join('')}
          </tbody></table>
        </div>
      </section>

    `;
  }

  function renderOnline(container) {
    var tbodyId = 'onlineTbody' + Date.now();
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">🟢 Usuários Online</h1>
        <span style="font-size:0.8125rem;color:var(--color-text-light);">Atualização automática a cada 5s</span>
      </header>
      <section class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Status</th><th>Nome</th><th>CPF</th><th>Etapa</th><th>Tempo</th><th>Dispositivo</th><th>SO / Nav</th><th>IP / Origem</th></tr></thead>
            <tbody id="${tbodyId}"><tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);">Carregando...</td></tr></tbody>
          </table>
        </div>
      </section>
      <section class="admin-card" style="margin-top:16px;">
        <h2 class="admin-form__section-title" style="margin:0 0 8px;">⏳ Sessões Recentes (24h)</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>Etapa Final</th><th>Duração</th><th>Dispositivo</th><th>IP</th></tr></thead>
            <tbody id="recentTbody"><tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);">Carregando...</td></tr></tbody>
          </table>
        </div>
      </section>
    `;
    var poll = function(){
      API.getActiveSessions().then(function(d){
        var tb = document.getElementById(tbodyId);
        if (!tb) return;
        if (!d.sessions || !d.sessions.length) {
          tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:24px;">Nenhum usuário online no momento</td></tr>';
        } else {
          tb.innerHTML = d.sessions.map(function(s){
            var tempo = '';
            try { var min = Math.floor((Date.now() - new Date(s.started_at+'Z').getTime()) / 60000); tempo = min + 'm'; if (min < 1) tempo = '<1m'; } catch(e){ tempo = '—'; }
            var ultAtv = '';
            try { var sec = Math.floor((Date.now() - new Date(s.last_activity+'Z').getTime()) / 1000); ultAtv = sec + 's'; if (sec > 120) ultAtv = Math.floor(sec/60) + 'm'; } catch(e){ ultAtv = '—'; }
            var disp = s.dispositivo || '—';
            if (s.modelo && s.dispositivo !== 'iPhone') disp += ' · ' + s.modelo;
            var fab = s.fabricante ? s.fabricante + ' ' : '';
            return '<tr>' +
              '<td><span style="display:inline-flex;align-items:center;gap:6px;color:#16C65B;font-weight:600;"><span class="online-dot"></span> Online</span></td>' +
              '<td><strong>' + (s.nome || 'Visitante') + '</strong></td>' +
              '<td style="font-family:monospace;font-size:0.75rem;">' + (s.cpf || '—') + '</td>' +
              '<td><span class="badge badge--primary" style="font-size:0.7rem;">' + (s.stage || '—') + '</span></td>' +
              '<td style="font-size:0.75rem;color:var(--color-text-muted);">' + tempo + ' / ' + ultAtv + '</td>' +
              '<td style="font-size:0.75rem;">' + fab + disp + '</td>' +
              '<td style="font-size:0.7rem;color:var(--color-text-muted);">' + (s.os || '—') + '<br>' + (s.navegador || '—') + '</td>' +
              '<td style="font-size:0.7rem;color:var(--color-text-muted);font-family:monospace;">' + (s.ip || '—') + '<br>' + (s.origem ? s.origem.slice(0, 40) : '—') + '</td>' +
            '</tr>';
          }).join('');
        }
        var rt = document.getElementById('recentTbody');
        if (rt && d.recent) {
          rt.innerHTML = d.recent.map(function(s){
            var dur = '';
            try {
              var start = new Date(s.started_at+'Z').getTime();
              var end = s.offline_at ? new Date(s.offline_at+'Z').getTime() : Date.now();
              var min = Math.floor((end - start) / 60000);
              dur = min + 'm';
            } catch(e){ dur = '—'; }
            return '<tr>' +
              '<td>' + (s.nome || 'Visitante') + '</td>' +
              '<td style="font-family:monospace;font-size:0.75rem;">' + (s.cpf || '—') + '</td>' +
              '<td><span class="badge badge--' + (s.stage === 'Cadastro Aprovado' ? 'success' : '') + '" style="font-size:0.7rem;">' + (s.stage || '—') + '</span></td>' +
              '<td style="font-size:0.75rem;color:var(--color-text-muted);">' + dur + '</td>' +
              '<td style="font-size:0.75rem;">' + (s.dispositivo || '—') + '</td>' +
              '<td style="font-size:0.7rem;color:var(--color-text-muted);font-family:monospace;">' + (s.ip || '—') + '</td>' +
            '</tr>';
          }).join('');
        }
        if (!tb) { clearInterval(pollInt); }
      }).catch(function(){});
    };
    poll();
    var pollInt = setInterval(poll, 5000);
    // Also pulse animation style
    if (!document.getElementById('onlinePulseStyle')) {
      var st = document.createElement('style');
      st.id = 'onlinePulseStyle';
      st.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}';
      document.head.appendChild(st);
    }
    // Store interval ref to clean up later
    container._pollInt = pollInt;
    // Observar para limpar se o container for removido
    var obs = new MutationObserver(function(){
      if (!document.body.contains(container)) { clearInterval(pollInt); obs.disconnect(); }
    });
    obs.observe(container.parentNode || document.body, {childList:true});
  }

  async function viewClient(id) {
    try {
      const data = await API.getClient(id);
      const c = data.client;
      const reqs = data.requests || [];
      const pays = data.payments || [];
      const main = $('#adminMain');
      var devIcon = '💻';
      if (c.dispositivo === 'Android' || c.dispositivo === 'Celular') devIcon = '📱';
      else if (c.dispositivo === 'iPhone') devIcon = '📱';
      var waLink = c.whatsapp ? 'https://wa.me/' + c.whatsapp.replace(/\D/g, '') : null;

      var browserLabel = c.navegador || '—';
      if (c.navegador && c.navegador_versao) browserLabel += ' ' + c.navegador_versao;

      main.innerHTML = `
        <header class="admin-header" style="margin-bottom:16px;">
          <h1 class="admin-header__title">👤 ${c.nome}</h1>
          <div style="display:flex;gap:8px;">
            ${waLink ? '<a href="' + waLink + '" target="_blank" class="btn btn--success btn--sm" style="text-decoration:none;">💬 WhatsApp</a>' : ''}
            ${c.status === 'aprovado' ? '<button class="btn btn--primary btn--sm" data-action="sms-from-client" style="cursor:pointer;">📩 SMS</button>' : ''}
            <button class="btn btn--primary btn--sm" onclick="navigateTo('clients')">← Voltar</button>
          </div>
        </header>
        <div class="admin-grid" style="grid-template-columns:1fr 1fr 1fr;">
          <section class="admin-card">
            <h2 class="admin-form__section-title">Dados do Cliente</h2>
            <div style="display:grid;gap:8px;font-size:0.85rem;">
              <div><strong>CPF:</strong> ${formatCpf(c.cpf)}</div>
              <div><strong>WhatsApp:</strong> ${c.whatsapp || '—'}</div>
              <div><strong>E-mail:</strong> ${c.email || '—'}</div>
              <div><strong>Status:</strong> <span class="badge badge--${statusColor(c.status)}">${c.status}</span></div>
              <div><strong>Limite:</strong> ${c.limite_aprovado ? fmtMoney(c.limite_aprovado) : '—'}</div>
              <div><strong>Plano:</strong> ${c.plano_escolhido === 'plano_166' ? '<span style="color:#4CC8A4;font-weight:700;">✅ Com Plano (R$ 1,66/mês)</span>' : c.plano_escolhido === 'sem_plano' ? '<span style="color:#94a3b8;">Sem Plano</span>' : '<span style="color:#f59e0b;">⏳ Aguardando escolha</span>'}</div>
              <div><strong>Credencial:</strong> ${c.senha_visivel ? '<span style="color:#10B981;font-weight:600;">✅ ' + c.senha_visivel + '</span>' : c.senha_hash ? '<span style="color:#10B981;font-weight:600;">✅ Criada</span>' : '<span style="color:#94a3b8;">—</span>'}</div>
              <div><strong>Cadastro:</strong> ${fmtDateTime(c.created_at)}</div>
            </div>
          </section>
          <section class="admin-card">
            <h2 class="admin-form__section-title">Dispositivo</h2>
            <div style="display:grid;gap:8px;font-size:0.85rem;">
              <div><strong>Tipo de dispositivo:</strong> ${devIcon} ${c.dispositivo || '—'}</div>
              <div><strong>Fabricante:</strong> ${c.fabricante || '—'}</div>
              <div><strong>Modelo:</strong> ${c.modelo || '—'}</div>
              <div><strong>Sistema Operacional:</strong> ${c.os || (c.dispositivo === 'iPhone' ? 'iOS' : '') || '—'}</div>
              <div><strong>Navegador:</strong> ${browserLabel}</div>
              <div><strong>Primeiro acesso:</strong> ${c.dispositivo_identificado_em ? fmtDateTime(c.dispositivo_identificado_em) : (c.created_at ? fmtDateTime(c.created_at) : '—')}</div>
              <div><strong>Última atividade:</strong> ${c.dispositivo_atualizado_em ? fmtDateTime(c.dispositivo_atualizado_em) : (c.updated_at ? fmtDateTime(c.updated_at) : '—')}</div>
              ${c.status === 'aprovado' && c.whatsapp ? `<div style="margin-top:10px;"><button class="btn btn--primary btn--sm" data-action="resend-shortcode" data-id="${c.id}" data-nome="${c.nome}" data-whatsapp="${c.whatsapp || ''}" title="Reenviar Short Code">📨 Reenviar Short Code</button></div>` : ''}
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
                <div><strong>Tentou baixar o aplicativo:</strong></div>
                <div style="margin-top:4px;">${c.download_clicked_at ? '<span style="color:#10B981;font-weight:600;">🟢 Sim</span><br><span style="font-size:0.75rem;color:var(--color-text-muted);">Último clique: ' + fmtDateTime(c.download_clicked_at) + '</span>' : '<span style="color:#94a3b8;">⚪ Não</span>'}</div>
              </div>
            </div>
          </section>
          <section class="admin-card">
            <h2 class="admin-form__section-title">Endereço</h2>
            <div style="display:grid;gap:8px;font-size:0.85rem;">
              <div>${c.rua || '—'}, ${c.numero || '—'}${c.complemento ? ' - ' + c.complemento : ''}</div>
              <div>${c.bairro || '—'}, ${c.cidade || '—'} - ${c.uf || '—'}</div>
              <div>CEP: ${c.cep || '—'}</div>
            </div>
          </section>
        </div>
        <section class="admin-card" style="margin-top:16px;">
          <h2 class="admin-form__section-title">📝 Anotações</h2>
          <textarea id="clientNotes" style="width:100%;min-height:130px;background:#FFFFFF;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.85rem;color:#000000;line-height:1.5;white-space:pre-wrap;word-break:break-word;text-align:left;resize:vertical;border:1px solid #D1D5DB;font-family:inherit;" placeholder="Digite aqui suas anotações sobre este cliente..."></textarea>
          <div style="display:flex;align-items:center;gap:12px;">
            <button id="btnSaveNotes" class="btn btn--primary">💾 Salvar</button>
            <div id="notesStatus" style="font-size:0.8rem;color:#10B981;display:none;"></div>
          </div>
        </section>
      `;
      var smsBtn = main.querySelector('[data-action="sms-from-client"]');
      if (smsBtn) {
        smsBtn.addEventListener('click', async function() {
          var settings = await API.getSettings();
          var linkApp = (settings.settings && settings.settings.sms_app_link) || 'https://app.credvale.com.br';
          var nome = c.nome || 'Cliente';
          var limite = fmtMoney(parseFloat(c.limite_aprovado) || 0);
          var msg = fillSmsTemplate(nome, limite, linkApp);
          var numero = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
          showSmsModal(msg, numero);
        });
      }

      // 📝 Carregar anotações
      // Placeholder style
      if (!document.getElementById('notesPlaceholderStyle')) {
        var ps = document.createElement('style');
        ps.id = 'notesPlaceholderStyle';
        ps.textContent = '#clientNotes::placeholder{color:#6B7280;opacity:1}';
        document.head.appendChild(ps);
      }
      var notesTextarea = document.getElementById('clientNotes');
      if (notesTextarea) {
        API.getClientNotes(id).then(function(notesData) {
          notesTextarea.value = notesData.observacoes || '';
        }).catch(function() {});

        var saveBtn = document.getElementById('btnSaveNotes');
        var notesStatus = document.getElementById('notesStatus');
        if (saveBtn) {
          saveBtn.addEventListener('click', async function() {
            var texto = notesTextarea.value;
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Salvando...';
            notesStatus.style.display = 'none';
            try {
              await API.saveClientNotes(id, texto);
              notesStatus.style.display = '';
              notesStatus.textContent = '✅ Anotação salva com sucesso';
              notesStatus.style.color = '#10B981';
              setTimeout(function() { notesStatus.style.display = 'none'; }, 3000);
            } catch (err) {
              notesStatus.style.display = '';
              notesStatus.textContent = '❌ Erro: ' + (err.message || 'Falha ao salvar');
              notesStatus.style.color = '#EF4444';
            } finally {
              saveBtn.disabled = false;
              saveBtn.textContent = '💾 Salvar';
            }
          });
        }
      }
    } catch (e) {
      showToast('Erro ao carregar cliente: ' + e.message, 'error');
    }
  }

  async function renderAplicativo(container) {
    const data = await API.request('GET', '/app/versions');
    const active = await API.request('GET', '/app/active');

    const activeId = active.active ? active.id : null;
    const activeVersion = data.find(v => v.id === activeId) || null;

    function fmtSize(bytes) {
      if (!bytes || bytes === 0) return '—';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i];
    }

    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📱 Gerenciamento do Aplicativo</h1>
      </header>

      <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:20px;line-height:1.5;">Faça o upload de uma nova versão do aplicativo ou informe um link externo para download.</p>

      <!-- Active Version Card -->
      <section class="admin-card" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title" style="margin-bottom:12px;">✅ Versão Ativa</h2>
        ${activeVersion ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem;">
          <div><span style="color:var(--color-text-muted);">Arquivo:</span> <strong>${activeVersion.original_name || '—'}</strong></div>
          <div><span style="color:var(--color-text-muted);">Versão:</span> <strong>${activeVersion.version || '—'}</strong></div>
          <div><span style="color:var(--color-text-muted);">Tamanho:</span> <strong>${fmtSize(activeVersion.file_size)}</strong></div>
          <div><span style="color:var(--color-text-muted);">Enviado em:</span> <strong>${fmtDateTime(activeVersion.created_at)}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--color-text-muted);">Origem:</span> <strong>${activeVersion.external_link ? '🔗 Link Externo' : (activeVersion.file_path ? '📦 Upload' : '—')}</strong></div>
          ${activeVersion.external_link ? `<div style="grid-column:1/-1;"><span style="color:var(--color-text-muted);">Link:</span> <a href="${activeVersion.external_link}" target="_blank" style="color:var(--color-primary);">${activeVersion.external_link}</a></div>` : ''}
        </div>
        <div style="margin-top:10px;"><span class="badge badge--success" style="font-size:0.78rem;">🟢 Ativo</span></div>
        ` : '<p style="color:var(--color-text-muted);font-size:0.85rem;">Nenhuma versão ativa no momento.</p>'}
      </section>

      <!-- Upload Section -->
      <section class="admin-card admin-form" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">📤 Upload do Aplicativo</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Arraste o arquivo ou clique para selecionar. Formatos aceitos: .apk, .aab, .ipa (máx. 300MB)</p>
        <div id="appDropZone" style="border:2px dashed rgba(255,255,255,0.12);border-radius:16px;padding:32px;text-align:center;background:rgba(255,255,255,0.02);cursor:pointer;transition:all 0.2s;">
          <div style="font-size:2rem;margin-bottom:8px;">📦</div>
          <div id="appDropText" style="font-size:0.85rem;color:var(--color-text-muted);">Clique ou arraste o arquivo aqui</div>
          <div id="appFileInfo" style="display:none;font-size:0.85rem;color:var(--color-text-light);margin-top:8px;"></div>
          <input type="file" id="appFileInput" accept=".apk,.aab,.ipa" style="display:none;">
        </div>
        <div class="form-grid" style="margin-top:16px;">
          <div class="form-group form-group--full">
            <label>Versão (opcional)</label>
            <input type="text" id="appVersionInput" placeholder="Ex: 2.1.0" style="max-width:200px;">
          </div>
        </div>
        <button id="btnUploadApp" class="btn btn--primary" style="margin-top:var(--space-lg);" disabled>📤 Enviar Aplicativo</button>
        <div id="appUploadProgress" style="display:none;margin-top:12px;">
          <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
            <div id="appProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#3B82F6,#4CC8A4);border-radius:3px;transition:width 0.3s;"></div>
          </div>
          <div id="appProgressText" style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Enviando...</div>
        </div>
      </section>

      <!-- External Link Section -->
      <section class="admin-card admin-form" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">🔗 Link Externo (opcional)</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Caso seja informado um link externo (Google Play, App Store, CDN etc.), este terá prioridade sobre o arquivo hospedado.</p>
        <div class="form-group form-group--full">
          <input type="url" id="appExternalLink" value="${activeVersion?.external_link || ''}" placeholder="https://play.google.com/store/apps/details?id=com.credvale.app">
        </div>
        <button id="btnSaveAppLink" class="btn btn--primary" style="margin-top:var(--space-lg);">💾 Salvar Link</button>
      </section>

      <!-- Version History -->
      <section class="admin-card">
        <h2 class="admin-form__section-title" style="margin-bottom:12px;">📋 Histórico de Versões</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Versão</th>
                <th>Arquivo</th>
                <th>Data</th>
                <th>Tamanho</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);font-size:0.85rem;">Nenhuma versão encontrada</td></tr>' : ''}
              ${data.map(v => `
                <tr>
                  <td><strong>${v.version || '—'}</strong></td>
                  <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v.original_name || (v.external_link ? '🔗 Link' : '—')}</td>
                  <td>${fmtDateTime(v.created_at)}</td>
                  <td>${fmtSize(v.file_size)}</td>
                  <td><span class="badge badge--${v.file_type === 'apk' ? 'primary' : 'secondary'}">${v.file_type.toUpperCase()}</span></td>
                  <td>${v.status === 'active' ? '<span class="badge badge--success">Ativo</span>' : '<span class="badge badge--ghost">Arquivado</span>'}</td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      ${v.status !== 'active' ? `<button class="btn btn--sm btn--primary btnActivate" data-id="${v.id}" title="Ativar">✅</button>` : ''}
                      ${v.file_path ? `<button class="btn btn--sm btn--ghost btnDownload" data-id="${v.id}" title="Baixar">⬇️</button>` : ''}
                      <button class="btn btn--sm btn--danger btnDelete" data-id="${v.id}" title="Excluir">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    // Upload drag & drop
    const dropZone = $('#appDropZone');
    const fileInput = $('#appFileInput');
    const dropText = $('#appDropText');
    const fileInfo = $('#appFileInfo');
    const uploadBtn = $('#btnUploadApp');
    const verInput = $('#appVersionInput');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#4CC8A4'; dropZone.style.background = 'rgba(76,200,164,0.05)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'rgba(255,255,255,0.12)'; dropZone.style.background = 'rgba(255,255,255,0.02)'; });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = 'rgba(255,255,255,0.12)'; dropZone.style.background = 'rgba(255,255,255,0.02)'; if (e.dataTransfer.files.length) fileInput.files = e.dataTransfer.files; handleFile(); });

    fileInput.addEventListener('change', handleFile);
    function handleFile() {
      const file = fileInput.files[0];
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['apk', 'aab', 'ipa'].includes(ext)) { showToast('Tipo de arquivo não permitido', 'error'); fileInput.value = ''; return; }
      dropText.style.display = 'none';
      fileInfo.style.display = '';
      fileInfo.innerHTML = '📄 <strong>' + file.name + '</strong> (' + fmtSize(file.size) + ')';
      uploadBtn.disabled = false;
    }

    uploadBtn.addEventListener('click', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = '⏳ Enviando...';

      const prog = $('#appUploadProgress');
      const bar = $('#appProgressBar');
      const progText = $('#appProgressText');
      prog.style.display = '';

      try {
        const formData = new FormData();
        formData.append('app_file', file);
        if (verInput.value) formData.append('version', verInput.value);

        const token = getToken();
        const base = API.getApiUrl ? API.getApiUrl().replace(/\/api$/,'') + '/api' : window.__API_BASE || '/api';
        const resp = await fetch(base + '/app/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData
        });
        if (!resp.ok) { const err = await resp.json(); throw new Error(err.error || 'Erro no upload'); }
        await resp.json();
        showToast('Aplicativo enviado com sucesso!');
        navigateTo('aplicativo');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
        prog.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📤 Enviar Aplicativo';
      }
    });

    // Save external link
    $('#btnSaveAppLink').addEventListener('click', async () => {
      const url = $('#appExternalLink').value.trim();
      if (!url) { showToast('Informe uma URL', 'error'); return; }
      try {
        await API.request('PUT', '/app/external-link', { url });
        showToast('Link externo salvo!');
        navigateTo('aplicativo');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });

    // Activate version
    $$('.btnActivate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!await showConfirmModal('Ativar versão', 'Tem certeza que deseja ativar esta versão?', 'Ativar', 'Cancelar')) return;
        try {
          await API.request('PUT', '/app/versions/' + id + '/activate');
          showToast('Versão ativada!');
          navigateTo('aplicativo');
        } catch (e) {
          showToast('Erro: ' + e.message, 'error');
        }
      });
    });

    // Download version
    $$('.btnDownload').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const token = getToken();
        const base = API.getApiUrl ? API.getApiUrl().replace(/\/api$/,'') + '/api' : window.__API_BASE || '/api';
        window.open(base + '/app/download/' + id + '?token=' + token, '_blank');
      });
    });

    // Delete version
    $$('.btnDelete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!await showConfirmModal('Excluir versão', 'Tem certeza que deseja excluir esta versão? Esta ação não pode ser desfeita.', 'Excluir', 'Cancelar')) return;
        try {
          await API.request('DELETE', '/app/versions/' + id);
          showToast('Versão excluída!');
          navigateTo('aplicativo');
        } catch (e) {
          showToast('Erro: ' + e.message, 'error');
        }
      });
    });
  }

  async function renderConfiguracoes(container) {
    const data = await API.getSettings();
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">Configurações Gerais</h1>
        <button class="btn btn--danger btn--sm" onclick="zerarSistema()" title="Remove todos os clientes, pagamentos e solicitações">🗑️ Zerar Sistema</button>
      </header>
      <section class="admin-card admin-form">
        <h2 class="admin-form__section-title">Informações da Página</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Nome do Sistema</label>
            <input type="text" id="settName" value="${data.settings.name || 'Vale Saúde'}">
          </div>
          <div class="form-group">
            <label>E-mail de Contato</label>
            <input type="email" id="settEmail" value="${data.settings.email || 'contato@valesaude.com.br'}">
          </div>
          <div class="form-group form-group--full">
            <label>WhatsApp de Suporte (com DDD, apenas números)</label>
            <input type="text" id="settWhatsapp" value="${data.settings.whatsapp || '5511999999999'}" placeholder="5511999999999">
          </div>
        </div>
        <button id="btnSaveConfig" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR</button>
      </section>
      <section class="admin-card admin-form" style="margin-top:var(--space-md);">
        <h2 class="admin-form__section-title">📞 Rodapé</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Informações exibidas no rodapé de todas as páginas.</p>
        <div class="form-grid">
          <div class="form-group">
            <label>Telefone</label>
            <input type="text" id="settFooterPhone" value="${data.settings.footer_phone || ''}" placeholder="(11) 3000-0000">
          </div>
          <div class="form-group">
            <label>E-mail</label>
            <input type="email" id="settFooterEmail" value="${data.settings.footer_email || ''}" placeholder="contato@valesaude.com.br">
          </div>
          <div class="form-group form-group--full">
            <label>CNPJ</label>
            <input type="text" id="settFooterCnpj" value="${data.settings.footer_cnpj || ''}" placeholder="XX.XXX.XXX/0001-XX">
          </div>
        </div>
        <button id="btnSaveFooter" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR RODAPÉ</button>
      </section>
      <section class="admin-card admin-form" style="margin-top:var(--space-md);">
        <h2 class="admin-form__section-title">📩 SMS — Link do Aplicativo</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Link usado na mensagem SMS enviada para clientes aprovados.</p>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Link do App</label>
            <input type="url" id="settSmsAppLink" value="${data.settings.sms_app_link || 'https://app.credvale.com.br'}" placeholder="https://app.credvale.com.br">
          </div>
        </div>
        <button id="btnSaveSms" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR SMS</button>
      </section>
      <section class="admin-card admin-form" style="margin-top:var(--space-md);">
        <h2 class="admin-form__section-title">👤 Área do Cliente</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Link usado no botão "Ativar Plano" e "Adquirir Plano" da Área do Cliente.</p>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Link da Área do Cliente</label>
            <input type="url" id="settClientAreaLink" value="${data.settings.client_area_link || ''}" placeholder="https://pagamento.exemplo.com/checkout">
          </div>
          <div class="form-group form-group--full">
            <label>Link para Pagamento do Plano</label>
            <input type="url" id="settPaymentLink" value="${data.settings.payment_link || ''}" placeholder="https://pagamento.exemplo.com/pagar-plano">
            <span style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;display:block;">Este link será usado no botão "Pagar Plano" da Área do Cliente.</span>
          </div>
        </div>
        <button id="btnSaveClientAreaLink" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR LINK</button>
        <button id="btnSavePaymentLink" class="btn btn--primary" style="margin-top:var(--space-md);">SALVAR LINK DE PAGAMENTO</button>
      </section>
      <section class="admin-card admin-form" style="margin-top:var(--space-md);">
        <h2 class="admin-form__section-title">🔒 Aviso Institucional</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Pop-up de segurança exibido automaticamente ao carregar a página inicial.</p>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px 16px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:12px;">
          <input type="checkbox" id="settSecurityPopupEnabled" ${data.settings.security_popup_enabled === 'true' ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
          <span style="font-size:0.85rem;font-weight:600;color:var(--color-text-light);">Exibir pop-up institucional ao carregar a página</span>
        </label>
        <button id="btnSaveSecurityPopup" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR</button>
      </section>
    `;
    $('#btnSaveConfig').addEventListener('click', async () => {
      try {
        await API.saveSettings({
          name: $('#settName').value,
          email: $('#settEmail').value,
          whatsapp: $('#settWhatsapp').value
        });
        showToast('Configurações salvas!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
    $('#btnSaveFooter').addEventListener('click', async () => {
      try {
        await API.saveSettings({
          footer_phone: $('#settFooterPhone').value,
          footer_email: $('#settFooterEmail').value,
          footer_cnpj: $('#settFooterCnpj').value
        });
        showToast('Rodapé salvo!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
    $('#btnSaveSms').addEventListener('click', async () => {
      try {
        await API.saveSettings({ sms_app_link: $('#settSmsAppLink').value });
        showToast('Link SMS salvo!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
    $('#btnSaveClientAreaLink').addEventListener('click', async () => {
      try {
        await API.saveSettings({ client_area_link: $('#settClientAreaLink').value });
        showToast('Link salvo!');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });
    $('#btnSavePaymentLink').addEventListener('click', async () => {
      try {
        await API.saveSettings({ payment_link: $('#settPaymentLink').value });
        showToast('Link de pagamento salvo!');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });
    $('#btnSaveSecurityPopup').addEventListener('click', async () => {
      try {
        await API.saveSettings({ security_popup_enabled: $('#settSecurityPopupEnabled').checked ? 'true' : 'false' });
        showToast('Configuração salva!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
  }

  async function renderPagamentoConfig(container) {
    const data = await API.getSettings();
    let methods = ['pix', 'card', 'boleto'];
    try { if (data.settings.payment_methods) methods = JSON.parse(data.settings.payment_methods); } catch {}
    const hasPushinpay = !!(data.settings.pushinpay_url || data.settings.pushinpay_url_virtual || data.settings.pushinpay_url_fisico || '').trim();
    const cb = (id, label, checked) =>
      `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="settMethod_${id}" value="${id}" ${checked ? 'checked' : ''}>
        <span>${label}</span>
      </label>`;
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">🟢 Configuração PIX</h1>
        ${hasPushinpay ? '<span class="badge badge--success" style="font-size:0.78rem;">PushinPay ativo</span>' : ''}
      </header>
      <section class="admin-card admin-form">
        <h2 class="admin-form__section-title">💳 Chave PIX</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Tipo de Chave</label>
            <select id="settPixType">
              <option value="cpf" ${(data.settings.pix_type||'cpf')==='cpf'?'selected':''}>CPF</option>
              <option value="telefone" ${(data.settings.pix_type||'')==='telefone'?'selected':''}>Telefone</option>
              <option value="email" ${(data.settings.pix_type||'')==='email'?'selected':''}>E-mail</option>
              <option value="aleatoria" ${(data.settings.pix_type||'')==='aleatoria'?'selected':''}>Aleatória</option>
            </select>
          </div>
          <div class="form-group">
            <label>Chave PIX</label>
            <input type="text" id="settPixKey" value="${data.settings.pix_key || ''}" placeholder="Digite a chave">
          </div>
          <div class="form-group">
            <label>Nome do Beneficiário</label>
            <input type="text" id="settPixName" value="${data.settings.pix_merchant_name || 'Vale Saúde'}" placeholder="Ex: Vale Saúde">
          </div>
          <div class="form-group">
            <label>Cidade do Beneficiário</label>
            <input type="text" id="settPixCity" value="${data.settings.pix_merchant_city || 'Sao Paulo'}" placeholder="Ex: Sao Paulo">
          </div>
        </div>
        <h2 class="admin-form__section-title" style="margin-top:var(--space-lg);">🔗 PushinPay</h2>
        <div style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;background:rgba(59,130,246,0.08);padding:12px;border-radius:8px;border:1px solid rgba(59,130,246,0.2);">
          <strong>⚠️ Importante:</strong> Quando uma URL do PushinPay estiver preenchida, o checkout exibirá <strong>apenas</strong> o botão do PushinPay — PIX convencional, cartão e boleto ficarão ocultos.
        </div>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>URL PushinPay — Cartão Virtual</label>
            <input type="url" id="settPushinpayUrlVirtual" value="${data.settings.pushinpay_url_virtual || data.settings.pushinpay_url || ''}" placeholder="https://app.pushinpay.com.br/checkout/virtual...">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Usado quando o cliente escolhe <strong>Cartão Virtual</strong> (R$ 4,99).</div>
          </div>
          <div class="form-group form-group--full">
            <label>URL PushinPay — Cartão Físico</label>
            <input type="url" id="settPushinpayUrlFisico" value="${data.settings.pushinpay_url_fisico || data.settings.pushinpay_url || ''}" placeholder="https://app.pushinpay.com.br/checkout/fisico...">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Usado quando o cliente escolhe <strong>Cartão Físico</strong> (R$ 19,99).</div>
          </div>
          <div class="form-group form-group--full">
            <label>Webhook Secret (HMAC-SHA256)</label>
            <input type="password" id="settWebhookSecret" value="${data.settings.webhook_secret || ''}" placeholder="Secret para validação HMAC">
          </div>
        <h2 class="admin-form__section-title" style="margin-top:var(--space-lg);">🔗 PunhinPay — Links de Pagamento (Novo Fluxo)</h2>
        <div style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;background:rgba(59,130,246,0.08);padding:12px;border-radius:8px;border:1px solid rgba(59,130,246,0.2);">
          <strong>⚡ Novo fluxo:</strong> Esses links são usados no <strong>pop-up de opções de pagamento pós-cadastro</strong>. Preencha ambos para que as opções fiquem disponíveis.
        </div>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Link PunhinPay — Plano + Taxa de Emissão (1º link)</label>
            <input type="url" id="settPushinpayLinkPlanoTaxa" value="${data.settings.pushinpay_link_plano_taxa || ''}" placeholder="https://app.pushinpay.com.br/checkout/plano-taxa...">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Usado na opção <strong>"Pagar Plano + Taxa de Emissão"</strong> — soma do valor do plano + R$ 8,99.</div>
          </div>
          <div class="form-group form-group--full">
            <label>Link PunhinPay — Somente Taxa de Emissão (2º link)</label>
            <input type="url" id="settPushinpayLinkSomenteTaxa" value="${data.settings.pushinpay_link_somente_taxa || ''}" placeholder="https://app.pushinpay.com.br/checkout/somente-taxa...">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Usado na opção <strong>"Pagar somente a Taxa de Emissão"</strong> — apenas R$ 8,99.</div>
          </div>
        </div>
        </div>
        <h2 class="admin-form__section-title" style="margin-top:var(--space-lg);">📋 Métodos de Pagamento</h2>
        <p style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:12px;">Marque quais opções exibir no checkout. Se PushinPay estiver ativo e configurado, <strong>apenas ele aparecerá</strong>.</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${cb('pix', 'PIX (QR Code)', methods.includes('pix'))}
          ${cb('pushinpay', 'PushinPay (Checkout externo)', methods.includes('pushinpay'))}
          ${cb('card', 'Cartão de Crédito', methods.includes('card'))}
          ${cb('boleto', 'Boleto Bancário', methods.includes('boleto'))}
        </div>
        <button id="btnSavePagamentoConfig" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR CONFIGURAÇÃO</button>
      </section>
    `;
    $('#btnSavePagamentoConfig').addEventListener('click', async () => {
      const selected = ['pix', 'pushinpay', 'card', 'boleto'].filter(id =>
        document.getElementById('settMethod_' + id).checked
      );
      try {
        await API.saveSettings({
          pix_key: $('#settPixKey').value,
          pix_type: $('#settPixType').value,
          pix_merchant_name: $('#settPixName').value,
          pix_merchant_city: $('#settPixCity').value,
          pushinpay_url: $('#settPushinpayUrlVirtual').value || $('#settPushinpayUrlFisico').value || '',
          pushinpay_url_virtual: $('#settPushinpayUrlVirtual').value,
          pushinpay_url_fisico: $('#settPushinpayUrlFisico').value,
          webhook_secret: $('#settWebhookSecret').value,
          pushinpay_link_plano_taxa: $('#settPushinpayLinkPlanoTaxa')?.value || '',
          pushinpay_link_somente_taxa: $('#settPushinpayLinkSomenteTaxa')?.value || '',
          payment_methods: JSON.stringify(selected)
        });
        showToast('Configuração salva com sucesso!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
  }


  async function renderSmsPage(container) {
    var cfg;
    try { cfg = await API.getSmsConfig(); } catch { cfg = { url: '', key: '', accounts: [], shortMessage: '', additionalNumber: '', activeAccounts: [] }; }

    var accList = cfg.accounts && cfg.accounts.length ? cfg.accounts : ['0122C371A', '0122C371B', '0122C371C', '0122C371D'];
    var activeAccs = cfg.activeAccounts && cfg.activeAccounts.length ? cfg.activeAccounts : accList;

    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📨 Envio de SMS</h1>
        <span style="font-size:0.8rem;color:var(--color-text-muted);">${cfg.url ? '✅ Conectado' : '⚠️ Configure abaixo'}</span>
      </header>

      <!-- Config -->
      <section class="admin-card admin-form" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">⚙️ Conexão com o Sistema de SMS</h2>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>URL do Sistema SMS</label>
            <input type="url" id="smsSystemUrl" value="${cfg.url}" placeholder="https://sms-sistema.up.railway.app">
          </div>
          <div class="form-group form-group--full">
            <label>API Key</label>
            <input type="password" id="smsApiKey" value="" placeholder="${cfg.key ? '******** (definida)' : 'Digite a API key'}">
          </div>
          <div class="form-group form-group--full">
            <label>Contas de SMS (uma por linha)</label>
            <textarea id="smsAccountsConfig" rows="4" style="width:100%;font-family:monospace;font-size:0.8125rem;padding:10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;">${accList.join('\n')}</textarea>
          </div>
        </div>
        <button id="btnSaveSmsConfig" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR CONFIGURAÇÃO</button>
        <button id="btnTestConnection" class="btn btn--ghost" style="margin-top:var(--space-lg);margin-left:8px;">🔌 Testar Conexão</button>
      </section>

      <!-- Active Accounts (checkboxes) -->
      <section class="admin-card admin-form" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">📱 Contas Ativas para Envio Automático</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">Marque as contas que serão usadas no envio automático de SMS. Clique em "Salvar Contas" para confirmar.</p>
        <div id="smsAccountsCheckboxes" style="display:flex;flex-wrap:wrap;gap:10px;">
          ${accList.map(function(a) {
            var checked = activeAccs.includes(a);
            return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:rgba(255,255,255,0.04);padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">' +
              '<input type="checkbox" class="sms-account-cb" value="' + a + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;">' +
              '<span style="font-size:0.85rem;font-family:monospace;">' + a + '</span>' +
            '</label>';
          }).join('')}
        </div>
        <button id="btnSaveActiveAccounts" class="btn btn--primary" style="margin-top:var(--space-lg);">💾 SALVAR CONTAS ATIVAS</button>
      </section>

      <!-- SMS Curto (auto envio na aprovação) -->
      <section class="admin-card admin-form" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">📨 SMS Curto — Envio Automático</h2>
        <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;background:rgba(59,130,246,0.08);padding:12px;border-radius:8px;border:1px solid rgba(59,130,246,0.2);">
          Esta mensagem curta (máx. 160 caracteres) será enviada <strong>automaticamente</strong> para o cliente e para o número adicional quando um cliente for <strong>aprovado</strong>.
          Use <code>{NOME}</code> e <code>{LIMITE}</code> como placeholders.
        </p>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Mensagem curta</label>
            <textarea id="smsShortMessage" maxlength="160" rows="3" style="width:100%;font-family:monospace;font-size:0.8125rem;padding:10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;" placeholder="Ex: Olá {NOME}, seu crédito de R$ {LIMITE} foi aprovado!">${(cfg.shortMessage || '').replace(/"/g,'&quot;')}</textarea>
            <div id="smsShortCounter" style="text-align:right;font-size:0.75rem;color:var(--color-text-muted);margin-top:2px;">0/160</div>
          </div>
          <div class="form-group form-group--full">
            <label>Número adicional para envio (com DDD, apenas números)</label>
            <input type="text" id="smsAdditionalNumber" value="${cfg.additionalNumber || ''}" placeholder="Ex: 5511999999999">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Se preenchido, o SMS também será enviado para este número.</div>
          </div>
        </div>
        <button id="btnSaveShortMessage" class="btn btn--primary" style="margin-top:var(--space-lg);">💾 SALVAR SMS CURTO</button>
      </section>

      <!-- Send SMS -->
      <section class="admin-card admin-form" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">📤 Enviar SMS Manual</h2>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Telefone (com DDD, apenas números)</label>
            <input type="text" id="smsPhone" placeholder="5511999999999">
          </div>
          <div class="form-group form-group--full">
            <label>Mensagem</label>
            <textarea id="smsMessage" rows="4" style="width:100%;font-family:monospace;font-size:0.8125rem;padding:10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;" placeholder="Digite a mensagem SMS..."></textarea>
          </div>
          <div class="form-group form-group--full">
            <label>Conta(s) para enviar</label>
            <select id="smsSelectedAccounts" multiple style="width:100%;padding:10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;min-height:80px;font-size:0.85rem;">
              ${accList.map(function(a){ return '<option value="' + a + '">' + a + '</option>'; }).join('')}
            </select>
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Segure Ctrl para selecionar múltiplas. Se nenhuma selecionada, usa rotação automática.</div>
          </div>
        </div>
        <button id="btnSendSms" class="btn btn--primary" style="margin-top:var(--space-lg);">📨 ENVIAR SMS</button>
        <div id="smsResult" style="display:none;margin-top:12px;padding:12px;border-radius:8px;background:rgba(0,0,0,0.08);"></div>
      </section>

      <!-- History -->
      <section class="admin-card">
        <h2 class="admin-form__section-title">📋 Últimos envios</h2>
        <div id="smsHistoryContent" style="font-size:0.85rem;color:var(--color-text-muted);">Use o formulário acima para enviar SMS. O resultado aparecerá aqui.</div>
      </section>
    `;

    var history = [];

    // Character counter
    var shortMsgEl = $('#smsShortMessage');
    var counterEl = $('#smsShortCounter');
    function updateCounter() {
      var len = (shortMsgEl.value || '').length;
      counterEl.textContent = len + '/160';
      counterEl.style.color = len > 140 ? (len > 155 ? '#EF4444' : '#F59E0B') : 'var(--color-text-muted)';
    }
    if (shortMsgEl) { updateCounter(); shortMsgEl.addEventListener('input', updateCounter); }

    $('#btnSaveSmsConfig').addEventListener('click', async function() {
      var url = $('#smsSystemUrl').value.trim();
      var key = $('#smsApiKey').value.trim();
      var accountsRaw = $('#smsAccountsConfig').value;
      var accounts = accountsRaw.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
      try {
        var payload = { sms_system_url: url };
        if (key) payload.sms_system_api_key = key;
        payload.sms_accounts = accounts;
        await API.saveSmsConfig(payload);
        showToast('Configuração salva!');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });

    $('#btnSaveActiveAccounts').addEventListener('click', async function() {
      var checked = [];
      document.querySelectorAll('.sms-account-cb').forEach(function(cb) {
        if (cb.checked) checked.push(cb.value);
      });
      if (!checked.length) { showToast('Selecione ao menos uma conta', 'error'); return; }
      try {
        await API.saveSmsConfig({ sms_active_accounts: checked });
        showToast('Contas ativas salvas!');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });

    $('#btnSaveShortMessage').addEventListener('click', async function() {
      var msg = ($('#smsShortMessage').value || '').trim();
      var addNum = ($('#smsAdditionalNumber').value || '').trim();
      if (!msg) { showToast('Digite a mensagem curta', 'error'); return; }
      if (msg.length > 160) { showToast('Mensagem excede 160 caracteres', 'error'); return; }
      try {
        await API.saveSmsConfig({ sms_short_message: msg, sms_additional_number: addNum });
        showToast('SMS curto salvo!');
      } catch (e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });

    $('#btnTestConnection').addEventListener('click', async function() {
      var url = $('#smsSystemUrl').value.trim();
      var key = $('#smsApiKey').value.trim();
      if (!url) { showToast('Configure a URL primeiro', 'error'); return; }
      try {
        var webhookUrl = url.replace(/\/+$/, '') + '/api/webhook/send';
        var resp = await fetch(webhookUrl, {
          method: 'HEAD',
          headers: { 'x-api-key': key || 'test' }
        });
        if (resp.ok) showToast('✅ Conexão OK! Servidor respondeu.');
        else showToast('⚠️ Servidor respondeu com status ' + resp.status + '. Verifique URL e chave.', 'error');
      } catch (e) {
        showToast('❌ Não foi possível conectar: ' + e.message, 'error');
      }
    });

    $('#btnSendSms').addEventListener('click', async function() {
      var phone = $('#smsPhone').value.trim();
      var message = $('#smsMessage').value.trim();
      if (!phone || !message) { showToast('Preencha telefone e mensagem', 'error'); return; }
      var select = $('#smsSelectedAccounts');
      var selected = [];
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].selected) selected.push(select.options[i].value);
      }

      var btn = $('#btnSendSms');
      btn.disabled = true;
      btn.textContent = '⏳ Enviando...';
      var resultDiv = $('#smsResult');
      resultDiv.style.display = 'none';

      try {
        var resp = await API.smsSend({ phone: phone, message: message, selectedAccounts: selected.length ? selected : undefined });
        resultDiv.style.display = '';
        resultDiv.style.background = resp.status && resp.status < 300 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
        resultDiv.style.color = resp.status && resp.status < 300 ? '#10B981' : '#EF4444';
        resultDiv.textContent = JSON.stringify(resp.data || resp, null, 2);
        if (resp.status && resp.status < 300) showToast('✅ SMS enviado com sucesso!');
        else showToast('⚠️ Resposta inesperada', 'error');

        history.unshift({
          phone: phone,
          message: message.slice(0, 80) + (message.length > 80 ? '...' : ''),
          accounts: selected.length ? selected.join(', ') : 'auto (rotação)',
          status: resp.status && resp.status < 300 ? 'sucesso' : 'falha',
          time: new Date().toLocaleString('pt-BR')
        });
        renderHistory();
      } catch (e) {
        resultDiv.style.display = '';
        resultDiv.style.background = 'rgba(239,68,68,0.1)';
        resultDiv.style.color = '#EF4444';
        resultDiv.textContent = 'Erro: ' + e.message;
        showToast('Erro ao enviar SMS: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📨 ENVIAR SMS';
      }
    });

    function renderHistory() {
      var histDiv = $('#smsHistoryContent');
      if (!history.length) {
        histDiv.innerHTML = 'Nenhum envio ainda.';
        return;
      }
      histDiv.innerHTML = '<div style="max-height:300px;overflow-y:auto;">' + history.map(function(h) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem;">' +
          '<span style="' + (h.status === 'sucesso' ? 'color:#10B981;' : 'color:#EF4444;') + '">' + (h.status === 'sucesso' ? '✅' : '❌') + '</span>' +
          '<span style="font-family:monospace;color:var(--color-text-muted);min-width:100px;">' + h.time + '</span>' +
          '<span style="font-family:monospace;font-weight:600;min-width:130px;">' + h.phone + '</span>' +
          '<span style="flex:1;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(h.message) + '</span>' +
          '<span style="font-size:0.7rem;color:var(--color-text-muted);font-style:italic;">' + h.accounts + '</span>' +
        '</div>';
      }).join('') + '</div>';
    }
  }

  async function renderPagamentos(container, page) {
    const pageSize = 20;
    const p = page || currentPage.pagamentos || 1;
    const filtro = currentFilter.pagamentos || '';
    const params = `limit=${pageSize}&page=${p}${filtro ? '&status=' + filtro : ''}`;
    const data = await API.getPayments(params);

    const statusOptions = ['', 'pendente', 'pago', 'falha'];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">Pagamentos</h1>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="pagamentoStatusFilter" style="padding:10px 12px;border:1px solid var(--color-gray-200);border-radius:var(--radius-sm);font-size:0.875rem;">
            ${statusOptions.map(s => `<option value="${s}" ${filtro === s ? 'selected' : ''}>${s ? 'Status: ' + s : 'Todos'}</option>`).join('')}
          </select>
        </div>
      </header>
      <section class="admin-card admin-form" style="margin-bottom:var(--space-lg);">
        <h2 class="admin-form__section-title">Gerar PIX</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Tipo de Chave</label>
            <select id="pixGenType">
              <option value="cpf">CPF</option>
              <option value="telefone">Telefone</option>
              <option value="email">E-mail</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div class="form-group">
            <label>Chave PIX</label>
            <input type="text" id="pixGenKey" placeholder="Digite a chave...">
          </div>
          <div class="form-group">
            <label>Valor (R$)</label>
            <input type="number" id="pixGenAmount" step="0.01" min="0.01" value="4.99">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;">
            <button id="btnGerarPix" class="btn btn--primary" style="width:100%;">GERAR QR CODE</button>
          </div>
        </div>
        <div id="pixGenResult" style="display:none; margin-top:16px; text-align:center; background:var(--color-gray-light); border-radius:var(--radius-md); padding:20px;">
          <img id="pixGenQr" src="" alt="QR Code PIX" style="width:200px; height:200px; border-radius:var(--radius-sm); margin-bottom:12px;">
          <div style="font-size:0.8125rem; color:var(--color-text-muted); margin-bottom:4px;">Código copia e cola:</div>
          <div id="pixGenCode" style="font-family:monospace; font-size:0.75rem; word-break:break-all; background:var(--color-white); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-200);"></div>
          <button id="btnCopiarPix" class="btn btn--primary btn--sm" style="margin-top:8px;">COPIAR</button>
          <span id="pixCopiadoMsg" style="display:none; color:var(--color-green); font-size:0.8125rem; margin-left:8px;">Copiado!</span>
        </div>
      </section>
      <section class="admin-card">
        <h2 class="admin-form__section-title">Histórico de Pagamentos</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Cliente</th><th>CPF</th><th>Método</th><th>Detalhes</th><th>Valor</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>${data.payments.map(p => {
              const metodoLabel = p.metodo === 'pix' ? 'PIX' : p.metodo === 'pushinpay' ? 'PushinPay' : p.metodo === 'cartao' ? 'Cartão' : p.metodo === 'boleto' ? 'Boleto' : p.metodo;
              const detalhes = p.metodo === 'cartao' ? `${p.card_brand ? p.card_brand.toUpperCase() + ' ' : ''}**** ${p.card_last_four || '----'} · ${p.parcelas || 1}x` : p.metodo === 'pix' ? (p.pix_chave ? 'Chave gerada' : '') : '';
              return `<tr>
                <td><strong>${p.client_nome}</strong></td>
                <td>${formatCpf(p.client_cpf)}</td>
                <td>${metodoLabel}</td>
                <td style="font-size:0.78rem;color:var(--color-text-muted);">${detalhes}</td>
                <td>${fmtMoney(p.valor)}</td>
                <td><span class="badge badge--${p.status === 'pago' ? 'success' : 'primary'}">${p.status}</span></td>
                <td>${fmtDate(p.paid_at || p.created_at)}</td>
                <td>${p.status !== 'pago' ? `<button class="btn btn--primary btn--sm" data-action="approve-payment" data-id="${p.id}" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap;">✅ Aprovar</button>` : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div id="pagamentosPagination">${renderPagination(data.pages || 1, p, 'pagamentos')}</div>
    </section>
    `;

    const reloadPagamentos = async () => {
      const np = currentPage.pagamentos || 1;
      container.innerHTML = '<div class="loading-spinner">Carregando...</div>';
      await renderPagamentos(container, np);
    };

    container.addEventListener('click', async (e) => {
      const pageBtn = e.target.closest('[data-page]');
      if (pageBtn && !pageBtn.disabled) {
        const np = parseInt(pageBtn.dataset.page);
        if (np && np !== currentPage.pagamentos) {
          currentPage.pagamentos = np;
          await reloadPagamentos();
        }
        return;
      }
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn && actionBtn.dataset.action === 'approve-payment') {
        const pid = actionBtn.dataset.id;
        actionBtn.disabled = true;
        actionBtn.textContent = 'Aprovando...';
        await API.request('PATCH', '/payments/' + pid + '/status', { status: 'pago' });
        showToast('Pagamento aprovado com sucesso!');
        await reloadPagamentos();
      }
    });

    $('#pagamentoStatusFilter')?.addEventListener('change', async (e) => {
      currentFilter.pagamentos = e.target.value;
      currentPage.pagamentos = 1;
      await reloadPagamentos();
    });

    $('#btnGerarPix').addEventListener('click', async () => {
      const pixKey = $('#pixGenKey').value.trim();
      if (!pixKey) return showToast('Digite a chave PIX', 'error');
      const amount = parseFloat($('#pixGenAmount').value) || 4.99;
      const resultDiv = $('#pixGenResult');
      resultDiv.style.display = 'none';
      try {
        const resp = await API.generatePixCode({ pix_key: pixKey, amount });
        $('#pixGenQr').src = resp.pixQrCode;
        $('#pixGenCode').textContent = resp.pixCopiaCola;
        resultDiv.style.display = '';
      } catch (e) {
        showToast('Erro ao gerar PIX: ' + e.message, 'error');
      }
    });
    $('#btnCopiarPix').addEventListener('click', () => {
      const code = $('#pixGenCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        $('#pixCopiadoMsg').style.display = '';
        setTimeout(() => { $('#pixCopiadoMsg').style.display = 'none'; }, 3000);
      });
    });
  }

  function isOperador() { return currentUser && currentUser.role === 'operador'; }

  async function renderFichas(container) {
    await renderClients(container, null, true);
  }

  async function renderClients(container, page, isOperator) {
    const pageSize = 20;
    const p = page || currentPage.clients || 1;
    const filtro = currentFilter.clients || '';
    if (isOperator === undefined) isOperator = isOperador();
    const params = `limit=${pageSize}&page=${p}${filtro ? '&status=' + filtro : ''}`;
    const data = await API.getClients(params);
    const [payments, onlineData, settingsData] = await Promise.all([
      API.getPayments('limit=500'),
      API.getActiveSessions().catch(function(){ return { sessions: [] }; }),
      API.getSettings().catch(function(){ return { settings: {} }; })
    ]);
    const linkApp = (settingsData.settings && settingsData.settings.sms_app_link) || 'https://app.credvale.com.br';
    var onlineCpfMap = {};
    (onlineData.sessions || []).forEach(function(s){ if (s.cpf) onlineCpfMap[s.cpf.replace(/\D/g,'')] = true; });
    const paymentMap = {};
    payments.payments.forEach(pay => {
      if (!paymentMap[pay.client_id]) paymentMap[pay.client_id] = [];
      paymentMap[pay.client_id].push(pay);
    });

    const statusOptions = ['', 'pendente', 'aprovado', 'ativado', 'reprovado', 'cancelado'];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">${isOperator ? 'Fichas CredVale' : 'Clientes'}</h1>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="clientStatusFilter" style="padding:10px 12px;border:1px solid var(--color-gray-200);border-radius:var(--radius-sm);font-size:0.875rem;">
            ${statusOptions.map(s => `<option value="${s}" ${filtro === s ? 'selected' : ''}>${s ? 'Status: ' + s : 'Todos os status'}</option>`).join('')}
          </select>
          <input type="text" id="clientSearch" placeholder="Buscar por nome ou CPF..." style="padding:10px 14px; border:1px solid var(--color-gray-200); border-radius:var(--radius-sm); font-size:0.875rem; width:200px;">
          ${isOperator ? '' : '<button class="btn btn--primary btn--sm" onclick="exportarClientes()" title="Exportar CSV">📥 CSV</button>'}
          ${isOperator ? '' : '<button class="btn btn--danger btn--sm" onclick="excluirTodosClientes()">🗑️ Excluir Todos</button>'}
        </div>
      </header>
      <section class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>WhatsApp</th><th>Dispositivo</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody id="clientsTableBody">${renderClientRows(data.clients, paymentMap, onlineCpfMap, linkApp, isOperator)}</tbody>
          </table>
        </div>
        <div id="clientsPagination">${renderPagination(data.pages || 1, p, 'clients')}</div>
      </section>
      <div id="clientPaymentDetail" style="display:none;"></div>
    `;

    const reloadClientes = async () => {
      const np = currentPage.clients || 1;
      container.innerHTML = '<div class="loading-spinner">Carregando...</div>';
      await renderClients(container, np);
    };

    $('#clientSearch')?.addEventListener('input', async (e) => {
      const s = e.target.value.trim();
      if (s.length < 2 && s.length > 0) return;
      const params2 = s.length >= 2 ? `search=${encodeURIComponent(s)}&limit=${pageSize}` : `limit=${pageSize}&page=${currentPage.clients || 1}${currentFilter.clients ? '&status=' + currentFilter.clients : ''}`;
      const [results, pay, onlineData2, settingsData2] = await Promise.all([
        API.getClients(params2),
        API.getPayments('limit=500'),
        API.getActiveSessions().catch(function(){ return { sessions: [] }; }),
        API.getSettings().catch(function(){ return { settings: {} }; })
      ]);
      var ocp = {};
      (onlineData2.sessions || []).forEach(function(s2){ if (s2.cpf) ocp[s2.cpf.replace(/\D/g,'')] = true; });
      const pmap = {};
      pay.payments.forEach(p => { if (!pmap[p.client_id]) pmap[p.client_id] = []; pmap[p.client_id].push(p); });
      const linkApp2 = (settingsData2.settings && settingsData2.settings.sms_app_link) || 'https://app.credvale.com.br';
      $('#clientsTableBody').innerHTML = renderClientRows(results.clients, pmap, ocp, linkApp2);
      const pagEl = $('#clientsPagination');
      if (pagEl && results.pages) pagEl.innerHTML = renderPagination(results.pages, currentPage.clients || 1, 'clients');
    });

    $('#clientStatusFilter')?.addEventListener('change', async (e) => {
      currentFilter.clients = e.target.value;
      currentPage.clients = 1;
      await reloadClientes();
    });

    if (container._listenerAttached) return;
    container._listenerAttached = true;
    container.addEventListener('click', async (e) => {
      const pageBtn = e.target.closest('[data-page]');
      if (pageBtn && !pageBtn.disabled) {
        const np = parseInt(pageBtn.dataset.page);
        if (np && np !== currentPage.clients) {
          currentPage.clients = np;
          await reloadClientes();
        }
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'approve') {
        var savedLimite = btn.dataset.limite;
        var limite = savedLimite ? parseFloat(savedLimite) : 850;
        await API.updateClientStatus(id, 'aprovado', limite);
        showToast('Cliente aprovado com limite de ' + fmtMoney(limite));
        await reloadClientes();
      } else if (action === 'reject') {
        if (await showConfirmModal('Rejeitar cliente', 'Tem certeza que deseja rejeitar este cliente?', 'Rejeitar', 'Cancelar')) { await API.updateClientStatus(id, 'reprovado'); showToast('Cliente rejeitado'); await reloadClientes(); }
      } else if (action === 'delete') {
        if (isOperador()) { showToast('Apenas administradores podem excluir clientes', 'error'); return; }
        await API.deleteClient(id); showToast('Cliente excluído'); await reloadClientes();
      } else if (action === 'view-payments') {
        const detailDiv = $('#clientPaymentDetail');
        const cid = btn.dataset.id;
        const cname = btn.dataset.nome;
        const ccpf = btn.dataset.cpf;
        const cpays = paymentMap[cid] || [];
        const isHidden = detailDiv.style.display === 'none' || detailDiv.dataset.client !== cid;
        detailDiv.style.display = isHidden ? '' : 'none';
        detailDiv.dataset.client = cid;
        if (isHidden) {
          detailDiv.innerHTML = `
            <section class="admin-card" style="margin-top:var(--space-md);">
              <h2 class="admin-form__section-title">Pagamentos de ${cname} (${formatCpf(ccpf)})</h2>
              ${cpays.length === 0 ? '<p style="color:var(--color-text-muted);">Nenhum pagamento encontrado</p>' : `
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead><tr><th>Método</th><th>Detalhes</th><th>Valor</th><th>Status</th><th>Data</th><th>Transação</th></tr></thead>
                  <tbody>${cpays.map(p => {
                    const metodoLabel = p.metodo === 'pix' ? 'PIX' : p.metodo === 'pushinpay' ? 'PushinPay' : p.metodo === 'cartao' ? 'Cartão' : p.metodo;
                    const detalhes = p.metodo === 'cartao' ? `${p.card_brand ? p.card_brand.toUpperCase() + ' ' : ''}**** ${p.card_last_four || '----'} · ${p.parcelas || 1}x` : p.metodo === 'pix' ? (p.pix_chave ? 'Payload gerado' : '') : '';
                    return `<tr>
                      <td>${metodoLabel}</td>
                      <td style="font-size:0.78rem;color:var(--color-text-muted);">${detalhes}</td>
                      <td>${fmtMoney(p.valor)}</td>
                      <td><span class="badge badge--${p.status === 'pago' ? 'success' : 'primary'}">${p.status}</span></td>
                      <td>${fmtDateTime(p.paid_at || p.created_at)}</td>
                      <td style="font-size:0.75rem;font-family:monospace;">${p.transaction_id || p.id?.slice(0,8) || '—'}</td>
                    </tr>`;
                  }).join('')}
                  </tbody>
                </table>
              </div>`}
            </section>`;
        }
      } else if (action === 'sms') {
        const nome = btn.dataset.nome;
        const raw = btn.dataset.limite;
        const wa = btn.dataset.whatsapp;
        const limite = fmtMoney(parseFloat(raw) || 0);
        const settings = await API.getSettings();
        const linkApp = (settings.settings && settings.settings.sms_app_link) || 'https://app.credvale.com.br';
        var msg = fillSmsTemplate(nome, limite, linkApp);
        var numero = wa ? wa.replace(/\D/g, '') : '';
        showSmsModal(msg, numero);
      } else if (action === 'resend-sms' || action === 'resend-shortcode') {
        const btn2 = e.target.closest('[data-action]');
        const id2 = btn2.dataset.id;
        const nome2 = btn2.dataset.nome;
        const wa2 = btn2.dataset.whatsapp;
        if (!wa2) { showToast('Cliente sem WhatsApp cadastrado', 'error'); return; }
        try {
          const settings2 = await API.getSettings();
          const linkApp2 = (settings2.settings && settings2.settings.sms_app_link) || 'https://app.credvale.com.br';
          const clientData2 = await API.getClient(id2);
          const client2 = clientData2.client;
          const limiteStr2 = fmtMoney(parseFloat(client2.limite_aprovado) || 0);
          const phoneClean2 = client2.whatsapp ? client2.whatsapp.replace(/\D/g, '') : wa2.replace(/\D/g, '');
          if (!phoneClean2) { showToast('Telefone inválido', 'error'); return; }
          // Garante o prefixo 55 (código do Brasil) para o número
          var phoneWith55 = phoneClean2;
          if (!phoneWith55.startsWith('55')) phoneWith55 = '55' + phoneWith55;
          const shortMsg2 = settings2.settings.sms_short_message || '';
          var msg2 = shortMsg2;
          if (!msg2) {
            msg2 = fillSmsTemplate(nome2 || client2.nome || 'Cliente', limiteStr2, linkApp2);
          } else {
            var nomeParts2 = (client2.nome || nome2 || 'Cliente').split(' ');
            msg2 = msg2.replace(/\{NOME\}/g, nomeParts2[0] || 'Cliente').replace(/\{LIMITE\}/g, limiteStr2.replace('R$ ', ''));
          }
          // Lê as contas ativas configuradas em "Contas Ativas para Envio Automático"
          var activeAccounts = [];
          if (settings2.settings && settings2.settings.sms_active_accounts) {
            try { activeAccounts = JSON.parse(settings2.settings.sms_active_accounts); } catch {}
          }
          // Abre o modal para o admin editar a mensagem antes de enviar
          showSmsModal(msg2, phoneClean2, async function(textoEditado) {
            await API.smsSend({
              phone: phoneWith55,
              message: textoEditado,
              selectedAccounts: activeAccounts.length ? activeAccounts : undefined
            });
          });
        } catch (e2) {
          showToast('Erro ao preparar reenvio: ' + e2.message, 'error');
        }
      }
    });
  }

  function renderClientRows(clients, paymentMap, onlineCpfMap, linkApp, isOperator) {
    if (!clients.length) return '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);">Nenhum cliente encontrado</td></tr>';
    if (!onlineCpfMap) onlineCpfMap = {};
    if (isOperator === undefined) isOperator = isOperador();
    return clients.map(c => {
      var disp = c.dispositivo || '';
      var modelo = c.modelo ? c.modelo.slice(0, 60) : '';
      var fab = c.fabricante ? c.fabricante : '';
      var dispLabel = disp ? (disp === 'Android' ? '📱 ' : disp === 'iPhone' ? '📱 ' : disp === 'Windows' ? '💻 ' : disp === 'Mac' ? '💻 ' : disp === 'Celular' ? '📱 ' : disp === 'Tablet' ? '📱 ' : '') + disp : '—';
      if (fab) dispLabel += ' · ' + fab;
      if (disp === 'Android' && modelo) dispLabel += ' ' + modelo;
      else if (disp === 'iPhone' && modelo && modelo !== 'iPhone') dispLabel += ' ' + modelo;
      var isOnline = onlineCpfMap[c.cpf ? c.cpf.replace(/\D/g,'') : ''];
      const waNum = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
      const waMsg = linkApp ? fillSmsTemplate(c.nome, fmtMoney(parseFloat(c.limite_aprovado) || 0), linkApp) : '';
      const waLink = (waNum && waMsg) ? 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg) : (waNum ? 'https://wa.me/' + waNum + '?text=' + encodeURIComponent('Ol\u00e1, estou falando com voc\u00ea referente ao seu cart\u00e3o Vale Sa\u00fade.') : '');
      return `<tr>
        <td><strong>${isOnline ? '<span class="online-dot" style="margin-right:6px;vertical-align:middle;"></span>' : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#CBD5E1;margin-right:6px;vertical-align:middle;"></span>'}${c.nome}</strong></td>
        <td>${formatCpf(c.cpf)}</td>
        <td>${waLink ? `<a href="${waLink}" target="_blank" style="color:var(--color-secondary);font-weight:600;text-decoration:none;" title="Abrir conversa no WhatsApp">${c.whatsapp}</a>` : (c.whatsapp || '—')} ${c.status === 'aprovado' ? `<button class="admin-btn-icon" data-action="sms" data-id="${c.id}" data-nome="${c.nome}" data-limite="${c.limite_aprovado || 0}" data-whatsapp="${c.whatsapp || ''}" title="Enviar SMS" style="vertical-align:middle;margin-left:4px;">📩</button>` : ''}</td>
        <td style="font-size:0.78rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${modelo}">${dispLabel}</td>
        <td><span class="badge badge--${statusColor(c.status)}">${c.status}</span></td>
        <td style="font-size:0.78rem;color:var(--color-text-muted);">${fmtDate(c.created_at || '')}</td>
        <td class="admin-table__actions">
          <button class="admin-btn-icon" onclick="viewClient('${c.id}')" title="Ver detalhes">👁️</button>
          ${c.status === 'pendente' ? `
            <button class="admin-btn-icon" data-action="approve" data-id="${c.id}" data-limite="${c.limite_aprovado || ''}" title="Aprovar">✅</button>
            <button class="admin-btn-icon admin-btn-icon--danger" data-action="reject" data-id="${c.id}" title="Rejeitar">❌</button>
          ` : ''}
          ${isOperator ? '' : `<button class="admin-btn-icon admin-btn-icon--danger" data-action="delete" data-id="${c.id}" title="Excluir">🗑️</button>`}
          ${c.status === 'aprovado' ? `<button class="admin-btn-icon" data-action="resend-sms" data-id="${c.id}" data-nome="${c.nome}" data-whatsapp="${c.whatsapp || ''}" title="Reenviar SMS">📨</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  async function renderApiPage(container) {
    const data = await API.getSettings();
    let cpfKeys = [];
    try { if (data.settings.cpf_api_keys) cpfKeys = JSON.parse(data.settings.cpf_api_keys); } catch {}
    // Fetch usage stats (keys que ainda restam)
    let keysStatus = [];
    try {
      const st = await API.cpfKeysStatus();
      keysStatus = st.status || [];
    } catch {}
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">🔑 API de Consulta CPF</h1>
        <span style="font-size:0.8rem;color:var(--color-text-muted);">${keysStatus.length} token(s) restante(s)</span>
      </header>
      <div class="admin-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-bottom:16px;">
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.2);">
          <div class="admin-card__label">Tokens Restantes</div>
          <div class="admin-card__value" style="font-size:1.5rem;">${keysStatus.length}</div>
        </article>
        <article class="admin-card">
          <div class="admin-card__label">Status</div>
          <div class="admin-card__value" style="font-size:1rem;color:${keysStatus.length > 0 ? 'var(--color-green)' : '#DC2626'};">${keysStatus.length > 0 ? '✅ Operacional' : '❌ Sem tokens'}</div>
        </article>
      </div>
      <section class="admin-card admin-form">
        <h2 class="admin-form__section-title">Tokens Ativos</h2>
        <div style="margin-bottom:16px;">
          ${!keysStatus.length ? '<p style="color:var(--color-text-muted);font-size:0.85rem;">Nenhum token restante. Adicione novos abaixo.</p>' : keysStatus.map((s, idx) => {
            const pct = Math.round((s.count / s.limit) * 100);
            return '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8fafc;border-radius:8px;margin-bottom:6px;border:1px solid #e2e8f0;">' +
              '<span style="width:8px;height:8px;border-radius:50%;background:var(--color-green);display:inline-block;flex-shrink:0;"></span>' +
              '<span style="font-family:monospace;font-size:0.8rem;flex:1;color:#1e293b;">' + s.masked + '</span>' +
              '<div style="display:flex;align-items:center;gap:6px;">' +
                '<div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">' +
                  '<div style="width:' + pct + '%;height:100%;background:' + (pct > 70 ? '#f59e0b' : 'var(--color-green)') + ';border-radius:3px;"></div>' +
                '</div>' +
                '<span style="font-family:monospace;font-size:0.75rem;color:#64748b;white-space:nowrap;">' + s.remaining + '/' + s.limit + '</span>' +
              '</div>' +
              '<button class="btn btn--danger btn--sm" onclick="removeCpfKey(' + idx + ')" title="Remover token" style="padding:2px 8px;font-size:0.7rem;">✕</button>' +
            '</div>';
          }).join('')}
        </div>
        <div class="form-group form-group--full">
          <label>Adicionar Tokens HydraCPF (um por linha)</label>
          <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:8px;">
            Cada token dura <strong>10 consultas</strong> e é <strong>automaticamente excluído</strong> quando acaba. Adicione quantos quiser.
          </div>
          <textarea id="apiCpfKeys" rows="5" style="width:100%;font-family:monospace;font-size:0.8125rem;padding:10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;" placeholder="sk_live_..."></textarea>
        </div>
        <div style="display:flex;gap:8px;margin-top:var(--space-md);">
          <button id="btnSaveApiConfig" class="btn btn--primary" style="flex:1;">ADICIONAR TOKENS</button>
          ${keysStatus.length > 0 ? '<button class="btn btn--danger" onclick="removeAllCpfKeys()" style="flex:0.5;">🗑️ REMOVER TODOS</button>' : ''}
        </div>
      </section>
      <section class="admin-card" style="margin-top:16px;">
        <h2 class="admin-form__section-title">📖 Como funciona</h2>
        <div style="font-size:0.8rem;color:var(--color-text-muted);line-height:1.6;">
          <p>1. Cada token HydraCPF tem limite de <strong>10 consultas</strong>.</p>
          <p>2. O sistema usa o <strong>primeiro token da lista</strong>. A cada consulta bem-sucedida, o contador sobe.</p>
          <p>3. Quando bate <strong>10 consultas</strong>, o token é <strong>excluído automaticamente</strong> do sistema.</p>
          <p>4. Se o token retornar <strong>401</strong> ou <strong>403</strong>, ele é excluído na hora.</p>
          <p>5. Quando todos os tokens acabam, retorna erro até você adicionar novos.</p>
          <p style="margin-top:8px;">✅ Tokens são descartáveis — adicione blocos de quantos quiser.</p>
        </div>
      </section>
    `;
    $('#btnSaveApiConfig').addEventListener('click', async () => {
      const keysRaw = document.getElementById('apiCpfKeys').value;
      const newKeys = keysRaw.split('\n').map(s => s.trim()).filter(Boolean);
      if (!newKeys.length) { showToast('Digite ao menos um token', 'error'); return; }
      // Append novos tokens aos existentes
      const merged = [...cpfKeys, ...newKeys];
      try {
        await API.saveSettings({ cpf_api_keys: JSON.stringify(merged) });
        showToast(`${newKeys.length} chave(s) adicionada(s)! Total: ${merged.length}`);
        navigateTo('api');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
  }


  // ============================================================
  // Notificações
  // ============================================================

  async function renderNotificacoes(container) {
    container.innerHTML = '<div class="loading-spinner">Carregando...</div>';
    const data = await API.getNotifications();
    const notifs = data.notifications || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">🔔 Notificações</h1>
        <span style="font-size:0.8rem;color:var(--color-text-muted);">${notifs.filter(n => !n.lida).length} não lidas</span>
      </header>
      <section class="admin-card">
        ${!notifs.length ? '<p style="color:var(--color-text-muted);text-align:center;padding:24px;">Nenhuma notificação</p>' : notifs.map(n => `
          <div style="display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--color-gray-200);${!n.lida ? 'background:rgba(59,130,246,0.05);' : ''}">
            <div style="flex:1;">
              <div style="font-weight:${!n.lida ? '700' : '400'};font-size:0.85rem;">${n.titulo || n.tipo || 'Notificação'}</div>
              <div style="font-size:0.78rem;color:var(--color-text-muted);">${n.mensagem || ''}</div>
              <div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:4px;">${fmtDateTime(n.created_at)}</div>
            </div>
            ${!n.lida ? `<button class="btn btn--primary btn--sm" onclick="marcarLida('${n.id}')">Marcar lida</button>` : ''}
          </div>`).join('')}
      </section>
    `;
  }

  async function marcarLida(id) {
    try { await API.markNotificationRead(id); navigateTo('notificacoes'); } catch (e) { showToast(e.message, 'error'); }
  }

  // ============================================================
  // Usuários
  // ============================================================

  async function renderUsuarios(container) {
    container.innerHTML = '<div class="loading-spinner">Carregando...</div>';
    const data = await API.getUsers();
    const users = data.users || [];
    const permissoes = data.permissoes || [];
    var nv = ['Visualizar','Editar','Excluir'];
    var modulos = [
      { key:'dashboard', label:'Dashboard', perms:['dashboard.view'] },
      { key:'clientes', label:'Clientes', perms:['clientes.view','clientes.edit','clientes.delete'] },
      { key:'apk', label:'APK', perms:['apk.view','apk.upload','apk.delete'] },
      { key:'sms', label:'SMS', perms:['sms.view','sms.edit'] },
      { key:'pix', label:'PIX', perms:['pix.view','pix.edit'] },
      { key:'usuarios', label:'Usuários', perms:['usuarios.view','usuarios.create','usuarios.edit','usuarios.delete'] },
      { key:'config', label:'Config', perms:['config.view','config.edit'] },
      { key:'logs', label:'Logs', perms:['logs.view'] },
      { key:'notif', label:'Notificações', perms:['notificacoes.view'] },
    ];
    function nivelLabel(n) { return ['—','Operador','Supervisor','Administrador'][n] || 'Nível ' + n; }
    function permBadges(perms) {
      if (!perms || !perms.length) return '<span style="color:var(--color-text-muted);font-size:0.7rem;">Nenhuma</span>';
      if (perms[0] === '*') return '<span class="badge badge--success">Total</span>';
      return modulos.map(m => {
        var has = m.perms.some(p => perms.includes(p));
        if (!has) return '';
        var count = m.perms.filter(p => perms.includes(p)).length;
        return '<span class="badge badge--primary" style="margin:1px;font-size:0.6rem;">' + m.label + (count < m.perms.length ? ' ('+count+'/'+m.perms.length+')' : '') + '</span>';
      }).filter(Boolean).join('');
    }
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">👤 Usuários do Sistema</h1>
        <button class="btn btn--primary btn--sm" onclick="novoUsuario()">+ Novo Usuário</button>
      </header>
      <section class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Nível</th><th>Permissões</th><th>Ativo</th><th>Último Acesso</th><th>Ações</th></tr></thead>
            <tbody>${users.map(u => {
              var nv = u.nivel || 1;
              return '<tr>' +
                '<td><strong>' + u.name + '</strong></td>' +
                '<td style="font-size:0.75rem;">' + (u.login || u.email) + '</td>' +
                '<td><span class="badge badge--' + (nv >= 3 ? 'success' : nv >= 2 ? 'primary' : 'default') + '">' + nivelLabel(nv) + '</span></td>' +
                '<td style="max-width:200px;">' + permBadges(u.permissions || []) + '</td>' +
                '<td>' + (u.active ? '<span style="color:#10B981;">✅</span>' : '<span style="color:#EF4444;">❌</span>') + '</td>' +
                '<td style="font-size:0.7rem;color:var(--color-text-muted);">' + (u.ultimo_acesso ? new Date(u.ultimo_acesso + 'Z').toLocaleString('pt-BR') : '—') + '</td>' +
                '<td style="white-space:nowrap;">' +
                  '<button class="btn btn--primary btn--xs" onclick="editarUsuario(\'' + u.id + '\')" title="Editar">✏️</button>' +
                  '<button class="btn btn--warning btn--xs" onclick="alterarSenhaUsuario(\'' + u.id + '\')" title="Alterar Senha">🔑</button>' +
                  (u.email !== 'admin@valesaude.com.br' ? '<button class="btn btn--' + (u.active ? 'danger' : 'success') + ' btn--xs" onclick="toggleAtivoUsuario(\'' + u.id + '\')" title="' + (u.active ? 'Desativar' : 'Ativar') + '">' + (u.active ? '🔴' : '🟢') + '</button>' : '') +
                  (u.email !== 'admin@valesaude.com.br' ? '<button class="btn btn--danger btn--xs" onclick="excluirUsuario(\'' + u.id + '\')" title="Excluir">🗑️</button>' : '') +
                '</td>' +
              '</tr>';
            }).join('')}
          </tbody></table>
        </div>
      </section>
    `;
  }

  async function novoUsuario(userData) {
    var editing = userData && userData.id;
    var data = await API.getUsers();
    var allPerms = data.permissoes || [];
    var modulos = [
      { key:'dashboard', label:'Dashboard', perms:['dashboard.view'] },
      { key:'clientes', label:'Clientes', perms:['clientes.view','clientes.edit','clientes.delete'] },
      { key:'apk', label:'APK', perms:['apk.view','apk.upload','apk.delete'] },
      { key:'sms', label:'SMS', perms:['sms.view','sms.edit'] },
      { key:'pix', label:'PIX', perms:['pix.view','pix.edit'] },
      { key:'usuarios', label:'Usuários', perms:['usuarios.view','usuarios.create','usuarios.edit','usuarios.delete'] },
      { key:'config', label:'Config', perms:['config.view','config.edit'] },
      { key:'logs', label:'Logs', perms:['logs.view'] },
      { key:'notif', label:'Notificações', perms:['notificacoes.view'] },
    ];
    var userPerms = (userData && userData.permissions) || [];
    var userNivel = (userData && userData.nivel) || 1;
    var isAdmin = userPerms[0] === '*';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;animation:modalIn 0.2s ease;';
    overlay.dataset.uid = userData ? userData.id : '';
    overlay.innerHTML = `
      <div style="background:#203A57;border-radius:24px;padding:28px 24px;max-width:560px;width:100%;border:1px solid rgba(255,255,255,0.08);box-shadow:0 30px 80px rgba(0,0,0,0.45);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h3 style="font-size:1.125rem;font-weight:700;color:#fff;">${editing ? '✏️ Editar Usuário' : '👤 Novo Usuário'}</h3>
          <button class="modal-close" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);cursor:pointer;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">Nome *</label>
            <input id="userName" value="${(userData && userData.name) || ''}" placeholder="Nome completo" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.875rem;">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">E-mail *</label>
            <input id="userEmail" value="${(userData && userData.email) || ''}" placeholder="email@exemplo.com" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.875rem;">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">Login</label>
            <input id="userLogin" value="${(userData && userData.login) || ''}" placeholder="nome.usuario" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.875rem;">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">Telefone</label>
            <input id="userTelefone" value="${(userData && userData.telefone) || ''}" placeholder="(11) 99999-9999" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.875rem;">
          </div>
        </div>
        ${!editing ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;"><div><label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">Senha *</label><input id="userPassword" type="password" placeholder="mín. 6 caracteres" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.875rem;"></div><div><label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">Confirmar Senha *</label><input id="userPasswordConfirm" type="password" placeholder="repita a senha" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.875rem;"></div></div>' : ''}
        <div style="margin-top:14px;">
          <label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:4px;">Nível de Acesso</label>
          <select id="userNivel" onchange="document.getElementById('permissoesContainer').style.display = parseInt(this.value) >= 3 ? 'none' : ''" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:0.85rem;">
            <option value="1" ${userNivel === 1 ? 'selected' : ''}>Operador — Dashboard e Clientes</option>
            <option value="2" ${userNivel === 2 ? 'selected' : ''}>Supervisor — APK, SMS, PIX</option>
            <option value="3" ${userNivel === 3 ? 'selected' : ''}>Administrador — Acesso total</option>
          </select>
        </div>
        <div id="permissoesContainer" style="margin-top:14px;${userNivel >= 3 ? 'display:none;' : ''}">
          <label style="font-size:0.75rem;font-weight:600;color:var(--color-text-muted);display:block;margin-bottom:8px;">Permissões Individuais</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">${modulos.map(m => {
            var count = m.perms.filter(p => userPerms.includes(p) || isAdmin).length;
            var total = m.perms.length;
            var checked = count === total ? 'checked' : '';
            return '<label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;padding:3px 0;color:#B7C5D8;">' +
              '<input type="checkbox" ' + checked + ' data-perms=\'' + JSON.stringify(m.perms) + '\'>' +
              '<span>' + m.label + '</span>' +
            '</label>';
          }).join('')}</div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
          <button class="btn-cancel" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#B7C5D8;font-size:0.875rem;font-weight:600;cursor:pointer;">Cancelar</button>
          <button class="btn-save" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(90deg,#3B82F6,#4CC8A4);color:#fff;font-size:0.875rem;font-weight:700;cursor:pointer;">${editing ? 'Salvar' : 'Criar Usuário'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').onclick = () => overlay.remove();
    overlay.querySelector('.btn-cancel').onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector('.btn-save').onclick = async () => {
      var name = overlay.querySelector('#userName').value.trim();
      var email = overlay.querySelector('#userEmail').value.trim();
      var login = overlay.querySelector('#userLogin').value.trim();
      var telefone = overlay.querySelector('#userTelefone').value.trim();
      var nivel = parseInt(overlay.querySelector('#userNivel').value);
      if (!name || !email) { showToast('Nome e e-mail são obrigatórios', 'error'); return; }
      var permissions = [];
      if (nivel >= 3) { permissions = ['*']; }
      else {
        overlay.querySelectorAll('#permissoesContainer input[type="checkbox"]:checked').forEach(function(cb) {
          JSON.parse(cb.dataset.perms || '[]').forEach(function(p) { if (!permissions.includes(p)) permissions.push(p); });
        });
      }
      try {
        if (editing) {
          await API.updateUser(editing, { name, email, login, telefone, nivel, permissions });
          showToast('Usuário atualizado');
        } else {
          var password = overlay.querySelector('#userPassword').value;
          var passwordConfirm = overlay.querySelector('#userPasswordConfirm').value;
          if (!password || password.length < 6) { showToast('Senha deve ter no mínimo 6 caracteres', 'error'); return; }
          if (password !== passwordConfirm) { showToast('Senhas não conferem', 'error'); return; }
          await API.createUser({ name, email, login, telefone, password, nivel, permissions });
          showToast('Usuário criado');
        }
        overlay.remove();
        navigateTo('usuarios');
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  window.onNivelChange = function(val) {
    var container = document.getElementById('permissoesContainer');
    container.style.display = parseInt(val) >= 3 ? 'none' : '';
    if (parseInt(val) >= 3) {
      // Set all checkboxes checked for admin
      container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = true; });
    }
  };

  window.onPermChange = function(el) {
    // Allow partial selection
  };

  window.salvarUsuario = async function(editingId) {
    var name = $('#userName').value.trim();
    var email = $('#userEmail').value.trim();
    var login = $('#userLogin').value.trim();
    var telefone = $('#userTelefone').value.trim();
    var nivel = parseInt($('#userNivel').value);

    if (!name || !email) { showToast('Nome e e-mail são obrigatórios', 'error'); return; }

    // Collect permissions from checkboxes
    var permissions = [];
    if (nivel >= 3) {
      permissions = ['*'];
    } else {
      var container = document.getElementById('permissoesContainer');
      container.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
        var perms = JSON.parse(cb.dataset.perms || '[]');
        perms.forEach(function(p) { if (!permissions.includes(p)) permissions.push(p); });
      });
    }

    try {
      if (editingId) {
        await API.updateUser(editingId, { name, email, login, telefone, nivel, permissions });
        showToast('Usuário atualizado com sucesso');
      } else {
        var password = $('#userPassword').value;
        var passwordConfirm = $('#userPasswordConfirm').value;
        if (!password || password.length < 6) { showToast('Senha deve ter no mínimo 6 caracteres', 'error'); return; }
        if (password !== passwordConfirm) { showToast('Senhas não conferem', 'error'); return; }
        await API.createUser({ name, email, login, telefone, password, nivel, permissions });
        showToast('Usuário criado com sucesso');
      }
      fecharModal();
      navigateTo('usuarios');
    } catch (e) { showToast(e.message, 'error'); }
  };

  window.editarUsuario = async function(id) {
    var data = await API.getUsers();
    var user = data.users.find(function(u) { return u.id === id; });
    if (user) novoUsuario(user);
  };

  window.alterarSenhaUsuario = async function(id) {
    var pwd = await showPromptModal('Nova senha', '', 'mínimo 6 caracteres');
    if (!pwd || pwd.length < 6) return showToast('Senha deve ter no mínimo 6 caracteres', 'error');
    try { await API.changeUserPassword(id, pwd); showToast('Senha alterada com sucesso'); } catch (e) { showToast(e.message, 'error'); }
  };

  window.toggleAtivoUsuario = async function(id) {
    try { var r = await API.toggleUserActive(id); showToast(r.message); navigateTo('usuarios'); } catch (e) { showToast(e.message, 'error'); }
  };

  window.excluirUsuario = async function(id) {
    if (!await showConfirmModal('Excluir Usuário', 'Tem certeza que deseja excluir este usuário?', 'Excluir', 'Cancelar')) return;
    try { await API.deleteUser(id); showToast('Usuário excluído'); navigateTo('usuarios'); } catch (e) { showToast(e.message, 'error'); }
  };

  window.fecharModal = function() {
    // fechar modais antigos - remover último overlay criado dinamicamente
    var modais = document.querySelectorAll('div[style*="position:fixed"][style*="z-index:9000"]');
    if (modais.length) modais[modais.length-1].remove();
  };

  // ============================================================
  // Logs do Sistema
  // ============================================================

  async function renderLogsSistema(container) {
    container.innerHTML = '<div class="loading-spinner">Carregando...</div>';
    const data = await API.getLogs('limit=200');
    const logs = data.logs || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📋 Logs do Sistema</h1>
        <button class="btn btn--primary btn--sm" onclick="renderLogsSistema(document.getElementById('adminMain'))">🔄</button>
      </header>
      <section class="admin-card">
        <div style="max-height:600px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;">
          ${!logs.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhum registro</div>' : logs.map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--color-gray-200);font-size:0.75rem;">
            <span style="color:var(--color-text-muted);font-family:monospace;min-width:130px;">${fmtDateTime(l.created_at)}</span>
            <span style="font-weight:600;color:var(--color-primary);min-width:80px;">${l.action}</span>
            <span style="color:var(--color-text-muted);flex:1;">${l.entity} ${l.entity_id ? l.entity_id.slice(0,8) : ''} ${l.user_name ? 'por ' + l.user_name : ''}</span>
          </div>`).join('')}
        </div>
      </section>
    `;
  }

  // ============================================================
  // Trocar Senha
  // ============================================================

  async function renderTrocarSenha(container) {
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">🔐 Trocar Senha</h1>
      </header>
      <section class="admin-card admin-form" style="max-width:500px;">
        <div class="form-group">
          <label>Senha Atual</label>
          <input type="password" id="pwdCurrent" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;font-size:0.9rem;">
        </div>
        <div class="form-group" style="margin-top:16px;">
          <label>Nova Senha</label>
          <input type="password" id="pwdNew" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;font-size:0.9rem;">
        </div>
        <button id="btnTrocarSenha" class="btn btn--primary" style="margin-top:24px;">ALTERAR SENHA</button>
      </section>
    `;
    $('#btnTrocarSenha').addEventListener('click', async () => {
      const current = $('#pwdCurrent').value;
      const pwd = $('#pwdNew').value;
      if (!current || !pwd) return showToast('Preencha ambos os campos', 'error');
      if (pwd.length < 6) return showToast('Nova senha deve ter no mínimo 6 caracteres', 'error');
      try { await API.changePassword(current, pwd); showToast('Senha alterada com sucesso!'); $('#pwdCurrent').value = ''; $('#pwdNew').value = ''; } catch (e) { showToast(e.message, 'error'); }
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  // ============================================================
  // Export functions
  // ============================================================

  async function excluirTodosClientes() {
    try {
      const data = await API.request('POST', '/clients/delete-all');
      showToast(data.message || 'Todos os clientes foram excluídos');
      navigateTo('clients');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function zerarSistema() {
    try {
      const data = await API.request('POST', '/admin/reset');
      showToast(data.message || 'Sistema zerado com sucesso');
      navigateTo('dashboard');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function resetSupportClicks() {
    try {
      await API.request('POST', '/admin/reset-support-clicks');
      showToast('Contador de suporte zerado');
      navigateTo('dashboard');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function zerarContadores() {
    if (!await showConfirmModal('Limpar Dashboard', 'Isso vai zerar os contadores de PIX, Push, visitantes online e page views. Os clientes NÃO serão afetados.', 'Limpar', 'Cancelar')) return;
    try {
      await API.request('POST', '/admin/reset-counters');
      showToast('Dashboard limpo com sucesso!');
      navigateTo('dashboard');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function removeCpfKey(idx) {
    if (!await showConfirmModal('Remover token', 'Tem certeza que deseja remover este token?', 'Remover', 'Cancelar')) return;
    try {
      const data = await API.getSettings();
      let cpfKeys = [];
      try { if (data.settings.cpf_api_keys) cpfKeys = JSON.parse(data.settings.cpf_api_keys); } catch {}
      if (idx < 0 || idx >= cpfKeys.length) { showToast('Token não encontrado', 'error'); return; }
      cpfKeys.splice(idx, 1);
      await API.saveSettings({ cpf_api_keys: JSON.stringify(cpfKeys) });
      showToast('Token removido!');
      navigateTo('api');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function removeAllCpfKeys() {
    if (!await showConfirmModal('Remover todos os tokens', 'Tem certeza? Todos os tokens CPF serão removidos.', 'Remover Todos', 'Cancelar')) return;
    try {
      await API.saveSettings({ cpf_api_keys: '[]' });
      showToast('Todos os tokens foram removidos!');
      navigateTo('api');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function exportarClientes() {
    try {
      const data = await API.getClients('limit=5000');
      const clients = data.clients || [];
      const payments = await API.getPayments('limit=5000');
      const pmap = {};
      (payments.payments || []).forEach(p => { if (!pmap[p.client_id]) pmap[p.client_id] = []; pmap[p.client_id].push(p); });
      let csv = 'Nome,CPF,WhatsApp,E-mail,Status,Limite,Produto,Dispositivo,Fabricante,Modelo,OS,Navegador,Data Cadastro,Total Pago\n';
      clients.forEach(c => {
        const total = (pmap[c.id] || []).filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0);
        var planoLabel = c.plano_escolhido === 'plano_166' ? 'Com Plano (R$ 1,66/mês)' : c.plano_escolhido === 'sem_plano' ? 'Sem Plano' : (c.produto_escolhido || 'Aguardando');
        csv += `"${c.nome}","${c.cpf}","${c.whatsapp || ''}","${c.email || ''}",${c.status},${c.limite_aprovado || 0},${planoLabel},"${c.dispositivo || ''}","${c.fabricante || ''}","${c.modelo || ''}","${c.os || ''}","${c.navegador || ''}${c.navegador_versao ? ' ' + c.navegador_versao : ''}",${c.created_at || ''},${total}\n`;
      });
      downloadCSV(csv, 'clientes.csv');
      showToast(`${clients.length} clientes exportados`);
    } catch (e) { showToast('Erro ao exportar: ' + e.message, 'error'); }
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function formatCpf(cpf) {
    if (!cpf) return '—';
    const c = cpf.replace(/\D/g, '');
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function statusColor(status) {
    const map = { pendente: 'primary', aprovado: 'success', ativado: 'success', reprovado: 'primary', cancelado: 'primary', pago: 'success', falha: 'primary' };
    return map[status] || 'primary';
  }

  // ============================================================
  // WhatsApp render functions
  async function startApp() {
    $('#btnLogin').addEventListener('click', () => doLogin($('#loginEmail').value, $('#loginPassword').value));
    $('#loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin($('#loginEmail').value, $('#loginPassword').value); });
    $('#loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginPassword').focus(); });
    $('#btnSaveApiUrl').addEventListener('click', () => {
      var url = $('#apiUrlInput').value.trim();
      if (!url) return showToast('Digite a URL do backend', 'error');
      API.setApiUrl(url);
      $('#apiConfigArea').style.display = 'none';
      $('#loginError').style.display = 'none';
      showToast('URL configurada! Tente o login novamente.');
    });
    $('#apiUrlInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#btnSaveApiUrl').click();
    });
    if (location.hash.includes('login')) { location.hash = ''; }
    var storedUrl = API.getApiUrl();
    if (storedUrl && storedUrl !== window.location.origin + '/api') {
      $('#apiUrlInput').value = storedUrl.replace(/\/api$/, '');
    }
    const authed = await checkAuth();
    if (authed) initApp();
  }

  document.addEventListener('DOMContentLoaded', startApp);

  // Expor funções para onclick em HTML dinâmico
  const _win = typeof window !== 'undefined' ? window : {};
  _win.navigateTo = navigateTo;
  _win.viewClient = viewClient;
  _win.exportarClientes = exportarClientes;
  _win.excluirTodosClientes = excluirTodosClientes;
  _win.zerarSistema = zerarSistema;
  // reloadPagamentos é definido via const dentro de renderPagamentos (closure), não está no escopo do IIFE
  _win.renderLogsSistema = renderLogsSistema;
  _win.novoUsuario = novoUsuario;
  _win.marcarLida = marcarLida;
  _win.resetSupportClicks = resetSupportClicks;
  _win.zerarContadores = zerarContadores;
  _win.removeCpfKey = removeCpfKey;
  _win.removeAllCpfKeys = removeAllCpfKeys;

})();