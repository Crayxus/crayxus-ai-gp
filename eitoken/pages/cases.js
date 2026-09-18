/* 案例超市：按场景 / 元件 / 难度 / 板子 / 能否仿真筛选；筛选用 GSAP Flip 过渡。 */
import { loadCases } from '../core/api.js';
import { state } from '../core/store.js';
import { esc, $, $$, empty } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { caseCard, catName, hotTag } from '../components/cards.js';
import { coverSVG } from '../components/covers.js';
import { motion } from '../core/motion.js';
import { clientEvent } from '../core/me.js';
import { STACKCHAN, isStackchanCase, isStackchanFqbn } from '../core/boards.js';

export async function render(view) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const f = { q: '', cat: qs.get('cat') || 'all', tag: '', diff: 0, board: qs.get('board') || 'all', sim: qs.get('sim') === '1' };
  view.innerHTML = `<div class="page-h"><div><h1>案例超市</h1><p>每个案例都在 Uno / Nano / ESP32 上真编译验证过，带接线图和元件清单。挑一个，一键烧录或先仿真。</p></div></div>
    <div class="grid c3 skel-row">${'<div class="card skel" style="height:200px"></div>'.repeat(3)}</div>`;
  const idx = await loadCases();
  const all = idx.cases;
  const done = new Set();   // 已完成案例（后端推算的 case_done 暂无列表接口，先留空）

  const tagCount = {};
  all.forEach((c) => (c.tags || []).forEach((t) => { if (t !== '入门') tagCount[t] = (tagCount[t] || 0) + 1; }));
  const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  /* 热品（StackChan）优先：分类排第一、精选第一张换成它；数据没生成就自动回落到原来的三张 */
  const scCases = all.filter(isStackchanCase);
  const hotOne = all.find((c) => c.id === 'sc-hello') || scCases[0] || null;
  const featured = [...new Set([hotOne && hotOne.id, 'blink', 'ultrasonic', 'web-led'].filter(Boolean))]
    .map((id) => all.find((c) => c.id === id)).filter(Boolean).slice(0, 3);
  const FEAT_LB = { blink: '新手第一步', ultrasonic: '最受欢迎', 'web-led': 'ESP32 联网' };
  const featLabel = (c) => (isStackchanCase(c) ? '本周热品 · ' + STACKCHAN.short : FEAT_LB[c.id] || '编辑推荐');
  /* 分类：桌面机器人排第一。索引里还没有这个分类但已有 sc-* 案例时自己补上 */
  let cats = (idx.categories || []).slice();
  if (scCases.length && !cats.some((c) => c.id === STACKCHAN.cat)) cats.unshift({ id: STACKCHAN.cat, nm: STACKCHAN.catNm });
  cats = [...cats.filter((c) => c.id === STACKCHAN.cat), ...cats.filter((c) => c.id !== STACKCHAN.cat)];
  /* 深链带的筛选值在数据里不存在时（热品案例还没生成）回落到全部，不给用户看空页 */
  if (f.cat !== 'all' && !all.some((c) => c.category === f.cat)) f.cat = 'all';
  if (f.board === STACKCHAN.cat && !scCases.length) f.board = 'all';
  const boardSeg = [['all', '全部板子'], ...(scCases.length ? [[STACKCHAN.cat, STACKCHAN.short]] : []), ['esp32', 'ESP32'], ['avr', 'Arduino']];
  const matchBoard = (c) => f.board === 'all' || (f.board === STACKCHAN.cat ? isStackchanCase(c) || (c.boards || []).some((b) => isStackchanFqbn(b.fqbn)) : (c.families || []).includes(f.board));

  view.innerHTML = `
    <div class="page-h"><div><h1>案例超市</h1><p>每个案例都真编译验证过，带接线图和元件清单。挑一个，一键烧录或先仿真。</p></div>
      <span class="grow"></span><span class="pill acc">${icon('check')}${all.length} 个案例 · 验证于 ${idx.generatedAt ? new Date(idx.generatedAt).toLocaleDateString('zh-CN') : '本周'}</span></div>

    <section class="featured" aria-label="精选">
      ${featured.map((c, i) => `<a class="card hover feat ${i === 0 ? 'feat-main' : ''} ${c.hot || isStackchanCase(c) ? 'feat-hot' : ''}" href="#/cases/${c.id}" data-rv>
        <div class="feat-cover">${coverSVG(c.cover, 'f' + c.id)}${c.hot || isStackchanCase(c) ? `<span class="cc-hot">${hotTag()}</span>` : ''}</div>
        <div class="feat-body"><span class="eyebrow">${esc(featLabel(c))}</span><h3>${esc(c.title)}</h3><p>${esc(c.sub)}</p>
        <span class="btn ${i === 0 ? 'primary' : 'soft'} sm" style="margin-top:12px">${icon('play')}打开</span></div></a>`).join('')}
    </section>

    <div class="filters card flat" id="csFilters">
      <div class="row wrap" style="gap:10px">
        <label class="search"><span class="sr">搜索案例</span>${icon('search')}<input class="input" id="csQ" placeholder="搜 LED、舵机、温度、WiFi…" autocomplete="off"></label>
        <div class="seg" id="csBoard">${boardSeg.map(([k, n]) => `<button data-v="${k}" class="${f.board === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
        <div class="seg" id="csDiff">${[[0, '全部难度'], [1, '入门'], [2, '进阶'], [3, '挑战']].map(([k, n]) => `<button data-v="${k}" class="${f.diff === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <button class="chip ${f.sim ? 'on' : ''}" id="csSim">${icon('sim')}能仿真</button>
      </div>
      <div class="chips" id="csCat" style="margin-top:12px">${[...cats.filter((c) => c.id === STACKCHAN.cat).map((c) => [c.id, c.nm]), ['all', '全部场景'], ...cats.filter((c) => c.id !== STACKCHAN.cat).map((c) => [c.id, c.nm])].map(([k, n]) => `<button class="chip ${k === STACKCHAN.cat ? 'hot' : ''} ${f.cat === k ? 'on' : ''}" data-v="${k}">${k === STACKCHAN.cat ? icon('flame') : ''}${esc(n)}<span class="mute num">${k === 'all' ? all.length : all.filter((c) => c.category === k).length}</span></button>`).join('')}</div>
      <div class="chips tag-chips" id="csTag" style="margin-top:10px"><span class="mute" style="font-size:12.5px;align-self:center">元件</span>${tags.map((t) => `<button class="chip sm-chip" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    </div>

    <div class="row" style="margin:18px 0 12px"><b id="csCount"></b><span class="grow"></span><span class="mute" style="font-size:12.5px">按难度从易到难</span></div>
    <div class="grid c4 case-grid" id="csGrid"></div>`;

  const grid = $('#csGrid', view);
  grid.innerHTML = all.slice().sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1)).map((c) => caseCard(c, { done: done.has(c.id) })).join('');
  const cards = () => $$('.case-card', grid);
  const byId = Object.fromEntries(all.map((c) => [c.id, c]));

  const apply = (animate = true) => {
    const st = animate ? motion.flipState(cards()) : null;
    const q = f.q.trim().toLowerCase();
    let n = 0;
    cards().forEach((el) => {
      const c = byId[el.dataset.id];
      const ok = (f.cat === 'all' || c.category === f.cat)
        && matchBoard(c)
        && (!f.diff || c.difficulty === f.diff)
        && (!f.sim || c.sim)
        && (!f.tag || (c.tags || []).includes(f.tag))
        && (!q || [c.title, c.sub, ...(c.tags || []), catName(c.category)].join(' ').toLowerCase().includes(q));
      el.hidden = !ok; if (ok) n++;
    });
    $('#csCount', view).textContent = n ? `${n} 个案例` : '';
    let em = $('#csEmpty', view);
    if (!n) { if (!em) { grid.insertAdjacentHTML('afterend', `<div id="csEmpty" class="card">${empty({ title: '没有符合条件的案例', text: '换个筛选试试，或者回工作台直接说想做什么，AI 帮你写。', action: '<button class="btn" id="csReset">清空筛选</button>' })}</div>`); $('#csReset', view).onclick = reset; } }
    else if (em) em.remove();
    if (st) motion.flip(st);
  };
  const reset = () => { Object.assign(f, { q: '', cat: 'all', tag: '', diff: 0, board: 'all', sim: false }); $('#csQ', view).value = ''; syncUI(); apply(); };
  const syncUI = () => {
    $$('#csBoard button', view).forEach((b) => b.classList.toggle('on', b.dataset.v === f.board));
    $$('#csDiff button', view).forEach((b) => b.classList.toggle('on', +b.dataset.v === f.diff));
    $$('#csCat .chip', view).forEach((b) => b.classList.toggle('on', b.dataset.v === f.cat));
    $$('#csTag .chip', view).forEach((b) => b.classList.toggle('on', b.dataset.v === f.tag));
    $('#csSim', view).classList.toggle('on', f.sim);
  };
  $$('#csBoard button', view).forEach((b) => (b.onclick = () => { f.board = b.dataset.v; syncUI(); apply(); }));
  $$('#csDiff button', view).forEach((b) => (b.onclick = () => { f.diff = +b.dataset.v; syncUI(); apply(); }));
  $$('#csCat .chip', view).forEach((b) => (b.onclick = () => { f.cat = b.dataset.v; syncUI(); apply(); }));
  $$('#csTag .chip', view).forEach((b) => (b.onclick = () => { f.tag = f.tag === b.dataset.v ? '' : b.dataset.v; syncUI(); apply(); }));
  $('#csSim', view).onclick = () => { f.sim = !f.sim; syncUI(); apply(); };
  let tq; $('#csQ', view).addEventListener('input', (e) => { clearTimeout(tq); tq = setTimeout(() => { f.q = e.target.value; apply(); }, 160); });
  grid.addEventListener('click', (e) => { const a = e.target.closest('.case-card'); if (a) clientEvent('case_open', a.dataset.id); });

  apply(false);
  motion.reveal(view);
}
