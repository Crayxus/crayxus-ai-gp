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
  // 深度识别的结果。设备列表是桥接每 3 秒推的、不持久化，刷一下页面 e.deep 就没了 ——
  // 而重新识别要复位一次设备（平衡车会摔），不能让用户为了看一眼面板再摔一次。存下来。
  deep: LS.get('hwdeep', {}),
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
        fetch(b + '/api/relay').then(x => x.json()).then(x => { if (x && x.enabled) { state.relayInfo = x;
          if (location.hash.startsWith('#/devices')) render(); } }).catch(() => {});
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
/** quiet=true：只建记录，不跳转也不触发旧的对话流程（跟随类任务走生成面板） */
function createProject(prompt, devIds, quiet){
  const id = 'p' + Date.now().toString(36);
  const devs = (devIds && devIds.length ? devIds : ['pi']).map((pid, i) => { const p = platOf(pid);
    return { id: 'd' + (i + 1), role: i === 0 ? '主控' : '执行端', plat: pid, conn: p.via === 'ssh' ? '网络连接' : '串口', env: p.rt, prog: `${pid}/main.py`, status: '未连接' }; });
  // 标题原来是硬截 12 字，既没省略号也没提示，字就这么没了。
  // 改成留够 18 字 + 省略号，完整那句存进 p.task，标题上挂 title 属性能悬停看全。
  const full = (prompt || '新项目').replace(/\s+/g, ' ').trim();
  const nm = full.length > 18 ? full.slice(0, 18) + '…' : full;
  const p = { id, user: true, nm, task: full, ico: '🛠️', ver: 'v0.1', budget: 100, devices: devs,
    link: devs.length > 1 ? { a: devs[0].role, b: devs[1].role, proto: '待生成', ver: '—' } : null, modules: [], wiring: [], chat: [], files: {} };
  state.projects.push(p); saveUserProjects(); renderSidebar();
  if (quiet) return p;
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
  // 自己建的项目挂一个 ✕，内置演示项目不给删（删了下次刷新又回来，反而像 bug）
  $('#projList').innerHTML = state.projects.map(p =>
    `<a href="#/project/${p.id}/chat" data-route="project:${p.id}" title="${esc(p.task || p.nm)}">
       <span class="ic">${p.ico}</span><span class="pnm">${esc(p.nm)}</span>
       ${p.user ? `<span class="del" data-del="${p.id}" title="删除项目">✕</span>` : ''}</a>`).join('');
  $('#projList').querySelectorAll('[data-del]').forEach(b => b.onclick = ev => {
    ev.preventDefault(); ev.stopPropagation();
    delProject(b.dataset.del);
  });
  const r = route(); const key = r.v === 'project' ? 'project:' + r.id : r.v;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.route === key));
}
function delProject(id){
  const i = state.projects.findIndex(p => p.id === id);
  if (i < 0) return;
  const p = state.projects[i];
  if (!confirm(`删除项目「${p.nm}」？\n（只删平台里的记录，不影响机器人上已部署的程序）`)) return;
  state.projects.splice(i, 1);
  saveUserProjects();
  if (gen && gen.projectId === id) { gen = null; stopGenPoll(); }   // 面板别留在那儿指着不存在的项目
  toast('已删除「' + p.nm + '」');
  if (location.hash.startsWith('#/project/' + id)) location.hash = '#/home';
  else render();
}
window.addEventListener('hashchange', render);
$('#newBtn').onclick = () => { location.hash = '#/home'; setTimeout(() => $('#prompt') && $('#prompt').focus(), 50); };

function render(){
  /* #/login 直达登录屏。做成路由而不是只挂在左下角：
     链接可以直接发给人，登录态过期弹出来之后地址栏也留着回得去的那一屏。
     已登录就别再挡着 —— 换成首页，否则看着像卡住。 */
  if (location.hash.replace(/^#\/?/, '').split('/')[0] === 'login') {
    if (window.EIT && !EIT.loggedIn()) { renderSidebar(); acctModal(() => { location.hash = '#/home'; }); return; }
    location.replace('#/home');
  }
  renderSidebar();
  const r = route(); const v = $('#view');
  ({ home: vHome, project: vProject, devices: vDevices, diagnose: vDiagnose, sim: vSim, templates: vTemplates, store: vStore, usage: vUsage })[r.v](v, r);
  window.scrollTo(0, 0);
}



/** ROS 标志：九个圆点的点阵是它最好认的特征。
    画成内联 SVG 而不是引图片 —— 不用多一次请求，跟着主题色走，缩放不糊。 */
/** 左栏那块大图：优先用真车照片 img/boards/roscar.jpg，
    取不到就退回矢量标志 —— 不会因为缺图开天窗。
    换车只要替换那个文件，代码不用动。 */
function rosHero(){
  return `<div class="roshero">
    <img class="rosphoto" src="img/boards/roscar.jpg" alt="ROS 小车"
         onerror="this.nextElementSibling.hidden=false;this.remove()">
    <div class="rosfallback" hidden>
      <svg viewBox="0 0 120 120" width="130" height="130" aria-label="ROS">
        <g opacity=".18">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--acc)" stroke-width="1.5"/>
          <circle cx="60" cy="60" r="38" fill="none" stroke="var(--acc)" stroke-width="1.5"/>
        </g>
        ${[[28,28,10],[60,20,7],[92,30,8.5],
           [20,60,7.5],[60,60,13],[100,60,6.5],
           [30,92,9],[62,100,7.5],[94,90,10]]
          .map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="var(--acc)"
             opacity="${i===4?1:0.3+(i%3)*0.18}"/>`).join('')}
      </svg>
      <div class="cap">放一张真车照片到 img/boards/roscar.jpg</div>
    </div></div>`;
}

function rosLogo(size = 46){
  const dots = [
    [10, 10, 5.2], [26, 8, 3.4], [40, 12, 4.2],
    [8, 26, 3.6],  [25, 25, 6.4], [42, 27, 3.2],
    [12, 41, 4.4], [28, 43, 3.6], [40, 40, 5.0],
  ];
  return `<svg viewBox="0 0 50 50" width="${size}" height="${size}" aria-label="ROS">
    ${dots.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}"
       fill="var(--acc)" opacity="${i === 4 ? 1 : 0.32 + (i % 3) * 0.16}"/>`).join('')}
  </svg>`;
}

/* ═══════════ 账号 / 云端 ═══════════ */
function acctPaint(){
  if (!window.EIT) return;
  const nm = $('#acctName'), sub = $('#acctSub'), av = $('#acctAv');
  if (!nm) return;
  const mode = EIT.mode();
  const modeTxt = { local: '本机直连', cloud: '云端中转', none: '无设备通道' }[mode];
  if (EIT.loggedIn()) {
    nm.textContent = EIT.email;
    av.textContent = (EIT.email[0] || 'E').toUpperCase();
    const m = EIT.currentMachine();
    sub.innerHTML = `余额 ¥${(EIT.balance == null ? '—' : EIT.balance.toFixed(2))}` +
      ` · ${esc(modeTxt)}` + (m ? ` · ${esc(m.label)}${m.agent ? '' : '（离线）'}` : ' · 未绑定机器');
  } else {
    nm.textContent = '未登录';
    av.textContent = 'E';
    sub.textContent = mode === 'local' ? '本机直连可用 · 登录后可在别的设备上操作' : '点这里登录';
  }
}

/* 登录屏：左边大块介绍，右边登录口。

   为什么不是小弹窗：登录常常是第一次见到这个平台的那一屏。
   只问邮箱密码，就把「这东西是干什么的」藏在了登录之后。
   左栏讲的是产品动线本身，右栏才是表单。 */
const AUTH_STEPS = [
  ['01', '插上就认到',
   '串口、蓝牙、网络里的板子自动出现在列表。不用先装驱动、也不用告诉平台你插的是什么。'],
  ['02', '看穿内部有什么',
   '不是查表猜型号 —— 直接问设备本身：VEX 主控报端口图，ROS 车报话题，MicroPython 报模块清单。探到的和推断的分开标。'],
  ['03', '说一句话生成代码',
   '生成时带上这台机器的真实接口，代码贴着你手里这台写，不是贴着文档写。真机报的错会回灌，下一轮自动避开。'],
  ['04', '烧进去跑起来',
   '编译、烧录、看串口、实时面板在同一个界面里。也可以先在仿真里跑 —— 真机 / Gazebo / Isaac 一个开关切换。'],
];
/* ⚠️ 这一栏只能写真机上验过的。说服力全在"列名字比列形容词可信"，
   掺一个没跑过的就把这条唯一的可信机制废了。
   待加入（验过再加）：高擎 Mini Pi 双足 —— ht.mjs 照文档写的，还没连过真机。 */
const AUTH_PROOF = ['VEX V5 主控', 'ROS 移动底盘', '编程无人机', 'STM32 飞控板',
                    'Arduino / AVR', 'ESP32', 'XGO 轮腿', 'Isaac Sim', 'Gazebo'];

function acctModal(onDone, reason){
  if (!window.EIT) return;
  if (EIT.loggedIn()) return acctPanel();
  let tab = 'login';

  const draw = () => {
    const isReg = tab === 'reg';
    const root = $('#modalRoot');
    root.innerHTML = `<div class="authov" id="authov">
      <button class="btn sm au-xclose" data-close>关闭</button>

      <div class="au-showcase">
        <div class="au-brand"><span class="au-dot"></span>EI TOKEN</div>
        <h1>插上你自己的模块，<br>平台<em>认得出</em>、<em>看得穿</em>、<em>跑得起来</em>。</h1>
        <p class="au-lead">不是又一个代码生成器。它先把你手里这台设备读明白，
           再按它真实的接口写代码，然后直接烧进去跑。</p>
        <div class="au-steps">
          ${AUTH_STEPS.map(([n, t, d]) => `<div class="au-step">
            <span class="au-n">${n}</span>
            <div><b>${esc(t)}</b><span>${esc(d)}</span></div>
          </div>`).join('')}
        </div>
        <div class="au-proof">
          <div class="au-t">已在这些真机上跑通</div>
          <div class="au-chips">${AUTH_PROOF.map(x => `<i>${esc(x)}</i>`).join('')}</div>
        </div>
      </div>

      <div class="au-formside">
        <div class="au-fbox">
          <h2>${isReg ? '注册 EI TOKEN' : '登录 EI TOKEN'}</h2>
          <p class="au-why">${isReg
            ? '新账号赠送 ¥5 额度，够试十几次生成。无需绑卡。'
            : '设备按账号隔离。登录后也可以在手机或别的电脑上操作自己的机器。'}</p>
          ${reason ? `<div class="au-reason">${esc(reason)}</div>` : ''}
          <div class="au-fld">
            <label for="acEmail">邮箱</label>
            <input id="acEmail" type="email" autocomplete="username" placeholder="you@example.com">
          </div>
          <div class="au-fld">
            <label for="acPw">密码${isReg ? '（至少 8 位）' : ''}</label>
            <input id="acPw" type="password" placeholder="••••••••"
                   autocomplete="${isReg ? 'new-password' : 'current-password'}">
          </div>
          <div class="au-err" id="acErr"></div>
          <button class="btn primary au-go" id="acGo">${isReg ? '注册并登录' : '登录'}</button>
          <div class="au-alt">
            <span>${isReg ? '已经有账号了？' : '还没有账号？'}</span>
            <button class="btn link sm" id="acSwitch">${isReg ? '去登录' : '注册并领 ¥5 额度'}</button>
          </div>
          <div class="au-foot">
            代码生成在云端进行，按实际消耗的 token 计费；设备识别、烧录、调试不计费。<br>
            服务端 <span class="mono">${esc(EIT.server)}</span>　·　可用 <span class="mono">?api=</span> 切换
          </div>
        </div>
      </div>
    </div>`;

    const r = root;
    const q = (x) => r.querySelector(x);
    // 点关闭按钮才退出。左栏点着玩不该把人甩走 —— 这里没有"点空白关闭"
    r.querySelector('[data-close]').onclick = () => { root.innerHTML = ''; };

    const err = q('#acErr');
    const go = async () => {
      const email = q('#acEmail').value.trim();
      const pw = q('#acPw').value;
      // 先在本地挡明显不对的，省一个来回
      if (!email || email.indexOf('@') < 0) { err.className = 'au-err'; err.textContent = '请填邮箱'; q('#acEmail').focus(); return; }
      if (isReg && pw.length < 8) { err.className = 'au-err'; err.textContent = '密码至少 8 位'; q('#acPw').focus(); return; }
      if (!pw) { err.className = 'au-err'; err.textContent = '请填密码'; q('#acPw').focus(); return; }
      const btn = q('#acGo');
      btn.disabled = true;
      err.className = 'au-err au-busy'; err.textContent = isReg ? '正在创建账号…' : '正在登录…';
      let res;
      try { res = isReg ? await EIT.register(email, pw) : await EIT.login(email, pw); }
      catch (e) { res = { ok: false, error: '连不上服务端（' + EIT.server + '）' }; }
      btn.disabled = false;
      if (res.ok) {
        root.innerHTML = ''; acctPaint();
        toast('已登录 ' + res.email);
        if (onDone) onDone(); else render();    // 有后续动作就接着做，别把用户甩回首页
      } else {
        err.className = 'au-err'; err.textContent = res.error || '失败';
      }
    };
    q('#acGo').onclick = go;
    const enter = (e) => { if (e.key === 'Enter') go(); };
    q('#acPw').onkeydown = enter;
    q('#acEmail').onkeydown = enter;
    q('#acSwitch').onclick = () => { tab = isReg ? 'login' : 'reg'; draw(); };
    q('#acEmail').focus();
  };
  draw();
}

/* 生成和追问都要烧 token，动手之前必须先登录 —— 计费在服务端，
   没有账号就没有归属，也没法扣额度。登录完自动接着做，不用重来一遍。 */
/** 演示开关：true = 不拦登录，生成走本机桥接的 Key。
    ⚠️ 默认必须是 false —— 「忘了改回来」这种事迟早会发生，
    所以默认值站在安全那一边，要演示的人自己在控制台打开。
    临时打开：控制台执行 localStorage.setItem('cos.demo','1') 再刷新。 */
const DEMO_NO_LOGIN = (() => {
  try { return localStorage.getItem('cos.demo') === '1'; } catch (e) { return false; }
})();

/** 是否显示「绑定机器 / 远程访问」。
    本地使用（人就在设备所在的电脑前）根本用不到它 —— 摆出来只会让人问「这是干嘛的」，
    而答案是「你用不着」。等真要做远程售后时再打开。 */
const SHOW_PAIRING = false;

function requireLogin(reason, next){
  if (DEMO_NO_LOGIN) { next(); return; }        // 演示模式（要手动在控制台打开）
  if (!window.EIT) { next(); return; }          // 没接云端模块（纯本地开发）就不拦
  if (!EIT.loggedIn()) {
    // 说清楚为什么拦：不是"要你注册"，是生成这件事本身发生在云端、按量计费
    acctModal(next, reason || '代码生成在云端进行，按实际消耗的 token 计费。登录后可以看到每一轮花了多少。');
    return;
  }
  // 余额不足就别让他白等一轮生成才发现
  if (window.EIT && typeof EIT.balance === 'number' && EIT.balance <= 0) {
    topupModal();
    return;
  }
  next();
}

/* 余额不足。做成单独弹窗而不是一句 toast ——
   这是用户唯一会主动掏钱的时刻，得让他看清楚花在哪、还剩多少。 */
function topupModal(){
  const b = (window.EIT && EIT.balance) || 0;
  modal(`<div class="hd"><b class="h3">额度不足</b>
      <span class="badge mono">余额 ¥${b.toFixed(2)}</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      <div class="sub" style="margin:0 0 12px;font-size:13px">
        代码生成在云端进行，按实际消耗的 token 计费。<br>
        参考：给一台设备生成一版可运行的程序，通常 <b>¥0.08 ~ ¥0.3</b>；
        真机报错回灌后再改一轮，费用相近。
      </div>
      <div class="sub" style="margin:0 0 12px;font-size:12.5px">
        设备识别、看部件、烧录、遥控这些<b>不收费</b> —— 只有调用大模型才计费。
      </div>
      <div class="row" style="justify-content:flex-end;gap:8px">
        <button class="btn" data-close>稍后再说</button>
        <a class="btn primary" href="#/account">去账户页充值</a>
      </div>
    </div>`);
}

/* 邮箱验证：6 位数字码而不是点击链接 —— 国内邮箱客户端常改写或拦截链接，
   数字码在哪都能用，手机上也好输。 */
function verifyModal(onDone){
  const r = modal(`<div class="hd"><b class="h3">验证邮箱</b>
      <span class="badge">${esc(EIT.email)}</span>
      <span class="grow"></span><button class="btn sm" data-close>稍后再说</button></div>
    <div class="bd">
      <div class="sub" style="margin:0 0 14px;font-size:13px">
        验证之后才能使用生成功能。验证码已发到你的邮箱，10 分钟内有效。<br>
        没收到就看看垃圾箱，或者点下面重新发送。
      </div>
      <input id="vfCode" placeholder="6 位验证码" maxlength="6" inputmode="numeric"
             style="width:100%;text-align:center;font-size:26px;letter-spacing:.42em;font-family:var(--mono)">
      <div id="vfMsg" class="sub" style="margin:10px 0 0;font-size:12.5px"></div>
      <div class="row" style="margin-top:16px">
        <button class="btn link sm" id="vfResend">重新发送</button>
        <span class="grow"></span>
        <button class="btn primary" id="vfGo">确认</button>
      </div>
    </div>`);
  const msg = r.querySelector('#vfMsg'), input = r.querySelector('#vfCode');
  const go = async () => {
    const code = input.value.trim();
    if (code.length !== 6) { msg.textContent = '请输入 6 位验证码'; return; }
    msg.textContent = '验证中…';
    const res = await EIT.verify(code);
    if (res.ok) {
      $('#modalRoot').innerHTML = ''; toast('✓ 邮箱已验证'); acctPaint();
      if (onDone) onDone();
    } else msg.innerHTML = `<span style="color:var(--err)">${esc(res.error || '验证失败')}</span>`;
  };
  r.querySelector('#vfGo').onclick = go;
  input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  r.querySelector('#vfResend').onclick = async () => {
    msg.textContent = '发送中…';
    const res = await EIT.sendCode();
    msg.textContent = res.ok
      ? (res.delivered ? '已发送，注意查收（含垃圾箱）' : '服务端未配置发信，验证码打在服务端控制台了')
      : (res.error || '发送失败');
  };
  input.focus();
}

