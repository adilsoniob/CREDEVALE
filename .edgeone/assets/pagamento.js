(() => {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId') || sessionStorage.getItem('vs_clientId');
  const produto = params.get('produto') || sessionStorage.getItem('vs_produto') || 'virtual';
  const preco = parseFloat(params.get('preco')) || parseFloat(sessionStorage.getItem('vs_preco')) || 4.99;
  const nome = params.get('nome') || sessionStorage.getItem('vs_nome') || 'Cliente';
  const nomeCompleto = params.get('nome_completo') || sessionStorage.getItem('vs_nome_completo') || nome;

  sessionStorage.setItem('vs_clientId', clientId || '');
  sessionStorage.setItem('vs_produto', produto);
  sessionStorage.setItem('vs_preco', String(preco));
  sessionStorage.setItem('vs_nome', nome);

  const _b = window.__API_BASE || '/api';
  const labels = { virtual: 'Vale Saúde Digital', fisico: 'Vale Saúde Completo' };
  document.getElementById('resumoProduto').textContent = labels[produto] || produto;
  document.getElementById('resumoValor').textContent = 'R$ ' + preco.toFixed(2).replace('.', ',');
  document.getElementById('resumoTotal').textContent = 'R$ ' + preco.toFixed(2).replace('.', ',');

  function abreviarNome(nome) {
    const partes = (nome || '').trim().split(/\s+/);
    if (partes.length <= 1) return (partes[0] || 'TITULAR').toUpperCase();
    return (partes[0] + ' ' + partes[partes.length - 1][0] + '.').toUpperCase();
  }

  // Card SVG
  function gerarCardSVG(nome, limite, ultimos4) {
    const nomeDisplay = abreviarNome(nome);
    const ultimos = String(ultimos4).padStart(4, '0').slice(0, 4);
    const numDisplay = '****  ****  ****  ' + ultimos;
    const limiteDisplay = (typeof limite === 'number' ? limite : 0).toFixed(2).replace('.', ',');
    return `<svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.35);">
  <defs>
    <linearGradient id="cardBgPag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1a365d"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
    <linearGradient id="chipGradPag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="340" height="210" rx="16" fill="url(#cardBgPag)"/>
  <rect x="30" y="38" width="48" height="38" rx="6" fill="url(#chipGradPag)" opacity="0.9"/>
  <rect x="34" y="42" width="40" height="30" rx="4" fill="none" stroke="#b45309" stroke-width="0.8" opacity="0.5"/>
  <text x="320" y="48" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="rgba(255,255,255,0.5)" text-anchor="end">VALE SAÚDE</text>
  <circle cx="284" cy="82" r="14" fill="#eb001b" opacity="0.7"/>
  <circle cx="297" cy="82" r="14" fill="#f79e1b" opacity="0.7"/>
  <text x="30" y="125" font-family="'Courier New',monospace" font-size="20" font-weight="700" fill="white" letter-spacing="3">${numDisplay}</text>
  <text x="30" y="160" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.5)">TITULAR</text>
  <text x="30" y="178" font-family="Arial,sans-serif" font-size="15" font-weight="600" fill="white">${nomeDisplay}</text>
  <text x="310" y="160" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="end">VALIDADE</text>
  <text x="310" y="178" font-family="Arial,sans-serif" font-size="15" font-weight="600" fill="white" text-anchor="end">12/28</text>
  <rect x="30" y="185" width="280" height="1" fill="rgba(255,255,255,0.15)"/>
  <text x="30" y="200" font-family="Arial,sans-serif" font-size="12" fill="rgba(255,255,255,0.7)">Limite: <tspan font-weight="700" fill="white">R$ ${limiteDisplay}</tspan></text>
</svg>`;
  }

  const limite = parseFloat(params.get('limite')) || parseFloat(sessionStorage.getItem('vs_limite')) || 0;
  const ultimos4 = String(Math.floor(Math.random() * 9000 + 1000));
  const cardArea = document.getElementById('checkoutCardArea');
  if (cardArea) cardArea.innerHTML = gerarCardSVG(nomeCompleto, limite, ultimos4);
  const noticeEl = document.getElementById('checkoutCardNotice');
  if (noticeEl) noticeEl.hidden = false;

  // ---- PIX Modal ----
  const pixModal = document.getElementById('pixModal');
  const pixModalName = document.getElementById('pixModalName');
  const btnPixFechar = document.getElementById('btnPixFechar');
  const pixModalOverlay = document.getElementById('pixModalOverlay');

  function openPixModal() {
    pixModalName.textContent = nome ? `${nome}, sua chave PIX foi copiada com sucesso!` : 'Chave PIX copiada com sucesso!';
    pixModal.hidden = false;
  }
  function closePixModal() {
    pixModal.hidden = true;
  }
  btnPixFechar.addEventListener('click', closePixModal);
  pixModalOverlay.addEventListener('click', closePixModal);

  // ---- Fetch payment config and decide mode ----
  async function initCheckout() {
    try {
      const res = await fetch(_b+'/payments/config');
      const config = await res.json();
      var pushinpayUrl = '';
      if (produto === 'fisico') {
        pushinpayUrl = (config.pushinpay_url_fisico || config.pushinpay_url || '').trim();
      } else {
        pushinpayUrl = (config.pushinpay_url_virtual || config.pushinpay_url || '').trim();
      }

      if (pushinpayUrl) {
        showPushinpayMode(pushinpayUrl);
      } else {
        showNormalMode();
      }
    } catch {
      showNormalMode();
    }
  }

  // ---- PushinPay mode ----
  function showPushinpayMode(url) {
    document.getElementById('checkoutNormal').style.display = 'none';
    document.getElementById('checkoutPushinpay').style.display = '';

    var pushinpayResumo = document.getElementById('pushinpayResumo');
    if (pushinpayResumo) {
      pushinpayResumo.textContent = (labels[produto] || produto) + ' — R$ ' + preco.toFixed(2).replace('.', ',');
    }

    document.getElementById('btnIrPushinpay').addEventListener('click', () => {
      fetch(_b+'/track/pushinpay-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId }) }).catch(function() {});
      const finalUrl = url.includes('?')
        ? url + '&client_id=' + clientId + '&valor=' + preco + '&produto=' + produto + '&external_ref=' + clientId
        : url + '?client_id=' + clientId + '&valor=' + preco + '&produto=' + produto + '&external_ref=' + clientId;
      window.open(finalUrl, '_blank');
    });
  }

  // ---- Normal PIX/Card/Boleto mode ----
  let pixPayload = null;

  function initNormalMode() {
    // Parcelas
    const parcelasSel = document.getElementById('cardParcelas');
    for (let i = 1; i <= 6; i++) {
      const val = (preco / i).toFixed(2).replace('.', ',');
      parcelasSel.innerHTML += `<option value="${i}">${i}x de R$ ${val}</option>`;
    }

    // Toggle accordion
    function toggleAccordion(id) {
      const block = document.getElementById(id);
      const isHidden = block.hidden;
      document.querySelectorAll('.checkout-metodos__body').forEach(b => { b.hidden = true; });
      document.querySelectorAll('.checkout-metodos__arrow').forEach(a => { a.textContent = '+'; });
      if (isHidden) {
        block.hidden = false;
        block.closest('.checkout-metodos__item').querySelector('.checkout-metodos__arrow').textContent = '−';
      }
    }

    document.getElementById('toggleCard').addEventListener('click', () => toggleAccordion('cardBlock'));
    document.getElementById('toggleBoleto').addEventListener('click', () => toggleAccordion('boletoBlock'));

    // PIX timer
    let timer = 15 * 60;
    const countdown = document.getElementById('countdown');
    setInterval(() => {
      if (timer <= 0) return;
      timer--;
      const m = String(Math.floor(timer / 60)).padStart(2, '0');
      const s = String(timer % 60).padStart(2, '0');
      countdown.textContent = `${m}:${s}`;
    }, 1000);

    const btnPixAction = document.getElementById('btnPixAction');
    const pixQrContainer = document.getElementById('pixQrContainer');
    const copiaColaArea = document.getElementById('pixCopiaColaArea');
    const copiaInput = document.getElementById('pixCopiaColaInput');
    const btnCopiarPix = document.getElementById('btnCopiarPix');
    const jaPagueiArea = document.getElementById('jaPagueiArea');

    function copiarPix() {
      btnPixAction.disabled = true;
      btnPixAction.innerHTML = '<div class="pix-loading" style="padding:0"><div class="pix-loading__spinner"></div></div>';
      btnCopiarPix.disabled = true;
      btnCopiarPix.textContent = 'Copiando...';
      fetch(_b+'/track/pix-copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId }) }).catch(function() {});
      setTimeout(function() {
        copiaInput.select();
        navigator.clipboard?.writeText(copiaInput.value);
        btnPixAction.innerHTML = 'Copiar PIX';
        btnPixAction.disabled = false;
        btnCopiarPix.disabled = false;
        btnCopiarPix.textContent = 'Copiar';
        openPixModal();
      }, 3000);
    }

    async function gerarPix() {
      btnPixAction.disabled = true;
      btnPixAction.textContent = 'Gerando...';
      pixQrContainer.innerHTML = '<div class="pix-loading"><div class="pix-loading__spinner"></div></div>';
      try {
        const r = await fetch(_b+'/payments/generate-pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, request_id: '', valor: preco })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        pixPayload = data;
        pixQrContainer.innerHTML = `<img src="${data.pixQrCode}" alt="QR Code PIX" style="width:200px;height:200px;border-radius:12px;display:block;margin:0 auto;">`;
        copiaColaArea.hidden = false;
        copiaInput.value = data.pixCopiaCola;
        btnPixAction.textContent = 'Copiar PIX';
        btnPixAction.disabled = false;
        btnPixAction.style.background = '';
        btnPixAction.onclick = copiarPix;
        btnCopiarPix.onclick = copiarPix;
        jaPagueiArea.hidden = false;
        const waBtn = jaPagueiArea.querySelector('a');
        waBtn.href = `https://wa.me/5511999999999?text=${encodeURIComponent(`Olá! Já realizei o pagamento do Vale Saúde e gostaria de liberar meu acesso. ${nome ? `Meu nome: ${nome}. ` : ''}Cartão: ${labels[produto] || produto}. Valor: R$${preco.toFixed(2)}`)}`;
      } catch (e) {
        pixQrContainer.innerHTML = '<div class="pix-loading"><span style="font-size:0.8125rem;color:var(--color-text);">Erro ao gerar PIX</span></div>';
        btnPixAction.textContent = 'Tentar novamente';
        btnPixAction.disabled = false;
        btnPixAction.onclick = gerarPix;
      }
    }

    gerarPix();

    document.getElementById('btnPagarCard').addEventListener('click', () => {
      window.location.href = `ativacao.html?clientId=${clientId}&produto=${produto}&preco=${preco}&metodo=card`;
    });

    document.getElementById('cardNumero').addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '');
      v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
      e.target.value = v.slice(0, 19);
    });
    document.getElementById('cardValidade').addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
      e.target.value = v.slice(0, 5);
    });
  }

  function showNormalMode() {
    document.getElementById('checkoutNormal').style.display = '';
    document.getElementById('checkoutPushinpay').style.display = 'none';
    initNormalMode();
  }

  // Start
  initCheckout();

  // WhatsApp bubble: auto-open 1s after load, close after 10s
  var waBubble = document.getElementById('waBubble');
  if (waBubble) {
    setTimeout(function() {
      waBubble.hidden = false;
      setTimeout(function() {
        waBubble.hidden = true;
      }, 10000);
    }, 1000);
  }

  // Track WhatsApp support link clicks
  function trackSupportClick() {
    fetch(_b + '/track/support-click', { method: 'POST' }).catch(function(){});
  }
  document.querySelectorAll('.whatsapp-float__btn, .whatsapp-float__icon, .checkout-suporte__btn, .checkout-pix__paid-btn').forEach(function(el) {
    el.addEventListener('click', trackSupportClick);
  });

  // Track page view
  fetch(_b + '/track/page-view', { method: 'POST' }).catch(function(){});
})();
