/* 登录 / 注册：全屏左右分栏。
   左：电路流光 + 「一句话 → 编译 → 烧录」循环动效（所想，即所动）
   右：登录框。登录只在真正需要时弹：生成代码、付费、保存资料到云端。 */
import { esc, toast } from '../core/ui.js';
import { icon } from './icons.js';
import { login, register } from '../core/me.js';
import { motion } from '../core/motion.js';

const g = window.gsap;
let openApi = null;

/* 左侧循环演示的几句话：说一句 → 出代码 → 烧录 → 拿经验 */
const SCRIPTS = [
  { say: '让舵机跟着光线转', board: 'ESP32-S3', fam: 'esp32',
    code: ['#include <ESP32Servo.h>', 'int lux = analogRead(LDR);', 'servo.write(map(lux, 0, 4095, 0, 180));'],
    ach: '驱动舵机' },
  { say: '距离小于 10cm 蜂鸣器就响', board: 'Arduino Uno', fam: 'avr',
    code: ['long cm = sonar.ping_cm();', 'if (cm > 0 && cm < 10)', '  tone(BUZZER, 1800, 120);'],
    ach: '第一次烧录' },
  { say: '温湿度每 5 秒传到手机', board: 'ESP32', fam: 'esp32',
    code: ['float t = dht.readTemperature();', 'mqtt.publish("room/t", String(t));', 'delay(5000);'],
    ach: '连上 WiFi' },
];

function artHTML() {
  return `
  <div class="au-art" aria-hidden="true">
    <canvas class="au-cv"></canvas>
    <div class="au-vign"></div>
    <div class="au-brand">
      <span class="brand-mark"><svg viewBox="0 0 64 64"><defs><linearGradient id="aubm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#aubm)" opacity=".16"/><path d="M18 20h22M18 32h16M18 44h22" stroke="url(#aubm)" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="32" r="5" fill="#22D3EE"/></svg></span>
      <b>EI TOKEN</b>
    </div>

    <div class="au-stage">
      <div class="au-chip" data-par="10">
        <div class="au-chip-core">
          <svg viewBox="0 0 64 64"><path d="M18 20h22M18 32h16M18 44h22" stroke="#E6EAF2" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="32" r="5" fill="#22D3EE"/></svg>
        </div>
        <span class="au-chip-ring"></span>
      </div>

      <div class="au-card au-say" data-par="22">
        <span class="au-say-ic">${icon('sparkles')}</span>
        <span class="au-say-t"><span class="au-typed"></span><i class="au-caret"></i></span>
      </div>

      <div class="au-card au-code" data-par="16">
        <div class="au-code-h"><i></i><i></i><i></i><span class="au-board"></span></div>
        <pre class="au-code-b"></pre>
      </div>

      <div class="au-card au-flash" data-par="28">
        <div class="au-steps">
          <span data-s="0">${icon('check')}编译</span>
          <span data-s="1">${icon('check')}备份</span>
          <span data-s="2">${icon('check')}烧录</span>
        </div>
        <div class="au-bar"><i></i></div>
        <div class="au-flash-f"><span class="au-pct num">0%</span><span class="au-port mute">COM7 · 921600</span></div>
      </div>

      <div class="au-card au-ach" data-par="34">
        <span class="au-ach-ic">${icon('trophy')}</span>
        <span class="stack" style="gap:1px"><b class="au-ach-t">成就解锁</b><small class="au-ach-s"></small></span>
        <span class="au-xp num">+50 XP</span>
      </div>
    </div>

    <div class="au-copy">
      <h2>所想，<span>即所动</span></h2>
      <p>具身智能 AI 工程平台</p>
      <div class="au-pts"><span>识别</span><i></i><span>编写</span><i></i><span>运行</span></div>
    </div>
  </div>`;
}

