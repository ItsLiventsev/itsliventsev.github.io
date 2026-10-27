/* ==========================================================================
   MASCOTS · инлайн-SVG маскоты учебной вселенной «СетьПолис»
   Плоская геометрия под дизайн стендов (1px линии, без теней и градиентов),
   читаются и в тёмной, и в светлой теме. Анимации — только CSS-классами:
   .mc-float (покачивание), .mc-eye (моргание), .mc-wave (приветствие).
   UMD: window.MASCOTS в браузере, module.exports в Node (тесты).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.MASCOTS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INK = '#1d242e';      // тёмные детали (нос, зрачки)
  var LIGHT = '#f5f7fa';    // светлые части (щёки, живот)
  var LINE = 'var(--st-line-strong, #39424d)';

  /* Общие глаза: моргание делает CSS через transform-scaleY */
  function eyes(cx1, cx2, cy, r, big) {
    r = r || 4;
    var pr = big ? r * 0.55 : r * 0.5;
    function one(cx) {
      return '<g class="mc-eye">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + LIGHT + '" stroke="' + LINE + '" stroke-width="1.2"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + pr + '" fill="' + INK + '"/>' +
        '<circle cx="' + (cx - pr * 0.35) + '" cy="' + (cy - pr * 0.4) + '" r="' + (pr * 0.32) + '" fill="#fff"/>' +
        '</g>';
    }
    return one(cx1) + one(cx2);
  }
  function smile(d) {
    return '<path d="' + (d || 'M26 44 Q32 49 38 44') + '" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
  }
  function nose(cx, cy, r) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (r || 2.6) + '" ry="' + ((r || 2.6) * 0.8) + '" fill="' + INK + '"/>';
  }

  var ART = {
    raccoon: function (c) {
      return '<path d="M16 14 L24 26 L12 25 Z" fill="' + shade(c) + '"/>' +
        '<path d="M48 14 L40 26 L52 25 Z" fill="' + shade(c) + '"/>' +
        '<circle cx="32" cy="35" r="21" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        '<path d="M16 31 Q22 26 28 31 Q27 38 22 38 Q16 37 16 31 Z" fill="' + INK + '"/>' +
        '<path d="M48 31 Q42 26 36 31 Q37 38 42 38 Q48 37 48 31 Z" fill="' + INK + '"/>' +
        eyes(22, 42, 33, 4.2) +
        nose(32, 41) + smile('M27 45 Q32 49 37 45') +
        '<path d="M22 50 Q32 55 42 50" fill="none" stroke="' + shade(c) + '" stroke-width="2" stroke-linecap="round"/>';
    },
    fox: function (c) {
      return '<path d="M14 10 L26 24 L10 26 Z" fill="' + c + '"/><path d="M17 14 L22 22 L13 22 Z" fill="' + INK + '"/>' +
        '<path d="M50 10 L38 24 L54 26 Z" fill="' + c + '"/><path d="M47 14 L42 22 L51 22 Z" fill="' + INK + '"/>' +
        '<path d="M32 12 L50 30 Q48 52 32 56 Q16 52 14 30 Z" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        '<path d="M20 38 Q32 50 44 38 Q42 52 32 55 Q22 52 20 38 Z" fill="' + LIGHT + '"/>' +
        eyes(24, 40, 33, 4) + nose(32, 42, 2.8) +
        '<path d="M28 46 Q32 49 36 46" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round"/>';
    },
    crab: function (c) {
      var legs = '';
      for (var i = 0; i < 3; i++) {
        var y = 40 + i * 5;
        legs += '<path d="M14 ' + y + ' L7 ' + (y + 3) + '" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
                '<path d="M50 ' + y + ' L57 ' + (y + 3) + '" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
      }
      return legs +
        '<g class="mc-wave"><path d="M16 34 Q7 32 8 24 Q13 20 17 25" fill="none" stroke="' + c + '" stroke-width="3.4" stroke-linecap="round"/></g>' +
        '<path d="M48 34 Q57 32 56 24 Q51 20 47 25" fill="none" stroke="' + c + '" stroke-width="3.4" stroke-linecap="round"/>' +
        '<circle cx="9" cy="23" r="3.4" fill="' + c + '"/><circle cx="55" cy="23" r="3.4" fill="' + c + '"/>' +
        '<line x1="25" y1="27" x2="24" y2="20" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
        '<line x1="39" y1="27" x2="40" y2="20" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
        eyes(24, 40, 18, 3.4) +
        '<ellipse cx="32" cy="40" rx="19" ry="14" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        smile('M27 43 Q32 47 37 43');
    },
    owl: function (c) {
      return '<path d="M18 12 L24 24 L14 22 Z" fill="' + shade(c) + '"/><path d="M46 12 L40 24 L50 22 Z" fill="' + shade(c) + '"/>' +
        '<ellipse cx="32" cy="35" rx="20" ry="22" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        '<ellipse cx="32" cy="44" rx="12" ry="11" fill="' + LIGHT + '"/>' +
        eyes(24, 40, 31, 6.5, true) +
        '<path d="M32 36 L28.5 41 L35.5 41 Z" fill="' + INK + '"/>' +
        '<path d="M26 50 Q32 53 38 50" fill="none" stroke="' + shade(c) + '" stroke-width="1.8" stroke-linecap="round"/>';
    },
    cat: function (c) {
      return '<path d="M15 16 L24 27 L11 28 Z" fill="' + c + '"/><path d="M49 16 L40 27 L53 28 Z" fill="' + c + '"/>' +
        '<path d="M18 20 L22 26 L15 26 Z" fill="#f2a7b8"/><path d="M46 20 L42 26 L49 26 Z" fill="#f2a7b8"/>' +
        '<circle cx="32" cy="36" r="20" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        eyes(24, 40, 34, 4) + nose(32, 41, 2.2) +
        '<line x1="12" y1="40" x2="22" y2="41" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        '<line x1="12" y1="44" x2="22" y2="43" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        '<line x1="52" y1="40" x2="42" y2="41" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        '<line x1="52" y1="44" x2="42" y2="43" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        smile('M28 45 Q32 48 36 45');
    },
    wolf: function (c) {
      return '<path d="M13 11 L25 25 L9 27 Z" fill="' + c + '"/><path d="M51 11 L39 25 L55 27 Z" fill="' + c + '"/>' +
        '<path d="M32 13 L49 29 Q47 51 32 56 Q17 51 15 29 Z" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        '<path d="M24 40 L32 52 L40 40 Q36 45 32 45 Q28 45 24 40 Z" fill="' + LIGHT + '"/>' +
        eyes(24, 40, 33, 3.8) + nose(32, 43, 2.6) +
        '<path d="M28 47 Q32 50 36 47" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round"/>';
    },
    otter: function (c) {
      return '<circle cx="17" cy="22" r="5" fill="' + c + '"/><circle cx="47" cy="22" r="5" fill="' + c + '"/>' +
        '<circle cx="32" cy="36" r="21" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        '<ellipse cx="32" cy="43" rx="13" ry="10" fill="' + LIGHT + '"/>' +
        eyes(24, 40, 33, 4) + nose(32, 41, 2.6) +
        '<line x1="13" y1="41" x2="22" y2="42" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        '<line x1="51" y1="41" x2="42" y2="42" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        smile('M27 46 Q32 49 37 46');
    },
    hedgehog: function (c) {
      var spikes = '';
      for (var a = 200; a <= 340; a += 20) {
        var rad = (a * Math.PI) / 180;
        var x1 = 32 + 18 * Math.cos(rad), y1 = 37 + 18 * Math.sin(rad);
        var x2 = 32 + 25 * Math.cos(rad), y2 = 37 + 25 * Math.sin(rad);
        spikes += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>';
      }
      return spikes +
        '<circle cx="32" cy="37" r="19" fill="' + c + '" stroke="' + LINE + '" stroke-width="1.4"/>' +
        '<ellipse cx="32" cy="42" rx="12" ry="10" fill="' + LIGHT + '"/>' +
        eyes(26, 38, 34, 3.6) + nose(32, 43, 2.4) +
        '<path d="M29 47 Q32 49 35 47" fill="none" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/>';
    }
  };

  /* Затемнение на тон для ушей/вставок (без зависимостей от цветовых функций) */
  function shade(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, ((n >> 16) & 255) - 28), g = Math.max(0, ((n >> 8) & 255) - 28), b = Math.max(0, (n & 255) - 28);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  var COLORS = {
    raccoon: '#8b93a7', fox: '#e8843c', crab: '#ef5d5d', owl: '#9b7bd4',
    cat: '#5b9dff', wolf: '#7d8fa3', otter: '#3aa6a0', hedgehog: '#b0794a'
  };

  function svg(id, opts) {
    opts = opts || {};
    var art = ART[id] ? id : 'raccoon';
    var size = opts.size || 56;
    var cls = 'mc-svg' + (opts.floating === false ? '' : ' mc-float') + (opts.cls ? ' ' + opts.cls : '');
    return '<svg class="' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" role="img" ' +
      'aria-label="' + art + '" xmlns="http://www.w3.org/2000/svg">' + ART[art](COLORS[art]) + '</svg>';
  }

  /* Карточка-реплика маскота: svg + облачко речи. who — имя персонажа */
  function speech(id, who, text, opts) {
    opts = opts || {};
    return '<div class="mc-speech ' + (opts.align === 'right' ? 'is-right' : '') + '">' +
      '<div class="mc-speech-avatar">' + svg(id, { size: opts.size || 64 }) + '</div>' +
      '<div class="mc-bubble"><p class="mc-who">' + who + '</p><p class="mc-text">' + text + '</p></div></div>';
  }

  return {
    IDS: Object.keys(ART),
    COLORS: COLORS,
    svg: svg,
    speech: speech
  };
});
