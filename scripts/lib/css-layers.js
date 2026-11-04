'use strict';
/*
 * Единственный список CSS-слоёв в порядке подключения.
 *
 * Слоёв стало больше одного файла: общий pages.css, семейства (home.css,
 * cases.css), база знаний и стенды. Каждый скрипт, которому нужен «весь CSS
 * сайта» или порядок каскада, берёт список отсюда — иначе новый слой
 * появляется в разметке и исчезает из проверок.
 */
const LAYERS = [
  'assets/tokens.css',
  'assets/base.css',
  'assets/pages.css',
  'assets/home.css',
  'assets/cases.css',
  'assets/knowledge.css',
  'assets/course.css'
];

module.exports = { LAYERS };
