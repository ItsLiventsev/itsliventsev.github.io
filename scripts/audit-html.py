#!/usr/bin/env python3
"""Аудит структуры всех HTML: баланс тегов, h1, дубли id, битые ссылки."""
import os
from html.parser import HTMLParser
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'}
errors, id_pages, h1_count, links_bad = [], defaultdict(list), Counter(), []


class P(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.stack, self.in_h1 = path, [], 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'h1':
            self.in_h1 += 1
            h1_count[self.path] += 1
        if 'id' in d:
            id_pages[d['id']].append(self.path)
        if tag not in VOID:
            self.stack.append(tag)
        # Проверку ссылок делаем после пуша в стек: ранний return до push
        # заставлял бы закрывающий </a> внешней ссылки выглядеть «лишним».
        if tag == 'a' and 'href' in d:
            h = d['href']
            if h.startswith(('mailto:', 'javascript:', 'http')):
                return
            base = h.split('#')[0]
            if base:
                p = (base.lstrip('/') if base.startswith('/')
                     else os.path.normpath(os.path.join(os.path.dirname(self.path), base)))
                if p and not os.path.exists(os.path.join(ROOT, p)):
                    links_bad.append((self.path, h))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == 'h1':
            self.in_h1 = max(0, self.in_h1 - 1)
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            while self.stack and self.stack[-1] != tag:
                errors.append((self.path, 'незакрыт ' + self.stack.pop() + ' @' + str(self.getpos()[0])))
            if self.stack:
                self.stack.pop()
        else:
            errors.append((self.path, 'лишний закрывающий ' + tag + ' @строка ' + str(self.getpos()[0])))

    def handle_data(self, data):
        pass  # h1 считаем по открывающим тегам: данные дробятся вложенными span

    def handle_startendtag(self, tag, attrs):
        pass


pages = []
for root, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules',)]
    for fn in files:
        if fn.endswith('.html'):
            pages.append(os.path.relpath(os.path.join(root, fn), ROOT))

for p in sorted(pages):
    parser = P(p)
    parser.feed(open(os.path.join(ROOT, p), encoding='utf-8').read())
    if parser.stack:
        errors.append((p, 'незакрыты: ' + ','.join(parser.stack)))

dups = {i: ps for i, ps in id_pages.items() if len(ps) > 1}
print('страниц:', len(pages))
print('ошибок структуры:', len(errors)); [print('  ERR', e) for e in errors]
print('дублей id между страницами (норма для шаблонов):', len(dups))
same_page_dups = {i: ps for i, ps in id_pages.items()
                  if len(ps) > len(set(ps))}
print('дублей id внутри одной страницы:', len(same_page_dups), dict(list(same_page_dups.items())[:5]))
print('страниц без ровно одного h1:', [p for p in pages if h1_count.get(p, 0) != 1][:8])
print('битых ссылок:', len(links_bad), links_bad[:6])
