/* 由 scripts/build-client.mjs 从 src/client.js 生成，勿手改。 */
/* 面板参数来自 lib/layout.js，版本来自 lib/version.js（VERSION 派生）。 */
window.__ModuleLoader__.load({
  id: "@xyb-community/small-bowel-workbench",
  factory(require) {
    const React = require('react')
    const __PANEL_LAYOUT__ = {"customFrame":true,"businessSide":"left","businessWidth":0.65,"businessWidthMin":0.55,"businessWidthMax":0.7}
    const __AGENT_PANE__ = {"default":0.35,"min":0.25,"max":0.45,"hideable":true,"resizable":true}
    const __VERSION__ = "0.2.2"

    /* 宿主客户端外壳（源文件）：customFrame + 业务 iframe + 原生会话右栏。
       业务界面全部在 public/，这里只做入口、状态、分栏与草稿桥，不重画第二套业务 UI。 */

    const INJECT = ['desktopWorkbenches', 'sessions'];

    const META = {
      title: '小肠宝 SmallBowelPal · 小肠腺癌工作台',
      panelTitle: '小肠宝 SmallBowelPal',
      icon: '🫄',
      repository: 'https://github.com/xyb-openharness-dsh-plugins/small-bowel-workbench',
      description: '本机优先的小肠腺癌确诊档案、病理与分子检测、手术/系统治疗、化验影像、症状营养与复诊准备。',
      audience: '小肠腺癌患者本人与家属照护者',
      requirements: '资料目录需由用户指定；不连接医院账号，不上传云端。',
      author: '小 X 宝家族',
    };

    const UI_ENTRY = '/small-bowel/';
    const HEALTH_URL = '/api/small-bowel/health';
    const WIDTH_KEY = 'sba:agent-width';
    const PANE_KEY = 'sba:agent-open';

    /* 宿主上下文：apply(ctx) 时注入。会话归属只问宿主，不能靠 conversation 容器判断：
       customFrame 下没有会话时宿主也会传隐藏容器。 */
    let bridge = null;

    function currentSession() {
      const service = bridge && bridge.desktopWorkbenches;
      if (typeof service?.currentSession === 'function') return service.currentSession() || null;
      const snapshot = bridge?.sessions?.list?.getSnapshot?.();
      return snapshot?.current || Object.keys(snapshot?.byId || {}).find((id) =>
        (snapshot.byId[id]?.retainedBy?.mainView ?? 0) > 0) || null;
    }

    function ownsSession(sessionId) {
      if (!sessionId) return false;
      const service = bridge && bridge.desktopWorkbenches;
      return typeof service?.ownsSession === 'function' ? service.ownsSession(sessionId) : false;
    }

    function ownedSession() {
      const id = currentSession();
      return ownsSession(id) ? id : null;
    }

    async function createOwnedSession() {
      const service = bridge && bridge.desktopWorkbenches;
      let workspaceId;
      try { workspaceId = service?.defaultWorkspace?.()?.workspaceId; } catch { workspaceId = undefined; }
      return service.newSession(workspaceId);
    }

    function readStorage(key, fallback) {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch {
        return fallback;
      }
    }

    function writeStorage(key, value) {
      try { window.localStorage.setItem(key, String(value)); } catch { /* 隐私模式 */ }
    }

    function buildPanel(React) {
      const h = React.createElement;

      function Panel(props) {
        const conversation = props && props.conversation ? props.conversation : null;
        const [phase, setPhase] = React.useState('loading');
        const [phaseDetail, setPhaseDetail] = React.useState('');
        const [paneTick, setPaneTick] = React.useState(0);
        const [paneOpen, setPaneOpen] = React.useState(() => readStorage(PANE_KEY, '1') !== '0');
        const [creatingSession, setCreatingSession] = React.useState(false);
        const [sessionNote, setSessionNote] = React.useState('');
        const [width, setWidth] = React.useState(() => {
          const n = Number(readStorage(WIDTH_KEY, String(__AGENT_PANE__.default)));
          return Number.isFinite(n) ? Math.min(__AGENT_PANE__.max, Math.max(__AGENT_PANE__.min, n)) : __AGENT_PANE__.default;
        });
        const [narrow, setNarrow] = React.useState(false);
        const [dragging, setDragging] = React.useState(false);
        const [hovering, setHovering] = React.useState(false);
        const hostRef = React.useRef(null);
        const frameRef = React.useRef(null);
        const widthRef = React.useRef(width);
        widthRef.current = width;

        React.useEffect(() => {
          const off = bridge?.desktopWorkbenches?.subscribe?.(() => setPaneTick((n) => n + 1));
          return () => { try { off?.(); } catch { /* 宿主已卸载订阅表 */ } };
        }, []);

        const activeSession = ownedSession();
        void paneTick;
        const hasConversation = Boolean(activeSession);
        const canCreateSession = typeof (bridge && bridge.desktopWorkbenches &&
          bridge.desktopWorkbenches.newSession) === 'function';
        const canOpenAgent = hasConversation || canCreateSession;

        React.useEffect(() => {
          let alive = true;
          fetch(HEALTH_URL, { headers: { accept: 'application/json' } })
            .then((res) => {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.json();
            })
            .then((body) => {
              if (!alive) return;
              setPhase('ready');
              setPhaseDetail(body && body.version ? 'v' + body.version : '');
            })
            .catch((error) => {
              if (!alive) return;
              setPhase('error');
              setPhaseDetail(String(error.message || error));
            });
          return () => { alive = false; };
        }, []);

        React.useEffect(() => {
          const node = hostRef.current;
          if (!node || typeof ResizeObserver === 'undefined') return undefined;
          const observer = new ResizeObserver((entries) => {
            const widthPx = entries[0] && entries[0].contentRect ? entries[0].contentRect.width : 0;
            setNarrow(widthPx > 0 && widthPx < 760);
          });
          observer.observe(node);
          return () => observer.disconnect();
        }, []);

        React.useEffect(() => { writeStorage(WIDTH_KEY, width); }, [width]);
        React.useEffect(() => { writeStorage(PANE_KEY, paneOpen ? '1' : '0'); }, [paneOpen]);

        React.useEffect(() => {
          if (!dragging) return undefined;
          const onMove = (event) => {
            const node = hostRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const ratio = (rect.right - event.clientX) / rect.width;
            setWidth(Math.min(__AGENT_PANE__.max, Math.max(__AGENT_PANE__.min, ratio)));
          };
          const onUp = () => setDragging(false);
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
        }, [dragging]);

        const togglePane = async () => {
          if (hasConversation) {
            setPaneOpen((open) => !open);
            return;
          }
          if (!canCreateSession || creatingSession) return;
          setCreatingSession(true);
          setSessionNote('');
          try {
            const id = await createOwnedSession();
            if (!id) {
              setSessionNote('已取消资料目录选择，没有创建会话。可以再次点击「AI 对话」重试。');
              return;
            }
            setPaneOpen(true);
          } catch (error) {
            setSessionNote('没能创建会话：' + ((error && error.message) || error));
          } finally {
            setCreatingSession(false);
          }
        };

        const agentLabel = !canOpenAgent
          ? 'AI 对话暂不可用'
          : creatingSession
            ? '正在连接…'
            : paneOpen
              ? '收起 AI'
              : hasConversation
                ? '打开 AI 对话'
                : 'AI 对话';
        const retryHealth = () => {
          setPhase('loading');
          fetch(HEALTH_URL, { headers: { accept: 'application/json' } })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))))
            .then(() => setPhase('ready'))
            .catch((error) => { setPhase('error'); setPhaseDetail(String(error.message || error)); });
        };

        const percent = Math.round(width * 100);
        const showPane = paneOpen && (!narrow || paneOpen);

        const styles = {
          root: {
            position: 'relative', display: 'flex', flexDirection: 'column',
            width: '100%', height: '100%', minWidth: 0, minHeight: 0,
            background: '#f6f2ea', color: '#20241f',
            fontFamily: '"PingFang SC","Hiragino Sans GB",system-ui,sans-serif',
          },
          header: {
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '8px 12px', borderBottom: '1px solid #dcd5c6',
            background: '#fffdf8', minHeight: 48,
          },
          mark: {
            width: 28, height: 28, borderRadius: 8, background: '#1f4f40', color: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 14, fontFamily: 'Georgia,serif',
          },
          title: { fontFamily: '"Noto Serif SC","Songti SC",Georgia,serif', fontSize: 15, fontWeight: 600 },
          sub: { fontSize: 11, color: '#6f746b' },
          spacer: { flex: 1 },
          status: (ok) => ({ fontSize: 11, color: ok ? '#2e6b58' : '#9a4f2b', whiteSpace: 'nowrap' }),
          btn: {
            minHeight: 32, padding: '4px 10px', borderRadius: 8,
            border: '1px solid #c6bdaa', background: '#fffdf8', fontSize: 12, cursor: 'pointer',
          },
          body: { position: 'relative', flex: 1, minHeight: 0, display: 'flex' },
          frameWrap: { flex: 1, minWidth: 0, minHeight: 0, position: 'relative', background: '#f6f2ea' },
          frame: { width: '100%', height: '100%', border: 0, display: 'block', background: '#f6f2ea' },
          splitter: (active) => ({
            position: 'absolute', top: 0, bottom: 0, width: 8, cursor: 'col-resize',
            right: (narrow ? 0 : percent) + '%', transform: 'translateX(50%)',
            background: active ? 'rgba(46,107,88,.25)' : 'transparent',
            border: 0, padding: 0, zIndex: 12,
          }),
          splitterGrip: {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            color: '#8d9188', fontSize: 12, background: '#fffdf8', borderRadius: 4, padding: '2px 0',
          },
          aside: {
            width: narrow ? 'min(92%, 420px)' : percent + '%', minWidth: 0,
            display: showPane ? 'flex' : 'none', flexDirection: 'column',
            borderLeft: narrow ? 0 : '1px solid #dcd5c6',
            background: '#fffdf8',
            ...(narrow ? {
              position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 20,
              boxShadow: '0 12px 40px rgba(30,25,15,.22)',
            } : null),
          },
          paneHead: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderBottom: '1px solid #dcd5c6', fontSize: 12, color: '#6f746b',
          },
          conversation: { flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' },
          placeholder: {
            padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
            fontSize: 12.5, color: '#6f746b',
          },
          overlay: {
            position: 'absolute', inset: 0, background: 'rgba(32,36,31,.18)',
            zIndex: 15, border: 0, padding: 0,
          },
          error: {
            margin: 8, padding: '8px 10px', borderRadius: 8,
            background: '#fbeee3', color: '#7a4227', fontSize: 12,
          },
        };

        return h('div', { style: styles.root, ref: hostRef },
          h('div', { style: styles.header },
            h('div', { style: styles.mark, 'aria-hidden': 'true' }, '小'),
            h('div', { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
              h('div', { style: styles.title }, META.panelTitle),
              h('div', { style: styles.sub }, '小肠腺癌 · 本机优先'),
            ),
            h('div', { style: styles.spacer }),
            h('span', { style: styles.status(phase === 'ready'), title: phaseDetail },
              phase === 'ready' ? '服务已连接' : phase === 'loading' ? '正在确认服务' : '服务未连接'),
            h('button', { type: 'button', style: styles.btn, onClick: () => frameRef.current && frameRef.current.contentWindow && frameRef.current.contentWindow.location.reload() }, '刷新'),
            h('button', {
              type: 'button', style: styles.btn, onClick: togglePane,
              disabled: !canOpenAgent || creatingSession,
              title: canOpenAgent ? undefined : '当前 DSH Desktop 未提供原生会话接口；业务区照常可用。',
              'aria-pressed': paneOpen ? 'true' : 'false',
            }, agentLabel),
          ),
          sessionNote
            ? h('div', { role: 'status', style: { ...styles.error, background: '#faf2d8', color: '#5a4a1a' } }, sessionNote)
            : null,
          phase === 'error'
            ? h('div', { style: styles.error, role: 'alert' },
                '本机服务没有响应：' + phaseDetail + '。资料不会被改动；可以先刷新，或检查 DSH 宿主是否加载了本工作台。',
                h('button', { type: 'button', style: { ...styles.btn, marginLeft: 8 }, onClick: retryHealth }, '重试'))
            : null,
          h('div', { style: styles.body },
            h('div', { style: styles.frameWrap },
              h('iframe', {
                ref: frameRef,
                src: UI_ENTRY,
                title: META.title,
                sandbox: 'allow-scripts allow-same-origin allow-forms allow-downloads',
                style: styles.frame,
              }),
            ),
            !narrow && showPane
              ? h('div', {
                  role: 'separator', 'aria-orientation': 'vertical',
                  'aria-label': '调整 AI 对话宽度',
                  'aria-valuemin': Math.round(__AGENT_PANE__.min * 100),
                  'aria-valuemax': Math.round(__AGENT_PANE__.max * 100),
                  'aria-valuenow': percent,
                  tabIndex: 0,
                  style: styles.splitter(dragging || hovering),
                  onPointerDown: (event) => { event.preventDefault(); setDragging(true); },
                  onPointerEnter: () => setHovering(true),
                  onPointerLeave: () => setHovering(false),
                  onKeyDown: (event) => {
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      setWidth((w) => Math.min(__AGENT_PANE__.max, Math.round((w + 0.02) * 100) / 100));
                    }
                    if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      setWidth((w) => Math.max(__AGENT_PANE__.min, Math.round((w - 0.02) * 100) / 100));
                    }
                  },
                }, h('span', { style: styles.splitterGrip, 'aria-hidden': 'true' }, '⠿'))
              : null,
            narrow && showPane
              ? h('button', { type: 'button', style: styles.overlay, 'aria-label': '关闭 AI 对话', onClick: () => setPaneOpen(false) })
              : null,
            h('aside', {
              style: styles.aside,
              'aria-label': 'AI 对话',
              'aria-hidden': showPane ? undefined : 'true',
            },
              h('div', { style: styles.paneHead },
                h('span', null, 'AI 对话（宿主原生会话）'),
                h('button', { type: 'button', style: { ...styles.btn, minHeight: 26, padding: '2px 8px' }, onClick: () => setPaneOpen(false) }, '收起'),
              ),
              h('div', { style: styles.conversation },
                conversation
                  ? conversation
                  : h('div', { style: styles.placeholder },
                      h('b', null, 'AI 对话还没开始'),
                      h('span', null, '点顶栏「AI 对话」由宿主创建或恢复本工作台的会话。'),
                      h('span', null, '没有会话也不影响记录：业务区照常可用。'),
                    ),
              ),
            ),
          ),
        );
      }

      return Panel;
    }

    function apply(ctx) {
          bridge = ctx;
      const Panel = buildPanel(React);
      ctx.effect(() => ctx.desktopWorkbenches.register({
        title: META.title,
        panelTitle: META.panelTitle,
        icon: META.icon,
        repository: META.repository,
        description: META.description,
        audience: META.audience,
        requirements: META.requirements,
        initialization: 'empty',
        embedded: true,
        version: __VERSION__,
        author: META.author,
        layout: { businessSide: __PANEL_LAYOUT__.businessSide, businessWidth: __PANEL_LAYOUT__.businessWidth },
        customFrame: __PANEL_LAYOUT__.customFrame,
      }, Panel));
    }


    return { apply, inject: INJECT }
  }
})
