/* COS 开发平台 · 应用逻辑
   路由(hash): #/home  #/project/:id/(chat|devices|code|deploy)  #/devices  #/diagnose  #/templates  #/store  #/usage
   真实接口: 本机桥接 :8799 —— /api/health /api/run(流式) /api/launch /api/usage；没有桥接时走演示流程。 */
(() => {
const { PLATFORMS, isoSVG, estimate, fmtTok, ansiToHtml, sleep, PRICE } = window.COS_LEGACY;
const D = window.COS_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const platOf = id => PLATFORMS.find(p => p.id === id) || PLATFORMS[0];
const PHOTO_OK = {};   // id → 是否有实物照片(img/boards/<id>.jpg)

/* ───────── 状态(本地持久化) ───────── */
const LS = { get(k, d){ try{ const v = localStorage.getItem('cos.' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
             set(k, v){ try{ localStorage.setItem('cos.' + k, JSON.stringify(v)); }catch(e){} } };
const state = {
  theme: LS.get('theme', 'white'),
  model: LS.get('model', 'auto'),
  projects: D.projects.map(p => ({ ...p, chat: p.chat.slice(), files: { ...p.files } })).concat(LS.get('projects', [])),
  cart: LS.get('cart', []),
  bridge: null, provider: '', usage: null,
};
const saveUserProjects = () => LS.set('projects', state.projects.filter(p => p.user));

/* ───────── 主题 ───────── */
function applyTheme(t){
  state.theme = t; LS.set('theme', t);
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === t));
}
$('#themeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) applyTheme(b.dataset.theme); });
$('#themeBtn').onclick = () => { const o = ['white','black','cyber']; applyTheme(o[(o.indexOf(state.theme) + 1) % 3]); };

/* ───────── 工具 ───────── */
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }
function modal(html){ const r = $('#modalRoot'); r.innerHTML = `<div class="modal" id="modal"><div class="box">${html}</div></div>`;
  r.querySelector('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) r.innerHTML = ''; }); return r; }
function boardPic(p, cls = 'boardpic'){
  const img = `<img src="img/boards/${p.id}.jpg" alt="${esc(p.nm)}" onerror="this.remove()" onload="this.nextElementSibling&&(this.nextElementSibling.style.display='none')">`;
  return `<span class="${cls}">${img}${isoSVG(p.model, 56)}</span>`;
}
function modelSel(id = 'modelSel'){ return `<select id="${id}" class="sm">${D.models.map(m => `<option value="${m.id}" ${m.id === state.model ? 'selected' : ''}>${m.id === 'auto' ? '✦ ' : ''}${m.nm}</option>`).join('')}</select>`; }
function bindModel(el){ if (el) el.onchange = () => { state.model = el.value; LS.set('model', el.value); }; }
function yuan(n){ return '¥' + Number(n).toFixed(2); }

/* ───────── 桥接(真实) ───────── */
async function probeBridge(){
  for (const b of ['http://127.0.0.1:8799', 'http://localhost:8799']) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 900);
      const r = await fetch(b + '/api/health', { signal: ctl.signal }); clearTimeout(t);
      if (r.ok) { const j = await r.json(); state.bridge = b; state.provider = j.provider || '';
        $('#bridgeBadge').textContent = '已连接本机 · ' + (state.provider || '桥接'); $('#bridgeBadge').className = 'badge ok'; pullUsage(); return true; }
    } catch (e) {}
  }
  $('#bridgeBadge').textContent = '未连接本机（演示模式）'; $('#bridgeBadge').className = 'badge'; return false;
}
async function pullUsage(){
  if (!state.bridge) return;
  try { const j = await (await fetch(state.bridge + '/api/usage')).json();
    if (j && typeof j.hit === 'number') { state.usage = j; if (location.hash.startsWith('#/usage')) render(); } } catch (e) {}
}
/* 流式跑一条任务；onChunk(累计文本) */
async function runOnBridge(platform, task, onChunk){
  const r = await fetch(state.bridge + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, task }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || ('HTTP ' + r.status)); }
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); onChunk(buf); pullUsage(); }
  return buf;
}

/* ───────── 项目 ───────── */
const proj = id => state.projects.find(p => p.id === id);
function createProject(prompt, devIds){
  const id = 'p' + Date.now().toString(36);
  const devs = (devIds && devIds.length ? devIds : ['pi']).map((pid, i) => { const p = platOf(pid);
    return { id: 'd' + (i + 1), role: i === 0 ? '主控' : '执行端', plat: pid, conn: p.via === 'ssh' ? '网络连接' : '串口', env: p.rt, prog: `${pid}/main.py`, status: '未连接' }; });
  const p = { id, user: true, nm: (prompt || '新项目').slice(0, 12), ico: '🛠️', ver: 'v0.1', budget: 100, devices: devs,
    link: devs.length > 1 ? { a: devs[0].role, b: devs[1].role, proto: '待生成', ver: '—' } : null, modules: [], wiring: [], chat: [], files: {} };
  state.projects.push(p); saveUserProjects(); renderSidebar();
  location.hash = `#/project/${id}/chat`;
  if (prompt) setTimeout(() => sendMessage(p, prompt), 60);
  return p;
}
async function sendMessage(p, text){
  text = (text || '').trim(); if (!text) return;
  p.chat.push({ who: 'me', t: text, ts: '今天 ' + new Date().toTimeString().slice(0, 5) });
  if (state.bridge) {
    const m = { who: 'ai', term: `$ cos --target ${p.devices[0].plat} （本机执行）\n\n` }; p.chat.push(m); render();
    try { await runOnBridge(p.devices[0].plat, text, buf => { m.term = `$ cos --target ${p.devices[0].plat}\n\n` + buf; const el = $('#term-' + (p.chat.length - 1)); if (el) { el.innerHTML = ansiToHtml(m.term); el.scrollTop = el.scrollHeight; } }); }
    catch (e) { m.term += `\n✗ ${e.message}\n回退到演示模式…`; render(); await sleep(500); p.chat.pop(); demoPlan(p, text); }
  } else demoPlan(p, text);
  if (p.user) saveUserProjects(); render();
}
function demoPlan(p, text){
  const two = p.devices.length > 1;
  const est = estimate(text, platOf(p.devices[0].plat));
  p.chat.push({ who: 'ai', plan: two
      ? [`${p.devices[0].role}：接收指令并控制运动`, `${p.devices[1].role}：读取输入并发送指令`, '联合测试：检查通信、松杆停车与失联处理']
      : [`${p.devices[0].role}：生成主程序与驱动`, '自检：串口 / 引脚 / 供电', '在板上跑通一次'],
    applied: two ? '双设备遥控方案' : '单板任务方案', est: est ? `整体任务预计约 ${fmtTok(est.total)} 原始 Token · ${est.turns[0]}–${est.turns[1]} 轮` : '' });
}

