/* 案例详情：接线图 + 元件清单 + 代码 + 三个大按钮（烧录 / 先仿真 / 让 AI 改一改）。 */
import { loadCase } from '../core/api.js';
import { state } from '../core/store.js';
import { esc, $, $$, stars, toast } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { coverSVG } from '../components/covers.js';
import { wiringSVG } from '../components/wiring.js';
import { codeBlock } from '../components/code.js';
import { catName, hotTag } from '../components/cards.js';
import { FAMILIES } from '../core/boards.js';
import { motion } from '../core/motion.js';
import { projectFromCase, activeBoard } from '../core/projects.js';
import { saveProject } from '../core/store.js';
import { go } from '../core/router.js';
import { clientEvent } from '../core/me.js';

export async function render(view, { id }) {
  view.innerHTML = `<div class="card skel" style="height:320px"></div>`;
  const c = await loadCase(id);
  if (!c) { view.innerHTML = `<div class="card" style="max-width:520px;margin:40px auto;text-align:center"><h3>没找到这个案例</h3><a class="btn" style="margin-top:14px" href="#/cases">回案例超市</a></div>`; return; }
  clientEvent('case_open', c.id);
  const live = activeBoard();
  let board = (live && c.boards.find((b) => b.family === live.family)) || c.boards[0];

  const buildOf = (fq) => c.build && c.build[fq];
  view.innerHTML = `
    <a class="back" href="#/cases">${icon('arrowL')}案例超市</a>
    <section class="case-hero">
      <div class="ch-cover card">${coverSVG(c.cover, 'd' + c.id)}${c.hot ? `<span class="cc-hot">${hotTag()}</span>` : ''}</div>
      <div class="ch-info">
        <div class="row wrap" style="gap:8px">${c.hot ? hotTag('本周热品') : ''}<span class="pill acc">${esc(catName(c.category))}</span>${stars(c.difficulty || 1)}<span class="pill">${icon('clock')}${c.minutes} 分钟</span><span class="pill">${icon('parts')}${c.parts.length} 个元件</span>${c.sim ? `<span class="pill ok">${icon('sim')}可仿真</span>` : ''}<span class="pill acc">+${c.xp || 30} XP</span></div>
        <h1>${esc(c.title)}</h1>
        <p class="lead">${esc(c.sub)}</p>
        <div class="eyebrow" style="margin:18px 0 10px">选择你的板子</div>
        <div class="board-pick" id="cdBoards">${c.boards.map((b) => boardBtn(b)).join('')}</div>
        <div class="ch-actions">
          <button class="btn primary xl" id="cdFlash">${icon('flash')}烧录到我的板子</button>
          ${c.sim ? `<button class="btn xl" id="cdSim">${icon('sim')}先仿真</button>` : ''}
          <button class="btn xl soft" id="cdAi">${icon('sparkles')}让 AI 改一改</button>
        </div>
        <p class="mute" id="cdHint" style="font-size:12.5px;margin-top:10px"></p>
      </div>
    </section>

    <div class="case-body">
      <div class="stack" style="gap:16px;min-width:0">
        <div class="card" data-rv><div class="card-h"><span class="chip-ic">${icon('wire')}</span><h3>接线图</h3><span class="grow"></span><span class="mute" style="font-size:12.5px" id="cdPinNote"></span></div>
          ${c.wiring && c.wiring.length ? `<div class="wiring-wrap" id="cdWire"></div>` : `<p class="mute">不需要接线，用板载元件就行。</p>`}
        </div>
        <div class="card" data-rv><div class="card-h"><span class="chip-ic">${icon('code')}</span><h3>代码</h3><span class="mute" style="font-size:12.5px">${c.code.split('\n').length} 行 · 同一份代码适配所有列出的板子</span><span class="grow"></span><button class="btn sm" id="cdCopy">${icon('copy')}复制</button></div>
          ${codeBlock(c.code)}
        </div>
      </div>
      <aside class="stack" style="gap:16px">
        <div class="card" data-rv><div class="card-h"><span class="chip-ic">${icon('parts')}</span><h3>元件清单</h3></div>
          <ul class="bom">${c.parts.map((p) => `<li><span class="bom-q num">×${p.qty}</span><span>${esc(p.nm)}</span></li>`).join('')}</ul>
          ${c.libraries && c.libraries.length ? `<div class="eyebrow" style="margin:14px 0 8px">用到的库</div><div class="chips">${c.libraries.map((l) => `<a class="chip" href="#/libs?q=${encodeURIComponent(l.name || l)}">${icon('book')}${esc(l.name || l)}</a>`).join('')}</div><p class="mute" style="font-size:12px;margin-top:8px">缺的库编译时会自动装。</p>` : ''}
        </div>
        ${c.learn && c.learn.length ? `<div class="card" data-rv><div class="card-h"><span class="chip-ic">${icon('book')}</span><h3>做完你会知道</h3></div><ul class="learn">${c.learn.map((t) => `<li>${icon('check')}${esc(t)}</li>`).join('')}</ul></div>` : ''}
        ${c.aiIdeas && c.aiIdeas.length ? `<div class="card hero" data-rv><div class="card-h"><span class="chip-ic">${icon('sparkles')}</span><h3>再改一点点</h3></div><div class="stack" style="gap:8px">${c.aiIdeas.map((t) => `<button class="idea" data-idea="${esc(t)}">${icon('sparkles')}<span>${esc(t)}</span>${icon('arrowR')}</button>`).join('')}</div></div>` : ''}
        <div class="card" data-rv><div class="card-h"><span class="chip-ic">${icon('shield')}</span><h3>验证记录</h3></div><div id="cdBuild"></div></div>
      </aside>
    </div>`;

  function boardBtn(b) {
    const bl = buildOf(b.fqbn);
    const isLive = live && live.family === b.family;
    return `<button class="bp ${b === board ? 'on' : ''}" data-fq="${esc(b.fqbn)}" style="--fam:${FAMILIES[b.family].color}"><span class="fam ${b.family}">${FAMILIES[b.family].nm}</span><b>${esc(b.nm)}</b>${isLive ? '<span class="bp-live"><i class="dot ok"></i>已插上</span>' : ''}${bl && bl.ok ? `<span class="bp-ok" title="编译通过">${icon('check')}</span>` : ''}</button>`;
  }
  const paintBoard = () => {
    $$('#cdBoards .bp', view).forEach((b) => b.classList.toggle('on', b.dataset.fq === board.fqbn));
    const fam = board.family;
    const note = c.pinNotes && (c.pinNotes[board.fqbn.includes('s3') ? 'esp32s3' : fam] || c.pinNotes[fam]);
    $('#cdPinNote', view).textContent = note || '';
    const w = $('#cdWire', view); if (w) w.innerHTML = wiringSVG(c.wiring, { family: fam, boardName: board.nm });
    const lv = live && live.family === fam;
    $('#cdHint', view).innerHTML = lv ? `${icon('usb')} 检测到 ${esc(live.nm)}（${esc(live.com)}），点「烧录」会先自动备份板上原来的程序。`
      : state.hwDemo ? '本机桥接没连上：可以先仿真，或下载 Windows 版后再烧录。' : `还没插上 ${FAMILIES[fam].nm}。插上后点「烧录」即可${c.sim ? '，或者先仿真看效果' : ''}。`;
    const bl = buildOf(board.fqbn);
    $('#cdBuild', view).innerHTML = bl ? `<div class="kv"><span>板子</span><b>${esc(board.nm)}</b><span>编译</span><b>${bl.ok ? '<span class="ok-txt">通过</span>' : '<span class="err-txt">未通过</span>'}${bl.seconds ? ` · ${bl.seconds}s` : ''}</b>
      ${bl.flash ? `<span>Flash</span><b class="num">${(bl.flash / 1024).toFixed(1)} KB / ${(bl.flashMax / 1024).toFixed(0)} KB</b>` : ''}${bl.ram != null ? `<span>内存</span><b class="num">${bl.ram} / ${bl.ramMax} B</b>` : ''}</div>
      ${bl.flash ? `<div class="bar" style="margin-top:10px"><i style="--p:${Math.min(1, bl.flash / bl.flashMax)}"></i></div>` : ''}`
      : '<p class="mute" style="font-size:13px">这块板的验证结果还在生成中。</p>';
  };
  $$('#cdBoards .bp', view).forEach((b) => (b.onclick = () => { board = c.boards.find((x) => x.fqbn === b.dataset.fq); paintBoard(); }));
  paintBoard();

  const open = (action, extra = {}) => {
    const lv = activeBoard();
    const pj = projectFromCase(c, { fqbn: board.fqbn, com: lv && lv.family === board.family ? lv.com : '' });
    if (extra.task) saveProject({ ...pj, pendingTask: extra.task, task: extra.task });
    if (action) saveProject({ ...pj, ...(extra.task ? { pendingTask: extra.task, task: extra.task } : {}), pendingAction: action });
    go('/project/' + pj.id);
  };
  $('#cdFlash', view).onclick = () => open('flash');
  const sb = $('#cdSim', view); if (sb) sb.onclick = () => open('sim');
  $('#cdAi', view).onclick = () => open('', { task: '' });
  $$('[data-idea]', view).forEach((b) => (b.onclick = () => open('', { task: b.dataset.idea })));
  $('#cdCopy', view).onclick = async () => { try { await navigator.clipboard.writeText(c.code); toast('代码已复制', 'ok'); } catch (e) { toast('复制失败，请手动选择', 'warn'); } };
  motion.reveal(view);
}
