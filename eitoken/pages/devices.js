/* 设备：四层分区。一线 ESP32/AVR 在 1.0 里全流程；二三四线显示在线状态并链接经典版。 */
import { state, subscribe } from '../core/store.js';
import { bridge, CLOUD } from '../core/api.js';
import { TIERS, FAMILIES, boardByFqbn, STACKCHAN, isStackchanFqbn, canBeStackchan } from '../core/boards.js';
import { esc, $, $$, toast, empty } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { deviceCard, hotTag } from '../components/cards.js';
import { coverSVG } from '../components/covers.js';
import { boardArt } from '../components/iso.js';
import { motion } from '../core/motion.js';
import { projectFromTask } from '../core/projects.js';
import { go } from '../core/router.js';

const details = new Map();   // com → /api/mcu/board 结果

export async function render(view) {
  view.innerHTML = `
    <div class="page-h"><div><h1>设备</h1><p>用数据线插上板子，几秒内就会出现在这里。ESP32 和 Arduino 可以直接跑案例、编译烧录、看串口。</p></div>
      <span class="grow"></span><div id="dvFlag"></div><button class="btn" id="dvScan">${icon('refresh')}重新扫描</button></div>
    <div id="dvTiers"></div>`;

  let sig = '';
  const paint = () => {
    const s = state.hw.map((d) => d.key + d.family).join('|') + state.hwDemo + [...details.keys()].join();
    if (s === sig) return; sig = s;
    $('#dvFlag', view).innerHTML = state.hwDemo ? `<span class="demo-flag">${CLOUD ? '云端体验版 · 演示设备，插板识别与烧录即将开放' : '本机桥接未连接 · 显示演示设备'}</span>` : '';
    $('#dvTiers', view).innerHTML = TIERS.map((t) => tierHTML(t)).join('');
    bind(); motion.reveal(view);
    $$('.dev-card.is-new', view).forEach((el) => { motion.pop(el); motion.burst(el.querySelector('.dev-art')); });
  };

  function tierHTML(t) {
    let list = state.hw.filter((d) => t.families.includes(d.family));
    if (t.n === 4) list = list.concat(state.hw.filter((d) => !d.family && d.kind === 'serial'));
    const t1 = t.n === 1;
    let body;
    if (t1) {
      const cards = list.length ? list.map((d) => tier1Card(d)) : ['esp32', 'avr'].map((f) => ghost(f));
      if (!list.some(isScDev)) cards.push(scPromo());   // 本周热品：没插上时也给它一张卡
      body = `<div class="grid c2">${cards.join('')}</div>`;
    } else {
      body = list.length ? `<div class="grid c3">${list.map((d) => smallDev(d)).join('')}</div>`
        : `<div class="card flat tier-empty">${empty({ title: t.n === 4 ? '接入没列出来的设备' : '暂未发现', text: t.n === 4 ? '任何串口或网络设备都能接：在工作台说清它的接口和要做的事，平台帮你写驱动。' : '插上后会自动出现在这里。' })}</div>`;
    }
    return `<section class="tier tier-${t.n}" aria-label="${esc(t.nm)}">
      <div class="tier-h"><span class="tier-n">${t.n}</span><div><h2>${esc(t.nm)}</h2><p class="mute">${esc(t.sub)}</p></div><span class="grow"></span>
        ${t.classic ? `<a class="btn sm ghost" href="${t.classic}">${icon('layers')}经典版</a>` : `<span class="pill ok">1.0 全流程</span>`}</div>
      ${body}
    </section>`;
  }
  /* ── 本周热品 StackChan ── */
  const detFqbn = (d) => { const x = d.com && details.get(d.com); return (x && x.ok && x.fqbn) || ''; };
  const isScDev = (d) => isStackchanFqbn(detFqbn(d));
  const tier1Card = (d) => {
    const fq = detFqbn(d);
    if (isStackchanFqbn(fq)) return deviceCard(withDetail(d), { big: true, tag: hotTag('StackChan'),
      extra: `<a class="btn sm soft" href="#/cases?cat=${STACKCHAN.cat}">${icon('robot')}StackChan 案例</a>` });
    /* 纯界面切换：只改本页显示的板型，不碰串口、不握手 */
    const extra = canBeStackchan(d, fq) ? `<button class="btn sm ghost" data-sc="${esc(d.com)}" title="把板型切成 ${esc(STACKCHAN.nm)}">${icon('robot')}这是 StackChan</button>` : '';
    return deviceCard(withDetail(d), { big: true, extra });
  };
  const scPromo = () => `<div class="card dev-card big sc-dev" data-rv style="--fam:var(--fam-esp32)">
      <div class="dev-art sc-art">${coverSVG({ motif: 'stackchan', hue: 'cyan' }, 'dvsc')}</div>
      <div class="dev-body">
        <div class="row wrap" style="gap:8px">${hotTag('本周热品')}<span class="fam esp32">${esc(STACKCHAN.chip)}</span></div>
        <h3>${esc(STACKCHAN.nm)}</h3>
        <p class="mute" style="font-size:13px">${esc(STACKCHAN.plug)}</p>
        <p class="dim" style="font-size:13px">${esc(STACKCHAN.desc)}</p>
        <div class="row wrap" style="margin-top:auto;gap:8px"><a class="btn primary sm" href="#/cases?cat=${STACKCHAN.cat}">${icon('robot')}看它的案例</a><a class="btn sm ghost" href="#/help">${icon('help')}认不出？</a></div>
      </div></div>`;
  function asStackchan(com) {
    details.set(com, { ok: true, family: 'esp32', fqbn: STACKCHAN.fqbn, props: [], board: { nm: STACKCHAN.nm, chip: STACKCHAN.chip }, source: 'user' });
    sig = ''; paint();
    toast(`板型已切成 ${STACKCHAN.nm}`, 'ok');
  }

  const withDetail = (d) => {
    const x = d.com && details.get(d.com);
    if (!x || !x.ok) return d;
    const b = boardByFqbn(x.fqbn);
    return { ...d, nm: (x.board && x.board.nm) || (b && b.nm) || d.nm, sub: [x.board && x.board.chip, x.fqbn].filter(Boolean).join(' · '), family: x.family || d.family, sure: true };
  };
  const smallDev = (d) => `<div class="card dev-card small" data-rv style="--fam:${FAMILIES[d.family] ? FAMILIES[d.family].color : 'var(--mute)'}">
      <div class="dev-art">${boardArt(d.family || 'custom', 72)}</div>
      <div class="dev-body"><div class="row" style="gap:6px">${FAMILIES[d.family] ? `<span class="fam ${d.family}">${FAMILIES[d.family].nm}</span>` : '<span class="pill">待识别</span>'}${d.demo ? '<span class="demo-flag">演示</span>' : ''}</div>
      <b>${esc(d.nm)}</b><span class="mute mono" style="font-size:12px">${esc(d.com || d.ip || '')}</span>
      ${d.family ? `<a class="btn sm" href="/cos.html#/devices">${icon('layers')}经典版</a>` : `<button class="btn sm soft" data-ident="${esc(d.com)}">${icon('search')}识别</button>`}</div></div>`;
  const ghost = (f) => `<div class="card dev-card big ghost-dev" data-rv style="--fam:${FAMILIES[f].color}">
      <div class="dev-art">${boardArt(f, 150)}</div>
      <div class="dev-body"><span class="fam ${f}">${FAMILIES[f].nm}</span><h3>等你插上 ${FAMILIES[f].nm}</h3>
      <p class="mute">${f === 'esp32' ? '带 WiFi 和蓝牙，适合联网、遥控、物联网。插上后自动识别芯片型号和 Flash 大小。' : '5V、接线简单，最适合入门。Uno、Nano、Mega 都能自动认出来。'}</p>
      <div class="row wrap" style="margin-top:auto"><a class="btn sm" href="#/cases?board=${f}">${icon('store')}先看 ${FAMILIES[f].nm} 案例</a><a class="btn sm ghost" href="#/help">${icon('help')}认不出？</a></div></div></div>`;

  function bind() {
    $$('[data-new-project]', view).forEach((b) => (b.onclick = () => { const d = state.hw.find((x) => x.key === b.dataset.newProject); if (!d) return; const pj = projectFromTask('', { family: d.family, com: d.com }); go('/project/' + pj.id); }));
    $$('[data-ident]', view).forEach((b) => (b.onclick = () => identify(b.dataset.ident, b)));
    $$('[data-sc]', view).forEach((b) => (b.onclick = () => asStackchan(b.dataset.sc)));
  }
  async function identify(com, btn) {
    if (state.hwDemo) { toast('这是演示设备，插上真板子再识别', 'warn'); return; }
    btn && (btn.disabled = true, btn.innerHTML = '<i class="spin"></i>识别中');
    const r = await bridge.get('/api/mcu/board?com=' + encodeURIComponent(com), { timeout: 30000 });
    if (r.ok) { details.set(com, r); sig = ''; paint(); toast(`认出来了：${esc((r.board && r.board.nm) || r.fqbn)}`, 'ok'); }
    else { btn && (btn.disabled = false, btn.innerHTML = `${icon('search')}识别`); toast(r.status === 404 ? '桥接还不支持自动识别，请更新 EI TOKEN' : esc(r.error || '没认出来'), 'warn'); }
  }
  // 一线板子自动补识别（不复位设备的 GET，桥接自己决定是否握手）
  const autoDetail = () => {
    if (state.hwDemo) return;
    state.hw.filter((d) => d.kind === 'serial' && (d.family === 'esp32' || d.family === 'avr' || !d.family) && !details.has(d.com)).forEach(async (d) => {
      details.set(d.com, { pending: true });
      const r = await bridge.get('/api/mcu/board?com=' + encodeURIComponent(d.com), { timeout: 20000 });
      details.set(d.com, r); if (r.ok) { sig = ''; paint(); }
    });
  };

  paint(); autoDetail();
  $('#dvScan', view).onclick = async () => {
    const b = $('#dvScan', view); b.disabled = true; b.innerHTML = '<i class="spin"></i>扫描中';
    await bridge.get('/api/hw?scan=1', { timeout: 8000 });
    b.disabled = false; b.innerHTML = `${icon('refresh')}重新扫描`; details.clear(); sig = ''; autoDetail();
  };
  const unsub = subscribe((s, keys) => { if (keys.includes('hw') || keys.includes('hwDemo')) { paint(); autoDetail(); } });
  return () => unsub();
}