function formHTML(reason) {
  return `
  <div class="au-side">
    <button class="icon-btn au-x" data-close aria-label="关闭">${icon('x')}</button>
    <div class="au-form-wrap">
      <div class="au-head">
        <h1 id="auTitle">欢迎回来</h1>
        <p class="mute" id="auSub">登录后，经验、成就和项目都会跟着你走。</p>
      </div>
      ${reason ? `<div class="note-box au-reason">${esc(reason)}</div>` : ''}
      <div class="au-seg" role="tablist">
        <button class="on" data-m="login" role="tab" aria-selected="true">登录</button>
        <button data-m="reg" role="tab" aria-selected="false">注册 · 送 ¥5</button>
        <span class="au-seg-ind"></span>
      </div>
      <form class="au-form" id="lgForm" novalidate>
        <div class="au-field">
          <label for="lgUser">邮箱或用户名</label>
          <div class="au-in">${icon('user')}<input id="lgUser" autocomplete="username" placeholder="you@example.com" spellcheck="false"></div>
        </div>
        <div class="au-field">
          <label for="lgPw">密码</label>
          <div class="au-in">${icon('lock')}<input id="lgPw" type="password" autocomplete="current-password" placeholder="••••••••"><button type="button" class="au-eye" id="lgEye" aria-label="显示密码">${icon('eye')}</button></div>
        </div>
        <div class="err-txt" id="lgErr" role="alert"></div>
        <button class="au-go" id="lgGo" type="submit"><span class="au-go-t">登录</span><span class="au-go-ic">${icon('arrowR')}</span></button>
      </form>
      <button class="au-guest" data-close type="button">先逛逛，不登录</button>
      <p class="au-foot mute">识别、烧录、看串口不计费；代码生成按实际用量计费。</p>
    </div>
  </div>`;
}

