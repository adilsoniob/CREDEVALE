// ============================================================
// Escolha do Plano - Vale Saúde
// ============================================================
(() => {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId') || sessionStorage.getItem('vs_clientId');
  const nome = params.get('nome') || sessionStorage.getItem('vs_nome') || 'Cliente';
  var nomeEl = document.getElementById('clienteNome');
  if (nomeEl) nomeEl.textContent = nome;
  const nomeCompleto = params.get('nome_completo') || sessionStorage.getItem('vs_nome_completo') || nome;
  const limite = params.get('limite') || sessionStorage.getItem('vs_limite') || '1500';

  const vantagens = {
    digital: [
      'Ativação imediata — use na hora',
      'Descontos de até 75% em farmácias parceiras',
      'Até 45 dias para pagar sua fatura',
      'App exclusivo para acompanhar seu saldo'
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
    title.textContent = tipo === 'digital' ? 'Cartão Digital' : 'Cartão Físico + Digital';
    list.innerHTML = items.map(function(v) { return '<li>' + v + '</li>'; }).join('');
    modal.hidden = false;
  };

  window.closeVantagens = function() {
    document.getElementById('vantagensModal').hidden = true;
  };

  document.getElementById('vantagensModal').addEventListener('click', function(e) {
    if (e.target === this) closeVantagens();
  });

  // Carrega preços dinâmicos dos produtos
  var _b=window.__API_BASE||'/api';fetch(_b+'/products').then(function(r) { return r.json(); }).then(function(products) {
    products.forEach(function(p) {
      var btn = document.querySelector('.plan-choice__cta[data-produto="' + p.tipo + '"]');
      if (btn) {
        btn.dataset.preco = p.preco;
        var priceEl = btn.closest('.plan-choice').querySelector('.plan-choice__price-value');
        if (priceEl) priceEl.textContent = 'R$ ' + p.preco.toFixed(2).replace('.', ',');
      }
    });
  }).catch(function() {});

  document.querySelectorAll('.plan-choice__cta').forEach(btn => {
    btn.addEventListener('click', () => {
      const produto = btn.dataset.produto;
      const preco = btn.dataset.preco;
      sessionStorage.setItem('vs_produto', produto);
      sessionStorage.setItem('vs_preco', preco);
      sessionStorage.setItem('vs_nome_completo', nomeCompleto);
      const target = 'pagamento.html?clientId=' + clientId + '&nome=' + encodeURIComponent(nome) + '&nome_completo=' + encodeURIComponent(nomeCompleto) + '&limite=' + limite + '&produto=' + produto + '&preco=' + preco;
      const el = document.getElementById('loadingModal');
      if (el) { el.style.display = 'flex'; }
      window.setTimeout(function() { window.location.href = target; }, 4000);
    });
  });
})();
