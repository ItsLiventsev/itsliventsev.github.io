#!/usr/bin/env python3
"""SEO-аудит статического сайта: воспроизводимая карта страниц.

Собирает по каждому HTML-маршруту то, что реально лежит в разметке (а не то,
что рисует JS): длины title/description, видимый текст, число внутренних
входящих/исходящих ссылок, наличие в sitemap, canonical, noindex, типы JSON-LD,
nofollow-ссылки на свои же страницы, видимые хлебные крошки.

Запуск:
    python3 scripts/seo-audit.py              # печатает сводку и пишет CSV
    python3 scripts/seo-audit.py --quiet      # только пишет CSV

Артефакт: docs/seo/page-map.csv (перезаписывается, коммитится как снимок).
Скрипт ничего не меняет в страницах — только читает.
"""
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://itsliventsev.github.io/'
OUT = os.path.join(ROOT, 'docs', 'seo', 'page-map.csv')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.arena'}

# 30–60 и 120–165 — контентные правила из docs/seo.md; для аудита берём
# верхние пороги, при которых сниппет ещё не обрезается.
TITLE_MAX = 62
DESC_MAX = 170
THIN_WORDS = 350


def pages():
    acc = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name.endswith('.html'):
                acc.append(os.path.relpath(os.path.join(base, name), ROOT).replace(os.sep, '/'))
    return sorted(acc)


def url_of(rel):
    """Каноническая форма сайта — с явным index.html (/stands/index.html).

    Так canonical, sitemap и внутренние ссылки говорят на одном языке; форма
    с хвостовым слэшем отдаёт 200 без редиректа и канонизируется на эту.
    """
    return SITE + rel


def url_to_rel(url):
    rel = url[len(SITE):]
    if rel == '' or rel.endswith('/'):
        rel += 'index.html'
    return rel


def strip_noise(html):
    """Текст без скриптов, стилей и JSON-островов: именно его видит робот."""
    body = html
    for pattern in (r'<script\b.*?</script>', r'<style\b.*?</style>', r'<svg\b.*?</svg>'):
        body = re.sub(pattern, ' ', body, flags=re.S | re.I)
    return body


def visible_words(html):
    body = strip_noise(html)
    cut = body.lower().find('<body')
    if cut != -1:
        body = body[cut:]
    text = re.sub(r'<[^>]+>', ' ', body)
    return len(re.findall(r'[А-Яа-яЁёA-Za-z]{2,}', text))


def json_island_words(html):
    """Сколько слов контента спрятано в <script type="application/json"> (стенды)."""
    total = 0
    for block in re.findall(r'<script[^>]*application/json[^>]*>(.*?)</script>', html, re.S | re.I):
        plain = re.sub(r'<[^>]+>', ' ', block)
        total += len(re.findall(r'[А-Яа-яЁёA-Za-z]{2,}', plain))
    return total


def jsonld_types(html):
    found = []
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            data = json.loads(block)
        except Exception:
            found.append('INVALID')
            continue
        for node in (data if isinstance(data, list) else [data]):
            found.append(node.get('@type', '?') if isinstance(node, dict) else '?')
    return found


def resolve_internal(page, href):
    href = href.split('#')[0].split('?')[0]
    if not href or href.startswith(('http:', 'https:', 'mailto:', 'tel:', 'javascript:', '//')):
        return None
    if href.startswith('/'):
        rel = href.lstrip('/')
    else:
        rel = os.path.normpath(os.path.join(os.path.dirname(page), href)).replace(os.sep, '/')
    if rel.endswith('/') or rel == '':
        rel += 'index.html'
    return rel


