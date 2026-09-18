/* 工作台：任务优先。一句话 → 生成；插着的板子 → 跑案例；推荐案例；我的成长。 */
import { state, subscribe } from '../core/store.js';
import { loadCases, CLOUD } from '../core/api.js';
import { esc, ring, fmtMoney, $, $$, toast } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { avatarHTML } from '../components/avatars.js';
import { caseCard, deviceCard, hotTag } from '../components/cards.js';
import { coverSVG } from '../components/covers.js';
import { motion } from '../core/motion.js';
import { myLevel } from '../core/me.js';
import { projectFromTask, activeBoard } from '../core/projects.js';
import { FAMILIES, STACKCHAN, isStackchanCase } from '../core/boards.js';
import { go } from '../core/router.js';
import { openTopup } from '../components/billing.js';
import { auth } from '../core/api.js';

const IDEAS = {
  esp32: ['按一下按键，手机网页上显示「有人按了」', '温湿度每 10 秒上报到 MQTT', '用 OLED 显示 WiFi 信号强度'],
  avr: ['超声波测距，小于 10cm 蜂鸣器响', '电位器控制舵机角度', '光线变暗自动开灯'],
};
const hello = () => { const h = new Date().getHours(); return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'; };

export async function render(view) {
  let family = (activeBoard() && activeBoard().family) || (state.profile && state.profile.profile && (state.profile.profile.boards || [])[0]) || 'esp32';
  if (family !== 'esp32' && family !== 'avr') family = 'esp32';
  const p = state.profile, lv = myLevel();
  const nick = p && p.profile ? p.profile.nickname : '创客';

  view.innerHTML = `
  <section class="home-hero">
    <div class="card hero task-card" data-rv>
      <div class="eyebrow">${hello()}，${esc(nick)}</div>
      <h1 class="task-h">今天想让硬件<span class="grad-txt">做什么</span>？</h1>
      <div class="task-box">
        <textarea id="hmTask" class="task-in" rows="2" placeholder="例如：按一下按键，LED 亮三秒后自动熄灭" aria-label="描述任务"></textarea>
        <div class="task-bar">
          <div class="seg" id="hmFam" role="radiogroup" aria-label="板子">${['esp32', 'avr'].map((f) => `<button class="${f === family ? 'on' : ''}" data-f="${f}" role="radio" aria-checked="${f === family}"><i class="fam-dot" style="background:${FAMILIES[f].color}"></i>${FAMILIES[f].nm}</button>`).join('')}</div>
          <span class="grow"></span>
          <span class="mute task-est" id="hmEst">约 ¥0.10 · 30 秒</span>
          <button class="btn primary lg" id="hmGo">${icon('sparkles')}生成并打开</button>
        </div>
      </div>
      <div class="chips" id="hmIdeas" style="margin-top:14px"></div>
    </div>

    <a class="card level-card hover" href="#/me" data-rv>
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><div class="eyebrow">我的职级</div><div class="lv-title">L${lv.n} · ${esc(lv.title)}</div></div>
        ${state.profileDemo ? '<span class="demo-flag">演示数据</span>' : ''}
      </div>
      <div class="lv-ring">${ring(0, 148, 12, `${avatarHTML(p && p.profile && p.profile.avatar, 'lg')}`)}</div>
      <div class="row" style="justify-content:space-between">
        <div><b class="num" id="hmXp">0</b> <span class="mute">XP</span></div>
        <div class="mute" style="font-size:12.5px">${lv.next ? `离「${esc(lv.next.title)}」还差 <b class="num" style="color:var(--txt)">${lv.toNext}</b>` : '已是最高职级'}</div>
      </div>
      <div class="lv-week"><span>${icon('chart')}本周 +<b class="num">${(p && p.weekXp) || 0}</b> XP</span><span>${icon('trophy')}<b class="num">${((p && p.achievements) || []).length}</b> 个成就</span></div>
    </a>
  </section>

  <section id="hmHot" aria-label="本周热品"></section>

  <section class="paths" aria-label="三种开始方式">
    <a class="card hover path" href="#/devices" data-rv><span class="path-ic" style="--c:var(--fam-esp32)">${icon('usb')}</span><div><b>插上板子</b><p>自动认出型号，挑个推荐案例直接烧</p></div>${icon('arrowR', 'path-go')}</a>
    <a class="card hover path" href="#/cases" data-rv><span class="path-ic" style="--c:var(--acc-2)">${icon('store')}</span><div><b>逛逛案例超市</b><p>${state.cases ? state.cases.length : 30} 个验证过的案例，没板子先仿真</p></div>${icon('arrowR', 'path-go')}</a>
    <button class="card hover path" id="hmFocus" data-rv><span class="path-ic" style="--c:var(--ok)">${icon('sparkles')}</span><div><b>说一句话</b><p>AI 按你板子的真实接口写代码并烧录</p></div>${icon('arrowR', 'path-go')}</button>
  </section>

  <div class="section-h"><h2>插着的板子</h2><span class="sub" id="hmDevSub"></span><a class="more" href="#/devices">全部设备</a></div>
  <div id="hmDevs"></div>

  <div class="section-h"><h2>为你推荐</h2><span class="sub" id="hmRecSub">从第一次点亮开始，五分钟见效果</span><a class="more" href="#/cases">案例超市</a></div>
  <div class="grid c4 case-grid" id="hmCases">${Array.from({ length: 4 }, () => '<div class="card skel" style="height:290px"></div>').join('')}</div>

  <div class="home-bottom">
    <div>
      <div class="section-h"><h2>最近的项目</h2><a class="more" href="#/projects">全部</a></div>
      <div id="hmProjects"></div>
    </div>
    <div>
      <div class="section-h"><h2>账户</h2><a class="more" href="#/account">用量明细</a></div>
      <div class="card acct-mini" data-rv>
        <div class="row"><span class="chip-ic">${icon('wallet')}</span><div class="grow"><div class="mute" style="font-size:12px">余额</div><b class="big-num num" id="hmBal" style="font-size:26px">${auth.loggedIn() ? fmtMoney(state.balance) : '—'}</b></div>
        <button class="btn soft" id="hmTop">${icon('plus')}充值</button></div>
        <p class="mute" style="font-size:12.5px;margin-top:12px">识别、编译、烧录、串口都不收费；只有 AI 生成代码按实际用量计费。</p>
      </div>
    </div>
  </div>`;

  const ta = $('#hmTask', view);
  const paintIdeas = () => {
    $('#hmIdeas', view).innerHTML = IDEAS[family].map((t) => `<button class="chip">${icon('sparkles')}${esc(t)}</button>`).join('');
    $$('#hmIdeas .chip', view).forEach((b) => (b.onclick = () => { ta.value = b.textContent.trim(); ta.focus(); }));
  };
  paintIdeas();
  $$('#hmFam button', view).forEach((b) => (b.onclick = () => {
    family = b.dataset.f;
    $$('#hmFam button', view).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    paintIdeas();
  }));
  ta.addEventListener('input', () => { const n = ta.value.length; $('#hmEst', view).textContent = n > 60 ? '约 ¥0.20 · 45 秒' : '约 ¥0.10 · 30 秒'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#hmGo', view).click(); });
  $('#hmFocus', view).onclick = () => { ta.focus(); motion.pop($('.task-box', view)); };
  $('#hmGo', view).onclick = () => {
    const t = ta.value.trim();
    if (!t) { ta.focus(); motion.shake($('.task-box', view)); toast('先说说想做什么', 'warn'); return; }
    const b = activeBoard();
    const pj = projectFromTask(t, { family, com: b && b.family === family ? b.com : '' });
    go('/project/' + pj.id);
  };
  $('#hmTop', view).onclick = () => openTopup();

  // 成长卡
  setTimeout(() => { const r = $('.lv-ring', view); if (!r) return; const fg = r.querySelector('.ring-fg'); const c = +fg.dataset.c; if (motion.on()) window.gsap.fromTo(fg, { attr: { 'stroke-dashoffset': c } }, { attr: { 'stroke-dashoffset': c * (1 - lv.p) }, duration: 1.2, ease: 'power3.out' }); else fg.setAttribute('stroke-dashoffset', c * (1 - lv.p)); }, 120);
  motion.counter($('#hmXp', view), (p && p.xp) || 0);

  // 设备
  let sig = '';
  const paintDevs = () => {
    const t1 = state.hw.filter((d) => d.family === 'esp32' || d.family === 'avr');
    const s = t1.map((d) => d.key).join('|') + state.hwDemo;
    if (s === sig) return; sig = s;
    const box = $('#hmDevs', view); if (!box) return;
    $('#hmDevSub', view).innerHTML = state.hwDemo ? `<span class="demo-flag">${CLOUD ? '云端体验版 · 演示设备' : '本机桥接未连接 · 演示设备'}</span>` : t1.length ? `${t1.length} 块 ESP32 / Arduino 在线` : '';
    box.innerHTML = t1.length
      ? `<div class="grid c2">${t1.slice(0, 2).map((d) => deviceCard(d, { big: true })).join('')}</div>`
      : `<div class="card plug-empty" data-rv><div class="plug-art">${plugArt()}</div><div><h3>插上一块 ESP32 或 Arduino</h3><p class="mute">用数据线连电脑，几秒内这里就会出现它的型号。没有板子？挑个能仿真的案例先玩。</p>
         <div class="row wrap" style="margin-top:14px"><a class="btn primary" href="#/cases?sim=1">${icon('sim')}看可仿真的案例</a><a class="btn" href="#/help">${icon('help')}认不出板子怎么办</a></div></div></div>`;
    $$('[data-new-project]', box).forEach((b) => (b.onclick = () => { const d = state.hw.find((x) => x.key === b.dataset.newProject); const pj = projectFromTask('', { family: d.family, com: d.com }); pj.pendingTask = ''; go('/project/' + pj.id); }));
    motion.reveal(box);
    const n = box.querySelector('.is-new'); if (n) motion.burst(n.querySelector('.dev-art'));
  };
  paintDevs();
  const unsub = subscribe((s, keys) => { if (keys.includes('hw') || keys.includes('hwDemo')) paintDevs(); if (keys.includes('balance')) { const el = $('#hmBal', view); if (el && auth.loggedIn()) el.textContent = fmtMoney(state.balance); } });

  // 本周热品（案例数据还没生成就整块不显示，不报错）
  const idx = await loadCases();
  paintHot($('#hmHot', view), idx.cases);

  // 推荐
  const fam = (activeBoard() && activeBoard().family) || family;
  const rec = idx.cases.filter((c) => (c.families || []).includes(fam)).sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1)).slice(0, 4);
  const cbox = $('#hmCases', view);
  if (cbox) { cbox.innerHTML = rec.map((c) => caseCard(c)).join(''); motion.reveal(cbox); }

  // 项目
  const pbox = $('#hmProjects', view);
  const projs = state.projects.slice(0, 4);
  pbox.innerHTML = projs.length
    ? `<div class="card proj-list" data-rv>${projs.map((pj) => `<a class="proj-row" href="#/project/${pj.id}"><span class="chip-ic" style="background:color-mix(in srgb, ${FAMILIES[pj.family] ? FAMILIES[pj.family].color : 'var(--acc)'} 16%, transparent);color:${FAMILIES[pj.family] ? FAMILIES[pj.family].color : 'var(--acc)'}">${icon('code')}</span><div class="grow" style="min-width:0"><b>${esc(pj.title || '未命名项目')}</b><div class="mute" style="font-size:12px">${FAMILIES[pj.family] ? FAMILIES[pj.family].nm : ''} · ${new Date(pj.updated || pj.created).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>${icon('chevR')}</a>`).join('')}</div>`
    : `<div class="card" data-rv><div class="empty" style="padding:22px"><h4>还没有项目</h4><p>在上面说一句话，或者从案例一键新建。</p></div></div>`;

  motion.reveal(view);
  return () => unsub();
}

/* 本周热品横幅：拿不到 sc-* 案例就整块不渲染（对方轨道还没生成数据时优雅降级） */
const HOT_PICK = ['sc-hello', 'sc-nod', 'sc-rgb'];
function paintHot(box, cases) {
  if (!box) return;
  const sc = (cases || []).filter(isStackchanCase);
  if (!sc.length) return;
  const byId = Object.fromEntries(sc.map((c) => [c.id, c]));
  const picks = [...HOT_PICK.map((id) => byId[id]).filter(Boolean), ...sc].filter((c, i, a) => a.indexOf(c) === i).slice(0, 3);
  box.innerHTML = `<div class="card hot-banner" data-rv>
    <div class="hb-art">${coverSVG({ motif: 'stackchan', hue: 'cyan' }, 'hotsc')}</div>
    <div class="hb-body">
      <div class="row wrap" style="gap:8px">${hotTag('本周热品')}<span class="fam esp32">${esc(STACKCHAN.chip)}</span><span class="pill">${sc.length} 个案例</span></div>
      <h3>${esc(STACKCHAN.short)} 桌面机器人 · <span class="grad-txt">${esc(STACKCHAN.tagline)}</span></h3>
      <p>${esc(STACKCHAN.desc)}</p>
      <div class="hb-go">${picks.map((c, i) => `<a class="hb-btn ${i === 0 ? 'primary' : ''}" href="#/cases/${encodeURIComponent(c.id)}">${icon(i === 0 ? 'play' : 'sparkles')}<span>${esc(c.title)}</span>${icon('arrowR', 'hb-go-ic')}</a>`).join('')}</div>
    </div>
    <a class="hb-more" href="#/cases?cat=${STACKCHAN.cat}">全部 ${sc.length} 个 ${esc(STACKCHAN.short)} 案例${icon('chevR')}</a>
  </div>`;
  motion.reveal(box, '[data-rv]', { y: 18, delay: 0.08 });
  motion.float(box.querySelector('.hb-art'));
}

function plugArt() {
  return `<svg viewBox="0 0 160 110" width="160" height="110" aria-hidden="true">
    <rect x="8" y="30" width="72" height="50" rx="10" fill="var(--raised-2)" stroke="var(--line)"/>
    <rect x="18" y="40" width="30" height="22" rx="4" fill="var(--fam-esp32)" opacity=".55"/>
    <rect x="80" y="48" width="18" height="14" rx="3" fill="var(--mute)"/>
    <path d="M98 55c20 0 20-30 44-30" stroke="var(--acc)" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="6 7"><animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.2s" repeatCount="indefinite"/></path>
    <rect x="130" y="14" width="24" height="18" rx="4" fill="var(--acc)"/>
  </svg>`;
}
