/* 所有网络调用都在这。三个对端：
   - 本机桥接 :8799（设备、编译、烧录、串口、仿真）
   - 账号后端 :8800（登录、资料、经验、成就、排行榜、付费、用量、生成）
   - 静态数据（案例、兼容库、演示数据）
   原则：拿不到就老实说拿不到，由页面决定显示空状态还是「演示数据」；烧录/编译绝不伪造成功。 */

const eitLS = {   // 与经典版共用登录态（eit.token / eit.email），两边登一次就行
  get(k, d) { try { const v = localStorage.getItem('eit.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('eit.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('eit.' + k); } catch (e) {} },
};

export const BRIDGE = location.port === '8799' ? '' : 'http://127.0.0.1:8799';
/* 云端模式：页面不是从本机桥接托管的（比如 crayxus.com.au），账号默认走云端后端；
   本机桥接仍然探一下，探不到就是「云端体验版」—— 界面全部可看，编译烧录等浏览器直连上线。 */
export const CLOUD = !/^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname) && location.port !== '8799';
export const SERVER = (eitLS.get('server', '') || (CLOUD ? 'https://api.crayxus.com.au' : 'http://127.0.0.1:8800')).replace(/\/+$/, '');
export const USAGE_MARK = '###EIT_USAGE###';

export const auth = {
  get token() { return eitLS.get('token', ''); },
  get email() { return eitLS.get('email', ''); },
  loggedIn() { return !!eitLS.get('token', ''); },
  save(token, email) { eitLS.set('token', token); eitLS.set('email', email); },
  clear() { eitLS.del('token'); eitLS.del('email'); },
};

async function req(base, path, { method = 'GET', body, timeout = 12000, headers = {} } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(base + path, {
      method, signal: ctl.signal,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    let d; try { d = JSON.parse(txt); } catch (e) { d = { ok: false, error: txt.slice(0, 200) }; }
    return { status: r.status, ...(d && typeof d === 'object' ? d : { data: d }) };
  } catch (e) {
    return { ok: false, status: 0, offline: true, error: e.name === 'AbortError' ? '请求超时' : '连不上服务' };
  } finally { clearTimeout(t); }
}
const authH = () => (auth.token ? { Authorization: 'Bearer ' + auth.token } : {});

export const bridge = {
  get: (p, o) => req(BRIDGE, p, o),
  post: (p, body, o) => req(BRIDGE, p, { ...o, method: 'POST', body: body || {} }),
  url: (p) => BRIDGE + p,
};
export const server = {
  get: (p, o) => req(SERVER, p, { ...o, headers: authH() }),
  post: (p, body, o) => req(SERVER, p, { ...o, method: 'POST', body: body || {}, headers: authH() }),
  put: (p, body, o) => req(SERVER, p, { ...o, method: 'PUT', body: body || {}, headers: authH() }),
};

/* ───────── NDJSON 流 ─────────
   onLine 收到每一行对象；返回最后一行 done（或 {ok:false} 表示连接断了）。
   支持 AbortController，用户点「取消」就断。 */
export async function stream(path, body, onLine, { signal, base = BRIDGE, headers = {} } = {}) {
  let r;
  try {
    r = await fetch(base + path, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body || {}) });
  } catch (e) {
    return { t: 'done', ok: false, error: e.name === 'AbortError' ? '已取消' : '连不上本机桥接', offline: e.name !== 'AbortError' };
  }
  if (!r.ok && r.status === 404) return { t: 'done', ok: false, error: '桥接还没有这个功能（请更新桥接）', missing: true };
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('ndjson')) {
    // 老接口直接回 JSON：把它当成一行 done
    const d = await r.json().catch(() => ({ ok: false, error: 'HTTP ' + r.status }));
    const done = { t: 'done', ...d };
    onLine && onLine(done);
    return done;
  }
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = ''; let last = null;
  for (;;) {
    let chunk;
    try { chunk = await rd.read(); } catch (e) { return { t: 'done', ok: false, error: e.name === 'AbortError' ? '已取消' : '连接中断' }; }
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch (e) { o = { t: 'log', s: line }; }
      if (o.t === 'done') last = o;
      try { onLine && onLine(o); } catch (e) { console.error(e); }
    }
  }
  if (buf.trim()) { try { const o = JSON.parse(buf); if (o.t === 'done') last = o; onLine && onLine(o); } catch (e) {} }
  return last || { t: 'done', ok: false, error: '流意外结束' };
}

/* ───────── 代码生成（走账号后端，计费在服务端） ───────── */
export async function generate({ task, kind, messages = [], context = '' }, onText, { signal } = {}) {
  const base = auth.loggedIn() ? SERVER : BRIDGE;
  let r;
  try {
    r = await fetch(base + '/api/llm/gen', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ task, kind, messages, context }) });
  } catch (e) { return { ok: false, error: '连不上生成服务' }; }
  if (r.status === 401) return { ok: false, needLogin: true, error: '先登录再生成' };
  if (!r.ok || !r.body) return { ok: false, error: 'HTTP ' + r.status };
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await rd.read().catch(() => ({ done: true }));
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const i = buf.indexOf(USAGE_MARK);
    onText && onText(i >= 0 ? buf.slice(0, i) : buf);
  }
  const i = buf.indexOf(USAGE_MARK);
  let usage = null; let code = i >= 0 ? buf.slice(0, i) : buf;
  if (i >= 0) { try { usage = JSON.parse(buf.slice(i + USAGE_MARK.length)); } catch (e) {} }
  // 服务端拒绝时回的是以 # 开头的一行说明（余额不足 / 没配 Key）
  const head = code.trim();
  if (/^#\s/.test(head) && head.split('\n').length <= 2) {
    return { ok: false, error: head.replace(/^#\s*/, ''), lowBalance: /余额|额度|充值/.test(head) };
  }
  code = code.replace(/^```[a-zA-Z+]*[ \t]*\r?\n/, '').replace(/\r?\n?```[ \t]*$/, '').trim();
  return { ok: true, code, usage };
}

/* ───────── 静态数据 ───────── */
let fixturesP = null;
export const fixtures = () => (fixturesP ||= fetch('data/fixtures.json').then((r) => r.json()).catch(() => ({})));

let casesP = null;
export function loadCases() {
  return (casesP ||= (async () => {
    const idx = await fetch('data/cases/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const fx = await fixtures();
    const ids = (fx.caseIds || []);
    let list = idx && Array.isArray(idx.cases) ? idx.cases : [];
    // 索引可能还没生成完整（Track B 验证中）——缺的直接读 case.json 补上
    const have = new Set(list.map((c) => c.id));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length) {
      const extra = await Promise.all(missing.map((id) => fetch(`data/cases/${id}/case.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      list = list.concat(extra.filter(Boolean).map((c) => ({ ...c, families: [...new Set((c.boards || []).map((b) => b.family))], parts: (c.parts || []).length })));
    }
    const cats = (idx && idx.categories) || fx.categories || [];
    return { cases: list, categories: cats, generatedAt: idx && idx.generatedAt };
  })());
}
export async function loadCase(id) {
  const [c, code] = await Promise.all([
    fetch(`data/cases/${id}/case.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`data/cases/${id}/sketch.ino`).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
  ]);
  if (!c) return null;
  const idx = await loadCases();
  const meta = idx.cases.find((x) => x.id === id) || {};
  return { ...c, code, build: meta.build || null, verified: meta.verified };
}
let libsP = null;
export const loadLibraries = () => (libsP ||= fetch('data/libraries.json').then((r) => (r.ok ? r.json() : [])).catch(() => []));
