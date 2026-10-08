import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import * as core from '../src/core.js';

const appURL = new URL('../src/app.js', import.meta.url);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// Execute the application, including its real event registrations. Only adapt ESM
// loading for vm.Script; no interaction implementation is copied into this test.
const appSource = readFileSync(appURL, 'utf8')
  .replace(/^import\s*\{([^}]+)\}\s*from '\.\/core\.js';/, (_, bindings) => `const {${bindings.replace(/\s+as\s+/g, ': ')}} = __core;`)
  .replaceAll('import.meta.url', JSON.stringify(appURL.href));

class Matrix {
  constructor([a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = []) { Object.assign(this, { a, b, c, d, e, f }); }
  inverse() {
    const { a, b, c, d, e, f } = this, determinant = a * d - b * c;
    return new Matrix([d / determinant, -b / determinant, -c / determinant, a / determinant,
      (c * f - d * e) / determinant, (b * e - a * f) / determinant]);
  }
}
class Point {
  constructor(x, y) { Object.assign(this, { x, y }); }
  matrixTransform(m) { return new Point(m.a * this.x + m.c * this.y + m.e, m.b * this.x + m.d * this.y + m.f); }
}

function createHarness() {
  const nodes = new Map(), tools = [], doc = { fonts: new Set() };
  class Element {
    constructor(tagName = 'div', id = '') {
      this.tagName = tagName.toLowerCase(); this.id = id; this.dataset = {}; this.style = {};
      this.attributes = new Map(); this.listeners = new Map(); this.captured = new Set();
      this.clientWidth = 1000; this.clientHeight = 600; this.parentElement = null;
      this.open = false; this.innerHTML = ''; this.value = ''; this.textContent = '';
      const classes = new Set();
      this.classList = {
        contains: name => classes.has(name), remove: name => classes.delete(name), add: name => classes.add(name),
        toggle(name, force = !classes.has(name)) { force ? classes.add(name) : classes.delete(name); return force; },
      };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name); }
    matches(selector) {
      if (selector === '[contenteditable]:not([contenteditable="false"])') return this.attributes.has('contenteditable') && this.getAttribute('contenteditable') !== 'false';
      if (selector.startsWith('[data-')) {
        const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return key in this.dataset;
      }
      return selector.startsWith('#') ? this.id === selector.slice(1) : this.tagName === selector;
    }
    closest(selectors) {
      for (let node = this; node; node = node.parentElement) if (selectors.split(',').some(selector => node.matches(selector.trim()))) return node;
      return null;
    }
    addEventListener(type, callback, options = {}) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ callback, once: options.once });
    }
    fire(type, init = {}) {
      const event = { type, target: this, button: 0, buttons: 1, pointerId: 1, isPrimary: true,
        clientX: 0, clientY: 0, key: '', code: '', defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...init };
      for (const listener of [...(this.listeners.get(type) || [])]) {
        listener.callback(event);
        if (listener.once) this.listeners.get(type).splice(this.listeners.get(type).indexOf(listener), 1);
      }
      this['on' + type]?.(event);
      return event;
    }
    insertAdjacentHTML(_, content) { this.innerHTML += content; }
    append(child) { child.parentElement = this; }
    focus() { doc.activeElement = this; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); this.fire('lostpointercapture', { pointerId: id }); }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getScreenCTM() {
      const [x, y, width, height] = (this.getAttribute('viewBox') || '0 0 1000 600').split(' ').map(Number);
      const scale = Math.min(this.clientWidth / width, this.clientHeight / height);
      return new Matrix([scale, 0, 0, scale, (this.clientWidth - width * scale) / 2 - x * scale,
        (this.clientHeight - height * scale) / 2 - y * scale]);
    }
    getContext() { return { measureText: text => ({ width: text.length * 8 }) }; }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) nodes.set(match[2], new Element(match[1], match[2]));
  for (const tool of ['select', 'rect', 'ellipse', 'pan']) {
    const button = new Element('button'); button.dataset.tool = tool; button.title = tool; tools.push(button);
  }
  doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  doc.querySelector = selector => selector.startsWith('#') ? nodes.get(selector.slice(1))
    : selector === 'dialog[open]' ? [...nodes.values()].find(node => node.tagName === 'dialog' && node.open) || null : null;
  doc.querySelectorAll = selector => selector.includes('[data-tool]') ? tools : [];
  const window = new Element('window');
  class TestURL extends URL { static createObjectURL() { return 'blob:test-image'; } static revokeObjectURL() {} }
  const context = vm.createContext({
    __core: core, document: doc, window, DOMMatrix: Matrix, DOMPoint: Point, URL: TestURL,
    Blob, atob, structuredClone, crypto: { randomUUID },
    ResizeObserver: class { observe() {} },
    // Initial demo loading is irrelevant to these interactions; the fixture is
    // applied through the same applyDocument path without network or image I/O.
    fetch: () => new Promise(() => {}), setTimeout: () => 0, clearTimeout() {},
  });
  vm.runInContext(appSource, context, { filename: appURL.pathname });
  const region = (id, x) => ({ id, kind: 'rect', x, y: 60, w: 80, h: 70, labelX: x + 130, labelY: 90,
    code: id.toUpperCase(), title: '接口', color: '#ef4444', dashed: true, stroke: 2, fontSize: 14, radius: 4 });
  context.__fixture = { name: '交互测试', image: { name: 'test.png', src: 'data:image/png;base64,AAAA', width: 500, height: 400, scale: 1, rotation: 0 },
    regions: [region('a', 50), region('b', 250)] };
  vm.runInContext('applyDocument(structuredClone(__fixture)); setLoading(false);', context);
  const canvas = nodes.get('canvas');
  const state = () => JSON.parse(vm.runInContext('JSON.stringify({doc,selected,tool,dirty,view,historyLength:history.length,futureLength:future.length,gesture:gesture?{type:gesture.type,pointerId:gesture.pointerId}:null,space,guides})', context));
  const key = (key, options = {}) => window.fire('keydown', { target: canvas, key, ...options });
  function hit(id, kind = 'region') {
    const group = new Element('g'); group.dataset.region = id;
    const target = new Element('rect'); target.dataset.hit = kind; target.parentElement = group;
    return target;
  }
  function pointer(type, x, y, options = {}) {
    const screen = new Point(x, y).matrixTransform(canvas.getScreenCTM());
    return canvas.fire(type, { clientX: screen.x, clientY: screen.y, ...options });
  }
  return { nodes, tools, doc, window, canvas, state, key, hit, pointer, element: tag => new Element(tag) };
}

