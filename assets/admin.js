/* ==========================================================================
   Админ-панель itsliventsev
   - вход по fine-grained PAT (sessionStorage, не localStorage) или
     GitHub Device Flow (если задан oauthClientId в admin-config.js)
   - создание заметок/статей и коммит через GitHub Contents API
   Секретов в коде нет. Токен живёт только в текущей вкладке.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.ADMIN_CONFIG || {};
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'itsliventsev-admin-token';
  const $ = (id) => document.getElementById(id);

  const TYPE_LABELS = {
    blog: { note: 'заметка', thought: 'мысль', digest: 'подборка', extra: 'доп. материал' },
    articles: { conference: 'конференция', methodical: 'методичка', book: 'книга/сборник' }
  };
  const SECTION_ACCENT = { blog: 'rose', articles: 'orange' };

  /* ---------- утилиты ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // Транслит для slug
  function slugify(text) {
    const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(text).toLowerCase()
      .split('').map((ch) => (map[ch] !== undefined ? map[ch] : ch)).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  async function gh(path, options) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const res = await fetch(API + path, Object.assign({
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, options || {}));
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
    return data;
  }

  function setMsg(el, text, ok) {
    el.textContent = text || '';
    el.className = 'admin-msg' + (text ? (ok ? ' is-ok' : ' is-err') : '');
  }

  /* ---------- мини-Markdown -> безопасный HTML ---------- */
  function markdown(md) {
    if (!md) return '';
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let code = null, list = null;

    const inline = (s) => {
      let out = esc(s);
      out = out.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener nofollow">' + t + '</a>');
      return out;
    };
    const closeList = () => { if (list) { html.push('</' + list + '>'); list = null; } };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^```/.test(line)) {
        if (code) { html.push('</code></pre>'); code = null; }
        else { closeList(); html.push('<pre><code>'); code = true; }
        continue;
      }
      if (code) { html.push(esc(raw) + '\n'); continue; }
      if (!line.trim()) { closeList(); continue; }

      let m;
      if ((m = line.match(/^###\s+(.*)/))) { closeList(); html.push('<h3>' + inline(m[1]) + '</h3>'); continue; }
      if ((m = line.match(/^##\s+(.*)/))) { closeList(); html.push('<h2>' + inline(m[1]) + '</h2>'); continue; }
      if ((m = line.match(/^#\s+(.*)/))) { closeList(); html.push('<h2>' + inline(m[1]) + '</h2>'); continue; }
      if ((m = line.match(/^>\s?(.*)/))) { closeList(); html.push('<blockquote>' + inline(m[1]) + '</blockquote>'); continue; }
      if ((m = line.match(/^[-*]\s+(.*)/))) {
        if (list !== 'ul') { closeList(); html.push('<ul>'); list = 'ul'; }
        html.push('<li>' + inline(m[1]) + '</li>'); continue;
      }
      if ((m = line.match(/^\d+\.\s+(.*)/))) {
        if (list !== 'ol') { closeList(); html.push('<ol>'); list = 'ol'; }
        html.push('<li>' + inline(m[1]) + '</li>'); continue;
      }
      closeList();
      html.push('<p class="prose-p">' + inline(line) + '</p>');
    }
    closeList();
    if (code) html.push('</code></pre>');
    return html.join('\n');
  }

  /* ---------- сборка HTML поста по канону страниц сайта ---------- */
  function buildPostHtml(d, bodyHtml) {
    const section = d.section;
    const prefix = '../';
    const desc = esc(d.desc || d.title);
    const tags = d.tags.map(esc).join(',');
    const typeMeta = '    <meta name="post-type" content="' + esc(d.type) + '">\n';
    const tagsMeta = tags ? '    <meta name="post-tags" content="' + tags + '">\n' : '';
    const rtMeta = d.readtime ? '    <meta name="post-readtime" content="' + esc(d.readtime) + '">\n' : '';
    const srcMeta = d.source ? '    <meta name="post-source" content="' + esc(d.source) + '">\n' : '';
    const draftMeta = d.draft ? '    <meta name="post-status" content="draft">\n' : '';
    const navItems = [
      ['index.html', 'главная', ''], ['blog.html', 'заметки', 'blog'],
      ['articles.html', 'статьи', 'articles'], ['projects.html', 'проекты', 'projects'],
      ['archive.html', 'архив', 'archive']
    ].map(([href, label, key]) => {
      const active = (section === key) ? ' active" aria-current="page' : '';
      const wip = key === 'blog' ? ' is-wip' : '';
      const plate = key === 'blog' ? ' <span class="nav-wip" title="раздел в разработке, материалы пока не актуальны">в разработке</span>' : '';
      return `      <a href="${prefix}${href}" class="nav-link${wip}${active}">${label}${plate}</a>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="ru" class="scroll-smooth">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#fafafa">
<meta name="color-scheme" content="light dark">
<script>(function(){try{var t=localStorage.getItem('itsliventsev-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
<title>${esc(d.title)} · itsliventsev</title>
<meta name="description" content="${desc}">
<meta name="post-date" content="${esc(d.date)}">
${typeMeta}${tagsMeta}${rtMeta}${srcMeta}${draftMeta}<link rel="icon" type="image/svg+xml" href="${prefix}assets/favicon.svg">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}assets/site.css?v=20261026n">
</head>
<body class="bg-grid" data-accent="${SECTION_ACCENT[section]}">
<a class="skip-link" href="#main-content">перейти к содержанию</a>
<noscript><div class="noscript-bar">// JavaScript отключён: навигация и тексты доступны, но ленты, переключение темы и анимации не работают.</div></noscript>

<!-- Ambient-фон: мягкие орбы и парящие терминальные глифы -->
<div class="ambient" aria-hidden="true">
  <span class="orb orb-1"></span>
  <span class="orb orb-2"></span>
  <span class="ambient-glyph">#</span>
  <span class="ambient-glyph">/</span>
  <span class="ambient-glyph">&gt;_</span>
</div>

<div class="scroll-progress" id="scroll-progress"></div>
<button id="to-top" title="наверх" aria-label="наверх"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>

<div class="page-wrap">

  <header class="site-header reveal">
    <a href="${prefix}${section}.html" class="logo"><span class="arrow">←</span> ${section === 'blog' ? 'заметки' : 'статьи'}</a>
    <nav class="site-nav" aria-label="Основная навигация">
${navItems}
    </nav>

    <div class="header-actions">
    <button class="icon-btn theme-toggle" type="button" aria-pressed="false" title="включить тёмную тему" aria-label="включить тёмную тему">
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    </button>
    </div>
  </header>

  <main id="main-content" class="prose-measure">

    <nav class="mono text-xs mb-6 flex items-center gap-2 flex-wrap" style="color:var(--faint);" aria-label="Хлебные крошки">
      <a href="${prefix}index.html" class="nav-link" style="padding:.2rem .4rem;">главная</a>
      <span>/</span>
      <a href="${prefix}${section}.html" class="nav-link" style="padding:.2rem .4rem;">${section === 'blog' ? 'заметки' : 'статьи'}</a>
    </nav>

    <article class="reveal">
      <div class="article-meta">
        <span class="pill ${section === 'blog' ? 'pill-rose' : 'pill-amber'}">${esc(TYPE_LABELS[section][d.type] || d.type)}</span>
        <span class="dot"></span><span>${esc(d.date)}</span>
        ${d.readtime ? '<span class="dot"></span><span>≈ ' + esc(d.readtime) + '</span>' : ''}
      </div>

      <h1 class="hero-title text-3xl sm:text-4xl mb-6">${esc(d.title)}</h1>

${bodyHtml}
    </article>

    <div class="mt-10 flex flex-wrap gap-3">
      <a href="${prefix}${section}.html" class="btn"><span class="arrow">←</span> назад</a>
    </div>

  </main>

  <footer class="site-footer">
    <span>© 2026 itsliventsev · ${section === 'blog' ? 'заметки' : 'статьи'}</span>
    <a href="${prefix}admin.html" class="admin-link" rel="nofollow">admin</a>
  </footer>

</div>

<script src="${prefix}assets/site.js?v=20261026n"></script>
</body>
</html>
`;
  }

  /* ---------- состояние формы ---------- */
  function readForm() {
    return {
      section: $('f-section').value,
      type: $('f-type').value,
      date: $('f-date').value || todayISO(),
      title: $('f-title').value.trim(),
      slug: $('f-slug').value.trim(),
      desc: $('f-desc').value.trim(),
      tags: $('f-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      readtime: $('f-readtime').value.trim(),
      source: $('f-source').value.trim(),
      draft: $('f-draft').checked,
      body: $('f-body').value
    };
  }

  function refreshTypeOptions() {
    const section = $('f-section').value;
    const sel = $('f-type');
    sel.innerHTML = Object.entries(TYPE_LABELS[section])
      .map(([v, label]) => '<option value="' + v + '">' + label + '</option>').join('');
    $('source-wrap').hidden = section !== 'articles';
  }

  function refreshPreview() {
    const d = readForm();
    const title = d.title ? '<h1>' + esc(d.title) + '</h1>' : '';
    $('preview').innerHTML = (title || d.body) ? title + markdown(d.body)
      : '<p class="admin-hint">начните писать — здесь появится вёрстка</p>';
  }

  /* ---------- авторизация ---------- */
  function showWorkspace(login) {
    $('auth-card').hidden = true;
    $('workspace').hidden = false;
    $('gh-login').textContent = login;
    loadPosts();
  }

  async function verifyToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    const me = await gh('/user');
    return me.login;
  }

  $('pat-login').addEventListener('click', async () => {
    const token = $('pat-input').value.trim();
    if (!token) { setMsg($('auth-msg'), 'вставьте токен', false); return; }
    setMsg($('auth-msg'), 'проверяю токен…', true);
    try {
      const login = await verifyToken(token);
      setMsg($('auth-msg'), '');
      showWorkspace(login);
    } catch (e) {
      sessionStorage.removeItem(TOKEN_KEY);
      setMsg($('auth-msg'), 'ошибка: ' + e.message, false);
    }
  });

  $('logout').addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  // Вкладки способов входа
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.admin-pane').forEach((p) => {
        p.hidden = p.dataset.pane !== tab.dataset.tab;
      });
    });
  });

  // Device Flow — доступен только при заданном client_id
  if (CFG.oauthClientId) {
    $('device-tab').hidden = false;
    let polling = null;

    $('device-start').addEventListener('click', async () => {
      const status = $('device-status');
      setMsg($('auth-msg'), '');
      try {
        const fr = await fetch('https://github.com/login/device/code', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams({ client_id: CFG.oauthClientId, scope: 'repo' })
        }).then((r) => r.json());
        if (fr.error) throw new Error(fr.error_description || fr.error);

        $('device-box').hidden = false;
        $('device-usercode').textContent = fr.user_code;
        $('device-link').href = fr.verification_uri;
        status.textContent = 'ожидание подтверждения на github.com…';

        let interval = fr.interval || 5;
        const deadline = Date.now() + (fr.expires_in || 899) * 1000;
        polling = setInterval(async () => {
          if (Date.now() > deadline) {
            clearInterval(polling);
            status.textContent = 'код истёк — получите новый';
            return;
          }
          const tr = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: new URLSearchParams({
              client_id: CFG.oauthClientId,
              device_code: fr.device_code,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
          }).then((r) => r.json());

          if (tr.error === 'authorization_pending') return;
          if (tr.error === 'slow_down') { interval += 5; return; }
          clearInterval(polling);
          if (tr.error) { status.textContent = 'ошибка: ' + tr.error; return; }
          status.textContent = 'доступ выдан ✓';
          const login = await verifyToken(tr.access_token);
          showWorkspace(login);
        }, interval * 1000);
      } catch (e) {
        setMsg($('auth-msg'), 'Device Flow: ' + e.message, false);
      }
    });
  }

  /* ---------- публикация ---------- */
  $('f-section').addEventListener('change', refreshTypeOptions);
  ['f-title', 'f-body'].forEach((id) => $(id).addEventListener('input', refreshPreview));
  $('f-body').addEventListener('input', refreshPreview);

  $('slug-gen').addEventListener('click', () => {
    const d = readForm();
    const base = slugify(d.title) || 'post';
    $('f-slug').value = d.date ? d.date + '-' + base : base;
  });

  $('publish').addEventListener('click', async () => {
    const d = readForm();
    if (!d.title) { setMsg($('pub-msg'), 'нужен заголовок', false); return; }
    if (!d.slug) { $('slug-gen').click(); d.slug = $('f-slug').value; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(d.slug)) { setMsg($('pub-msg'), 'slug: только латиница, цифры и дефис', false); return; }

    const path = d.section + '/' + d.slug + '.html';
    const html = buildPostHtml(d, markdown(d.body));
    setMsg($('pub-msg'), 'отправляю коммит…', true);

    try {
      // Если файл уже есть — нужен sha для обновления
      let sha;
      try { sha = (await gh('/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + path)).sha; }
      catch (e) { /* 404 — новый файл */ }

      await gh('/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + path, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + sessionStorage.getItem(TOKEN_KEY),
          Accept: 'application/vnd.github+json'
        },
        body: JSON.stringify({
          message: (sha ? 'update: ' : 'post: ') + path,
          content: b64encode(html),
          branch: CFG.branch,
          sha
        })
      });
      setMsg($('pub-msg'), 'готово ✓ коммит в ' + path + ' · индекс ленты обновит Action', true);
      loadPosts();
    } catch (e) {
      setMsg($('pub-msg'), 'ошибка коммита: ' + e.message, false);
    }
  });

  /* ---------- список и удаление постов ---------- */
  async function loadPosts() {
    const box = $('post-list');
    box.innerHTML = '<p class="admin-hint">загрузка…</p>';
    const rows = [];
    for (const section of ['blog', 'articles']) {
      try {
        const files = await gh('/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + section + '?ref=' + CFG.branch);
        files.filter((f) => f.name.endsWith('.html')).forEach((f) => rows.push(f));
      } catch (e) { /* папка могла быть пустой */ }
    }
    if (!rows.length) { box.innerHTML = '<p class="admin-hint">постов пока нет</p>'; return; }
    box.innerHTML = rows.map((f) =>
      '<div class="admin-postrow">'
      + '<span class="mono text-xs" style="color:var(--text-2);">' + esc(f.path) + '</span>'
      + '<button class="btn btn-sm admin-del" type="button" data-path="' + esc(f.path) + '" data-sha="' + esc(f.sha) + '">удалить</button>'
      + '</div>').join('');

    box.querySelectorAll('.admin-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить ' + btn.dataset.path + '? Действие попадёт отдельным коммитом.')) return;
        try {
          await gh('/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + btn.dataset.path, {
            method: 'DELETE',
            headers: {
              Authorization: 'Bearer ' + sessionStorage.getItem(TOKEN_KEY),
              Accept: 'application/vnd.github+json'
            },
            body: JSON.stringify({ message: 'delete: ' + btn.dataset.path, sha: btn.dataset.sha, branch: CFG.branch })
          });
          loadPosts();
        } catch (e) {
          alert('не удалось удалить: ' + e.message);
        }
      });
    });
  }

  /* ---------- инициализация ---------- */
  $('f-date').value = todayISO();
  refreshTypeOptions();
  refreshPreview();

  // Автовход, если токен уже есть в этой вкладке
  const saved = sessionStorage.getItem(TOKEN_KEY);
  if (saved) {
    gh('/user').then((me) => showWorkspace(me.login))
      .catch(() => sessionStorage.removeItem(TOKEN_KEY));
  }
})();
