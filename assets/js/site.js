/* RY Homes Management — site script
   - Language switch (EN / 中文), remembered per browser
   - Mobile menu, reveal motion, service picker, property review form
*/
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     FORM SETTINGS
     Paste the Google Apps Script web app URL here when the form backend
     is ready. While it is empty, the form shows a "not connected" notice
     and nothing is sent.
     ------------------------------------------------------------------ */
  var FORM_ENDPOINT = '';

  var ZH = window.ZH || {};
  var JS_EN = window.JS_EN || {};
  var LANG_KEY = 'ryhs-lang';
  var root = document.documentElement;
  var lang = 'en';

  function store(get, val) {
    try {
      if (get) return localStorage.getItem(LANG_KEY);
      localStorage.setItem(LANG_KEY, val);
    } catch (e) { return null; }
  }
  function t(key) { return lang === 'zh' && ZH[key] ? ZH[key] : (JS_EN[key] || ''); }

  var ATTRS = ['alt', 'placeholder', 'aria-label', 'content'];

  function applyLang(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    root.setAttribute('data-lang', lang);

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-en') === null) el.setAttribute('data-en', el.innerHTML);
      var k = el.getAttribute('data-i18n');
      el.innerHTML = lang === 'zh' && ZH[k] ? ZH[k] : el.getAttribute('data-en');
    }
    ATTRS.forEach(function (a) {
      var list = document.querySelectorAll('[data-i18n-' + a + ']');
      for (var j = 0; j < list.length; j++) {
        var n = list[j];
        var sk = 'data-en-' + a;
        if (n.getAttribute(sk) === null) n.setAttribute(sk, n.getAttribute(a) || '');
        var key = n.getAttribute('data-i18n-' + a);
        n.setAttribute(a, lang === 'zh' && ZH[key] ? ZH[key] : n.getAttribute(sk));
      }
    });
    var toggles = document.querySelectorAll('[data-lang-toggle]');
    for (var m = 0; m < toggles.length; m++) {
      toggles[m].textContent = lang === 'zh' ? 'EN' : '中文';
      toggles[m].setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
    }
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lang-toggle]');
    if (!btn) return;
    var next = lang === 'zh' ? 'en' : 'zh';
    store(false, next);
    applyLang(next);
  });

  var saved = store(true);
  applyLang(saved === 'zh' ? 'zh' : 'en');

  /* ---------------- Mobile menu ---------------- */
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    if (!menu) return;
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) { menu.removeAttribute('inert'); } else { menu.setAttribute('inert', ''); }
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger && menu) {
    setMenu(false);
    burger.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (q) { if (q.matches) setMenu(false); });
  }

  /* ---------------- Reveal on view ---------------- */
  var reveal = document.querySelectorAll('[data-reveal], .process');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting || en.boundingClientRect.top < 0) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    reveal.forEach(function (el) { io.observe(el); });
  } else {
    reveal.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------- Service picker ---------------- */
  var picker = document.querySelector('[data-picker]');
  if (picker) {
    var answers = {};
    var result = picker.querySelector('.result');
    var rTitle = picker.querySelector('.result__title');
    var rBody = picker.querySelector('.result__body');
    var rCta = picker.querySelector('.result__cta');

    function render() {
      var done = answers.listed && answers.vendors && answers.involve;
      result.setAttribute('data-ready', done ? 'true' : 'false');
      if (!done) {
        rTitle.textContent = t('js.pick.wait.title');
        rBody.textContent = t('js.pick.wait.body');
        return;
      }
      var plan = (answers.vendors === 'yes' && answers.involve === 'some') ? 'essential' : 'managed';
      var title = t(plan === 'essential' ? 'js.pick.ess.title' : 'js.pick.man.title');
      var body = t(plan === 'essential' ? 'js.pick.ess.body' : 'js.pick.man.body');
      if (answers.listed === 'no') body += ' ' + t('js.pick.new.body');
      rTitle.textContent = title;
      rBody.textContent = body;
      var interest = answers.listed === 'no' ? 'setup' : plan;
      rCta.setAttribute('href', rCta.getAttribute('data-base') + '?interest=' + interest);
    }
    picker.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-q]');
      if (!b) return;
      var q = b.getAttribute('data-q');
      answers[q] = b.getAttribute('data-v');
      var group = picker.querySelectorAll('button[data-q="' + q + '"]');
      group.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
    document.addEventListener('langchange', render);
    render();
  }

  /* ---------------- Property review form ---------------- */
  var form = document.getElementById('review-form');
  if (form) {
    var started = Date.now();
    var statusEl = document.getElementById('form-status');
    var summary = document.getElementById('form-summary');
    var submitBtn = form.querySelector('[type="submit"]');

    // Preselect service from ?interest=
    var params = new URLSearchParams(location.search);
    var pre = params.get('interest');
    if (pre) {
      var radio = form.querySelector('input[name="interest"][value="' + pre + '"]');
      if (radio) radio.checked = true;
    }

    var rules = [
      { name: 'name', key: 'js.err.name', test: function (v) { return v.trim().length >= 2; } },
      { name: 'email', key: 'js.err.email', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
      { name: 'phone', key: 'js.err.phone', test: function (v) { return v.trim() === '' || /^[0-9()+\-.\s]{7,20}$/.test(v.trim()); } },
      { name: 'city', key: 'js.err.city', test: function (v) { return v.trim().length >= 2; } },
      { name: 'zip', key: 'js.err.zip', test: function (v) { return v.trim() === '' || /^\d{5}$/.test(v.trim()); } },
      { name: 'consent', key: 'js.err.consent', test: function (v, el) { return el.checked; } }
    ];

    function fieldCheck(rule) {
      var el = form.elements[rule.name];
      var ok = rule.test(el.value || '', el);
      var err = document.getElementById('err-' + rule.name);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (err) {
        err.textContent = ok ? '' : t(rule.key);
        err.classList.toggle('show', !ok);
      }
      return ok;
    }
    rules.forEach(function (r) {
      var el = form.elements[r.name];
      el.addEventListener(r.name === 'consent' ? 'change' : 'blur', function () {
        if (el.value !== '' || r.name === 'consent' || el.getAttribute('aria-invalid') === 'true') fieldCheck(r);
      });
    });

    function showStatus(type, key) {
      statusEl.className = 'status show status--' + type;
      var icon = type === 'ok'
        ? '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
        : '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>';
      statusEl.innerHTML = icon + '<span>' + t(key) + '</span>';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.className = 'status';
      var bad = rules.filter(function (r) { return !fieldCheck(r); });
      if (bad.length) {
        summary.innerHTML = '<strong>' + t('js.err.summary') + '</strong><ul>' + bad.map(function (r) {
          return '<li><a href="#f-' + r.name + '">' + t(r.key) + '</a></li>';
        }).join('') + '</ul>';
        summary.classList.add('show');
        summary.focus();
        return;
      }
      summary.classList.remove('show');

      // Basic abuse checks (server must re-check these)
      if (form.elements.website.value !== '' || Date.now() - started < 3000) {
        showStatus('ok', 'js.ok');
        return;
      }

      if (!FORM_ENDPOINT) {
        showStatus('info', 'js.notConnected');
        return;
      }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = String(v).slice(0, 2000); });
      data.lang = lang;
      data.elapsed_ms = Date.now() - started;
      data.page = location.pathname;

      submitBtn.disabled = true;
      submitBtn.querySelector('[data-label]').textContent = t('js.sending');

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) {
            form.reset();
            started = Date.now();
            showStatus('ok', 'js.ok');
          } else {
            showStatus('err', 'js.fail');
          }
        })
        .catch(function () { showStatus('err', 'js.fail'); })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.querySelector('[data-label]').textContent = t('js.submit');
        });
    });

    document.addEventListener('langchange', function () {
      rules.forEach(function (r) {
        var err = document.getElementById('err-' + r.name);
        if (err && err.classList.contains('show')) err.textContent = t(r.key);
      });
    });
  }
})();
