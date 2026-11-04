'use strict';
/* Сборка в правильном порядке: node scripts/build-all.js

   Порядок — не формальность. `build-related` вписывает блоки «теория ↔ практика»
   в уже готовые страницы, а `build-office` их перезаписывает: запусти генератор
   после моста — и мост исчезнет (именно так однажды осталось 61 из 62 страниц).
   Штамп версий идёт последним, потому что меняет адреса в только что записанных
   файлах. */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const steps = [
  ['стили моста', ['scripts/build-related-css.js']],
  ['заметки базы знаний', ['scripts/build-knowledge.js']],
  ['стенды ОфисПолис', ['scripts/build-office.js']],
  /* Статический текст работ идёт ДО моста «теория ↔ практика»: мост ищет
     якорь `#lab-root` и вставляет блок перед ним. Если статику добавить после,
     она окажется выше блока «Теория по теме», и `--check` обоих шагов начнёт
     расходиться при каждой сборке — разметка та же, порядок разный. */
  ['статический текст работ', ['scripts/build-lab-static.js']],
  ['мост «теория ↔ практика»', ['scripts/build-related.js']],
  ['списки работ в каталогах', ['scripts/build-stand-catalog.js']],
  /* SEO-блок между маркерами SEO:AUTO генерируется из разметки: без этого шага
     свежесгенерированные страницы остаются с пустыми canonical/og/JSON-LD. */
  ['SEO-блоки, sitemap и лента', ['scripts/build-seo.js']],
  ['критические стили главной', ['scripts/build-critical-css.js']],
  ['версии статики в разметке', ['scripts/build-asset-tokens.js', '--write']],
  ['поисковый индекс', ['scripts/build-search-index.py']]
];

for (const [label, args] of steps) {
  const interpreter = args[0].endsWith('.py') ? 'python3' : process.execPath;
  execFileSync(interpreter, args, { cwd: ROOT, stdio: 'inherit' });
  console.log('✓ ' + label);
}
console.log('\nСборка готова. Проверка: node scripts/regression-static.js и node scripts/build-asset-tokens.js --check');
