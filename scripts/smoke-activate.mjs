#!/usr/bin/env node
/**
 * 激活烟测：在 Node 里把客户端真的装一遍。
 * 1) lib/client.js 能在桩环境求值；2) inject 含 desktopWorkbenches；
 * 3) apply 不抛错；4) register 恰好一次且描述符合法；5) Panel 是函数。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] || join(HERE, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const problems = [];
const registered = [];

const react = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  Fragment: 'Fragment',
};

const storage = new Map();
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  fetch: () => Promise.reject(new Error('smoke: no network')),
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
  },
  document: { querySelector: () => null },
  window: {
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
  },
  __ModuleLoader__: {
    load({ id, factory }) {
      if (id !== pkg.name) problems.push(`module id ${id} ≠ 包名 ${pkg.name}`);
      const mod = factory((name) => {
        if (name === 'react') return react;
        throw new Error('unknown module: ' + name);
      });
      sandbox.__mod = mod;
    },
  },
};
sandbox.window.__ModuleLoader__ = sandbox.__ModuleLoader__;
sandbox.globalThis = sandbox;

createContext(sandbox);
try {
  runInContext(readFileSync(join(root, 'lib/client.js'), 'utf8'), sandbox);
} catch (error) {
  console.error('✗ lib/client.js 求值失败：' + error.message);
  process.exit(1);
}

const mod = sandbox.__mod;
if (!mod) { console.error('✗ 没有拿到 { apply, inject }'); process.exit(1); }
if (!Array.isArray(mod.inject) || !mod.inject.includes('desktopWorkbenches')) {
  problems.push('inject 缺 desktopWorkbenches');
}

const ctx = {
  effect(fn) { try { fn(); } catch (error) { problems.push('ctx.effect 抛错：' + error.message); } },
  desktopWorkbenches: {
    register(descriptor, Panel) { registered.push({ descriptor, Panel }); },
  },
  connection: { requestRejection: () => undefined },
  webServer: { register() {} },
};

try { mod.apply(ctx); } catch (error) { problems.push('apply 抛错：' + error.message); }
if (registered.length !== 1) problems.push(`register 调用 ${registered.length} 次，期望 1 次`);
if (registered[0]) {
  const { descriptor, Panel } = registered[0];
  const repoRe = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/i;
  if (!descriptor.title) problems.push('缺 title');
  if (!repoRe.test(descriptor.repository)) problems.push('repository 不是合法 GitHub 地址');
  if (typeof Panel !== 'function') problems.push('Panel 不是函数');
  if (descriptor.customFrame !== true) problems.push('customFrame 必须为 true');
  if (!['left', 'right'].includes(descriptor.layout?.businessSide)) problems.push('businessSide 非法');
  if (!(descriptor.layout?.businessWidth >= 0.25 && descriptor.layout?.businessWidth <= 0.7)) {
    problems.push('businessWidth 越界');
  }
  if (!descriptor.description || !descriptor.audience) problems.push('缺 description/audience');
}

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 激活烟测：register 1 次，描述符合法，Panel 是函数');
