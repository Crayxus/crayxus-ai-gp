/* EI TOKEN 具身智能开发平台 · 应用逻辑
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
  hw: [],   // 实机：已授权/已插入的设备
  relay: LS.get('relay', ''),   // 中转配对码：线上页面靠它看本机设备
  names: LS.get('hwnames', {}),   // 自己给设备起的名字：key → 名字
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
        $('#bridgeBadge').textContent = '已连接本机 · ' + (state.provider || '桥接'); $('#bridgeBadge').className = 'badge ok'; pullUsage();
        if (location.hash.startsWith('#/devices')) render(); return true; }
    } catch (e) {}
  }
  $('#bridgeBadge').textContent = '未连接本机'; $('#bridgeBadge').className = 'badge'; return false;
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
  return { v: ['devices','diagnose','sim','templates','store','usage'].includes(a) ? a : 'home' };
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
  ({ home: vHome, project: vProject, devices: vDevices, diagnose: vDiagnose, sim: vSim, templates: vTemplates, store: vStore, usage: vUsage })[r.v](v, r);
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
  <p class="center" style="margin-top:34px"><a href="#/store">📁 导入已有工程</a>　·　<a href="#/store">🛒 去装置商城挑一台</a></p>`;
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
  crumb(p.nm, { chat: '对话', devices: '设备', code: '代码与界面', deploy: '部署与联调' }[tab]);
  const tabs = `<div class="tabs">${[['chat','对话'],['devices','设备'],['code','代码与界面'],['deploy','部署与联调']].map(([k, n]) => `<a href="#/project/${p.id}/${k}" class="${tab === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
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
        ? `<div class="msg"><span class="av">EI</span><div class="grow" style="max-width:100%"><div class="term" id="term-${i}">${ansiToHtml(m.term)}</div></div></div>`
        : `<div class="msg"><span class="av">EI</span><div class="bub">我会为${p.devices.length > 1 ? '两个设备' : '这块板'}生成配套程序。
            <ul class="plan">${m.plan.map(s => `<li><span class="ck">✓</span>${esc(s)}</li>`).join('')}</ul>
            <div class="applied">📖 已应用：<b>${esc(m.applied)}</b> <span class="grow"></span><a href="#/templates">查看开发依据</a></div>
            <div class="row"><button class="btn primary sm" data-gen>▶ 生成配套程序</button><button class="btn sm" data-adjust>⚙ 调整方案</button></div>
            <div class="sub" style="font-size:13px">${esc(m.est || '')}</div></div></div>`).join('')
      : `<div class="sub center" style="margin:auto">描述你希望实现的功能，EI TOKEN 会先给方案，再生成配套程序。</div>`}</div>
    <div class="card composer"><textarea id="say" placeholder="继续描述你希望实现的功能…"></textarea>
      <div class="row"><button class="iconbtn">📎</button><span class="grow"></span>${modelSel('modelSel2')}<button class="btn primary" id="send">▶ 发送</button></div></div>
  </div><div>
    <div class="card pad"><div class="row"><b class="h3">本项目设备</b><span class="grow"></span><button class="btn link" id="addDev2">＋ 添加</button></div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">${p.devices.map((d, i) => devCard(p, d, i)).join('')}</div></div>
    <div class="card budget" style="margin-top:16px"><div class="row"><b class="h3">任务预算上限</b><span class="grow"></span><span class="sub" style="margin:0;font-size:13px">可修改</span></div>
      <input id="budget" value="¥${Number(p.budget).toFixed(2)}" style="margin-top:10px"></div>
  </div></div>`;
  bindModel($('#modelSel2'));
  const send = () => { const t = $('#say').value; $('#say').value = ''; sendMessage(p, t); };
  $('#send').onclick = send; $('#say').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };
  $('#budget').onchange = e => { p.budget = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; e.target.value = '¥' + p.budget.toFixed(2); if (p.user) saveUserProjects(); };
  $('#addDev2').onclick = () => pickDevices(sel => { sel.forEach(id => { if (!p.devices.some(d => d.plat === id)) { const pl = platOf(id); p.devices.push({ id: 'd' + (p.devices.length + 1), role: pl.role, plat: id, conn: pl.via === 'ssh' ? '网络连接' : '串口', env: pl.rt, prog: `${id}/main.py`, status: '未连接' }); } }); if (p.user) saveUserProjects(); render(); }, p.devices.map(d => d.plat));
  v.querySelectorAll('[data-gen]').forEach(b => b.onclick = () => { if (!Object.keys(p.files).length) p.files = { ...D.projects[0].files }; toast('配套程序已生成 → 代码与界面'); location.hash = `#/project/${p.id}/code`; });
  v.querySelectorAll('[data-adjust]').forEach(b => b.onclick = () => $('#say').focus());
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
}
function tDevices(v, p){
  let sel = 1;
  const draw = () => {
    const d = p.devices[sel] || p.devices[0]; const pl = platOf(d.plat);
    v.innerHTML = `<div class="two" style="grid-template-columns:minmax(0,1fr) 340px">
    <div>
      <div class="row"><div><div class="h2">本项目设备</div></div><span class="grow"></span><button class="btn primary" id="addDev3">＋ 添加设备</button></div>
      <div class="devgrid">${p.devices.map((x, i) => { const q = platOf(x.plat); return `<div class="card devbig ${i === sel ? 'sel' : ''}" data-i="${i}">
        <div class="pic">${boardPic(q, 'boardpic')}</div>
        <div class="row"><b style="font-size:17px">${esc(x.role)}</b><span class="grow"></span><span class="pill ${x.status === '已连接' ? 'ok' : 'gray'}">● ${esc(x.status)}</span>${hwLive(x.plat) ? '<span class="badge ok" style="margin-left:6px">实机在线</span>' : ''}</div>
        <div class="sub" style="margin-top:0">${esc(q.nm)}</div>
        <div class="kv" style="margin-top:12px"><span>角色</span><div>${esc(x.role)}</div><span>连接</span><div>${esc(x.conn)}</div><span>环境</span><div>${esc(x.env)}</div><span>项目程序</span><div class="mono">${esc(x.prog)}</div></div>
        <div class="row" style="margin-top:14px"><a class="btn sm" href="#/project/${p.id}/code">&lt;/&gt; 查看源码</a><span class="grow"></span><button class="btn sm">${x.status === '已连接' ? '⛓ 断开连接' : '🔗 连接'}</button></div></div>`; }).join('')}</div>
      ${p.link ? `<div class="h3" style="margin-top:22px">设备协作</div><div class="card coop"><b>${esc(p.link.a)}</b><span class="arrow">⟷</span><b>${esc(p.link.b)}</b><span class="pill">${esc(p.link.proto)}</span><span class="pill gray">${esc(p.link.ver)}</span><span class="grow"></span><button class="btn sm">📄 查看协议</button></div>` : ''}
      <div class="h3" style="margin-top:22px">已关联模块</div>
      <div class="card" style="margin-top:10px;overflow:hidden"><table class="tb"><thead><tr><th>模块名称</th><th>关联设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${p.modules.length ? p.modules.map(m => `<tr><td>${esc(m.nm)}</td><td>${esc(m.dev)}</td><td><span class="pill ${m.st === '已配置' ? 'ok' : 'warn'}">● ${esc(m.st)}</span></td><td>—</td></tr>`).join('') : `<tr><td colspan="4" class="sub">—</td></tr>`}
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
      .replace(/\b(import|from|while|try|except|as|def|return|if|else|for|in|True|False|None|const|let|function|export|include|void|int|float)\b/g, '<span class="kw">$1</span>')
      .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|f&quot;.*?&quot;)/g, '<span class="str">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');
    return `<div class="ln ${/TIMEOUT_SECONDS = /.test(ln) ? 'add' : ''}"><span class="n">${i + 1}</span><span>${s || ' '}</span></div>`; }).join('');
}
function tCode(v, p){
  const files = Object.keys(p.files); let cur = files.find(f => f.endsWith('.tsx')) || files[0] || '';
  let mode = p.ui ? 'both' : 'code', ver = 'v0.4', padSize = 'normal', hasSave = true;
  const pose = { x: 2.4, y: 1.2, th: 36, bat: 78 }; let mapMode = 'both';
  const lang = f => /\.tsx?$/.test(f) ? 'TypeScript React' : /\.c$|\.h$|\.ino$/.test(f) ? 'C / C++' : /\.json$|\.yaml$|\.md$|\.txt$/.test(f) ? '配置' : 'Python';
  const tree = () => { const dirs = {}; files.forEach(f => { const parts = f.split('/'); const d = parts.length > 1 ? parts.slice(0, -1).join('/') : ''; (dirs[d] = dirs[d] || []).push(f); });
    return Object.entries(dirs).sort(([x], [y]) => x.localeCompare(y)).map(([d, fs]) => (d ? `<div class="dir">📁 ${esc(d)}</div>` : '') + fs.map(f => `<div class="f ${f === cur ? 'on' : ''}" data-f="${esc(f)}">📄 ${esc(f.split('/').pop())}${/tsx$/.test(f) && p.ui ? ' <span class="pill" style="font-size:10px;padding:1px 6px">新建</span>' : ''}</div>`).join('')).join(''); };
  const draw = () => {
    const showCode = mode !== 'preview', showPrev = mode !== 'code' && p.ui;
    v.innerHTML = `<div class="codebar"><span class="lbl">视图模式</span><select id="cmode">${[['both','代码 + 预览'],['code','仅代码'],['preview','仅预览']].map(([k, n]) => `<option value="${k}" ${mode === k ? 'selected' : ''} ${k !== 'code' && !p.ui ? 'disabled' : ''}>${n}</option>`).join('')}</select>
      <span class="lbl">编程语言</span><select><option>🐍 Python</option><option>TypeScript React</option><option>C / C++</option></select>
      <span class="lbl">版本</span><select><option>${ver}</option><option>v0.3</option></select><span class="grow"></span>
      <button class="btn" id="exportBtn">⬆ 导出工程</button><a class="btn primary" href="#/project/${p.id}/deploy">▶ 部署到设备</a></div>
    <div class="ide" style="grid-template-columns:${showCode && showPrev ? '340px minmax(0,1fr) 340px' : showCode ? '230px minmax(0,1fr) 340px' : 'minmax(0,1fr) 360px'}">
      ${showCode ? `<div style="display:flex;flex-direction:column;gap:12px"><div class="card tree"><div class="hd row">项目文件<span class="grow"></span><span class="sub" style="margin:0;font-size:12px">▾</span></div>${files.length ? tree() : `<div class="sub" style="padding:8px 16px">还没有文件</div>`}</div>
        ${showPrev ? `<div class="card editor"><div class="tabs2"><span class="on">📄 ${esc(cur.split('/').pop())} ✕</span></div><div class="code" style="max-height:300px">${cur ? hl(p.files[cur]) : ''}</div></div>
        <div class="card pad"><b class="h3">已绑定机器人能力</b><ul class="plan" style="margin-top:10px">${p.ui.caps.map(c => `<li><span class="ck">✓</span>${esc(c)}<span class="grow"></span><span style="color:var(--ok);font-size:13px">已绑定</span></li>`).join('')}</ul>
          <div class="row" style="margin-top:10px;font-size:12.5px;color:var(--dim)"><span>机器人程序：Python</span><span class="grow"></span><span>${esc(lang(cur))} · UTF-8</span></div></div>` : ''}</div>` : ''}
      ${showCode && !showPrev ? `<div class="card editor"><div class="tabs2"><span class="on">📄 ${esc(cur || '—')}</span></div><div class="code">${cur ? hl(p.files[cur]) : ''}</div>
        <div class="ft"><span>› 日志</span><span class="grow"></span><span>${esc(lang(cur))}</span><span>UTF-8</span><span>${esc(p.devices[0].role)}</span></div></div>` : ''}
      ${showPrev ? `<div class="card" style="overflow:hidden"><div class="row" style="padding:12px 16px;border-bottom:1px solid var(--line)"><b class="h3">任务界面预览</b><span class="pill">✦ AI 生成 · 仅当前任务</span><span class="grow"></span><button class="iconbtn" id="prevClose">✕</button></div>
        <div style="padding:14px 16px"><div class="row"><div><b style="font-size:19px">${esc(p.ui.title)}</b></div><span class="grow"></span><span class="pill ok">● 数据已连接</span></div>
          <div class="seg" style="margin-top:12px;width:100%">${[['both','地图 + 遥控'],['map','仅地图'],['drive','仅遥控']].map(([k, n]) => `<button data-mm="${k}" class="${mapMode === k ? 'on' : ''}" style="flex:1">${n}</button>`).join('')}</div>
          ${mapMode !== 'drive' ? `<div style="position:relative;margin-top:12px;border-radius:10px;overflow:hidden;background:#111827"><canvas id="slam" width="760" height="300" style="width:100%;display:block"></canvas>
            <span style="position:absolute;top:10px;left:12px;color:#fff;font-weight:700;font-size:13px">SLAM 地图</span><span class="pill ok" style="position:absolute;top:32px;left:12px;background:rgba(22,163,74,.9);color:#fff">● 正在建图</span>
            <div style="position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:4px"><button class="btn sm" data-zoom="1">＋</button><button class="btn sm" data-zoom="-1">－</button><button class="btn sm">⛶</button></div>
            <div style="position:absolute;left:12px;bottom:8px;color:#cbd5e1;font-size:11px">1 m ▬</div><div style="position:absolute;right:12px;bottom:8px;color:#cbd5e1;font-size:11px">□ 已探索　■ 未探索　- - 轨迹</div></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px">${[['📍 位置', `X ${pose.x.toFixed(1)} m · Y ${pose.y.toFixed(1)} m`], ['🧭 朝向', pose.th + '°'], ['🔋 电量', pose.bat + '%']].map(([k, val]) => `<div class="card" style="padding:10px 12px;box-shadow:none"><div class="sub" style="margin:0;font-size:12px">${k}</div><b>${val}</b></div>`).join('')}</div>` : ''}
          <div style="display:grid;grid-template-columns:${mapMode === 'both' ? '1fr 1fr' : '1fr'};gap:12px;margin-top:12px">
            ${mapMode !== 'drive' ? `<div class="card" style="padding:12px;box-shadow:none"><div class="row wrap" style="gap:6px"><b style="white-space:nowrap">机器人视角</b><span class="grow"></span><span class="pill ok" style="font-size:11px;white-space:nowrap">● 视频在线</span></div><div style="position:relative;margin-top:8px;border-radius:8px;overflow:hidden"><canvas id="cam" width="360" height="180" style="width:100%;display:block"></canvas><span class="badge" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;border:0">实时画面</span></div>
              ${hasSave ? `<button class="btn" style="width:100%;justify-content:center;margin-top:10px" id="saveMap">💾 保存地图</button>` : ''}</div>` : ''}
            ${mapMode !== 'map' ? `<div class="card" style="padding:12px;box-shadow:none"><div class="row wrap" style="gap:6px"><b style="white-space:nowrap">屏幕遥控器</b><span class="grow"></span></div>
              <div class="pad ${padSize}" id="pad" style="margin:14px auto 0"><button data-d="0,1">▲</button><button data-d="-1,0">◀</button><button class="stop" id="padStop">■</button><button data-d="1,0">▶</button><button data-d="0,-1">▼</button></div>
              <div class="row" style="margin-top:12px;font-size:12.5px"><span class="sub" style="margin:0;white-space:nowrap">速度上限</span><b class="mono" id="spdV">0.20 m/s</b><input type="range" id="spd" min="5" max="60" value="20" style="flex:1;padding:0"></div>
              <button class="btn" style="width:100%;justify-content:center;margin-top:10px;color:var(--err);border-color:color-mix(in srgb,var(--err) 45%,transparent)" id="robotStop">■ 停止机器人</button></div>` : ''}</div>
          <div class="row" style="margin-top:12px"><button class="btn" id="saveProj">💾 保存到项目</button><button class="btn" id="foldPanel">⌃ 收起面板</button><span class="grow"></span><button class="btn" id="viewSrc">&lt;/&gt; 查看界面源码</button></div></div></div>` : ''}
      <div class="card aipanel"><div class="row"><b class="h3">✦ AI 开发助手</b><span class="grow"></span><button class="iconbtn">⋯</button></div>
        <div id="aiLog">${p.ui ? `<div class="q">给我一个带实时画面和地图的遥控器，我想控制机器人探索房间并建图。</div><div class="a">已确认机器人提供 SLAM 与相机接口，正在为这个任务生成操作面板。</div>
          <div class="pending"><ul class="plan" style="margin:0">${['机器人程序', '地图、视频与遥控界面', '数据与控制绑定'].map(x => `<li><span class="ck">✓</span>${x}</li>`).join('')}</ul></div>
          <div class="a">面板已生成。你可以直接操作，也可以继续用自然语言修改。</div>
          <div class="row wrap"><button class="btn sm" data-quick="save">＋ ${hasSave ? '去掉' : '增加'}保存按钮</button><button class="btn sm" data-quick="pad">＋ 改成${padSize === 'large' ? '普通' : '大'}摇杆</button></div>` : ``}</div>
        <textarea id="aiIn" placeholder="例如：把遥控器放大，地图放左边…" style="width:100%;min-height:66px;margin-top:10px"></textarea>
        <div class="row" style="margin-top:8px"><button class="iconbtn">📎</button><span class="grow"></span><button class="btn primary sm" id="aiGo">➤</button></div>
        <div class="sub" style="font-size:12px;margin-top:8px">本轮 AI 用量 0.24M tokens</div></div>
    </div>
    <style>.pad{display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:6px;place-items:center;width:max-content}.pad button{width:52px;height:52px;border-radius:50%;background:var(--acc-soft);color:var(--acc);font-size:18px;font-weight:800}.pad button:active{background:var(--acc);color:var(--acc-txt)}.pad .stop{background:var(--acc);color:var(--acc-txt)}.pad button:nth-child(1){grid-column:2}.pad button:nth-child(2){grid-column:1;grid-row:2}.pad button:nth-child(3){grid-column:2;grid-row:2}.pad button:nth-child(4){grid-column:3;grid-row:2}.pad button:nth-child(5){grid-column:2;grid-row:3}.pad.large{grid-template-columns:repeat(3,72px);grid-template-rows:repeat(3,72px)}.pad.large button{width:72px;height:72px;font-size:24px}</style>`;
    bind(); drawMap(); drawCam();
  };
  /* SLAM 地图: 三个房间 + 走廊, 已探索区随机器人位置扩大; 轨迹虚线; 机器人朝向扇形 */
  let zoom = 1, trail = [[1.2, 1.2]];
  const drawMap = () => { const cv = $('#slam'); if (!cv) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.fillStyle = '#1f2937'; c.fillRect(0, 0, W, H);
    const S = 60 * zoom, ox = 60, oy = 40; const px = x => ox + x * S, py = y => H - oy - y * S;
    const rooms = [[0, 0, 4, 3.5], [4.6, 1, 4, 2.5], [9.2, 0.4, 3, 3]], halls = [[4, 1.6, 0.6, 0.8], [8.6, 1.8, 0.6, 0.6]];
    c.fillStyle = '#f3f4f6'; c.strokeStyle = '#0f172a'; c.lineWidth = 4;
    rooms.concat(halls).forEach(([x, y, w, h]) => { c.fillRect(px(x), py(y + h), w * S, h * S); });
    rooms.forEach(([x, y, w, h]) => c.strokeRect(px(x), py(y + h), w * S, h * S));
    c.fillStyle = '#374151'; [[2, 1.5], [6.4, 2.2], [10.4, 1.8]].forEach(([x, y]) => c.fillRect(px(x) - 8, py(y) - 8, 16, 16));
    const ex = Math.min(1, (pose.x + 1) / 12); c.fillStyle = 'rgba(31,41,55,.85)'; c.fillRect(px(2 + ex * 10), 0, W, H);   // 未探索区盖住右侧
    c.setLineDash([6, 6]); c.strokeStyle = '#60a5fa'; c.lineWidth = 2; c.beginPath(); trail.forEach(([x, y], i) => i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))); c.stroke(); c.setLineDash([]);
    const rx = px(pose.x), ry = py(pose.y), th = -pose.th * Math.PI / 180;
    c.fillStyle = 'rgba(59,130,246,.25)'; c.beginPath(); c.moveTo(rx, ry); c.arc(rx, ry, 48, th - 0.5, th + 0.5); c.closePath(); c.fill();
    c.fillStyle = '#2563eb'; c.beginPath(); c.moveTo(rx + 12 * Math.cos(th), ry + 12 * Math.sin(th)); c.lineTo(rx + 10 * Math.cos(th + 2.5), ry + 10 * Math.sin(th + 2.5)); c.lineTo(rx + 10 * Math.cos(th - 2.5), ry + 10 * Math.sin(th - 2.5)); c.closePath(); c.fill(); };
  const drawCam = () => { const cv = $('#cam'); if (!cv) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height;   // 简易走廊透视
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#cbd5e1'); g.addColorStop(.5, '#e2e8f0'); g.addColorStop(1, '#94a3b8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#64748b'; c.beginPath(); c.moveTo(0, H); c.lineTo(W * .38, H * .55); c.lineTo(W * .62, H * .55); c.lineTo(W, H); c.fill();
    c.fillStyle = '#334155'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * .38, H * .45); c.lineTo(W * .38, H * .55); c.lineTo(0, H); c.fill(); c.beginPath(); c.moveTo(W, 0); c.lineTo(W * .62, H * .45); c.lineTo(W * .62, H * .55); c.lineTo(W, H); c.fill();
    c.fillStyle = '#f8fafc'; c.fillRect(W * .40, H * .40, W * .2, H * .18); c.strokeStyle = 'rgba(255,255,255,.35)'; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, H * (.15 * i)); c.lineTo(W * .38, H * (.45 + .02 * i)); c.stroke(); c.beginPath(); c.moveTo(W, H * (.15 * i)); c.lineTo(W * .62, H * (.45 + .02 * i)); c.stroke(); } };
  const bind = () => {
    $('#cmode').onchange = e => { mode = e.target.value; draw(); };
    v.querySelectorAll('.f').forEach(f => f.onclick = () => { cur = f.dataset.f; draw(); });
    v.querySelectorAll('[data-mm]').forEach(b => b.onclick = () => { mapMode = b.dataset.mm; draw(); });
    v.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => { zoom = Math.max(.6, Math.min(1.8, zoom + 0.2 * +b.dataset.zoom)); drawMap(); });
    const spd = $('#spd'); if (spd) spd.oninput = e => { $('#spdV').textContent = (e.target.value / 100).toFixed(2) + ' m/s'; };
    let mv = null; const move = (dx, dy) => { const sp = spd ? spd.value / 100 : .2; pose.x = Math.max(.3, Math.min(11.6, pose.x + dx * sp * .6)); pose.y = Math.max(.3, Math.min(3.2, pose.y + dy * sp * .6)); pose.th = dx > 0 ? 0 : dx < 0 ? 180 : dy > 0 ? 90 : 270; trail.push([pose.x, pose.y]); if (trail.length > 80) trail.shift(); drawMap(); const st = v.querySelector('.card b'); const cells = v.querySelectorAll('[style*="grid-template-columns:repeat(3,1fr)"] b'); if (cells[0]) { cells[0].textContent = `X ${pose.x.toFixed(1)} m · Y ${pose.y.toFixed(1)} m`; cells[1].textContent = pose.th + '°'; } };
    v.querySelectorAll('#pad [data-d]').forEach(b => { const [dx, dy] = b.dataset.d.split(',').map(Number); b.onpointerdown = () => { move(dx, dy); mv = setInterval(() => move(dx, dy), 120); }; b.onpointerup = b.onpointerleave = () => { clearInterval(mv); mv = null; }; });
    const stopAll = () => { clearInterval(mv); toast('已发送停止'); }; const ps = $('#padStop'); if (ps) ps.onclick = stopAll; const rs = $('#robotStop'); if (rs) rs.onclick = stopAll;
    const sm = $('#saveMap'); if (sm) sm.onclick = () => toast('地图已保存'); const sp2 = $('#saveProj'); if (sp2) sp2.onclick = () => toast('面板已保存到项目');
    const fp = $('#foldPanel'); if (fp) fp.onclick = () => { mode = 'code'; draw(); }; const pc = $('#prevClose'); if (pc) pc.onclick = () => { mode = 'code'; draw(); };
    const vs = $('#viewSrc'); if (vs) vs.onclick = () => { cur = files.find(f => f.endsWith('RoomPanel.tsx')) || cur; mode = 'both'; draw(); };
    $('#exportBtn').onclick = () => { const blob = new Blob([files.map(f => `# ==== ${f} ====\n${p.files[f]}\n`).join('\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.nm}-工程.txt`; a.click(); };
    v.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => applyUI(b.dataset.quick === 'save' ? (hasSave ? '去掉保存按钮' : '增加保存按钮') : (padSize === 'large' ? '改成普通摇杆' : '改成大摇杆')));
    $('#aiGo').onclick = () => { const q = $('#aiIn').value.trim(); if (!q) return; $('#aiIn').value = ''; applyUI(q); };
  };
  /* AI 改界面: 识别几类常见要求, 同时改 tsx 源码与预览; 其余走桥接或提示 */
  const applyUI = q => {
    const log = $('#aiLog'); if (log) log.insertAdjacentHTML('beforeend', `<div class="q">${esc(q)}</div>`);
    const tsx = files.find(f => f.endsWith('RoomPanel.tsx'));
    if (/大摇杆|放大.*遥控|遥控.*放大/.test(q) && tsx) { padSize = 'large'; p.files[tsx] = p.files[tsx].replace(/<DrivePad\n/, '<DrivePad size="large"\n'); toast('已改成大摇杆'); }
    else if (/普通摇杆|缩小.*遥控/.test(q) && tsx) { padSize = 'normal'; p.files[tsx] = p.files[tsx].replace(' size="large"', ''); toast('已改回普通摇杆'); }
    else if (/去掉.*保存|删除.*保存/.test(q) && tsx) { hasSave = false; p.files[tsx] = p.files[tsx].replace(/\n\s*<SaveMap[^\n]*\/>/, ''); toast('已去掉保存按钮'); }
    else if (/保存按钮|增加.*保存/.test(q) && tsx) { hasSave = true; if (!/<SaveMap/.test(p.files[tsx])) p.files[tsx] = p.files[tsx].replace('    </TaskPanel>', '      <SaveMap onClick={actions.saveMap} />\n    </TaskPanel>'); toast('已增加保存按钮'); }
    else if (/仅地图|只要地图/.test(q)) { mapMode = 'map'; } else if (/仅遥控|只要遥控/.test(q)) { mapMode = 'drive'; }
    else if (/地图.*界面|遥控.*界面|生成.*面板/.test(q) && !p.ui) { p.ui = { title: p.nm + '操作台', sub: '按当前任务生成', caps: ['状态', '启动与停止'] }; mode = 'both'; toast('已为当前任务生成操作面板'); }
    else if (state.bridge) { runOnBridge(p.devices[0].plat, `修改 ${cur}：${q}`, () => {}).then(() => toast('已交给本机桥接')); return; }
    else { if (log) log.insertAdjacentHTML('beforeend', `<div class="a">这条修改需要本机桥接。</div>`); return; }
    if (p.user) saveUserProjects(); draw();
  };
  draw();
}
function tDeploy(v, p){
  v.innerHTML = `<div class="two" style="grid-template-columns:minmax(0,1fr) 340px">
    <div><div class="row" style="margin-top:6px"><div><div class="h2">部署与联调</div></div><span class="grow"></span>
      <button class="btn" id="launchBtn">🪟 另开 PowerShell</button><button class="btn primary" id="deployBtn">▶ 部署到全部设备</button></div>
      <div class="card term" id="dterm" style="margin-top:18px;min-height:280px;max-height:none"><span class="dim">$ 等待部署… </span></div></div>
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
  };
  $('#launchBtn').onclick = async () => { if (!state.bridge) { toast('需要本机桥接：cd cos-code && npm run bridge'); return; }
    try { const j = await (await fetch(state.bridge + '/api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: p.devices[0].plat, task: '' }) })).json(); toast(j.ok ? `已另开 PowerShell（PID ${j.pid}）` : (j.error || '启动失败')); } catch (e) { toast(e.message); } };
}


/* ═══════════ 实机识别（Web Serial：插上就认） ═══════════ */
const HW_OK = typeof navigator !== 'undefined' && 'serial' in navigator;
const hex4 = n => n == null ? '----' : n.toString(16).toUpperCase().padStart(4, '0');
function usbHit(i){ const v = i.usbVendorId, q = i.usbProductId; if (v == null) return null;
  return D.usbdb.find(x => x.v === v && x.p === q) || D.usbdb.find(x => x.v === v && x.p == null) || null; }
function hwLive(plat){ return state.hw.find(e => e.plat === plat) || null; }

function hwAdd(port, quiet){
  if (state.hw.some(e => e.port === port)) return null;
  const info = (port.getInfo && port.getInfo()) || {}, hit = usbHit(info);
  const e = { port, info, plat: hit ? hit.plat : '', nm: hit ? hit.nm : 'USB 串口设备',
    why: hit ? hit.note : '未知 VID/PID —— 打开串口读启动日志可进一步识别', lines: [], opened: false };
  state.hw.push(e); if (!quiet) toast('🔌 ' + e.nm + ' 已连接');
  syncHW(); return e;
}
function hwDrop(port){ const i = state.hw.findIndex(e => e.port === port); if (i < 0) return;
  const e = state.hw[i]; if (e.opened) hwClose(e); state.hw.splice(i, 1); toast('⏏ ' + e.nm + ' 已拔出'); syncHW(); }

function syncHW(){
  state.projects.forEach(p => (p.devices || []).forEach(d => {
    if (d._st0 == null) d._st0 = d.status;
    d.status = hwLive(d.plat) ? '已连接' : d._st0; }));
  const b = $('#hwBadge');
  if (b){ const n = state.hw.length;
    b.textContent = n ? (n === 1 ? '🔌 ' + state.hw[0].nm + ' 已连接' : '🔌 ' + n + ' 台设备在线') : (HW_OK ? '🔌 未插入设备' : '🔌 浏览器不支持插拔检测');
    b.className = 'badge' + (n ? ' ok' : ''); }
  if (location.hash.startsWith('#/devices')) paintLive();
  else if (/\/(devices|deploy)$/.test(location.hash)) render();
}
async function hwAuthorize(){
  if (!HW_OK) return toast('请用 Edge / Chrome 打开本页');
  try { const port = await navigator.serial.requestPort(); const e = hwAdd(port, true);
    if (e) { toast('🔌 ' + e.nm + ' 已授权，之后插拔会自动识别'); paintLive(); } }
  catch (err) { if (!/No port selected|cancel/i.test(err.message || '')) toast('授权失败：' + err.message); }
}
function hwSim(id){ const pl = platOf(id); if (!pl) return;
  state.hw.push({ sim: true, plat: id, nm: pl.nm, info: {}, lines: [],
    why: pl.via === 'ssh' ? '网络发现（演示）· ' + pl.rt : '串口识别（演示）· ' + pl.ch });
  toast('🔌 ' + pl.nm + ' 已连接'); syncHW(); paintLive(); }

/* 打开串口读日志：顺便按启动日志二次识别型号 */
async function hwOpen(e){
  if (e.sim || e.opened) return;
  try {
    await e.port.open({ baudRate: e.baud || 115200 });
    e.opened = true; paintLive();
    const dec = new TextDecoder(); let buf = '';
    e.reader = e.port.readable.getReader();
    for (;;) {
      const { value, done } = await e.reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split(/\r?\n/); buf = parts.pop();
      parts.forEach(l => { e.lines.push(l); if (e.lines.length > 300) e.lines.shift(); hwRefine(e, l); });
      const box = $('#hwLogBox'); if (box) { box.textContent = e.lines.join('\n'); box.scrollTop = box.scrollHeight; }
    }
  } catch (err) { toast('串口读取结束：' + (err.message || '')); }
  try { e.reader && e.reader.releaseLock(); } catch (_) {}
  e.opened = false; paintLive();
}
async function hwClose(e){
  try { e.reader && await e.reader.cancel(); } catch (_) {}
  try { await e.port.close(); } catch (_) {}
  e.opened = false; paintLive();
}
function hwRefine(e, ln){
  if (e.fixed) return;
  for (const g of D.logsig) if (new RegExp(g.re, 'i').test(ln)) {
    e.nm = g.nm; e.plat = g.plat; e.why = '按串口启动日志识别'; e.fixed = true;
    toast('✓ 启动日志确认：' + g.nm); syncHW(); break; }
}
async function hwWrite(e, txt){
  if (!e.opened || !e.port.writable) return toast('先点「读串口日志」打开串口');
  try { const w = e.port.writable.getWriter(); await w.write(new TextEncoder().encode(txt + '\r\n')); w.releaseLock(); }
  catch (err) { toast('发送失败：' + err.message); }
}
async function hwReset(e){   // 脉冲 RTS/DTR：ESP32/多数板子的复位与下载时序
  if (e.sim || !e.opened) return toast('先打开串口再复位');
  try { await e.port.setSignals({ requestToSend: true, dataTerminalReady: false }); await sleep(120);
        await e.port.setSignals({ requestToSend: false }); toast('已发送复位脉冲'); e.fixed = false; }
  catch (err) { toast('复位失败：' + err.message); }
}
if (HW_OK) {
  navigator.serial.addEventListener('connect', ev => hwAdd(ev.target || ev.port));
  navigator.serial.addEventListener('disconnect', ev => hwDrop(ev.target || ev.port));
  navigator.serial.getPorts().then(ps => { ps.forEach(p => hwAdd(p, true)); syncHW(); }).catch(() => {});
}

/* 桥接侧发现：浏览器看不到网络板(RDK/Jetson/树莓派走 SSH)，交给本机桥接扫。
   线上 https 页面读不到 127.0.0.1（浏览器不允许），改走公网中转：
   本机桥接把设备快照推上去，这边凭配对码取回来 —— 手机也能看。 */
const RELAY_API = 'https://safegate-2rw7.onrender.com/api/cos/hw';
async function pullHW(scan){
  let j = null, relayed = false;
  if (state.bridge) { try { j = await (await fetch(state.bridge + '/api/hw' + (scan ? '?scan=1' : ''))).json(); } catch (e) {} }
  if (!j && state.relay) {
    relayed = true;
    try { j = await (await fetch(RELAY_API + '?code=' + encodeURIComponent(state.relay) + (scan ? '&scan=1' : ''))).json(); } catch (e) {}
    if (j && !j.online) { if (state.relayOn !== false) { state.relayOn = false; state.relayHost = ''; paintLive(); } j = null; }
    else if (j) { const was = state.relayOn; state.relayOn = true; state.relayHost = j.host || '';
      if (!was && location.hash.startsWith('#/devices')) render(); }
  }
  if (!j || !j.ok) return;
  const keys = new Set(); let changed = false;
  (j.boards || []).forEach(b => { const k = 'net:' + b.ip; keys.add(k);
    let e = state.hw.find(x => x.key === k);
    if (!e) { state.hw.push({ key: k, src: 'bridge', relayed, net: true, plat: b.plat, nm: b.nm, ip: b.ip,
        banner: b.banner, why: b.why, services: b.services || [], info: {}, lines: [] });
      toast('🔌 ' + b.nm + ' 已连接（' + b.ip + '）'); changed = true; }
    else { e.nm = b.nm; e.why = b.why; e.services = b.services || []; } });
  (j.bt || []).forEach(b => { const k = 'bt:' + b.com; keys.add(k);
    if (state.hw.some(x => x.key === k)) return;
    state.hw.push({ key: k, src: 'bridge', relayed, bt: true, com: b.com, plat: b.plat || '',
      nm: b.nm, why: b.why, info: {}, lines: [] });
    toast('🔌 ' + b.nm + ' 已连接（' + b.com + '）'); changed = true; });
  state.btSkip = j.btSkip || 0;
  (j.serial || []).forEach(sp => {
    const own = state.hw.find(x => x.port && x.info.usbVendorId === sp.vid && x.info.usbProductId === sp.pid);
    const k = 'com:' + sp.com;
    if (own) { own.com = sp.com;                                    // 已授权的补上 COM 号
      const dup = state.hw.findIndex(x => x.key === k); if (dup >= 0) { state.hw.splice(dup, 1); changed = true; } return; }
    keys.add(k);
    if (state.hw.some(x => x.key === k)) return;
    const hit = sp.vid != null ? usbHit({ usbVendorId: sp.vid, usbProductId: sp.pid }) : null;
    state.hw.push({ key: k, src: 'bridge', relayed, com: sp.com, info: { usbVendorId: sp.vid, usbProductId: sp.pid },
      plat: hit ? hit.plat : '', nm: hit ? hit.nm : (sp.name || '串口设备'),
      why: (hit ? hit.note : '本机发现的串口设备') + ' · ' + sp.com, lines: [] });
    toast('🔌 ' + (hit ? hit.nm : '串口设备') + ' 已连接（' + sp.com + '）'); changed = true; });
  state.hw.filter(e => e.src === 'bridge' && !keys.has(e.key)).forEach(e => {
    state.hw.splice(state.hw.indexOf(e), 1); toast('⏏ ' + e.nm + ' 已拔出'); changed = true; });
  syncHW(); if (changed) paintLive();
}

/* 扫描设备：本机桥接当场重扫；线上走中转等下一轮；纯浏览器调起串口选择器 */
let hwScanning = false;
async function hwScan(){
  if (hwScanning) return;
  hwScanning = true; paintLive();
  const before = new Set(state.hw.map(e => e.key || (e.info && e.info.usbVendorId + ':' + e.info.usbProductId) || e.nm));
  const step = t => { const el = $('#hwStep'); if (el) el.textContent = t; };
  try {
    if (HW_OK) { step('读取已授权的串口设备…');
      try { (await navigator.serial.getPorts()).forEach(pt => hwAdd(pt, true)); } catch (e) {} }
    if (state.bridge) { step('扫描本机串口与网络板…'); await pullHW(true); }
    else if (state.relay) { step('通知本机扫描…');
      const t0 = Date.now(); await pullHW(true);
      while (Date.now() - t0 < 12000) {          // 本机每 5 秒推一次，等它把新结果送上来
        await sleep(1200); step('等待本机回传…（' + Math.round((Date.now() - t0) / 1000) + 's）');
        await pullHW(); if (state.hw.some(e => !before.has(e.key))) break; } }
    const found = state.hw.filter(e => !before.has(e.key || (e.info && e.info.usbVendorId + ':' + e.info.usbProductId) || e.nm));
    if (!found.length && HW_OK && !state.bridge) { step('打开浏览器串口选择器…'); hwScanning = false; paintLive(); return hwAuthorize(); }
    hwScanning = false; paintLive(); hwReport(found);
  } catch (e) { hwScanning = false; paintLive(); toast('扫描失败：' + (e.message || '')); }
}
function hwReport(found){
  const row = e => { const pl = e.plat ? platOf(e.plat) : null;
    return `<div class="hwrow">${pl ? boardPic(pl, 'boardpic sm') : '<span class="boardpic sm">🔌</span>'}
      <div style="min-width:0"><b>${esc(state.names[e.key || ''] || e.nm)}</b> ${found.includes(e) ? '<span class="badge ok">新</span>' : ''}
        <div class="sub" style="margin:0;font-size:12.5px">${esc(e.why || '')}</div></div><span class="grow"></span>
      <span class="mono" style="font-size:12px;color:var(--mute);white-space:nowrap">${e.net ? esc(e.ip) : e.com ? esc(e.com) : 'VID ' + hex4(e.info.usbVendorId) + ':' + hex4(e.info.usbProductId)}</span></div>`; };
  modal(`<div class="hd"><b class="h3">扫描完成</b>
      <span class="pill ${found.length ? 'ok' : 'gray'}">${found.length ? '新增 ' + found.length + ' 台' : '无新增'}</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">${state.hw.length ? state.hw.map(row).join('')
      : `<div class="sub" style="padding:16px 0">没有找到设备。串口板请确认已插好并点「授权设备」；RDK / Jetson 这类网络板需要本机跑 <span class="mono">npm run bridge</span>。</div>`}</div>`);
}

/* 实机连接卡片（设备中心顶部） */
function liveCard(){
  return `<div class="card live" style="padding:16px 18px;margin-top:6px">
    <div class="row wrap"><b class="h3">🔌 实机连接</b><span class="pill ${state.hw.length ? 'ok' : 'gray'}" id="hwCount">${state.hw.length} 台在线</span>
      <span class="grow"></span>
      ${state.bridge ? '' : `<input id="hwCode" placeholder="配对码" value="${esc(state.relay)}" style="width:120px;text-transform:uppercase"><button class="btn sm" id="hwLink">${state.relay ? '换' : '连'}本机</button>`}
      <button class="btn primary sm" id="hwScan" ${hwScanning ? 'disabled' : ''}>${hwScanning ? '扫描中…' : '🔍 扫描设备'}</button>
      <button class="btn sm" id="hwAuth">＋ 授权设备</button>
      <select class="sm" id="hwSimSel" style="max-width:170px"><option value="">模拟插入（演示）…</option>${PLATFORMS.map(p => `<option value="${p.id}">${esc(p.nm)}</option>`).join('')}</select></div>
    <div id="hwStep" class="sub" style="margin:8px 0 0;font-size:12.5px"></div>
    <div id="hwList" style="margin-top:10px"></div></div>`;
}
function paintLive(){
  const b = $('#hwScan'); if (b) { b.disabled = hwScanning; b.textContent = hwScanning ? '扫描中…' : '🔍 扫描设备'; }
  const st = $('#hwStep'); if (st && !hwScanning) st.textContent = '';
  const el = $('#hwList'); if (!el) return;
  const c = $('#hwCount'); if (c){ c.textContent = state.hw.length + ' 台在线'; c.className = 'pill ' + (state.hw.length ? 'ok' : 'gray'); }
  el.innerHTML = state.hw.length ? state.hw.map((e, i) => { const pl = e.plat ? platOf(e.plat) : null;
    const nm = state.names[e.key || ''] || e.nm;
    const tag = e.sim ? '<span class="badge">演示</span>' : e.bt ? '<span class="badge ok">蓝牙串口</span>' : e.fixed ? '<span class="badge ok">日志已确认</span>'
      : e.relayed ? '<span class="badge ok">' + (e.net ? '网络发现' : '本机发现') + ' · 经中转</span>'
      : e.net ? '<span class="badge ok">网络发现</span>' : e.src === 'bridge' ? '<span class="badge">本机发现</span>' : '<span class="badge ok">浏览器已授权</span>';
    const meta = e.sim ? '模拟设备' : e.net ? esc(e.ip) : e.bt ? esc(e.com)
      : (e.com ? esc(e.com) + ' · ' : '') + 'VID ' + hex4(e.info.usbVendorId) + ':' + hex4(e.info.usbProductId);
    return `<div class="hwrow"><span class="dotpulse ${e.sim ? 'sim' : ''}"></span>
      ${pl ? boardPic(pl, 'boardpic sm') : '<span class="boardpic sm">🔌</span>'}
      <div style="min-width:0"><b>${esc(nm)}</b> ${tag}
        <div class="sub" style="margin:0;font-size:12.5px">${esc(e.why || '')}${e.services && e.services.length ? ' · ' + e.services.map(esc).join(' · ') : ''}${e.banner ? ' · <span class="mono">' + esc(e.banner) + '</span>' : ''}</div></div>
      <span class="grow"></span>
      <span class="mono" style="font-size:12px;color:var(--mute);white-space:nowrap">${meta}</span>
      ${pl ? `<a class="btn sm" href="#/home" data-use="${e.plat}">用它新建项目</a>` : ''}
      <button class="btn sm" data-nm="${i}" title="改名">✎</button>
      ${e.port ? `<button class="btn sm" data-log="${i}">${e.opened ? '● 读取中' : '▶ 读串口日志'}</button>` : ''}
      ${e.src === 'bridge' && !e.net ? '' : ''}
      <button class="btn sm" data-rm="${i}">${e.sim ? '拔出' : '移除'}</button></div>`; }).join('')
    : `<div class="sub" style="padding:10px 0">还没有设备</div>`;
  if (state.btSkip) el.insertAdjacentHTML('beforeend',
    `<div class="sub" style="margin-top:8px;font-size:12px">另有 ${state.btSkip} 个蓝牙串口未识别</div>`);
  el.querySelectorAll('[data-log]').forEach(b => b.onclick = () => { const e = state.hw[+b.dataset.log]; if (e.opened) hwClose(e); else { hwOpen(e); hwLogModal(e); } });
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const e = state.hw[+b.dataset.rm];
    if (e.src === 'bridge') return toast('这台是本机实时发现的，拔掉设备它就会自己消失');
    if (e.opened) await hwClose(e); if (e.port && e.port.forget) { try { await e.port.forget(); } catch (_) {} }
    state.hw.splice(+b.dataset.rm, 1); toast('已移除'); syncHW(); paintLive(); });
  el.querySelectorAll('[data-nm]').forEach(b => b.onclick = () => { const e = state.hw[+b.dataset.nm]; const k = e.key || ('usb:' + e.info.usbVendorId + ':' + e.info.usbProductId);
    const r = modal(`<div class="hd"><b class="h3">设备改名</b><span class="grow"></span><button class="btn sm" data-close>取消</button></div>
      <div class="bd"><input id="nmIn" value="${esc(state.names[k] || e.nm)}" style="width:100%"><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="nmOk">保存</button></div></div>`);
    const save = () => { const v = r.querySelector('#nmIn').value.trim();
      if (v) state.names[k] = v; else delete state.names[k];
      LS.set('hwnames', state.names); e.key = k; $('#modalRoot').innerHTML = ''; paintLive(); };
    r.querySelector('#nmOk').onclick = save; r.querySelector('#nmIn').onkeydown = ev => { if (ev.key === 'Enter') save(); };
    r.querySelector('#nmIn').focus(); });
  el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { homeDevs = [b.dataset.use]; });
}
function hwLogModal(e){
  const r = modal(`<div class="hd"><b class="h3">${esc(e.nm)} · 串口日志</b><span class="pill ok">115200</span><span class="grow"></span>
      <button class="btn sm" id="hwRst">⟳ 复位</button><button class="btn sm" data-close>关闭</button></div>
    <div class="bd"><div class="hwlog" id="hwLogBox">${esc(e.lines.join('\n')) || '等待串口输出…（多数板子需要按一下复位键，或点右上角「复位」）'}</div>
      <div class="row" style="margin-top:10px"><input id="hwIn" placeholder="向设备发送一行，例如 help / 回车唤醒登录提示" style="flex:1"><button class="btn primary sm" id="hwSend">发送</button></div></div>`);
  r.querySelector('#hwRst').onclick = () => hwReset(e);
  r.querySelector('#hwSend').onclick = () => { const i = r.querySelector('#hwIn'); hwWrite(e, i.value); i.value = ''; };
  r.querySelector('#hwIn').onkeydown = ev => { if (ev.key === 'Enter') r.querySelector('#hwSend').click(); };
}

/* ═══════════ 设备中心 ═══════════ */
function vDevices(v){
  crumb('设备中心');
  v.innerHTML = `<div class="row"><div><div class="h1">设备中心</div><div class="sub">${PLATFORMS.length} 块开发板</div></div><span class="grow"></span><input id="bq" placeholder="搜索板卡 / 芯片…" style="width:260px"></div>
    ${liveCard()}
    <div class="boards" id="boards" style="margin-top:20px"></div>`;
  paintLive();
  $('#hwAuth').onclick = hwAuthorize;
  $('#hwScan').onclick = hwScan;
  const cin = $('#hwCode');
  if (cin) { const link = () => { state.relay = cin.value.trim().toUpperCase(); LS.set('relay', state.relay);
      state.hw = state.hw.filter(e => e.src !== 'bridge'); state.relayOn = null;
      toast(state.relay ? '正在连接 ' + state.relay + ' …' : '已断开中转'); pullHW(); render(); };
    $('#hwLink').onclick = link; cin.onkeydown = ev => { if (ev.key === 'Enter') link(); }; }
  $('#hwSimSel').onchange = e2 => { if (e2.target.value) hwSim(e2.target.value); e2.target.value = ''; };
  const draw = q => { q = (q || '').toLowerCase();
    $('#boards').innerHTML = ['ser','ssh'].map(via => { const list = PLATFORMS.filter(p => p.via === via && (!q || (p.nm + p.ch + p.role).toLowerCase().includes(q)));
      return list.length ? `<div class="grp">${via === 'ser' ? '单片机 · 串口烧录 · COS-MCU' : 'Linux 板 · SSH · COS Runtime'} <span class="badge">${list.length}</span></div>` +
        list.map(p => `<div class="card board" data-id="${p.id}"><div class="pic">${boardPic(p, 'boardpic')}</div><b>${esc(p.nm)}</b><div class="ch">${esc(p.ch)}</div><div class="role">${esc(p.role)}</div></div>`).join('') : ''; }).join('');
    $('#boards').querySelectorAll('.board').forEach(b => b.onclick = () => { const p = platOf(b.dataset.id);
      modal(`<div class="hd">${boardPic(p)}<div><b class="h3">${esc(p.nm)}</b><div class="sub" style="margin:0;font-size:13px">${esc(p.ch)}</div></div><span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
        <div class="bd"><div class="kv"><span>连接方式</span><div>${p.via === 'ssh' ? 'SSH · 网络' : '串口烧录'}</div><span>运行时</span><div>${esc(p.rt)}</div><span>工具链</span><div class="mono">${esc(p.tool)}</div><span>典型项目</span><div>${esc(p.role)}</div></div>
        <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn primary" id="useBoard">用它新建项目</button></div></div>`).querySelector('#useBoard').onclick = () => { homeDevs = [p.id]; $('#modalRoot').innerHTML = ''; location.hash = '#/home'; }; }); };
  draw(); $('#bq').oninput = e => draw(e.target.value);
}