test('矩形工具中右键只平移画布，不改变标注、选择或历史', () => {
  const h = createHarness(); h.key('r'); const before = h.state();
  h.canvas.fire('pointerdown', { button: 2, buttons: 2, clientX: 100, clientY: 100, target: h.hit('b') });
  h.canvas.fire('pointermove', { buttons: 2, clientX: 150, clientY: 125 });
  assert.notDeepEqual(h.state().view, before.view);
  h.canvas.fire('pointerup', { button: 2, buttons: 0 });
  const after = h.state();
  assert.deepEqual(after.doc, before.doc); assert.equal(after.selected, 'a'); assert.equal(after.tool, 'rect');
  assert.equal(after.historyLength, 0); assert.equal(after.dirty, false); assert.equal(after.gesture, null);
  assert.equal(h.canvas.captured.size, 0); assert.equal(h.canvas.fire('contextmenu').defaultPrevented, true);
  assert.equal(h.window.fire('contextmenu').defaultPrevented, false);
});

test('其他pointer的移动、抬起、取消和丢失捕获不能干扰当前拖动', () => {
  const h = createHarness(); h.pointer('pointerdown', 70, 80, { pointerId: 11, target: h.hit('a') });
  const before = h.state();
  for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) h.pointer(type, 180, 180, { pointerId: 22, buttons: 1, isPrimary: false });
  assert.deepEqual(h.state().doc, before.doc); assert.deepEqual(h.state().gesture, before.gesture);
  h.pointer('pointermove', 90, 95, { pointerId: 11 }); h.pointer('pointerup', 90, 95, { pointerId: 11, buttons: 0 });
  assert.ok(Math.abs(h.state().doc.regions[0].x - 70) < 1e-9); assert.equal(h.state().historyLength, 1);
  h.pointer('pointerdown', 70, 80, { pointerId: 22, isPrimary: false, target: h.hit('a') });
  assert.equal(h.state().gesture, null);
});