function acctPanel(){
  const ms = EIT.machines || [];
  const r = modal(`<div class="hd"><b class="h3">${esc(EIT.email)}</b>
      <span class="badge ok">余额 ¥${EIT.balance == null ? '—' : EIT.balance.toFixed(2)}</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      ${SHOW_PAIRING || ms.length ? `<div class="sub" style="margin:0 0 8px;font-size:12.5px">我的机器（选中的那台就是当前操作对象）</div>` : ''}
      ${!SHOW_PAIRING && !ms.length ? `<div class="sub" style="margin:0;font-size:13px">
          当前是<b>本地直连</b>模式 —— 设备就在这台电脑上，直接用即可。<br>
          <span style="color:var(--mute);font-size:12.5px">
          需要在手机或别的电脑上远程操作时，再开启远程访问。</span></div>` : ''}
      ${ms.length ? ms.map(m => `<div class="hwrow" style="cursor:pointer" data-pick="${m.id}">
          <span class="dotpulse ${m.agent ? '' : 'sim'}"></span>
          <div style="min-width:0"><b>${esc(m.label)}</b>
            ${m.id === EIT.machineId ? '<span class="badge acc">当前</span>' : ''}
            ${m.agent ? '<span class="badge ok">云通道在线</span>' : '<span class="badge">桥接离线</span>'}
            <div class="sub" style="margin:0;font-size:12px">${esc(m.host)} · ${(m.serial || []).length} 个串口设备 · ${(m.boards || []).length} 台网络板</div>
          </div><span class="grow"></span>
          <button class="btn sm" data-unbind="${m.id}">解绑</button>
        </div>`).join('') : '<div class="sub" style="font-size:13px">还没有绑定机器</div>'}

      ${SHOW_PAIRING ? `
      <div class="card pad" style="margin-top:16px;padding:14px 16px">
        <b style="font-size:14px">＋ 开启远程访问</b>
        <div class="sub" style="margin:6px 0 10px;font-size:12.5px">
          想在手机或别的电脑上操作这台电脑连着的设备时才需要。
          在那台电脑的桥接终端里会打出 6 位配对码，填在这里。<br>
          本地使用（人就在这台电脑前）不需要这一步。
        </div>
        <div class="row"><input id="acCode" placeholder="配对码" maxlength="6"
             style="width:130px;text-transform:uppercase;letter-spacing:.18em;font-family:var(--mono)">
          <button class="btn primary sm" id="acClaim">绑定</button>
          <span class="grow"></span><span id="acClaimMsg" class="sub" style="margin:0;font-size:12.5px"></span></div>
      </div>` : ''}

      <div class="row" style="margin-top:16px"><a href="#/usage" data-close>查看用量明细 ›</a>
        <span class="grow"></span><button class="btn sm" id="acOut">退出登录</button></div>
    </div>`);

  r.querySelectorAll('[data-pick]').forEach(el => el.onclick = (e) => {
    if (e.target.closest('[data-unbind]')) return;
    EIT.selectMachine(+el.dataset.pick); toast('已切换当前机器'); $('#modalRoot').innerHTML = ''; render();
  });
  r.querySelectorAll('[data-unbind]').forEach(b => b.onclick = async () => {
    if (!confirm('解绑这台机器？桥接会自动重新进入配对状态。')) return;
    await EIT.unbind(+b.dataset.unbind); $('#modalRoot').innerHTML = ''; acctPanel();
  });
  const claimBtn = r.querySelector('#acClaim');
  const claim = async () => {
    const code = r.querySelector('#acCode').value.trim();
    const msg = r.querySelector('#acClaimMsg');
    if (code.length < 6) { msg.textContent = '配对码是 6 位'; return; }
    msg.textContent = '绑定中…';
    const res = await EIT.claim(code);
    if (res.ok) { toast('已绑定 ' + res.host); $('#modalRoot').innerHTML = ''; acctPanel(); render(); }
    else msg.textContent = res.error || '绑定失败';
  };
  if (claimBtn) {
    claimBtn.onclick = claim;
    r.querySelector('#acCode').onkeydown = (e) => { if (e.key === 'Enter') claim(); };
  }
  r.querySelector('#acOut').onclick = async () => { await EIT.logout(); $('#modalRoot').innerHTML = ''; toast('已退出'); render(); };
}

/* ═══════════ 生成面板：首页「创建项目」下方向下展开 ═══════════
   为什么不跳到项目页：demo 现场要一口气看完「说一句话 → 出代码 → 烧进车里 → 车动」，
   中间跳页会断掉叙事。所以就地展开，代码、烧录、运行按钮全在一屏里。 */
let gen = null;   // { task, color, object, code, stage, dry, running, host, log }

const bridgeBase = () => state.bridge || 'http://127.0.0.1:8799';
/* 设备调用统一走 EIT 选路：本机桥接在就直连，不在就走云中转。
   上层（面板、自检、部件）完全不用知道现在是哪种模式。 */
async function rosApi(path, body, gz){
  // 没明说 gz 的调用，一律跟着当前项目的目标走：选了仿真，烧录/启动/跟随/状态全落到仿真
  if (gz === undefined && typeof gen !== 'undefined' && gen && gen.gz) gz = true;
  if (window.EIT) return EIT.ros(path, body, gz);
  const opt = body === undefined ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) };
  const r = await fetch(bridgeBase() + '/api/ros/' + path + (gz ? '?gz=1' : ''), opt);
  return r.json();
}
function genLog(line){
  if (!gen) return;
  gen.log = (gen.log || []).concat(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${line}`).slice(-60);
  const box = $('#genLog');
  if (box) { box.textContent = gen.log.join('\n'); box.scrollTop = box.scrollHeight; }
}

/** 步骤条：生成 → 烧录 → 就绪 → 跟随（writing 阶段仍算在「生成代码」这一步里） */
function genSteps(){
  const order = ['gen', 'flash', 'ready', 'run'];
  const names = { gen: '生成代码', flash: '烧录到设备', ready: '就绪', run: '跟随中' };
  const at = order.indexOf(gen.stage === 'writing' ? 'gen' : gen.stage);
  return `<div class="steps">${order.map((k, i) => {
    const cls = i < at ? 'done' : i === at ? 'on' : '';
    return (i ? `<span class="sep ${i <= at ? 'done' : ''}"></span>` : '') +
      `<span class="st ${cls}"><span class="dot">${i < at ? '✓' : i + 1}</span>${names[k]}</span>`;
  }).join('')}</div>`;
}

/** 3S 锂电放电曲线是平台型的，线性换算会严重高估（12.1V 线性算 86%，实际约 65%） */
function battPct(mv){
  const C = [[12600,100],[12300,85],[12000,65],[11700,50],[11400,35],[11100,20],[10800,10],[10500,5],[9000,0]];
  for (let i = 0; i < C.length - 1; i++) {
    const [v1,p1] = C[i], [v2,p2] = C[i+1];
    if (mv >= v2) return Math.max(0, Math.min(100, Math.round(p2 + (p1-p2) * (mv-v2) / (v1-v2))));
  }
  return 0;
}

function paintGen(){
  const el = $('#genPanel');
  if (!el) return;
  if (!gen) { el.innerHTML = ''; return; }
  const ready = gen.stage === 'ready' || gen.stage === 'run';
  const writing = gen.stage === 'writing';
  const shownCode = writing ? (gen.shown || '') : gen.code;
  const total = gen.code.split('\n').length;
  const done = shownCode ? shownCode.split('\n').length : 0;
  const streamUrl = `http://${gen.host || '192.168.55.1'}:8080/stream?topic=/eit_follow/image_result&t=${gen.camSeq || 0}`;
  const bv = gen.batteryMv ? (gen.batteryMv / 1000).toFixed(2) : null;

  el.innerHTML = `<div class="gp">
    <div class="gphead">
      <b class="h3">生成的程序</b>
      <span class="badge">${esc(gen.color)}${esc(gen.object)}跟随</span>
      <span class="pill ${ready ? 'ok' : 'gray'}">${esc({ writing: '生成中…', gen: '待烧录', flash: '烧录中…', ready: 'READY 可执行', run: '跟随中' }[gen.stage])}</span>
      ${gen.host ? `<span class="badge mono">${esc(gen.host)}</span>` : ''}
      <button class="btn sm ${gen.target !== 'real' ? 'primary' : ''}" id="genTarget" title="点一下挑目标：代码在哪跑">${
        TARGETS[gen.target || 'real'].ico} 目标：${TARGETS[gen.target || 'real'].nm}</button>
      ${gen.target === 'isaac' ? '<button class="btn sm primary" id="genIsaac">🎮 打开 Isaac 控制台</button>' : ''}
      ${bv ? `<span class="badge">🔋 ${bv}V ≈${battPct(gen.batteryMv)}%</span>` : ''}
      ${gen.usage ? `<span class="badge" title="${gen.usage.total} tokens · ${esc(gen.usage.model)}">💰 本次生成 ¥${gen.usage.cny.toFixed(2)}</span>` : ''}
      <span class="grow"></span>
      ${gen.source === 'paste' ? '<span class="badge">手写代码</span>'
        : gen.source === 'template' ? '<span class="badge ok">平台验证过</span>' : ''}
      ${!writing ? `<button class="btn sm" id="genEditBtn">${gen.editing ? '✓ 完成编辑' : '✎ 编辑代码'}</button>` : ''}
      <button class="btn sm" id="genCopy">⧉ 复制代码</button>
      <button class="btn sm" id="genClose">收起</button>
    </div>
    <div class="gpbody">
      ${genSteps()}

      <div class="sub" style="margin:0 0 6px;font-size:12.5px">
        ${writing
          ? `<span class="dotpulse"></span> 大模型正在生成… 已写 <b id="genCount">${done}</b> 行`
          : gen.editing
            ? `可编辑 · 改完点「✓ 完成编辑」，或直接烧录`
            : `${gen.source === 'paste' ? '手写' : '生成'}的代码 · ${total} 行${gen.usage ? ` · ${gen.usage.model}` : ''}`}</div>
      ${gen.editing
        ? `<textarea class="codeedit" id="genEdit" spellcheck="false"
             placeholder="把你的 ROS 节点代码贴在这里…&#10;&#10;平台会做 python 语法检查，通过才让它上车。&#10;建议保留 dry_run 开关和 ~set_running 服务，界面上的安全锁和启停按钮依赖它们。"
           >${esc(gen.code || '')}</textarea>`
        : `<div class="code" id="genCode">${hl(shownCode)}${writing ? '<div class="ln"><span class="n"></span><span class="cm">▍</span></div>' : ''}</div>`}

      ${!writing && gen.code ? `
      <div class="askbox">
        ${(gen.asks || []).length ? `
          <div class="asklog">${gen.asks.map((t, i) =>
            `<div class="t"><span class="n">${i + 1}</span>${esc(t.length > 120 ? t.slice(0, 120) + '…' : t)}</div>`).join('')}</div>` : ''}
        <textarea id="genAsk" rows="2" placeholder="代码有问题？直接说 —— 例如「跟得太近了，拉远一点」「加个雷达避障」「居中时会抖，加死区」"></textarea>
        <div class="row" style="margin-top:8px;gap:10px;flex-wrap:wrap">
          <label class="tel" title="把机器人当前的真实数据一起发给模型，它就不用再猜了">
            <input type="checkbox" id="genTelem" ${gen.telem === false ? '' : 'checked'} style="width:auto;margin:0">
            带上车上的实时数据${gen.targetRadius ? `（当前目标半径 ${gen.targetRadius}px）` : ''}
          </label>
          <span class="grow"></span>
          ${gen.costTotal ? `<span class="sub" style="margin:0;font-size:12.5px">已生成 ${gen.turns} 轮 · 累计 ¥${gen.costTotal.toFixed(2)}</span>` : ''}
          <button class="btn" id="genAskBtn">▶ 修改代码</button>
        </div>
      </div>` : ''}

      <div class="row" style="margin-top:14px;gap:10px;flex-wrap:wrap">
        ${!writing ? `<button class="btn sm" id="genTpl" title="平台自带、已在真车上验证过的红色跟随节点">📦 载入验证过的节点</button>` : ''}
        <button class="btn primary" id="genFlash" ${writing || gen.stage === 'flash' ? 'disabled' : ''}>
          ${writing ? '生成中…' : gen.stage === 'flash' ? '烧录中…' : ready ? '⟳ 重新烧录' : '⚡ 烧录到设备'}</button>
        ${ready ? `
          <button class="btn ${gen.running ? '' : 'primary'}" id="genRun">
            ${gen.running ? '■ 停止' : gen.isFollow ? `▶ 开始跟踪${esc(gen.color)}${esc(gen.object)}` : '▶ 启动'}</button>
          ${gen.isFollow ? `<button class="btn sm" id="genCal">📍 就按现在这个距离</button>` : ''}
          <button class="btn sm" id="genDiag" title="查一下车为什么没动">🩺 自检</button>` : ''}
      </div>

      ${ready ? `
      <label class="drywrap ${gen.dry ? '' : 'off'}" style="margin-top:12px">
        <input type="checkbox" id="genDry" ${gen.dry ? 'checked' : ''} style="width:auto;margin:0">
        ${gen.dry ? '只看不动（车不会动，安全彩排）' : '⚠ 已解锁：启动后车会真的移动'}
      </label>

      <div class="row" style="margin-top:16px;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1 1 420px;min-width:300px">
          <div class="sub" style="margin:0 0 6px;font-size:12.5px">实体 · 车的视角（绿圈=锁定的目标）</div>
          ${gen.gz
            ? `<div class="hwlog" style="height:200px;display:flex;align-items:center;justify-content:center;text-align:center">🧪 仿真是无头模式，没有相机画面<br><span class="sub" style="font-size:12px">看效果：设备中心 → 真车 → 「里程计 / 激光雷达」面板会切到仿真数据</span></div>`
            : `<img class="cam" id="genCam" src="${streamUrl}" alt="车载画面" style="max-width:100%">`}
          <div class="sub" style="font-size:12px;margin-top:6px">
            画面左上 <code>r=当前半径/目标半径</code> · <code>vx</code> 前后 · <code>wz</code> 转向；两者为 0 = 已在位待命</div>
        </div>
        <div style="flex:1 1 260px;min-width:240px">
          <div class="sub" style="margin:0 0 6px;font-size:12.5px">运行日志</div>
          <div class="hwlog" id="genLog" style="height:300px">${esc((gen.log || []).join('\n'))}</div>
        </div>
      </div>` : `<div class="hwlog" id="genLog" style="height:110px;margin-top:14px">${esc((gen.log || []).join('\n'))}</div>`}
    </div></div>`;

  $('#genClose').onclick = () => { gen = null; stopGenPoll(); paintGen(); };
  $('#genCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(gen.code); toast('代码已复制'); } catch (e) { toast('复制失败'); }
  };
  const tb = $('#genTpl');
  if (tb) tb.onclick = async () => {
    tb.disabled = true; genLog('正在载入平台验证过的跟随节点…');
    const j = await rosApi('template');
    if (j && j.ok && j.code) {
      gen.code = j.code; gen.source = 'template'; gen.editing = false;
      genLog(`✓ 已载入 ${j.code.split(String.fromCharCode(10)).length} 行 —— 这份在真车上跑通过，可以直接烧`);
    } else genLog('✗ 载入失败：' + ((j && j.error) || ''));
    tb.disabled = false; paintGen();
  };

  const eb = $('#genEditBtn');
  if (eb) eb.onclick = () => {
    if (gen.editing) { const e = $('#genEdit'); if (e) gen.code = e.value; }
    gen.editing = !gen.editing;
    paintGen();
  };
  const ed = $('#genEdit');
  if (ed) ed.oninput = () => { gen.code = ed.value; };   // 边打边存，切走不会丢

  $('#genFlash').onclick = doFlash;

  const ask = $('#genAsk'), askBtn = $('#genAskBtn'), tel = $('#genTelem');
  if (tel) tel.onchange = e => { gen.telem = e.target.checked; };
  if (askBtn) {
    const submit = () => {
      const t = (ask.value || '').trim();
      if (!t) { ask.focus(); return; }
      ask.value = '';
      // 追问也是一次生成，同样要登录
      requireLogin('修改代码会再消耗一次 token，需要先登录。', () => doAsk(t));
    };
    askBtn.onclick = submit;
    ask.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); };
  }

  const tg = $('#genTarget');
  if (tg) tg.onclick = () => pickTarget(t => {
    gen.target = t;
    gen.gz = t === 'gz';
    gen.running = false; if (gen.stage === 'run') gen.stage = 'ready';
    genLog({ real: '目标切到真车：烧录 / 启动落到真实机器人',
             gz: '目标切到 Gazebo：烧录 / 启动落到车上那套仿真（rosbridge 9091），话题名与真车一致',
             isaac: '目标切到 Isaac：本机 GPU 跑物理，点「打开 Isaac 控制台」' }[t]);
    if (t !== 'isaac') getParts(true, gen.gz).then(pj2 => { if (gen && pj2 && pj2.parts) { gen.parts = pj2.parts; gen.partsDigest = pj2.digest || ''; } });
    paintGen();
  });
  const gi = $('#genIsaac');
  if (gi) gi.onclick = () => isaacModal();
  const cam = $('#genCam');
  if (cam) cam.onerror = () => { setTimeout(() => { if (gen) { gen.camSeq = (gen.camSeq || 0) + 1; const c2 = $('#genCam'); if (c2) c2.src = streamUrl.replace(/t=\d+/, 't=' + gen.camSeq); } }, 2500); };

  const rb = $('#genRun'); if (rb) rb.onclick = doFollowToggle;
  const cb = $('#genCal'); if (cb) cb.onclick = doCalibrate;
  const db = $('#genDiag'); if (db) db.onclick = () => runDiagnose();
  const dz = $('#genDry'); if (dz) dz.onchange = async e => {
    const dry = e.target.checked;
    if (!dry && !confirm('解开安全锁后，启动跟随时车会真的移动。\n确认车已放在地面上、前方一米内无障碍？')) {
      e.target.checked = true; return;
    }
    genLog(dry ? '切到「只看不动」…' : '解锁：车将真实运动…');
    const j = await rosApi('dryrun', { dry });
    if (j.ok) { gen.dry = dry; genLog(dry ? '已锁住，车不会动' : '⚠ 已解锁，车会动'); }
    else { genLog('切换失败：' + (j.error || '')); e.target.checked = gen.dry; }
    paintGen();
  };
}