/* ═══════════ 故障诊断 ═══════════ */
function vDiagnose(v){
  let pid = state.projects[0].id, desc = '', logTab = 'all', res = null, running = false;
  if (proj(pid).body) return vBodyDiag(v, proj(pid));
  crumb('故障诊断');
  const P = () => proj(pid);
  const draw = () => {
    const p = P();
    v.innerHTML = `<div class="row"><div><div class="h1">故障诊断</div></div><span class="grow"></span><button class="btn" id="dgHist">🕘 历史诊断</button></div>
    <div class="row wrap" style="margin-top:20px"><span class="sub" style="margin:0">项目</span><select id="dgProj" style="min-width:260px">${state.projects.map(x => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.nm)}</option>`).join('')}</select>
      <span class="sub" style="margin:0 0 0 12px">诊断范围</span><select style="min-width:200px"><option>全部设备（${p.devices.length}）</option>${p.devices.map(d => `<option>${esc(d.role)}</option>`).join('')}</select>
      <span class="grow"></span><button class="btn" id="dgImport">⬆ 导入日志</button><button class="btn primary" id="dgRun">${res ? '▶ 重新诊断' : '▶ 开始诊断'}</button></div>
    <div class="card pad" style="margin-top:16px"><div class="row"><b class="h3">📄 问题描述</b><span class="grow"></span><button class="btn sm" id="dgEdit">✎ 编辑</button></div>
      <div id="dgDescView" ${desc ? '' : 'hidden'} style="margin-top:8px;font-size:15px">${esc(desc)}</div>
      <textarea id="dgDesc" ${desc ? 'hidden' : ''} placeholder="例如：两个设备都已连接，但机器人不响应遥控器。" style="width:100%;min-height:70px;margin-top:8px">${esc(desc)}</textarea>
      <div class="sub" style="font-size:13px">已关联：${p.devices.map(d => esc(d.role)).join(' / ')}</div>
      <div class="filters" style="margin-top:10px">${D.symptoms.map(x => `<button data-s="${esc(x.nm)}">${esc(x.nm)}</button>`).join('')}</div></div>
    <div class="two" style="grid-template-columns:minmax(0,1fr) 380px;margin-top:16px" id="dgBody">
      <div class="card pad"><div class="row"><b class="h3">◎ 诊断概览</b></div>${res ? overview(p) : `<div class="sub" style="padding:30px 0;text-align:center">尚未诊断</div>`}</div>
      <div class="card pad"><b class="h3">✦ AI 诊断结论</b>${res ? conclusion(p) : `<div class="sub" style="padding:30px 0;text-align:center">待生成</div>`}</div></div>`;
    $('#dgProj').onchange = e => { pid = e.target.value; res = null; if (proj(pid).body) return vBodyDiag(v, proj(pid)); draw(); };
    $('#dgEdit').onclick = () => { $('#dgDescView').hidden = true; $('#dgDesc').hidden = false; $('#dgDesc').focus(); };
    $('#dgDesc').oninput = e => { desc = e.target.value; };
    v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { desc = b.dataset.s; $('#dgDesc').value = desc; $('#dgDesc').hidden = false; $('#dgDescView').hidden = true; });
    $('#dgHist').onclick = () => toast('历史诊断');
    $('#dgImport').onclick = () => toast('导入日志');
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
        logs: out.split('\n').filter(Boolean).map(t => ({ dev: p.devices[0].role, t })), title: 'EI TOKEN 已完成检查', why: '结论见日志末尾', basis: '本机桥接实时执行', next: '按日志中的建议处理', ref: '实机排障' };
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

/* ═══════════ 全身诊断（复杂项目：人形机器人）═══════════ */
function vBodyDiag(v, p){
  crumb('故障诊断', p.nm);
  const B = p.body; let tab = 'body', side = 'front', sel = 'J16', onlyBad = false, q = '', scanning = false;
  const all = B.parts.flatMap(pt => pt.joints.map(([id, nm, x, y]) => ({ id, nm, x, y, part: pt.nm })));
  const stOf = id => B.live[id] && B.live[id].temp >= B.threshold ? 'warn' : 'ok';
  const live = id => B.live[id] || { pos: (Math.sin(id.charCodeAt(2) * 7) * 20).toFixed(1), temp: 38 + (id.charCodeAt(2) % 7), cur: (0.4 + (id.charCodeAt(2) % 5) / 10).toFixed(1), volt: 24.1, trend: null };
  const warnN = () => all.filter(j => stOf(j.id) === 'warn').length;
  const draw = () => {
    const j = all.find(x => x.id === sel); const L = live(sel); const warn = stOf(sel) === 'warn';
    v.innerHTML = `<div class="row"><div><div class="h1">${esc(p.nm)} · 全身诊断</div></div><span class="grow"></span>
      <button class="btn" id="bdRefresh">⟳ 刷新元件</button><button class="btn primary" id="bdScan">${scanning ? '诊断中…' : '▶ 开始全身诊断'}</button></div>
    <div class="row wrap" style="margin-top:18px"><select style="min-width:220px"><option>${esc(B.model)}</option></select><span class="pill ok">● 已连接 · 以太网</span><span class="grow"></span>
      <span class="badge" style="font-size:14px;padding:8px 14px">🦿 ${B.dof} 自由度</span><span class="badge" style="font-size:14px;padding:8px 14px">🧊 ${all.length + B.sensors.length + B.power.length} 个元件</span>
      <span class="badge ${warnN() ? 'warn' : 'ok'}" style="font-size:14px;padding:8px 14px">${warnN() ? '❗ ' + warnN() + ' 项预警' : '✓ 无预警'}</span></div>
    <div class="tabs">${[['body','全身视图'],['bus','连接与总线'],['log','运行日志']].map(([k, n]) => `<a href="javascript:void 0" data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</a>`).join('')}</div>
    <div id="bdBody" style="margin-top:16px">${tab === 'body' ? bodyView(j, L, warn) : tab === 'bus' ? busView() : logView()}</div>`;
    bind();
  };
  const figure = () => {
    const warnJ = all.find(x => stOf(x.id) === 'warn');
    /* 白色人形: 所有体块用 url(#sh) 渐变(浅→深)做体积, 高光用半透明白, 关节座是深一点的圆环 */
    const body = `
      <defs>
        <linearGradient id="sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e9edf4"/><stop offset="1" stop-color="#c9d1de"/></linearGradient>
        <linearGradient id="shd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3140"/><stop offset="1" stop-color="#0f1420"/></linearGradient>
        <radialGradient id="core" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="var(--acc)" stop-opacity="1"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
        <pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--line2)" stroke-width="1"/></pattern>
      </defs>
      <rect width="300" height="480" fill="url(#g)"/>
      <ellipse cx="150" cy="474" rx="70" ry="6" fill="#000" opacity=".12" filter="url(#soft)"/>
      <g fill="url(#sh)" stroke="#b8c2d3" stroke-width="1.6" stroke-linejoin="round">
        <!-- 手臂(后层) -->
        <rect x="70" y="126" width="28" height="84" rx="13" transform="rotate(8 84 168)"/>
        <rect x="202" y="126" width="28" height="84" rx="13" transform="rotate(-8 216 168)"/>
        <rect x="62" y="226" width="26" height="76" rx="12" transform="rotate(4 75 264)"/>
        <rect x="212" y="226" width="26" height="76" rx="12" transform="rotate(-4 225 264)"/>
        <!-- 手 -->
        <path d="M62 300h26a6 6 0 0 1 6 6v18a8 8 0 0 1-8 8H66a8 8 0 0 1-8-8v-18a6 6 0 0 1 4-6z"/>
        <path d="M212 300h26a6 6 0 0 1 4 6v18a8 8 0 0 1-8 8h-22a8 8 0 0 1-8-8v-18a6 6 0 0 1 6-6z"/>
        <!-- 腿 -->
        <rect x="106" y="296" width="40" height="80" rx="16"/><rect x="154" y="296" width="40" height="80" rx="16"/>
        <rect x="110" y="384" width="32" height="70" rx="13"/><rect x="158" y="384" width="32" height="70" rx="13"/>
        <!-- 脚 -->
        <path d="M100 456h48a8 8 0 0 1 8 8v4a6 6 0 0 1-6 6H98a6 6 0 0 1-6-6v-4a8 8 0 0 1 8-8z"/>
        <path d="M152 456h48a8 8 0 0 1 8 8v4a6 6 0 0 1-6 6h-54a6 6 0 0 1-6-6v-4a8 8 0 0 1 8-8z"/>
        <!-- 骨盆 / 腹部 / 胸甲 -->
        <path d="M118 250h64a10 10 0 0 1 10 10v16a14 14 0 0 1-14 14h-56a14 14 0 0 1-14-14v-16a10 10 0 0 1 10-10z"/>
        <rect x="126" y="212" width="48" height="42" rx="10"/>
        <path d="M104 96h92a10 10 0 0 1 10 10v54a44 44 0 0 1-44 44h-24a44 44 0 0 1-44-44v-54a10 10 0 0 1 10-10z"/>
        <!-- 肩甲 -->
        <path d="M78 98a24 24 0 0 1 32 12v14H84a12 12 0 0 1-12-12v-4a12 12 0 0 1 6-10z"/>
        <path d="M222 98a24 24 0 0 0-32 12v14h26a12 12 0 0 0 12-12v-4a12 12 0 0 0-6-10z"/>
        <!-- 颈 / 头 -->
        <rect x="140" y="76" width="20" height="22" rx="6"/>
        <path d="M122 22h56a12 12 0 0 1 12 12v30a20 20 0 0 1-20 20h-40a20 20 0 0 1-20-20V34a12 12 0 0 1 12-12z"/>
      </g>
      <!-- 面罩 / 胸口核心 / 高光 -->
      <rect x="128" y="40" width="44" height="22" rx="9" fill="url(#shd)"/>
      <path d="M136 51h28" stroke="var(--acc)" stroke-width="3" stroke-linecap="round" opacity=".95"/>
      <circle cx="150" cy="134" r="16" fill="url(#core)" opacity=".7"/><circle cx="150" cy="134" r="6" fill="var(--acc)"/>
      <path d="M130 108q20-8 40 0" stroke="#fff" stroke-width="3" opacity=".7" fill="none" stroke-linecap="round"/>
      <path d="M112 300q12-2 24 0M164 300q12-2 24 0" stroke="#fff" stroke-width="2.5" opacity=".6" fill="none" stroke-linecap="round"/>
      <!-- 关节座 -->
      <g fill="#dfe4ee" stroke="#aab4c6" stroke-width="1.5">
        <circle cx="96" cy="112" r="15"/><circle cx="204" cy="112" r="15"/>
        <circle cx="78" cy="214" r="11"/><circle cx="222" cy="214" r="11"/>
        <circle cx="128" cy="288" r="13"/><circle cx="172" cy="288" r="13"/>
        <circle cx="126" cy="374" r="14"/><circle cx="174" cy="374" r="14"/>
        <circle cx="126" cy="450" r="10"/><circle cx="174" cy="450" r="10"/>
      </g>`;
    const dots = all.map(x => { const st = stOf(x.id), on = x.id === sel;
      return `<g class="jt" data-j="${x.id}" style="cursor:pointer"><circle cx="${x.x}" cy="${x.y}" r="${on ? 9 : 6.5}" fill="${st === 'warn' ? 'var(--warn)' : 'var(--ok)'}" stroke="${on ? 'var(--txt)' : '#fff'}" stroke-width="${on ? 2.5 : 1.8}"/>${st === 'warn' ? `<circle cx="${x.x}" cy="${x.y}" r="13" fill="none" stroke="var(--warn)" stroke-width="2" opacity=".55"><animate attributeName="r" values="9;15;9" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0;.6" dur="1.6s" repeatCount="indefinite"/></circle><text x="${x.x}" y="${x.y + 3.5}" font-size="10" text-anchor="middle" fill="#000" font-weight="800">!</text>` : ''}</g>`; }).join('');
    const label = warnJ ? `<g><line x1="${warnJ.x + 10}" y1="${warnJ.y}" x2="${warnJ.x + 22}" y2="${warnJ.y}" stroke="var(--warn)" stroke-width="1.5"/><rect x="${warnJ.x + 22}" y="${warnJ.y - 13}" width="118" height="26" rx="6" fill="var(--warn-soft)" stroke="var(--warn)"/><text x="${warnJ.x + 30}" y="${warnJ.y + 4.5}" font-size="12" fill="var(--warn)" font-weight="700">${warnJ.part.slice(0, 1)}${warnJ.nm.slice(0, 1)} ${warnJ.id} · 温度预警</text></g>` : '';
    return `<svg viewBox="0 0 300 480" style="width:100%;max-height:560px;display:block">${body}<g>${dots}</g>${label}</svg>`;
  };
  const bodyView = (j, L, warn) => `<div style="display:grid;grid-template-columns:340px minmax(0,1fr) 340px;gap:16px;align-items:start" class="bd3">
    <div class="card pad"><div class="row"><b class="h3">机器人视图</b><span class="grow"></span><div class="seg"><button class="${side === 'front' ? 'on' : ''}" data-side="front">正面</button><button class="${side === 'back' ? 'on' : ''}" data-side="back">背面</button></div></div>
      <div style="margin-top:12px;background:var(--card2);border-radius:12px;padding:6px">${figure()}</div>
      <div class="row wrap" style="margin-top:10px;font-size:12.5px;color:var(--dim);gap:10px 14px;white-space:nowrap"><span><i class="dot"></i> 正常</span><span><i class="dot" style="background:var(--warn)"></i> 预警</span><span><i class="dot off"></i> 无回读</span><span class="grow"></span><button class="btn sm">✥ 旋转视图</button><button class="btn sm">↺ 重置</button></div>
      <div class="card" style="margin-top:12px;padding:12px 14px;box-shadow:none"><div class="row"><span style="font-size:22px">🖧</span><div><b>主控连接</b><div class="sub" style="margin:0;font-size:13px">以太网 · ${esc(B.ip)}</div></div><span class="grow"></span><span class="pill ok" style="white-space:nowrap">● 已连接</span></div></div></div>
    <div class="card pad"><b class="h3">全部元件（${all.length + B.sensors.length + B.power.length}）</b><div class="row" style="margin-top:10px;white-space:nowrap"><input id="bdQ" placeholder="🔍 搜索名称 / ID" value="${esc(q)}" style="flex:1;min-width:0;padding:7px 10px"><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="bdBad" ${onlyBad ? 'checked' : ''} style="width:auto">仅看异常</label></div>
      <div class="sub" style="margin-top:12px">▾ 关节电机（${all.length}）</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:8px">${B.parts.map(pt => { const js = pt.joints.map(([id, nm]) => ({ id, nm })).filter(x => (!onlyBad || stOf(x.id) === 'warn') && (!q || (x.id + x.nm).toLowerCase().includes(q))); return js.length ? `<div class="card" style="padding:10px 12px;box-shadow:none"><b style="font-size:13.5px">${esc(pt.nm)} · ${pt.joints.length}</b>${js.map(x => { const st = stOf(x.id); return `<div class="row jrow ${x.id === sel ? 'on' : ''}" data-j="${x.id}" style="font-size:12.5px;padding:4px 6px;margin:2px -6px;border-radius:6px;cursor:pointer;white-space:nowrap;gap:8px;${x.id === sel ? 'background:var(--acc-soft)' : ''}"><i class="dot" style="background:${st === 'warn' ? 'var(--warn)' : 'var(--ok)'}"></i><span class="mono" style="color:var(--dim)">${x.id}</span><span>${esc(x.nm)}</span><span class="grow"></span><span style="color:${st === 'warn' ? 'var(--warn)' : 'var(--dim)'}">${st === 'warn' ? '温度预警' : '正常'}</span></div>`; }).join('')}</div>` : ''; }).join('')}</div>
      <div class="sub" style="margin-top:14px">▾ 传感器与交互（${B.sensors.length}）</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px">${B.sensors.map(([nm, st, ic]) => `<div class="card" style="padding:10px 12px;box-shadow:none;display:flex;gap:10px;align-items:center"><span style="font-size:20px">${ic}</span><div><b style="font-size:13.5px">${esc(nm)}</b><div class="sub" style="margin:0;font-size:12px;color:var(--ok)">${esc(st)}</div></div></div>`).join('')}</div>
      <div class="sub" style="margin-top:14px">▾ 控制与电源（${B.power.length}）</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px">${B.power.map(([nm, st, ic]) => `<div class="card" style="padding:10px 12px;box-shadow:none;display:flex;gap:10px;align-items:center"><span style="font-size:20px">${ic}</span><div><b style="font-size:13.5px">${esc(nm)}</b><div class="sub" style="margin:0;font-size:12px;color:${st === '在线' ? 'var(--ok)' : 'var(--dim)'}">${esc(st)}</div></div></div>`).join('')}</div></div>
    <div class="card pad"><div class="row"><b class="h3">元件详情</b><span class="grow"></span><button class="btn sm">✎ 编辑</button></div>
      <div class="row" style="margin-top:12px"><span style="font-size:40px">⚙️</span><div><b style="font-size:20px">${esc(j.part)}${esc(j.nm.slice(0, 2))}关节</b><div class="row" style="gap:8px"><span class="sub" style="margin:0">${j.id} · 关节电机</span>${warn ? '<span class="pill warn">❗ 温度预警</span>' : '<span class="pill ok">正常</span>'}</div></div></div>
      <div class="row" style="margin-top:8px;font-size:13px;color:var(--dim)"><span>${esc(B.bus.split(' ')[0])} · 地址 0x${(all.indexOf(j) + 1).toString(16).padStart(2, '0')}</span><span class="pill ok">● 在线</span><span class="grow"></span><span>来源：设备回读</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">${[['当前位置', L.pos + '°', ''], ['电机温度', L.temp + '℃', warn ? 'color:var(--warn)' : ''], ['工作电流', L.cur + ' A', ''], ['母线电压', L.volt + ' V', '']].map(([k, val, st]) => `<div class="card" style="padding:12px 14px;box-shadow:none"><div class="sub" style="margin:0;font-size:12.5px">${k}</div><b style="font-size:22px;font-family:var(--mono);${st}">${val}</b></div>`).join('')}</div>
      ${L.trend ? `<div style="margin-top:14px"><div class="row"><span class="sub" style="margin:0;font-size:13px">温度趋势 · 最近 60 秒</span><span class="grow"></span><span style="font-size:12px;color:var(--warn)">配置阈值 ${B.threshold}℃</span></div>${trendSVG(L.trend, B.threshold)}</div>
      <div class="card" style="margin-top:12px;padding:12px 14px;box-shadow:none;background:var(--warn-soft);border-color:color-mix(in srgb,var(--warn) 40%,transparent)"><b style="color:var(--warn)">❗ 温度超过当前配置阈值</b><div class="sub" style="margin:0;font-size:13px">当前 ${L.temp}℃，配置阈值 ${B.threshold}℃</div></div>` : `<div class="sub" style="margin-top:14px;font-size:13px">该关节各项指标在阈值内</div>`}
      <div style="margin-top:16px"><b>✦ AI 诊断助手</b><div class="sub" style="font-size:14px;margin-top:4px">${warn ? `${esc(j.part)}${esc(j.nm.slice(0, 2))}关节仍在线。建议暂停负载动作，检查散热与机械阻力，再复测温度。` : '未见异常。可对该关节做空载/带载对比，确认电流曲线正常。'}</div>
        <div class="card" style="margin-top:8px;padding:8px 12px;box-shadow:none;background:var(--card2);font-size:13px">📄 依据：温度回读 · 设备配置</div></div>
      <button class="btn primary" style="width:100%;justify-content:center;margin-top:14px" id="bdSteps">📄 查看排查步骤</button>
      <button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="bdReport">✎ 导出诊断报告</button>
      <div class="row" style="margin-top:10px"><input id="bdAsk" placeholder="向 AI 描述你遇到的问题…" style="flex:1"><button class="btn primary sm" id="bdAskGo">➤</button></div></div></div>
    <style>@media(max-width:1100px){.bd3{grid-template-columns:1fr!important}}</style>`;
  const trendSVG = (t, th) => { const W = 320, H = 110, lo = 40, hi = 90; const X = i => 10 + i * (W - 20) / (t.length - 1), Y = val => H - 10 - (val - lo) * (H - 20) / (hi - lo);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;margin-top:6px"><g stroke="var(--line)" stroke-width="1">${[45, 65, 85].map(g => `<line x1="10" y1="${Y(g)}" x2="${W - 10}" y2="${Y(g)}"/>`).join('')}</g>
      <line x1="10" y1="${Y(th)}" x2="${W - 10}" y2="${Y(th)}" stroke="var(--warn)" stroke-dasharray="4 3"/>
      <path d="M${t.map((val, i) => `${X(i)},${Y(val)}`).join(' L')}" fill="none" stroke="var(--warn)" stroke-width="2.5"/>
      <path d="M${X(0)},${Y(lo)} L${t.map((val, i) => `${X(i)},${Y(val)}`).join(' L')} L${X(t.length - 1)},${Y(lo)} Z" fill="var(--warn)" opacity=".12"/>
      ${[[40, '-60秒'], [t.length - 1, '现在']].map(([i, s]) => `<text x="${i === 40 ? 10 : X(t.length - 1)}" y="${H - 1}" font-size="10" fill="var(--mute)" text-anchor="${i === 40 ? 'start' : 'end'}">${s}</text>`).join('')}
      ${[45, 65, 85].map(g => `<text x="0" y="${Y(g) + 3}" font-size="9" fill="var(--mute)">${g}</text>`).join('')}</svg>`; };
  const busView = () => `<div class="card pad"><b class="h3">连接与总线</b><div class="kv" style="margin-top:12px"><span>主控计算板</span><div>以太网 · ${esc(B.ip)} · SSH</div><span>运动控制板</span><div>${esc(B.bus)} · 24 从站 0x01–0x18</div><span>帧格式</span><div class="mono" style="font-size:12.5px">0x100+addr 请求 · 0x200+addr 回读(pos temp cur volt flags) · 0x300 扭矩上限 · 0x400 目标位置</div><span>总线负载</span><div>24 帧 / 20 ms ≈ 18%（1 Mbps）</div><span>丢帧</span><div>最近 60 秒 0</div></div>
    <table class="tb" style="margin-top:16px"><thead><tr><th>关节</th><th>地址</th><th>回读延迟</th><th>状态</th></tr></thead><tbody>${all.map((x, i) => `<tr><td class="mono">${x.id} ${esc(x.nm)}</td><td class="mono">0x${(i + 1).toString(16).padStart(2, '0')}</td><td class="mono">${(0.12 + (i % 5) * 0.03).toFixed(2)} ms</td><td><span class="pill ${stOf(x.id) === 'warn' ? 'warn' : 'ok'}">${stOf(x.id) === 'warn' ? '温度预警' : '正常'}</span></td></tr>`).join('')}</tbody></table></div>`;
  const logView = () => { const lines = ['[INFO] brain: CAN1 up, 24 joints discovered', '[INFO] motion: gait loop 1kHz started', '[INFO] brain: poll 24 joints / 20ms, bus load 18%', '[WARN] J16 膝部俯仰: temp 66℃ ≥ 65℃', '[WARN] J16 膝部俯仰: temp 67℃ ≥ 65℃', '[INFO] brain: J16 torque limit → 50%', '[WARN] J16 膝部俯仰: temp 68℃ ≥ 65℃'];
    return `<div class="card pad"><div class="row"><b class="h3">运行日志</b><span class="grow"></span><button class="btn link sm" id="bdCopy">⧉ 复制日志</button></div><div class="code" style="margin-top:12px;border-radius:10px">${lines.map((l, i) => `<div class="ln"><span class="n">${i + 1}</span><span class="${l.includes('WARN') ? 'num' : ''}">${esc(l)}</span></div>`).join('')}</div></div>`; };
  const bind = () => {
    v.querySelectorAll('[data-tab]').forEach(a => a.onclick = () => { tab = a.dataset.tab; draw(); });
    v.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { side = b.dataset.side; draw(); });
    v.querySelectorAll('.jt,[data-j]').forEach(el => el.onclick = () => { sel = el.dataset.j; draw(); });
    const qi = $('#bdQ'); if (qi) qi.oninput = e => { q = e.target.value.toLowerCase(); draw(); $('#bdQ').focus(); $('#bdQ').setSelectionRange(q.length, q.length); };
    const ob = $('#bdBad'); if (ob) ob.onchange = e => { onlyBad = e.target.checked; draw(); };
    $('#bdRefresh').onclick = () => { toast('已刷新元件'); draw(); };
    $('#bdScan').onclick = async () => { if (scanning) return; scanning = true; draw();
      if (state.bridge) { try { await runOnBridge(p.devices[0].plat, `全身诊断：通过 CAN 轮询 24 路关节的位置/温度/电流/电压，标出超阈值(${B.threshold}℃ / 2.5A)的关节，给出结论`, () => {}); toast('全身诊断完成（本机执行）'); } catch (e) { toast('✗ ' + e.message); } }
      else { for (const x of all) { sel = x.id; draw(); await sleep(45); } sel = all.find(x => stOf(x.id) === 'warn') ? all.find(x => stOf(x.id) === 'warn').id : 'J16'; toast(`全身诊断完成：${warnN()} 项预警`); }
      scanning = false; draw(); };
    const st = $('#bdSteps'); if (st) st.onclick = () => modal(`<div class="hd"><b class="h3">排查步骤 · ${sel}</b><span class="grow"></span><button class="btn sm" data-close>关闭</button></div><div class="bd"><ul class="plan">${['暂停负载动作，让关节空载 60 秒复测温度','检查散热片与风道是否被线束遮挡','手动转动关节，感受是否有机械阻力/异响','空载 vs 带载电流对比：带载 > 2× 空载 → 机械问题','以上都正常 → 更换驱动板复测'].map(x => `<li><span class="ck">✓</span>${x}</li>`).join('')}</ul></div>`);
    const rp = $('#bdReport'); if (rp) rp.onclick = () => { const txt = `人形机器人 · 全身诊断报告\n${new Date().toLocaleString()}\n\n预警 ${warnN()} 项\n` + all.map(x => `${x.id} ${x.part}${x.nm}  ${stOf(x.id) === 'warn' ? '⚠ 温度预警 ' + live(x.id).temp + '℃' : '正常'}`).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = '全身诊断报告.txt'; a.click(); };
    const ag = $('#bdAskGo'); if (ag) ag.onclick = () => { const t = $('#bdAsk').value.trim(); if (!t) return; $('#bdAsk').value = ''; if (state.bridge) runOnBridge(p.devices[0].plat, `关于 ${sel} 的问题：${t}`, () => {}).then(() => toast('已回答，见对话')); else toast('需要本机桥接'); };
    const cp = $('#bdCopy'); if (cp) cp.onclick = () => toast('日志已复制');
  };
  draw();
}