/* ───────── 电路流光（canvas） ───────── */
function circuit(cv, chipEl) {
  const ctx = cv.getContext('2d');
  const reduce = !motion.on();
  let W = 0, H = 0, dpr = 1, traces = [], pulses = [], raf = 0, last = 0;
  const G = 22;

  function build() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cr = chipEl.getBoundingClientRect();
    const cx = cr.left - r.left + cr.width / 2, cy = cr.top - r.top + cr.height / 2, hs = cr.width / 2;
    traces = [];
    const per = 7;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < per; i++) {
        const o = (i - (per - 1) / 2) * (hs * 1.6 / per);
        const pts = [];
        let x, y, dx, dy;
        if (side === 0) { x = cx + o; y = cy - hs; dx = 0; dy = -1; }
        else if (side === 1) { x = cx + hs; y = cy + o; dx = 1; dy = 0; }
        else if (side === 2) { x = cx + o; y = cy + hs; dx = 0; dy = 1; }
        else { x = cx - hs; y = cy + o; dx = -1; dy = 0; }
        pts.push([x, y]);
        const out = 18 + ((i * 7 + side * 3) % 4) * G * 0.6;
        x += dx * out; y += dy * out; pts.push([x, y]);
        // 一段 45° 斜线，往外侧展开
        const spread = Math.sign(o) || (i % 2 ? 1 : -1);
        const diag = G * (1.2 + ((i + side) % 3) * 0.9);
        if (dx === 0) { x += spread * diag; y += dy * diag; } else { x += dx * diag; y += spread * diag; }
        pts.push([x, y]);
        // 再直走到画面外，中途可能再拐一次
        if (i % 3 === 1) {
          const run = G * (2 + (i % 4));
          x += dx * run; y += dy * run; pts.push([x, y]);
          if (dx === 0) { x += spread * G * 1.5; y += dy * G * 1.5; } else { x += dx * G * 1.5; y += spread * G * 1.5; }
          pts.push([x, y]);
        }
        const far = Math.max(W, H);
        pts.push([x + dx * far, y + dy * far]);
        // 裁剪到画布内，算长度
        const segs = []; let len = 0;
        for (let k = 1; k < pts.length; k++) {
          const a = pts[k - 1], b = pts[k];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          segs.push({ a, b, l, s: len }); len += l;
        }
        traces.push({ pts, segs, len, side, hot: 0 });
      }
    }
    if (!pulses.length) for (let i = 0; i < 22; i++) spawn(true);
  }

  function at(t, d) {
    const L = Math.max(0, Math.min(t.len, d));
    for (const s of t.segs) {
      if (L <= s.s + s.l) { const k = (L - s.s) / s.l; return [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k]; }
    }
    const e = t.segs[t.segs.length - 1].b; return [e[0], e[1]];
  }

  function spawn(pre) {
    const t = traces[(Math.random() * traces.length) | 0];
    const inward = Math.random() < 0.72;
    const maxD = Math.min(t.len, Math.max(W, H) * 0.9);
    pulses.push({
      t, inward, maxD,
      d: pre ? Math.random() * maxD : maxD,
      v: 90 + Math.random() * 120,
      tail: 40 + Math.random() * 70,
      c: inward ? '34,211,238' : '167,139,250',
    });
  }

  function draw(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    ctx.clearRect(0, 0, W, H);

    // 底网格点
    ctx.fillStyle = 'rgba(138,148,173,.10)';
    for (let x = G / 2; x < W; x += G) for (let y = G / 2; y < H; y += G) ctx.fillRect(x, y, 1, 1);

    // 走线
    ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const t of traces) {
      ctx.strokeStyle = t.hot > 0 ? `rgba(34,211,238,${0.18 + t.hot * 0.5})` : 'rgba(80,98,140,.28)';
      ctx.beginPath(); ctx.moveTo(t.pts[0][0], t.pts[0][1]);
      for (let k = 1; k < t.pts.length; k++) ctx.lineTo(t.pts[k][0], t.pts[k][1]);
      ctx.stroke();
      // 拐点过孔
      ctx.fillStyle = 'rgba(11,16,32,1)'; ctx.strokeStyle = t.hot > 0 ? 'rgba(34,211,238,.7)' : 'rgba(80,98,140,.45)';
      for (let k = 1; k < t.pts.length - 1; k++) {
        ctx.beginPath(); ctx.arc(t.pts[k][0], t.pts[k][1], 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      t.hot = Math.max(0, t.hot - dt * 1.6);
    }

    // 光脉冲
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (!reduce) p.d += (p.inward ? -1 : 1) * p.v * dt;
      if ((p.inward && p.d <= 0) || (!p.inward && p.d >= p.maxD)) {
        if (p.inward) { p.t.hot = 1; chipPing(); }
        pulses.splice(i, 1); spawn(false); continue;
      }
      const head = at(p.t, p.d);
      const steps = 14;
      for (let s = steps; s >= 0; s--) {
        const back = p.inward ? p.d + (p.tail * s) / steps : p.d - (p.tail * s) / steps;
        const q = at(p.t, back), a = (1 - s / steps);
        ctx.fillStyle = `rgba(${p.c},${a * a * 0.9})`;
        ctx.beginPath(); ctx.arc(q[0], q[1], 1.1 + a * 1.1, 0, Math.PI * 2); ctx.fill();
      }
      const grd = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 10);
      grd.addColorStop(0, `rgba(${p.c},.9)`); grd.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(head[0], head[1], 10, 0, Math.PI * 2); ctx.fill();
    }
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  let pingLock = 0;
  function chipPing() {
    const now = performance.now();
    if (now - pingLock < 260 || !g) return; pingLock = now;
    g.fromTo(chipEl.querySelector('.au-chip-ring'), { scale: 1, opacity: 0.55 }, { scale: 1.55, opacity: 0, duration: 0.9, ease: 'power2.out' });
  }

  const ro = new ResizeObserver(() => { build(); if (reduce) draw(0); });
  ro.observe(cv);
  build();
  if (reduce) draw(0); else raf = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

