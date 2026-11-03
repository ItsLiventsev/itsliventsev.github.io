#!/usr/bin/env python3
"""Собирает FAQPage-разметку из самой страницы справки.

Единственный источник правды — видимые <details> на faq.html: скрипт читает
вопросы и ответы, чистит теги и перезаписывает блок JSON-LD между метками
FAQ:LD:START / FAQ:LD:END. Так разметка не расходится с текстом после правок.
"""
import json
import re
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'faq.html'
START, END = '  <!-- FAQ:LD:START -->\n', '  <!-- FAQ:LD:END -->\n'


def text(fragment: str) -> str:
    fragment = re.sub(r'<br\s*/?>', ' ', fragment)
    fragment = re.sub(r'<[^>]+>', '', fragment)
    fragment = unescape(fragment)
    return ' '.join(fragment.split())


def collect(html: str) -> list:
    items = []
    for chunk in re.findall(r'<details\b.*?</details>', html, re.S):
        question = re.search(r'<summary>(.*?)</summary>', chunk, re.S)
        answer = re.search(r'<div class="faq-answer">(.*?)</div>', chunk, re.S)
        if not question or not answer:
            continue
        body = re.sub(r'<p class="faq-anchor">.*?</p>', '', answer.group(1), flags=re.S)
        items.append({
            '@type': 'Question',
            'name': text(question.group(1)),
            'acceptedAnswer': {'@type': 'Answer', 'text': text(body)},
        })
    return items


def main() -> None:
    html = PAGE.read_text(encoding='utf-8')
    items = collect(html)
    if not items:
        raise SystemExit('faq.html: не найдено ни одного вопроса с ответом')
    ld = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'inLanguage': 'ru-RU',
        'mainEntity': items,
    }
    block = START + '  <script type="application/ld+json">' + \
        json.dumps(ld, ensure_ascii=False, separators=(',', ':')) + '</script>\n' + END

    existing = re.search(re.escape(START) + r'.*?' + re.escape(END), html, re.S)
    if existing:
        html = html.replace(existing.group(0), block)
    else:
        marker = '  <!-- SEO:AUTO:END -->\n'
        if marker not in html:
            raise SystemExit('faq.html: не найден маркер SEO:AUTO:END')
        html = html.replace(marker, marker + block, 1)
    PAGE.write_text(html, encoding='utf-8')
    print(f'faq.json-ld: {len(items)} вопросов')


if __name__ == '__main__':
    main()
