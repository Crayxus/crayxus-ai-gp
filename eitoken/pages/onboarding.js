/* 新手引导：任务驱动、随时可跳过、不锁任何功能。
   1 身份 + 手上的板子 → 2 头像昵称 → 3 第一个任务「点亮 LED」（插板一键烧录，没板子就仿真）
   之后首次进入 设备 / 案例 / 项目 / 串口 各弹一张聚光灯小卡。 */
import { state } from '../core/store.js';
import { auth } from '../core/api.js';
import { esc, modal, $, $$ } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { avatarHTML, AVATAR_IDS } from '../components/avatars.js';
import { boardArt } from '../components/iso.js';
import { saveProfile, clientEvent } from '../core/me.js';
import { motion } from '../core/motion.js';
import { go } from '../core/router.js';

const ROLES = [['student', '学生', 'book'], ['teacher', '老师', 'user'], ['maker', '创客', 'bolt'], ['engineer', '工程师', 'cpu']];

const ob = () => (state.profile && state.profile.profile && state.profile.profile.onboarding) || {};

export function maybeStartOnboarding() {
  const o = ob();
  if (o.done || localStorageSkip()) return;
  // 没登录的访客也给引导（资料先存本机），但只在首页自动弹
  if (location.hash && location.hash !== '#/' && location.hash !== '#') return;
  setTimeout(() => startOnboarding(), 600);
}
const localStorageSkip = () => { try { return localStorage.getItem('eit1.obSkip') === '1'; } catch (e) { return false; } };