/* ═══════════ 仿真工作台 ═══════════ */
let simTimer = null;
function vSim(v){
  const S = D.sim; const p = state.projects.find(x => x.body) || state.projects[0];
  crumb(p.nm, '仿真工作台');
  const st = { t: 7.2, playing: true, speed: 1, engine: 'isaac', env: 1, tab: 'motion', task: { ...S.task }, log: [] };
  const T = 20;
  const seg = t => S.segments.find(([, , a, b]) => t >= a && t < b) || S.segments[S.segments.length - 1];
  const dist = t => Math.max(0, Math.min(st.task.dist, (t - 3) / 9 * st.task.dist));
  const fmt = t => `00:${String(Math.floor(t)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
  clearInterval(simTimer);
  const draw = () => {
    v.innerHTML = `<div class="row"><div><div class="h1">仿真工作台</div></div><span class="grow"></span>
      <button class="btn" id="simStop" style="color:var(--err);border-color:color-mix(in srgb,var(--err) 40%,transparent)">■ 停止</button><button class="btn primary" id="simPause">${st.playing ? '❚❚ 暂停仿真' : '▶ 继续仿真'}</button></div>
    <div class="row wrap" style="margin-top:16px"><select style="min-width:240px"><option>${esc(p.body ? p.body.model : p.nm)} · ${p.body ? p.body.dof : p.devices.length} 自由度</option></select>
      <span class="pill ${st.playing ? 'ok' : 'gray'}">● ${st.playing ? '仿真运行中' : '已暂停'}</span><span class="sub" style="margin:0">实例 ${esc(S.instance)}</span></div>
    <div class="tabs">${[['motion','运动仿真'],['model','模型与关节'],['log','运行日志'],['hist','历史记录']].map(([k, n]) => `<a href="javascript:void 0" data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${n}</a>`).join('')}</div>
    <div class="sim3" style="display:grid;grid-template-columns:250px minmax(0,1fr) 340px;gap:16px;margin-top:16px;align-items:start">
      <div>
        <div class="card pad"><b class="h3">仿真引擎</b><div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${S.engines.map(e => `<button class="card" data-eng="${e.id}" style="padding:10px 12px;display:flex;align-items:center;gap:10px;text-align:left;box-shadow:none;${st.engine === e.id ? 'border-color:var(--acc);background:var(--acc-soft)' : ''}"><span style="font-size:18px">${e.ic}</span><b class="grow">${esc(e.nm)}</b><span class="pill ${st.engine === e.id ? '' : 'gray'}" style="font-size:11px">${st.engine === e.id ? '当前引擎' : '配置接口'}</span></button>`).join('')}</div><p style="margin-top:10px"><a href="javascript:void 0" id="simAddEng">＋ 添加其他引擎</a></p></div>
        <div class="card pad" style="margin-top:12px"><b class="h3">运行环境</b><div class="seg" style="margin-top:10px">${S.envs.map((e, i) => `<button class="${st.env === i ? 'on' : ''}" data-env="${i}" style="flex:1">${e}</button>`).join('')}</div>
          <select style="width:100%;margin-top:10px">${S.gpus.map(g => `<option>${g}</option>`).join('')}</select>
          <div class="row" style="margin-top:10px;font-size:13.5px"><span class="pill ok">● 已连接</span><span class="grow"></span><a href="javascript:void 0">管理连接</a></div><div class="sub" style="font-size:13px">🖥 画面连接：已就绪</div></div>
        <div class="card pad" style="margin-top:12px"><b class="h3">机器人与场景</b><div class="sub" style="font-size:12.5px;margin-top:8px">模型文件</div><div class="row" style="margin-top:4px"><input value="${esc(S.model)}" readonly style="flex:1;padding:7px 10px;font-family:var(--mono);font-size:12.5px"><button class="btn sm">导入模型</button></div>
          <div class="row" style="margin-top:8px;font-size:13.5px"><span class="pill ok">✓</span>关节映射 <b>${p.body ? p.body.dof : p.devices.length} / ${p.body ? p.body.dof : p.devices.length}</b></div>
          <div class="kv" style="margin-top:10px;font-size:13.5px"><span>场景</span><select style="padding:6px 10px">${S.scenes.map(x => `<option>${x}</option>`).join('')}</select><span>控制器</span><select style="padding:6px 10px">${S.controllers.map(x => `<option>${x}</option>`).join('')}</select></div>
          <div class="row" style="margin-top:8px;font-size:13px"><span class="pill ok">✓</span>控制器与当前模型匹配<span class="grow"></span><a href="javascript:void 0">导入运动策略</a></div></div>
      </div>
      <div>
        <div class="card pad"><div class="row"><b class="h3">实时仿真画面</b><span class="grow"></span><select style="padding:6px 10px"><option>跟随视角</option><option>固定视角</option><option>俯视</option></select><button class="btn sm">⛶</button></div>
          <div style="position:relative;margin-top:12px;border-radius:12px;overflow:hidden;background:#0b1220"><canvas id="simCv" width="880" height="480" style="width:100%;display:block"></canvas>
            <div style="position:absolute;top:12px;left:12px;display:flex;gap:8px"><span class="pill ok" style="background:rgba(22,163,74,.9);color:#fff">● ${esc(seg(st.t)[0])}中</span><span class="pill" style="background:rgba(0,0,0,.55);color:#fff">目标速度 ${st.task.speed.toFixed(2)} m/s</span></div>
            <span class="badge" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.6);color:#fff;border:0">SIMULATION</span>
            <div style="position:absolute;right:12px;bottom:12px;width:190px;height:96px;border-radius:8px;background:#0e1626;border:1px solid rgba(255,255,255,.2);color:#cfd8e6;font-size:11px;padding:6px 8px">机器人视角<canvas id="simPip" width="190" height="70" style="width:100%;height:70px;display:block;margin-top:4px"></canvas></div></div>
          <div class="row" style="margin-top:12px"><button class="btn primary sm" id="simPP">${st.playing ? '❚❚' : '▶'}</button><button class="btn sm" id="simSq">■</button><button class="btn sm" id="simStep">▶| 单步</button><button class="btn sm" id="simReset">↺ 重置</button>
            <select id="simSpd" style="padding:6px 10px">${[0.25, 0.5, 1, 2].map(x => `<option ${x === st.speed ? 'selected' : ''} value="${x}">${x}×</option>`).join('')}</select><span class="grow"></span><span class="mono" id="simClock">${fmt(st.t)} / ${fmt(T)}</span></div>
          <div id="simTl" style="margin-top:10px"></div>
          <div class="card" style="margin-top:12px;padding:12px 14px;box-shadow:none"><b class="h3">运行状态</b><div class="row" style="margin-top:8px;gap:0"><div class="grow" style="border-right:1px solid var(--line)">🚶 行进距离<br><b style="font-size:20px;font-family:var(--mono)" id="simDist">${dist(st.t).toFixed(2)} m</b></div><div class="grow" style="padding-left:16px;border-right:1px solid var(--line)">⚠ 异常碰撞<br><b style="font-size:20px;font-family:var(--mono)">0</b></div><div class="grow" style="padding-left:16px">⚙ 关节越限<br><b style="font-size:20px;font-family:var(--mono)">0</b></div><span class="sub" style="margin:0;font-size:12.5px">当前为仿真状态</span></div></div></div>
      </div>
      <div>
        <div class="card pad"><b class="h3">✦ AI 仿真助手</b>
          <div class="msg me" style="max-width:100%;margin-top:10px"><div class="bub" style="font-size:14px">让机器人向前走 ${st.task.dist} 米，转身后挥手。</div></div>
          <div class="msg" style="max-width:100%;margin-top:8px"><span class="av">EI</span><div class="bub" style="font-size:13.5px">已加载匹配的运动控制器，将按任务顺序运行并记录结果。</div></div>
          <div class="card" style="margin-top:12px;padding:12px 14px;box-shadow:none"><b>任务参数</b><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;font-size:12.5px">
            <div>前进距离<div class="row" style="gap:4px"><input id="tDist" value="${st.task.dist}" style="width:100%;padding:6px 8px">m</div></div><div>目标速度<div class="row" style="gap:4px"><input id="tSpeed" value="${st.task.speed}" style="width:100%;padding:6px 8px">m/s</div></div><div>转身角度<div class="row" style="gap:4px"><input id="tTurn" value="${st.task.turn}" style="width:100%;padding:6px 8px">°</div></div></div>
            <div class="row" style="margin-top:8px;justify-content:flex-end"><button class="btn sm" id="simApply">✎ 修改任务</button></div></div>
          <div class="card" style="margin-top:12px;padding:12px 14px;box-shadow:none"><b>执行进度</b><ul class="plan" id="simProg" style="margin-top:8px"></ul></div>
          <div class="card" style="margin-top:12px;padding:12px 14px;box-shadow:none"><b>仿真检查</b><ul class="plan" style="margin-top:8px"><li><span class="ck">✓</span>关节限位 <span class="grow"></span><span style="color:var(--ok)">当前正常</span></li><li><span class="ck">✓</span>异常碰撞 <span class="grow"></span><span style="color:var(--ok)">未检出</span></li><li><span class="ck" style="background:var(--card2);color:var(--mute)">·</span>任务完成 <span class="grow"></span><span class="sub" style="margin:0" id="simDone">待结束</span></li></ul>
            <div class="row" style="margin-top:8px;font-size:12.5px"><span class="grow"></span><button class="btn sm" id="simLog">📄 查看仿真日志</button></div></div>
          <div class="row" style="margin-top:12px"><input id="simAsk" placeholder="描述你想调整的动作…" style="flex:1"><button class="btn primary sm" id="simAskGo">➤</button></div>
          <div class="sub" style="font-size:12px;margin-top:6px">本轮 AI 用量 0.18M tokens</div></div>
      </div>
    </div>
    <style>@media(max-width:1200px){.sim3{grid-template-columns:1fr!important}}</style>`;
    bind(); tick(true);
  };
  const timeline = () => {
    const el = $('#simTl'); if (!el) return;
    el.innerHTML = `<div class="row" style="font-size:11px;color:var(--mute);justify-content:space-between;padding:0 2px">${[0, 5, 10, 15, 20].map(x => `<span>${x}s</span>`).join('')}</div>
      <div style="position:relative;height:6px;background:var(--card2);border-radius:3px;margin:4px 0 8px"><div style="position:absolute;left:${st.t / T * 100}%;top:-6px;width:2px;height:18px;background:var(--acc)"></div><span class="mono" style="position:absolute;left:${st.t / T * 100}%;top:-24px;transform:translateX(-50%);font-size:11px;color:var(--acc);font-weight:700">${st.t.toFixed(1)}s</span></div>
      <div style="display:flex;gap:4px">${S.segments.map(([n, d, a, b]) => { const on = st.t >= a && st.t < b; return `<div style="flex:${b - a};padding:8px 6px;border-radius:8px;text-align:center;font-size:12.5px;background:${on ? 'var(--acc)' : 'var(--card2)'};color:${on ? 'var(--acc-txt)' : 'var(--dim)'}"><b>${n}${d && n === '前进' ? ' ' + st.task.dist + ' m' : d ? ' ' + d : ''}</b><div style="font-size:11px;opacity:.85">${a} – ${b}s</div></div>`; }).join('')}</div>`;
    const prog = $('#simProg'); if (prog) prog.innerHTML = S.segments.map(([n, , a, b]) => { const done = st.t >= b, run = st.t >= a && st.t < b;
      return `<li><span class="ck" style="${done ? '' : run ? 'background:var(--acc-soft);color:var(--acc);border:2px solid var(--acc)' : 'background:var(--card2);color:var(--mute)'}">${done ? '✓' : run ? '●' : '·'}</span>${n === '站立' ? '站立准备' : n === '前进' ? '向前行走' : n}<span class="grow"></span><span style="color:${done ? 'var(--ok)' : run ? 'var(--acc)' : 'var(--mute)'};font-size:13px">${done ? '完成' : run ? '运行中' : '等待'}</span></li>`; }).join('');
    const dn = $('#simDone'); if (dn) dn.textContent = st.t >= T ? '已完成' : '待结束';
  };
  /* 画面: 透视地面 + 目标点 + 轨迹 + 行走中的小人形(用全身诊断同一套关节骨架简化) */
  const scene = () => {
    const cv = $('#simCv'); if (!cv) return; const c = cv.getContext('2d'); const W = cv.width, H = cv.height;
    c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, '#182338'); g.addColorStop(1, '#0e1729'); c.fillStyle = g; c.fillRect(0, H * 0.45, W, H * 0.55);
    c.strokeStyle = 'rgba(120,150,200,.18)'; c.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { const x = i / 12; c.beginPath(); c.moveTo(W * 0.5 + (x - 0.5) * W * 0.5, H * 0.45); c.lineTo(W * 0.5 + (x - 0.5) * W * 1.6, H); c.stroke(); }
    for (let i = 0; i <= 10; i++) { const y = H * 0.45 + Math.pow(i / 10, 1.6) * H * 0.55; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const prog = Math.min(1, dist(st.t) / st.task.dist);
    const px = (u) => W * 0.5 + (u - 0.5) * W * 0.9, py = (dep) => H * 0.45 + Math.pow(1 - dep, 1.6) * H * 0.5;   // dep 0=远 1=近
    const P0 = [0.34, 0.12], P1 = [0.60, 0.70];   // 终点落在画面中上部, 别被右下角小窗挡住   // 起点(近左) → 目标(远右)
    const lerp = (a, b, k) => a + (b - a) * k;
    const flagU = P1[0], flagD = P1[1];
    c.setLineDash([6, 8]); c.strokeStyle = 'rgba(80,160,255,.8)'; c.lineWidth = 3; c.beginPath();
    for (let k = 0; k <= 1; k += 0.05) { const u = lerp(P0[0], P1[0], k), d = lerp(P0[1], P1[1], k); const X = px(u), Y = py(1 - d); k ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); c.setLineDash([]);
    const fx = px(flagU), fy = py(1 - flagD); c.fillStyle = '#3b82f6'; c.fillRect(fx - 1.5, fy - 34, 3, 34); c.beginPath(); c.moveTo(fx + 1, fy - 34); c.lineTo(fx + 22, fy - 27); c.lineTo(fx + 1, fy - 20); c.fill();
    c.fillStyle = 'rgba(59,130,246,.9)'; c.font = '600 12px system-ui'; c.fillText(`目标点 · ${st.task.dist} m`, fx + 26, fy - 22);
    const u = lerp(P0[0], P1[0], prog), d = lerp(P0[1], P1[1], prog); const X = px(u), Y = py(1 - d), sc = 1.35 - d * 0.55;
    const phase = st.t * 6, swing = seg(st.t)[0] === '前进' ? Math.sin(phase) * 0.35 : 0, wave = seg(st.t)[0] === '挥手' ? Math.sin(st.t * 8) * 0.5 - 1.2 : 0.2;
    c.save(); c.translate(X, Y); c.scale(sc, sc);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 4, 26, 7, 0, 0, Math.PI * 2); c.fill();
    const limb = (x1, y1, x2, y2, w) => { c.strokeStyle = '#e8edf5'; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = '#9aa7bb'; c.lineWidth = w + 2; c.globalAlpha = .35; c.stroke(); c.globalAlpha = 1; };
    const joint = (x, y, r = 4) => { c.fillStyle = '#2dd4bf'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0b1220'; c.lineWidth = 1.5; c.stroke(); };
    // 腿
    limb(-8, -60, -8 - Math.sin(phase) * 14, -30, 12); limb(-8 - Math.sin(phase) * 14, -30, -8 - Math.sin(phase) * 10, -2, 10);
    limb(8, -60, 8 + Math.sin(phase) * 14, -30, 12); limb(8 + Math.sin(phase) * 14, -30, 8 + Math.sin(phase) * 10, -2, 10);
    // 躯干
    c.fillStyle = '#f1f4f9'; c.strokeStyle = '#b5c0d2'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-18, -128, 36, 70, 12); c.fill(); c.stroke();
    c.fillStyle = '#2dd4bf'; c.beginPath(); c.arc(0, -108, 3.5, 0, Math.PI * 2); c.fill();
    // 手臂
    limb(-18, -118, -26 + swing * 20, -86, 9); limb(-26 + swing * 20, -86, -28 + swing * 26, -58, 8);
    limb(18, -118, 26 - swing * 20, -86, 9); limb(26 - swing * 20, -86, 30 - swing * 26, -58 + wave * 40, 8);
    // 头
    c.fillStyle = '#f1f4f9'; c.beginPath(); c.roundRect(-13, -158, 26, 26, 9); c.fill(); c.stroke();
    c.fillStyle = '#141b2b'; c.beginPath(); c.roundRect(-9, -150, 18, 8, 4); c.fill(); c.fillStyle = '#2dd4bf'; c.fillRect(-6, -147, 12, 2);
    [[-8, -60], [8, -60], [-8 - Math.sin(phase) * 14, -30], [8 + Math.sin(phase) * 14, -30], [-18, -118], [18, -118], [-26 + swing * 20, -86], [26 - swing * 20, -86], [0, -132]].forEach(([x, y]) => joint(x, y));
    c.restore();
    // 坐标轴
    c.strokeStyle = '#ef4444'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, H - 22); c.lineTo(48, H - 14); c.stroke(); c.strokeStyle = '#22c55e'; c.beginPath(); c.moveTo(24, H - 22); c.lineTo(52, H - 30); c.stroke(); c.strokeStyle = '#3b82f6'; c.beginPath(); c.moveTo(24, H - 22); c.lineTo(24, H - 50); c.stroke();
    c.fillStyle = '#cbd5e1'; c.font = '10px system-ui'; c.fillText('Z', 20, H - 52); c.fillText('Y', 54, H - 30); c.fillText('X', 50, H - 8);
    // 小窗: 机器人视角(目标点在前方)
    const pv = $('#simPip'); if (pv) { const q = pv.getContext('2d'); q.fillStyle = '#0e1626'; q.fillRect(0, 0, 190, 70); q.strokeStyle = 'rgba(120,150,200,.25)'; for (let i = 0; i < 6; i++) { q.beginPath(); q.moveTo(95 + (i - 2.5) * 12, 30); q.lineTo(95 + (i - 2.5) * 70, 70); q.stroke(); } const fy2 = 30 + (1 - prog) * 30; q.fillStyle = '#3b82f6'; q.fillRect(94, fy2 - 14, 2, 14); q.beginPath(); q.moveTo(96, fy2 - 14); q.lineTo(106, fy2 - 10); q.lineTo(96, fy2 - 6); q.fill(); }
  };
  const tick = force => {
    if (st.playing && !force) st.t = Math.min(T, st.t + 0.1 * st.speed);
    if (st.t >= T && st.playing) { st.playing = false; const b = $('#simPause'); if (b) b.textContent = '▶ 继续仿真'; const pp = $('#simPP'); if (pp) pp.textContent = '▶'; }
    const ck = $('#simClock'); if (ck) ck.textContent = `${fmt(st.t)} / ${fmt(T)}`;
    const ds = $('#simDist'); if (ds) ds.textContent = dist(st.t).toFixed(2) + ' m';
    timeline(); scene();
  };
  const bind = () => {
    v.querySelectorAll('[data-tab]').forEach(a => a.onclick = () => { st.tab = a.dataset.tab; if (st.tab !== 'motion') toast(`「${a.textContent}」`); });
    v.querySelectorAll('[data-eng]').forEach(b => b.onclick = () => { st.engine = b.dataset.eng; draw(); });
    v.querySelectorAll('[data-env]').forEach(b => b.onclick = () => { st.env = +b.dataset.env; draw(); });
    const pp = () => { st.playing = !st.playing; $('#simPause').textContent = st.playing ? '❚❚ 暂停仿真' : '▶ 继续仿真'; $('#simPP').textContent = st.playing ? '❚❚' : '▶'; };
    $('#simPause').onclick = pp; $('#simPP').onclick = pp;
    $('#simStop').onclick = () => { st.playing = false; st.t = 0; draw(); }; $('#simSq').onclick = () => { st.playing = false; st.t = 0; draw(); };
    $('#simStep').onclick = () => { st.playing = false; st.t = Math.min(T, st.t + 0.5); tick(true); };
    $('#simReset').onclick = () => { st.t = 0; st.playing = true; draw(); };
    $('#simSpd').onchange = e => { st.speed = +e.target.value; };
    $('#simApply').onclick = () => { st.task = { dist: +$('#tDist').value || 2, speed: +$('#tSpeed').value || 0.3, turn: +$('#tTurn').value || 180 }; st.t = 0; st.playing = true; toast('任务已更新，重新运行'); draw(); };
    $('#simLog').onclick = () => modal(`<div class="hd"><b class="h3">仿真日志 · ${esc(S.instance)}</b><span class="grow"></span><button class="btn sm" data-close>关闭</button></div><div class="bd"><div class="code" style="border-radius:10px">${['[INFO] engine: Isaac Sim 6.0 · GPU-01', `[INFO] model: ${S.model} · joints 24/24 mapped`, '[INFO] controller: H24 步行控制器 v0.3 loaded', '[INFO] task: walk 2.0 m @ 0.30 m/s → turn 180° → wave', '[INFO] t=3.0 stand ok · CoM stable', `[INFO] t=${st.t.toFixed(1)} dist=${dist(st.t).toFixed(2)} m · collisions 0 · joint limits 0`].map((l, i) => `<div class="ln"><span class="n">${i + 1}</span><span>${esc(l)}</span></div>`).join('')}</div></div>`);
    $('#simAskGo').onclick = () => { const t = $('#simAsk').value.trim(); if (!t) return; $('#simAsk').value = ''; const m = t.match(/(\d+(?:\.\d+)?)\s*米/); if (m) { st.task.dist = +m[1]; st.t = 0; st.playing = true; toast(`已把前进距离改为 ${m[1]} m`); draw(); } else toast(state.bridge ? '已交给本机桥接' : '需要本机桥接'); };
    $('#simAddEng').onclick = () => toast('添加引擎');
    clearInterval(simTimer); simTimer = setInterval(() => { if (!document.getElementById('simCv')) { clearInterval(simTimer); return; } tick(); }, 100);
  };
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
      <div class="row"><div class="h1">经验与模板</div></div>
      <input id="tq" placeholder="🔍 搜索板卡、传感器或开发任务…" value="${esc(q)}" style="width:100%;margin-top:18px">
      <div class="filters">${D.templateCats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
      <div class="tplgrid">${list.map(x => `<div class="card tpl ${x.id === sel ? 'sel' : ''}" data-t="${x.id}">${x.verified ? '<span class="pill ok vf">✓ 已验证</span>' : ''}<div class="ic">${x.ico}</div><b class="h3">${esc(x.nm)}</b>
        <div class="tags">${x.tags.map(g => `<span>${esc(g)}</span>`).join('')}</div><div class="sub" style="margin:0;font-size:13.5px">${esc(x.sub)}</div><div class="row" style="margin-top:10px"><span class="sub" style="margin:0;font-size:13px">${esc(x.ver)}</span><span class="grow"></span>›</div></div>`).join('')}</div>
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
    v.innerHTML = `<div class="row"><div><div class="h1">发现好玩的具身智能装置</div></div><span class="grow"></span>
      <button class="btn" id="cartBtn">🛒 购物车 <span class="pill">${state.cart.length}</span></button><button class="btn">📄 我的订单</button></div>
      <input id="sq" placeholder="🔍 搜索机器人、机械臂或开发套件…" value="${esc(q)}" style="width:100%;margin-top:18px">
      <div class="row" style="margin-top:12px"><div class="filters" style="margin:0">${D.storeCats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div><span class="grow"></span><label class="row" style="gap:6px;font-size:14px"><input type="checkbox" id="fit" ${fitOnly ? 'checked' : ''} style="width:auto">仅看 EI TOKEN 已适配</label></div>
      <div class="tplgrid">${list.map(s => `<div class="card tpl" style="cursor:default"><div class="hero2" style="height:150px;margin:0 0 12px;font-size:64px">${s.ico}</div><b class="h3">${esc(s.nm)}</b><div class="sub" style="margin:2px 0 6px;font-size:13.5px">${esc(s.sub)}</div>
        <div class="tags">${s.tags.map(g => `<span>${esc(g)}</span>`).join('')}${s.fit ? '<span style="background:var(--ok-soft);color:var(--ok)">EI TOKEN 已适配</span>' : ''}</div>
        <div class="sub" style="font-size:12.5px;margin:0">原型：${esc(s.proto)}</div>
        <div class="row" style="margin-top:12px"><b style="font-size:20px">¥${s.price.toLocaleString()}</b><span class="grow"></span><button class="btn sm" data-add="${s.id}">🛒 加入购物车</button></div></div>`).join('')}</div>`;
    $('#sq').oninput = e => { q = e.target.value.toLowerCase(); draw(); $('#sq').focus(); $('#sq').setSelectionRange(q.length, q.length); };
    v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    $('#fit').onchange = e => { fitOnly = e.target.checked; draw(); };
    v.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { state.cart.push(b.dataset.add); LS.set('cart', state.cart); toast('已加入购物车'); draw(); });
    $('#cartBtn').onclick = () => { const items = state.cart.map(id => D.store.find(s => s.id === id)); const sum = items.reduce((a, s) => a + s.price, 0);
      modal(`<div class="hd"><b class="h3">购物车</b><span class="grow"></span><button class="btn sm" data-close>关闭</button></div><div class="bd">${items.length ? `<table class="tb">${items.map(s => `<tr><td>${s.ico} ${esc(s.nm)}</td><td class="mono">¥${s.price}</td></tr>`).join('')}<tr><td><b>合计</b></td><td class="mono"><b>¥${sum}</b></td></tr></table><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="clearCart">清空</button><button class="btn primary" id="checkout">去结算</button></div>` : '<div class="sub">购物车是空的</div>'}</div>`);
      const c = $('#clearCart'); if (c) c.onclick = () => { state.cart = []; LS.set('cart', []); $('#modalRoot').innerHTML = ''; draw(); };
      const k = $('#checkout'); if (k) k.onclick = () => toast('未接支付'); };
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
  v.innerHTML = `<div class="row"><div><div class="h1">Token 用量与充值</div><div class="sub">按底层模型实际消耗的原始 Token 计费${real ? ' · <b>实时</b>' : ''}</div></div><span class="grow"></span>
      <div class="seg"><button class="on">个人</button><button>团队</button></div><select><option>📅 本月</option></select></div>
    <div class="stat3">
      <div class="card stat"><span class="ic">👛</span><div><div class="k">可用余额</div><div class="v">${yuan(U.balance - (real ? cost : 0))}</div></div></div>
      <div class="card stat"><span class="ic">📊</span><div><div class="k">本月原始 Token</div><div class="v">${fmtTok(tot)}</div></div></div>
      <div class="card stat"><span class="ic">💳</span><div><div class="k">本月消费</div><div class="v">${yuan(cost)}</div></div></div></div>
    <div class="usagegrid"><div class="card pad"><b class="h3">${real ? '按平台用量' : '项目用量'}</b>
      <table class="tb" style="margin-top:12px"><thead><tr><th>${real ? '平台' : '项目'}</th><th>原始 Token</th><th>费用</th><th>明细</th></tr></thead><tbody>
        ${by.map(x => `<tr><td>${x.p ? x.p.ico + ' ' + esc(x.p.nm) : esc(x.id)}</td><td class="mono">${fmtTok(x.tok)}</td><td class="mono">${yuan(x.cost)}</td><td><a href="#/usage">查看</a></td></tr>`).join('')}</tbody></table>
      <p class="sub" style="font-size:13px;margin-top:10px">▾ 按模型查看输入、缓存输入与输出明细${real ? `：命中 ${fmtTok(real.hit)} · 未命中 ${fmtTok(real.miss)} · 输出 ${fmtTok(real.out)}` : ''}</p>
      <div class="row" style="margin-top:18px"><b class="h3">${real ? '平台' : '项目'}用量占比（原始 Token）</b><span class="grow"></span><span class="sub" style="margin:0">总计 ${fmtTok(sum)}</span></div>
      <div class="bar">${by.map((x, i) => `<i style="width:${(x.tok / sum * 100).toFixed(1)}%;background:${cols[i % cols.length]}"></i>`).join('')}</div>
      <div class="legend">${by.map((x, i) => `<span style="--c:${cols[i % cols.length]}">${x.p ? esc(x.p.nm) : esc(x.id)}<small>${fmtTok(x.tok)} (${(x.tok / sum * 100).toFixed(1)}%)</small></span>`).join('')}</div></div>
    <div><div class="card pad"><b class="h3">购买 Token 用量</b><div class="sub" style="font-size:13px">充值后，按原始 Token 实际消耗结算</div>
      <div class="topup">${U.topups.map((t, i) => `<button class="${i === 1 ? 'on' : ''}" data-t="${t}">¥${t}</button>`).join('')}<button data-t="0">自定义金额</button></div>
      <button class="btn primary" style="width:100%;justify-content:center" id="topupBtn">充值</button></div>
      <div class="card pad" style="margin-top:16px"><b class="h3">预算控制</b><div class="sub" style="font-size:13px">单项目预算上限</div><input value="¥100.00" style="width:100%;margin-top:8px">
      <label class="row" style="margin-top:12px;gap:8px;font-size:14px"><input type="checkbox" checked style="width:auto">达到上限时暂停</label><p style="margin-top:10px"><a href="#/usage">团队额度分配 ›</a></p></div></div></div>`;
  v.querySelectorAll('.topup button').forEach(b => b.onclick = () => { v.querySelectorAll('.topup button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $('#topupBtn').onclick = () => toast('未接支付');
}

/* ───────── 启动 ───────── */
applyTheme(state.theme);
render();
syncHW();
/* 线上看本机设备：cos.html?hw=配对码（配对码由 npm run bridge 启动时给出） */
try{ const hq = new URLSearchParams(location.search).get('hw');
  if (hq) { state.relay = hq.trim().toUpperCase(); LS.set('relay', state.relay); render(); pullHW(); } }catch(e){}
/* 演示用：cos.html?sim=esp32,rdk#/devices 预置模拟设备，无硬件也能彩排 */
try{ const q=new URLSearchParams(location.search).get('sim');
  if(q) q.split(',').map(x=>x.trim()).filter(x=>platOf(x)).forEach(hwSim); }catch(e){}
probeBridge().then(ok => { if (ok) pullHW(); });
setInterval(pullUsage, 15000);
setInterval(pullHW, 3000);   // 本机桥接优先，没有就走中转
})();
