/* 应用外壳：侧栏、顶栏、主题、服务探测、设备轮询、路由表。 */
import { route, render, onRoute, current } from './core/router.js';
import { state, set, subscribe } from './core/store.js';
import { bridge, server, fixtures, auth, CLOUD } from './core/api.js';
import { normalizeHw } from './core/boards.js';
import { icon } from './components/icons.js';
import { avatarHTML } from './components/avatars.js';
import { esc, fmtMoney, $ } from './core/ui.js';
import { loadMe, myLevel } from './core/me.js';
import { openTopup } from './components/billing.js';
import { openLogin } from './components/login.js';
import { maybeStartOnboarding, tipFor } from './pages/onboarding.js';

route('/', () => import('./pages/home.js'), { nav: 'home', crumb: '工作台' });
route('/devices', () => import('./pages/devices.js'), { nav: 'devices', crumb: '设备', tip: 'devices' });
route('/cases', () => import('./pages/cases.js'), { nav: 'cases', crumb: '案例超市', tip: 'cases' });
route('/cases/:id', () => import('./pages/case.js'), { nav: 'cases', crumb: '案例' });
route('/libs', () => import('./pages/libs.js'), { nav: 'libs', crumb: '兼容库' });
route('/project/:id', () => import('./pages/project.js'), { nav: 'projects', crumb: '项目', tip: 'project' });
route('/projects', () => import('./pages/projects.js'), { nav: 'projects', crumb: '我的项目' });
route('/me', () => import('./pages/me.js'), { nav: 'me', crumb: '我的' });
route('/rank', () => import('./pages/rank.js'), { nav: 'rank', crumb: '排行榜' });
route('/account', () => import('./pages/account.js'), { nav: 'account', crumb: '账户与用量' });
route('/pricing', () => import('./pages/pricing.js'), { nav: 'account', crumb: '套餐' });
route('/help', () => import('./pages/help.js'), { nav: 'help', crumb: '帮助' });

const NAV = [
  { sec: '做事' },
  { id: 'home', href: '#/', ic: 'home', nm: '工作台' },
  { id: 'devices', href: '#/devices', ic: 'usb', nm: '设备', badge: () => { const n = state.hw.filter((d) => d.family === 'esp32' || d.family === 'avr').length; return n ? String(n) : ''; } },
  { id: 'cases', href: '#/cases', ic: 'store', nm: '案例超市', badge: () => (state.cases ? String(state.cases.length) : '') },
  { id: 'projects', href: '#/projects', ic: 'code', nm: '我的项目' },
  { id: 'libs', href: '#/libs', ic: 'book', nm: '兼容库' },
  { sec: '成长' },
  { id: 'me', href: '#/me', ic: 'user', nm: '我的成就' },
  { id: 'rank', href: '#/rank', ic: 'trophy', nm: '排行榜' },
  { sec: '账户' },
  { id: 'account', href: '#/account', ic: 'wallet', nm: '账户与用量' },
  { id: 'help', href: '#/help', ic: 'help', nm: '帮助' },
];
let navOn = 'home';
function paintNav() {
  $('#nav').innerHTML = NAV.map((n) => n.sec ? `<div class="nav-sec">${n.sec}</div>`
    : `<a href="${n.href}" class="${n.id === navOn ? 'on' : ''}" ${n.id === navOn ? 'aria-current="page"' : ''}>${icon(n.ic)}<span>${n.nm}</span>${n.badge && n.badge() ? `<span class="tag">${n.badge()}</span>` : ''}</a>`).join('')
    + `<div class="nav-sec">经典版</div><a href="/cos.html" title="STM32 / ROS / VEX 等二三线设备">${icon('layers')}<span>经典版工作台</span></a>`;
}
function paintFoot() {
  const p = state.profile, lv = myLevel();
  const low = state.balance != null && state.balance < 5;
  const nm = p && p.profile ? p.profile.nickname : '访客';
  $('#sideFoot').innerHTML = `
    ${auth.loggedIn() ? `<button class="bal-chip ${low ? 'low' : ''}" id="balChip" title="充值额度">
      <span class="chip-ic" style="width:30px;height:30px">${icon('wallet')}</span>
      <span class="stack" style="gap:0;align-items:flex-start"><span class="mute" style="font-size:11px">${low ? '余额不多了' : '余额'}</span><span class="v num">${fmtMoney(state.balance)}</span></span>
      <span class="grow"></span><span class="pill acc" style="height:22px">${icon('plus')}充值</span></button>` : ''}
    <a class="me-chip" href="${auth.loggedIn() ? '#/me' : '#'}" id="meChip">
      ${avatarHTML(p && p.profile && p.profile.avatar)}
      <span class="grow" style="min-width:0">
        <span class="nm" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(auth.loggedIn() ? nm : '登录 / 注册')}</span>
        <span class="lv">${auth.loggedIn() ? `L${lv.n} · ${lv.title}` : '登录后记录经验和成就'}</span>
        ${auth.loggedIn() ? `<span class="xp-mini"><i style="--p:${lv.p}"></i></span>` : ''}
      </span></a>`;
  const bc = $('#balChip'); if (bc) bc.onclick = () => openTopup();
  const mc = $('#meChip'); if (mc && !auth.loggedIn()) mc.onclick = (e) => { e.preventDefault(); openLogin({ onDone: () => render() }); };
}
function paintStatus() {
  const b = state.bridge, s = state.server;
  $('#topStatus').innerHTML = `
    ${CLOUD && b === false
      ? `<span class="pill acc" title="云端体验版：界面、案例、账号、成就全部可用；编译与烧录走浏览器直连，即将开放。现在要烧录请用 Windows 版。"><i class="dot" style="background:var(--acc)"></i><span>云端体验版</span></span>`
      : `<span class="pill ${b ? 'ok' : b === false ? 'warn' : ''}" title="${b ? '本机桥接已连接' : '本机桥接没连上：识别、编译、烧录需要它'}"><i class="dot ${b ? 'ok' : b === false ? 'warn' : ''}"></i><span>${b ? '本机已连接' : b === false ? '本机未连接' : '检查中'}</span></span>`}
    ${state.hwDemo ? '<span class="demo-flag">演示设备</span>' : ''}`;
}
function paintTheme() {
  document.documentElement.dataset.theme = state.theme === 'day' ? 'day' : 'night';
  $('#themeBtn').innerHTML = icon(state.theme === 'day' ? 'moon' : 'sun');
  $('#themeBtn').setAttribute('aria-label', state.theme === 'day' ? '切换到深色' : '切换到浅色');
}