test('右键先释放而左键仍按住时结束平移，后续移动不再改变视图', () => {
  const h = createHarness(); h.canvas.fire('pointerdown', { button: 2, buttons: 2, clientX: 100, clientY: 100 });
  h.canvas.fire('pointermove', { buttons: 3, clientX: 140, clientY: 130 });
  const panned = h.state().view;
  h.canvas.fire('mouseup', { button: 2, buttons: 1 });
  h.canvas.fire('pointermove', { buttons: 1, clientX: 300, clientY: 300 });
  assert.equal(h.state().gesture, null); assert.deepEqual(h.state().view, panned); assert.equal(h.canvas.captured.size, 0);
  assert.equal(h.nodes.get('canvas-wrap').classList.contains('is-panning'), false);
  // Pointer button state also ends the drag if no compatibility mouseup arrives.
  h.canvas.fire('pointerdown', { button: 2, buttons: 2, clientX: 100, clientY: 100 });
  h.canvas.fire('pointermove', { buttons: 1, clientX: 200, clientY: 200 });
  assert.equal(h.state().gesture, null); assert.deepEqual(h.state().view, panned);
});

test('拖动期间Ctrl+Z只取消当前拖动，不撤销此前已完成修改', () => {
  const h = createHarness(); h.key('ArrowRight'); const committed = h.state();
  h.pointer('pointerdown', 70, 80, { target: h.hit('a') }); h.pointer('pointermove', 110, 120);
  assert.notDeepEqual(h.state().doc, committed.doc);
  assert.equal(h.key('z', { ctrlKey: true }).defaultPrevented, true);
  assert.deepEqual(h.state().doc, committed.doc); assert.equal(h.state().historyLength, 1); assert.equal(h.state().futureLength, 0);
  assert.equal(h.state().gesture, null); assert.equal(h.canvas.captured.size, 0);
  h.pointer('pointerup', 110, 120, { buttons: 0 }); assert.deepEqual(h.state().doc, committed.doc);
  h.key('z', { ctrlKey: true }); assert.equal(h.state().doc.regions[0].x, 50);
});

test('没有历史时Ctrl+Z仍可取消首个绘制，重做快捷键也先取消手势', () => {
  const h = createHarness(); const before = h.state().doc; h.key('r');
  h.pointer('pointerdown', 20, 20); h.pointer('pointermove', 130, 100); h.key('z', { ctrlKey: true });
  assert.equal(h.state().gesture, null); assert.deepEqual(h.state().doc, before); assert.equal(h.state().historyLength, 0);
  h.pointer('pointerdown', 20, 20); h.pointer('pointermove', 130, 100); h.key('Z', { ctrlKey: true, shiftKey: true });
  assert.equal(h.state().gesture, null); assert.deepEqual(h.state().doc, before);
});

test('拖动中Delete和方向键不会误删或改写下一块区域，切换工具取消旧拖动', () => {
  const h = createHarness(); const before = h.state().doc;
  h.pointer('pointerdown', 70, 80, { target: h.hit('a') }); h.pointer('pointermove', 90, 100);
  assert.equal(h.key('Delete').defaultPrevented, true); assert.equal(h.key('ArrowRight').defaultPrevented, true);
  h.pointer('pointermove', 110, 120); assert.equal(h.state().doc.regions.length, 2);
  assert.deepEqual(h.state().doc.regions[1], before.regions[1]);
  h.key('e'); assert.equal(h.state().tool, 'ellipse'); assert.equal(h.state().gesture, null);
  assert.deepEqual(h.state().doc, before); assert.equal(h.state().historyLength, 0);
});