def main():
    quiet = '--quiet' in sys.argv
    files = pages()
    sitemap = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
    sitemap_urls = set(re.findall(r'<loc>(.*?)</loc>', sitemap))
    sitemap_rels = {url_to_rel(u) for u in sitemap_urls}
    source = {rel: open(os.path.join(ROOT, rel), encoding='utf-8').read() for rel in files}

    inlinks = Counter()
    outlinks = Counter()
    for rel, html in source.items():
        for href in re.findall(r'<a\b[^>]*href="([^"]+)"', html, re.I):
            target = resolve_internal(rel, href)
            if target and target in source and target != rel:
                inlinks[target] += 1
                outlinks[rel] += 1

    rows = []
    for rel in files:
        html = source[rel]
        head = html[:html.find('</head>')] if '</head>' in html else html
        title = (re.search(r'<title>(.*?)</title>', html, re.S) or [None, ''])[1].strip()
        desc = (re.search(r'<meta\s+name="description"\s+content="(.*?)"', html, re.S) or [None, ''])[1].strip()
        canonical = (re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', head) or [None, ''])[1]
        noindex = bool(re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', head, re.I))
        refresh = bool(re.search(r'http-equiv="refresh"', head, re.I))
        nofollow_internal = len(re.findall(
            r'<a\b[^>]*rel="[^"]*nofollow[^"]*"[^>]*href="(/[^"]+|[^":]+\.html)"', html, re.I))
        words = visible_words(html)
        island = json_island_words(html)
        types = jsonld_types(html)
        crumbs = 'да' if re.search(r'aria-label="Хлебные крошки"', html) else 'нет'
        expected = url_of(rel)
        # Главная живёт на '/', а не на '/index.html' — это её канонический вид.
        if rel == 'index.html':
            expected = SITE

        flags = []
        if not noindex and rel not in sitemap_rels:
            flags.append('нет в sitemap')
        if canonical and canonical != expected and not refresh:
            flags.append('canonical≠URL')
        if len(title) > TITLE_MAX:
            flags.append('title>62')
        if desc and len(desc) > DESC_MAX:
            flags.append('description>170')
        if not desc and not noindex:
            flags.append('нет description')
        if not noindex and words < THIN_WORDS:
            flags.append('тонко(<%d слов)' % THIN_WORDS)
        if island > words:
            flags.append('контент в JSON')
        if not noindex and inlinks[rel] == 0:
            flags.append('сирота(0 входящих)')
        if 'INVALID' in types:
            flags.append('битый JSON-LD')
        if refresh:
            flags.append('редирект-заглушка')
        if nofollow_internal:
            flags.append('nofollow на свои же (%d)' % nofollow_internal)

        rows.append({
            'url': expected,
            'file': rel,
            'section': rel.split('/')[0] if '/' in rel else 'root',
            'noindex': 'да' if noindex else 'нет',
            'in_sitemap': 'да' if rel in sitemap_rels else 'нет',
            'title_len': len(title),
            'desc_len': len(desc),
            'h1': (re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S) or [None, ''])[1].strip(),
            'words_visible': words,
            'words_json_island': island,
            'inlinks': inlinks[rel],
            'outlinks': outlinks[rel],
            'canonical': canonical,
            'jsonld': '|'.join(types),
            'visible_crumbs': crumbs,
            'flags': '; '.join(flags),
        })

    indexable = [r for r in rows if r['noindex'] == 'нет']
    print('── SEO-карта %s ──' % '2026-11-04')
    print('маршрутов: %d · индексируемых: %d · в sitemap: %d'
          % (len(rows), len(indexable), len(sitemap_rels)))
    problems = Counter()
    for row in indexable:
        for flag in filter(None, (f.strip() for f in row['flags'].split(';'))):
            problems[re.sub(r'\s*\(\d+\)|\s*\(\d+ слов\)', '', flag)] += 1
    for name, count in problems.most_common():
        print('  %-28s %d' % (name, count))
    thin = sum(1 for r in indexable if r['words_visible'] < THIN_WORDS)
    island = sum(1 for r in indexable if r['words_json_island'] > r['words_visible'])
    print('  видимого текста < %d слов: %d страниц (из них контент в JSON: %d)'
          % (THIN_WORDS, thin, island))
    print('  медиана видимого текста: %d слов'
          % sorted(r['words_visible'] for r in indexable)[len(indexable) // 2])
    by_section = defaultdict(lambda: [0, 0])
    for row in indexable:
        by_section[row['section']][0] += 1
        by_section[row['section']][1] += row['words_visible']
    print('  разделы: ' + ', '.join('%s %d' % (k, v[0]) for k, v in sorted(by_section.items())))
    dup_titles = Counter(r['title_len'] and r['file'] for r in rows)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    if not quiet:
        print('CSV: %s (%d строк)' % (os.path.relpath(OUT, ROOT), len(rows)))


if __name__ == '__main__':
    main()
