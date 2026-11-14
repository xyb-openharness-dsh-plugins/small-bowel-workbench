/**
 * 面板参数唯一来源（家族统一）。
 *
 * customFrame 下业务区与原生会话宽度互补；宿主 register() 会校验：
 * businessSide ∈ left|right，businessWidth ∈ 0.25–0.7。
 * 客户端与构建脚本都从这里取值，不许另写一份 0.65 / 0.35。
 */
export const PANEL = Object.freeze({
  customFrame: true,
  businessSide: 'left',
  businessWidth: 0.65,
  businessWidthMin: 0.55,
  businessWidthMax: 0.7,
});

export const AGENT_PANE = Object.freeze({
  default: 0.35,
  min: 0.25,
  max: 0.45,
  hideable: true,
  resizable: true,
});

export function assertPanelConfig(panel = PANEL) {
  const problems = [];
  if (!['left', 'right'].includes(panel.businessSide)) problems.push('businessSide 必须是 left|right');
  if (!(panel.businessWidth >= 0.25 && panel.businessWidth <= 0.7)) problems.push('businessWidth 必须在 0.25–0.7');
  if (Math.abs(panel.businessWidth + AGENT_PANE.default - 1) > 1e-9) {
    problems.push('businessWidth 与 AGENT_PANE.default 必须互补为 1');
  }
  if (problems.length) throw new Error('面板配置不合法：' + problems.join('；'));
  return true;
}
