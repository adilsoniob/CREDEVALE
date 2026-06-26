(function() {
  'use strict';

  var POPUP_DELAY = 700;
  var POPUP_DURATION = 10;

  var popupEl = document.getElementById('popupPromo');
  var overlay = popupEl.querySelector('.popup-promo__overlay');
  var closeBtn = document.getElementById('popupCloseBtn');
  var timerEl = document.getElementById('popupTimerText');
  var titleEl = document.getElementById('popupTitle');
  var bodyEl = document.getElementById('popupBody');
  var ctaEl = document.getElementById('popupCta');

  var alreadyClosed = sessionStorage.getItem('vs_popup_closed');
  if (alreadyClosed) return;

  function loadConfig() {
    var b = window.__API_BASE || '/api';
    fetch(b + '/payments/config')
      .then(function(r) { return r.json(); })
      .then(function(config) {
        var c = config.popup || {};
        if (c.enabled === false) return;
        if (c.title) titleEl.textContent = c.title;
        if (c.subtitle) {
          bodyEl.innerHTML = '<p>' + c.subtitle.replace(/\n/g, '</p><p>') + '</p>';
        }
        if (c.cta) ctaEl.textContent = c.cta;
        scheduleShow();
      })
      .catch(function() { scheduleShow(); });
  }

  function scheduleShow() {
    setTimeout(function() {
      popupEl.hidden = false;
      document.body.style.overflow = 'hidden';
      startTimer();
    }, POPUP_DELAY);
  }

  var timerInterval;

  function startTimer() {
    var remaining = POPUP_DURATION;
    timerEl.textContent = 'Fechando em ' + remaining + 's';
    timerInterval = setInterval(function() {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        closePopup();
        return;
      }
      timerEl.textContent = 'Fechando em ' + remaining + 's';
    }, 1000);
  }

  function closePopup() {
    clearInterval(timerInterval);
    popupEl.hidden = true;
    document.body.style.overflow = '';
    sessionStorage.setItem('vs_popup_closed', '1');
  }

  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', closePopup);

  loadConfig();
})();
