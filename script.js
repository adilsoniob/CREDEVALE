(function() {

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }
function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

document.addEventListener('DOMContentLoaded', function() {

  // FAQ Accordion
  document.querySelectorAll('.faq__question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq__question').forEach(function(b) {
        b.setAttribute('aria-expanded', 'false');
        var answer = b.parentNode.querySelector('.faq__answer');
        if (answer) answer.hidden = true;
      });
      if (!expanded) {
        btn.setAttribute('aria-expanded', 'true');
        var answer = btn.parentNode.querySelector('.faq__answer');
        if (answer) answer.hidden = false;
      }
    });
  });

  // CPF Simulation — new flow: 10-15s analysis → "Aguarde" → pre-approved
  var cpfInput = document.getElementById('cpfSimulacao');
  var formSim = document.getElementById('formSimulacao');
  var btnConsultar = document.getElementById('btnConsultar');
  var resultado = document.getElementById('simulacaoResultado');

  if (cpfInput) {
    cpfInput.addEventListener('input', function(e) {
      var v = e.target.value.replace(/\D/g, '');
      if (v.length > 3) v = v.slice(0,3) + '.' + v.slice(3);
      if (v.length > 7) v = v.slice(0,7) + '.' + v.slice(7);
      if (v.length > 11) v = v.slice(0,11) + '-' + v.slice(11);
      e.target.value = v.slice(0,14);
    });
  }

  if (formSim) {
    formSim.addEventListener('submit', async function(e) {
      e.preventDefault();
      var cpf = cpfInput.value.replace(/\D/g, '');
      if (cpf.length !== 11) {
        resultado.textContent = 'Digite um CPF v\u00e1lido.';
        resultado.style.color = '#EF4444';
        resultado.style.display = 'block';
        return;
      }
      btnConsultar.disabled = true;
      btnConsultar.textContent = 'Consultando...';
      resultado.style.display = 'none';

      var modal = document.getElementById('simModalProcessando');
      var body = document.getElementById('simAnalysisBody');
      var steps = document.querySelectorAll('#simStepsContainer .step');
      var modalPre = document.getElementById('simModalPreapproved');
      var preName = document.getElementById('simPreName');
      var preText = document.getElementById('simPreText');

      show(modal);

      // Save original modal content to restore later
      var originalBodyHTML = body.innerHTML;

      // Fire CPF API + client check in parallel
      var b = window.__API_BASE || '/api';
      var cpfPromise = fetch(b+'/cpf/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf })
      }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });

      var clientPromise = fetch(b+'/clients/by-cpf/' + cpf)
        .then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });

      // Step labels for the 10-15s analysis
      var topicos = [
        'Dados recebidos',
        'Verificando cadastro',
        'Analisando cr\u00e9dito',
        'Consultando disponibilidade',
        'Calculando perfil',
        'Validando proposta'
      ];

      var analysisTime = 10000 + Math.floor(Math.random() * 5001); // 10-15s
      var stepInterval = analysisTime / (topicos.length - 1);

      // Mark first step as done
      if (steps[0]) { steps[0].classList.add('done'); }

      // Animate through steps
      for (var i = 1; i < steps.length; i++) {
        await delay(stepInterval);
        // Mark previous as done
        if (steps[i-1]) {
          steps[i-1].classList.remove('active');
          steps[i-1].classList.add('done');
        }
        // Mark current as active
        if (steps[i]) {
          steps[i].classList.add('active');
        }
      }

      // Wait for API calls to finish (they should be done by now)
      var result = await cpfPromise;
      var clientData = await clientPromise;

      await delay(300);

      // If client is already approved/activated, redirect to parabens
      if (clientData && (clientData.status === 'aprovado' || clientData.status === 'ativado')) {
        var primeiroNome = '';
        if (result) {
          var d = result.data || result;
          primeiroNome = (d.nome_completo || d.nome || '').split(' ')[0];
        }
        sessionStorage.setItem('vs_clientId', clientData.id);
        sessionStorage.setItem('vs_nome', primeiroNome || '');
        sessionStorage.setItem('vs_nome_completo', clientData.nome || '');
        hide(modal);
        window.location.href = 'parabens.html?clientId=' + clientData.id + '&nome=' + encodeURIComponent(primeiroNome || '');
        btnConsultar.disabled = false;
        btnConsultar.textContent = 'Consultar disponibilidade';
        return;
      }

      // --- Transition: "Aguarde, encontramos uma proposta..." ---
      body.innerHTML = '<div class="spinner"></div>'
        + '<h2 style="font-size:1.1rem;">Aguarde</h2>'
        + '<p style="font-size:0.9rem;color:var(--color-text);">Encontramos uma proposta pr\u00e9-aprovada para voc\u00ea!</p>';

      await delay(1500);

      // --- Show pre-approved modal ---
      hide(modal);

      // Extract first name from CPF API result for personalization
      var primeiroNome2 = '';
      if (result) {
        var d2 = result.data || result;
        primeiroNome2 = (d2.nome_completo || d2.nome || '').split(' ')[0];
      }

      if (primeiroNome2) {
        preName.textContent = primeiroNome2 + ', temos um cr\u00e9dito pr\u00e9-aprovado para voc\u00ea!';
      } else {
        preName.textContent = 'Temos um cr\u00e9dito pr\u00e9-aprovado para voc\u00ea!';
      }

      preText.textContent = 'Continue seu cadastro para ativar seu Cart\u00e3o Vale Sa\u00fade e aproveitar todos os benef\u00edcios.';

      show(modalPre);

      btnConsultar.disabled = false;
      btnConsultar.textContent = 'Consultar disponibilidade';

      // Restore original modal content and reset step classes for next time
      body.innerHTML = originalBodyHTML;
      document.querySelectorAll('#simStepsContainer .step').forEach(function(s) {
        s.classList.remove('done', 'active');
      });
    });
  }

  // Solicitar Agora → cadastro
  document.getElementById('btnSimSolicitar').addEventListener('click', function() {
    window.location.href = 'cadastro.html';
  });

  // Close modals on overlay click
  document.querySelectorAll('#simModalProcessando .modal__overlay, #simModalPreapproved .modal__overlay').forEach(function(ov) {
    ov.addEventListener('click', function() {
      var parent = ov.parentNode;
      if (parent) parent.hidden = true;
    });
  });

  // Smooth scroll
  var simBtn = document.getElementById('btnSimular');
  if (simBtn) {
    simBtn.addEventListener('click', function() {
      document.getElementById('simulacao').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Nav modals
  document.querySelectorAll('.header__nav-link--modal').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var modalId = btn.dataset.modal;
      var modal = document.getElementById(modalId);
      if (modal) modal.hidden = false;
    });
  });
  document.querySelectorAll('.nav-modal__overlay, [data-close-modal]').forEach(function(el) {
    el.addEventListener('click', function() {
      var modal = el.closest('.modal');
      if (modal) modal.hidden = true;
    });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.nav-modal:not([hidden])').forEach(function(m) { m.hidden = true; });
    }
  });

});

})();
