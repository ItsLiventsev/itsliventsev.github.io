#!/usr/bin/env python3
"""Build the client-side full-text index for the static site.

Один источник правды: эта страница (assets/search-index.json) собирается из
HTML, а не правится руками. В CI работает `--check` — он пересобирает индекс в
память и падает, если файл в репозитории разошёлся с разметкой.

Что попадает в запись:
  title       — первый h1 страницы (fallback — <title> без суффикса сайта);
  url         — путь от корня, для index.html это «/»;
  category    — раздел сайта (см. category_for);
  description — meta description, обрезанный до 240 символов;
  content     — текст <main> без навигации, шапки, подвала и служебных блоков.

Шум интерфейса (шапка, крошки, подвал, «перейти к содержанию») в индекс не
попадает: иначе поиск по слову «консоли» находит половину сайта.
"""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'search-index.json'
SKIP = {'admin.html', '404.html', 'assets/offline.html'}
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.arena'}
# Теги, чей текст не является содержимым страницы.
# <nav> не глушим целиком: карта сайта и оглавления статей состоят из навигации,
# а шапка сайта и так живёт внутри <header>. Глушим только оболочку.
SILENT = {'script', 'style', 'noscript', 'svg', 'template', 'header', 'footer'}
# CSS-классы служебных элементов: их подписи — интерфейс, а не материал.
SILENT_CLASSES = ('skip-link', 'ui-skip', 'st-topbar', 'ui-masthead', 'ui-footer', 'ui-crumbs', 'ui-drawer', 'ui-tabbar', 'ui-search')


class Extract(HTMLParser):
    """Собирает текст <main> и запасной текст body отдельно."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.mute = []            # стек «молчащих» элементов
        self.main_depth = 0       # >0 — мы внутри <main>
        self.title_depth = self.h1_depth = 0
        self.title = self.h1 = ''
        self.description = ''
        self.main_text = []
        self.body_text = []

    # ——— служебное ———
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = (attrs.get('class') or '').split()
        if tag in SILENT or any(name in c for c in classes for name in SILENT_CLASSES):
            self.mute.append(tag)
        if tag == 'main':
            self.main_depth += 1
        if tag == 'title':
            self.title_depth += 1
        elif tag == 'h1':
            self.h1_depth += 1
        elif tag == 'meta' and attrs.get('name', '').lower() == 'description':
            self.description = attrs.get('content', '')
        elif tag == 'br':
            self._emit(' ')

    def handle_startendtag(self, tag, attrs):
        if tag == 'meta':
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in self.mute:
            for index in range(len(self.mute) - 1, -1, -1):
                if self.mute[index] == tag:
                    del self.mute[index]
                    break
        if tag == 'main' and self.main_depth:
            self.main_depth -= 1
        elif tag == 'title' and self.title_depth:
            self.title_depth -= 1
        elif tag == 'h1' and self.h1_depth:
            self.h1_depth -= 1

    @property
    def depth(self):
        return len(self.mute)

    def handle_data(self, data):
        clean = ' '.join(data.split())
        if not clean:
            return
        if self.title_depth:
            self.title += ' ' + clean
        if self.h1_depth and not self.depth:
            self.h1 += ' ' + clean
        self._emit(clean)

    def _emit(self, text):
        if self.depth:
            return
        if self.main_depth:
            self.main_text.append(text)
        self.body_text.append(text)


def category_for(path):
    p = path.as_posix()
    if p.startswith('stands/office/'): return 'ОфисПолис · учебная практика'
    if p.startswith('stands/ops/'): return 'ДатаПолис · учебная практика'
    if p.startswith('stands/'): return 'СетьПолис · учебная практика'
    if p.startswith('archive/'): return 'База знаний · архив'
    if p.startswith('articles/'): return 'Статьи'
    if p.startswith('blog/'): return 'Заметки'
    if p.startswith('projects/'): return 'Проекты'
    if p.endswith('projects.html'): return 'Проекты'
    if p.endswith('articles.html'): return 'Статьи'
    if p.endswith('blog.html'): return 'Заметки'
    if p.endswith('archive.html'): return 'База знаний'
    if p.endswith('faq.html'): return 'Справка'
    if p.endswith('sitemap.html'): return 'Навигация'
    return 'Портфолио'


def is_redirect(source):
    return bool(re.search(r'http-equiv="refresh"', source, re.I))


def build():
    records = []
    for path in sorted(ROOT.rglob('*.html')):
        rel = path.relative_to(ROOT)
        if any(part.startswith('.') or part in SKIP_DIRS for part in rel.parts):
            continue
        if rel.as_posix() in SKIP:
            continue
        source = path.read_text(encoding='utf-8')
        # Страницы-редиректы (старые адреса) в поиске не нужны: они ведут туда же,
        # куда ведёт цель, и в выдаче дублируют её заголовок.
        if is_redirect(source):
            continue
        parser = Extract()
        parser.feed(source)
        fallback_title = re.sub(r'\s*·\s*itsliventsev\s*$', '', ' '.join(parser.title.split()))
        title = ' '.join((parser.h1 or fallback_title).split())
        if not title:
            continue
        text = parser.main_text if parser.main_text else parser.body_text
        content = re.sub(r'\s+', ' ', ' '.join(text)).strip()[:900]
        records.append({
            'title': title,
            'url': '/' + ('' if rel.as_posix() == 'index.html' else rel.as_posix()),
            'category': category_for(rel),
            'description': ' '.join(parser.description.split())[:240],
            'content': content,
        })
    return records


def main():
    records = build()
    payload = json.dumps(records, ensure_ascii=False, separators=(',', ':')) + '\n'

    if '--check' in sys.argv:
        current = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
        if current == payload:
            print(f'search index OK: {len(records)} records match the markup')
            return 0
        print('search index устарел: разметка и assets/search-index.json разошлись.')
        try:
            old = {item['url']: item for item in json.loads(current)}
        except json.JSONDecodeError:
            old = {}
        new = {item['url']: item for item in records}
        for url in sorted(set(old) - set(new)):
            print('  − страницы больше нет в индексе: ' + url)
        for url in sorted(set(new) - set(old)):
            print('  + новая страница: ' + url)
        for url in sorted(set(old) & set(new)):
            for field in ('title', 'category', 'description', 'content'):
                if old[url].get(field) != new[url].get(field):
                    print(f'  ~ {url}: изменилось поле {field}')
                    break
        print('Пересоберите: python3 scripts/build-search-index.py')
        return 1

    OUT.write_text(payload, encoding='utf-8')
    print(f'wrote {len(records)} records to {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
