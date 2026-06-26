// ============================================================
// Ativação Confirmada - Vale Saúde
// ============================================================
(() => {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId');
  const produto = params.get('produto');
  const metodo = params.get('metodo');

  const labels = { virtual: 'Vale Saúde Mobile', fisico: 'Vale Saúde Físico' };
  const el = document.getElementById('produtoFinal');
  if (el) el.textContent = labels[produto] || '—';

  const protocolo = document.getElementById('protocolo');
  if (protocolo) protocolo.textContent = 'VS-' + String(Date.now()).slice(-6);
})();
