/* ==========================================================================
   DOM-KIT · общие мелочи движков учебных вселенных.
   Раньше esc/$/setMsg копировались в каждый IIFE-движок; теперь — один
   источник правды. dom-kit.js подключается раньше движков на всех страницах
   stands/ и на admin.html (проверяется регрессионным харнессом).
   UMD: window.DOMKIT в браузере, module.exports в Node (тесты).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DOMKIT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* Экранирование пользовательского контента перед вставкой в innerHTML */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Сообщение статуса формы: textContent (без HTML) + класс is-ok/is-bad/is-warn */
  function setMsg(el, text, state) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.remove('is-ok', 'is-bad', 'is-warn');
    if (state) el.classList.add('is-' + state);
  }

  /* Декоративные виджеты не должны ронять основную механику страницы */
  function safeRun(name, fn) {
    try { fn(); } catch (err) { if (typeof window !== 'undefined' && window.console) console.warn('[' + name + ']', err); }
  }

  return { $: $, esc: esc, setMsg: setMsg, safeRun: safeRun };
});
