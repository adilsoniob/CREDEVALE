(() => {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId') || sessionStorage.getItem('vs_clientId');
  const nome = params.get('nome') || sessionStorage.getItem('vs_nome') || 'Cliente';
  const nomeEl = document.getElementById('clienteNome');
  if (nomeEl) nomeEl.textContent = nome;
  const nomeCompleto = params.get('nome_completo') || sessionStorage.getItem('vs_nome_completo') || nome;
  const limite = params.get('limite') || sessionStorage.getItem('vs_limite') || '1500';

  const vantagens = {
    digital: [
      'Ativação imediata — use na hora',
      'Descontos de até 75% em farmácias parceiras',
      'Até 45 dias para pagar sua fatura',
      'App exclusivo para acompanhar seu saldo',
      'Pagamento por aproximação (NFC)',
      'Sem anuidade ou taxa de manutenção'
    ],
    fisico: [
      'Cartão físico entregue em casa',
      'Versão digital inclusa para uso imediato',
      'Descontos de até 75% em farmácias parceiras',
      'Até 45 dias para pagar sua fatura',
      'Parcelamento das compras em medicamentos',
      'Utilização em todo o Brasil',
      'Sem anuidade ou taxa de manutenção',
      'App exclusivo para acompanhar suas compras'
    ]
  };

  window.openVantagens = function(tipo) {
    const modal = document.getElementById('vantagensModal');
    const title = document.getElementById('vantagensTitle');
    const list = document.getElementById('vantagensList');
    const items = vantagens[tipo] || [];
    title.textContent = tipo === 'digital' ? 'Vale Saúde Digital' : 'Vale Saúde Completo';
    list.innerHTML = items.map(function(v) { return '<li>' + v + '</li>'; }).join('');
    modal.hidden = false;
  };

  window.closeVantagens = function() {
    document.getElementById('vantagensModal').hidden = true;
  };

  document.getElementById('vantagensModal').addEventListener('click', function(e) {
    if (e.target === this) closeVantagens();
  });

  const b = window.__API_BASE || '/api';
  fetch(b + '/products').then(function(r) { return r.json(); }).then(function(products) {
    products.forEach(function(p) {
      const btn = document.querySelector('.plan-choice__cta[data-produto="' + p.tipo + '"]');
      if (btn) {
        btn.dataset.preco = p.preco;
        const priceEl = btn.closest('.plan-choice').querySelector('.plan-choice__price-value');
        if (priceEl) priceEl.textContent = 'R$ ' + p.preco.toFixed(2).replace('.', ',');
      }
    });
  }).catch(function() {});

  // Plan names for display
  const planNames = {
    virtual: 'Vale Saúde Digital',
    fisico: 'Vale Saúde Completo'
  };

  document.querySelectorAll('.plan-choice__cta').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const produto = btn.dataset.produto;
      const preco = btn.dataset.preco;

      // 1. Highlight selected card
      document.querySelectorAll('.plan-card').forEach(function(c) { c.classList.remove('selected'); });
      const card = btn.closest('.plan-card');
      if (card) card.classList.add('selected');

      // 2. Visual feedback on the button
      const originalText = btn.textContent;
      btn.textContent = 'Selecionando...';
      btn.disabled = true;

      // 3. Update loading modal text to show progression
      const loadingModal = document.getElementById('loadingModal');
      const loadingText = loadingModal ? loadingModal.querySelector('.loading-modal__text') : null;
      const loadingSub = loadingModal ? loadingModal.querySelector('.loading-modal__sub') : null;

      const planName = planNames[produto] || 'Plano selecionado';

      // 4. Step animation via sequential text updates
      setTimeout(function() {
        if (card) {
          const feedback = card.querySelector('.plan-choice__feedback') || document.createElement('div');
          feedback.className = 'plan-choice__feedback';
          feedback.textContent = planName + ' selecionado!';
          card.querySelector('.plan-choice').appendChild(feedback);
        }
      }, 400);

      setTimeout(function() {
        if (loadingText) loadingText.textContent = 'Estamos preparando seu cart\u00e3o';
        if (loadingSub) loadingSub.textContent = 'Reservando seu benef\u00edcio...';
      }, 800);

      setTimeout(function() {
        if (loadingText) loadingText.textContent = 'Quase lá';
        if (loadingSub) loadingSub.textContent = 'Redirecionando para a liberação segura...';
      }, 2000);

      // 5. Show loading modal
      setTimeout(function() {
        if (loadingModal) loadingModal.style.display = 'flex';
      }, 400);

      // 6. Save and redirect
      sessionStorage.setItem('vs_produto', produto);
      sessionStorage.setItem('vs_preco', preco);
      sessionStorage.setItem('vs_nome_completo', nomeCompleto);

      const target = 'pagamento.html?clientId=' + clientId + '&nome=' + encodeURIComponent(nome) + '&nome_completo=' + encodeURIComponent(nomeCompleto) + '&limite=' + limite + '&produto=' + produto + '&preco=' + preco;

      setTimeout(function() {
        window.location.href = target;
      }, 3500);
    });
  });
})();