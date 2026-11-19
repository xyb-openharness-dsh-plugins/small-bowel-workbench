/**
 * 包入口：DSH 插件服务端侧（小肠宝 SmallBowelPal · 小肠腺癌）。
 *
 * 宿主加载本文件，需要 name / inject / Config / apply 四样。
 * Config 必须是本文件里的 Schemastery schema；宿主提供该 peer 依赖，本仓不安装。
 * 业务逻辑在 workbench.js / server.js，零宿主依赖、可单测。
 *
 * 独立启动：npm start -- --root <资料目录>（同一份 handler，不经 connection 认证）。
 */
import Schema from '@deepseek-ai/schemastery';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbench } from './workbench.js';
import { createHandler, resolveStatic, checkDataDir } from './server.js';
import { PLUGIN_ID, API_PREFIX, UI_BASE } from '../lib/identity.js';
import { version, displayVersion, build as buildDate } from '../lib/version.js';

export { Workbench } from './workbench.js';
export { createHandler, resolveStatic, checkDataDir, injectTokens } from './server.js';
export {
  readDiagnoses, readPathology, readLabs, readImaging, readTreatments, readMedications,
  readSymptoms, readNutrition, readFollowups, readDocuments, readSavedTrials, readViewpoints,
  counts, recentActivity, upcomingFollowups,
} from './readmodels.js';
export { openStore, closeStore, migrate, tableNames } from './store.js';
export { seedDemoData, hasDemoData, DEMO_KEYS } from './demo.js';
export { PLUGIN_ID, API_PREFIX, UI_BASE } from '../lib/identity.js';
export { PANEL, AGENT_PANE, assertPanelConfig } from '../lib/layout.js';
export { LIBRARY_ENTRIES, LIBRARY_SOURCES, libraryPayload } from './library.js';

export const name = PLUGIN_ID;
export const inject = ['webServer', 'connection'];

const HERE = dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = join(HERE, '..', 'public');

export const API_BASE_HOSTED = API_PREFIX;

function authGate(ctx, handler) {
  return (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (typeof ctx.connection?.requestRejection !== 'function') {
      return send(503, { error: 'connection authentication capability unavailable' });
    }
    const rejection = ctx.connection.requestRejection(req);
    if (rejection !== undefined) return send(rejection, { error: 'Authentication required' });
    return handler(req, res);
  };
}

/**
 * config 是 apply 的第二个参数，不是 ctx.config。
 * 写成 ctx.config 会触发 Cordis 服务访问守卫（cannot get property "config" without inject）。
 */
export function apply(ctx, config = {}) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable');
  const root = typeof config?.root === 'string' ? config.root.trim() : '';
  if (!root) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: `${API_BASE_HOSTED}/health`,
      handler(req, res) {
        res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({
          error: 'root 未配置',
          detail: 'cordis.patch.yml 需要 config.root: !!js dshHomePath(...)',
        }));
      },
    }), 'small-bowel health (unconfigured)');
    return;
  }

  const workbench = new Workbench({ root });
  workbench.open();
  ctx.effect(() => workbench.close(), 'small-bowel store close');

  const services = {
    version,
    displayVersion,
    buildDate,
    capabilities: [
      'health', 'bootstrap', 'subjects', 'read', 'write', 'privacy', 'export', 'data-root', 'trials',
      'library',
    ],
    bootstrap: (key) => workbench.bootstrap(key),
    listSubjects: () => workbench.subjects(),
    createSubject: (input) => workbench.createSubject(input),
    deleteSubject: (key) => workbench.deleteSubject(key),
    readEntity: (entity, key) => workbench.readEntity(entity, key),
    addEntry: (key, kind, data) => workbench.addEntry(key, kind, data),
    setPrivacy: (key, kind, id, isPrivate) => workbench.setPrivacy(key, kind, id, isPrivate),
    exportProfile: (key) => workbench.exportProfile(key),
    dataRoot: () => workbench.dataRoot,
    setDataRoot: (dir) => workbench.setDataRoot(dir),
    trialMatch: () => workbench.trialMatch(),
    clinicalLibrary: () => workbench.clinicalLibrary(),
    currentProfileKey: () => workbench.getCurrentProfileKey(),
    setTrialState: (key, id, state) => workbench.setTrialState(key, id, state),
  };

  const handler = createHandler({ apiBase: API_BASE_HOSTED, publicDir: PUBLIC_DIR, services });
  const guarded = authGate(ctx, handler);
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_BASE_HOSTED, handler: guarded }), 'small-bowel api');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: UI_BASE, handler: guarded }), 'small-bowel ui');
}

export function uiReady() {
  return existsSync(join(PUBLIC_DIR, 'index.html'));
}

export const Config = Schema.object({
  root: Schema.string().required(),
});
