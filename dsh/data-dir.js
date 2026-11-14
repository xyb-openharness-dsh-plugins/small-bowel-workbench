/**
 * 资料目录口径（面板与服务端共用同一条规则）：
 * 主目录本身、桌面、下载根、tmp 一律拒绝；相对路径拒绝。
 * 拒绝必须给人话理由——静默接受会让用户以为数据在那儿。
 */
import { isAbsolute } from 'node:path';

export const FORBIDDEN_REASONS = Object.freeze({
  home: '主目录本身不作为资料目录，请在下面建一个专用文件夹',
  desktop: '桌面不作为资料目录',
  downloads: '下载根目录不作为资料目录',
  tmp: 'tmp 不作为资料目录（会被系统清理）',
});

export function checkDataDir(raw) {
  const input = String(raw || '').trim();
  const dir = input.length > 1 ? input.replace(/[\\/]+$/, '') : input;
  if (!dir) return { ok: false, reason: '目录为空' };
  if (!isAbsolute(dir)) return { ok: false, reason: '请选择绝对路径' };
  if (dir === '/' || /^[A-Za-z]:\\?$/.test(dir)) return { ok: false, reason: '系统根目录不作为资料目录' };
  const homeExact = /^(\/Users\/[^/]+|\/home\/[^/]+|\/root|[A-Za-z]:\\Users\\[^\\]+)$/i;
  if (homeExact.test(dir)) return { ok: false, reason: FORBIDDEN_REASONS.home };
  if (/(Desktop|桌面)[/\\]?$/i.test(dir)) return { ok: false, reason: FORBIDDEN_REASONS.desktop };
  if (/(Downloads?|下载(夹)?)[/\\]?$/i.test(dir)) return { ok: false, reason: FORBIDDEN_REASONS.downloads };
  if (/^(\/tmp|\/private\/tmp|\/var\/folders\/|\/private\/var\/folders\/)/i.test(dir)) {
    return { ok: false, reason: FORBIDDEN_REASONS.tmp };
  }
  return { ok: true, dir };
}