/* 面板打开期间轮询状态（电量 / 节点存活），关掉就停 */
let genTimer = null;
function startGenPoll(){
  if (genTimer) return;
  genTimer = setInterval(async () => {
    if (!gen || !$('#genPanel')) return;
    if (gen.stage === 'writing') return;      // 生成中别改状态，否则会打断演示节奏
    const j = await rosApi('status');
    if (!j || !j.ok) return;
    gen.host = j.host || gen.host;
    gen.batteryMv = j.batteryMv || gen.batteryMv;
    if (!j.running && (gen.stage === 'ready' || gen.stage === 'run')) {
      gen.stage = 'gen'; gen.running = false; genLog('⚠ 节点已不在运行');
    }
    paintGen();
  }, 10000);
}
function stopGenPoll(){ if (genTimer) { clearInterval(genTimer); genTimer = null; } }

/* 真调大模型，边生成边往代码框里落。
   ⚠️ 注意：写进车里的是仓库里那份已验证的节点，不是这里生成的代码 ——
   现场生成的代码没人审过，直接烧进去再解锁跑车是拿硬件冒险。
   生成给人看「平台真的在写代码」，部署走可控的那份，两件事分开。 */
const USAGE_MARK = '###EIT_USAGE###';

/* 部件清单：平台现场探测这台车上有什么、接口叫什么，注入模型的系统提示。
   有了它模型就不用猜话题名 —— 「接了什么就能用什么」靠的是这一步，
   不是靠模型记得某款机器人的默认话题。 */
/* 真车和仿真车各自一份：它们是两个 master，话题名一样但来源不同，混一份缓存就串了 */
const partsCaches = { real: null, gz: null };
let partsCache = null;                      // 兼容旧引用，始终指向真车那份
async function getParts(force, gz){
  const k = gz ? 'gz' : 'real';
  if (partsCaches[k] && !force) return partsCaches[k];
  try {
    const j = await rosApi('parts', undefined, gz);
    if (j && j.ok) { partsCaches[k] = j; if (!gz) partsCache = j; return j; }
  } catch (e) {}
  return null;
}

/* 模型偶尔会在代码外面裹点自己的格式残留：markdown 围栏、</final> 这类闭合标签。
   提示词里写了「不要围栏」也挡不住 —— 实测 DeepSeek 给无人机生成时末尾吐了个 </final>，
   烧进设备直接 SyntaxError。所以落地前统一洗一道，
   别让模型的格式问题变成用户的报错。 */
function cleanCode(raw){
  let t = String(raw || '').trim();
  // markdown 围栏：开头 ```python / ``` ，结尾 ```
  t = t.replace(/^```[a-zA-Z]*[ \t]*\r?\n/, '').replace(/\r?\n?```[ \t]*$/, '');
  // 单独成行的 XML 式标签（</final> <answer> 之类）。只删独占一行的 ——
  // 代码字符串里可能正好有尖括号内容，别误伤。
  t = t.split('\n').filter((l) => !/^\s*<\/?[a-zA-Z_][\w-]*>\s*$/.test(l)).join('\n');
  return t.trim();
}

async function streamGen(task){
  gen.stage = 'writing'; gen.shown = ''; gen.usage = null;
  gen.messages = gen.messages || [];
  gen.turns = (gen.turns || 0) + 1;
  paintGen();
  try {
    // 登录了就走云端 —— 计费和额度控制在服务端，本机那份只留给没登录的本地开发
    const r = await fetch(window.EIT ? EIT.genUrl() : bridgeBase() + '/api/llm/gen', {
      method: 'POST', headers: window.EIT ? EIT.genHeaders() : { 'Content-Type': 'application/json' },
      // 历史里带着上一版代码（assistant 消息），模型才改得动它；首轮 messages 为空
      body: JSON.stringify({ messages: gen.messages, task, kind: gen.kind || 'ros', context: gen.partsDigest || '' }),
    });
    if (!r.ok || !r.body) { genLog('✗ 生成失败 HTTP ' + r.status); gen.stage = 'gen'; paintGen(); return; }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const i = buf.indexOf(USAGE_MARK);
      gen.shown = i >= 0 ? buf.slice(0, i) : buf;
      paintCodeOnly();
    }
    const i = buf.indexOf(USAGE_MARK);
    if (i >= 0) {
      gen.shown = buf.slice(0, i);
      try { gen.usage = JSON.parse(buf.slice(i + USAGE_MARK.length)); } catch (e) {}
    }
    gen.code = cleanCode(gen.shown);
    gen.stage = 'gen';
    // 把这一轮记进历史：下次追问时模型能看到自己上一版写了什么
    gen.messages.push({ role: 'user', content: task }, { role: 'assistant', content: gen.code });
    const u = gen.usage;
    if (u) gen.costTotal = Number(((gen.costTotal || 0) + u.cny).toFixed(2));
    if (u && typeof u.balance === 'number' && window.EIT) { EIT.balance = u.balance; EIT.onchange(); }
    genLog(`✓ 第 ${gen.turns} 轮生成完成 · ${gen.code.split('\n').length} 行`);
    if (u) {
      const cacheNote = u.cacheHit ? `，缓存命中 ${Math.round(u.cacheHit / Math.max(1, u.in) * 100)}%` : '';
      genLog(`  ${u.model} · 入 ${u.in}${cacheNote} / 出 ${u.out} · 本轮 ¥${u.cny.toFixed(2)}（累计 ¥${gen.costTotal.toFixed(2)}）`);
    }
    genLog(gen.turns === 1 ? '下一步：点「烧录到设备」写进机器人并启动'
                           : '代码已更新，可以重新烧录');
    paintGen();
  } catch (e) {
    genLog('✗ 生成中断：' + e.message); gen.stage = 'gen'; paintGen();
  }
}

/** 流式期间只重画代码块，不整块重建 DOM —— 否则每帧都要重新绑事件、还会闪 */
function paintCodeOnly(){
  const box = $('#genCode');
  if (!box || !gen) return;
  box.innerHTML = hl(gen.shown || '') + '<div class="ln"><span class="n"></span><span class="cm">▍</span></div>';
  box.scrollTop = box.scrollHeight;
  const c = $('#genCount');
  if (c) c.textContent = (gen.shown || '').split('\n').length;
}

/** 追问：把用户的话（可选地连同真机实测数据）发给模型改上一版代码。
    「带上真机数据」是这套东西真正值钱的地方 —— 模型原本只能写"假设"，
    现在能拿到地面真值，就不用猜了。 */
/* 「车没动」「没反应」这类是**症状描述**，不是改代码需求。
   绝大多数原因在操作和环境里（安全锁没开、没点启动、目标不在画面、已经到位），
   直接甩给模型重写代码 = 又慢又费钱还治不好病。所以先自检。 */
const SYMPTOM_RE = /没动|不动|没反应|没有反应|不跟|跟不上|不работ|不工作|没用|失败|不转|停着|不走/;

async function runDiagnose(quiet){
  genLog('🩺 正在自检…');
  const d = await rosApi('diagnose').catch(() => null);
  if (!d || !d.ok) { genLog('· 自检失败：车可能不在线'); return null; }
  const t = d.telemetry || {};
  genLog(`  节点${t.nodeUp ? '在跑' : '没跑'} · 目标${t.hasTarget ? `已锁(半径${t.targetRadius})` : '未锁'}`
       + ` · 安全锁${t.dryRun === true ? '开着' : t.dryRun === false ? '已解开' : '未知'}`
       + ` · 跟随${t.running === true ? '已启动' : t.running === false ? '未启动' : '未知'}`);
  (d.findings || []).forEach(x => {
    genLog(`  ${x.level === 'block' ? '✗' : x.level === 'warn' ? '⚠' : 'ℹ'} ${x.title} —— ${x.detail}`);
    if (x.fix) genLog(`      → ${x.fix}`);
  });
  if (!quiet && !(d.findings || []).length) genLog('  没发现明显问题');
  return d;
}

async function doAsk(text){
  let msg = text;
  const sections = [];

  // 症状描述先自检；查出是操作/环境问题就当场告诉用户，不惊动模型
  if (SYMPTOM_RE.test(text)) {
    const d = await runDiagnose();
    if (d) {
      const blocks = (d.findings || []).filter(x => x.level === 'block');
      if (blocks.length && !d.isCodeIssue) {
        genLog(`✓ 自检定位到原因，不用改代码 —— ${blocks.map(b => b.title).join('；')}`);
        toast('自检发现：' + blocks[0].title);
        gen.asks = (gen.asks || []).concat(text);
        paintGen();
        return;                                  // 省下一次生成的钱
      }
      if (!blocks.length && !d.isCodeIssue) {
        genLog('✓ 自检没发现故障，看起来是已经到位了（速度为 0 是正确行为）');
        genLog('  把目标前后左右移动几十厘米试试；确实要改代码的话，说得具体点');
        gen.asks = (gen.asks || []).concat(text);
        paintGen();
        return;
      }
      // 确实像代码问题 → 把自检结论一并交给模型
      sections.push('【平台自检结论】\n'
        + (d.findings || []).map(x => `- ${x.title}：${x.detail}`).join('\n'));
    }
  }

  if (gen.telem !== false) {
    genLog('正在读取车上的实时数据…');
    const st = await rosApi('status').catch(() => null);
    if (st && st.ok) {
      gen.host = st.host || gen.host;
      gen.batteryMv = st.batteryMv || gen.batteryMv;
      gen.targetRadius = st.targetRadius || gen.targetRadius;
      const bits = [];
      if (st.targetRadius) bits.push(`当前锁定目标的外接圆半径 = ${st.targetRadius} 像素（这个距离就是期望的跟随距离）`);
      bits.push(`相机分辨率 640x400，节点${st.running ? '正在运行' : '未运行'}`);
      if (st.batteryMv) bits.push(`电池 ${(st.batteryMv / 1000).toFixed(2)}V`);
      sections.push('【平台回传的真机数据 —— 这是地面真值，与你原先的假设冲突时以它为准】\n'
        + bits.map(b => '- ' + b).join('\n'));
      genLog(`✓ 已附上真机数据${st.targetRadius ? `（目标半径 ${st.targetRadius}px）` : ''}`);
    } else {
      genLog('· 车不在线，这次只发文字');
    }
  }
  // 自检结论和真机数据都要带上，之前写成各自覆盖 msg，后一段会把前一段吃掉
  msg = sections.length ? sections.join('\n\n') + `\n\n【我的要求】\n${text}` : text;
  genLog(`追问：${text}`);
  gen.asks = (gen.asks || []).concat(text);   // 只存原话，界面上不显示我附加的真机数据块
  await streamGen(msg);
}

async function doCalibrate(){
  genLog('以当前画面里的目标距离作为跟随距离…');
  const j = await rosApi('radius', { value: 0 });   // 0 = 用当前看到的半径
  if (j.ok) genLog(`✓ 跟随距离已标定${j.radius ? `（半径 ${Math.round(j.radius)} px）` : ''}`);
  else genLog('✗ ' + (j.error || '标定失败，画面里得先看得到目标'));
}

async function doFlash(){
  gen.stage = 'flash'; paintGen();
  if (gen.kind === 'mpy') return doFlashMpy();
  genLog('正在写入 /home/hiwonder/eit/eit_follow.py …');
  try {
    // 所见即所烧：框里是什么就烧什么。
    // 之前这里会偷偷换成内置模板，看着安全其实更糟 —— 用户以为烧的是屏幕上那份。
    // 现在改成明着给一个「载入验证过的节点」按钮，要不要用由用户决定。
    if (!gen.code || gen.code.trim().length < 40) {
      genLog('✗ 代码框是空的。要么让 AI 生成，要么粘贴自己的，要么点「载入验证过的节点」');
      gen.stage = 'gen'; paintGen(); return;
    }
    const d = await rosApi('deploy', { code: gen.code });
    if (!d.ok) { genLog('✗ 烧录失败：' + (d.error || '')); gen.stage = 'gen'; paintGen(); return; }
    genLog(`✓ 已写入 ${d.bytes} 字节，python 语法检查通过`);
    genLog('正在启动 ROS 节点…');
    const s = await rosApi('start', {});
    if (!s.ok) { genLog('✗ 启动失败：' + (s.error || '') + '\n' + (s.log || '')); gen.stage = 'gen'; paintGen(); return; }
    (s.log || '').split('\n').filter(Boolean).slice(-8).forEach(genLog);
    const st = await rosApi('status');
    gen.host = st.host || gen.host;
    gen.batteryMv = st.batteryMv || null;
    gen.camSeq = (gen.camSeq || 0) + 1;
    gen.stage = 'ready'; gen.dry = true; gen.running = false;
    genLog('✓ READY — 节点已就绪，可以执行');
    genLog('当前处于「只看不动」，确认车已放到地面再解锁');
    toast('✓ 烧录完成，READY');
    startGenPoll();
  } catch (e) { genLog('✗ ' + e.message); gen.stage = 'gen'; }
  paintGen();
}

async function doFollowToggle(){
  const want = !gen.running;
  if (want && !gen.dry && !confirm('安全锁已解开，点确定后车会真的开始移动。\n确认车在地面上、前方无障碍？')) return;
  genLog(want ? '启动跟随…' : '停止跟随…');
  const j = await rosApi('follow', { running: want });
  if (j.ok) {
    gen.running = want; gen.stage = want ? 'run' : 'ready';
    genLog(want ? '✓ 跟随已启动' + (gen.dry ? '（只看不动，车不会移动）' : '（车会移动）') : '✓ 已停止，速度已清零');
  } else genLog('✗ ' + (j.error || '调用失败'));
  paintGen();
}

/* ═══════════ 首页 ═══════════ */
/* 三个目标：代码到底跑在哪。每档都写清楚跑在哪、代价、限制 ——
   光三个按钮谁也看不出差别，选错了会以为平台坏了。 */
const TARGETS = {
  real:  { ico: '🚗', nm: '真车', sub: '代码烧进真实机器人',
           where: '幻尔 ROS 小车（Jetson Nano）',
           good: ['所见即所得，真实物理与传感器', '最终都要落到这里'],
           bad:  ['写错会撞、会摔，电池会耗', '一次只有一台，要排队'],
           need: '车要开机并连上网' },
  gz:    { ico: '🧪', nm: 'Gazebo 仿真', sub: '跑在车上，话题与真车完全一致',
           where: '车上的 Jetson（无头 gzserver，约 114MB 内存）',
           good: ['话题名和真车一模一样，代码一个字不用改', '撞了不心疼，可以随便试', '零安装，车上出厂自带'],
           bad:  ['画面是没有的（无头模式，看数据不看图）', '占车上一点内存和 CPU'],
           need: '车要开机；没起过就在设备中心点「🧪 起仿真」' },
  isaac: { ico: '🎮', nm: 'Isaac Sim', sub: '本机 GPU 跑高保真物理，任何有模型的机器人',
           where: '这台电脑（RTX 5090，D:\\isaac）',
           good: ['有渲染画面，能看见机器人在动', '不挑 ROS —— 只要有 URDF/USD 模型就能跑', '不占车上资源，车关着也能用'],
           bad:  ['首次启动约 26 秒（之后热的，每条指令 ~200ms）', '不走 ROS 话题，烧录那套流程不适用'],
           need: '本机装好 Isaac Sim（已装）' },
};
let targetReady = { real: null, gz: null, isaac: null };
async function refreshTargetState(){
  try {
    const hw = await (await fetch(bridgeBase() + '/api/hw')).json();
    const ros = (hw.boards || []).find(b => (b.services || []).some(x => /rosbridge/i.test(x)));
    targetReady.real = !!ros;
    targetReady.gz = !!(hw.boards || []).some(b => b.gz);
  } catch (e) { targetReady.real = targetReady.gz = false; }
  try {
    const c = await (await fetch(bridgeBase() + '/api/sim/caps')).json();
    targetReady.isaac = !!(c.isaac && c.isaac.exe);
  } catch (e) { targetReady.isaac = false; }
  // 探完了把卡片上的「检查中」换成真实状态
  const box = document.querySelector('#tgCards');
  if (box) { box.innerHTML = targetCards(); bindTargetCards(document); }
  document.querySelectorAll('#modalRoot .tggrid').forEach(g => {
    const cur = gen ? gen.target : homeTarget;
    g.innerHTML = targetCards(cur);
    g.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const pick = b.dataset.pick; $('#modalRoot').innerHTML = '';
      if (window._tgDone) window._tgDone(pick);
    });
  });
}

/** 一张目标卡。cur 是当前选中的那档（首页用 homeTarget，生成面板用 gen.target） */
function targetCard(k, cur){
  const t = TARGETS[k], ok = targetReady[k];
  return `<button class="tgcard ${k === cur ? 'on' : ''}" data-pick="${k}">
      <div class="row" style="gap:8px;align-items:center">
        <span style="font-size:20px">${t.ico}</span><b style="font-size:14px">${esc(t.nm)}</b>
        <span class="pill ${ok === false ? '' : 'ok'}" style="font-size:11px">${ok === false ? '未就绪' : ok ? '就绪' : '检查中'}</span>
        <span class="grow"></span>
        ${k === cur ? '<span class="badge ok">当前</span>' : ''}
      </div>
      <div class="sub" style="margin:4px 0 0;font-size:12.5px">${esc(t.sub)}</div>
      <div class="sub mono" style="margin:6px 0 0;font-size:11.5px">跑在：${esc(t.where)}</div>
      <div style="margin-top:8px;font-size:12px;line-height:1.75">
        ${t.good.map(x => `<div style="color:var(--ok,#16a34a)">✓ ${esc(x)}</div>`).join('')}
        ${t.bad.map(x => `<div style="color:var(--mute)">· ${esc(x)}</div>`).join('')}
      </div>
      <div class="sub" style="margin:8px 0 0;font-size:11.5px">前提：${esc(t.need)}</div>
    </button>`;
}
const targetCards = (cur) => ['real', 'gz', 'isaac'].map(k => targetCard(k, cur || homeTarget)).join('');