test('普通Ctrl+Z/Ctrl+Shift+Z及Cmd组合恢复标注但保持用户平移缩放视图', () => {
  const h = createHarness(); h.key('ArrowRight'); h.key('+');
  h.canvas.fire('pointerdown', { button: 2, buttons: 2, clientX: 100, clientY: 100 });
  h.canvas.fire('pointermove', { buttons: 2, clientX: 170, clientY: 140 }); h.canvas.fire('pointerup', { button: 2, buttons: 0 });
  const view = h.state().view;
  h.key('z', { ctrlKey: true }); assert.equal(h.state().doc.regions[0].x, 50); assert.deepEqual(h.state().view, view);
  h.key('Z', { ctrlKey: true, shiftKey: true }); assert.equal(h.state().doc.regions[0].x, 51); assert.deepEqual(h.state().view, view);
  h.key('z', { metaKey: true }); h.key('Z', { metaKey: true, shiftKey: true }); assert.equal(h.state().doc.regions[0].x, 51);
  h.key('z', { ctrlKey: true, repeat: true }); assert.equal(h.state().doc.regions[0].x, 51);
});

test('输入框、可编辑文本、弹窗、IME和已处理事件保留原生快捷键', () => {
  const h = createHarness(); h.key('ArrowRight'); const before = h.state();
  const targets = ['input', 'textarea', 'select', 'dialog'].map(tag => h.element(tag));
  const editable = h.element('span'); editable.setAttribute('contenteditable', 'true'); targets.push(editable);
  for (const target of targets) {
    for (const key of ['z', 'Z', 'Delete', 'r']) assert.equal(h.key(key, { target, ctrlKey: key.toLowerCase() === 'z', shiftKey: key === 'Z' }).defaultPrevented, false);
  }
  assert.equal(h.key('z', { ctrlKey: true, isComposing: true }).defaultPrevented, false);
  h.key('z', { ctrlKey: true, defaultPrevented: true });
  h.nodes.get('shortcuts-dialog').showModal(); assert.equal(h.key('z', { ctrlKey: true }).defaultPrevented, false);
  assert.deepEqual(h.state().doc, before.doc); assert.equal(h.state().historyLength, before.historyLength);
});

test('取消、丢失捕获、失焦均释放指针并复原拖动，Space不吞按钮激活', () => {
  for (const cancellation of ['pointercancel', 'lostpointercapture', 'blur', 'Escape']) {
    const h = createHarness(); const before = h.state().doc;
    h.pointer('pointerdown', 70, 80, { target: h.hit('a') }); h.pointer('pointermove', 100, 110);
    if (cancellation === 'blur') h.window.fire('blur');
    else if (cancellation === 'Escape') h.key('Escape');
    else h.canvas.fire(cancellation);
    assert.deepEqual(h.state().doc, before, cancellation); assert.equal(h.state().gesture, null); assert.equal(h.canvas.captured.size, 0);
  }
  const h = createHarness(); const button = h.element('button');
  assert.equal(h.key(' ', { code: 'Space', target: button }).defaultPrevented, false); assert.equal(h.state().space, false);
  h.key(' ', { code: 'Space' }); assert.equal(h.state().space, true);
  h.window.fire('blur'); assert.equal(h.state().space, false); assert.equal(h.nodes.get('canvas-wrap').classList.contains('pan-ready'), false);
});

test('右键平移期间滚轮不会重置视图或缩放，结束后滚轮恢复工作', () => {
  const h = createHarness(); h.canvas.fire('pointerdown', { button: 2, buttons: 2, clientX: 100, clientY: 100 });
  h.canvas.fire('pointermove', { buttons: 2, clientX: 150, clientY: 125 }); const before = h.state().view;
  assert.equal(h.canvas.fire('wheel', { deltaY: -100, clientX: 150, clientY: 125 }).defaultPrevented, true);
  assert.deepEqual(h.state().view, before);
  h.canvas.fire('pointerup', { button: 2, buttons: 0 }); h.canvas.fire('wheel', { deltaY: -100, clientX: 150, clientY: 125 });
  assert.ok(h.state().view.width < before.width);
});