/* ───────── 路由 ───────── */
function route(){
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [a, b, c] = h.split('/');
  if (a === 'project' && proj(b)) return { v: 'project', id: b, tab: c || 'chat' };
  return { v: ['devices','diagnose','templates','store','usage'].includes(a) ? a : 'home' };
}
function crumb(...parts){ $('#crumb').innerHTML = `<a href="#/home">⌂</a><i>›</i><span>工作空间</span>` + parts.map((x, i) => `<i>/</i>${i === parts.length - 1 ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`}`).join(''); }
function renderSidebar(){
  $('#projList').innerHTML = state.projects.map(p => `<a href="#/project/${p.id}/chat" data-route="project:${p.id}"><span class="ic">${p.ico}</span>${esc(p.nm)}</a>`).join('');
  const r = route(); const key = r.v === 'project' ? 'project:' + r.id : r.v;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.route === key));
}
window.addEventListener('hashchange', render);
$('#newBtn').onclick = () => { location.hash = '#/home'; setTimeout(() => $('#prompt') && $('#prompt').focus(), 50); };

function render(){
  renderSidebar();
  const r = route(); const v = $('#view');
  ({ home: vHome, project: vProject, devices: vDevices, diagnose: vDiagnose, templates: vTemplates, store: vStore, usage: vUsage })[r.v](v, r);
  window.scrollTo(0, 0);
}

/* ═══════════ 首页 ═══════════ */
let homeDevs = [];
function vHome(v){
  crumb('首页');
  v.innerHTML = `
  <div class="hero"><div class="h1">你想让机器人学会什么？</div><div class="sub">描述一个任务，连接设备，让想法运行起来</div></div>
  <div class="card prompt">
    <textarea id="prompt" placeholder="例如：用遥控器控制机器人，松开摇杆时停车"></textarea>
    <div class="bar">
      <button class="iconbtn" title="附件">📎</button>
      <button class="btn sm" id="addDev">🧩 添加设备 <span id="devCount" class="pill gray" ${homeDevs.length ? '' : 'hidden'}>${homeDevs.length}</span></button>
      <span class="est" id="est"></span>
      <span class="grow"></span>
      ${modelSel()}
      <button class="btn primary" id="create">▶ 创建项目</button>
    </div>
  </div>
  <div class="chips">${D.chips.map(c => `<button class="chip">${esc(c)}</button>`).join('')}</div>
  <div class="starters">${D.starters.map(s => `<button class="card starter" data-s="${s.id}"><span class="ic">${s.ico}</span><div><b>${esc(s.nm)}</b><span>${esc(s.sub)}</span></div></button>`).join('')}</div>
  <p class="center" style="margin-top:34px"><a href="#/store">📁 导入已有工程</a>　·　<a href="#/store">🛒 去装置商城挑一台</a></p>
  <p class="foot-note">项目可连接一块或多块开发板 · 本机装了 COS Code 桥接后，这里的每一步都会真跑在你的板子上</p>`;
  bindModel($('#modelSel'));
  const ta = $('#prompt');
  const upd = () => { const e = estimate(ta.value, platOf(homeDevs[0] || 'pi')); $('#est').textContent = e ? `预计 ${fmtTok(e.total)} tokens · ${e.turns[0]}–${e.turns[1]} 轮 · ≈¥${e.cost.toFixed(3)}` : ''; };
  ta.oninput = upd;
  v.querySelectorAll('.chip').forEach(c => c.onclick = () => { ta.value = c.textContent; upd(); ta.focus(); });
  v.querySelectorAll('.starter').forEach(b => b.onclick = () => { const s = D.starters.find(x => x.id === b.dataset.s); ta.value = s.prompt; upd(); ta.focus(); });
  $('#create').onclick = () => createProject(ta.value.trim(), homeDevs);
  $('#addDev').onclick = () => pickDevices(sel => { homeDevs = sel; $('#devCount').textContent = sel.length; $('#devCount').hidden = !sel.length; upd(); });
}
function pickDevices(done, preset = homeDevs){
  const sel = new Set(preset);
  const r = modal(`<div class="hd"><b class="h3">添加设备</b><span class="badge">${PLATFORMS.length} 块板 · 可多选</span><span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd"><div class="boards" style="margin-top:0">
      ${['ser','ssh'].map(via => `<div class="grp">${via === 'ser' ? '单片机 · 串口烧录' : 'Linux 板 · SSH'}</div>` +
        PLATFORMS.filter(p => p.via === via).map(p => `<button class="card board ${sel.has(p.id) ? 'sel' : ''}" data-id="${p.id}"><div class="pic">${boardPic(p, 'boardpic')}</div><b>${esc(p.nm)}</b><div class="ch">${esc(p.ch)}</div><div class="role">${esc(p.role)}</div></button>`).join('')).join('')}
    </div><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn primary" id="pickOk">确定（<span id="pickN">${sel.size}</span>）</button></div></div>`);
  r.querySelectorAll('.board').forEach(b => b.onclick = () => { const id = b.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); b.classList.toggle('sel'); b.style.borderColor = sel.has(id) ? 'var(--acc)' : ''; r.querySelector('#pickN').textContent = sel.size; });
  r.querySelector('#pickOk').onclick = () => { done([...sel]); r.innerHTML = ''; };
}