/** 首页那排卡片：点一下换目标，就地重绘 */
function bindTargetCards(scope){
  const box = (scope || document).querySelector('#tgCards');
  if (!box) return;
  box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    homeTarget = b.dataset.pick;
    box.innerHTML = targetCards();
    bindTargetCards(scope);
    const h = document.querySelector('#tgHint');
    if (h) h.textContent = homeTarget === 'isaac' ? '生成后在下方面板打开 Isaac 控制台' : '';
  });
}

/** 生成面板里换目标：同样三张卡，不让人在按钮之间猜 */
function pickTarget(done){
  const r = modal(`<div class="hd"><b class="h3">代码在哪跑</b>
      <span class="sub" style="margin:0;font-size:12.5px">先在仿真里跑通，再切真机 —— 这是三档存在的意义</span>
      <span class="grow"></span><button class="btn sm" data-close>取消</button></div>
    <div class="bd"><div class="tggrid">${targetCards(gen ? gen.target : homeTarget)}</div>
      <div class="sub" style="margin:12px 0 0;font-size:12px">Gazebo 和真车的话题名刻意做成一样的（<code>/scan</code> <code>/odom</code> <code>/controller/cmd_vel</code>），所以同一份代码切过去不用改一个字。Isaac 是另一套接口，适合验证运动和物理。</div></div>`);
  window._tgDone = done;                      // 状态刷新会重绘卡片，重绑时要拿得到回调
  r.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    $('#modalRoot').innerHTML = '';
    done(b.dataset.pick);
  });
  refreshTargetState();
}

/* 这次项目是给谁写代码：ROS 车还是 MicroPython 设备（飞机 / 视觉板）。
   两者的生成提示、烧录方式、启动方式全不一样，得从建项目那一刻就分清。 */
function mpyDev(){
  return state.hw.find(e => e.deep && /^mpy/.test(e.deep.plat || '')) || null;
}
function kindOfDev(){
  if (homeDevs.some(p => /^mpy/.test(p || ''))) return 'mpy';
  return mpyDev() && !homeDevs.length ? 'mpy' : 'ros';
}

let homeDevs = [];
let homeTarget = 'real';   // 新项目的目标：real=真车 / gz=车上的 Gazebo / isaac=本机 Isaac Sim
Object.defineProperty(window, 'homeGz', { get: () => homeTarget === 'gz' });   // 老代码还在读这个名字
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
      <button class="btn sm" id="paste" title="已经有代码？直接贴进来，跳过生成">📋 粘贴代码</button>
      <button class="btn primary" id="create">▶ 创建项目</button>
    </div>
  </div>
  <div class="tgband">
    <div class="row" style="gap:8px;align-items:baseline;margin-bottom:8px">
      <b style="font-size:13.5px">代码在哪跑</b>
      <span class="sub" style="margin:0;font-size:12.5px">先在仿真里跑通，再切真机 —— 同一份代码，不用改</span>
      <span class="grow"></span>
      <span class="sub" style="margin:0;font-size:12px" id="tgHint"></span>
    </div>
    <div class="tggrid" id="tgCards">${targetCards()}</div>
  </div>
  <div class="genpanel" id="genPanel"></div>
  <div class="chips">${D.chips.map(c => `<button class="chip">${esc(c)}</button>`).join('')}</div>
  <div class="starters">${D.starters.map(s => `<button class="card starter" data-s="${s.id}"><span class="ic">${s.ico}</span><div><b>${esc(s.nm)}</b><span>${esc(s.sub)}</span></div></button>`).join('')}</div>
  <p class="center" style="margin-top:34px"><a href="#/store">📁 导入已有工程</a>　·　<a href="#/store">🛒 去装置商城挑一台</a></p>`;
  bindModel($('#modelSel'));
  const ta = $('#prompt');
  const upd = () => { const e = estimate(ta.value, platOf(homeDevs[0] || 'pi')); $('#est').textContent = e ? `预计 ${fmtTok(e.total)} tokens · ${e.turns[0]}–${e.turns[1]} 轮 · ≈¥${e.cost.toFixed(3)}` : ''; };
  ta.oninput = upd;
  v.querySelectorAll('.chip').forEach(c => c.onclick = () => { ta.value = c.textContent; upd(); ta.focus(); });
  v.querySelectorAll('.starter').forEach(b => b.onclick = () => { const s = D.starters.find(x => x.id === b.dataset.s); ta.value = s.prompt; upd(); ta.focus(); });
  $('#create').onclick = () => {
    const t = ta.value.trim();
    if (!t) { ta.focus(); return; }
    // 生成要花钱，先确认身份。登录完会自动接着走，不用重新输一遍
    requireLogin('生成代码会消耗 token，按用量计费，所以需要先登录。', () => doCreate(t));
  };
  const doCreate = (t) => {
    // 任何任务都走生成面板。原来只放行「跟随」类关键词，别的输入全掉进旧的空壳项目页 ——
    // 模型什么代码都能写，没道理在这儿卡一道关键词。
    {
      const { color, object } = (window.EIT_ROS ? EIT_ROS.parseTask(t) : { color: '', object: '目标' });
      // 也建一条项目记录：否则侧边栏没有它，用户回头找不到、也删不掉。
      // 项目页里渲染的是同一个面板，所以「代码 + 实体」在项目下面也看得到。
      const pj = createProject(t, homeDevs.length ? homeDevs : ['jetson'], true);
      gen = { task: t, color, object, code: '', stage: 'writing', projectId: pj.id,
              isFollow: /跟随|跟踪|追踪|跟着|追着|盯着|跟住|跟上/.test(t),
              gz: homeTarget === 'gz', target: homeTarget, kind: kindOfDev(), dev: mpyDev(),
              dry: true, running: false, host: '', log: [], camSeq: 0,
              messages: [], asks: [t], turns: 0, costTotal: 0 };
      genLog(`任务已提交：${t}`);
      genLog('正在调用大模型生成 ROS 节点代码…');
      paintGen();
      setTimeout(() => $('#genPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      // 先探一遍这台车上有什么，把接口清单交给模型，再开始生成
      getParts(true, !!(gen && gen.gz)).then(pj2 => {
        if (!gen) return;
        if (pj2 && pj2.parts && pj2.parts.length) {
          gen.parts = pj2.parts;
          gen.partsDigest = pj2.digest || '';
          genLog(`已探测到 ${pj2.parts.length} 个部件：${pj2.parts.map(x => x.nm).join('、')}`);
          genLog('接口清单已交给模型，生成的代码会直接用这些话题');
        } else {
          genLog('· 没探测到部件（车可能不在线），模型将按通用环境生成');
        }
        streamGen(t);
      });
      // 车上可能已经跑着同一个节点了（之前烧过）——直接对齐真实状态，
      // 免得明明能用还逼用户重烧一遍
      // 只取地址和电量，不动 stage —— 之前这里会在代码还在生成时就把状态跳到 ready，
      // 结果摄像头和账单提前冒出来，把「生成中」这段演示打断了。
      rosApi('status').then(st => {
        if (!gen || !st || !st.ok) return;
        gen.host = st.host || gen.host;
        gen.batteryMv = st.batteryMv || null;
        if (gen.stage !== 'writing') paintGen();
      }).catch(() => {});
      return;
    }
  };
  $('#paste').onclick = () => {
    const t = ta.value.trim() || '手写代码';
    const pj = createProject(t, homeDevs.length ? homeDevs : ['jetson'], true);
    gen = { task: t, color: '', object: '目标', code: '', stage: 'gen', projectId: pj.id,
            source: 'paste', editing: true, isFollow: false,
            gz: homeTarget === 'gz', target: homeTarget, kind: kindOfDev(), dev: mpyDev(),
            dry: true, running: false, host: '', log: [], camSeq: 0,
            messages: [], asks: [], turns: 0, costTotal: 0 };
    genLog('手写模式：把你的 ROS 节点代码贴进下面的框，然后点烧录');
    genLog('平台仍会做语法检查、部署、起停和自检 —— 只是代码不由模型生成');
    paintGen();
    setTimeout(() => { $('#genPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
                       const e = $('#genEdit'); if (e) e.focus(); }, 80);
    getParts(true, !!(gen && gen.gz)).then(pj2 => {
      if (gen && pj2 && pj2.parts) { gen.parts = pj2.parts; gen.partsDigest = pj2.digest || ''; }
    });
  };
  bindTargetCards(v);
  refreshTargetState();
  $('#addDev').onclick = () => pickDevices(sel => { homeDevs = sel; $('#devCount').textContent = sel.length; $('#devCount').hidden = !sel.length; upd(); });
  paintGen();   // 从别的页面切回来时把已展开的面板还原

  // 部件调试台里点「用这条案例生成代码」→ 回首页填进输入框并直接开跑
  if (window.EIT_LIVE) window.EIT_LIVE.onRecipe = (ask) => {
    if (location.hash !== '#/home') location.hash = '#/home';
    setTimeout(() => {
      const box = $('#prompt');
      if (!box) return;
      box.value = ask;
      box.dispatchEvent(new Event('input'));
      $('#create').click();
    }, 120);
  };
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
  const head = `<div class="phead"><span class="ic">${p.ico}</span><div style="min-width:0">
    <div class="h1" title="${esc(p.task || p.nm)}">${esc(p.nm)}</div>
    <div class="sub">${p.devices.length} 个设备 · 项目 ${p.ver}${p.task && p.task !== p.nm ? ` · <span title="${esc(p.task)}">${esc(p.task.slice(0, 40))}${p.task.length > 40 ? '…' : ''}</span>` : ''}</div></div></div>`;
  // 跟随类项目：项目页直接就是那套「代码 + 实体」面板，
  // 不走原来那四个 Tab（它们是给预置演示项目用的空壳，新建的项目点进去全是空的）
  if (gen && gen.projectId === p.id) {
    v.innerHTML = head + `<div class="genpanel" id="genPanel" style="max-width:none;margin-top:14px"></div>`;
    paintGen();
    return;
  }
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

let hwDirty = true;      // 设备列表有变化才重画，避免每 3 秒闪一次
function syncHW(){
  state.projects.forEach(p => (p.devices || []).forEach(d => {
    if (d._st0 == null) d._st0 = d.status;
    d.status = hwLive(d.plat) ? '已连接' : d._st0; }));
  const b = $('#hwBadge');
  if (b){ const on = state.hw.filter(e => !e.paired); const n = on.length;
    b.textContent = n ? (n === 1 ? '🔌 ' + on[0].nm + ' 已连接' : '🔌 ' + n + ' 台设备在线') : (HW_OK ? '🔌 未插入设备' : '🔌 浏览器不支持插拔检测');
    b.className = 'badge' + (n ? ' ok' : ''); }
  // ⚠️ 不能无条件重画：pullHW 每 3 秒跑一次，整块 DOM 重建会把部件面板擦掉重画，
  //    看着就像设备拔了又插。只有内容真变了才重画。
  if (location.hash.startsWith('#/devices')) { if (hwDirty) paintLive(); }
  else if (/\/(devices|deploy)$/.test(location.hash)) render();
  hwDirty = false;
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
/* ── 第三道识别：VID/PID 和启动日志都认不出来时，直接问芯片本人 ──
   CH340/CP210x 这类通用串口芯片，一个 VID/PID 底下什么板都有，第一道只能写通用名；
   成品固件又普遍关掉了串口日志（XGO-Rider 实测全波特率监听 5 秒 = 0 字节），
   第二道 hwRefine 也没料可吃。这两种板子就靠这一道。

   ESP32 的 ROM bootloader 焊死在芯片里、跟固件无关，任何一块都答得上话 ——
   握手拿芯片型号 + MAC + flash，再读 4KB 固件头认出具体产品。
   实现在桥接侧（bridge/esp32.mjs），指纹库也只放那一份，前端不留第二份免得对不上。

   ⚠️ 握手要脉冲 DTR/RTS = 设备会被复位一次，所以必须用户点了才做，
      而且要先把话说清楚 —— 平衡车正站着的时候点，它会摔。 */
const ESP_VIDS = new Set([0x1A86, 0x10C4, 0x0403, 0x303A]);   // CH34x / CP210x / FTDI / 乐鑫原生 USB
/* 缓存的键带上 VID/PID：COM 号会漂（拔插一次就可能换号），只认 COM 会把
   识别结果套到后来占了这个号的**另一块板**上。VID/PID 对不上就不套。 */
function deepKey(e){ return (e.com || '') + ':' + hex4(e.info && e.info.usbVendorId) + ':' + hex4(e.info && e.info.usbProductId); }
/* 清掉历史遗留的坏记录：早期版本误把整个探测响应存进来了，那种没有 nm，
   留着只会让设备名永远恢复不出来。启动时扫一遍，丢掉。 */
(function pruneDeep(){
  let bad = 0;
  for (const k of Object.keys(state.deep)) {
    const d = state.deep[k];
    if (!d || typeof d !== 'object' || !d.nm) { delete state.deep[k]; bad++; }
  }
  if (bad) LS.set('hwdeep', state.deep);
})();

function restoreDeep(){
  state.hw.forEach(e => {
    if (e.deep || !e.com || !e.info) return;
    const d = state.deep[deepKey(e)];
    if (!d) return;
    e.deep = d; e.deepOK = true; e.fixed = true;
    e.nm = state.names[e.key || ''] || d.nm || e.nm;
    e.plat = d.plat || e.plat; e.why = (d.why || '') + ' · 上次识别的结果';
  });
}
/* 谁能深度识别：**任何插着的串口设备**。
   以前这里卡了个 VID 白名单（只认 CH340/CP210x/FTDI/乐鑫），结果 pid.codes(1209)
   的 MicroPython 板和 ST(0483) 的飞控连按钮都看不到 —— 白名单只会漏，不会准。
   识别链本来就是「依次试，都不通就如实说」，试错成本很低，没必要先筛一道。
   蓝牙口排除掉：那头常年是配对着但没开机的设备，问了也白问。 */
function canDeep(e){
  return !!(state.bridge && e.com && !e.net && !e.bt && !e.sim);
}
async function hwDeep(i, force){
  const e = state.hw[i]; if (!e) return;
  const go = await confirmBox('深度识别 ' + esc(e.com),
    '会跟芯片握一次手，把它认出来。<br><b>过程中设备会被复位一次</b>（固件重新启动）——' +
    '平衡类机器人请先扶住或放平，正在跑的程序会从头开始。');
  if (!go) return;

  // 浏览器这边如果正开着串口读日志，桥接就打不开这个口了，先让开
  if (e.opened) await hwClose(e);

  const btn = document.querySelector('[data-esp="' + i + '"]');
  if (btn) { btn.disabled = true; btn.textContent = '识别中…'; }
  let j = null;
  try { j = await (await fetch(state.bridge + '/api/esp32/probe?com=' + encodeURIComponent(e.com) + (force ? '&force=1' : ''))).json(); }
  catch (err) { j = { ok: false, error: '桥接没响应：' + (err.message || '') }; }
  if (btn) { btn.disabled = false; btn.textContent = '🔬 深度识别'; }

  if (!j || !j.ok) {
    const hint = (j && j.hint) || '';
    if (j && j.needInstall) {
      const yes = await confirmBox('还差一个 esptool',
        '深度识别要用 esptool 跟芯片说话。它是纯 python 包，装起来不用编译。<br>现在装吗？');
      if (yes) { toast('正在安装 esptool，约半分钟…');
        const r = await (await fetch(state.bridge + '/api/esp32/install')).json();
        if (r.ok) { toast('✓ 装好了，再点一次深度识别'); return; }
        return toast('装不上：' + (r.error || '').slice(0, 80)); }
      return;
    }
    return toast('识别失败：' + (hint || (j && j.error) || '').slice(0, 90));
  }

  const d = j.device || {};
  // 「能做什么」挂在 device 上一起持久化 —— 它和部件清单是同一次识别的产物
  if (j.actions && j.actions.length) d.actions = j.actions;
  // 指纹库和配方在云端；问不到时把原因写进 note —— 界面上要看得出「为什么没有能做的事」，
  // 而不是静默少一块。needLogin 的情况单独提示：这是要他去登录，不是设备有问题。
  if (j.kbError) d.note = (d.note ? d.note + ' · ' : '') + '云端知识库：' + j.kbError;
  if (d.needLogin) toast('深度识别的判断在云端：先登录并绑定这台机器');
  if (j.com) d.com = j.com;
  e.nm = d.nm || e.nm; e.plat = d.plat || e.plat;
  e.why = d.why || e.why; e.deepOK = true; e.deep = d; e.fixed = true;
  state.deep[deepKey(e)] = d; LS.set('hwdeep', state.deep);
  const k = e.key || ('usb:' + e.info.usbVendorId + ':' + e.info.usbProductId);
  e.key = k;
  syncHW(); paintLive();
  toast('✓ ' + (d.nm || '已识别'));
  deepModal(d, j.warn);
}
/* 深度识别出来的部件面板。跟 ROS / VEX 那两个的**性质不一样，必须写在脸上**：
   那两个是设备自己报的（VEX 报端口图 / ROS 读 rostopic），插什么报什么；
   ESP32 报不了 —— 芯片没有「我接了什么」这种能力。
   所以这里分两档：「已确认」= 这次握手真问出来的；「按型号」= 认出型号后从档案里列的，
   意思是「这个型号应该有」，不是「这台确实有」。混着显示就成了编数据。 */
function fillEsp(){
  document.querySelectorAll('[id^="esp-"]').forEach(box => {
    const e = state.hw[+box.id.slice(4)]; if (!e || !e.deep) return;
    const d = e.deep, parts = d.parts || [];
    const probed = parts.filter(p => p.how === 'probed');
    const model  = parts.filter(p => p.how !== 'probed');
    const card = p => `<div class="pcard ${p.how === 'probed' ? 'ok' : 'warn'}" title="${esc(p.note || '')}">
        <div class="ico">${p.ico || '🔩'}</div>
        <div class="txt"><b>${esc(p.nm)}</b>
          <div class="st"><i>●</i>${p.how === 'probed' ? '已确认' : '按型号'}</div>
          <div class="tp mono">${esc(p.note || '—')}</div></div></div>`;
    const grp = (title, list, tip) => list.length ? `<div class="partgrp">
        <div class="gname">${title}<span class="sub" style="margin:0 0 0 8px;font-size:11.5px;font-weight:400">${tip}</span></div>
        <div class="pcards">${list.map(card).join('')}</div></div>` : '';
    box.innerHTML = `<div class="partshead">
        <b>板上部件</b><span class="pill ok">${probed.length} 确认</span>${model.length ? `<span class="pill">${model.length} 按型号</span>` : ''}
        <span class="grow"></span>
        ${/STK500|ATmega/i.test(d.why || '') ? `<button class="btn sm primary" data-mcusim="${box.id.slice(4)}" data-kind="wokwi" title="源码 → arduino-cli 编译 → Wokwi 云仿真 → 抓串口。免费档每月 50 分钟">🧪 在仿真里跑</button>` : ''}
        ${/STM32/i.test(d.why || '') ? `<button class="btn sm primary" data-mcusim="${box.id.slice(4)}" data-kind="renode" title="Renode 本机无头仿真 STM32，离线不限时">🧪 在仿真里跑</button>` : ''}
        ${(d.actions || []).some(a => a.id === 'led') ? `<button class="btn sm primary" data-rc="${box.id.slice(4)}" title="像实体遥控器那样控制这台设备">🎮 遥控器</button>` : ''}
        <button class="btn sm" data-redeep="${box.id.slice(4)}">⟳ 重新识别</button>
      </div>
      ${grp('这次握手确认的', probed, '直接问芯片问出来的')}
      ${grp('按型号列的', model, '认出是这个型号后照产品档案列的，不是从这台读的')}
      ${actionsHtml(d, box.id.slice(4))}
      ${model.length ? `<div class="sub" style="margin:8px 0 0;font-size:12px">要把「按型号」变成实测：连它的 BLE 往 ${d.ble ? d.ble.write : 'FFF1'} 发查询、从 ${d.ble ? d.ble.notify : 'FFF2'} 收回传，电量／姿态／舵机角度都能读到真值。</div>` : ''}`;
    const rb = box.querySelector('[data-redeep]');
    if (rb) rb.onclick = () => hwDeep(+rb.dataset.redeep, true);
    const sb = box.querySelector('[data-mcusim]');
    if (sb) sb.onclick = () => mcuSimModal(e, sb.dataset.kind);
    const rc = box.querySelector('[data-rc]');
    if (rc) rc.onclick = () => rcModal(e);
    bindActions(box, e);
  });
}

/* 虚拟遥控器。走 helloFly 的高层指令，不是注入裸摇杆量 ——
   飞控确实在广播四通道值（实测 dc05 x4 = 1500 中位），但写入方向没验证过，
   而且裸摇杆写错一个数就是全油门。moveCtrl/rotation/flyHigh 带距离限制，
   同样是「按一下动一点」，风险低一个量级。

   ⚠️ 除了「起飞」，其它按钮都要先起飞才有意义 —— 没起飞时飞控会忽略移动指令。 */
function rcModal(e){
  const com = (e.deep && e.deep.com) || e.com || '';
  const r = modal(`<div class="hd"><b class="h3">🎮 虚拟遥控器</b>
      <span class="badge mono">${esc(com)}</span>
      <span class="pill gray" id="rcSt">未连接</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      <div class="rcwarn">
        ⚠️ 这些按钮会让<b>真实飞机动起来</b>。开始之前请确认：桨叶情况已知、周围无人、有足够空间。<br>
        右下角的 <b>急停</b> 会立刻上锁停桨 —— 出任何意外先按它。
      </div>
      <div class="row" style="margin:10px 0;gap:8px;align-items:center">
        <button class="btn primary" id="rcConn">🔌 连接飞机</button>
        <span class="sub" style="margin:0;font-size:12.5px">先连上才能操作</span>
        <span class="grow"></span>
        <span class="sub" style="margin:0;font-size:12px">每次移动</span>
        <input type="range" id="rcStep" min="20" max="150" step="10" value="50" style="width:120px">
        <b class="mono" id="rcStepV" style="font-size:12.5px;min-width:48px">50 cm</b>
      </div>
      <div class="rcgrid">
        <div class="rcpad">
          <div class="sub" style="margin:0 0 6px;font-size:12.5px;font-weight:600">水平移动</div>
          <div class="rcpad3">
            <span></span><button class="btn rcbtn" data-mv="前">▲<br><span>前</span></button><span></span>
            <button class="btn rcbtn" data-mv="左">◀<br><span>左</span></button>
            <button class="btn rcbtn danger" id="rcStop">⏹<br><span>急停</span></button>
            <button class="btn rcbtn" data-mv="右">▶<br><span>右</span></button>
            <span></span><button class="btn rcbtn" data-mv="后">▼<br><span>后</span></button><span></span>
          </div>
        </div>
        <div class="rcpad">
          <div class="sub" style="margin:0 0 6px;font-size:12.5px;font-weight:600">升降 / 旋转</div>
          <div class="rcpad3">
            <span></span><button class="btn rcbtn" data-mv="上">⤒<br><span>上升</span></button><span></span>
            <button class="btn rcbtn" data-rot="-90">↺<br><span>左转</span></button>
            <span></span>
            <button class="btn rcbtn" data-rot="90">↻<br><span>右转</span></button>
            <span></span><button class="btn rcbtn" data-mv="下">⤓<br><span>下降</span></button><span></span>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <button class="btn danger" id="rcTakeoff">🚁 起飞（1 米）</button>
        <button class="btn" id="rcLand">🛬 降落</button>
        <button class="btn" id="rcLed">💡 灯</button>
        <span class="grow"></span>
        <span class="sub" style="margin:0;font-size:12px">往返约 230ms</span>
      </div>
      <div class="sub" style="margin:12px 0 6px;font-size:12.5px">操作记录</div>
      <div class="hwlog mono" id="rcLog" style="height:160px">（还没连接）</div>
    </div>`);

  const $$ = x => r.querySelector(x);
  const st = $$('#rcSt'), logEl = $$('#rcLog');
  let conn = false, busy = false, alive = true;
  const dead = () => !alive || !document.body.contains(r);
  const log = t => { logEl.textContent = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${t}\n` + logEl.textContent;
    logEl.textContent = logEl.textContent.slice(0, 4000); };
  const step = () => +$$('#rcStep').value;
  $$('#rcStep').oninput = () => $$('#rcStepV').textContent = step() + ' cm';

  // 一条一条来。飞控是串行处理的，并发发过去只会乱
  const lock = async fn => { while (busy) await new Promise(z => setTimeout(z, 60)); busy = true; try { return await fn(); } finally { busy = false; } };
  const send = expr => fetch(bridgeBase() + '/api/mpy/link/eval', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expr, timeout: 8 }) })
    .then(x => x.json()).catch(e => ({ ok: false, error: e.message }));

  $$('#rcConn').onclick = async () => {
    const b = $$('#rcConn');
    if (conn) { conn = false; b.textContent = '🔌 连接飞机'; b.classList.add('primary');
      st.textContent = '已断开'; st.className = 'pill gray';
      fetch(bridgeBase() + '/api/mpy/link/close').catch(() => {}); log('已断开'); return; }
    b.disabled = true; b.textContent = '连接中…'; st.textContent = '连接中…';
    const o = await (await fetch(bridgeBase() + '/api/mpy/link/open?com=' + encodeURIComponent(com))).json().catch(e => ({ ok: false, error: e.message }));
    if (!o.ok) { b.disabled = false; b.textContent = '🔌 连接飞机'; st.textContent = '失败'; st.className = 'pill';
      log('✗ 连不上：' + (o.error || '') + (o.hint ? ' · ' + o.hint : '')); return; }
    log('✓ 串口通道已开（这会打断板上正在跑的程序）');
    const f = await (await fetch(bridgeBase() + '/api/mpy/link/fly')).json().catch(e => ({ ok: false, error: e.message }));
    b.disabled = false;
    if (!f.ok) { b.textContent = '🔌 连接飞机'; st.textContent = '飞控没响应'; st.className = 'pill';
      log('✗ 建立飞控对象失败：' + (f.error || '')); return; }
    conn = true; b.textContent = '⏏ 断开'; b.classList.remove('primary');
    st.textContent = '已连接'; st.className = 'pill ok';
    log('✓ 飞控已就绪 ' + String(f.init || '').replace(/\n/g, ' ').slice(0, 60));
  };

  const need = () => { if (!conn) { toast('先点「🔌 连接飞机」'); return false; } return true; };
  const fire = async (expr, label) => {
    if (!need()) return;
    log('→ ' + label);
    const j = await lock(() => send(expr));
    log(j.ok ? '  ✓ ' + (String(j.output || '').replace(/\n/g, ' ').slice(0, 70) || '完成')
             : '  ✗ ' + (j.error || '没反应'));
  };

  // moveCtrl 的方向编号照厂商 API：1前 2后 3左 4右 5上 6下
  const DIR = { 前: 1, 后: 2, 左: 3, 右: 4, 上: 5, 下: 6 };
  r.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
    const d = b.dataset.mv;
    fire(`fh.moveCtrl(0,${DIR[d]},${step()})`, `${d} ${step()} cm`);
  });
  r.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => {
    const a = b.dataset.rot;
    fire(`fh.rotation(0,${a})`, `旋转 ${a}°`);
  });
  $$('#rcLed').onclick = () => fire('fh.ledCtrl(0,1,[0,120,255])', '灯');
  $$('#rcLand').onclick = () => fire('fh.flyCtrl(0,0)', '降落');

  $$('#rcTakeoff').onclick = async () => {
    if (!need()) return;
    const go = await confirmBox('⚠️ 真的要起飞？',
      '飞机会<b>离地飞到约 1 米高</b>，桨会全速转。<br><br>' +
      '确认：周围 2 米内无人、头顶无障碍、地面平整。<br>' +
      '另外厂商 API 要求<b>通信密码不能是默认的 12345678</b>，否则飞控会拒绝起飞。');
    if (!go) return;
    fire('fh.takeOff(0,100)', '起飞到 100 cm');
  };

  // 急停不排队 —— 前面要是卡着一条指令，等它跑完就晚了
  $$('#rcStop').onclick = async () => {
    log('→ ⏹ 急停');
    const j = await send('fh.flyCtrl(0,3)');
    log(j.ok ? '  ✓ 已上锁停桨' : '  ✗ 急停没送出去：' + (j.error || ''));
    toast(j.ok ? '已急停' : '急停失败，快用实体遥控器！');
  };

  // 关窗断开通道，别让串口一直占着
  const halt = () => { alive = false; if (conn) fetch(bridgeBase() + '/api/mpy/link/close').catch(() => {}); };
  r.querySelector('[data-close]').addEventListener('click', halt);
  new MutationObserver((m, o) => { if (dead()) { halt(); o.disconnect(); } }).observe($('#modalRoot'), { childList: true });
}

