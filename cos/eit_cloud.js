/* EI TOKEN · 云端接入层
   登录态、机器绑定、以及「本机直连 / 走云中转」的自动切换。

   为什么要双模式：
     - 本机模式：页面和桥接在同一台电脑，直连 127.0.0.1，实时面板能连内网，延迟最低
     - 云端模式：人在手机上/别的电脑上，指令经云中转下到用户机器上的桥接
   同一套调用接口，谁在用、在哪用，自动选路 —— 上层代码不用关心。

   Token 放 localStorage 而不是 Cookie：页面和 API 大概率不同域，
   跨站 Cookie 要 Secure+SameSite=None 还处处要 credentials，不如显式带 Bearer。 */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('eit.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('eit.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('eit.' + k); } catch (e) {} },
  };

  /* ?api= 只认自己人。它存在的意义是现场切本机后端 —— 但任何 URL 都收的话，
     一条 cos.html?api=https://evil 的链接就能让人在真页面、真域名下把邮箱密码交给别人。 */
  const apiParam = (() => {
    const v = new URLSearchParams(location.search).get('api');
    if (!v) return '';
    try {
      const h = new URL(v).hostname;
      const ok = h === '127.0.0.1' || h === 'localhost' || h === 'crayxus.com.au' || h.endsWith('.crayxus.com.au');
      if (!ok) console.warn('[EIT] ?api= 指向的不是自己的服务器，已忽略：' + h);
      return ok ? v : '';
    } catch (e) { return ''; }
  })();

  const EIT = {
    // 上线改成 https://api.crayxus.com.au。?api= 只在白名单内生效（见上）
    server: (apiParam || LS.get('server', '') || 'http://127.0.0.1:8800').replace(/\/+$/, ''),
    bridge: 'http://127.0.0.1:8799',
    token: LS.get('token', ''),
    email: LS.get('email', ''),
    balance: null,
    machineId: LS.get('machine', null),
    machines: [],
    bridgeLocal: false,     // 本机桥接探到没有
    onchange: () => {},
  };

  const j = async (url, opt) => {
    const r = await fetch(url, opt);
    const t = await r.text();
    let d = {}; try { d = JSON.parse(t); } catch (e) { d = { ok: false, error: t.slice(0, 200) }; }
    return { code: r.status, ...d };
  };
  const auth = () => (EIT.token ? { Authorization: 'Bearer ' + EIT.token } : {});
  const post = (p, body, base) => j((base || EIT.server) + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify(body || {}),
  });
  const get = (p, base) => j((base || EIT.server) + p, { headers: auth() });

  /* ───────── 账号 ───────── */
  EIT.register = async (email, password) => {
    const r = await post('/api/auth/register', { email, password });
    if (r.ok) EIT._setSession(r.token, r.email, r.verified);
    return r;
  };
  EIT.login = async (email, password) => {
    const r = await post('/api/auth/login', { email, password });
    if (r.ok) EIT._setSession(r.token, r.email, r.verified);
    return r;
  };
  EIT.logout = async () => {
    try { await post('/api/auth/logout'); } catch (e) {}
    EIT.token = ''; EIT.email = ''; EIT.balance = null; EIT.machines = []; EIT.machineId = null;
    LS.del('token'); LS.del('email'); LS.del('machine');
    EIT.onchange();
  };
  EIT._setSession = (token, email, verified) => {
    EIT.token = token; EIT.email = email; EIT.verified = !!verified;
    LS.set('token', token); LS.set('email', email);
    EIT.refresh();
  };
  EIT.loggedIn = () => !!EIT.token;

  /* ───────── 机器 ───────── */
  EIT.refresh = async () => {
    if (!EIT.token) { EIT.onchange(); return; }
    const [ms, us, me] = await Promise.all([
      get('/api/machines'), get('/api/usage?days=30'), get('/api/auth/me')]);
    if (me && me.ok) EIT.verified = !!me.verified;
    if (ms.code === 401) { await EIT.logout(); return; }       // 会话过期，别一直报错
    if (ms.ok) {
      EIT.machines = ms.machines || [];
      // 没选过就默认选第一台在线的，省一次点击
      if (!EIT.machines.some((m) => m.id === EIT.machineId)) {
        const pick = EIT.machines.find((m) => m.agent) || EIT.machines[0];
        EIT.machineId = pick ? pick.id : null;
        LS.set('machine', EIT.machineId);
      }
    }
    if (us.ok) EIT.balance = us.balance;
    EIT.onchange();
  };
  EIT.selectMachine = (id) => { EIT.machineId = id; LS.set('machine', id); EIT.onchange(); };
  EIT.currentMachine = () => EIT.machines.find((m) => m.id === EIT.machineId) || null;
  EIT.claim = async (userCode) => {
    const r = await post('/api/pair/claim', { userCode: String(userCode || '').trim().toUpperCase() });
    if (r.ok) await EIT.refresh();
    return r;
  };
  EIT.unbind = async (id) => {
    const r = await j(`${EIT.server}/api/machines/${id}`, { method: 'DELETE', headers: auth() });
    if (r.ok) await EIT.refresh();
    return r;
  };

  /* ───────── 选路 ─────────
     本机桥接探得到就走本机（实时面板要直连内网，云端做不到）；
     否则只要登录了且选中的机器云通道在线，就走云中转。 */
  EIT.mode = () => {
    if (EIT.bridgeLocal) return 'local';
    const m = EIT.currentMachine();
    if (EIT.token && m && m.agent) return 'cloud';
    return 'none';
  };

  EIT.probeBridge = async () => {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 900);
      const r = await fetch(EIT.bridge + '/api/health', { signal: c.signal });
      clearTimeout(t);
      EIT.bridgeLocal = r.ok;
    } catch (e) { EIT.bridgeLocal = false; }
    EIT.onchange();
    return EIT.bridgeLocal;
  };

  /** 统一的设备调用。path 如 'status' / 'deploy'，自动映射成本机接口或云端 RPC 方法 */
  // gz=true 时对着车上的 Gazebo 仿真操作（独立 master / rosbridge 9091），否则是真车
  EIT.ros = async (path, body, gz) => {
    const mode = EIT.mode();
    if (mode === 'local') {
      const opt = body === undefined
        ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) };
      return j(EIT.bridge + '/api/ros/' + path + (gz ? '?gz=1' : ''), opt);
    }
    if (mode === 'cloud') {
      return post(`/api/machines/${EIT.machineId}/rpc`, { method: 'ros.' + path, params: { ...(body || {}), gz: !!gz } });
    }
    return { ok: false, error: '没有可用的设备通道：本机桥接没跑，云端也没有在线的机器' };
  };

  /** 取一帧画面。本机直接用 MJPEG 流，云端只能快照轮询 */
  EIT.imageUrl = (topic, host) => {
    if (EIT.mode() === 'local') {
      // ⚠️ 斜杠不能编码，web_video_server 不解 %2F
      const t = String(topic).replace(/[?&#=]/g, encodeURIComponent);
      return `http://${host}:8080/stream?topic=${t}&t=${Date.now()}`;
    }
    return null;   // 云端模式没有直连流，调用方改用 EIT.snapshot 轮询
  };
  EIT.snapshot = async (topic, host) => {
    const r = await post(`/api/machines/${EIT.machineId}/rpc`,
      { method: 'snapshot', params: { topic, host, quality: 60 } });
    return r.ok && r.data ? `data:${r.mime};base64,${r.data}` : null;
  };

  /** 生成代码：登录了就走云端（那边才有计费和额度控制），否则退回本机桥接 */
  EIT.genUrl = () => (EIT.token ? EIT.server : EIT.bridge) + '/api/llm/gen';
  EIT.genHeaders = () => ({ 'Content-Type': 'application/json', ...(EIT.token ? auth() : {}) });

  /* ───────── 邮箱验证 ───────── */
  EIT.sendCode = () => post('/api/auth/send-code');
  EIT.verify = async (code) => {
    const r = await post('/api/auth/verify', { code });
    if (r.ok) { EIT.verified = true; await EIT.refresh(); }
    return r;
  };

  EIT.usage = (days = 30) => get(`/api/usage?days=${days}`);

  window.EIT = EIT;
})();
