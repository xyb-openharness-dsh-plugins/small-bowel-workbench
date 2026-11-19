/**
 * HTTP 层：API + 静态资源 + 路径穿越拦截。
 *
 * 边界：
 *   - API 前缀固定 `/api/small-bowel`；认证由宿主 connection 能力在 index.js 完成；
 *   - 静态只从 public/ 出，任何路径穿越都拒绝；
 *   - 错误一律 JSON（API）或纯文本（静态），不留白屏；
 *   - 不碰 AI、不存会话：会话由宿主管理。
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { checkDataDir } from './data-dir.js';

export { checkDataDir };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export function resolveStatic(root, urlPath) {
  let clean;
  try { clean = decodeURIComponent(String(urlPath).split('?')[0].split('#')[0]); } catch { return null; }
  if (clean.includes('\0')) return null;
  const rel = clean.replace(/^([/\\])+/, '');
  if (rel.split(/[/\\]/).includes('..')) return null;
  const abs = resolve(root, rel === '' ? 'index.html' : rel);
  const rootReal = realpathSync(root);
  let absReal;
  try { absReal = realpathSync(abs); } catch { return null; }
  const r = relative(rootReal, absReal);
  if (r === '' || r.startsWith('..' + sep) || r === '..' || r.startsWith(sep)) return null;
  try { if (!statSync(absReal).isFile()) return null; } catch { return null; }
  return absReal;
}

export function contentType(file) {
  return MIME[extname(file).toLowerCase()] || 'application/octet-stream';
}

export function injectTokens(text, { apiBase = '', version = '', displayVersion = '', buildDate = '' } = {}) {
  return text
    .replace(/__API_BASE__/g, apiBase)
    .replace(/__VERSION_DISPLAY__/g, displayVersion)
    .replace(/__VERSION__/g, version)
    .replace(/__BUILD_DATE__/g, buildDate);
}

const UI_MOUNTS = ['/small-bowel', '/api/small-bowel'];

function stripMount(pathname) {
  for (const mount of UI_MOUNTS) {
    if (pathname === mount) return '/';
    if (pathname.startsWith(mount + '/')) return pathname.slice(mount.length);
  }
  return pathname;
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      if (raw.length < 64 * 1024) raw += chunk;
    });
    req.on('end', () => {
      try { resolvePromise(JSON.parse(raw || '{}')); } catch (error) {
        reject(new Error('请求体不是合法 JSON：' + String(error.message || error)));
      }
    });
    req.on('error', () => reject(new Error('请求体读取失败')));
  });
}

export function createHandler({ apiBase = '/api/small-bowel', publicDir, services }) {
  const sendJson = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const sendText = (res, status, text) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(text);
  };

  return async function handle(req, res) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return sendJson(res, 400, { error: 'Bad request' }); }
    const pathname = url.pathname;
    const api = apiBase;

    if (pathname === api + '/health') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      return sendJson(res, 200, {
        ok: true,
        version: services.version,
        apiVersion: 'v1',
        capabilities: services.capabilities,
      });
    }

    if (pathname === api + '/bootstrap') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      try { return sendJson(res, 200, services.bootstrap(url.searchParams.get('profileKey') || undefined)); } catch (error) {
        return sendJson(res, 500, { error: 'bootstrap failed', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/subjects') {
      try {
        if (req.method === 'GET') return sendJson(res, 200, { subjects: services.listSubjects() });
        if (req.method === 'POST') return sendJson(res, 200, services.createSubject(await readJson(req)));
        if (req.method === 'DELETE') {
          return sendJson(res, 200, services.deleteSubject(url.searchParams.get('profileKey') || ''));
        }
        return sendJson(res, 405, { error: 'Method not allowed' });
      } catch (error) {
        return sendJson(res, 400, { error: 'subject operation failed', detail: String(error.message || error) });
      }
    }

    if (pathname.startsWith(api + '/read/')) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      const entity = pathname.slice((api + '/read/').length);
      const key = url.searchParams.get('profileKey') || services.currentProfileKey();
      try {
        const data = services.readEntity(entity, key);
        return sendJson(res, 200, { entity, profileKey: key, generatedAt: new Date().toISOString(), data });
      } catch (error) {
        return sendJson(res, 400, { error: 'read failed', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/entries') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
      try {
        const body = await readJson(req);
        return sendJson(res, 200, services.addEntry(body.profileKey, body.kind, body.data || {}));
      } catch (error) {
        return sendJson(res, 400, { error: 'write failed', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/privacy') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
      try {
        const body = await readJson(req);
        return sendJson(res, 200, services.setPrivacy(body.profileKey, body.kind, body.id, body.isPrivate));
      } catch (error) {
        return sendJson(res, 400, { error: 'privacy update failed', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/export') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      try {
        const key = url.searchParams.get('profileKey') || services.currentProfileKey();
        return sendJson(res, 200, services.exportProfile(key));
      } catch (error) {
        return sendJson(res, 400, { error: 'export failed', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/root') {
      try {
        if (req.method === 'GET') return sendJson(res, 200, services.dataRoot());
        if (req.method === 'POST') {
          const body = await readJson(req);
          const check = checkDataDir(body.dir);
          if (!check.ok) return sendJson(res, 400, { error: check.reason });
          return sendJson(res, 200, services.setDataRoot(check.dir));
        }
        return sendJson(res, 405, { error: 'Method not allowed' });
      } catch (error) {
        return sendJson(res, 400, { error: 'data root failed', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/trials/state') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
      try {
        const body = await readJson(req);
        return sendJson(res, 200, services.setTrialState(body.profileKey, body.id, body.state));
      } catch (error) {
        return sendJson(res, error.status || 400, { error: '收藏状态更新失败', detail: String(error.message || error) });
      }
    }

    if (pathname === api + '/trials/match') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      return sendJson(res, 200, services.trialMatch());
    }

    if (pathname === api + '/library') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      return sendJson(res, 200, services.clinicalLibrary());
    }

    /* ---------- 静态 ---------- */
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
    const staticPath = stripMount(pathname);
    let file = resolveStatic(publicDir, staticPath);
    if (!file) file = resolveStatic(publicDir, '/index.html');
    if (!file) return sendText(res, 500, 'public/index.html missing');
    try {
      let body = readFileSync(file);
      // app.js 以外链形式被 index.html 引用，占位符（__API_BASE__ 等）只在 .html 注入时
      // 会被替换，app.js 永远不会被替换 → fetch('__API_BASE__/bootstrap') 打到宿主 SPA
      // fallback 返回 200 HTML，前端 boot=null 报「Cannot read properties of null
      // (reading 'currentProfileKey')」（2026-11-19 Desktop 装机实测）。这里对 app.js
      // 同样做注入。
      if (file.endsWith('.html') || file.endsWith('app.js')) {
        body = Buffer.from(injectTokens(body.toString('utf8'), {
          apiBase: apiBase,
          version: services.version,
          displayVersion: services.displayVersion,
          buildDate: services.buildDate,
        }), 'utf8');
      }
      res.writeHead(200, {
        'content-type': contentType(file),
        'cache-control': file.endsWith('.html') ? 'no-store' : 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      return res.end(body);
    } catch {
      return sendText(res, 500, 'static read failed');
    }
  };
}