/* 「能做什么」：识别回答「这台有什么」，这里回答「拿它能干什么」。
   看到「📷 摄像头」不等于知道能让它去认 AprilTag —— 两件事，都要写在脸上。 */
const ACT_GRP = ['看', '读', '控制', '飞行'];
function actionsHtml(d, idx){
  const acts = d.actions || [];
  if (!acts.length) return '';
  const byGrp = {};
  acts.forEach(a => (byGrp[a.grp] = byGrp[a.grp] || []).push(a));
  const card = a => `<div class="actcard ${a.safe ? '' : 'danger'}">
      <div class="row" style="gap:7px;align-items:center">
        <span style="font-size:17px">${a.ico}</span><b style="font-size:13px">${esc(a.nm)}</b>
        ${a.safe ? '' : '<span class="badge" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5">会动</span>'}
        <span class="grow"></span>
        <button class="btn sm ${a.safe ? 'primary' : 'danger'}" data-act="${esc(a.id)}" data-i="${idx}">▶ 跑一下</button>
      </div>
      <div class="sub" style="margin:5px 0 0;font-size:12px">${esc(a.why)}</div>
      ${a.warn ? `<div class="sub" style="margin:5px 0 0;font-size:11.5px;color:#b91c1c">${esc(a.warn)}</div>` : ''}
      <div class="sub mono" style="margin:5px 0 0;font-size:11px">「${esc(a.ask)}」</div>
    </div>`;
  return `<div class="partgrp" style="margin-top:14px">
      <div class="gname">能拿它做什么
        <span class="sub" style="margin:0 0 0 8px;font-size:11.5px;font-weight:400">按板上实际有的模块筛出来的 ${acts.length} 项 · 点「跑一下」直接在设备上执行</span></div>
      ${ACT_GRP.filter(g => byGrp[g]).map(g => `
        <div style="margin-top:8px"><div class="sub" style="margin:0 0 5px;font-size:12px;font-weight:600">${esc(g)}</div>
        <div class="actgrid">${byGrp[g].map(card).join('')}</div></div>`).join('')}
    </div>`;
}

function bindActions(box, e){
  box.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    const a = ((e.deep || {}).actions || []).find(x => x.id === b.dataset.act);
    if (!a) return;
    if (!a.safe) {
      const go = await confirmBox('⚠️ ' + esc(a.nm),
        (a.warn ? esc(a.warn) + '<br><br>' : '') +
        '这条会让设备<b>真的动起来</b>。确认现场安全（周围无人、桨叶情况已知、有足够空间）再继续。');
      if (!go) return;
    }
    actionModal(e, a);
  });
}

/* 跑一条能力：代码可改，跑完把设备的输出带回来。
   ⚠️ 走的是 raw REPL 写文件再 exec —— REPL 不吃多行缩进，逐行喂必然串行。 */
function actionModal(e, a){
  const com = (e.deep && e.deep.com) || e.com || '';
  const r = modal(`<div class="hd"><b class="h3">${a.ico} ${esc(a.nm)}</b>
      <span class="badge mono">${esc(com)}</span>
      ${a.safe ? '<span class="badge ok">不会动</span>' : '<span class="badge" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5">会动</span>'}
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      <div class="sub" style="margin:0 0 6px;font-size:12.5px">${esc(a.why)}</div>
      ${a.warn ? `<div class="sub" style="margin:0 0 8px;font-size:12px;color:#b91c1c">${esc(a.warn)}</div>` : ''}
      <textarea id="acCode" class="mono" style="width:100%;height:200px;font-size:12px">${esc(a.code)}</textarea>
      <div class="row" style="margin-top:8px;gap:8px;align-items:center">
        <span class="sub" style="margin:0;font-size:12.5px">跑</span>
        <input id="acSecs" type="number" value="6" min="1" max="30" style="width:60px">
        <span class="sub" style="margin:0;font-size:12.5px">秒后收结果</span>
        <label class="chk"><input type="checkbox" id="acPersist"> 写成开机自动运行（覆盖 /user.py）</label>
        <span class="grow"></span>
        <button class="btn primary" id="acRun">▶ 在设备上跑</button>
      </div>
      <div class="sub" style="margin:12px 0 6px;font-size:12.5px">设备的输出</div>
      <div class="hwlog mono" id="acOut" style="height:200px">（还没跑）</div>
    </div>`);
  const out = r.querySelector('#acOut'), btn = r.querySelector('#acRun');
  btn.onclick = async () => {
    const persist = r.querySelector('#acPersist').checked;
    if (persist && !await confirmBox('写成开机自动运行？',
        '这会<b>覆盖设备上的 /user.py</b>，原来的程序会没掉。<br>确认之前已经备份过吗？')) return;
    btn.disabled = true; btn.textContent = '跑着…'; out.textContent = '';
    let j;
    try {
      j = await (await fetch(bridgeBase() + '/api/mpy/run', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ com, code: r.querySelector('#acCode').value,
          seconds: +r.querySelector('#acSecs').value || 6, persist }) })).json();
    } catch (err) { j = { ok: false, error: err.message }; }
    btn.disabled = false; btn.textContent = '▶ 在设备上跑';
    if (!j.ok) { out.textContent = '✗ ' + (j.error || '') + (j.hint ? '\n' + j.hint : ''); return toast('没跑成'); }
    out.textContent = (j.note ? '✓ ' + j.note + '\n\n' : '') + (j.output || '（设备没有输出）');
    toast(j.hasError ? '跑完了，但设备报了错' : '✓ 跑完了');
  };
}

/* Isaac 控制台。和 VEX 调试台、Gazebo 那套是同一个形状：
   本体在外面跑（Kit 是个 30GB 的原生程序，塞不进网页），网页只发指令 + 看结果。
   ⚠️ Kit 冷启 26 秒，之后热会话每条指令 ~200ms。第一次点会等，后面不会。 */