export function startOnboarding() {
  const p = (state.profile && state.profile.profile) || {};
  const pick = { role: p.role || '', board: (p.boards || [])[0] || '', avatar: p.avatar || 'bot-07', nickname: p.nickname && !/^创客\d+$/.test(p.nickname) ? p.nickname : '' };
  let step = 0;
  const m = modal(`<div class="ob">
      <div class="ob-top"><div class="ob-dots">${[0, 1, 2].map((i) => `<i data-d="${i}"></i>`).join('')}</div><span class="grow"></span><button class="btn ghost sm" id="obSkip">跳过，直接用</button></div>
      <div class="ob-stage" id="obStage"></div>
    </div>`, { wide: true, label: '欢迎使用 EI TOKEN', onClose: () => { if (step < 3) { try { localStorage.setItem('eit1.obSkip', '1'); } catch (e) {} saveProfile({ onboarding: { done: true, step } }); } } });
  const stage = m.el.querySelector('#obStage');
  m.el.querySelector('#obSkip').onclick = () => m.close();

  const paint = () => {
    $$('.ob-dots i', m.el).forEach((d, i) => d.classList.toggle('on', i <= step));
    if (step === 0) stage.innerHTML = `
      <div class="ob-hero">${boardArt('esp32', 120)}${boardArt('avr', 120)}</div>
      <h2>欢迎来到 EI TOKEN</h2><p class="mute">插上板子、挑个案例或说一句话，编译、烧录、看串口一次完成。先认识一下你：</p>
      <div class="eyebrow" style="margin:18px 0 10px">你是</div>
      <div class="ob-grid">${ROLES.map(([k, n, ic]) => `<button class="ob-opt ${pick.role === k ? 'on' : ''}" data-role="${k}">${icon(ic)}<b>${n}</b></button>`).join('')}</div>
      <div class="eyebrow" style="margin:18px 0 10px">手上有什么板子</div>
      <div class="ob-grid c3">${[['esp32', 'ESP32'], ['avr', 'Arduino'], ['none', '还没有']].map(([k, n]) => `<button class="ob-opt ${pick.board === k ? 'on' : ''}" data-board="${k}">${k === 'none' ? icon('sim') : `<span class="ob-mini">${boardArt(k, 44)}</span>`}<b>${n}</b></button>`).join('')}</div>
      <div class="ob-f"><span class="grow"></span><button class="btn primary lg" id="obNext">下一步${icon('arrowR')}</button></div>`;
    if (step === 1) stage.innerHTML = `
      <h2>挑个头像，起个名字</h2><p class="mute">会显示在你的职级卡和排行榜上。从「见习创客」开始，完成真实任务就会升级。</p>
      <div class="ob-me"><div class="ob-big" id="obBig">${avatarHTML(pick.avatar, 'xl')}</div>
        <div class="grow"><div class="field"><label for="obNick">昵称</label><input class="input" id="obNick" maxlength="16" value="${esc(pick.nickname)}" placeholder="比如：焊锡侠"></div>
        <div class="ob-av">${AVATAR_IDS.map((a) => `<button class="ob-avb ${a === pick.avatar ? 'on' : ''}" data-av="${a}" aria-label="${a}">${avatarHTML(a, 'sm')}</button>`).join('')}</div></div></div>
      <div class="ob-f"><button class="btn ghost" id="obBack">${icon('arrowL')}上一步</button><span class="grow"></span><button class="btn primary lg" id="obNext">就这样${icon('arrowR')}</button></div>`;
    if (step === 2) {
      const live = state.hw.find((d) => (d.family === 'esp32' || d.family === 'avr') && !d.demo);
      const noBoard = pick.board === 'none' || (!live && pick.board !== 'esp32' && pick.board !== 'avr');
      stage.innerHTML = `
      <div class="ob-rank">${avatarHTML(pick.avatar, 'lg')}<div><div class="eyebrow">获得职级</div><b>L1 · 见习创客</b></div></div>
      <h2>第一个任务：点亮一颗 LED</h2>
      <p class="mute">${live ? `检测到 <b style="color:var(--txt)">${esc(live.nm)}</b>（${esc(live.com)}）。点一下就会编译、自动备份原程序、烧进去。` : noBoard ? '没有板子也没关系，在仿真里跑一遍，看得到灯一闪一闪。' : '用数据线插上板子，这里会自动认出来；也可以先仿真。'}</p>
      <div class="ob-task ${live ? 'live' : ''}" id="obTask">
        <div class="ob-led"><i></i></div>
        <div class="grow"><b>闪烁 LED</b><div class="mute" style="font-size:12.5px">5 分钟 · 不用接线 · +30 XP</div></div>
        ${live ? `<button class="btn primary lg" id="obFlash">${icon('flash')}一键烧录</button>` : `<button class="btn primary lg" id="obSim">${icon('sim')}先仿真</button>`}
      </div>
      <div class="ob-f"><button class="btn ghost" id="obBack">${icon('arrowL')}上一步</button><span class="grow"></span><button class="btn" id="obLater">以后再说</button></div>`;
      motion.float(m.el.querySelector('.ob-led i'));
    }
    bind(); motion.reveal(stage, stage.children, { y: 10, stagger: 0.04 });
  };
  const bind = () => {
    $$('[data-role]', stage).forEach((b) => (b.onclick = () => { pick.role = b.dataset.role; $$('[data-role]', stage).forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('[data-board]', stage).forEach((b) => (b.onclick = () => { pick.board = b.dataset.board; $$('[data-board]', stage).forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('[data-av]', stage).forEach((b) => (b.onclick = () => { pick.avatar = b.dataset.av; $$('[data-av]', stage).forEach((x) => x.classList.toggle('on', x === b)); $('#obBig', stage).innerHTML = avatarHTML(pick.avatar, 'xl'); motion.pop($('#obBig', stage)); }));
    const nx = $('#obNext', stage); if (nx) nx.onclick = async () => {
      if (step === 1) pick.nickname = ($('#obNick', stage).value || '').trim();
      step++;
      saveProfile({ role: pick.role || undefined, boards: pick.board && pick.board !== 'none' ? [pick.board] : [], avatar: pick.avatar, ...(pick.nickname ? { nickname: pick.nickname } : {}), onboarding: { step } });
      paint();
    };
    const bk = $('#obBack', stage); if (bk) bk.onclick = () => { step--; paint(); };
    const finish = (action) => {
      step = 3; saveProfile({ onboarding: { done: true, step: 3 } }); clientEvent('onboarding_done', 'v1');
      m.close();
      if (action) import('../core/api.js').then(async ({ loadCase }) => {
        const c = await loadCase('blink'); if (!c) return go('/cases/blink');
        const { projectFromCase, activeBoard } = await import('../core/projects.js');
        const { saveProject } = await import('../core/store.js');
        const lv = activeBoard();
        const pj = projectFromCase(c, { family: lv ? lv.family : (pick.board === 'esp32' ? 'esp32' : 'avr'), com: lv ? lv.com : '' });
        saveProject({ ...pj, pendingAction: action });
        go('/project/' + pj.id);
      });
    };
    const fl = $('#obFlash', stage); if (fl) fl.onclick = () => finish('flash');
    const sm = $('#obSim', stage); if (sm) sm.onclick = () => finish('sim');
    const lt = $('#obLater', stage); if (lt) lt.onclick = () => finish('');
  };
  paint();
}

/* 聚光灯小卡：每个位置只出现一次 */
const TIPS = {
  devices: { sel: '.tier-1 .grid', title: '插上就认出来', text: 'ESP32 和 Arduino 插上几秒就出现在这里。点「跑个案例」直接开始。' },
  cases: { sel: '#csFilters', title: '按你的板子挑', text: '选板子、难度、场景，或只看「能仿真」的——没有板子也能先玩。' },
  project: { sel: '#pjSteps', title: '五步走完', text: '代码 → 编译 → 烧录 → 串口 → 仿真。点任意一步都能直接跳过去；右边的 AI 帮你改代码。' },
  serial: { sel: '#srLog', title: '板子在说话', text: '烧录成功后串口会自动打开，这里能看到板子打印的内容，也能发指令给它。' },
};
export async function tipFor(key) {
  const t = TIPS[key]; if (!t) return;
  const o = ob();
  const seenLocal = (() => { try { return JSON.parse(localStorage.getItem('eit1.tips') || '{}'); } catch (e) { return {}; } })();
  if (!o.done || (o.tips && o.tips[key]) || seenLocal[key]) return;
  const el = document.querySelector(t.sel); if (!el || !el.offsetParent) return;
  const r = el.getBoundingClientRect();
  if (r.top > window.innerHeight || r.bottom < 0) return;
  const ring = document.createElement('div'); ring.className = 'spot-ring';
  const pad = 8;
  Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, window.innerHeight * 0.6) + pad * 2 + 'px' });
  const card = document.createElement('div'); card.className = 'spot-card'; card.setAttribute('role', 'dialog');
  card.innerHTML = `<div class="eyebrow" style="margin-bottom:6px">小提示</div><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p><div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn primary sm">知道了</button></div>`;
  document.body.append(ring, card);
  const below = r.top + Math.min(r.height, window.innerHeight * 0.6) + 20;
  const top = below + 170 < window.innerHeight ? below : Math.max(16, r.top - 190);
  Object.assign(card.style, { left: Math.min(Math.max(16, r.left), window.innerWidth - 336) + 'px', top: top + 'px' });
  motion.pop(card);
  const close = () => { ring.remove(); card.remove(); seenLocal[key] = 1; try { localStorage.setItem('eit1.tips', JSON.stringify(seenLocal)); } catch (e) {} saveProfile({ onboarding: { tips: { [key]: true } } }); clientEvent('tip_seen', key); };
  card.querySelector('button').onclick = close;
  setTimeout(() => { if (card.isConnected) close(); }, 12000);
}
