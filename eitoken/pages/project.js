/* 项目工作台（MCU 专用）：代码 → 编译 → 烧录 → 串口 → 仿真，右侧 AI 助手 / 串口监视器 / 备份。
   这里没有任何 ROS 控件。编译烧录结果完全以桥接为准。 */
import { state, subscribe, getProject, saveProject } from '../core/store.js';
import { bridge, generate, loadCase, auth } from '../core/api.js';
import { esc, $, $$, toast, confirmBox, sleep } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { editor } from '../components/code.js';
import { createRunner } from '../components/runner.js';
import { FAMILIES, BOARDS, boardByFqbn } from '../core/boards.js';
import { motion } from '../core/motion.js';
import { forwardXp, clientEvent } from '../core/me.js';
import { openTopup } from '../components/billing.js';
import { openLogin } from '../components/login.js';
import { tipFor } from './onboarding.js';

const STEPS = [['code', '代码', 'code'], ['build', '编译', 'cpu'], ['flash', '烧录', 'flash'], ['serial', '串口', 'serial'], ['sim', '仿真', 'sim']];
const BAUDS = [9600, 57600, 115200, 230400, 460800];

export async function render(view, { id }) {
  let pj = getProject(id);
  if (!pj && id === 'demo') {
    const c = await loadCase('blink');
    pj = saveProject({ id: 'demo', title: '闪烁 LED（示例项目）', caseId: 'blink', code: c ? c.code : '', family: 'avr', fqbn: 'arduino:avr:uno', com: '', created: Date.now() });
  }
  if (!pj) { view.innerHTML = `<div class="card" style="max-width:520px;margin:40px auto;text-align:center"><h3>项目不存在</h3><p class="mute" style="margin:8px 0 14px">可能在另一台电脑上创建的（项目保存在本机）。</p><a class="btn" href="#/projects">我的项目</a></div>`; return; }
  const status = { code: pj.code ? 'ok' : '', build: '', flash: '', serial: '', sim: '' };
  let ed, runner, serialTimer = null, serialCom = '', serialSeq = 0, genCtl = null;
  const save = (patch) => { pj = saveProject({ ...pj, ...patch }); };
  const caseMeta = pj.caseId ? await loadCase(pj.caseId) : null;

  view.innerHTML = `
  <div class="pj-head">
    <div class="grow" style="min-width:0">
      <div class="row" style="gap:8px"><a class="back" href="#/projects" style="margin:0">${icon('arrowL')}项目</a>${pj.caseId ? `<a class="pill acc" href="#/cases/${pj.caseId}">${icon('store')}来自案例</a>` : ''}</div>
      <input class="pj-title" id="pjTitle" value="${esc(pj.title || '未命名项目')}" aria-label="项目名称">
    </div>
    <div class="pj-target card flat">
      <div class="field"><label for="pjBoard">板子</label><select class="select" id="pjBoard">${boardOptions(pj.fqbn)}</select></div>
      <div class="field"><label for="pjPort">端口</label><select class="select" id="pjPort"></select></div>
    </div>
  </div>

  <nav class="stepper card flat" id="pjSteps" aria-label="进度">${STEPS.map(([k, n, ic], i) => `<button class="step" data-step="${k}">${i ? '<i class="step-line"></i>' : ''}<span class="step-dot">${icon(ic)}</span><span class="step-nm">${n}</span></button>`).join('')}</nav>

  <div class="pj-main">
    <div class="stack" style="gap:14px;min-width:0">
      <div class="card pj-editor">
        <div class="pj-toolbar">
          <span class="fam ${pj.family}" id="pjFam">${FAMILIES[pj.family] ? FAMILIES[pj.family].nm : ''}</span>
          <span class="mute mono" style="font-size:12px" id="pjSaved">已保存</span>
          <span class="grow"></span>
          <button class="btn" id="pjBuild">${icon('cpu')}编译</button>
          <button class="btn" id="pjSim">${icon('sim')}仿真</button>
          <button class="btn primary" id="pjFlash">${icon('flash')}烧录</button>
        </div>
        <div id="pjEd"></div>
      </div>
      <div class="card" id="pjRunCard" hidden><div id="pjRun"></div></div>
    </div>

    <aside class="card pj-side">
      <div class="seg pj-tabs" role="tablist">${[['ai', 'AI 助手', 'sparkles'], ['serial', '串口', 'serial'], ['backup', '备份', 'restore']].map(([k, n, ic], i) => `<button role="tab" data-tab="${k}" class="${i === 0 ? 'on' : ''}">${icon(ic)}${n}</button>`).join('')}</div>
      <div class="pj-tab" data-pane="ai">
        <div class="ai-log" id="aiLog"></div>
        <div class="ai-in">
          <textarea class="textarea" id="aiTask" rows="3" placeholder="${pj.code ? '想怎么改？例如：闪得快一倍，按键按住时常亮' : '描述要做的事，例如：超声波测距，距离小于 10cm 蜂鸣器响'}"></textarea>
          <div class="row" style="margin-top:8px"><span class="mute" style="font-size:12px">${auth.loggedIn() ? '按实际用量计费' : '生成需要登录'}</span><span class="grow"></span><button class="btn primary" id="aiGo">${icon('send')}${pj.code ? '改代码' : '生成'}</button></div>
        </div>
      </div>
      <div class="pj-tab" data-pane="serial" hidden>
        <div class="row wrap" style="gap:8px"><select class="select" id="srBaud" style="width:auto">${BAUDS.map((b) => `<option ${b === 115200 ? 'selected' : ''}>${b}</option>`).join('')}</select>
          <button class="btn primary sm" id="srOpen">${icon('play')}打开</button><span class="grow"></span><button class="btn ghost sm" id="srReset" title="复位板子，看开机打印">${icon('refresh')}复位</button><button class="btn ghost sm" id="srClear">清空</button></div>
        <div class="mute" id="srHeld" style="font-size:12px;min-height:0"></div>
        <div class="log serial-log" id="srLog" aria-live="off"><span class="s-mute">打开串口后，板子打印的内容会出现在这里。烧录时会自动让出串口，烧完自动重开。</span></div>
        <form class="row" id="srForm" style="gap:8px;margin-top:8px"><input class="input mono" id="srIn" placeholder="发送一行…" autocomplete="off"><button class="btn sm" type="submit">${icon('send')}</button></form>
      </div>
      <div class="pj-tab" data-pane="backup" hidden>
        <p class="mute" style="font-size:13px">每块板第一次烧录前，平台都会自动把原来的程序整片备份。想回到原样，点「还原」。</p>
        <div id="bkList" style="margin-top:12px"></div>
      </div>
    </aside>
  </div>`;

  /* 编辑器 */
  let saveT;
  ed = editor($('#pjEd', view), pj.code || emptySketch(), { onChange: (v) => {
    $('#pjSaved', view).textContent = '编辑中…'; clearTimeout(saveT);
    saveT = setTimeout(() => { save({ code: v }); $('#pjSaved', view).textContent = '已保存'; }, 500);
    status.code = v.trim() ? 'ok' : ''; status.build = ''; paintSteps();
  } });
  $('#pjTitle', view).addEventListener('change', (e) => save({ title: e.target.value.trim() || '未命名项目' }));

  /* 板子 / 端口 */
  const paintPorts = () => {
    const sel = $('#pjPort', view); if (!sel) return;
    const ports = state.hw.filter((d) => d.kind === 'serial' && !d.demo);
    const cur = pj.com;
    sel.innerHTML = (ports.length ? '' : '<option value="">没有检测到板子</option>') + ports.map((d) => `<option value="${esc(d.com)}" ${d.com === cur ? 'selected' : ''}>${esc(d.com)} · ${esc(d.nm)}</option>`).join('');
    if (!cur && ports.length) {
      const match = ports.find((d) => d.family === pj.family) || ports[0];
      sel.value = match.com; save({ com: match.com }); detectBoard(match.com);
    }
  };
  /* 用桥接识别结果（含 ESP32 板选项）校正 fqbn；只读缓存，不会复位板子 */
  const detected = new Set();
  async function detectBoard(com) {
    if (!com || detected.has(com)) return;
    detected.add(com);
    const r = await bridge.get('/api/mcu/board?com=' + encodeURIComponent(com), { timeout: 15000 });
    if (!r.ok || !r.fqbn || r.source === 'default' || !view.isConnected) return;
    if (r.fqbn === pj.fqbn) return;
    const sameBase = r.fqbn.split(':').slice(0, 3).join(':') === String(pj.fqbn).split(':').slice(0, 3).join(':');
    if (pj.family && r.family && r.family !== pj.family && pj.code) {
      toast(`${com} 上是 ${esc((r.board && r.board.nm) || r.fqbn)}，和当前代码的板子不同，可在「板子」里切换`, 'warn', { ms: 5000 });
      return;
    }
    save({ fqbn: r.fqbn, family: r.family || pj.family });
    $('#pjBoard', view).innerHTML = boardOptions(pj.fqbn, r.board && r.board.nm);
    $('#pjFam', view).className = 'fam ' + pj.family; $('#pjFam', view).textContent = FAMILIES[pj.family].nm;
    if (!sameBase) toast(`已按检测到的板子设置：${esc((r.board && r.board.nm) || r.fqbn)}`, 'ok');
  }
  paintPorts();
  if (pj.com) detectBoard(pj.com);
  $('#pjPort', view).onchange = (e) => { save({ com: e.target.value }); detectBoard(e.target.value); };
  $('#pjBoard', view).onchange = (e) => {
    const b = boardByFqbn(e.target.value); save({ fqbn: e.target.value, family: b ? b.family : pj.family });
    $('#pjFam', view).className = 'fam ' + pj.family; $('#pjFam', view).textContent = FAMILIES[pj.family].nm; status.build = ''; paintSteps();
  };

  /* 步骤条 */
  const paintSteps = () => $$('#pjSteps .step', view).forEach((b) => { b.className = 'step ' + (status[b.dataset.step] || ''); });
  paintSteps();
  $$('#pjSteps .step', view).forEach((b) => (b.onclick = () => {
    const k = b.dataset.step;
    if (k === 'build') $('#pjBuild', view).click(); else if (k === 'flash') $('#pjFlash', view).click();
    else if (k === 'sim') $('#pjSim', view).click(); else if (k === 'serial') tab('serial'); else ed.el.focus();
  }));

  /* 任务面板 */
  const showRunner = (title) => {
    $('#pjRunCard', view).hidden = false;
    runner = createRunner($('#pjRun', view), { title });
    $('#pjRunCard', view).scrollIntoView({ behavior: motion.on() ? 'smooth' : 'auto', block: 'nearest' });
    return runner;
  };
  const busy = (on) => ['#pjBuild', '#pjFlash', '#pjSim'].forEach((s) => { const b = $(s, view); if (b) b.disabled = on; });
  const needCode = () => { if (ed.get().trim()) return true; toast('还没有代码：让 AI 写一份，或从案例开始', 'warn'); tab('ai'); $('#aiTask', view).focus(); return false; };
  const meta = () => ({ caseId: pj.caseId || undefined, family: pj.family });
  // ESP32 首次编译约 7–8 分钟：本机没成功编译过 ESP32 时给一句提示
  const slowNote = () => {
    if (pj.family !== 'esp32') return '';
    try { if (localStorage.getItem('eit1.esp32Built') === '1') return ''; } catch (e) {}
    return 'ESP32 第一次编译要 7–8 分钟（要编译整个芯片支持包），之后只要几十秒。可以先去喝口水，页面别关。';
  };
  const markBuilt = (r) => { if (r.ok && pj.family === 'esp32') { try { localStorage.setItem('eit1.esp32Built', '1'); } catch (e) {} } };

  $('#pjBuild', view).onclick = async () => {
    if (!needCode()) return;
    busy(true); status.build = 'run'; paintSteps();
    const r = await showRunner('编译').run('/api/mcu/build', { code: ed.get(), fqbn: pj.fqbn, com: pj.com || undefined }, { meta: meta(), okText: '编译通过', startText: '准备编译…', note: slowNote(), expectStages: 3 });
    markBuilt(r); busy(false); status.build = r.ok ? 'ok' : 'err'; paintSteps();
    if (r.ok && r.size && r.size.flash) {
      const now = $('#pjRun .rn-now', view);
      if (now) now.insertAdjacentHTML('beforeend', `<div class="mute" style="font-size:12.5px;font-weight:400;margin-top:4px">占用 Flash ${(r.size.flash / 1024).toFixed(1)} KB / ${(r.size.flashMax / 1024).toFixed(0)} KB${r.size.ram != null && r.size.ramMax ? ` · 内存 ${r.size.ram} / ${r.size.ramMax} B` : ''}</div>`);
    }
    if (r.ok && r.buildId) save({ buildId: r.buildId, buildHash: hash(ed.get()), buildFqbn: pj.fqbn });
    if (!r.ok && !r.offline && !r.missing) clientEvent('build_err', pj.id + ':' + Date.now());
  };

  $('#pjFlash', view).onclick = async () => {
    if (!needCode()) return;
    if (!pj.com) { toast('先插上板子并选择端口', 'warn'); motion.shake($('.pj-target', view)); return; }
    // 串口监视器开着也没关系：桥接烧录前自动让出、烧完自动重开，轮询继续即可
    const wasSerial = serialCom === pj.com;
    busy(true); status.flash = 'run'; paintSteps();
    const fresh = pj.buildId && pj.buildHash === hash(ed.get()) && pj.buildFqbn === pj.fqbn;
    const body = { com: pj.com, fqbn: pj.fqbn, caseId: pj.caseId || undefined, ...(fresh ? { buildId: pj.buildId } : { code: ed.get() }) };
    const r = await showRunner('烧录到 ' + pj.com).run('/api/mcu/flash', body, { meta: meta(), okText: '烧录成功，板子已经在跑了', startText: fresh ? '准备烧录…' : '先编译再烧录…', note: fresh ? '' : slowNote(), expectStages: 4 });
    markBuilt(r); busy(false); status.flash = r.ok ? 'ok' : 'err'; if (r.ok) status.build = 'ok'; paintSteps();
    if (r.ok) { tab('serial'); if (!wasSerial) startSerial(pj.com); setTimeout(() => tipFor('serial'), 800); }
  };

  $('#pjSim', view).onclick = async () => {
    if (!needCode()) return;
    busy(true); status.sim = 'run'; paintSteps();
    const rn = showRunner('仿真');
    const r = await rn.run('/api/sim/wokwi/run', { code: ed.get(), fqbn: pj.fqbn, caseId: pj.caseId || undefined, expect: caseMeta && caseMeta.expect, timeoutMs: 20000 }, { meta: meta(), okText: '仿真跑通', startText: '编译并启动仿真…', note: slowNote() });
    markBuilt(r); busy(false); status.sim = r.ok ? 'ok' : 'err'; paintSteps();
    if (!r.ok && r.hint) { const h = $('#pjRun .rn-hints', view); if (h) h.insertAdjacentHTML('beforeend', `<div class="rn-hint"><span class="chip-ic">${icon('sparkles')}</span><span class="grow">${esc(typeof r.hint === 'string' ? r.hint : r.hint.s || '')}</span></div>`); }
    if (r.serial) { const log = $('#pjRun .rn-log', view); if (log) { (Array.isArray(r.serial) ? r.serial.map((x) => (typeof x === 'string' ? x : x.s || '')) : String(r.serial).split('\n')).forEach((l) => { const d = document.createElement('div'); d.className = 's-ok'; d.textContent = l; log.appendChild(d); }); $('#pjRun details', view).open = true; } }
    if (r.ok && r.xp) forwardXp(r.xp, meta());
  };

  /* 标签页 */
  function tab(k) {
    $$('.pj-tabs button', view).forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
    $$('.pj-tab', view).forEach((p) => (p.hidden = p.dataset.pane !== k));
    if (k === 'backup') loadBackups();
  }
  $$('.pj-tabs button', view).forEach((b) => (b.onclick = () => tab(b.dataset.tab)));

  /* 串口监视器 */
  const srLog = $('#srLog', view);
  const addLine = (s, cls = '') => {
    if (srLog.querySelector('span.s-mute:only-child')) srLog.innerHTML = '';
    const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = s; srLog.appendChild(d);
    while (srLog.childElementCount > 800) srLog.firstChild.remove();
    srLog.scrollTop = srLog.scrollHeight;
  };
  async function startSerial(com) {
    if (!com) { toast('先选择端口', 'warn'); return; }
    const r = await bridge.post('/api/serial/open', { com, baud: +$('#srBaud', view).value });
    if (!r.ok) { addLine(r.status === 404 ? '桥接还没有串口监视器功能，请更新 EI TOKEN' : r.offline ? '本机桥接没连上' : ('打不开：' + (r.error || '')), 's-err'); return; }
    serialCom = com; serialSeq = 0; status.serial = 'ok'; paintSteps();
    $('#srOpen', view).innerHTML = `${icon('stop')}关闭`; $('#srOpen', view).classList.remove('primary');
    if (r.already) addLine(`── ${com} 已经打开 ──`, 's-mute');
    stopSerialPoll(false);
    serialTimer = setInterval(async () => {
      const q = await bridge.get(`/api/serial/poll?com=${encodeURIComponent(com)}&after=${serialSeq}`, { timeout: 4000 });
      if (!q.ok) return;
      (q.lines || []).forEach((l) => {
        serialSeq = Math.max(serialSeq, l.n);
        const cls = l.err ? 's-err' : l.sys ? 's-mute' : l.tx ? 's-tx' : '';
        const last = srLog.lastElementChild;
        // 半行（没换行）先显示，后续同一行到了就替换掉
        if (last && last.dataset.partial === '1') last.remove();
        if (l.tx) return;   // 自己发的行本地已经显示过
        addLine(l.sys ? `── ${l.s} ──` : l.s, cls);
        if (l.partial) srLog.lastElementChild.dataset.partial = '1';
      });
      const held = $('#srHeld', view); if (held) held.textContent = q.held ? `端口正被「${q.held}」占用，结束后自动恢复` : '';
    }, 400);
  }
  function stopSerialPoll(reset = true) { clearInterval(serialTimer); serialTimer = null; if (reset) { status.serial = ''; paintSteps(); } }
  $('#srOpen', view).onclick = async () => {
    if (serialTimer) {
      stopSerialPoll(); await bridge.post('/api/serial/close', { com: serialCom }); addLine(`── 已关闭 ${serialCom} ──`, 's-mute'); serialCom = '';
      $('#srOpen', view).innerHTML = `${icon('play')}打开`; $('#srOpen', view).classList.add('primary');
    } else startSerial(pj.com);
  };
  $('#srBaud', view).onchange = async (e) => { if (serialCom) { const r = await bridge.post('/api/serial/baud', { com: serialCom, baud: +e.target.value }); addLine(r.ok ? `── 波特率 ${e.target.value} ──` : '改波特率失败', r.ok ? 's-tx' : 's-err'); } };
  $('#srClear', view).onclick = () => { srLog.innerHTML = ''; };
  $('#srReset', view).onclick = async () => {
    const com = serialCom || pj.com; if (!com) { toast('先选择端口', 'warn'); return; }
    const r = await bridge.post('/api/serial/reset', { com });
    if (!r.ok) toast(r.status === 404 ? '桥接版本不支持复位' : esc(r.error || '复位失败'), 'err');
    else if (!serialCom) startSerial(com);
  };
  $('#srForm', view).onsubmit = async (e) => {
    e.preventDefault(); const v = $('#srIn', view).value; if (!serialCom) { toast('先打开串口', 'warn'); return; }
    const r = await bridge.post('/api/serial/send', { com: serialCom, data: v, eol: '\n' });
    addLine('› ' + v, r.ok ? 's-tx' : 's-err'); $('#srIn', view).value = '';
  };

  /* 备份 */
  async function loadBackups() {
    const box = $('#bkList', view);
    if (!pj.com) { box.innerHTML = '<p class="mute" style="font-size:13px">先插上板子。</p>'; return; }
    box.innerHTML = '<div class="skel" style="height:60px"></div>';
    const r = await bridge.get('/api/mcu/backups?com=' + encodeURIComponent(pj.com), { timeout: 8000 });
    if (!r.ok) { box.innerHTML = `<p class="mute" style="font-size:13px">${r.status === 404 ? '当前桥接版本还不支持备份列表。' : r.offline ? '本机桥接没连上。' : esc(r.error || '读取失败')}</p>`; return; }
    const items = r.items || [];
    box.innerHTML = items.length ? items.map((it) => `<div class="bk-row"><span class="chip-ic">${icon('shield')}</span><div class="grow" style="min-width:0"><b class="mono" style="font-size:12.5px;display:block;overflow:hidden;text-overflow:ellipsis">${esc(String(it.file).split(/[\\/]/).pop())}</b><span class="mute" style="font-size:12px">${new Date(it.ts).toLocaleString('zh-CN')} · ${(it.size / 1024).toFixed(0)} KB</span></div><button class="btn sm" data-restore="${esc(it.file)}">${icon('restore')}还原</button></div>`).join('')
      : '<p class="mute" style="font-size:13px">这块板还没有备份。第一次烧录时会自动备份。</p>';
    $$('[data-restore]', box).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('还原这份备份？', '板子上现在的程序会被这份备份覆盖。', { ok: '还原' }))) return;
      if (serialCom === pj.com) stopSerialPoll();
      busy(true);
      await showRunner('还原备份').run('/api/mcu/restore', { com: pj.com, file: b.dataset.restore }, { meta: meta(), okText: '已还原成原来的程序', expectStages: 3 });
      busy(false);
    }));
  }

  /* AI 助手 */
  const aiLog = $('#aiLog', view);
  const msgs = pj.messages || [];
  const paintAi = () => {
    aiLog.innerHTML = msgs.length ? msgs.map((m) => m.role === 'user'
      ? `<div class="ai-msg me">${esc(m.content)}</div>`
      : `<div class="ai-msg bot"><span class="chip-ic" style="width:26px;height:26px">${icon('sparkles')}</span><div>${esc(m.note || '已更新左边的代码')}</div></div>`).join('')
      : `<div class="ai-hello"><span class="chip-ic">${icon('sparkles')}</span><b>我按你板子的真实接口写代码</b><p>${caseMeta ? `这份代码来自「${esc(caseMeta.title)}」。说说想怎么改。` : '说清要做的事和接了什么元件，我来写 Arduino / ESP32 代码。'}</p>
        ${caseMeta && caseMeta.aiIdeas ? `<div class="stack" style="gap:6px;margin-top:10px">${caseMeta.aiIdeas.map((t) => `<button class="idea" data-idea="${esc(t)}">${icon('sparkles')}<span>${esc(t)}</span></button>`).join('')}</div>` : ''}</div>`;
    $$('[data-idea]', aiLog).forEach((b) => (b.onclick = () => { $('#aiTask', view).value = b.dataset.idea; $('#aiGo', view).click(); }));
    aiLog.scrollTop = aiLog.scrollHeight;
  };
  paintAi();
  $('#aiGo', view).onclick = async () => {
    const t = $('#aiTask', view).value.trim();
    if (!t) { $('#aiTask', view).focus(); return; }
    if (!auth.loggedIn()) { openLogin({ reason: '生成代码需要登录，按实际用量计费（新账号送 ¥5）。', onDone: () => $('#aiGo', view).click() }); return; }
    const go = $('#aiGo', view); go.disabled = true; go.innerHTML = '<i class="spin"></i>生成中';
    msgs.push({ role: 'user', content: t }); paintAi();
    const before = ed.get();
    const history = msgs.filter((m) => m.role === 'user').slice(0, -1).map((m) => ({ role: 'user', content: m.content }));
    if (before.trim()) history.push({ role: 'assistant', content: before });
    const kind = pj.family === 'esp32' ? 'esp32' : 'arduino';
    const context = [caseMeta ? `当前案例：${caseMeta.title}\n接线：${JSON.stringify(caseMeta.wiring)}` : '', `目标板：${pj.fqbn}`].filter(Boolean).join('\n');
    genCtl = new AbortController();
    const r = await generate({ task: t, kind, messages: history, context }, (txt) => { const code = txt.replace(/^```[a-zA-Z+]*\n?/, ''); if (code.trim()) ed.set(code); }, { signal: genCtl.signal });
    genCtl = null; go.disabled = false; go.innerHTML = `${icon('send')}改代码`;
    if (!r.ok) {
      ed.set(before); msgs.pop(); paintAi();
      if (r.needLogin) openLogin({ reason: '登录已过期，请重新登录。' });
      else if (r.lowBalance) openTopup({ reason: '额度不够这次生成了，充值后继续。' });
      else toast(esc(r.error || '生成失败'), 'err');
      return;
    }
    ed.set(r.code);
    const note = r.usage ? `已更新代码 · 本次 ¥${Number(r.usage.cny || r.usage.price || 0).toFixed(2)}` : '已更新代码';
    msgs.push({ role: 'assistant', note, content: '' });
    save({ code: r.code, messages: msgs.slice(-20), pendingTask: '' });
    status.code = 'ok'; status.build = ''; paintSteps(); paintAi();
    $('#aiTask', view).value = '';
    if (r.usage && typeof r.usage.balance === 'number') { const { set } = await import('../core/store.js'); set({ balance: r.usage.balance }); }
    toast('代码写好了，点「编译」检查一下', 'ok', { action: { label: '编译', run: () => $('#pjBuild', view).click() } });
  };

  /* 从别处带进来的动作 */
  if (pj.pendingTask) { $('#aiTask', view).value = pj.pendingTask; save({ pendingTask: '' }); setTimeout(() => $('#aiGo', view).click(), 300); }
  else if (pj.pendingTask === '' && !pj.code) { $('#aiTask', view).focus(); }
  if (pj.pendingAction) {
    const a = pj.pendingAction; save({ pendingAction: '' });
    setTimeout(() => {
      if (a === 'flash') { if (pj.com) $('#pjFlash', view).click(); else { toast('插上板子后点「烧录」', 'info'); motion.pop($('.pj-target', view)); } }
      if (a === 'sim') $('#pjSim', view).click();
    }, 400);
  }

  const unsub = subscribe((s, keys) => { if (keys.includes('hw')) paintPorts(); });
  return () => { unsub(); clearInterval(serialTimer); clearTimeout(saveT); genCtl && genCtl.abort(); if (serialCom) bridge.post('/api/serial/close', { com: serialCom }); };
}

function boardOptions(fq, detectedNm) {
  const known = BOARDS.some((b) => b.fqbn === fq);
  return (known || !fq ? '' : `<option value="${esc(fq)}" selected>${esc(detectedNm || (boardByFqbn(fq) || {}).nm || fq)}（检测到）</option>`)
    + BOARDS.map((b) => `<option value="${b.fqbn}" ${fq === b.fqbn ? 'selected' : ''}>${esc(b.nm)}</option>`).join('');
}
function emptySketch() {
  return `// 在右边告诉 AI 要做什么，或者直接写代码\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n}\n`;
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