const ISAAC_USD_DEFAULT = 'D:/isaac/assets/rosorin_mecanum.usd';
function isaacModal(){
  const r = modal(`<div class="hd"><b class="h3">🎮 Isaac Sim 控制台</b>
      <span class="pill gray" id="isSt">未连接</span>
      <span class="sub" style="margin:0;font-size:12px">本机 GPU · 任何有 URDF/USD 模型的机器人</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      <div class="row" style="gap:8px;align-items:center;margin-bottom:10px">
        <span class="sub" style="margin:0;font-size:12.5px;white-space:nowrap">模型 USD</span>
        <input id="isUsd" value="${ISAAC_USD_DEFAULT}" class="mono" style="flex:1;font-size:12px">
        <button class="btn primary" id="isLoad">▶ 加载</button>
      </div>
      <div class="vexdbg">
        <div class="vxscr">
          <div class="partshead" style="margin:0 0 8px"><b>渲染画面</b>
            <span class="pill gray" id="isImgSt">未开始</span><span class="grow"></span>
            <button class="btn sm" id="isLive">▶ 实时画面</button></div>
          <div class="vxfrm"><img id="isImg" alt=""><div class="vxph" id="isPh">先「加载」模型，再点「实时画面」<span class="sub" style="display:block;font-size:12px;margin-top:6px">Kit 首次启动约 26 秒，之后每帧 ~200ms</span></div></div>
        </div>
        <div class="vxside">
          <div class="partshead" style="margin:0 0 8px"><b>开一段</b>
            <span class="sub" style="margin:0;font-size:12px">按一下跑 1 秒物理</span></div>
          <div class="vxctl">
            <div class="row" style="gap:6px;justify-content:center"><button class="btn" data-drive="f">▲ 前进</button></div>
            <div class="row" style="gap:6px;justify-content:center;margin-top:6px">
              <button class="btn" data-drive="l">◀ 左转</button>
              <button class="btn" data-drive="s">■ 停</button>
              <button class="btn" data-drive="r">右转 ▶</button></div>
            <div class="row" style="gap:6px;justify-content:center;margin-top:6px"><button class="btn" data-drive="b">▼ 后退</button></div>
            <div class="row" style="margin-top:10px;gap:8px;align-items:center">
              <span class="sub" style="margin:0;font-size:12.5px;white-space:nowrap">速度</span>
              <input type="range" id="isSpd" min="1" max="10" value="3" style="flex:1">
              <b class="mono" id="isSpdV" style="font-size:12.5px;min-width:46px">0.3 m/s</b></div>
          </div>
          <div class="partshead" style="margin:14px 0 8px"><b>状态</b>
            <span class="grow"></span><button class="btn sm" id="isReset">⟲ 复位</button></div>
          <div class="vxlog mono" id="isLog" style="height:170px">（还没加载）</div>
        </div>
      </div>
    </div>`);
  const $$ = x => r.querySelector(x);
  const img = $$('#isImg'), ph = $$('#isPh'), st = $$('#isSt'), imgSt = $$('#isImgSt'), logEl = $$('#isLog');
  let live = false, busy = false, alive = true;
  const dead = () => !alive || !document.body.contains(r);
  const log = t => { logEl.textContent = (t + '\n' + logEl.textContent).slice(0, 4000); };
  // Isaac 是单会话，指令不能并发 —— 排队
  const lock = async fn => { while (busy) await new Promise(z => setTimeout(z, 80)); busy = true; try { return await fn(); } finally { busy = false; } };
  const cmd = (c, ms) => fetch(bridgeBase() + '/api/sim/isaac/cmd', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: c, timeoutMs: ms || 120000 }) })
    .then(x => x.json()).catch(e => ({ ok: false, error: e.message }));

  const spd = () => (+$$('#isSpd').value) / 10;
  $$('#isSpd').oninput = () => $$('#isSpdV').textContent = spd().toFixed(1) + ' m/s';

  $$('#isLoad').onclick = async () => {
    const b = $$('#isLoad'); b.disabled = true; b.textContent = '启动 Isaac…（首次约 26 秒）';
    st.textContent = '启动中…';
    const j = await lock(() => cmd({ cmd: 'load', usd: $$('#isUsd').value.trim(), z: 0.3 }, 240000));
    b.disabled = false; b.textContent = '▶ 加载';
    if (j.ok) { st.textContent = '已加载'; st.className = 'pill ok';
      log(`✓ 模型已加载：${j.bodies} 个刚体、${j.joints} 个关节`);
      log('  ' + (j.bodyNames || []).join('、'));
      if (!live) $$('#isLive').click();
    } else { st.textContent = '失败'; st.className = 'pill'; log('✗ ' + (j.error || '') + (j.hint ? ' · ' + j.hint : '')); }
  };

  async function loop(){
    while (live && !dead()) {
      const t0 = Date.now();
      const j = await lock(() => cmd({ cmd: 'shot' }, 60000));
      if (dead()) return;
      if (j.ok) { img.src = 'data:' + j.mime + ';base64,' + j.data; ph.style.display = 'none';
        imgSt.textContent = j.w + '×' + j.h + ' · ' + (Date.now() - t0) + 'ms'; imgSt.className = 'pill ok'; }
      else { imgSt.textContent = '失败'; imgSt.className = 'pill'; ph.textContent = j.error || '渲染失败'; ph.style.display = ''; }
      await new Promise(z => setTimeout(z, 250));
    }
  }
  $$('#isLive').onclick = () => { live = !live; $$('#isLive').textContent = live ? '⏸ 暂停' : '▶ 实时画面';
    if (live) { imgSt.textContent = '渲染中…'; loop(); } else { imgSt.textContent = '已暂停'; imgSt.className = 'pill gray'; } };

  r.querySelectorAll('[data-drive]').forEach(b => b.onclick = async () => {
    const v = spd(), d = b.dataset.drive;
    const c = { cmd: 'vel', n: 60, x: d === 'f' ? v : d === 'b' ? -v : 0, wz: d === 'l' ? 1.5 : d === 'r' ? -1.5 : 0 };
    b.disabled = true;
    const j = await lock(() => cmd(c, 60000));
    b.disabled = false;
    if (j.ok) log(`${b.textContent.trim()} → 位移 ${j.moved} m　位置 (${j.to.x}, ${j.to.y})${j.mode && j.mode !== 'dynamic' ? '　⚠️ ' + j.mode : ''}`);
    else log('✗ ' + (j.error || ''));
  });
  $$('#isReset').onclick = async () => { const j = await lock(() => cmd({ cmd: 'reset' }, 60000)); log(j.ok ? '已复位' : '✗ ' + j.error); };

  // 关窗只停轮询，不杀 Isaac —— 下次打开就是热的，省掉 26 秒
  const halt = () => { alive = false; live = false; };
  r.querySelector('[data-close]').addEventListener('click', halt);
  new MutationObserver((m, o) => { if (dead()) { halt(); o.disconnect(); } }).observe($('#modalRoot'), { childList: true });
}

/* 烧进 MicroPython 设备：写 /user.py，开机自动跑。
   和 ROS 那条的区别：没有"启动节点"这一步 —— main.py 会 import user，
   所以写完拔线重新上电，程序就自己跑起来了。这也是这台飞机唯一能脱机工作的方式。 */
