(() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const show = el => el && (el.hidden = false);
  const hide = el => el && (el.hidden = true);
  const fmtMoney = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtDateTime = d => d ? new Date(d).toLocaleString('pt-BR') : '—';

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
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:14px 24px;border-radius:12px;font-size:0.875rem;font-weight:600;color:#fff;background:${type === 'success' ? '#10B981' : '#DC2626'};box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;max-width:90%;text-align:center;`;
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

  function renderPagination(totalPages, current, onChange) {
    if (totalPages <= 1) return '';
    let html = '<div style="display:flex;gap:6px;align-items:center;justify-content:center;margin-top:16px;">';
    html += `<button class="admin-btn-icon" data-page="${current - 1}" ${current <= 1 ? 'disabled style="opacity:0.3"' : ''}>◀</button>`;
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);
    if (start > 1) html += `<button class="admin-btn-icon" data-page="1">1</button>${start > 2 ? '<span style="color:var(--color-text-muted);font-size:0.75rem;">...</span>' : ''}`;
    for (let i = start; i <= end; i++) {
      html += `<button class="admin-btn-icon" data-page="${i}" style="${i === current ? 'background:var(--color-primary);color:#fff;font-weight:700;' : ''}">${i}</button>`;
    }
    if (end < totalPages) html += `${end < totalPages - 1 ? '<span style="color:var(--color-text-muted);font-size:0.75rem;">...</span>' : ''}<button class="admin-btn-icon" data-page="${totalPages}">${totalPages}</button>`;
    html += `<button class="admin-btn-icon" data-page="${current + 1}" ${current >= totalPages ? 'disabled style="opacity:0.3"' : ''}>▶</button>`;
    html += '</div>';
    return html;
  }

  function initApp() {
    const navItems = [
      { key: 'dashboard', icon: '📊', label: 'Dashboard' },
      { key: 'separator-geral', separator: true, label: 'GERENCIAR' },
      { key: 'configuracoes', icon: '⚙️', label: 'Configurações' },
      { key: 'pagamento-config', icon: '🟢', label: 'PIX' },
      { key: 'popup-config', icon: '🪟', label: 'Pop-up' },
      { key: 'pagamentos', icon: '💳', label: 'Pagamentos' },
      { key: 'clients', icon: '👥', label: 'Clientes' },
      { key: 'produtos', icon: '📦', label: 'Produtos' },
      { key: 'solicitacoes', icon: '📋', label: 'Solicitações' },
      { key: 'separator-sistema', separator: true, label: 'SISTEMA' },
      { key: 'api', icon: '🔑', label: 'API CPF' },
      { key: 'notificacoes', icon: '🔔', label: 'Notificações' },
      { key: 'usuarios', icon: '👤', label: 'Usuários' },
      { key: 'logs-sistema', icon: '📋', label: 'Logs Sistema' },
      { key: 'trocar-senha', icon: '🔐', label: 'Trocar Senha' },
    ];

    const nav = $('#adminNav');
    nav.innerHTML = navItems
      .map(item => item.separator
        ? `<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);padding:16px 12px 6px;font-weight:700;">${item.label}</div>`
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

    const initialRoute = location.hash.replace('#', '') || 'dashboard';
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
    main.innerHTML = '<div style="text-align:center; padding:60px; color:var(--color-text-muted);">Carregando...</div>';
    try {
      switch (route) {
        case 'dashboard': await renderDashboard(main); break;
        case 'configuracoes': await renderConfiguracoes(main); break;
        case 'pagamento-config': await renderPagamentoConfig(main); break;
        case 'popup-config': await renderPopupConfig(main); break;
        case 'pagamentos': await renderPagamentos(main); break;
        case 'clients': await renderClients(main); break;
        case 'produtos': await renderProdutos(main); break;
        case 'solicitacoes': await renderSolicitacoes(main); break;
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
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">Dashboard</h1>
        <div style="display:flex;gap:16px;align-items:center;">
          <span style="font-size:0.8125rem;color:var(--color-text-light);">👁️ Páginas visitadas: <strong>${k.pageViewCount ?? 0}</strong></span>
          <span style="font-size:0.8125rem;color:var(--color-text-light);">💬 Suporte WhatsApp: <strong>${k.supportClickCount ?? 0}</strong></span>
          <button class="btn btn--sm btn--ghost" onclick="resetSupportClicks()">Limpar</button>
        </div>
      </header>
      <div class="admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 24px;">
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.2);">
          <div class="admin-card__label">Total Usuários</div>
          <div class="admin-card__value" style="font-size:2rem;">${k.totalClients}</div>
        </article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(251,146,60,0.12),rgba(251,146,60,0.05));border:1px solid rgba(251,146,60,0.2);">
          <div class="admin-card__label">📊 Expectativa de Receita</div>
          <div class="admin-card__value" style="font-size:1.5rem;color:var(--color-orange);">${fmtMoney(k.expectativaReceita ?? 0)}</div>
        </article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.2);">
          <div class="admin-card__label">📋 PIX Copiados</div>
          <div class="admin-card__value" style="font-size:2rem;color:var(--color-green);">${k.totalPixCopies ?? 0}</div>
        </article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.05));border:1px solid rgba(99,102,241,0.2);">
          <div class="admin-card__label">🔗 PushinPay Cliques</div>
          <div class="admin-card__value" style="font-size:2rem;">${k.totalPushinpayClicks ?? 0}</div>
        </article>
      </div>
      <div class="admin-grid">
        <article class="admin-card"><div class="admin-card__label">📋 Pendentes</div><div class="admin-card__value" style="color:var(--color-blue-dark);">${k.pendingClients}</div></article>
        <article class="admin-card"><div class="admin-card__label">✅ Aprovados</div><div class="admin-card__value" style="color:var(--color-green);">${k.approvedClients}</div></article>
        <article class="admin-card"><div class="admin-card__label">✅ Ativados</div><div class="admin-card__value">${k.activatedClients}</div></article>
        <article class="admin-card" style="background:linear-gradient(135deg,rgba(25,211,166,0.12),rgba(25,211,166,0.05));border:1px solid rgba(25,211,166,0.2);"><div class="admin-card__label">🟢 Online Agora</div><div class="admin-card__value" style="color:var(--color-green);font-size:1.5rem;">${k.onlineAgora ?? 0}</div></article>
        <article class="admin-card"><div class="admin-card__label">💳 Pagos PIX</div><div class="admin-card__value">${k.pixPayments}</div></article>
        <article class="admin-card"><div class="admin-card__label">💳 Pagos Cartão</div><div class="admin-card__value">${k.cardPayments}</div></article>
      </div>
      <section class="admin-card" style="grid-column:1/-1; margin-top: 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 class="admin-form__section-title" style="margin:0;">Últimos cadastros</h2>
          <button class="btn btn--primary btn--sm" onclick="navigateTo('clients')">Ver todos →</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>WhatsApp</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>${data.recentClients.map(c => `
              <tr>
                <td>${c.nome}</td>
                <td>${formatCpf(c.cpf)}</td>
                <td>${c.whatsapp || '—'}</td>
                <td>${fmtDate(c.created_at)}</td>
                <td><span class="badge badge--${statusColor(c.status)}">${c.status}</span></td>
                <td><button class="admin-btn-icon" onclick="viewClient('${c.id}')" title="Ver detalhes">👁️</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <section class="admin-card" style="grid-column:1/-1; margin-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 class="admin-form__section-title" style="margin:0;">Últimos pagamentos</h2>
          <button class="btn btn--primary btn--sm" onclick="navigateTo('pagamentos')">Ver todos →</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Cliente</th><th>Método</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>${data.recentPayments.map(p => `
              <tr>
                <td>${p.client_nome || '—'}</td>
                <td>${p.metodo}</td>
                <td>${fmtMoney(p.valor)}</td>
                <td><span class="badge badge--${statusColor(p.status)}">${p.status}</span></td>
                <td>${fmtDate(p.paid_at || p.created_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  async function viewClient(id) {
    try {
      const data = await API.getClient(id);
      const c = data.client;
      const reqs = data.requests || [];
      const pays = data.payments || [];
      const main = $('#adminMain');
      var devIcon = '💻';
      if (c.dispositivo === 'Android') devIcon = '📱';
      else if (c.dispositivo === 'iPhone') devIcon = '📱';
      var waLink = c.whatsapp ? 'https://wa.me/55' + c.whatsapp.replace(/\D/g, '') : null;

      main.innerHTML = `
        <header class="admin-header" style="margin-bottom:16px;">
          <h1 class="admin-header__title">👤 ${c.nome}</h1>
          <div style="display:flex;gap:8px;">
            ${waLink ? '<a href="' + waLink + '" target="_blank" class="btn btn--success btn--sm" style="text-decoration:none;">💬 WhatsApp</a>' : ''}
            <button class="btn btn--primary btn--sm" onclick="navigateTo('clients')">← Voltar</button>
          </div>
        </header>
        <div class="admin-grid" style="grid-template-columns:1fr 1fr;">
          <section class="admin-card">
            <h2 class="admin-form__section-title">Dados do Cliente</h2>
            <div style="display:grid;gap:8px;font-size:0.85rem;">
              <div><strong>CPF:</strong> ${formatCpf(c.cpf)}</div>
              <div><strong>WhatsApp:</strong> ${c.whatsapp || '—'}</div>
              <div><strong>E-mail:</strong> ${c.email || '—'}</div>
              <div><strong>Status:</strong> <span class="badge badge--${statusColor(c.status)}">${c.status}</span></div>
              <div><strong>Limite:</strong> ${c.limite_aprovado ? fmtMoney(c.limite_aprovado) : '—'}</div>
              <div><strong>Produto:</strong> ${c.produto_escolhido || '—'}</div>
              <div><strong>Dispositivo:</strong> ${devIcon} ${c.dispositivo || '—'}${c.modelo && c.dispositivo !== 'iPhone' ? ' · ' + c.modelo : ''}</div>
              <div><strong>Cadastro:</strong> ${fmtDateTime(c.created_at)}</div>
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
          <h2 class="admin-form__section-title">Solicitações (${reqs.length})</h2>
          ${!reqs.length ? '<p style="color:var(--color-text-muted);">Nenhuma solicitação</p>' : '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>Tipo</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead><tbody>' + reqs.map(r => `<tr><td>${r.id?.slice(0,8)}</td><td>${r.tipo_produto}</td><td>${fmtMoney(r.valor_total)}</td><td><span class="badge badge--${statusColor(r.status)}">${r.status}</span></td><td>${fmtDate(r.created_at)}</td></tr>`).join('') + '</tbody></table></div>'}
        </section>
        <section class="admin-card" style="margin-top:16px;">
          <h2 class="admin-form__section-title">Pagamentos (${pays.length}) — Total: ${fmtMoney(pays.filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0))}</h2>
          ${!pays.length ? '<p style="color:var(--color-text-muted);">Nenhum pagamento</p>' : '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Método</th><th>Detalhes</th><th>Valor</th><th>Status</th><th>Transação</th><th>Data</th></tr></thead><tbody>' + pays.map(p => {
            const metodoLabel = p.metodo === 'pix' ? 'PIX' : p.metodo === 'pushinpay' ? 'PushinPay' : p.metodo === 'cartao' ? 'Cartão' : p.metodo;
            const detalhes = p.metodo === 'cartao' ? (p.card_brand ? p.card_brand.toUpperCase() + ' ' : '') + '**** ' + (p.card_last_four || '----') + ' · ' + (p.parcelas || 1) + 'x' : p.metodo === 'pix' ? (p.pix_chave ? 'Payload gerado' : '') : '';
            return '<tr><td>' + metodoLabel + '</td><td style="font-size:0.78rem;color:var(--color-text-muted);">' + detalhes + '</td><td>' + fmtMoney(p.valor) + '</td><td><span class="badge badge--' + statusColor(p.status) + '">' + p.status + '</span></td><td style="font-family:monospace;font-size:0.75rem;">' + (p.transaction_id || (p.id ? p.id.slice(0,8) : '') || '—') + '</td><td>' + fmtDate(p.paid_at || p.created_at) + '</td></tr>';
          }).join('') + '</tbody></table></div>'}
        </section>
      `;
    } catch (e) {
      showToast('Erro ao carregar cliente: ' + e.message, 'error');
    }
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
        <h2 class="admin-form__section-title">📱 Página de Sucesso / APK</h2>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>URL do APK para download (após pagamento aprovado)</label>
            <input type="url" id="settApkUrl" value="${data.settings.apk_url || ''}" placeholder="https://seusite.com/app.apk">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Link direto para o arquivo .apk. Aparecerá na página de parabéns após o pagamento ser aprovado.</div>
          </div>
        </div>
        <button id="btnSaveApkUrl" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR URL DO APK</button>
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
    $('#btnSaveApkUrl')?.addEventListener('click', async () => {
      try {
        await API.saveSettings({ apk_url: $('#settApkUrl').value });
        showToast('URL do APK salva!');
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
          payment_methods: JSON.stringify(selected)
        });
        showToast('Configuração salva com sucesso!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
  }

  async function renderPopupConfig(container) {
    const data = await API.getSettings();
    let popupConfig = {};
    try { if (data.settings.popup_config) popupConfig = JSON.parse(data.settings.popup_config); } catch {}
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">🪟 Pop-up Promocional</h1>
      </header>
      <section class="admin-card admin-form">
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:20px;background:rgba(59,130,246,0.08);padding:14px;border-radius:8px;border:1px solid rgba(59,130,246,0.2);">
          O pop-up aparece na <strong>página inicial</strong> após <strong>700ms</strong>, com um timer de <strong>10 segundos</strong> e fecha automaticamente. O usuário vê apenas uma vez por sessão.
        </p>
        <div class="form-grid">
          <div class="form-group form-group--half">
            <label>Ativar pop-up</label>
            <label class="form-checkbox--single" style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <input type="checkbox" id="settPopupEnabled" ${popupConfig.enabled !== false ? 'checked' : ''}>
              <span style="font-size:0.85rem;">Pop-up ativo</span>
            </label>
          </div>
          <div class="form-group form-group--half">
            <label>Texto do CTA</label>
            <input type="text" id="settPopupCta" value="${(popupConfig.cta || 'Solicitar Vale Saúde').replace(/"/g, '&quot;')}" placeholder="Solicitar Vale Saúde">
          </div>
          <div class="form-group form-group--full">
            <label>Título</label>
            <input type="text" id="settPopupTitle" value="${(popupConfig.title || 'Mais economia. Mais praticidade. Mais saúde.').replace(/"/g, '&quot;')}" placeholder="Título do pop-up">
          </div>
          <div class="form-group form-group--full">
            <label>Subtítulo / Texto de apoio</label>
            <textarea id="settPopupSubtitle" rows="3" style="width:100%;padding:10px 14px;border-radius:8px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text);font-family:inherit;font-size:0.85rem;resize:vertical;">${(popupConfig.subtitle || 'Descontos de até 75% em medicamentos e produtos de farmácia.').replace(/"/g, '&quot;')}</textarea>
          </div>
        </div>
        <button id="btnSavePopupConfig" class="btn btn--primary" style="margin-top:var(--space-lg);">SALVAR POP-UP</button>
      </section>
    `;
    $('#btnSavePopupConfig').addEventListener('click', async () => {
      try {
        await API.saveSettings({
          popup_config: JSON.stringify({
            enabled: $('#settPopupEnabled').checked,
            title: $('#settPopupTitle').value,
            subtitle: $('#settPopupSubtitle').value,
            cta: $('#settPopupCta').value
          })
        });
        showToast('Pop-up salvo com sucesso!');
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
      }
    });
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
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
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
        await fetch('/api/payments/' + pid + '/status', { method: 'PATCH' });
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

  async function renderClients(container, page) {
    const pageSize = 20;
    const p = page || currentPage.clients || 1;
    const filtro = currentFilter.clients || '';
    const params = `limit=${pageSize}&page=${p}${filtro ? '&status=' + filtro : ''}`;
    const data = await API.getClients(params);
    const payments = await API.getPayments('limit=500');
    const paymentMap = {};
    payments.payments.forEach(pay => {
      if (!paymentMap[pay.client_id]) paymentMap[pay.client_id] = [];
      paymentMap[pay.client_id].push(pay);
    });

    const statusOptions = ['', 'pendente', 'aprovado', 'ativado', 'reprovado', 'cancelado'];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">Clientes</h1>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="clientStatusFilter" style="padding:10px 12px;border:1px solid var(--color-gray-200);border-radius:var(--radius-sm);font-size:0.875rem;">
            ${statusOptions.map(s => `<option value="${s}" ${filtro === s ? 'selected' : ''}>${s ? 'Status: ' + s : 'Todos os status'}</option>`).join('')}
          </select>
          <input type="text" id="clientSearch" placeholder="Buscar por nome ou CPF..." style="padding:10px 14px; border:1px solid var(--color-gray-200); border-radius:var(--radius-sm); font-size:0.875rem; width:200px;">
          <button class="btn btn--primary btn--sm" onclick="exportarClientes()" title="Exportar CSV">📥 CSV</button>
          <button class="btn btn--danger btn--sm" onclick="excluirTodosClientes()">🗑️ Excluir Todos</button>
        </div>
      </header>
      <section class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>WhatsApp</th><th>Dispositivo</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody id="clientsTableBody">${renderClientRows(data.clients, paymentMap)}</tbody>
          </table>
        </div>
        <div id="clientsPagination">${renderPagination(data.pages || 1, p, 'clients')}</div>
      </section>
      <div id="clientPaymentDetail" style="display:none;"></div>
    `;

    const reloadClientes = async () => {
      const np = currentPage.clients || 1;
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
      await renderClients(container, np);
    };

    $('#clientSearch')?.addEventListener('input', async (e) => {
      const s = e.target.value.trim();
      if (s.length < 2 && s.length > 0) return;
      const params2 = s.length >= 2 ? `search=${encodeURIComponent(s)}&limit=${pageSize}` : `limit=${pageSize}&page=${currentPage.clients || 1}${currentFilter.clients ? '&status=' + currentFilter.clients : ''}`;
      const results = await API.getClients(params2);
      const pay = await API.getPayments('limit=500');
      const pmap = {};
      pay.payments.forEach(p => { if (!pmap[p.client_id]) pmap[p.client_id] = []; pmap[p.client_id].push(p); });
      $('#clientsTableBody').innerHTML = renderClientRows(results.clients, pmap);
      const pagEl = $('#clientsPagination');
      if (pagEl && results.pages) pagEl.innerHTML = renderPagination(results.pages, currentPage.clients || 1, 'clients');
    });

    $('#clientStatusFilter')?.addEventListener('change', async (e) => {
      currentFilter.clients = e.target.value;
      currentPage.clients = 1;
      await reloadClientes();
    });

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
        const limite = await showPromptModal('Limite aprovado (R$):', '1500', 'Ex: 1500');
        if (limite) { await API.updateClientStatus(id, 'aprovado', parseFloat(limite)); showToast('Cliente aprovado com limite de ' + fmtMoney(limite)); await reloadClientes(); }
      } else if (action === 'reject') {
        if (await showConfirmModal('Rejeitar cliente', 'Tem certeza que deseja rejeitar este cliente?', 'Rejeitar', 'Cancelar')) { await API.updateClientStatus(id, 'reprovado'); showToast('Cliente rejeitado'); await reloadClientes(); }
      } else if (action === 'delete') {
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
      }
    });
  }

  function renderClientRows(clients, paymentMap) {
    if (!clients.length) return '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);">Nenhum cliente encontrado</td></tr>';
    return clients.map(c => {
      var disp = c.dispositivo || '';
      var modelo = c.modelo ? c.modelo.slice(0, 60) : '';
      var dispIcon = disp === 'Android' ? '📱' : disp === 'iPhone' ? '📱' : disp === 'Windows' ? '💻' : disp === 'Mac' ? '💻' : '';
      var dispLabel = dispIcon + ' ' + disp;
      if (disp === 'Android' && modelo) dispLabel += ' · ' + modelo;
      if (disp === 'iPhone') dispLabel = '📱 iPhone';
      const waNum = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
      const waLink = waNum ? 'https://wa.me/55' + waNum + '?text=' + encodeURIComponent('Ol\u00e1, estou falando com voc\u00ea referente ao seu cart\u00e3o Vale Sa\u00fade.') : '';
      return `<tr>
        <td><strong>${c.nome}</strong></td>
        <td>${formatCpf(c.cpf)}</td>
        <td>${waLink ? `<a href="${waLink}" target="_blank" style="color:var(--color-secondary);font-weight:600;text-decoration:none;" title="Abrir conversa no WhatsApp">${c.whatsapp}</a>` : (c.whatsapp || '—')}</td>
        <td style="font-size:0.78rem;color:var(--color-text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${modelo}">${dispLabel}</td>
        <td><span class="badge badge--${statusColor(c.status)}">${c.status}</span></td>
        <td style="font-size:0.78rem;color:var(--color-text-muted);">${fmtDate(c.created_at || '')}</td>
        <td class="admin-table__actions">
          <button class="admin-btn-icon" onclick="viewClient('${c.id}')" title="Ver detalhes">👁️</button>
          <button class="admin-btn-icon" data-action="view-payments" data-id="${c.id}" data-nome="${c.nome}" data-cpf="${c.cpf}" title="Ver pagamentos">💳</button>
          ${c.status === 'pendente' ? `
            <button class="admin-btn-icon" data-action="approve" data-id="${c.id}" title="Aprovar">✅</button>
            <button class="admin-btn-icon admin-btn-icon--danger" data-action="reject" data-id="${c.id}" title="Rejeitar">❌</button>
          ` : ''}
          <button class="admin-btn-icon admin-btn-icon--danger" data-action="delete" data-id="${c.id}" title="Excluir">🗑️</button>
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
  // Produtos
  // ============================================================

  async function renderProdutos(container) {
    const [products, plans] = await Promise.all([API.getProducts(), API.getPlans()]);
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📦 Produtos e Planos</h1>
        <button class="btn btn--primary btn--sm" data-action="refresh-produtos">🔄</button>
      </header>
      <section class="admin-card" style="margin-bottom:var(--space-md);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 class="admin-form__section-title" style="margin:0;">Produtos</h2>
          <button class="btn btn--primary btn--sm" data-action="novo-produto">+ Novo Produto</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table" id="produtosTable">
            <thead><tr><th>Nome</th><th>Tipo</th><th>Preço</th><th>Ativo</th><th>Ações</th></tr></thead>
            <tbody>${products.map(p => `
              <tr>
                <td>${p.nome}</td>
                <td>${p.tipo}</td>
                <td><span class="price-display" data-id="${p.id}" data-preco="${p.preco}" style="color:var(--color-green);font-weight:700;cursor:pointer;">${fmtMoney(p.preco)}</span></td>
                <td>${p.ativo ? '✅' : '❌'}</td>
                <td>
                  <button class="btn btn--danger btn--sm" data-action="delete-produto" data-id="${p.id}">🗑️</button>
                </td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </section>
      <section class="admin-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 class="admin-form__section-title" style="margin:0;">Planos</h2>
          <button class="btn btn--primary btn--sm" data-action="novo-plano">+ Novo Plano</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>Limite</th><th>Preço Mensal</th><th>Ativo</th><th>Ações</th></tr></thead>
            <tbody>${plans.map(p => `
              <tr>
                <td>${p.nome}</td>
                <td>${fmtMoney(p.limite)}</td>
                <td>${fmtMoney(p.preco_mensal)}</td>
                <td>${p.ativo ? '✅' : '❌'}</td>
                <td>
                  <button class="btn btn--primary btn--sm" data-action="edit-plano" data-id="${p.id}" data-nome="${p.nome}" data-limite="${p.limite}" data-preco="${p.preco_mensal}">✏️</button>
                </td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </section>
    `;

    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'refresh-produtos') { navigateTo('produtos'); return; }
        if (action === 'novo-produto') {
          const nome = await showPromptModal('Nome do Produto', '', 'Ex: Vale Saúde Plus');
          if (!nome) return;
          const tipo = await showPromptModal('Tipo (virtual/fisico)', 'virtual', 'virtual ou fisico');
          if (!tipo) return;
          const preco = await showPromptModal('Preço (R$)', '9.99', 'Ex: 9.99');
          if (!preco) return;
          try { await API.createProduct({ nome, tipo, preco: parseFloat(preco) }); showToast('Produto criado'); navigateTo('produtos'); } catch (e) { showToast(e.message, 'error'); }
          return;
        }
        if (action === 'delete-produto') {
          const id = btn.dataset.id;
          if (!await showConfirmModal('Excluir Produto', 'Tem certeza?', 'Excluir', 'Cancelar')) return;
          try { await API.deleteProduct(id); showToast('Produto excluído'); navigateTo('produtos'); } catch (e) { showToast(e.message, 'error'); }
          return;
        }
        if (action === 'novo-plano') {
          const nome = await showPromptModal('Nome do Plano', '', 'Ex: Premium');
          if (!nome) return;
          const limite = await showPromptModal('Limite (R$)', '1500');
          if (!limite) return;
          const preco = await showPromptModal('Preço Mensal (R$)', '0');
          if (!preco) return;
          try { await API.createPlan({ nome, limite: parseFloat(limite), preco_mensal: parseFloat(preco) }); showToast('Plano criado'); navigateTo('produtos'); } catch (e) { showToast(e.message, 'error'); }
          return;
        }
        if (action === 'edit-plano') {
          const id = btn.dataset.id;
          const nomeAtual = btn.dataset.nome;
          const limiteAtual = btn.dataset.limite;
          const precoAtual = btn.dataset.preco;
          const nome = await showPromptModal('Nome do Plano', nomeAtual);
          if (!nome) return;
          const limite = await showPromptModal('Limite (R$)', String(limiteAtual));
          if (!limite) return;
          const preco = await showPromptModal('Preço Mensal (R$)', String(precoAtual));
          if (!preco) return;
          try { await API.updatePlan(id, { nome, limite: parseFloat(limite), preco_mensal: parseFloat(preco) }); showToast('Plano atualizado'); navigateTo('produtos'); } catch (e) { showToast(e.message, 'error'); }
          return;
        }
        return;
      }
      const priceSpan = e.target.closest('.price-display');
      if (priceSpan && !priceSpan.querySelector('input')) {
        const td = priceSpan.closest('td');
        const id = priceSpan.dataset.id;
        const precoAtual = priceSpan.dataset.preco;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.01';
        inp.value = precoAtual;
        inp.style.cssText = 'width:80px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;font-size:0.85rem;';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salvar';
        saveBtn.style.cssText = 'padding:6px 12px;border-radius:8px;border:none;background:linear-gradient(90deg,#3B82F6,#4CC8A4);color:#fff;font-size:0.78rem;font-weight:700;cursor:pointer;margin-left:6px;';
        td.innerHTML = '';
        td.appendChild(inp);
        td.appendChild(saveBtn);
        inp.focus();
        inp.select();
        const doSave = async () => {
          const v = parseFloat(inp.value);
          if (isNaN(v) || v <= 0) { showToast('Preço inválido', 'error'); inp.focus(); return; }
          saveBtn.disabled = true;
          saveBtn.textContent = '...';
          try {
            await API.updateProduct(id, { preco: v });
            showToast('Preço atualizado');
            navigateTo('produtos');
          } catch (e) { showToast(e.message, 'error'); saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
        };
        saveBtn.onclick = doSave;
        inp.onkeydown = ev => { if (ev.key === 'Enter') doSave(); if (ev.key === 'Escape') navigateTo('produtos'); };
        var cancelling = false;
        function cancelEdit(ev) {
          if (cancelling) return;
          var target = ev.target;
          if (target === inp || target === saveBtn || td.contains(target)) return;
          cancelling = true;
          document.removeEventListener('click', cancelEdit);
          navigateTo('produtos');
        }
        setTimeout(function() { document.addEventListener('click', cancelEdit); }, 0);
      }
    });
  }

  // ============================================================
  // Solicitações
  // ============================================================

  async function renderSolicitacoes(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.getRequests('limit=50');
    const reqs = data.requests || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📋 Solicitações</h1>
        <span style="font-size:0.8rem;color:var(--color-text-muted);">${data.total || reqs.length} registros</span>
      </header>
      <section class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Valor</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>${reqs.map(r => `
              <tr>
                <td>${r.client_nome || '—'}</td>
                <td>${r.tipo_produto}</td>
                <td>${fmtMoney(r.valor_total)}</td>
                <td><span class="badge badge--${statusColor(r.status)}">${r.status}</span></td>
                <td>${fmtDate(r.created_at)}</td>
                <td>
                  ${r.status === 'pendente' ? `<button class="btn btn--success btn--sm" onclick="aprovarSolicitacao('${r.id}')">✅ Aprovar</button> <button class="btn btn--danger btn--sm" onclick="reprovarSolicitacao('${r.id}')">❌ Rejeitar</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </section>
    `;
  }

  async function aprovarSolicitacao(id) {
    const limite = await showPromptModal('Limite aprovado (R$):', '1500');
    if (!limite) return;
    try { await API.updateRequestStatus(id, 'aprovado', parseFloat(limite)); showToast('Solicitação aprovada'); navigateTo('solicitacoes'); } catch (e) { showToast(e.message, 'error'); }
  }

  async function reprovarSolicitacao(id) {
    if (!await showConfirmModal('Rejeitar Solicitação', 'Tem certeza?', 'Rejeitar', 'Cancelar')) return;
    try { await API.updateRequestStatus(id, 'reprovado'); showToast('Solicitação rejeitada'); navigateTo('solicitacoes'); } catch (e) { showToast(e.message, 'error'); }
  }

  // ============================================================
  // Notificações
  // ============================================================

  async function renderNotificacoes(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
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
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.getUsers();
    const users = data.users || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">👤 Usuários do Sistema</h1>
        <button class="btn btn--primary btn--sm" onclick="novoUsuario()">+ Novo Usuário</button>
      </header>
      <section class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Permissões</th><th>Ativo</th></tr></thead>
            <tbody>${users.map(u => `
              <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><span class="badge badge--${u.role === 'admin' ? 'success' : 'primary'}">${u.role}</span></td>
                <td style="font-size:0.75rem;">${(u.permissions || []).join(', ') || '—'}</td>
                <td>${u.active ? '✅' : '❌'}</td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </section>
    `;
  }

  async function novoUsuario() {
    const name = await showPromptModal('Nome do usuário', '', 'Ex: João');
    if (!name) return;
    const email = await showPromptModal('E-mail', '', 'joao@exemplo.com');
    if (!email) return;
    const password = await showPromptModal('Senha', '', 'mínimo 6 caracteres');
    if (!password || password.length < 6) return showToast('Senha deve ter no mínimo 6 caracteres', 'error');
    const role = await showPromptModal('Função (admin/operador/suporte)', 'operador');
    if (!role) return;
    try { await API.createUser({ name, email, password, role }); showToast('Usuário criado'); navigateTo('usuarios'); } catch (e) { showToast(e.message, 'error'); }
  }

  // ============================================================
  // Logs do Sistema
  // ============================================================

  async function renderLogsSistema(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
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
      const resp = await fetch('/api/clients/delete-all', { method: 'POST' });
      const data = await resp.json();
      showToast(data.message || 'Todos os clientes foram excluídos');
      navigateTo('clients');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function zerarSistema() {
    try {
      const resp = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await resp.json();
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
      let csv = 'Nome,CPF,WhatsApp,E-mail,Status,Limite,Produto,Data Cadastro,Total Pago\n';
      clients.forEach(c => {
        const total = (pmap[c.id] || []).filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0);
        csv += `"${c.nome}","${c.cpf}","${c.whatsapp || ''}","${c.email || ''}",${c.status},${c.limite_aprovado || 0},${c.produto_escolhido || ''},${c.created_at || ''},${total}\n`;
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
  // ============================================================

  let waPollTimer = null;

  function waStatusDot(s) { return 'status-dot--' + (s || 'starting'); }
  function waStatusLabel(s) { return ({ connected:'Conectado', awaiting_qr:'Aguardando QR', reconnecting:'Reconectando', starting:'Iniciando', offline:'Desconectado', auth_failure:'Falha Auth', error:'Erro' })[s] || s; }
  function waStatusTag(s) { return ({ connected:'success', awaiting_qr:'primary', reconnecting:'warning', starting:'info', offline:'primary', auth_failure:'primary', error:'primary' })[s] || 'info'; }

  async function renderWADashboard(container) {
    try {
      const [status, dash] = await Promise.all([API.waStatus(), API.waDashboard()]);
      const accounts = status.accounts || [];
      const connected = accounts.filter(a => a.state === 'connected').length;
      const offline = accounts.filter(a => a.state !== 'connected').length;
      const qStats = await API.waQueue();
      const queueStats = qStats.stats || { pending:0, processing:0, completed:0, failed:0, deadletter:0, total:0 };
      container.innerHTML = `
        <header class="admin-header">
          <h1 class="admin-header__title">WhatsApp Status</h1>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge--${waStatusTag(status.state || 'connected')}">${waStatusLabel(status.state || 'connected')}</span>
            <button class="btn btn--primary btn--sm" onclick="navigateTo('wa-contas')">Gerenciar Contas</button>
          </div>
        </header>
        <section class="admin-card">
          <div class="admin-form__section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>📊 KPIs do Servidor WhatsApp</span>
            <span class="badge badge--primary">${dash.accounts?.total || 0} contas</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:16px;">
            <div style="background:var(--color-gray-light);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:var(--color-green);">${connected}</div><div style="font-size:0.75rem;color:var(--color-text-muted);">Conectadas</div></div>
            <div style="background:var(--color-gray-light);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${offline}</div><div style="font-size:0.75rem;color:var(--color-text-muted);">Offline</div></div>
            <div style="background:var(--color-gray-light);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:var(--color-green);">${queueStats.completed || 0}</div><div style="font-size:0.75rem;color:var(--color-text-muted);">Completadas</div></div>
            <div style="background:var(--color-gray-light);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${queueStats.pending || 0}</div><div style="font-size:0.75rem;color:var(--color-text-muted);">Pendentes</div></div>
            <div style="background:var(--color-gray-light);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${queueStats.failed || 0}</div><div style="font-size:0.75rem;color:var(--color-text-muted);">Falhas</div></div>
            <div style="background:var(--color-gray-light);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;">${queueStats.total || 0}</div><div style="font-size:0.75rem;color:var(--color-text-muted);">Total</div></div>
          </div>
        </section>
        <section class="admin-card" style="margin-top:var(--space-md);">
          <h2 class="admin-form__section-title">👤 Contas</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:12px;">${accounts.map((a, i) => `
            <div style="background:var(--color-gray-light);border-radius:12px;padding:14px;border:1px solid var(--color-gray-200);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="font-size:0.85rem;">${a.label || 'Conta ' + (i+1)}</strong>
                <span class="badge badge--${waStatusTag(a.state)}">${waStatusLabel(a.state)}</span>
              </div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">${a.profileName ? '<div>👤 ' + a.profileName + '</div>' : ''}${a.connectedAt ? '<div>📅 ' + fmtDate(a.connectedAt) + '</div>' : ''}${a.lastSendAt ? '<div>📤 ' + fmtDateTime(a.lastSendAt) + '</div>' : ''}</div>
            </div>`).join('')}</div>
        </section>
      `;
    } catch (e) {
      container.innerHTML = `<div style="color:#DC2626;padding:40px;text-align:center;"><div style="font-size:2rem;margin-bottom:12px;">⚠️</div><p style="font-size:1rem;">Erro ao conectar ao WhatsApp Server</p><p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:8px;">${e.message}</p><p style="margin-top:16px;"><strong>Configure a URL do WhatsApp Server</strong> em Configurações > WhatsApp Server URL</p></div>`;
    }
  }

  async function renderWAContas(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const health = await API.waStatus();
    const accounts = health.accounts || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📱 Contas WhatsApp</h1>
        <button class="btn btn--primary btn--sm" onclick="renderWAContas(document.getElementById('adminMain'))">🔄 Atualizar</button>
      </header>
      <section class="admin-card">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">${accounts.map((a, i) => {
          const qrHtml = (a.qr && a.state === 'awaiting_qr') ? `<div style="text-align:center;padding:12px;"><img src="${a.qr}" alt="QR" style="width:160px;height:160px;border-radius:8px;background:#fff;padding:6px;border:1px solid var(--color-gray-200);"><p style="font-size:0.72rem;color:var(--color-text-muted);margin-top:6px;">Escaneie com WhatsApp</p></div>` : '';
          const profileHtml = a.profileName ? `<div style="margin-bottom:8px;"><strong>${a.profileName}</strong>${a.profileNumber ? '<br><small style="color:var(--color-text-muted);">' + a.profileNumber + '</small>' : ''}</div>` : '';
          return `<div style="background:var(--color-gray-light);border-radius:16px;padding:18px;border:1px solid var(--color-gray-200);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <strong>${a.label || 'Conta ' + (i+1)}</strong>
              <span class="badge badge--${waStatusTag(a.state)}">${waStatusLabel(a.state)}</span>
            </div>
            ${profileHtml}
            <div style="font-size:0.78rem;color:var(--color-text-muted);line-height:1.6;">${a.connectedAt ? '<div>📅 Conectado: ' + fmtDateTime(a.connectedAt) + '</div>' : ''}${a.lastSendAt ? '<div>📤 Último envio: ' + fmtDateTime(a.lastSendAt) + '</div>' : ''}${a.lastError ? '<div style="color:#DC2626;">⚠️ ' + (a.lastError.error || '') + '</div>' : ''}</div>
            ${qrHtml}
            <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
              <button class="btn btn--success btn--sm" onclick="waConnect(${i})">Conectar</button>
              <button class="btn btn--primary btn--sm" onclick="waReconnect(${i})">Reconectar</button>
              <button class="btn btn--danger btn--sm" onclick="waDisconnect(${i})">Desconectar</button>
            </div>
          </div>`;
        }).join('')}</div>
      </section>
    `;
  }

  async function waConnect(i) { try { await API.waAccountConnect(i); showToast('Conectando conta ' + (i+1)); } catch(e) { showToast(e.message, 'error'); } }
  async function waReconnect(i) { try { await API.waAccountReconnect(i); showToast('Reconectando conta ' + (i+1)); } catch(e) { showToast(e.message, 'error'); } }
  async function waDisconnect(i) { try { await API.waAccountDisconnect(i); showToast('Desconectando conta ' + (i+1)); } catch(e) { showToast(e.message, 'error'); } }

  async function renderWAFila(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.waQueue();
    const stats = data.stats || { pending:0, processing:0, completed:0, failed:0, deadletter:0, total:0 };
    const messages = data.messages || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📨 Fila de Mensagens</h1>
        <button class="btn btn--primary btn--sm" onclick="renderWAFila(document.getElementById('adminMain'))">🔄</button>
      </header>
      <section class="admin-card">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:16px;">
          <div style="background:var(--color-gray-light);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:var(--color-primary);">${stats.pending}</div><div style="font-size:0.65rem;color:var(--color-text-muted);">Pendentes</div></div>
          <div style="background:var(--color-gray-light);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:var(--color-green);">${stats.completed}</div><div style="font-size:0.65rem;color:var(--color-text-muted);;">Completados</div></div>
          <div style="background:var(--color-gray-light);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:#DC2626;">${stats.failed}</div><div style="font-size:0.65rem;color:var(--color-text-muted);">Falhas</div></div>
          <div style="background:var(--color-gray-light);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:#DC2626;">${stats.deadletter}</div><div style="font-size:0.65rem;color:var(--color-text-muted);">Dead Letter</div></div>
          <div style="background:var(--color-gray-light);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.3rem;font-weight:700;">${stats.total}</div><div style="font-size:0.65rem;color:var(--color-text-muted);">Total</div></div>
        </div>
        <div style="max-height:400px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;">
          ${!messages.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Fila vazia</div>' : messages.map(m => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--color-gray-200);font-size:0.78rem;">
            <span style="font-weight:600;font-family:monospace;min-width:100px;">${m.to || m.number || '---'}</span>
            <span style="color:var(--color-text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(m.message || m.body || '').slice(0, 80)}</span>
            <span class="badge badge--${m.status === 'completed' ? 'success' : m.status === 'failed' || m.status === 'deadletter' ? 'primary' : 'warning'}">${m.status || 'pending'}</span>
            <span style="color:var(--color-text-muted);font-size:0.7rem;">${m.retryCount ? 'tentativa ' + m.retryCount : ''}</span>
          </div>`).join('')}
        </div>
      </section>
    `;
  }

  async function renderWAMensagens(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.waMessages('limit=100');
    const msgs = data.messages || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">💬 Mensagens Enviadas</h1>
        <button class="btn btn--primary btn--sm" onclick="renderWAMensagens(document.getElementById('adminMain'))">🔄</button>
      </header>
      <section class="admin-card">
        <div style="max-height:500px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;">
          <table class="admin-table"><thead><tr><th>Data</th><th>Número</th><th>Status</th><th>Origem</th></tr></thead>
            <tbody>${msgs.map(m => `<tr><td>${fmtDateTime(m.timestamp)}</td><td style="font-family:monospace;">${m.to}</td><td><span class="badge badge--${m.status === 'delivered' ? 'success' : m.status === 'failed' ? 'primary' : 'warning'}">${m.status}</span></td><td>${m.source || 'api'}</td></tr>`).join('')}</tbody>
          </table>
          ${!msgs.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhuma mensagem ainda</div>' : ''}
        </div>
      </section>
    `;
  }

  async function renderWATemplates(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const [waMsgs, templates] = await Promise.all([API.waWAMessages(), API.waTemplates()]);
    const msgs = waMsgs.messages || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📝 Mensagens WhatsApp (EdgeOne)</h1>
        <button class="btn btn--primary btn--sm" onclick="renderWATemplates(document.getElementById('adminMain'))">🔄</button>
      </header>
      <section class="admin-card" style="margin-bottom:var(--space-md);">
        <h2 class="admin-form__section-title">Mensagens Aleatórias (máx. 50)</h2>
        <div style="font-size:0.78rem;color:var(--color-text-muted);margin-bottom:8px;">Variáveis: {saudacao}, {primeiro_nome}, {nome}, {cpf}, {telefone}, {link}, {link_pagamento}, {data}, {hora}</div>
        <button class="btn btn--primary btn--sm" onclick="waNewWAMsg()">+ Nova Mensagem</button>
        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;margin-top:12px;">
          ${!msgs.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhuma mensagem criada</div>' : msgs.map(m => `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--color-gray-200);font-size:0.78rem;">
            <span class="badge badge--${m.active ? 'success' : 'primary'}" style="min-width:50px;text-align:center;">${m.active ? 'Ativa' : 'Inativa'}</span>
            <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(m.text || '').slice(0, 100)}</div>
            <div style="display:flex;gap:4px;">
              <button class="btn btn--primary btn--sm" onclick="waToggleWAMsg(${m.id})">${m.active ? 'Desativar' : 'Ativar'}</button>
              <button class="btn btn--danger btn--sm" onclick="waDeleteWAMsg(${m.id})">Excluir</button>
            </div>
          </div>`).join('')}
        </div>
      </section>
      <section class="admin-card">
        <h2 class="admin-form__section-title">📄 Templates de Mensagem</h2>
        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;margin-top:8px;">
          ${(!templates.templates || !templates.templates.length) ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhum template</div>' : templates.templates.map(t => `
          <div style="padding:10px 12px;border-bottom:1px solid var(--color-gray-200);font-size:0.78rem;">
            <div style="white-space:pre-wrap;">${t.text}</div>
            <div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:4px;">ID: ${t.id} · ${fmtDateTime(t.createdAt)}</div>
          </div>`).join('')}
        </div>
      </section>
    `;
  }

  async function waNewWAMsg() {
    const text = await showPromptModal('Nova Mensagem WhatsApp', '', 'Digite o texto da mensagem...');
    if (!text) return;
    try { await API.waCreateWAMessage({ text, active: true }); showToast('Mensagem criada'); navigateTo('wa-templates'); } catch(e) { showToast(e.message, 'error'); }
  }

  async function waToggleWAMsg(id) {
    try { await API.waToggleWAMessage(id); showToast('Status alterado'); navigateTo('wa-templates'); } catch(e) { showToast(e.message, 'error'); }
  }

  async function waDeleteWAMsg(id) {
    if (!await showConfirmModal('Excluir Mensagem', 'Tem certeza?', 'Excluir', 'Cancelar')) return;
    try { await API.waDeleteWAMessage(id); showToast('Mensagem excluída'); navigateTo('wa-templates'); } catch(e) { showToast(e.message, 'error'); }
  }

  async function renderWAContatos(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.waContacts();
    const contacts = data.contacts || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">👤 Contatos WhatsApp</h1>
        <span style="font-size:0.8rem;color:var(--color-text-muted);">${contacts.length} contatos</span>
      </header>
      <section class="admin-card">
        <div style="max-height:500px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;">
          ${!contacts.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhum contato</div>' : contacts.map(c => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--color-gray-200);font-size:0.78rem;">
            <span style="font-weight:600;font-family:monospace;">${c.phone}</span>
            <span style="color:var(--color-text-muted);">${c.count || 0} msgs</span>
            <span class="badge badge--${c.lastStatus === 'delivered' ? 'success' : c.lastStatus === 'failed' ? 'primary' : 'warning'}">${c.lastStatus || '---'}</span>
          </div>`).join('')}
        </div>
      </section>
    `;
  }

  async function renderWALogs(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.waLogs();
    const logs = data.logs || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📋 Logs do WhatsApp</h1>
        <button class="btn btn--primary btn--sm" onclick="renderWALogs(document.getElementById('adminMain'))">🔄</button>
      </header>
      <section class="admin-card">
        <div style="max-height:500px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;">
          ${!logs.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhum log</div>' : logs.map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--color-gray-200);font-size:0.75rem;">
            <span style="color:var(--color-text-muted);font-family:monospace;min-width:130px;">${fmtDateTime(l.timestamp)}</span>
            <span style="font-weight:600;color:var(--color-primary);min-width:80px;">${l.event}</span>
            <span style="color:var(--color-text-muted);">${l.description || ''}</span>
          </div>`).join('')}
        </div>
      </section>
    `;
  }

  async function renderWACampanhas(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--color-text-muted);">Carregando...</div>';
    const data = await API.waCampaigns();
    const campaigns = data.campaigns || [];
    container.innerHTML = `
      <header class="admin-header">
        <h1 class="admin-header__title">📢 Campanhas</h1>
        <div>
          <button class="btn btn--primary btn--sm" onclick="waNewCampaign()">+ Nova Campanha</button>
          <button class="btn btn--primary btn--sm" onclick="renderWACampanhas(document.getElementById('adminMain'))">🔄</button>
        </div>
      </header>
      <section class="admin-card">
        <div style="max-height:500px;overflow-y:auto;border:1px solid var(--color-gray-200);border-radius:8px;">
          ${!campaigns.length ? '<div style="padding:24px;text-align:center;color:var(--color-text-muted);">Nenhuma campanha</div>' : campaigns.map(c => `
          <div style="display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--color-gray-200);font-size:0.78rem;">
            <div style="flex:1;">
              <strong>${c.name || c.nome || 'Sem nome'}</strong>
              <div style="color:var(--color-text-muted);font-size:0.72rem;margin-top:2px;">${c.sent || 0} enviados · ${c.pending || 0} pendentes · ${c.errors || 0} erros</div>
            </div>
            <span class="badge badge--${c.status === 'active' || c.status === 'running' ? 'warning' : c.status === 'completed' ? 'success' : 'primary'}">${c.status || 'draft'}</span>
            <button class="btn btn--danger btn--sm" onclick="waDeleteCampaign('${c.id || c._id || ''}')">Excluir</button>
          </div>`).join('')}
        </div>
      </section>
    `;
  }

  async function waNewCampaign() {
    const nome = await showPromptModal('Nome da Campanha', '', 'Ex: Promoção Junho');
    if (!nome) return;
    const numbersRaw = await showPromptModal('Números (um por linha, máx 100)', '', '5511999999999\n5521988888888');
    if (!numbersRaw) return;
    const numbers = numbersRaw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 100);
    const msg = await showPromptModal('Texto da Mensagem', '', 'Use {saudacao}, {primeiro_nome}...');
    if (!msg) return;
    try {
      await API.waCreateCampaign({ name: nome, numbers, messages: [msg], delayMin: 180, delayMax: 300 });
      showToast('Campanha criada');
      navigateTo('wa-campanhas');
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function waDeleteCampaign(id) {
    if (!id) return showToast('ID da campanha não encontrado', 'error');
    if (!await showConfirmModal('Excluir Campanha', 'Tem certeza?', 'Excluir', 'Cancelar')) return;
    try { await API.waDeleteCampaign(id); showToast('Campanha excluída'); navigateTo('wa-campanhas'); } catch(e) { showToast(e.message, 'error'); }
  }

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
  _win.reloadPagamentos = reloadPagamentos;
  _win.showPagamentoDetail = showPagamentoDetail;
  _win.renderWACampanhas = renderWACampanhas;
  _win.renderWAContas = renderWAContas;
  _win.renderWAFila = renderWAFila;
  _win.renderWALogs = renderWALogs;
  _win.renderWAMensagens = renderWAMensagens;
  _win.renderWATemplates = renderWATemplates;
  _win.renderLogsSistema = renderLogsSistema;
  _win.novoUsuario = novoUsuario;
  _win.reprovarSolicitacao = reprovarSolicitacao;
  _win.marcarLida = marcarLida;
  _win.resetSupportClicks = resetSupportClicks;
  _win.removeCpfKey = removeCpfKey;
  _win.removeAllCpfKeys = removeAllCpfKeys;
  _win.waConnect = waConnect;
  _win.waDisconnect = waDisconnect;
  _win.waReconnect = waReconnect;
  _win.waNewCampaign = waNewCampaign;
  _win.waNewWAMsg = waNewWAMsg;
  _win.waDeleteCampaign = waDeleteCampaign;
  _win.waDeleteWAMsg = waDeleteWAMsg;
  _win.waToggleWAMsg = waToggleWAMsg;
})();