subscribe((s, keys) => {
  if (keys.some((k) => ['profile', 'balance', 'plan'].includes(k))) paintFoot();
  if (keys.some((k) => ['bridge', 'server', 'hwDemo'].includes(k))) paintStatus();
  if (keys.includes('theme')) paintTheme();
  if (keys.some((k) => ['hw', 'cases'].includes(k))) paintNav();
});

onRoute((meta) => {
  navOn = meta.nav || '';
  paintNav();
  $('#crumb').innerHTML = `<span>EI TOKEN</span>${icon('chevR')}<b>${esc(meta.crumb || '')}</b>`;
  document.getElementById('app').classList.remove('menu-open');
  if (meta.tip) setTimeout(() => tipFor(meta.tip), 700);
});

$('#themeBtn').onclick = () => set({ theme: state.theme === 'day' ? 'night' : 'day' });
$('#menuBtn').innerHTML = icon('menu');
$('#menuBtn').onclick = () => document.getElementById('app').classList.toggle('menu-open');

/* 设备轮询：桥接在就 3 秒一次；不在就用演示设备，但标出来 */
let hwTimer = null, prevKeys = null;
async function pollHw() {
  // 云端体验版：HTTPS 页面连不上本机 HTTP 桥接（会卡到超时才失败），直接用演示设备，别让首屏等它
  const r = CLOUD ? { ok: false } : await bridge.get('/api/hw', { timeout: 6000 });
  if (r.ok) {
    const list = normalizeHw(r);
    const keys = list.map((d) => d.key).join('|');
    if (prevKeys !== null) {
      const old = new Set(prevKeys.split('|'));
      list.filter((d) => !old.has(d.key)).forEach((d) => { d.isNew = true; });
    }
    prevKeys = keys;
    set({ bridge: true, hw: list, hwDemo: false });
  } else {
    const fx = await fixtures();
    set({ bridge: false, hw: normalizeHw(fx.hw || {}).map((d) => ({ ...d, demo: true })), hwDemo: true });
  }
}
/* #/login 直达登录页（分享链接、录演示视频用）；不进路由表，打开全屏登录层 */
function loginDeepLink() {
  if (location.hash !== '#/login') return false;
  history.replaceState(null, '', '#/');
  return true;
}
window.addEventListener('hashchange', () => { if (loginDeepLink()) { render(); openLogin({ onDone: () => render() }); } });

/* 调试 / 截图用的查询参数：?theme=day|night 指定主题，?ob=skip 跳过新手引导 */
function applyQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get('ob') === 'skip') { try { localStorage.setItem('eit1.obSkip', '1'); } catch (e) {} }
  const t = q.get('theme');
  if (t === 'day' || t === 'night') set({ theme: t });
}

async function boot() {
  applyQuery();
  const wantLogin = loginDeepLink();
  paintTheme(); paintNav(); paintFoot(); paintStatus();
  const [h, sv] = await Promise.all([CLOUD ? { ok: false } : bridge.get('/api/health', { timeout: 2500 }), server.get('/api/health', { timeout: 2500 })]);
  set({ bridge: !!h.ok, server: !!sv.ok });
  await pollHw();
  if (!CLOUD) hwTimer = setInterval(pollHw, 3000);
  await loadMe();
  import('./core/api.js').then((m) => m.loadCases()).then((c) => set({ cases: c.cases }));
  await render();
  if (wantLogin) { openLogin({ onDone: () => render() }); return; }
  maybeStartOnboarding();
}
boot();
window.addEventListener('beforeunload', () => clearInterval(hwTimer));
export { current };