/* ───────── 左侧循环剧本（GSAP timeline） ───────── */
function story(art) {
  const q = (s) => art.querySelector(s);
  const say = q('.au-say'), code = q('.au-code'), flash = q('.au-flash'), ach = q('.au-ach');
  const typed = q('.au-typed'), pre = q('.au-code-b'), board = q('.au-board');
  const bar = q('.au-bar i'), pct = q('.au-pct'), steps = art.querySelectorAll('.au-steps span');

  const hl = (l) => esc(l)
    .replace(/(#include)/g, '<b class="pp">$1</b>')
    .replace(/(&lt;[\w.]+&gt;|&quot;[^&]*&quot;)/g, '<b class="str">$1</b>')
    .replace(/\b(int|long|float|if|return)\b/g, '<b class="kw">$1</b>')
    .replace(/\b(\d+)\b/g, '<b class="num">$1</b>')
    .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<b class="fn">$1</b>');

  const fill = (sc) => {
    board.innerHTML = `<i style="background:var(--fam-${sc.fam})"></i>${esc(sc.board)}`;
    q('.au-ach-s').textContent = sc.ach;
  };

  if (!motion.on()) {
    const sc = SCRIPTS[0]; fill(sc);
    typed.textContent = sc.say; pre.innerHTML = sc.code.map(hl).join('\n');
    bar.style.transform = 'scaleX(1)'; pct.textContent = '100%';
    steps.forEach((s) => s.classList.add('on'));
    return () => {};
  }

  const tl = g.timeline({ repeat: -1, repeatDelay: 0.2 });
  SCRIPTS.forEach((sc) => {
    const o = { n: 0, c: 0, p: 0 };
    const full = sc.code.join('\n');
    tl.call(() => {
      fill(sc); typed.textContent = ''; pre.innerHTML = ''; pct.textContent = '0%';
      steps.forEach((s) => s.classList.remove('on')); g.set(bar, { scaleX: 0 });
    })
      .fromTo(say, { y: 16, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' })
      .to(o, { n: sc.say.length, duration: sc.say.length * 0.075, ease: 'none', onUpdate: () => (typed.textContent = sc.say.slice(0, Math.round(o.n))) })
      .fromTo(code, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, '+=0.25')
      .to(o, { c: full.length, duration: 1.3, ease: 'none', onUpdate: () => {
        const cut = full.slice(0, Math.round(o.c));
        pre.innerHTML = cut.split('\n').map(hl).join('\n') + '<i class="au-caret"></i>';
      } })
      .fromTo(flash, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, '+=0.15')
      .to(o, { p: 100, duration: 1.9, ease: 'power1.inOut', onUpdate: () => {
        g.set(bar, { scaleX: o.p / 100 }); pct.textContent = Math.round(o.p) + '%';
        steps.forEach((s, i) => s.classList.toggle('on', o.p >= [30, 55, 99][i]));
      } })
      .fromTo(ach, { y: 14, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.4)' }, '+=0.05')
      .call(() => motion.burst(ach.querySelector('.au-ach-ic'), { count: 14 }))
      .to([say, code, flash, ach], { opacity: 0, y: -10, duration: 0.4, stagger: 0.05, ease: 'power2.in' }, '+=1.6');
  });
  return () => tl.kill();
}

/* 鼠标视差：卡片按层级轻微跟随 */
function parallax(art) {
  if (!motion.on()) return () => {};
  const els = [...art.querySelectorAll('[data-par]')];
  const mv = (e) => {
    const r = art.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    els.forEach((el) => { const k = +el.dataset.par; g.to(el, { x: nx * k, y: ny * k * 0.7, duration: 0.8, ease: 'power3.out', overwrite: 'auto' }); });
  };
  window.addEventListener('pointermove', mv, { passive: true });
  return () => window.removeEventListener('pointermove', mv);
}

export function openLogin({ reason = '', onDone } = {}) {
  if (openApi) return openApi;
  let mode = 'login', closed = false;
  const root = document.createElement('div');
  root.className = 'auth-screen';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'auTitle');
  root.innerHTML = artHTML() + formHTML(reason);
  document.getElementById('layer').appendChild(root);
  document.documentElement.classList.add('au-lock');
  const prevFocus = document.activeElement;
  const q = (x) => root.querySelector(x);
  const art = q('.au-art');

  const stops = [circuit(q('.au-cv'), q('.au-chip')), story(art), parallax(art)];

  const onKey = (e) => { if (e.key === 'Escape') api.close(); };
  document.addEventListener('keydown', onKey);

  const api = {
    el: root,
    close: async () => {
      if (closed) return; closed = true; openApi = null;
      document.removeEventListener('keydown', onKey);
      if (motion.on()) await new Promise((r) => g.to(root, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: r }));
      stops.forEach((s) => s());
      root.remove(); document.documentElement.classList.remove('au-lock');
      try { prevFocus && prevFocus.focus(); } catch (e) {}
    },
  };
  openApi = api;
  root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => api.close()));

  // 入场
  if (motion.on()) {
    g.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    g.fromTo(q('.au-form-wrap').children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, delay: 0.12, ease: 'power3.out' });
    g.fromTo(q('.au-chip'), { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.6)', delay: 0.1 });
    g.fromTo(q('.au-copy').children, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, delay: 0.25, ease: 'power3.out' });
  }
  setTimeout(() => q('#lgUser').focus(), 80);

  // 登录 / 注册切换，指示条滑动
  const ind = q('.au-seg-ind');
  const moveInd = (b) => { ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft - 4}px)`; };
  requestAnimationFrame(() => moveInd(q('[data-m="login"]')));
  root.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
    mode = b.dataset.m;
    root.querySelectorAll('[data-m]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    moveInd(b);
    const reg = mode === 'reg';
    q('.au-go-t').textContent = reg ? '注册并登录' : '登录';
    q('#auTitle').textContent = reg ? '创建你的账号' : '欢迎回来';
    q('#auSub').textContent = reg ? '新账号送 ¥5 额度，从「见习创客」开始升级。' : '登录后，经验、成就和项目都会跟着你走。';
    q('#lgPw').autocomplete = reg ? 'new-password' : 'current-password';
    q('#lgPw').placeholder = reg ? '至少 8 位' : '••••••••';
    q('label[for="lgUser"]').textContent = reg ? '邮箱' : '邮箱或用户名';
    q('#lgErr').textContent = '';
    if (motion.on()) g.fromTo([q('#auTitle'), q('#auSub')], { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.04 });
  }));

  q('#lgEye').onclick = () => {
    const pw = q('#lgPw'), show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    q('#lgEye').classList.toggle('on', show);
    q('#lgEye').setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
  };

  q('#lgForm').onsubmit = async (e) => {
    e.preventDefault();
    const u = q('#lgUser').value.trim(), p = q('#lgPw').value;
    const err = q('#lgErr'), go = q('#lgGo'), form = q('#lgForm');
    if (!u || !p) { err.textContent = '请填好账号和密码'; motion.shake(form); return; }
    if (mode === 'reg' && (u.indexOf('@') < 0 || p.length < 8)) { err.textContent = '注册需要邮箱，密码至少 8 位'; motion.shake(form); return; }
    go.disabled = true; go.classList.add('busy'); err.textContent = '';
    const r = mode === 'login' ? await login(u, p) : await register(u, p);
    go.classList.remove('busy');
    if (!r.ok) {
      go.disabled = false;
      err.textContent = r.offline ? '账号服务没连上，稍后再试' : (r.error || '没成功');
      motion.shake(form); return;
    }
    go.classList.add('done'); q('.au-go-t').textContent = mode === 'login' ? '登录成功' : '注册成功';
    q('.au-go-ic').innerHTML = icon('check');
    motion.burst(go, { count: 22 });
    toast(mode === 'login' ? '欢迎回来' : '注册成功，¥5 额度已到账', 'ok');
    setTimeout(() => { api.close(); onDone && onDone(); }, 650);
  };
  return api;
}
