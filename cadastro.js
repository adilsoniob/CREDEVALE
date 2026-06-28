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

  const stepLabels = ['','','','','','',''];

  /* ---- State ---- */
  const steps = ['Início','CPF','Dados','Endereço','Contato','Perfil','Docs','Análise'];
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

  /* ---- Utils ---- */
  function $(id) { return document.getElementById(id); }

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
          '<stop offset="50%" stop-color="#1a365d"/>'+
          '<stop offset="100%" stop-color="#0d9488"/>'+
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
      '<text x="320" y="44" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="rgba(255,255,255,0.45)" text-anchor="end">VALE SAÚDE</text>'+
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
          '<stop offset="50%" stop-color="#1a365d"/>'+
          '<stop offset="100%" stop-color="#0d9488"/>'+
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
      '<text x="320" y="44" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="rgba(255,255,255,0.45)" text-anchor="end">VALE SAÚDE</text>'+
      '<circle cx="278" cy="76" r="12" fill="#eb001b" opacity="0.6"/>'+
      '<circle cx="290" cy="76" r="12" fill="#f79e1b" opacity="0.6"/>'+
      '<text x="28" y="118" font-family="\'Courier New\',monospace" font-size="18" font-weight="700" fill="white" letter-spacing="3">****  ****  ****  0000</text>'+
      '<text x="28" y="152" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.5)">TITULAR</text>'+
      '<text x="28" y="170" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white">'+nd+'</text>'+
      '<text x="300" y="152" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.5)" text-anchor="end">VALIDADE</text>'+
      '<text x="300" y="170" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white" text-anchor="end">12/28</text>'+
      '<text x="28" y="198" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.6)">Cartão de Benefícios</text>'+
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
      var existente = await verificarCPFExistente(cpf);
      if (existente) return;

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
      try { var r = await fetch('https://viacep.com.br/ws/'+cep+'/json/'); if (r.ok) end = await r.json(); } catch(e) {}

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
    try {
      var imgUrl = URL.createObjectURL(file);
      addMsg('<div style="text-align:center;"><img class="chat-media-preview" src="'+imgUrl+'" style="max-width:240px;max-height:260px;display:block;margin:0 auto;border-radius:12px;"></div>', 'user');
      addMsg('📸 <strong>'+label+' capturado!</strong> A foto ficou boa?', 'bot');
      showOptions([
        { label:'✅ Sim, usar esta', primary:true, action:function(){
          if (tipo==='documento') user.documento = file;
          else user.selfie = file;
          URL.revokeObjectURL(imgUrl);
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
    addMsg('📊 <strong>Com que frequência compra em farmácias?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Só quando necessário', action:function(){ quizAnswers.frequencia='Só quando necessário'; resolve(); }},
        { label:'1 vez por mês', action:function(){ quizAnswers.frequencia='1 vez por mês'; resolve(); }},
        { label:'Várias vezes por mês', action:function(){ quizAnswers.frequencia='Várias vezes por mês'; resolve(); }}
      ]);
    });

    await sleep(300); addTyping(); await sleep(500); removeTyping();
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
        etapaDocs();
      }}
    ]);
  }

  /* ---- ETAPA 7: Pop-up de Análise + Resultado ---- */
  async function etapaAnalisePopup(clientId, limite) {
    if (!clientId) clientId = 'CLI-'+Date.now().toString(36).toUpperCase();
    if (!limite) limite = 500;
    flowState = 'analysis';
    updateProgress(7);
    hideInput();

    var steps = [
      { label:'Validando documentos', done:false },
      { label:'Conferindo selfie', done:false },
      { label:'Analisando questionário', done:false },
      { label:'Consultando cadastro', done:false },
      { label:'Calculando limite', done:false },
      { label:'Preparando proposta', done:false }
    ];

    // 1) Pop-up processando
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

    // Anima steps
    var totalSteps = steps.length;
    for (var i=0; i<totalSteps; i++) {
      var item = document.querySelector('.popup-step-item[data-idx="'+i+'"]');
      if (item) {
        item.classList.add('popup-step-item--active');
        var ic = item.querySelector('.popup-step-icon');
        if (ic) ic.textContent = '⟳';
      }
      var delay = 1800 + Math.floor(Math.random()*1200);
      await sleep(delay);
      if (item) {
        item.classList.remove('popup-step-item--active');
        item.classList.add('popup-step-item--done');
        var ic2 = item.querySelector('.popup-step-icon');
        if (ic2) ic2.textContent = '✓';
      }
      var fill = document.getElementById('popupProgressFill');
      if (fill) fill.style.width = Math.round(((i+1)/totalSteps)*100)+'%';
    }

    // Chama API de criação do cliente
    var apiData = {
      cpf: user.cpf, nome: user.nome, nascimento: user.nascimento, sexo: user.sexo,
      cep: user.cep, rua: user.rua, numero: user.numero, complemento: user.complemento,
      bairro: user.bairro, cidade: user.cidade, uf: user.uf,
      whatsapp: user.whatsapp, email: user.email,
      nome_mae: '', renda: '0', profissao: '', situacao: '',
      limite_aprovado: limite,
      dispositivo: sessionStorage.getItem('vs_dispositivo')||'Desktop',
      modelo: sessionStorage.getItem('vs_modelo')||'PC'
    };
    var apiResult = await API.createClient(apiData).catch(function(){ return null; });
    clientId = apiResult ? apiResult.clientId : clientId;

    sessionStorage.setItem('vs_clientId', clientId);
    sessionStorage.setItem('vs_nome', (user.nome||'').split(' ')[0]);
    sessionStorage.setItem('vs_nome_completo', user.nome);
    sessionStorage.setItem('vs_limite', limite);

    // 2) Substitui pop-up pelo resultado com botão Escolher Cartão
    await sleep(600);
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var limFmt = Number(limite).toFixed(2).replace('.',',');
    var popupBox = document.querySelector('.popup-box');
    if (popupBox) {
      popupBox.innerHTML =
        '<div style="background:rgba(76,200,164,0.08);border:1px solid rgba(76,200,164,0.15);border-radius:14px;padding:20px;margin-bottom:16px;">'+
          '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:10px;">'+
            '<span style="font-size:1.1rem;color:#4CC8A4;">✅</span>'+
            '<span style="font-size:0.82rem;color:#4CC8A4;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;">Crédito aprovado</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">'+
            '<span style="font-size:2rem;">🎉</span>'+
            '<div class="popup-title" style="margin:0;font-size:1.3rem;">Parabéns, <strong style="color:#4CC8A4;">'+nomePrimeiro+'</strong>!</div>'+
          '</div>'+
          '<div style="font-size:2.5rem;font-weight:900;color:#4CC8A4;text-align:center;">R$ '+limFmt+'</div>'+
          '<div style="font-size:0.8rem;color:#8a9aa8;text-align:center;margin-bottom:14px;">limite liberado</div>'+
          '<div style="border-top:1px solid rgba(76,200,164,0.12);padding-top:12px;">'+
            '<div style="font-size:0.82rem;color:#a8c0d0;margin-bottom:8px;"><strong>Com o CREDVALE você tem:</strong></div>'+
            '<div style="display:flex;flex-direction:column;gap:6px;">'+
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:#c8d0dc;"><span style="color:#4CC8A4;">●</span> Desconto de até <strong>75%</strong> em medicamentos</div>'+
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:#c8d0dc;"><span style="color:#4CC8A4;">●</span> Fatura em até <strong>45 dias</strong> para pagar</div>'+
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:#c8d0dc;"><span style="color:#4CC8A4;">●</span> Parcelamento de medicamentos em até <strong>15x</strong></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<button class="chat-option chat-option--primary" id="popupEscolherCartao" style="padding:16px 24px;font-size:1rem;border:none;border-radius:14px;cursor:pointer;font-weight:800;font-family:inherit;background:linear-gradient(135deg,#3B82F6,#4CC8A4);color:#fff;width:100%;transition:all 0.25s;">💳 Escolher meu cartão</button>';
    }

    // Aguarda clique
    await new Promise(function(resolve) {
      var btn = document.getElementById('popupEscolherCartao');
      if (btn) {
        btn.onclick = function() {
          closePopup();
          resolve();
        };
      } else {
        resolve();
      }
    });

    // Vai direto pra escolha do cartão
    hideInput();
    await sleep(200);
    etapaCardChoice(clientId, limite);
  }

  /* ---- ETAPA 8: Escolha do Cartão (MODAL GRANDE) ---- */
  async function etapaCardChoice(clientId, limite) {
    flowState = 'card-choice';
    hideInput();
    await sleep(200);

    var limFmt = Number(limite).toFixed(2).replace('.',',');
    var nome = (user.nome||'').split(' ')[0]||'';

    var cardHtml =
      '<div style="text-align:center;margin-bottom:12px;">'+
        '<div style="font-size:1.8rem;margin-bottom:2px;">💳</div>'+
        '<div class="popup-title" style="font-size:1.1rem;">'+nome+', escolha seu cartão</div>'+
        '<div style="font-size:0.8rem;color:#6b7a8f;">Limite aprovado: <strong style="color:#4CC8A4;">R$ '+limFmt+'</strong></div>'+
      '</div>'+

      '<div class="card-choice-grid">'+

        /* --- Cartão Virtual / Standard --- */
        '<button class="card-choice-item card-choice-item--selected" id="cardChoiceVirtual">'+
          '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">'+
            '<div class="card-choice-name" style="font-size:1rem;">Plano Standard</div>'+
            '<span style="background:rgba(59,130,246,0.12);color:#60a5fa;font-size:0.65rem;padding:1px 7px;border-radius:50px;font-weight:700;white-space:nowrap;">Cartão Virtual</span>'+
            '<span style="background:rgba(76,200,164,0.12);color:#4CC8A4;font-size:0.6rem;padding:2px 7px;border-radius:50px;font-weight:800;margin-left:auto;white-space:nowrap;">⭐ Mais escolhido</span>'+
          '</div>'+
          '<div style="display:flex;gap:10px;">'+
            '<div class="card-choice-visual" style="width:90px;flex-shrink:0;">'+
              '<div class="card-choice-img-placeholder card-choice-img--virtual" style="border:1px solid rgba(76,200,164,0.15);">'+
                '<img src="assets/card-choice-img-placeholder no bot\u00e3o Standard.png" alt="Cart\u00e3o Virtual" style="max-width:100%;">'+
              '</div>'+
            '</div>'+
            '<div style="flex:1;min-width:0;">'+
              '<div style="display:flex;flex-wrap:wrap;gap:3px 6px;font-size:0.75rem;color:#b0c0d0;">'+
                '<span>✅ Liberação imediata</span>'+
                '<span>📅 Fatura 45 dias</span>'+
                '<span>🔢 Parcelamento 15x</span>'+
                '<span>✅ Sem anuidade</span>'+
                '<span style="color:#4CC8A4;font-weight:700;">💚 Taxa de adesão: <strong>R$ 4,99</strong></span>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="card-choice-highlight" style="background:rgba(76,200,164,0.08);border-color:rgba(76,200,164,0.15);margin-top:8px;padding:10px;font-size:0.82rem;">'+
            '⚡ <strong>Ative agora</strong> e comece a usar em <strong>5 minutos</strong>'+
          '</div>'+
        '</button>'+

        /* --- Cartão Físico / Plus --- */
        '<button class="card-choice-item" id="cardChoiceFisico">'+
          '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">'+
            '<div class="card-choice-name" style="font-size:1rem;">Plano Plus</div>'+
            '<span style="background:rgba(139,92,246,0.12);color:#a78bfa;font-size:0.65rem;padding:1px 7px;border-radius:50px;font-weight:700;white-space:nowrap;">Cartão Físico + Digital</span>'+
          '</div>'+
          '<div style="display:flex;gap:10px;">'+
            '<div class="card-choice-visual" style="width:90px;flex-shrink:0;">'+
              '<div class="card-choice-img-placeholder card-choice-img--fisico" style="border:1px solid rgba(139,92,246,0.15);">'+
                '<img src="assets/card-choice-img-placeholder no bot\u00e3o Plus.png" alt="Cart\u00e3o F\u00edsico" style="max-width:100%;">'+
              '</div>'+
            '</div>'+
            '<div style="flex:1;min-width:0;">'+
              '<div style="display:flex;flex-wrap:wrap;gap:3px 6px;font-size:0.75rem;color:#b0c0d0;">'+
                '<span>📬 Recebe em casa</span>'+
                '<span>📱 Virtual incluso</span>'+
                '<span>📅 Fatura 45 dias</span>'+
                '<span>🔢 Parcelamento 15x</span>'+
                '<span>🏪 Milhares de farmácias</span>'+
                '<span>🎯 Desconto até <strong>75%</strong></span>'+
                '<span>🔄 Troque por pontos</span>'+
                '<span style="color:#a78bfa;font-weight:700;">💜 Taxa de adesão: <strong>R$ 19,99</strong></span>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="card-choice-highlight" style="background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.15);margin-top:8px;padding:10px;font-size:0.82rem;">'+
            '✨ Cartão físico + virtual <strong>tudo incluso</strong> na ativação'+
          '</div>'+
        '</button>'+

      '</div>'+

      '<div style="text-align:center;margin-top:12px;font-size:0.7rem;color:#4a5568;">'+
        '🔒 Pagamento 100% seguro · Dados protegidos'+
      '</div>';

    showPopup(cardHtml);

    document.getElementById('cardChoiceVirtual').onclick = function() {
      document.querySelectorAll('.card-choice-item').forEach(function(x){ x.classList.remove('card-choice-item--selected'); });
      this.classList.add('card-choice-item--selected');
      chosenCard = 'virtual';
      closePopup();
      addMsg('📱 <strong>Standard</strong> — Cartão Virtual selecionado','user');
      setTimeout(function() { etapaConfirmacaoWhatsApp(clientId, limite); }, 300);
    };

    document.getElementById('cardChoiceFisico').onclick = function() {
      document.querySelectorAll('.card-choice-item').forEach(function(x){ x.classList.remove('card-choice-item--selected'); });
      this.classList.add('card-choice-item--selected');
      chosenCard = 'fisico';
      closePopup();
      addMsg('💳 <strong>Plus</strong> — Cartão Físico selecionado','user');
      setTimeout(function() { etapaConfirmarEndereco(clientId, limite); }, 300);
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
    etapaRevisaoDados(clientId, limite);
  }

  /* ---- ETAPA 10: Revisão de Dados ---- */
  async function etapaRevisaoDados(clientId, limite) {
    flowState = 'review';
    hideInput();
    await sleep(200);

    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var cpfFmt = user.cpf ? user.cpf.slice(0,3)+'.'+user.cpf.slice(3,6)+'.'+user.cpf.slice(6,9)+'-'+user.cpf.slice(9) : '—';
    var phoneFmt = formatarTelefone(user.whatsapp);
    var endStr = (user.rua||'')+', '+(user.numero||'')+(user.complemento?', '+user.complemento:'')+' · '+(user.bairro||'')+' · '+(user.cidade||'')+'-'+(user.uf||'');
    var limFmt = Number(limite).toFixed(2).replace('.',',');

    addMsg('<strong>'+nomePrimeiro+', revise seus dados antes de finalizar:</strong>','bot');

    addMsg(
      '<div class="review-card">'+
        '<div class="review-row"><div class="review-label">Nome</div><div class="review-value">'+(user.nome||'—')+'</div></div>'+
        '<div class="review-row"><div class="review-label">CPF</div><div class="review-value">'+cpfFmt+'</div></div>'+
        '<div class="review-row"><div class="review-label">Nascimento</div><div class="review-value">'+(user.nascimento||'—')+'</div></div>'+
        '<div class="review-row"><div class="review-label">WhatsApp</div><div class="review-value">'+phoneFmt+'</div></div>'+
        '<div class="review-row"><div class="review-label">E-mail</div><div class="review-value">'+(user.email||'—')+'</div></div>'+
        '<div class="review-row"><div class="review-label">Endereço</div><div class="review-value">'+endStr+'</div></div>'+
        '<div class="review-row" style="border-bottom:none;"><div class="review-label">Plano</div><div class="review-value">'+(chosenCard==='virtual'?'Standard (Virtual)':'Plus (Físico)')+' · <strong style="color:#4CC8A4;">R$ '+limFmt+'</strong></div></div>'+
      '</div>','bot');

    showOptions([
      { label:'✅ Tudo certo! Finalizar', primary:true, action:function(){ etapaBeneficios(clientId, limite); } },
      { label:'✏️ Preciso editar', danger:true, action:function(){
        addMsg('OK, digite o campo que deseja alterar (nome, cpf, nascimento, cep, whatsapp, email):');
        setInput('Ex: whatsapp');
        waitUserInput().then(function(campo) {
          campo = campo.trim().toLowerCase();
          etapaEditarDado(campo, clientId, limite);
        });
      }}
    ]);
  }

  /* ---- ETAPA 10B: Editar campo específico ---- */
  async function etapaEditarDado(campo, clientId, limite) {
    var campos = {
      nome:'Nome completo', cpf:'CPF (11 números)', nascimento:'Data de nascimento (DD/MM/AAAA)',
      cep:'CEP (8 números)', whatsapp:'WhatsApp', email:'E-mail'
    };
    if (!campos[campo]) {
      addMsg('Campo não reconhecido. Tente: nome, cpf, nascimento, cep, whatsapp, email','bot');
      return etapaRevisaoDados(clientId, limite);
    }
    addMsg('Digite o novo <strong>'+campos[campo]+'</strong>:');
    setInput(campos[campo]);
    var val = await waitUserInput();
    if (campo==='cpf') val = val.replace(/\D/g,'');
    if (campo==='cep') val = val.replace(/\D/g,'');
    if (campo==='whatsapp') val = val.replace(/\D/g,'');
    user[campo] = val;
    addMsg('✅ Campo atualizado!','bot');
    await sleep(400);
    etapaRevisaoDados(clientId, limite);
  }

  /* ---- ETAPA 11: Benefícios em Modal ---- */
  async function etapaBeneficios(clientId, limite) {
    flowState = 'benefits';
    hideInput();
    await sleep(200);

    var limFmt = Number(limite).toFixed(2).replace('.',',');
    var taxa = chosenCard==='virtual' ? 'R$ 4,99' : 'R$ 19,99';
    var isV = chosenCard==='virtual';

    var benefitsHtml =
      '<div style="text-align:center;margin-bottom:12px;">'+
        '<div style="font-size:2.2rem;margin-bottom:4px;">'+(isV?'📱':'💳')+'</div>'+
        '<div class="popup-title">'+(isV?'Plano Standard':'Plano Plus')+'</div>'+
        '<div style="font-size:0.85rem;color:#6b7a8f;">Limite aprovado: <strong style="color:#4CC8A4;">R$ '+limFmt+'</strong></div>'+
      '</div>'+
      '<div class="benefits-list" style="text-align:left;padding:4px 0 12px;">'+
        '<div class="benefit-item"><div class="benefit-icon">💳</div><div class="benefit-text"><strong>Cartão '+(isV?'Virtual':'Físico')+'</strong> Mastercard</div></div>'+
        '<div class="benefit-item"><div class="benefit-icon">⚡</div><div class="benefit-text">'+(isV?'<strong>Liberação imediata!</strong> Use hoje após ativação':'<strong>Receba em casa</strong> em até 14 dias úteis')+'</div></div>'+
        '<div class="benefit-item"><div class="benefit-icon">📅</div><div class="benefit-text"><strong>45 dias</strong> para pagar a primeira fatura</div></div>'+
        '<div class="benefit-item"><div class="benefit-icon">🔢</div><div class="benefit-text">Parcelamento em até <strong>15x</strong> nas farmácias</div></div>'+
        '<div class="benefit-item"><div class="benefit-icon">🏪</div><div class="benefit-text">Aceito em <strong>milhares de farmácias</strong></div></div>'+
        '<div class="benefit-item"><div class="benefit-icon">🆓</div><div class="benefit-text"><strong>Sem anuidade</strong> · Taxa única: <strong>'+taxa+'</strong></div></div>'+
        (!isV ? '<div class="benefit-item"><div class="benefit-icon">🎯</div><div class="benefit-text">Versão <strong>virtual também liberada</strong> na ativação</div></div>' : '')+
      '</div>'+
      '<button class="chat-option chat-option--primary" id="benefitsFinalizar" style="width:100%;padding:16px;font-size:1rem;">🚀 Finalizar ativação</button>';

    showPopup(benefitsHtml);

    document.getElementById('benefitsFinalizar').onclick = function() { closePopup(); etapaAprovacaoFinal(clientId, limite); };
  }

  /* ---- APROVAÇÃO FINAL (mesmo estilo do modal de consulta) ---- */
  function etapaAprovacaoFinal(clientId, limite) {
    flowState = 'aprovacao';
    hideInput();

    var limFmt = Number(limite).toFixed(2).replace('.',',');
    var nome = (user.nome||'Cliente').split(' ')[0]||'Cliente';
    var nomeCompleto = user.nome||'Cliente';

    var aprovHtml =
      '<div style="text-align:center;">'+

        /* Check icon */
        '<div style="width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:rgba(76,200,164,0.1);display:flex;align-items:center;justify-content:center;border:1px solid rgba(76,200,164,0.2);">'+
          '<span style="color:#4CC8A4;font-size:1.6rem;font-weight:700;">✓</span>'+
        '</div>'+

        '<div style="font-size:1.1rem;font-weight:800;color:#e2e8f0;margin-bottom:2px;">Parabéns, '+nome+'!</div>'+
        '<div style="font-size:0.75rem;color:#6b7a8f;margin-bottom:12px;">Sua análise foi concluída com sucesso.</div>'+

        /* Limite */
        '<div style="max-width:260px;margin:0 auto 14px;border-radius:16px;background:linear-gradient(135deg,rgba(76,200,164,0.08),rgba(59,130,246,0.04));border:1px solid rgba(76,200,164,0.15);padding:14px;">'+
          '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#4CC8A4;margin-bottom:4px;">Limite Aprovado</div>'+
          '<div style="font-size:1.8rem;font-weight:900;color:#e2e8f0;">R$ '+limFmt+'</div>'+
        '</div>'+

        /* Cartão Virtual */
        '<div style="position:relative;width:260px;height:150px;margin:0 auto 14px;border-radius:16px;background:linear-gradient(135deg,#0a2e1a,#0d1f2d);border:1px solid rgba(76,200,164,0.2);overflow:hidden;text-align:left;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,0.3);">'+
          '<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;border-radius:50%;background:rgba(76,200,164,0.08);"></div>'+
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
            '<div>'+
              '<div style="font-size:0.55rem;text-transform:uppercase;letter-spacing:0.12em;color:#6b7a8f;">Cartão Virtual</div>'+
              '<div style="font-size:0.7rem;font-weight:800;color:#e2e8f0;letter-spacing:0.05em;margin-top:2px;">CREDVALE</div>'+
            '</div>'+
            '<div style="width:36px;height:22px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;">'+
              '<span style="font-size:0.45rem;font-weight:700;color:#94a3b8;">VISA</span>'+
            '</div>'+
          '</div>'+
          '<div style="margin-top:22px;">'+
            '<span style="font-family:monospace;font-size:0.7rem;letter-spacing:0.15em;color:#c8d0dc;">••••  ••••  ••••  4815</span>'+
          '</div>'+
          '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end;">'+
            '<div>'+
              '<div style="font-size:0.45rem;text-transform:uppercase;color:#6b7a8f;">Titular</div>'+
              '<div style="font-size:0.6rem;font-weight:600;color:#b0c0d0;text-transform:uppercase;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+nomeCompleto.toUpperCase()+'</div>'+
            '</div>'+
            '<div style="text-align:right;">'+
              '<div style="font-size:0.45rem;text-transform:uppercase;color:#6b7a8f;">Validade</div>'+
              '<div style="font-size:0.6rem;font-family:monospace;color:#b0c0d0;">12/28</div>'+
            '</div>'+
          '</div>'+
        '</div>'+

        /* Apple Pay / Google Wallet */
        '<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px 12px;margin:0 auto 12px;max-width:260px;text-align:left;">'+
          '<div style="width:32px;height:32px;border-radius:8px;background:rgba(76,200,164,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">📱</div>'+
          '<div style="font-size:0.7rem;color:#94a3b0;">Seu cartão está pronto para <strong style="color:#e2e8f0;">Apple Pay</strong> e <strong style="color:#e2e8f0;">Google Wallet</strong>.</div>'+
        '</div>'+

        /* Continuar */
        '<button class="chat-option chat-option--primary" id="aprovFinalizar" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">Continuar para pagamento</button>'+
      '</div>';

    showPopup(aprovHtml);

    document.getElementById('aprovFinalizar').onclick = function() {
      closePopup();
      modalCheckout(clientId, limite);
    };
  }

  /* ---- CHECKOUT MODAL (cards de pagamento) ---- */
  function modalCheckout(clientId, limite) {
    flowState = 'checkout';
    hideInput();

    var taxa = chosenCard==='virtual' ? 'R$ 4,99' : 'R$ 19,99';
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var cpfLimpo = user.cpf||'00000000000';
    var checkoutHtml =
      '<div style="text-align:center;margin-bottom:8px;">'+
        '<div style="font-size:1.6rem;margin-bottom:2px;">🚀</div>'+
        '<div class="popup-title" style="font-size:1.05rem;">Ativação do Cartão</div>'+
        '<div style="font-size:0.75rem;color:#6b7a8f;">Taxa de emissão: <strong style="color:#4CC8A4;">'+taxa+'</strong></div>'+
      '</div>'+

      '<div style="display:flex;flex-direction:column;gap:6px;">'+

        '<button class="card-choice-item card-choice-item--selected" id="checkoutPix" style="padding:10px 12px;border-radius:12px;">'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
            '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(76,200,164,0.1));display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">💚</div>'+
            '<div style="flex:1;text-align:left;display:flex;align-items:center;justify-content:space-between;">'+
              '<div>'+
                '<div style="font-weight:700;font-size:0.85rem;color:#e2e8f0;">Pix</div>'+
                '<div style="font-size:0.65rem;color:#6b7a8f;">Pagamento instantâneo</div>'+
              '</div>'+
              '<span style="width:18px;height:18px;border-radius:50%;border:2px solid #4CC8A4;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="width:10px;height:10px;border-radius:50%;background:#4CC8A4;"></span></span>'+
            '</div>'+
          '</div>'+
        '</button>'+

        '<button class="card-choice-item" id="checkoutPush" style="padding:10px 12px;border-radius:12px;">'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
            '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(76,200,164,0.15),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">⚡</div>'+
            '<div style="flex:1;text-align:left;display:flex;align-items:center;justify-content:space-between;">'+
              '<div>'+
                '<div style="font-weight:700;font-size:0.85rem;color:#e2e8f0;">PushinPay</div>'+
                '<div style="font-size:0.65rem;color:#6b7a8f;">Pagamento instantâneo</div>'+
              '</div>'+
              '<span style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.12);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"></span>'+
            '</div>'+
          '</div>'+
        '</button>'+

        '<button class="card-choice-item" id="checkoutCard" style="padding:10px 12px;border-radius:12px;">'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
            '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">💳</div>'+
            '<div style="flex:1;text-align:left;display:flex;align-items:center;justify-content:space-between;">'+
              '<div>'+
                '<div style="font-weight:700;font-size:0.85rem;color:#e2e8f0;">Cartão de Crédito</div>'+
                '<div style="font-size:0.65rem;color:#6b7a8f;">Parcelamos em até 12x</div>'+
              '</div>'+
              '<span style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.12);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"></span>'+
            '</div>'+
          '</div>'+
          '<div style="margin-top:4px;text-align:left;font-size:0.6rem;color:#546e7a;letter-spacing:0.3px;padding-left:46px;">Visa · Mastercard · Elo · Hipercard · Amex</div>'+
        '</button>'+

      '</div>'+

      '<div style="text-align:center;margin-top:8px;font-size:0.65rem;color:#4a5568;">'+
        '🔒 Pagamento 100% seguro · Dados protegidos'+
      '</div>';

    showPopup(checkoutHtml);

    function selectCheckoutOption(id) {
      document.querySelectorAll('.card-choice-item').forEach(function(x){ x.classList.remove('card-choice-item--selected'); });
      var el = document.getElementById(id);
      if (el) el.classList.add('card-choice-item--selected');
    }

    document.getElementById('checkoutPix').onclick = function() {
      selectCheckoutOption('checkoutPix');
      closePopup();
      // Loading de 3 segundos antes de abrir o Pix
      showPopup(
        '<div style="text-align:center;padding:20px 0;">'+
          '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(255,255,255,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
          '<div style="font-weight:700;font-size:1rem;color:#e2e8f0;margin-bottom:4px;">Gerando QR Code Pix...</div>'+
          '<div style="font-size:0.8rem;color:#6b7a8f;">Aguarde um momento</div>'+
        '</div>'
      );
      setTimeout(function() {
        modalPix(clientId, limite);
      }, 3000);
    };

    document.getElementById('checkoutPush').onclick = function() {
      selectCheckoutOption('checkoutPush');
      closePopup();
      var loadingHtml =
        '<div style="text-align:center;padding:20px 0;">'+
          '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(255,255,255,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
          '<div class="popup-title" style="font-size:1rem;">Redirecionando...</div>'+
          '<div style="font-size:0.8rem;color:#6b7a8f;">Abrindo a página de pagamento PushinPay</div>'+
        '</div>';
      showPopup(loadingHtml);
      setTimeout(function() {
        window.open('https://pushinpay.com.br/pagamento/'+clientId, '_blank');
        addMsg('🔗 Redirecionamos você para o <strong>PushinPay</strong>. Após pagar, volte aqui e clique em "Confirmar".','bot');
        closePopup();
        esperarVerificacaoPagamento(clientId, limite, taxa, nomePrimeiro, cpfLimpo);
      }, 1200);
    };

    document.getElementById('checkoutCard').onclick = function() {
      selectCheckoutOption('checkoutCard');
      closePopup();
      modalCartao(clientId, limite);
    };
  }

  /* ---- PIX MODAL ---- */
  function modalPix(clientId, limite) {
    flowState = 'pix';
    hideInput();

    var taxa = chosenCard==='virtual' ? 'R$ 4,99' : 'R$ 19,99';
    var pixKey = 'valesaude@pix.com.br'; // Placeholder
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var cpfLimpo = user.cpf||'00000000000';

    var pixHtml =
      '<div style="text-align:center;margin-bottom:8px;">'+
        '<div style="font-size:1.6rem;margin-bottom:2px;">💚</div>'+
        '<div class="popup-title" style="font-size:1rem;">Pagamento Pix</div>'+
        '<div style="font-size:0.75rem;color:#6b7a8f;">Taxa de emissão: <strong style="color:#4CC8A4;">'+taxa+'</strong></div>'+
      '</div>'+

      /* QR Code */
      '<div style="text-align:center;margin-bottom:8px;">'+
        '<div style="width:140px;height:140px;margin:0 auto;border-radius:12px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.06);">'+
          '<img src="assets/qrcode-placeholder.svg" alt="QR Code Pix" style="width:100%;height:100%;object-fit:contain;">'+
        '</div>'+
      '</div>'+

      /* Chave copia e cola */
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;margin-bottom:8px;">'+
        '<div style="font-size:0.65rem;color:#6b7a8f;margin-bottom:3px;">Chave Pix (copia e cola):</div>'+
        '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:8px;font-size:0.7rem;color:#c8d0dc;word-break:break-all;font-family:monospace;text-align:center;margin-bottom:6px;border:1px solid rgba(255,255,255,0.04);">'+pixKey+'</div>'+
        '<button class="chat-option chat-option--primary" id="pixCopiarChave" style="width:100%;padding:9px;font-size:0.8rem;">📋 Copiar chave Pix</button>'+
      '</div>'+

      /* Ações */
      '<div style="display:flex;flex-direction:column;gap:4px;">'+
        '<button class="chat-option" id="pixJaPaguei" style="width:100%;padding:10px;font-size:0.8rem;">✅ Já paguei — confirmar</button>'+
      '</div>';

    showPopup(pixHtml);

    document.getElementById('pixCopiarChave').onclick = function() {
      var copiar = function() {
        // Fecha Pix modal e mostra feedback
        closePopup();
        showPopup(
          '<div style="text-align:center;">'+
            '<div style="width:56px;height:56px;margin:0 auto 10px;background:rgba(76,200,164,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(76,200,164,0.2);">'+
              '<span style="font-size:1.8rem;color:#4CC8A4;">✓</span>'+
            '</div>'+
            '<div style="font-size:0.8rem;color:#4CC8A4;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;margin-bottom:4px;">✅ Chave Pix copiada com sucesso</div>'+
            '<div style="font-size:0.85rem;color:#c8d0dc;margin-bottom:10px;line-height:1.4;">'+
              'Agora <strong style="color:#e2e8f0;">abra seu banco</strong>, vá em <strong style="color:#e2e8f0;">Pix</strong> e cole a chave para pagar.'+
            '</div>'+
            '<div style="background:rgba(76,200,164,0.06);border:1px solid rgba(76,200,164,0.12);border-radius:12px;padding:12px;margin:0 0 12px;font-size:0.8rem;color:#94a3b0;text-align:left;line-height:1.5;">'+
              '📌 <strong>Importante:</strong> Fique atento ao <strong>WhatsApp</strong>. É por lá que você vai receber as credenciais e confirmação do seu cartão.'+
            '</div>'+
            '<button class="chat-option chat-option--primary" id="pixCopiarOk" style="width:100%;padding:12px;font-size:0.85rem;">✅ Entendi, vou pagar</button>'+
          '</div>'
        );
        document.getElementById('pixCopiarOk').onclick = function() {
          closePopup();
          // Reabre o modal Pix
          modalPix(clientId, limite);
        };
      };
      navigator.clipboard.writeText(pixKey).then(copiar).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = pixKey; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        ta.remove(); copiar();
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
    var taxa = chosenCard==='virtual' ? 'R$ 4,99' : 'R$ 19,99';

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

  /* ---- PushinPay: esperar retorno ---- */
  function esperarVerificacaoPagamento(clientId, limite, taxa, nome, cpf) {
    flowState = 'wait-payment';
    hideInput();

    addMsg('⏳ Aguardando confirmação do pagamento...','bot');
    addMsg(
      '<div style="text-align:center;padding:8px 0;">'+
        '<button class="chat-option chat-option--primary" id="verificarPagamentoBtn" style="font-size:0.95rem;">✅ Confirmar</button>'+
      '</div>','bot');

    document.getElementById('verificarPagamentoBtn').onclick = function() {
      abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpf);
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
      addMsg('👋 Olá novamente, <strong>'+primeiroNome+'</strong>! Localizamos seu cadastro.', 'bot');
      hideInput(); await sleep(1200);
      if (client.status==='aprovado'||client.status==='ativado') {
        addMsg('Seu cadastro já está <strong>aprovado</strong>! Redirecionando... 🎉','bot');
        await sleep(800);
        window.location.href = 'parabens.html?'+new URLSearchParams({clientId:client.id,nome:primeiroNome});
      } else {
        addMsg('Você já iniciou sua solicitação. Vamos continuar!','bot');
        await sleep(800);
        window.location.href = 'escolha.html?'+new URLSearchParams({clientId:client.id,nome:primeiroNome,limite:limite});
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
    await iniciarFluxo();
  }

  if (document.readyState==='complete') init();
  else window.addEventListener('load', init);
})();