/* ═══════════ 项目 ═══════════ */
function vProject(v, r){
  const p = proj(r.id); const tab = r.tab;
  crumb(p.nm, { chat: '对话', devices: '设备', code: '源代码', deploy: '部署与联调' }[tab]);
  const tabs = `<div class="tabs">${[['chat','对话'],['devices','设备'],['code','源代码'],['deploy','部署与联调']].map(([k, n]) => `<a href="#/project/${p.id}/${k}" class="${tab === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
  const head = `<div class="phead"><span class="ic">${p.ico}</span><div><div class="h1">${esc(p.nm)}</div><div class="sub">${p.devices.length} 个设备 · 项目 ${p.ver}</div></div></div>`;
  v.innerHTML = head + tabs + `<div id="tabBody"></div>`;
  ({ chat: tChat, devices: tDevices, code: tCode, deploy: tDeploy })[tab]($('#tabBody'), p);
}
function devCard(p, d, i){
  const pl = platOf(d.plat);
  return `<div class="card devcard">
    <div class="top2">${boardPic(pl)}<div class="grow"><b>${esc(d.role)}</b><div class="meta"><span>${esc(pl.nm)}</span>
      <span><i class="dot ${d.status === '已连接' ? '' : 'off'}"></i> ${esc(d.status)}</span><span>🐍 ${esc(d.env)}</span><span>${pl.via === 'ssh' ? '📶' : '🔌'} ${esc(d.conn)}</span></div></div>
      <button class="iconbtn">⋯</button></div>
    <a class="btn sm" href="#/project/${p.id}/code">&lt;/&gt; 查看源码</a></div>`;
}
function tChat(v, p){
  v.innerHTML = `<div class="two"><div>
    <div class="card chat" id="chat">${p.chat.length ? p.chat.map((m, i) => m.who === 'me'
      ? `<div class="msg me"><div><div class="bub">${esc(m.t)}</div><div class="ts">${esc(m.ts || '')}</div></div></div>`
      : m.term
        ? `<div class="msg"><span class="av">C</span><div class="grow" style="max-width:100%"><div class="term" id="term-${i}">${ansiToHtml(m.term)}</div></div></div>`
        : `<div class="msg"><span class="av">C</span><div class="bub">我会为${p.devices.length > 1 ? '两个设备' : '这块板'}生成配套程序。
            <ul class="plan">${m.plan.map(s => `<li><span class="ck">✓</span>${esc(s)}</li>`).join('')}</ul>
            <div class="applied">📖 已应用：<b>${esc(m.applied)}</b> <span class="grow"></span><a href="#/templates">查看开发依据</a></div>
            <div class="row"><button class="btn primary sm" data-gen>▶ 生成配套程序</button><button class="btn sm" data-adjust>⚙ 调整方案</button></div>
            <div class="sub" style="font-size:13px">${esc(m.est || '')}</div></div></div>`).join('')
      : `<div class="sub center" style="margin:auto">描述你希望实现的功能，COS 会先给方案，再生成配套程序。</div>`}</div>
    <div class="card composer"><textarea id="say" placeholder="继续描述你希望实现的功能…"></textarea>
      <div class="row"><button class="iconbtn">📎</button><span class="grow"></span>${modelSel('modelSel2')}<button class="btn primary" id="send">▶ 发送</button></div></div>
  </div><div>
    <div class="card pad"><div class="row"><b class="h3">本项目设备</b><span class="grow"></span><button class="btn link" id="addDev2">＋ 添加</button></div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">${p.devices.map((d, i) => devCard(p, d, i)).join('')}</div></div>
    <div class="card budget" style="margin-top:16px"><div class="row"><b class="h3">任务预算上限</b><span class="grow"></span><span class="sub" style="margin:0;font-size:13px">可修改</span></div>
      <input id="budget" value="¥${Number(p.budget).toFixed(2)}" style="margin-top:10px"><div class="sub" style="font-size:12.5px">金额为界面示例</div></div>
  </div></div>`;
  bindModel($('#modelSel2'));
  const send = () => { const t = $('#say').value; $('#say').value = ''; sendMessage(p, t); };
  $('#send').onclick = send; $('#say').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };
  $('#budget').onchange = e => { p.budget = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; e.target.value = '¥' + p.budget.toFixed(2); if (p.user) saveUserProjects(); };
  $('#addDev2').onclick = () => pickDevices(sel => { sel.forEach(id => { if (!p.devices.some(d => d.plat === id)) { const pl = platOf(id); p.devices.push({ id: 'd' + (p.devices.length + 1), role: pl.role, plat: id, conn: pl.via === 'ssh' ? '网络连接' : '串口', env: pl.rt, prog: `${id}/main.py`, status: '未连接' }); } }); if (p.user) saveUserProjects(); render(); }, p.devices.map(d => d.plat));
  v.querySelectorAll('[data-gen]').forEach(b => b.onclick = () => { if (!Object.keys(p.files).length) p.files = { ...D.projects[0].files }; toast('配套程序已生成 → 源代码'); location.hash = `#/project/${p.id}/code`; });
  v.querySelectorAll('[data-adjust]').forEach(b => b.onclick = () => $('#say').focus());
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
}
function tDevices(v, p){
  let sel = 1;
  const draw = () => {
    const d = p.devices[sel] || p.devices[0]; const pl = platOf(d.plat);
    v.innerHTML = `<div class="two" style="grid-template-columns:minmax(0,1fr) 340px">
    <div>
      <div class="row"><div><div class="h2">本项目设备</div><div class="sub">为每块设备指定角色，生成并部署对应程序</div></div><span class="grow"></span><button class="btn primary" id="addDev3">＋ 添加设备</button></div>
      <div class="devgrid">${p.devices.map((x, i) => { const q = platOf(x.plat); return `<div class="card devbig ${i === sel ? 'sel' : ''}" data-i="${i}">
        <div class="pic">${boardPic(q, 'boardpic')}</div>
        <div class="row"><b style="font-size:17px">${esc(x.role)}</b><span class="grow"></span><span class="pill ${x.status === '已连接' ? 'ok' : 'gray'}">● ${esc(x.status)}</span></div>
        <div class="sub" style="margin-top:0">${esc(q.nm)}</div>
        <div class="kv" style="margin-top:12px"><span>角色</span><div>${esc(x.role)}</div><span>连接</span><div>${esc(x.conn)}</div><span>环境</span><div>${esc(x.env)}</div><span>项目程序</span><div class="mono">${esc(x.prog)}</div></div>
        <div class="row" style="margin-top:14px"><a class="btn sm" href="#/project/${p.id}/code">&lt;/&gt; 查看源码</a><span class="grow"></span><button class="btn sm">${x.status === '已连接' ? '⛓ 断开连接' : '🔗 连接'}</button></div></div>`; }).join('')}</div>
      ${p.link ? `<div class="h3" style="margin-top:22px">设备协作</div><div class="card coop"><b>${esc(p.link.a)}</b><span class="arrow">⟷</span><b>${esc(p.link.b)}</b><span class="pill">${esc(p.link.proto)}</span><span class="pill gray">${esc(p.link.ver)}</span><span class="grow"></span><button class="btn sm">📄 查看协议</button></div>` : ''}
      <div class="h3" style="margin-top:22px">已关联模块</div>
      <div class="card" style="margin-top:10px;overflow:hidden"><table class="tb"><thead><tr><th>模块名称</th><th>关联设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${p.modules.length ? p.modules.map(m => `<tr><td>${esc(m.nm)}</td><td>${esc(m.dev)}</td><td><span class="pill ${m.st === '已配置' ? 'ok' : 'warn'}">● ${esc(m.st)}</span></td><td>—</td></tr>`).join('') : `<tr><td colspan="4" class="sub">还没有关联模块，在对话里描述硬件后自动出现</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="card wire">
      <div class="row"><b class="h3" style="font-size:18px">${esc(d.role)}</b><span class="grow"></span><span class="pill ${d.status === '已连接' ? 'ok' : 'gray'}">● ${esc(d.status)}</span></div>
      <div class="kv" style="margin-top:14px"><span>设备型号</span><div>${esc(pl.nm)}</div><span>连接方式</span><div>${esc(d.conn)}</div><span>运行环境</span><div>${esc(d.env)}</div><span>烧录/部署</span><div class="mono" style="font-size:12.5px">${esc(pl.tool)}</div></div>
      ${p.wiring.length ? `<div class="warnbox">❗ 还有 ${p.wiring.length} 项接线信息待确认</div>` + p.wiring.map(w => `<label>${esc(w.nm)}</label><select><option>请选择已验证配置</option>${w.opts.map(o => `<option>${esc(o)}</option>`).join('')}</select>`).join('') + `<p style="margin-top:12px"><a href="#/templates">🔗 查看接线参考</a></p>` : `<p class="sub" style="margin-top:14px">接线信息已确认</p>`}
      <button class="btn primary" style="width:100%;margin-top:18px;justify-content:center" id="confirmWire">确认设备配置</button>
    </div></div>`;
    v.querySelectorAll('.devbig').forEach(b => b.onclick = e => { if (e.target.closest('a,button')) return; sel = +b.dataset.i; draw(); });
    $('#confirmWire').onclick = () => { p.modules.forEach(m => m.st = '已配置'); p.wiring = []; if (p.user) saveUserProjects(); toast('设备配置已确认'); draw(); };
    $('#addDev3').onclick = () => pickDevices(s => { s.forEach(id => { if (!p.devices.some(x => x.plat === id)) { const q = platOf(id); p.devices.push({ id: 'd' + (p.devices.length + 1), role: q.role, plat: id, conn: q.via === 'ssh' ? '网络连接' : '串口', env: q.rt, prog: `${id}/main.py`, status: '未连接' }); } }); if (p.user) saveUserProjects(); draw(); }, p.devices.map(x => x.plat));
  };
  draw();
}
/* 简易高亮 */
function hl(code){
  return esc(code).split('\n').map((ln, i) => {
    let s = ln.replace(/(#.*|\/\/.*)$/, '<span class="cm">$1</span>')
      .replace(/\b(import|from|while|try|except|as|def|return|if|else|for|in|True|False|None|const|let|function|include|void|int|float)\b/g, '<span class="kw">$1</span>')
      .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|f&quot;.*?&quot;)/g, '<span class="str">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');
    return `<div class="ln ${/TIMEOUT_SECONDS = /.test(ln) ? 'add' : ''}"><span class="n">${i + 1}</span><span>${s || ' '}</span></div>`; }).join('');
}
function tCode(v, p){
  const files = Object.keys(p.files); let cur = files[0] || '';
  const tree = () => { const dirs = {}; files.forEach(f => { const [d, n] = f.includes('/') ? f.split('/') : ['', f]; (dirs[d] = dirs[d] || []).push(f); });
    return Object.entries(dirs).map(([d, fs]) => (d ? `<div class="dir">📁 ${esc(d)}</div>` : '') + fs.map(f => `<div class="f ${f === cur ? 'on' : ''}" data-f="${esc(f)}">📄 ${esc(f.split('/').pop())}</div>`).join('')).join(''); };
  const draw = () => {
    v.innerHTML = `<div class="codebar"><span class="lbl">目标设备</span><select>${p.devices.map(d => `<option>${esc(d.role)}</option>`).join('')}</select>
      <span class="lbl">编程语言</span><select><option>🐍 Python</option><option>C / C++</option><option>MicroPython</option></select>
      <span class="lbl">版本</span><select><option>${esc(p.ver)}</option></select><span class="grow"></span>
      <button class="btn" id="exportBtn">⬆ 导出工程</button><a class="btn primary" href="#/project/${p.id}/deploy">▶ 部署到设备</a></div>
    <div class="ide">
      <div class="card tree"><div class="hd">项目文件</div>${files.length ? tree() : `<div class="sub" style="padding:8px 16px">还没有文件，先在「对话」里生成配套程序</div>`}</div>
      <div class="card editor"><div class="tabs2"><span class="on">📄 ${esc(cur || '—')}</span></div><div class="code">${cur ? hl(p.files[cur]) : ''}</div>
        <div class="ft"><span>› 日志</span><span class="grow"></span><span>🐍 Python</span><span>UTF-8</span><span>${esc(p.devices[0].role)}</span></div></div>
      <div class="card aipanel"><div class="row"><b class="h3">✦ AI 修改</b><span class="grow"></span><button class="iconbtn">⋯</button></div>
        <div id="aiLog"><div class="sub" style="font-size:13px">对这段程序提要求，例如"把失联停车时间改为 300 毫秒"。${state.bridge ? '已连接本机，会真改。' : '演示模式下会展示待确认的差异。'}</div></div>
        <textarea id="aiIn" placeholder="继续修改这段程序…" style="width:100%;min-height:70px;margin-top:10px"></textarea>
        <div class="row" style="margin-top:8px"><button class="iconbtn">📎</button><span class="grow"></span><button class="btn primary sm" id="aiGo">➤</button></div></div>
    </div>`;
    v.querySelectorAll('.f').forEach(f => f.onclick = () => { cur = f.dataset.f; draw(); });
    $('#exportBtn').onclick = () => { const blob = new Blob([files.map(f => `# ==== ${f} ====\n${p.files[f]}\n`).join('\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.nm}-工程.txt`; a.click(); };
    $('#aiGo').onclick = async () => {
      const q = $('#aiIn').value.trim(); if (!q) return; $('#aiIn').value = '';
      const log = $('#aiLog'); log.insertAdjacentHTML('beforeend', `<div class="q">${esc(q)}</div>`);
      if (state.bridge) { const t = document.createElement('div'); t.className = 'term'; log.appendChild(t);
        try { await runOnBridge(p.devices[0].plat, `修改 ${cur}：${q}`, b => { t.innerHTML = ansiToHtml(b); t.scrollTop = t.scrollHeight; }); } catch (e) { t.innerHTML += `\n✗ ${esc(e.message)}`; } return; }
      log.insertAdjacentHTML('beforeend', `<div class="a">已更新相关设置，并检查两端协议兼容性。</div><div class="pending"><div class="row"><b>▾ 2 个文件待确认</b></div><div class="f"><span>${esc(cur)}</span><b>+1 行</b></div><div class="f"><span>shared/protocol.json</span><b>+2 行</b></div>
        <div class="row" style="margin-top:8px"><button class="btn sm">查看差异</button><button class="btn primary sm" data-apply>应用修改</button></div></div>`);
      log.querySelector('[data-apply]').onclick = () => { const m = q.match(/(\d+)\s*毫秒/); if (m && cur && /TIMEOUT_SECONDS = /.test(p.files[cur])) { p.files[cur] = p.files[cur].replace(/TIMEOUT_SECONDS = [\d.]+/, `TIMEOUT_SECONDS = ${(+m[1] / 1000)}`); if (p.user) saveUserProjects(); } toast('修改已应用'); draw(); };
      log.scrollTop = log.scrollHeight;
    };
  };
  draw();
}
function tDeploy(v, p){
  v.innerHTML = `<div class="two" style="grid-template-columns:minmax(0,1fr) 340px">
    <div><div class="row" style="margin-top:6px"><div><div class="h2">部署与联调</div><div class="sub">把当前工程推到每块板上，看启动日志，再联调</div></div><span class="grow"></span>
      <button class="btn" id="launchBtn">🪟 另开 PowerShell</button><button class="btn primary" id="deployBtn">▶ 部署到全部设备</button></div>
      <div class="card term" id="dterm" style="margin-top:18px;min-height:280px;max-height:none"><span class="dim">$ 等待部署… ${state.bridge ? '（已连接本机，将真实执行）' : '（演示模式）'}</span></div></div>
    <div class="card pad"><b class="h3">联调清单</b><ul class="plan" id="steps">
      ${p.devices.map(d => `<li><span class="ck" style="background:var(--card2);color:var(--mute)">·</span>${esc(d.role)} · ${esc(platOf(d.plat).tool.split('/')[0].trim())} 推送</li>`).join('')}
      <li><span class="ck" style="background:var(--card2);color:var(--mute)">·</span>两端握手 · 协议 ${esc(p.link ? p.link.ver : '—')}</li>
      <li><span class="ck" style="background:var(--card2);color:var(--mute)">·</span>失联停车 · 松杆停车</li></ul></div></div>`;
  const term = $('#dterm'); const line = s => { term.insertAdjacentHTML('beforeend', `\n${s}`); term.scrollTop = term.scrollHeight; };
  const tick = i => { const ck = $('#steps').children[i].querySelector('.ck'); ck.style.background = 'var(--acc)'; ck.style.color = 'var(--acc-txt)'; ck.textContent = '✓'; };
  $('#deployBtn').onclick = async () => {
    term.innerHTML = '';
    if (state.bridge) { line(`<span class="dim">$ cos --target ${p.devices[0].plat} 部署当前工程并启动</span>`); const pre = document.createElement('div'); term.appendChild(pre);
      try { await runOnBridge(p.devices[0].plat, `把当前工程部署到 ${p.devices[0].role} 并启动，回显启动日志`, b => { pre.innerHTML = ansiToHtml(b); term.scrollTop = term.scrollHeight; }); line('<span class="ok">✓ 完成</span>'); } catch (e) { line(`<span class="err">✗ ${esc(e.message)}</span>`); } return; }
    for (let i = 0; i < p.devices.length; i++) { const d = p.devices[i], pl = platOf(d.plat);
      line(`<span class="dim">$</span> ${pl.via === 'ssh' ? `scp -r ./${d.prog.split('/')[0]} ${pl.nm}:~/cos/ && ssh ${pl.nm} 'systemctl restart cos-${p.id}'` : `${pl.tool.split('/')[0].trim()} upload ${d.prog}`}`); await sleep(700);
      line(`<span class="ok">✓</span> ${esc(d.role)} 已启动 · ${esc(pl.nm)}`); tick(i); await sleep(300); }
    line(`<span class="dim">$</span> 握手 ${esc(p.link ? p.link.proto : '')}`); await sleep(600); line('<span class="ok">✓</span> 两端握手成功 · 往返 12 ms'); tick(p.devices.length); await sleep(400);
    line('<span class="dim">$</span> 模拟失联 400 ms'); await sleep(600); line('<span class="ok">✓</span> 300 ms 后自动停车'); tick(p.devices.length + 1);
    line('\n<span class="dim">演示模式：以上为预置流程；装好本机桥接后这里是真实日志</span>');
  };
  $('#launchBtn').onclick = async () => { if (!state.bridge) { toast('需要本机桥接：cd cos-code && npm run bridge'); return; }
    try { const j = await (await fetch(state.bridge + '/api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: p.devices[0].plat, task: '' }) })).json(); toast(j.ok ? `已另开 PowerShell（PID ${j.pid}）` : (j.error || '启动失败')); } catch (e) { toast(e.message); } };
}

/* ═══════════ 设备中心 ═══════════ */
function vDevices(v){
  crumb('设备中心');
  v.innerHTML = `<div class="row"><div><div class="h1">设备中心</div><div class="sub">COS 已适配的 ${PLATFORMS.length} 块开发板 —— 单片机跑 COS-MCU 微代理，Linux 板跑 COS Runtime，插上就认</div></div><span class="grow"></span><input id="bq" placeholder="搜索板卡 / 芯片…" style="width:260px"></div>
    <div class="boards" id="boards"></div>`;
  const draw = q => { q = (q || '').toLowerCase();
    $('#boards').innerHTML = ['ser','ssh'].map(via => { const list = PLATFORMS.filter(p => p.via === via && (!q || (p.nm + p.ch + p.role).toLowerCase().includes(q)));
      return list.length ? `<div class="grp">${via === 'ser' ? '单片机 · 串口烧录 · COS-MCU' : 'Linux 板 · SSH · COS Runtime'} <span class="badge">${list.length}</span></div>` +
        list.map(p => `<div class="card board" data-id="${p.id}"><div class="pic">${boardPic(p, 'boardpic')}</div><b>${esc(p.nm)}</b><div class="ch">${esc(p.ch)}</div><div class="role">${esc(p.role)}</div></div>`).join('') : ''; }).join('');
    $('#boards').querySelectorAll('.board').forEach(b => b.onclick = () => { const p = platOf(b.dataset.id);
      modal(`<div class="hd">${boardPic(p)}<div><b class="h3">${esc(p.nm)}</b><div class="sub" style="margin:0;font-size:13px">${esc(p.ch)}</div></div><span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
        <div class="bd"><div class="kv"><span>连接方式</span><div>${p.via === 'ssh' ? 'SSH · 网络' : '串口烧录'}</div><span>运行时</span><div>${esc(p.rt)}</div><span>工具链</span><div class="mono">${esc(p.tool)}</div><span>示例项目</span><div>${esc(p.role)}</div></div>
        <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn primary" id="useBoard">用它新建项目</button></div></div>`).querySelector('#useBoard').onclick = () => { homeDevs = [p.id]; $('#modalRoot').innerHTML = ''; location.hash = '#/home'; }; }); };
  draw(); $('#bq').oninput = e => draw(e.target.value);
}

/* ═══════════ 故障诊断 ═══════════ */
function vDiagnose(v){
  crumb('故障诊断');
  let pid = state.projects[0].id, desc = '', logTab = 'all', res = null, running = false;
  const P = () => proj(pid);
  const draw = () => {
    const p = P();
    v.innerHTML = `<div class="row"><div><div class="h1">故障诊断</div><div class="sub">从连接、程序到设备协作，逐步定位问题${state.bridge ? '（已连接本机：真读串口、真跑检查）' : ''}</div></div><span class="grow"></span><button class="btn" id="dgHist">🕘 历史诊断</button></div>
    <div class="row wrap" style="margin-top:20px"><span class="sub" style="margin:0">项目</span><select id="dgProj" style="min-width:260px">${state.projects.map(x => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.nm)}</option>`).join('')}</select>
      <span class="sub" style="margin:0 0 0 12px">诊断范围</span><select style="min-width:200px"><option>全部设备（${p.devices.length}）</option>${p.devices.map(d => `<option>${esc(d.role)}</option>`).join('')}</select>
      <span class="grow"></span><button class="btn" id="dgImport">⬆ 导入日志</button><button class="btn primary" id="dgRun">${res ? '▶ 重新诊断' : '▶ 开始诊断'}</button></div>
    <div class="card pad" style="margin-top:16px"><div class="row"><b class="h3">📄 问题描述</b><span class="grow"></span><button class="btn sm" id="dgEdit">✎ 编辑</button></div>
      <div id="dgDescView" ${desc ? '' : 'hidden'} style="margin-top:8px;font-size:15px">${esc(desc)}</div>
      <textarea id="dgDesc" ${desc ? 'hidden' : ''} placeholder="例如：两个设备都已连接，但机器人不响应遥控器。" style="width:100%;min-height:70px;margin-top:8px">${esc(desc)}</textarea>
      <div class="sub" style="font-size:13px">已关联：${p.devices.map(d => esc(d.role)).join(' / ')}</div>
      <div class="filters" style="margin-top:10px">${D.symptoms.map(x => `<button data-s="${esc(x.nm)}">${esc(x.nm)}</button>`).join('')}</div></div>
    <div class="two" style="grid-template-columns:minmax(0,1fr) 380px;margin-top:16px" id="dgBody">
      <div class="card pad"><div class="row"><b class="h3">◎ 诊断概览</b></div>${res ? overview(p) : `<div class="sub" style="padding:30px 0;text-align:center">写好问题描述，点「开始诊断」。${state.bridge ? '' : '演示模式会按已验证的排障流程给出示例结果。'}</div>`}</div>
      <div class="card pad"><b class="h3">✦ AI 诊断结论</b>${res ? conclusion(p) : `<div class="sub" style="padding:30px 0;text-align:center">诊断完成后在这里给出结论与修复建议</div>`}</div></div>
    <p class="foot-note" style="text-align:right;margin-top:10px">${state.bridge && res && res.real ? '结果来自本机桥接的真实执行' : '诊断结果与日志均为界面示例'}</p>`;
    $('#dgProj').onchange = e => { pid = e.target.value; res = null; draw(); };
    $('#dgEdit').onclick = () => { $('#dgDescView').hidden = true; $('#dgDesc').hidden = false; $('#dgDesc').focus(); };
    $('#dgDesc').oninput = e => { desc = e.target.value; };
    v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { desc = b.dataset.s; $('#dgDesc').value = desc; $('#dgDesc').hidden = false; $('#dgDescView').hidden = true; });
    $('#dgHist').onclick = () => toast('历史诊断：界面示例');
    $('#dgImport').onclick = () => toast('导入日志：界面示例，桥接模式下会读设备实时日志');
    $('#dgRun').onclick = run;
    v.querySelectorAll('[data-log]').forEach(b => b.onclick = () => { logTab = b.dataset.log; draw(); });
    const cp = $('#copyLog'); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(res.logs.map(l => l.t).join('\n')); toast('日志已复制'); };
    const fx = $('#dgFix'); if (fx) fx.onclick = () => { location.hash = `#/project/${pid}/code`; };
    const ad = $('#dgMore'); if (ad) ad.onclick = () => { $('#dgDescView').hidden = true; $('#dgDesc').hidden = false; $('#dgDesc').focus(); };
  };
  const overview = p => {
    const bad = res.checks.filter(c => c.st === 'bad').length;
    const logs = res.logs.filter(l => logTab === 'all' || l.dev === logTab);
    return `<div class="row" style="margin-top:14px"><span class="ck" style="width:34px;height:34px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;font-size:18px">✓</span><b style="font-size:22px">诊断完成</b><span class="grow"></span>${bad ? `<span class="pill warn" style="font-size:14px">❗ 发现 ${bad} 项主要问题</span>` : `<span class="pill ok" style="font-size:14px">未发现问题</span>`}</div>
    <div class="card" style="margin-top:14px;overflow:hidden;box-shadow:none"><table class="tb"><thead><tr><th colspan="3">检查结果</th></tr></thead><tbody>
      ${res.checks.map(c => `<tr><td style="width:38%"><span class="dot" style="background:${{ok:'var(--ok)',bad:'var(--warn)',skip:'var(--mute)'}[c.st]}"></span>　${esc(c.nm)}</td><td class="sub" style="margin:0">${esc(c.d)}</td><td style="text-align:right"><span class="pill ${{ok:'ok',bad:'warn',skip:'gray'}[c.st]}">${{ok:'通过',bad:'异常',skip:'未开始'}[c.st]}</span></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:18px"><b class="h3">运行日志</b><span class="grow"></span><button class="btn link sm" id="copyLog">⧉ 复制日志</button></div>
    <div class="tabs" style="margin-top:6px"><a href="javascript:void 0" data-log="all" class="${logTab === 'all' ? 'on' : ''}">全部</a>${p.devices.map(d => `<a href="javascript:void 0" data-log="${esc(d.role)}" class="${logTab === d.role ? 'on' : ''}">${esc(d.role)}</a>`).join('')}</div>
    <div class="code" style="border-radius:0 0 10px 10px;max-height:260px">${logs.length ? logs.map((l, i) => `<div class="ln"><span class="n">${i + 1}</span><span class="${l.t.includes('ERROR') ? 'kw' : ''}">${esc(l.t)}</span></div>`).join('') : `<div class="ln"><span class="n"></span><span class="cm">（无）</span></div>`}</div>`;
  };
  const conclusion = p => `<div style="margin-top:14px;display:flex;gap:12px;align-items:flex-start"><span class="pill warn" style="font-size:20px;padding:6px 10px">❗</span><div><b style="font-size:21px;line-height:1.3;display:block">${esc(res.title)}</b><div class="sub" style="font-size:15px">${esc(res.why)}</div></div></div>
    <div class="card" style="margin-top:14px;padding:12px 14px;box-shadow:none;background:var(--card2)">📄 依据：${esc(res.basis)}</div>
    <div style="margin-top:16px"><b>🔧 建议下一步</b><div class="sub" style="margin-top:4px">${esc(res.next)}</div></div>
    <button class="btn primary" style="width:100%;justify-content:center;margin-top:16px" id="dgFix">📄 查看故障与修复方案</button>
    <button class="btn" style="width:100%;justify-content:center;margin-top:10px" id="dgMore">✎ 补充问题描述</button>
    <div class="card" style="margin-top:10px;padding:12px 14px;box-shadow:none"><div class="row"><span>📖 已参考：${esc(res.ref)}</span><span class="grow"></span>▾</div></div>`;
  async function run(){
    if (running) return; desc = ($('#dgDesc').value || desc).trim(); if (!desc) { $('#dgDesc').focus(); return; }
    running = true; const p = P(); const btn = $('#dgRun'); btn.disabled = true; btn.textContent = '诊断中…';
    if (state.bridge) {
      let out = ''; try { out = await runOnBridge(p.devices[0].plat, `故障诊断（项目「${p.nm}」，设备：${p.devices.map(d => d.role + '=' + platOf(d.plat).nm).join('、')}）。问题：${desc}。请依次检查设备连接、程序运行状态、通信协议一致性、执行测试，给出结论、依据和下一步。`, () => {}); } catch (e) { out = '✗ ' + e.message; }
      res = { real: true, checks: [{ nm: '设备连接', d: `${p.devices.length} 台`, st: 'ok' }, { nm: '程序运行状态', d: '见日志', st: 'ok' }, { nm: '通信协议一致性', d: '见日志', st: 'ok' }, { nm: '执行测试', d: '见日志', st: 'skip' }],
        logs: out.split('\n').filter(Boolean).map(t => ({ dev: p.devices[0].role, t })), title: 'COS 已完成检查', why: '结论见日志末尾', basis: '本机桥接实时执行', next: '按日志中的建议处理', ref: '实机排障' };
    } else {
      await sleep(900);
      const two = p.devices.length > 1, A = p.devices[0].role, B = two ? p.devices[1].role : A;
      res = { real: false,
        checks: [{ nm: '设备连接', d: `${p.devices.length} / ${p.devices.length} 在线`, st: 'ok' }, { nm: '程序运行状态', d: two ? '两端程序均已启动' : '程序已启动', st: 'ok' },
                 { nm: '通信协议一致性', d: two ? '两端消息字段不一致' : '协议版本一致', st: two ? 'bad' : 'ok' }, { nm: '电机执行测试', d: two ? '等待协议修复' : '已通过', st: two ? 'skip' : 'ok' }],
        logs: two ? [{ dev: A, t: '[INFO] robot: protocol v0.3' }, { dev: B, t: '[INFO] remote: protocol v0.2' }, { dev: B, t: '[RX] remote: {"speed": 0.4, "turn": 0.0}' }, { dev: A, t: '[ERROR] robot: missing field "throttle"' }]
                   : [{ dev: A, t: '[INFO] boot ok' }, { dev: A, t: '[INFO] drivers loaded: 3' }, { dev: A, t: '[INFO] self-test passed' }],
        title: two ? '两端通信协议不一致' : '未发现主要问题', why: two ? `${B}发送 speed / turn，${A}接收端需要 throttle / steer。` : '连接、程序与执行测试均通过。',
        basis: '运行日志与协议文件', next: two ? `更新${B}程序，使两端使用同一版本协议。` : '如仍有异常，补充问题描述后重新诊断。', ref: two ? '双设备通信排障流程' : '单板自检流程' };
    }
    running = false; draw();
  }
  draw();
}

/* ═══════════ 经验与模板 ═══════════ */
function vTemplates(v){
  crumb('经验与模板');
  let cat = '全部', sel = D.templates[0].id, q = '';
  const draw = () => {
    const list = D.templates.filter(t => (cat === '全部' || t.cat === cat) && (!q || (t.nm + t.sub + t.tags.join()).toLowerCase().includes(q)));
    const t = D.templates.find(x => x.id === sel) || list[0];
    v.innerHTML = `<div class="two" style="grid-template-columns:minmax(0,1fr) 380px"><div>
      <div class="row"><div class="h1">经验与模板</div><span class="badge acc">示例内容</span></div><div class="sub">把成熟的工程方案，直接用到你的项目里</div>
      <input id="tq" placeholder="🔍 搜索板卡、传感器或开发任务…" value="${esc(q)}" style="width:100%;margin-top:18px">
      <div class="filters">${D.templateCats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
      <div class="tplgrid">${list.map(x => `<div class="card tpl ${x.id === sel ? 'sel' : ''}" data-t="${x.id}">${x.verified ? '<span class="pill ok vf">✓ 已验证</span>' : ''}<div class="ic">${x.ico}</div><b class="h3">${esc(x.nm)}</b>
        <div class="tags">${x.tags.map(g => `<span>${esc(g)}</span>`).join('')}</div><div class="sub" style="margin:0;font-size:13.5px">${esc(x.sub)}</div><div class="row" style="margin-top:10px"><span class="sub" style="margin:0;font-size:13px">${esc(x.ver)}</span><span class="grow"></span>›</div></div>`).join('')}</div>
      <p class="foot-note" style="margin-top:22px">ⓘ 适配与验证状态为界面示例，具体以已发布版本为准。</p>
    </div>
    ${t ? `<div class="card tpldetail"><div class="row"><b class="h2">${esc(t.nm)}</b><span class="grow"></span><span class="pill ${t.verified ? 'ok' : 'gray'}">${t.verified ? '✓ 已验证 · ' : ''}${esc(t.ver)}</span></div><div class="sub">${esc(t.sub)}</div>
      <div class="hero2">${t.ico}</div>
      <div class="kv"><span>适用设备</span><div>${esc(t.devs)}</div><span>包含内容</span><div class="chk">${t.includes.map(i => `<div>${esc(i)}</div>`).join('')}</div><span>维护团队</span><div>${esc(t.team)}</div><span>目标项目</span><div><select id="tplProj">${state.projects.map(p => `<option value="${p.id}">${esc(p.nm)}</option>`).join('')}</select></div></div>
      <button class="btn primary" style="width:100%;justify-content:center;margin-top:18px" id="applyTpl">▶ 应用到项目</button><p class="center" style="margin-top:10px"><a href="#/templates">查看方案详情 ›</a></p></div>` : ''}</div>`;
    $('#tq').oninput = e => { q = e.target.value.toLowerCase(); draw(); $('#tq').focus(); $('#tq').setSelectionRange(q.length, q.length); };
    v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    v.querySelectorAll('.tpl').forEach(b => b.onclick = () => { sel = b.dataset.t; draw(); });
    const ap = $('#applyTpl'); if (ap) ap.onclick = () => { const p = proj($('#tplProj').value); p.chat.push({ who: 'ai', plan: t.includes.map(i => `${i}：来自「${t.nm}」`), applied: t.nm, est: '' }); if (p.user) saveUserProjects(); toast(`已应用「${t.nm}」→ ${p.nm}`); location.hash = `#/project/${p.id}/chat`; };
  };
  draw();
}

/* ═══════════ 装置商城 ═══════════ */
function vStore(v){
  crumb('装置商城');
  let cat = '全部', fitOnly = false, q = '';
  const draw = () => {
    const list = D.store.filter(s => (cat === '全部' || s.cat === cat) && (!fitOnly || s.fit) && (!q || (s.nm + s.sub + s.proto).toLowerCase().includes(q)));
    v.innerHTML = `<div class="row"><div><div class="h1">发现好玩的具身智能装置</div><div class="sub">开箱体验，用自然语言拓展新功能</div></div><span class="grow"></span>
      <button class="btn" id="cartBtn">🛒 购物车 <span class="pill">${state.cart.length}</span></button><button class="btn">📄 我的订单</button></div>
      <input id="sq" placeholder="🔍 搜索机器人、机械臂或开发套件…" value="${esc(q)}" style="width:100%;margin-top:18px">
      <div class="row" style="margin-top:12px"><div class="filters" style="margin:0">${D.storeCats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div><span class="grow"></span><label class="row" style="gap:6px;font-size:14px"><input type="checkbox" id="fit" ${fitOnly ? 'checked' : ''} style="width:auto">仅看 COS 已适配</label></div>
      <div class="tplgrid">${list.map(s => `<div class="card tpl" style="cursor:default"><div class="hero2" style="height:150px;margin:0 0 12px;font-size:64px">${s.ico}</div><b class="h3">${esc(s.nm)}</b><div class="sub" style="margin:2px 0 6px;font-size:13.5px">${esc(s.sub)}</div>
        <div class="tags">${s.tags.map(g => `<span>${esc(g)}</span>`).join('')}${s.fit ? '<span style="background:var(--ok-soft);color:var(--ok)">COS 已适配</span>' : ''}</div>
        <div class="sub" style="font-size:12.5px;margin:0">原型：${esc(s.proto)}</div>
        <div class="row" style="margin-top:12px"><b style="font-size:20px">¥${s.price.toLocaleString()}</b><span class="grow"></span><button class="btn sm" data-add="${s.id}">🛒 加入购物车</button></div></div>`).join('')}</div>
      <p class="foot-note">概念商品与价格仅供界面示例，具体规格及适配范围以商品说明为准。</p>`;
    $('#sq').oninput = e => { q = e.target.value.toLowerCase(); draw(); $('#sq').focus(); $('#sq').setSelectionRange(q.length, q.length); };
    v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    $('#fit').onchange = e => { fitOnly = e.target.checked; draw(); };
    v.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { state.cart.push(b.dataset.add); LS.set('cart', state.cart); toast('已加入购物车'); draw(); });
    $('#cartBtn').onclick = () => { const items = state.cart.map(id => D.store.find(s => s.id === id)); const sum = items.reduce((a, s) => a + s.price, 0);
      modal(`<div class="hd"><b class="h3">购物车</b><span class="grow"></span><button class="btn sm" data-close>关闭</button></div><div class="bd">${items.length ? `<table class="tb">${items.map(s => `<tr><td>${s.ico} ${esc(s.nm)}</td><td class="mono">¥${s.price}</td></tr>`).join('')}<tr><td><b>合计</b></td><td class="mono"><b>¥${sum}</b></td></tr></table><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="clearCart">清空</button><button class="btn primary" id="checkout">去结算（示例）</button></div>` : '<div class="sub">购物车是空的</div>'}</div>`);
      const c = $('#clearCart'); if (c) c.onclick = () => { state.cart = []; LS.set('cart', []); $('#modalRoot').innerHTML = ''; draw(); };
      const k = $('#checkout'); if (k) k.onclick = () => toast('结算为界面示例，未接支付'); };
  };
  draw();
}

/* ═══════════ Token 用量 ═══════════ */
function vUsage(v){
  crumb('Token 用量');
  const real = state.usage; const U = D.usage;
  const tot = real ? (real.hit + real.miss + real.out) : U.monthTokens;
  const cost = real ? (real.hit / 1e6 * PRICE.hit + real.miss / 1e6 * PRICE.miss + real.out / 1e6 * PRICE.out) : U.monthCost;
  const cols = ['#5b8cff', '#3ecf8e', '#8b7cf6', '#f5a623', '#ff6b5b'];
  let by = U.byProject.map(x => ({ ...x, p: proj(x.id) }));
  if (real && real.calls && real.calls.length) { const m = {}; real.calls.forEach(c => { const k = c.platform || 'other'; m[k] = (m[k] || 0) + (c.tokens || 0); }); by = Object.entries(m).map(([k, t]) => ({ id: k, tok: t, cost: t / 1e6 * ((PRICE.hit + PRICE.miss) / 2), p: { nm: platOf(k).nm, ico: '🧩' } })); }
  const sum = by.reduce((a, x) => a + x.tok, 0) || 1;
  v.innerHTML = `<div class="row"><div><div class="h1">Token 用量与充值</div><div class="sub">按底层模型实际消耗的原始 Token 计费${real ? ' · <b>实时（本机桥接）</b>' : ' · 界面示例'}</div></div><span class="grow"></span>
      <div class="seg"><button class="on">个人</button><button>团队</button></div><select><option>📅 本月</option></select></div>
    <div class="stat3">
      <div class="card stat"><span class="ic">👛</span><div><div class="k">可用余额 ⓘ</div><div class="v">${yuan(U.balance - (real ? cost : 0))}</div></div></div>
      <div class="card stat"><span class="ic">📊</span><div><div class="k">本月原始 Token ⓘ</div><div class="v">${fmtTok(tot)}</div></div></div>
      <div class="card stat"><span class="ic">💳</span><div><div class="k">本月消费</div><div class="v">${yuan(cost)}</div></div></div></div>
    <div class="usagegrid"><div class="card pad"><b class="h3">${real ? '按平台用量' : '项目用量'}</b>
      <table class="tb" style="margin-top:12px"><thead><tr><th>${real ? '平台' : '项目'}</th><th>原始 Token</th><th>费用</th><th>明细</th></tr></thead><tbody>
        ${by.map(x => `<tr><td>${x.p ? x.p.ico + ' ' + esc(x.p.nm) : esc(x.id)}</td><td class="mono">${fmtTok(x.tok)}</td><td class="mono">${yuan(x.cost)}</td><td><a href="#/usage">查看</a></td></tr>`).join('')}</tbody></table>
      <p class="sub" style="font-size:13px;margin-top:10px">▾ 按模型查看输入、缓存输入与输出明细${real ? `：命中 ${fmtTok(real.hit)} · 未命中 ${fmtTok(real.miss)} · 输出 ${fmtTok(real.out)}` : ''}</p>
      <div class="row" style="margin-top:18px"><b class="h3">${real ? '平台' : '项目'}用量占比（原始 Token）</b><span class="grow"></span><span class="sub" style="margin:0">总计 ${fmtTok(sum)}</span></div>
      <div class="bar">${by.map((x, i) => `<i style="width:${(x.tok / sum * 100).toFixed(1)}%;background:${cols[i % cols.length]}"></i>`).join('')}</div>
      <div class="legend">${by.map((x, i) => `<span style="--c:${cols[i % cols.length]}">${x.p ? esc(x.p.nm) : esc(x.id)}<small>${fmtTok(x.tok)} (${(x.tok / sum * 100).toFixed(1)}%)</small></span>`).join('')}</div>
      <p class="sub" style="font-size:12.5px;margin-top:16px">ⓘ 余额、金额及用量${real ? '中的金额按预估费率折算' : '均为界面示例'}，实际费用以模型费率和调用记录为准。</p></div>
    <div><div class="card pad"><b class="h3">购买 Token 用量</b><div class="sub" style="font-size:13px">充值后，按原始 Token 实际消耗结算</div>
      <div class="topup">${U.topups.map((t, i) => `<button class="${i === 1 ? 'on' : ''}" data-t="${t}">¥${t}</button>`).join('')}<button data-t="0">自定义金额</button></div>
      <button class="btn primary" style="width:100%;justify-content:center" id="topupBtn">充值</button></div>
      <div class="card pad" style="margin-top:16px"><b class="h3">预算控制</b><div class="sub" style="font-size:13px">单项目预算上限</div><input value="¥100.00" style="width:100%;margin-top:8px">
      <label class="row" style="margin-top:12px;gap:8px;font-size:14px"><input type="checkbox" checked style="width:auto">达到上限时暂停 ⓘ</label><p style="margin-top:10px"><a href="#/usage">团队额度分配 ›</a></p></div></div></div>`;
  v.querySelectorAll('.topup button').forEach(b => b.onclick = () => { v.querySelectorAll('.topup button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $('#topupBtn').onclick = () => toast('充值为界面示例，未接支付');
}

/* ───────── 启动 ───────── */
applyTheme(state.theme);
render();
probeBridge().then(() => { if (route().v !== 'project') return; });
setInterval(pullUsage, 15000);
})();
