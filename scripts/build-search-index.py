#!/usr/bin/env python3
"""Build the small client-side full-text index for the static site."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'admin.html', '404.html', 'projects/glossary.html'}

class Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.title_depth = self.h1_depth = 0
        self.title = self.h1 = ''
        self.description = ''
        self.text = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style', 'noscript', 'svg'):
            self.skip += 1
        if tag == 'title': self.title_depth += 1
        if tag == 'h1': self.h1_depth += 1
        if tag == 'meta' and attrs.get('name', '').lower() == 'description':
            self.description = attrs.get('content', '')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'svg') and self.skip: self.skip -= 1
        if tag == 'title' and self.title_depth: self.title_depth -= 1
        if tag == 'h1' and self.h1_depth: self.h1_depth -= 1
    def handle_data(self, data):
        if self.skip: return
        clean = ' '.join(data.split())
        if not clean: return
        self.text.append(clean)
        if self.title_depth: self.title += ' ' + clean
        if self.h1_depth: self.h1 += ' ' + clean


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

records = []
for path in sorted(ROOT.rglob('*.html')):
    rel = path.relative_to(ROOT)
    if rel.as_posix() in SKIP: continue
    parser = Extract()
    parser.feed(path.read_text(encoding='utf-8'))
    title = (parser.h1 or parser.title).strip()
    if not title: continue
    content = re.sub(r'\s+', ' ', ' '.join(parser.text))[:900]
    records.append({
        'title': title,
        'url': '/' + ('' if rel.as_posix() == 'index.html' else rel.as_posix()),
        'category': category_for(rel),
        'description': parser.description[:240],
        'content': content,
    })
out = ROOT / 'assets' / 'search-index.json'
out.write_text(json.dumps(records, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'wrote {len(records)} records to {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)')
