/* ==========================================================================
   itsliventsev · i18n-движок (волна 10): реестр переводов в общем JS.
   Страница регистрирует словарь: window.I18N.register({ru:{...},en:{...}}),
   движок применяет переводы к [data-i18n], помнит выбор в localStorage.
   Зависимостей нет; без JS текст остаётся русским из разметки.
   ========================================================================== */
(function () {
  'use strict';
  if (typeof document === 'undefined') return; /* Node/тесты */
  var dict = null;
  var lang = 'ru';
  try { lang = localStorage.getItem('itsliventsev-lang') === 'en' ? 'en' : 'ru'; } catch (e) {}
  function apply() {
    document.documentElement.lang = lang;
    var ind = document.getElementById('lang-indicator');
    if (ind) ind.textContent = lang === 'ru' ? 'EN' : 'RU';
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-i18n');
      if (dict && dict[lang] && Object.prototype.hasOwnProperty.call(dict[lang], k)) {
        nodes[i].textContent = dict[lang][k];
      }
    }
  }
  function toggle() {
    lang = lang === 'ru' ? 'en' : 'ru';
    try { localStorage.setItem('itsliventsev-lang', lang); } catch (e) {}
    apply();
  }
  window.I18N = {
    register: function (d) { dict = d; apply(); },
    toggle: toggle,
    lang: function () { return lang; }
  };
  /* обратная совместимость inline onclick */
  window.toggleLang = toggle;
})();
