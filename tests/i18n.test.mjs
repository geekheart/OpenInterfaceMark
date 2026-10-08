import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {english, localeFromURL, setLocale, t} from '../src/i18n.js';

test('language URLs default to Chinese and accept only the supported English locale', () => {
  for (const url of ['https://example.com/OpenInterfaceMark/', 'https://example.com/?lang=fr', 'invalid']) assert.equal(localeFromURL(url), 'zh-CN');
  assert.equal(localeFromURL('https://example.com/OpenInterfaceMark/?lang=en#editor'), 'en');
});

test('declared interface messages and validation errors have English translations with matching parameters', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../src/core.js', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(m => m[1]);
  keys.push(...[...core.matchAll(/throw new Error\('([^']+)'\)/g)].map(m => m[1]));
  for (const key of keys) assert.ok(english[key], `Missing English UI message: ${key}`);
  const parameters = message => [...message.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [key, value] of Object.entries(english)) assert.deepEqual(parameters(value), parameters(key), key);
});

test('translated parameterized messages preserve user text including markup and Chinese names', () => {
  setLocale('en');
  assert.equal(t('已加载字体：{name}', {name:'默认黑体 <A&B>.ttf'}), 'Font loaded: 默认黑体 <A&B>.ttf');
  assert.equal(t('已载入 · {count} 个标注区域', {count:6}), 'Loaded · 6 regions');
  assert.equal(t('不是受支持的 OpenInterfaceMark 项目（需要版本 1）。'), 'Unsupported OpenInterfaceMark project. Version 1 is required.');
  setLocale('zh-CN');
  assert.equal(t('已载入 · {count} 个标注区域', {count:6}), '已载入 · 6 个标注区域');
});