async function doFlashMpy(){
  const dev = gen.dev || mpyDev();
  const com = dev && ((dev.deep && dev.deep.com) || dev.com);
  if (!com) { genLog('✗ 没找到 MicroPython 设备，先在设备中心做一次深度识别'); gen.stage = 'gen'; paintGen(); return; }
  if (!gen.code || gen.code.trim().length < 20) {
    genLog('✗ 代码框是空的'); gen.stage = 'gen'; paintGen(); return;
  }
  const persist = !!gen.mpyPersist;
  genLog(`正在写入 ${com} 的 ${persist ? '/user.py（开机自动跑）' : '/eit_tmp.py（只跑这一次）'} …`);
  try {
    const j = await (await fetch(bridgeBase() + '/api/mpy/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ com, code: gen.code, seconds: 8, persist }) })).json();
    if (!j.ok) { genLog('✗ 烧录失败：' + (j.error || '') + (j.hint ? ' · ' + j.hint : '')); gen.stage = 'gen'; paintGen(); return; }
    genLog(`✓ 已写入 ${j.written || '?'} 字节 → ${j.remote}`);
    if (persist) {
      genLog('✓ ' + (j.note || '重新上电后自动运行'));
      genLog('现在可以拔掉 USB 了 —— 飞机开机就会跑这段程序');
    } else if (j.output) {
      genLog('── 设备输出 ──');
      for (const l of String(j.output).split('\n').slice(0, 30)) if (l.trim()) genLog('  ' + l);
      if (j.hasError) genLog('⚠️ 设备上报错了，看上面的 Traceback');
    } else {
      genLog('（设备没有输出）');
    }
    gen.stage = 'ready'; paintGen();
  } catch (e) {
    genLog('✗ 烧录出错：' + e.message); gen.stage = 'gen'; paintGen();
  }
}

/* 单片机仿真弹窗。两家分工：
     Wokwi  —— AVR / ESP32，跑在他们的云上（固件会上传，免费档 50 分钟/月）
     Renode —— STM32 全系，本机、离线、不限时
   都不是"看动画"：跑起来把串口抓回来，看程序说了什么。 */
const MCU_SIM_TEMPLATE = `// 读 A0 的模拟量 → 调 LED 亮度 + 驱动舵机，串口打印数值
#include <Servo.h>
Servo arm;
void setup() { Serial.begin(115200); pinMode(9, OUTPUT); arm.attach(10); Serial.println(F("EIT AVR demo ready")); }
void loop() {
  int raw = analogRead(A0);
  analogWrite(9, map(raw, 0, 1023, 0, 255));
  arm.write(map(raw, 0, 1023, 0, 180));
  Serial.print(F("force=")); Serial.println(raw);
  delay(100);
}`;
function mcuSimModal(e, kind){
  const isW = kind === 'wokwi';
  const code0 = (gen && gen.code && /void\s+setup\s*\(/.test(gen.code)) ? gen.code : MCU_SIM_TEMPLATE;
  const r = modal(`<div class="hd"><b class="h3">🧪 在仿真里跑 · ${isW ? 'Wokwi（云）' : 'Renode（本机）'}</b>
      <span class="badge mono">${esc(e.com || '')}</span>
      <span class="badge">${esc((e.deep && e.deep.nm) || e.nm || '')}</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      ${isW ? `<div class="sub" style="margin:0 0 6px;font-size:12.5px">下面是要跑的 Arduino 代码（默认用当前项目生成的，没有就用一段示范）。板型按识别结果自动选。</div>
        <textarea id="msCode" class="mono" style="width:100%;height:210px;font-size:12px">${esc(code0)}</textarea>
        <div class="row" style="margin-top:8px;gap:8px;align-items:center">
          <span class="sub" style="margin:0;font-size:12.5px">串口里出现</span>
          <input id="msExpect" value="EIT AVR demo ready" style="flex:1;max-width:280px">
          <span class="sub" style="margin:0;font-size:12.5px">就算通过</span>
          <span class="grow"></span>
          <button class="btn primary" id="msRun">▶ 编译并在云上跑</button></div>`
      : `<div class="sub" style="margin:0 0 6px;font-size:12.5px">Renode 在本机无头跑 STM32F4。现在先用它自带的演示固件验证链路；等 STM32 的编译链接上，这里就换成你的代码。</div>
        <div class="row" style="gap:8px;align-items:center">
          <span class="sub" style="margin:0;font-size:12.5px">跑</span><input id="msSecs" type="number" value="4" min="1" max="30" style="width:64px"><span class="sub" style="margin:0;font-size:12.5px">秒</span>
          <span class="grow"></span><button class="btn primary" id="msRun">▶ 在本机跑</button></div>`}
      <div id="msStages" style="margin-top:12px"></div>
      <div class="sub" style="margin:12px 0 6px;font-size:12.5px">串口输出</div>
      <div class="hwlog mono" id="msSerial" style="height:220px">（还没跑）</div>
    </div>`);
  const stagesEl = r.querySelector('#msStages'), serialEl = r.querySelector('#msSerial'), btn = r.querySelector('#msRun');
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = isW ? '编译 + 云仿真中…（约 10 秒）' : '仿真中…';
    serialEl.textContent = ''; stagesEl.innerHTML = '';
    let j;
    try {
      const body = isW
        ? { code: r.querySelector('#msCode').value, com: e.com, expect: r.querySelector('#msExpect').value.trim(), timeoutMs: 6000 }
        : { demo: true, com: e.com, seconds: +r.querySelector('#msSecs').value || 4 };
      j = await (await fetch(bridgeBase() + (isW ? '/api/sim/wokwi/run' : '/api/sim/renode/run'),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    } catch (err) { j = { ok: false, error: err.message }; }
    btn.disabled = false; btn.textContent = isW ? '▶ 编译并在云上跑' : '▶ 在本机跑';
    const st = j.stages || (j.ok != null ? [{ name: isW ? 'Wokwi' : 'Renode', ok: j.ok, ms: j.ms || 0, log: j.hint || '' }] : []);
    stagesEl.innerHTML = st.map(x => `<div class="row" style="gap:8px;align-items:baseline;font-size:12.5px">
        <span class="pill ${x.ok ? 'ok' : ''}">${x.ok ? '✓' : '✗'}</span><b>${esc(x.name)}</b>
        <span class="sub" style="margin:0">${x.ms ? x.ms + ' ms' : ''}</span></div>
        ${x.log ? `<div class="mono sub" style="margin:2px 0 8px 30px;font-size:11.5px;white-space:pre-wrap">${esc(String(x.log).slice(0, 600))}</div>` : ''}`).join('');
    const text = isW ? (j.serial || '') : (j.uart || []).join('\n');
    serialEl.textContent = text || (j.error ? '✗ ' + j.error + (j.hint ? '\n' + j.hint : '') : '（没有输出）');
    toast(j.ok ? '✓ 仿真通过' : '仿真没通过：' + String(j.error || j.hint || '看看串口和阶段日志').slice(0, 80));
  };
}
function deepModal(d, warn){
  const row = (k, v) => v ? '<div class="row" style="gap:8px;align-items:baseline"><span class="sub" style="margin:0;min-width:72px;font-size:12.5px">' + k + '</span><span class="mono" style="font-size:12.5px">' + esc(String(v)) + '</span></div>' : '';
  const conf = { high: '高 · 固件指纹命中', mid: '中 · 只认到固件工程名', low: '低 · 只认到芯片' }[d.conf] || '';
  const a = d.appDesc || {};
  modal('<div class="hd"><b class="h3">' + esc(d.nm || '识别结果') + '</b><span class="grow"></span><button class="btn sm" data-close>关闭</button></div>' +
    '<div class="bd">' +
    (warn ? '<div class="sub" style="margin:0 0 10px;font-size:12.5px">⚠️ ' + esc(warn) + '</div>' : '') +
    row('厂商', d.vendor) + row('芯片', d.chip) + row('MAC', d.mac) + row('Flash', d.flashSize) +
    row('把握', conf) + row('依据', d.why) +
    (a.idf ? row('固件', 'IDF ' + a.idf + ' · ' + (a.project || '') + ' · ' + (a.date || '')) : '') +
    (d.ble ? row('BLE', '服务 ' + d.ble.svc + ' · 写 ' + d.ble.write + ' · 通知 ' + d.ble.notify) : '') +
    (d.proto ? row('协议', d.proto) : '') +
    (d.note ? '<div class="sub" style="margin:10px 0 0;font-size:12.5px">' + esc(d.note) + '</div>' : '') +
    '</div>');
}
/* 会复位别人设备这种事，不能默默就干了 —— 点之前必须让用户知道代价 */
function confirmBox(title, html){
  return new Promise(resolve => {
    const r = modal('<div class="hd"><b class="h3">' + title + '</b><span class="grow"></span><button class="btn sm" data-close>取消</button></div>' +
      '<div class="bd"><div class="sub" style="margin:0;font-size:13px">' + html + '</div>' +
      '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn primary" id="cfmOk">继续</button></div></div>');
    let done = false;
    r.querySelector('#cfmOk').onclick = () => { done = true; document.querySelector('#modalRoot').innerHTML = ''; resolve(true); };
    const mo = new MutationObserver(() => { if (!done && !document.querySelector('#modalRoot').firstChild) { mo.disconnect(); resolve(false); } });
    mo.observe(document.querySelector('#modalRoot'), { childList: true });
  });
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
  // 仿真不单列成一台设备（那是把「目标」和「设备」混了）：只在真车那行标一个「仿真就绪」
  const gzIps = new Set((j.boards || []).filter(b => b.gz).map(b => b.ip));
  (j.boards || []).forEach(b => { if (b.gz) return; const k = 'net:' + b.ip; keys.add(k);
    let e = state.hw.find(x => x.key === k);
    if (!e) { hwDirty = true;
      state.hw.push({ key: k, src: 'bridge', relayed, net: true, plat: b.plat, nm: b.nm, ip: b.ip,
        gz: false, rosPort: b.rosPort || 9090, gzReady: gzIps.has(b.ip),
        banner: b.banner, why: b.why, services: b.services || [], info: {}, lines: [] });
      toast('🔌 ' + b.nm + ' 已连接（' + b.ip + '）'); changed = true; }
    // plat 也要跟着更新：桥接的识别规则会变（加了新指纹），第一次认成"网络设备"的
    // 板子在后续扫描里被认出型号后，界面上得跟着变 —— 否则「用它新建项目」按钮和
    // 板卡图永远出不来，因为它们都依赖 plat
    else { e.nm = b.nm; e.why = b.why; e.services = b.services || []; e.plat = b.plat || e.plat;
           e.ip = b.ip || e.ip; e.banner = b.banner || e.banner;
           e.rosPort = b.rosPort || e.rosPort || 9090;
           if (e.gzReady !== gzIps.has(b.ip)) { e.gzReady = gzIps.has(b.ip); hwDirty = true; changed = true; } } });
  (j.bt || []).forEach(b => { const k = 'bt:' + b.com; keys.add(k);
    if (state.hw.some(x => x.key === k)) return;
    hwDirty = true;
      state.hw.push({ key: k, src: 'bridge', relayed, bt: true, paired: b.paired, com: b.com, plat: b.plat || '',
      nm: b.nm, why: b.why, info: {}, lines: [] });
    changed = true; });
  state.btSkip = j.btSkip || 0;
  (j.serial || []).forEach(sp => {
    const own = state.hw.find(x => x.port && x.info.usbVendorId === sp.vid && x.info.usbProductId === sp.pid);
    const k = 'com:' + sp.com;
    if (own) { own.com = sp.com;                                    // 已授权的补上 COM 号
      const dup = state.hw.findIndex(x => x.key === k); if (dup >= 0) { state.hw.splice(dup, 1); changed = true; } return; }
    keys.add(k);
    if (state.hw.some(x => x.key === k)) return;
    const hit = sp.vid != null ? usbHit({ usbVendorId: sp.vid, usbProductId: sp.pid }) : null;
    hwDirty = true;
      state.hw.push({ key: k, src: 'bridge', relayed, com: sp.com, userCom: sp.userCom || '',
      info: { usbVendorId: sp.vid, usbProductId: sp.pid },
      plat: hit ? hit.plat : '', nm: hit ? hit.nm : (sp.name || '串口设备'),
      why: (hit ? hit.note : '本机发现的串口设备') + ' · ' + sp.com, lines: [] });
    // 桥接那边已经深度识别过的，直接收下 —— 省掉再复位设备一次。
    // ⚠️ 存的必须是 j.device（扁平的 {nm,why,plat,parts}），不是整个响应 ——
    //    restoreDeep 读的是 d.nm / d.why，套整个响应进去会全是 undefined。
    if (sp.deep && sp.deep.ok && sp.deep.device) {
      const e2 = state.hw[state.hw.length - 1];
      const dk = deepKey(e2);
      // 只在「没有」或者「存的是坏数据」时写。曾经有个版本把整个响应存了进去，
      // 那种记录没有 nm，restoreDeep 读出来全是 undefined —— 得能自愈，
      // 否则用户只能手动清 localStorage 才好得了。
      // actions 和 com 在响应的外层，不在 device 里 —— 只存 device 会把「能做什么」整块丢掉。
      // 判断条件也要带上 actions：老记录有 nm 但没 actions，不更新就永远出不来。
      const dev = { ...sp.deep.device, com: sp.deep.com || sp.com };
      if (sp.deep.actions && sp.deep.actions.length) dev.actions = sp.deep.actions;
      const cur = state.deep[dk];
      if (!cur || !cur.nm || (dev.actions && !cur.actions)) { state.deep[dk] = dev; LS.set('hwdeep', state.deep); }
    }
    toast('🔌 ' + (hit ? hit.nm : '串口设备') + ' 已连接（' + sp.com + '）'); changed = true; });
  state.hw.filter(e => e.src === 'bridge' && !keys.has(e.key)).forEach(e => {
    state.hw.splice(state.hw.indexOf(e), 1); toast('⏏ ' + e.nm + ' 已拔出'); changed = true; hwDirty = true; });
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
      ${state.bridge
        ? (state.relayInfo ? `<span class="badge">配对码 ${esc(state.relayInfo.code)}</span><button class="btn sm" id="hwCopy">⧉ 复制线上链接</button>` : '')
        : `<input id="hwCode" placeholder="配对码" value="${esc(state.relay)}" style="width:120px;text-transform:uppercase"><button class="btn sm" id="hwLink">${state.relay ? '换' : '连'}本机</button>`}
      <button class="btn primary sm" id="hwScan" ${hwScanning ? 'disabled' : ''}>${hwScanning ? '扫描中…' : '🔍 扫描设备'}</button>
      <button class="btn sm" id="hwAuth">＋ 授权设备</button>
      <select class="sm" id="hwSimSel" style="max-width:170px"><option value="">模拟插入（演示）…</option>${PLATFORMS.map(p => `<option value="${p.id}">${esc(p.nm)}</option>`).join('')}</select></div>
    <div id="hwStep" class="sub" style="margin:8px 0 0;font-size:12.5px"></div>
    <div id="hwList" style="margin-top:10px"></div></div>`;
}
function paintLive(){
  restoreDeep();
  const b = $('#hwScan'); if (b) { b.disabled = hwScanning; b.textContent = hwScanning ? '扫描中…' : '🔍 扫描设备'; }
  const st = $('#hwStep'); if (st && !hwScanning) st.textContent = '';
  const el = $('#hwList'); if (!el) return;
  const c = $('#hwCount'); if (c){ const n = state.hw.filter(e => !e.paired).length;
    c.textContent = n + ' 台在线'; c.className = 'pill ' + (n ? 'ok' : 'gray'); }
  el.innerHTML = state.hw.length ? state.hw.map((e, i) => { const pl = e.plat ? platOf(e.plat) : null;
    const nm = state.names[e.key || ''] || e.nm;
    const tag = e.sim ? '<span class="badge">演示</span>' : e.gzReady ? '<span class="badge ok">网络发现 · 🧪 仿真就绪</span>' : e.bt ? `<span class="badge${e.paired ? '' : ' ok'}">蓝牙 · ${e.paired ? '已配对' : '已连接'}</span>` : e.deepOK ? '<span class="badge ok">芯片已确认</span>' : e.fixed ? '<span class="badge ok">日志已确认</span>'
      : e.relayed ? '<span class="badge ok">' + (e.net ? '网络发现' : '本机发现') + ' · 经中转</span>'
      : e.net ? '<span class="badge ok">网络发现</span>' : e.src === 'bridge' ? '<span class="badge">本机发现</span>' : '<span class="badge ok">浏览器已授权</span>';
    const meta = e.sim ? '模拟设备' : e.net ? esc(e.ip) : e.bt ? esc(e.com)
      : (e.com ? esc(e.com) + (e.userCom ? ' + ' + esc(e.userCom) : '') + ' · ' : '')
        + 'VID ' + hex4(e.info.usbVendorId) + ':' + hex4(e.info.usbProductId);
    // 跑着 rosbridge 的就是 ROS 机器人，用 ROS 标志比通用板卡照更说明问题
    const isRos = !!(e.services || []).some(x => /rosbridge/i.test(x));
    // VEX V5 一插会出两个串口（系统口 + 用户程序 stdout），只在第一个上展开面板
    const isVex = e.info && e.info.usbVendorId === 0x2888 &&
      state.hw.findIndex(x => x.info && x.info.usbVendorId === 0x2888) === i;
    return `<div class="hwrow"><span class="dotpulse ${e.sim || e.paired ? 'sim' : ''}"></span>
      ${isRos ? `<span class="boardpic sm roslogo">${rosLogo(34)}</span>`
              : pl ? boardPic(pl, 'boardpic sm') : '<span class="boardpic sm">🔌</span>'}
      <div class="devinfo"><b>${esc(nm)}</b> ${tag}
        <div class="sub" style="margin:0;font-size:12.5px">${esc(e.why || '')}${e.services && e.services.length ? ' · ' + e.services.map(esc).join(' · ') : ''}${e.banner ? ' · <span class="mono">' + esc(e.banner) + '</span>' : ''}</div>
        ${isRos ? rosHero() : ''}</div>
      <span class="grow"></span>
      <span class="mono" style="font-size:12px;color:var(--mute);white-space:nowrap">${meta}</span>
      ${pl ? `<a class="btn sm" href="#/home" data-use="${e.plat}">用它新建项目</a>` : ''}
      ${e.bt && state.bridge ? `<button class="btn sm" data-test="${i}">↔ 连接测试</button>` : ''}
      ${canDeep(e) ? `<button class="btn sm" data-esp="${i}" title="跟芯片握手问出真实型号（会复位设备一次）">🔬 深度识别</button>` : ''}
      ${e.net && !e.sim && !e.gzReady && (e.services || []).some(x => /rosbridge/i.test(x)) ? `<button class="btn sm" data-gzstart="${i}" title="在这台车上起一套独立的 Gazebo 仿真（无头，约 200MB 内存），话题和真车一致">🧪 起仿真</button>` : ''}
      ${e.gzReady ? `<button class="btn sm" data-gzstop="${i}" title="停掉这套仿真，释放车上内存">■ 停仿真</button>` : ''}
      <button class="btn sm" data-nm="${i}" title="改名">✎</button>
      ${e.port ? `<button class="btn sm" data-log="${i}">${e.opened ? '● 读取中' : '▶ 读串口日志'}</button>` : ''}
      ${e.src === 'bridge' && !e.net ? '' : ''}
      <button class="btn sm" data-rm="${i}">${e.sim ? '拔出' : '移除'}</button>
      ${e.net && !e.sim ? `<div class="partrow" id="parts-${i}"><span class="sub" style="margin:0;font-size:12px">正在读取板上部件…</span></div>` : ''}
      ${e.deep && e.deep.parts ? `<div class="partrow" id="esp-${i}"></div>` : ''}
      ${isVex && !e.sim ? `<div class="vexrow" id="vex-${i}"><span class="sub" style="margin:0;font-size:12px">正在读取 VEX 主控…</span></div>` : ''}
      </div>`; }).join('')
    : `<div class="sub" style="padding:10px 0">还没有设备</div>`;
  if (state.btSkip) el.insertAdjacentHTML('beforeend',
    `<div class="sub" style="margin-top:8px;font-size:12px">另有 ${state.btSkip} 个蓝牙串口未识别</div>`);
  el.querySelectorAll('[data-esp]').forEach(b => b.onclick = () => hwDeep(+b.dataset.esp));
  el.querySelectorAll('[data-log]').forEach(b => b.onclick = () => { const e = state.hw[+b.dataset.log]; if (e.opened) hwClose(e); else { hwOpen(e); hwLogModal(e); } });
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const e = state.hw[+b.dataset.rm];
    if (e.src === 'bridge') return toast('这台是本机实时发现的，拔掉设备它就会自己消失');
    if (e.opened) await hwClose(e); if (e.port && e.port.forget) { try { await e.port.forget(); } catch (_) {} }
    state.hw.splice(+b.dataset.rm, 1); toast('已移除'); syncHW(); paintLive(); });
  el.querySelectorAll('[data-test]').forEach(b => b.onclick = async () => { const e = state.hw[+b.dataset.test];
    b.disabled = true; b.textContent = '连接中…';
    try { const j = await (await fetch(state.bridge + '/api/serial/test?com=' + encodeURIComponent(e.com))).json();
      if (j.online) { e.paired = false; e.why = (j.busy ? '已连接 · 端口被占用' : '已连接') + ' · ' + e.com; toast('✓ ' + e.nm + ' 连接成功'); }
      else { toast('连不上：' + (j.detail || '设备可能没开机')); } }
    catch (err) { toast('连接测试失败'); }
    syncHW(); paintLive(); });
  el.querySelectorAll('[data-nm]').forEach(b => b.onclick = () => { const e = state.hw[+b.dataset.nm]; const k = e.key || ('usb:' + e.info.usbVendorId + ':' + e.info.usbProductId);
    const r = modal(`<div class="hd"><b class="h3">设备改名</b><span class="grow"></span><button class="btn sm" data-close>取消</button></div>
      <div class="bd"><input id="nmIn" value="${esc(state.names[k] || e.nm)}" style="width:100%"><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="nmOk">保存</button></div></div>`);
    const save = () => { const v = r.querySelector('#nmIn').value.trim();
      if (v) state.names[k] = v; else delete state.names[k];
      LS.set('hwnames', state.names); e.key = k; $('#modalRoot').innerHTML = ''; paintLive(); };
    r.querySelector('#nmOk').onclick = save; r.querySelector('#nmIn').onkeydown = ev => { if (ev.key === 'Enter') save(); };
    r.querySelector('#nmIn').focus(); });
  // 仿真起停走桥接 SSH 上车跑 eit_sim.sh。起来后 9091 一开，下一轮设备扫描就会多出一台「仿真车」
  el.querySelectorAll('[data-gzstart]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '起仿真中…（约 40 秒）';
    const j = await rosApi('sim/start', { world: 'empty' }).catch(() => null);
    b.disabled = false; b.textContent = '🧪 起仿真';
    if (j && j.ok && j.running) toast('✓ 仿真起来了，几秒后会出现在设备列表');
    else toast('仿真没起来：' + String((j && (j.out || j.error)) || '').slice(-120));
  });
  el.querySelectorAll('[data-gzstop]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '停止中…';
    const j = await rosApi('sim/stop', {}).catch(() => null);
    partsCaches.gz = null;
    toast(j && j.ok ? '✓ 仿真已停，设备列表几秒后刷新' : '停止失败');
  });
  el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { homeDevs = [b.dataset.use]; });
  fillEsp();
  fillParts();
  fillVex();
}

/** VEX V5：主控固件直接报端口图，不用像 ROS 那样靠节点名猜。
    分组沿用「运动 / 感知 / 通信 / 扩展」，跟 ROS 那边视觉一致。 */
let vexCache = null;
async function fillVex(force){
  const boxes = document.querySelectorAll('[id^="vex-"]');
  if (!boxes.length) return;
  if (!vexCache || force) {
    try { vexCache = await (await fetch(bridgeBase() + '/api/vex/info')).json(); }
    catch (e) { vexCache = { ok: false, error: e.message }; }
  }
  const j = vexCache;
  const GRP = ['运动', '感知', '通信', '扩展', '交互', '其他'];
  boxes.forEach(box => {
    const ent = state.hw[+box.id.slice(4)] || {};
    if (!j || !j.ok) {
      box.innerHTML = `<span class="sub" style="margin:0;font-size:12.5px">${
        j && j.needsSetup ? esc(j.error) : '读不到主控：' + esc((j && j.error) || '未知')}</span>`;
      return;
    }
    const used = (j.ports || []).filter(p => p.key);      // 类型为空/保留的不展示
    const byGrp = {};
    used.forEach(p => (byGrp[p.grp] = byGrp[p.grp] || []).push(p));
    box.innerHTML = `
      <div class="partshead">
        <b>主控端口</b><span class="pill ok">${used.length}</span>
        <span class="badge">队号 ${esc(j.teamnumber || '未设')}</span>
        <span class="badge mono">VEXos ${esc(j.system || '')}</span>
        <span class="sub" style="margin:0;font-size:12px">主控固件直接读出，非推断</span>
        ${(j.slots || []).length ? `<span class="badge">程序槽 ${j.slots.map(x => x.slot).join('/')}</span>` : ''}
        <span class="grow"></span>
        <button class="btn sm primary" data-vexdbg>🩺 调试台</button>
        <button class="btn sm" data-vexre>⟳ 重新读取</button>
      </div>
      ${GRP.filter(g => byGrp[g]).map(g => `
        <div class="partgrp"><div class="gname">${esc(g)}</div>
          <div class="pcards">${byGrp[g].map(p => `
            <div class="pcard ok" style="cursor:default">
              <div class="ico">${p.ico}</div>
              <div class="txt"><b>${esc(p.nm)}</b>
                <div class="st"><i>●</i>已连接</div>
                <div class="tp mono">端口 ${p.port}</div></div>
            </div>`).join('')}</div></div>`).join('')}`;
    const rb = box.querySelector('[data-vexre]');
    if (rb) rb.onclick = async () => { rb.disabled = true; rb.textContent = '读取中…'; await fillVex(true); };
    const db = box.querySelector('[data-vexdbg]');
    if (db) db.onclick = () => vexDebugModal(j, ent.userCom || '');
  });
}

/** VEX 调试台。
    为什么长得跟 ROS 那套部件面板完全不一样：两边的调试模型根本不同。
    ROS 一直在广播话题，订阅上去就有数据；VEX 主控平时什么都不发，
    只有跑着的程序主动 print 才有东西。所以这里给的是三样实打实的：
      ① 主控屏幕实时画面（程序画了什么、报了什么错，全在上面）
      ② 远程启动/停止程序槽（不用跑过去按主控上的按钮）
      ③ 用户程序 stdout（第二个串口，程序 print 的都在这）
    ⚠️ 截屏和启停共用系统口，不能并发 —— 用 lock 串起来，
       否则两边会读到对方的应答帧，表现是随机的 "expecting aa55"。 */
function vexDebugModal(j, userCom){
  const slots = j.slots || [];
  const r = modal(`<div class="hd"><b class="h3">🩺 VEX 调试台</b>
      <span class="badge">队号 ${esc(j.teamnumber || '未设')}</span>
      <span class="badge mono">VEXos ${esc(j.system || '')}</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      <div class="vexdbg">
        <div class="vxscr">
          <div class="partshead" style="margin:0 0 8px"><b>主控屏幕</b>
            <span class="pill gray" id="vxScrSt">未开始</span><span class="grow"></span>
            <button class="btn sm primary" id="vxScrGo">▶ 开始实时画面</button></div>
          <div class="vxfrm"><img id="vxImg" alt=""><div class="vxph" id="vxPh">点「开始实时画面」抓主控屏幕<span class="sub" style="display:block;font-size:12px;margin-top:6px">USB 协议截屏，约 1 秒一帧</span></div></div>

          <div class="partshead" style="margin:14px 0 8px"><b>电机实时数据</b>
            <span class="pill gray" id="vxMotSt">未连接</span>
            <span class="sub" style="margin:0;font-size:12px">主控上的 EIT Agent 5Hz 回传</span></div>
          <div class="vxmot" id="vxMot"><div class="sub" style="padding:12px 2px;font-size:12.5px">
            点右边「🔌 连接程序」之后，这里会出现每个电机的转速 / 温度 / 电流。</div></div>
        </div>

        <div class="vxside">
          <div class="partshead" style="margin:0 0 8px"><b>程序槽</b>
            <span class="pill ${slots.length ? 'ok' : 'gray'}">${slots.length}</span>
            <span class="sub" style="margin:0;font-size:12px">远程启停，不用碰主控</span></div>
          ${slots.length ? `<div class="vxslots">${slots.map(x => `
            <div class="vxslot"><b>槽 ${x.slot}</b>
              <span class="mono sub" style="margin:0;font-size:11.5px">${((x.size || 0) / 1024).toFixed(0)} KB</span>
              <span class="grow"></span>
              <button class="btn sm" data-vxrun="${x.slot}">▶ 运行</button></div>`).join('')}
            </div>
            <div class="row" style="margin-top:8px"><button class="btn sm" id="vxStop">■ 停止当前程序</button></div>`
            : `<div class="sub" style="margin:0;font-size:12.5px">主控里没有已下载的程序</div>`}

          <div class="partshead" style="margin:14px 0 8px"><b>实时控制</b>
            ${userCom ? `<span class="badge mono">${esc(userCom)}</span>` : '<span class="badge">无用户口</span>'}
            <span class="grow"></span>
            ${userCom ? '<button class="btn sm primary" id="vxLink">🔌 连接程序</button>' : ''}</div>
          <div class="vxctl" id="vxCtl">
            <div class="sub" style="margin:0;font-size:12.5px">${userCom
              ? '主控里要跑着 EIT Agent（槽 4）。连上之后就能看数据、点动电机 —— 改参数不用重新烧录。'
              : '没发现第二个 COM 口。VEX 插上通常出两个 COM，用户程序在第二个上。'}</div>
          </div>

          <div class="partshead" style="margin:14px 0 8px"><b>原始日志</b>
            <span class="grow"></span>
            <button class="btn sm" id="vxLogT">展开</button></div>
          <div class="vxlog mono" id="vxLog" hidden></div>
        </div>
      </div>
    </div>`);

  const $$ = s => r.querySelector(s);
  const img = $$('#vxImg'), ph = $$('#vxPh');
  const scrSt = $$('#vxScrSt'), scrGo = $$('#vxScrGo');
  const motBox = $$('#vxMot'), motSt = $$('#vxMotSt');
  const ctl = $$('#vxCtl'), logEl = $$('#vxLog');
  let scrOn = false, busy = false, alive = true;
  let linked = false, seq = 0, armed = false, speed = 15, lastS = null;
  const dead = () => !alive || !document.body.contains(r);

  const log = t => { logEl.textContent += (logEl.textContent ? '\n' : '') + t;
    if (logEl.textContent.length > 20000) logEl.textContent = logEl.textContent.slice(-14000);
    logEl.scrollTop = logEl.scrollHeight; };
  $$('#vxLogT').onclick = e => { logEl.hidden = !logEl.hidden; e.target.textContent = logEl.hidden ? '展开' : '收起'; };

  // 系统口只有一条，截屏和启停得排队（并发会互相读到对方的应答帧）
  const lock = async fn => { while (busy) await new Promise(z => setTimeout(z, 120));
    busy = true; try { return await fn(); } finally { busy = false; } };
  const jget = u => fetch(bridgeBase() + u).then(x => x.json()).catch(e => ({ ok: false, error: e.message }));

  /* ───── 主控屏幕 ───── */
  async function loopScreen(){
    while (scrOn && !dead()) {
      const t0 = Date.now();
      const q = await lock(() => jget('/api/vex/screen'));
      if (dead()) return;
      if (q.ok) { img.src = 'data:' + q.mime + ';base64,' + q.data; ph.style.display = 'none';
        scrSt.textContent = q.w + '×' + q.h + ' · ' + (Date.now() - t0) + 'ms'; scrSt.className = 'pill ok'; }
      else { scrSt.textContent = '失败'; scrSt.className = 'pill';
        ph.textContent = q.error || '截屏失败'; ph.style.display = ''; }
      await new Promise(z => setTimeout(z, 350));
    }
  }
  scrGo.onclick = () => { scrOn = !scrOn;
    scrGo.textContent = scrOn ? '⏸ 暂停' : '▶ 开始实时画面';
    scrGo.classList.toggle('primary', !scrOn);
    if (scrOn) { scrSt.textContent = '抓取中…'; scrSt.className = 'pill'; loopScreen(); }
    else { scrSt.textContent = '已暂停'; scrSt.className = 'pill gray'; } };

  /* ───── 程序槽 ───── */
  r.querySelectorAll('[data-vxrun]').forEach(b => b.onclick = async () => {
    const slot = b.dataset.vxrun; b.disabled = true; b.textContent = '启动中…';
    const q = await lock(() => jget('/api/vex/run?slot=' + slot));
    b.disabled = false; b.textContent = '▶ 运行';
    if (q.ok) { toast('✓ 槽 ' + slot + ' 已启动'); log('── 槽 ' + slot + ' 已启动 ──');
      if (!scrOn) scrGo.click(); }
    else toast('启动失败：' + (q.error || '未知'));
  });
  const sb = $$('#vxStop');
  if (sb) sb.onclick = async () => { sb.disabled = true; sb.textContent = '停止中…';
    const q = await lock(() => jget('/api/vex/stop'));
    sb.disabled = false; sb.textContent = '■ 停止当前程序';
    toast(q.ok ? '✓ 已停止' : '停止失败：' + (q.error || '未知'));
    if (q.ok) { log('── 程序已停止 ──'); linked = false; paintCtl(); } };

  /* ───── 常驻通道：连上之后指令走它，往返 ~150ms ───── */
  const send = cmd => jget('/api/vex/link/send?cmd=' + encodeURIComponent(cmd));

  async function loopPoll(){
    while (linked && !dead()) {
      const q = await jget('/api/vex/link/poll?after=' + seq);
      if (dead()) return;
      if (q.ok) {
        for (const row of q.lines || []) {
          seq = row.n;
          log(row.s.length > 300 ? row.s.slice(0, 300) + '…' : row.s);
          if (row.s.startsWith('S ')) {
            try { lastS = JSON.parse(row.s.slice(2)); } catch (_) {}
          } else if (row.s.startsWith('R ')) {
            try { const rr = JSON.parse(row.s.slice(2));
              if (rr.cmd === 'ARM')    { armed = true;  paintCtl(); }
              if (rr.cmd === 'DISARM') { armed = false; paintCtl(); }
              if (!rr.ok && rr.err) toast(rr.err);
            } catch (_) {}
          }
        }
        if (lastS) paintMotors(lastS);
        if (!q.alive) { linked = false; motSt.textContent = '通道断开'; motSt.className = 'pill'; paintCtl(); }
      }
      await new Promise(z => setTimeout(z, 200));
    }
  }

  const lk = $$('#vxLink');
  if (lk) lk.onclick = async () => {
    if (linked) { linked = false; armed = false; await jget('/api/vex/link/close');
      motSt.textContent = '未连接'; motSt.className = 'pill gray'; lk.textContent = '🔌 连接程序';
      lk.classList.add('primary'); paintCtl(); return; }
    lk.disabled = true; lk.textContent = '连接中…';
    const q = await jget('/api/vex/link/open?userCom=' + encodeURIComponent(userCom));
    lk.disabled = false;
    if (!q.ok) { lk.textContent = '🔌 连接程序'; return toast('连不上：' + (q.error || '未知')); }
    linked = true; seq = 0;
    lk.textContent = '⏏ 断开'; lk.classList.remove('primary');
    motSt.textContent = '已连接'; motSt.className = 'pill ok';
    paintCtl(); loopPoll();
    setTimeout(() => send('INFO'), 300);
  };

  /* ───── 控制面板 ───── */
  function paintCtl(){
    if (!linked) {
      ctl.innerHTML = `<div class="sub" style="margin:0;font-size:12.5px">${userCom
        ? '主控里要跑着 EIT Agent（槽 4）。连上之后就能看数据、点动电机 —— 改参数不用重新烧录。'
        : '没发现第二个 COM 口。'}</div>`;
      return;
    }
    const b = lastS || {};
    ctl.innerHTML = `
      <div class="vxbatt"><span>电池</span>
        <div class="bar2"><i style="width:${Math.max(0, Math.min(100, b.batt || 0))}%"></i></div>
        <b>${b.batt == null ? '—' : b.batt + '%'}</b>
        <span class="mono sub" style="margin:0;font-size:11.5px">${b.mv ? (b.mv / 1000).toFixed(2) + 'V' : ''}</span></div>
      <div class="row" style="margin-top:10px;gap:8px;align-items:center">
        <button class="btn sm ${armed ? 'danger' : 'primary'}" id="vxArm">${armed ? '🔒 锁定电机' : '🔓 解锁电机'}</button>
        <button class="btn sm danger" id="vxEstop">⏹ 急停</button>
        <span class="grow"></span>
        <span class="pill ${armed ? '' : 'ok'}" style="${armed ? 'background:#fee;color:#c00;border-color:#fbb' : ''}">${armed ? '可动' : '安全'}</span>
      </div>
      <div class="row" style="margin-top:10px;gap:8px;align-items:center">
        <span class="sub" style="margin:0;font-size:12.5px;white-space:nowrap">点动速度</span>
        <input type="range" id="vxSpd" min="5" max="40" value="${speed}" style="flex:1">
        <b class="mono" id="vxSpdV" style="font-size:12.5px;min-width:34px">${speed}%</b>
      </div>
      <div class="sub" style="margin:8px 0 0;font-size:11.5px">
        按住 ◀ ▶ 电机才转，松手立刻停。500ms 收不到指令主控也会自己停。</div>`;

    ctl.querySelector('#vxArm').onclick = () => {
      if (!armed) {
        if (!confirm('解锁之后电机就能转了。\n\n确认车已经架空、或者周围有足够空间？')) return;
        send('ARM');
      } else send('DISARM');
    };
    ctl.querySelector('#vxEstop').onclick = () => { send('STOP'); send('DISARM'); toast('已急停'); };
    const sp = ctl.querySelector('#vxSpd');
    sp.oninput = () => { speed = +sp.value; ctl.querySelector('#vxSpdV').textContent = speed + '%'; };
  }

  /* ───── 电机实时表 ───── */
  function paintMotors(s){
    const ms = s.m || [];
    if (!ms.length) { motBox.innerHTML = `<div class="sub" style="padding:10px 2px;font-size:12.5px">主控没报电机</div>`; return; }
    // 只有结构变了才重建 DOM，否则每 200ms 重画会把按住的按钮弄丢
    const sig = ms.map(x => x.p).join(',');
    if (motBox.dataset.sig !== sig) {
      motBox.dataset.sig = sig;
      motBox.innerHTML = ms.map(x => `
        <div class="vxm" data-p="${x.p}">
          <b class="mono">端口 ${x.p}</b>
          <div class="vxbar"><i></i></div>
          <span class="mono vxv"></span>
          <span class="mono vxt"></span>
          <button class="btn sm" data-jog="${x.p}" data-dir="-1">◀</button>
          <button class="btn sm" data-jog="${x.p}" data-dir="1">▶</button>
        </div>`).join('');
      motBox.querySelectorAll('[data-jog]').forEach(bindJog);
    }
    for (const x of ms) {
      const row = motBox.querySelector(`.vxm[data-p="${x.p}"]`);
      if (!row) continue;
      const pct = Math.max(0, Math.min(100, Math.abs(x.rpm) / 2));   // 200rpm 满格
      const i = row.querySelector('.vxbar i');
      i.style.width = pct + '%';
      i.style.background = x.rpm > 0 ? 'var(--ok,#16a34a)' : x.rpm < 0 ? '#f59e0b' : 'var(--line2)';
      row.querySelector('.vxv').textContent = x.rpm + ' rpm';
      row.querySelector('.vxt').textContent = x.tmp + '°C  ' + x.cur + 'mA';
      row.classList.toggle('hot', x.tmp >= 55);
    }
  }

  /** 按住才转：100ms 重发一次（主控 watchdog 是 500ms，但松手要立刻停，不能等它） */
  function bindJog(btn){
    const port = btn.dataset.jog, dir = +btn.dataset.dir;
    let timer = null;
    const start = ev => {
      ev.preventDefault();
      if (!armed) return toast('先点「🔓 解锁电机」');
      send(`M ${port} ${dir * speed}`);
      timer = setInterval(() => send(`M ${port} ${dir * speed}`), 100);
      btn.classList.add('primary');
    };
    const stop = () => { if (!timer) return; clearInterval(timer); timer = null;
      send(`M ${port} 0`); btn.classList.remove('primary'); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(e => btn.addEventListener(e, stop));
  }

  // 关窗就停：断通道、停轮询、让主控自己也锁回去
  const halt = () => { alive = false; scrOn = false;
    if (linked) { linked = false; send('STOP'); send('DISARM');
      setTimeout(() => fetch(bridgeBase() + '/api/vex/link/close').catch(() => {}), 200); } };
  r.querySelector('[data-close]').addEventListener('click', halt);
  new MutationObserver((m, o) => { if (dead()) { halt(); o.disconnect(); } })
    .observe($('#modalRoot'), { childList: true });
}

/** 板上部件：按「感知 / 运动 / 交互」分组的卡片。
    七个标签挤一行看不出结构，分组之后一眼就能看出这台机器的能力构成。 */
async function fillParts(){
  const boxes = [...document.querySelectorAll('[id^="parts-"]')];
  if (!boxes.length) return;
  const GRP_ORDER = ['感知', '运动', '交互', '其他'];
  const STATE = { ok: ['●', 'ok', '工作中'], nodata: ['●', 'warn', '无数据'], nodriver: ['●', 'warn', '未驱动'] };
  // 每个面板对应一台设备（真车 / 仿真车），各取各的部件清单
  for (const box of boxes) {
    const ent = state.hw[+box.id.slice(6)] || {};          // id 是 parts-<i>
    const j = await getParts(false, !!ent.gz);
    paintPartsBox(box, j, ent, GRP_ORDER, STATE);
  }
}
function paintPartsBox(box, j, ent, GRP_ORDER, STATE){
    if (!j || !j.parts || !j.parts.length) {
      box.innerHTML = `<span class="sub" style="margin:0;font-size:12px">未读到板上部件</span>`; return;
    }
    const byGrp = {};
    j.parts.forEach(p => (byGrp[p.grp || '其他'] = byGrp[p.grp || '其他'] || []).push(p));

    box.innerHTML = `
      <div class="partshead">
        <b>板上部件</b><span class="pill ok">${j.parts.length}</span>
        <span class="sub" style="margin:0;font-size:12px">点任意一个看实时数据</span>
        <span class="grow"></span>
        ${(j.allTopics || []).length ? `<button class="btn sm" data-custom>🔍 自定义调试<span class="cnt">${j.allTopics.length}</span></button>` : ''}
        <button class="btn sm" data-reprobe>⟳ 重新探测</button>
      </div>
      ${GRP_ORDER.filter(g => byGrp[g]).map(g => `
        <div class="partgrp">
          <div class="gname">${esc(g)}</div>
          <div class="pcards">${byGrp[g].map(p => {
            const [dot, cls, txt] = STATE[p.state] || STATE.nodata;
            const ifc = (p.interfaces || [])[0];
            return `<button class="pcard ${cls}" data-part="${esc(p.key)}">
              <div class="ico">${p.ico}</div>
              <div class="txt"><b>${esc(p.nm)}</b>
                <div class="st"><i>${dot}</i>${txt}</div>
                <div class="tp mono">${esc(ifc ? ifc.topic : '—')}</div></div>
            </button>`;
          }).join('')}</div>
        </div>`).join('')}`;

    const rb = box.querySelector('[data-reprobe]');
    if (rb) rb.onclick = async () => { rb.disabled = true; rb.textContent = '探测中…'; partsCaches.real = partsCaches.gz = null; partsCache = null; await fillParts(); };

    // 点部件 = 打开实时调试台（数据走 rosbridge 直连，不经桥接）
    const hostOf = () => (ent.ip || j.host || (state.hw.find(h => h.net) || {}).ip || '192.168.55.1');
    const rosPort = j.rosPort || (ent.gz ? 9091 : 9090);
    box.querySelectorAll('[data-part]').forEach(card => card.onclick = () => {
      const part = j.parts.find(x => x.key === card.dataset.part);
      if (!part) return;
      if (!window.EIT_LIVE) return toast('调试台脚本没加载');
      part.rosPort = rosPort;                               // 仿真车连 9091，真车连 9090
      EIT_LIVE.open(part, hostOf(), modal);
    });
    const cb = box.querySelector('[data-custom]');
    if (cb) cb.onclick = () => customDebugModal(j, hostOf());
}

/** 自定义调试。
    部件卡片只画出签名库认得的那几个；这个入口把机器上**所有**话题摊开，
    想看哪个看哪个 —— 包括平台没见过的模块。
    面板不用自己选：按消息类型自动挑（LaserScan→极坐标图、Imu→地平仪、Image→画面…），
    挑不出来就打原始 JSON。这是「别人插上自己的模块也能看穿」那句话的兜底实现。 */
function customDebugModal(j, host){
  const all = (j.allTopics || []).slice().sort((a, b) => a.topic.localeCompare(b.topic));
  const r = modal(`<div class="hd"><b class="h3">🔍 自定义调试</b>
      <span class="pill ok">${all.length} 个话题</span>
      <span class="sub" style="margin:0;font-size:12px">部件卡片之外，任意话题都能直接看</span>
      <span class="grow"></span><button class="btn sm" data-close>关闭</button></div>
    <div class="bd">
      <div class="row" style="margin-bottom:10px">
        <input id="tpQ" placeholder="筛话题或消息类型，例如 scan / Image / imu" style="flex:1">
        <label class="chk"><input type="checkbox" id="tpNew"> 只看未识别的</label>
      </div>
      <div class="tplist" id="tpList"></div>
      <div class="sub" style="margin-top:10px;font-size:12px">
        想看的话题不在列表里？说明那个节点还没起 —— 先让它跑起来，再点「⟳ 重新探测」。</div>
    </div>`);

  const listEl = r.querySelector('#tpList'), q = r.querySelector('#tpQ'), onlyNew = r.querySelector('#tpNew');
  const paint = () => {
    const kw = q.value.trim().toLowerCase();
    const rows = all.filter(t => (!onlyNew.checked || !t.known) &&
      (!kw || t.topic.toLowerCase().includes(kw) || (t.type || '').toLowerCase().includes(kw)));
    listEl.innerHTML = rows.length ? rows.map((t, i) => {
      const pk = (window.EIT_LIVE ? EIT_LIVE.pickPanel(t.topic, t.type) : { ico: '🔎', hint: '原始数据' });
      return `<button class="tprow" data-i="${all.indexOf(t)}">
        <span class="ico">${pk.ico}</span>
        <span class="tt"><b class="mono">${esc(t.topic)}</b>
          <span class="sub" style="margin:0;font-size:11.5px">${esc(t.type || '类型未知')}</span></span>
        <span class="grow"></span>
        ${t.known ? '<span class="badge">已成卡片</span>' : '<span class="badge ok">未识别</span>'}
        <span class="badge">${esc(pk.hint)}</span></button>`;
    }).join('') : `<div class="sub" style="padding:14px 2px">没有匹配的话题</div>`;
    listEl.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const t = all[+b.dataset.i];
      if (!window.EIT_LIVE) return toast('调试台脚本没加载');
      $('#modalRoot').innerHTML = '';                   // 先关选择器，再开面板
      EIT_LIVE.openTopic({ topic: t.topic, type: t.type, dir: t.dir, rosPort: j.rosPort || 9090 }, host, modal);
    });
  };
  q.oninput = paint; onlyNew.onchange = paint; paint(); q.focus();
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
  const cp = $('#hwCopy');
  if (cp) cp.onclick = async () => { const u = 'https://crayxus.com.au/cos.html?hw=' + state.relayInfo.code + '#/devices';
    try { await navigator.clipboard.writeText(u); toast('已复制：' + u); } catch (e) { toast(u); } };
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
/* 账号 / 云端：探本机桥接、拉机器列表和余额，底部账号条跟着变 */
if (window.EIT) {
  EIT.onchange = acctPaint;
  const foot = $('#acctFoot');
  if (foot) foot.onclick = (e) => { if (!e.target.closest('#themeBtn')) acctModal(); };
  EIT.probeBridge().then(() => EIT.refresh());
  setInterval(() => { if (EIT.loggedIn()) EIT.refresh(); }, 30000);
}
setInterval(pullUsage, 15000);
setInterval(pullHW, 3000);   // 本机桥接优先，没有就走中转
})();
