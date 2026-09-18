/* 账户：余额、套餐、用量图、订单。支付为演示支付。 */
import { state, subscribe } from '../core/store.js';
import { server, auth, fixtures } from '../core/api.js';
import { esc, $, $$, fmtMoney, fmtInt, fmtDate, fmtTime, empty } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { motion } from '../core/motion.js';
import { getPlans, openTopup, openCheckout } from '../components/billing.js';
import { openLogin } from '../components/login.js';

const ST = { paid: ['ok', '已支付'], pending: ['warn', '待支付'], expired: ['', '已过期'], cancelled: ['', '已取消'], refunded: ['acc', '已退款'] };

export async function render(view) {
  const live = auth.loggedIn() && !state.profileDemo;
  const fx = await fixtures();
  const [plans, usageR, ordersR] = await Promise.all([
    getPlans(),
    live ? server.get('/api/usage?days=30') : null,
    live ? server.get('/api/billing/orders') : null,
  ]);
  const usage = usageR && usageR.ok ? { ...usageR, live: true } : { ...fx.usage, live: false };
  const orders = ordersR && ordersR.ok ? { ...ordersR, live: true } : { ...fx.orders, live: false };
  const cur = plans.current || {};
  const planDef = (plans.plans || []).find((p) => p.id === cur.plan);
  const bal = plans.balance != null ? plans.balance : state.balance;
  const low = bal != null && bal < 10;

  view.innerHTML = `<div class="page-h"><div><h1>账户</h1><p>余额用于 AI 生成代码（按实际用量计费）；套餐开通更深的设备识别和团队功能。</p></div></div>
    ${!auth.loggedIn() ? `<div class="card hero" style="margin-bottom:16px"><div class="row wrap"><span class="chip-ic">${icon('lock')}</span><div class="grow"><b>登录后查看你的余额和订单</b><p class="mute" style="font-size:13px">现在显示的是演示数据。</p></div><button class="btn primary" id="acLogin">登录 / 注册</button></div></div>` : ''}
    <div class="acct-top">
      <section class="card bal-card" data-rv>
        <div class="bal-glow"></div>
        <div class="row"><span class="eyebrow">账户余额</span><span class="grow"></span>${plans.live ? '' : '<span class="demo-flag">演示数据</span>'}</div>
        <div class="bal-num num" id="acBal">¥0.00</div>
        <div class="row wrap" style="gap:8px;margin-top:2px">${low ? `<span class="pill warn">${icon('bolt')}余额偏低</span>` : `<span class="pill ok">${icon('check')}可以正常生成</span>`}<span class="mute" style="font-size:12.5px">近 30 天花费 ${fmtMoney(usage.spent)}</span></div>
        <div class="row" style="margin-top:20px;gap:10px"><button class="btn primary lg" id="acTop">${icon('wallet')}充值</button><a class="btn lg" href="#/pricing">${icon('crown')}看套餐</a></div>
      </section>
      <section class="card plan-card ${cur.plan ? 'p-' + cur.plan : ''}" data-rv>
        <div class="row"><span class="eyebrow">当前套餐</span><span class="grow"></span>${cur.expired ? '<span class="pill err">已过期</span>' : cur.plan ? '<span class="pill ok">生效中</span>' : ''}</div>
        <h2 class="plan-nm">${esc(planDef ? planDef.nm : cur.plan ? cur.plan : '免费使用')}</h2>
        <p class="mute" style="font-size:13px">${cur.expires ? `有效期至 <b style="color:var(--txt)">${fmtDate(cur.expires)}</b>${daysLeft(cur.expires)}` : cur.plan ? '长期有效' : '案例、编译、烧录、仿真全部免费'}</p>
        ${planDef ? `<ul class="feat">${planDef.features.slice(0, 3).map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>` : ''}
        <a class="btn soft" href="#/pricing" style="margin-top:auto">${cur.plan === 'pro' ? '查看权益' : '升级套餐'}${icon('arrowR')}</a>
      </section>
    </div>

    <div class="section-h"><h2>用量</h2><span class="sub">近 ${usage.days || 30} 天 · AI 生成代码</span><span class="grow"></span>${usage.live ? '' : '<span class="demo-flag">演示数据</span>'}</div>
    <section class="card usage-card" data-rv>
      <div class="usage-stats">
        <div><span class="eyebrow">调用</span><b class="num">${fmtInt(usage.calls)}</b></div>
        <div><span class="eyebrow">输入 tokens</span><b class="num">${fmtInt(usage.tokensIn)}</b></div>
        <div><span class="eyebrow">输出 tokens</span><b class="num">${fmtInt(usage.tokensOut)}</b></div>
        <div><span class="eyebrow">花费</span><b class="num">${fmtMoney(usage.spent)}</b></div>
      </div>
      <div class="usage-chart" id="acChart">${chartSVG(usage.rows || [], usage.days || 30)}</div>
      ${(usage.rows || []).length ? `<details class="usage-rows"><summary>${icon('chevD')}明细（${usage.rows.length} 条）</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>时间</th><th>类型</th><th>tokens 入 / 出</th><th style="text-align:right">费用</th></tr></thead><tbody>
        ${usage.rows.slice(0, 50).map((r) => `<tr><td class="num">${fmtDate(r.ts)} ${fmtTime(r.ts)}</td><td>${r.kind === 'gen' ? 'AI 生成' : esc(r.kind)}</td><td class="num">${fmtInt(r.tok_in)} / ${fmtInt(r.tok_out)}</td><td class="num" style="text-align:right">${fmtMoney(r.price)}</td></tr>`).join('')}
      </tbody></table></div></details>` : ''}
    </section>

    <div class="section-h"><h2>订单</h2><span class="grow"></span>${orders.live ? '' : '<span class="demo-flag">演示数据</span>'}</div>
    <section class="card orders" data-rv>
      ${(orders.orders || []).length ? (orders.orders || []).map((o) => { const s = ST[o.status] || ['', o.status]; return `<div class="order">
        <span class="order-ic ${o.type}">${icon(o.type === 'plan' ? 'crown' : 'wallet')}</span>
        <div class="grow" style="min-width:0"><b>${esc(o.title || (o.type === 'plan' ? '套餐' : '充值'))}</b><div class="mute" style="font-size:12px"><span class="mono">${esc(o.id)}</span> · ${fmtDate(o.createdAt)} ${fmtTime(o.createdAt)} · ${o.channel === 'alipay' ? '支付宝' : '微信支付'}${o.demo ? ' · 演示支付' : ''}</div></div>
        <b class="num order-amt">${fmtMoney(o.amount)}</b><span class="pill ${s[0]}">${s[1]}</span>
        ${o.status === 'pending' && orders.live ? `<button class="btn sm primary" data-pay="${esc(o.id)}">继续支付</button>` : ''}</div>`; }).join('')
        : empty({ title: '还没有订单', text: '充值或开通套餐后，记录会出现在这里。' })}
    </section>`;

  motion.counter($('#acBal', view), bal || 0, { fmt: (v) => fmtMoney(v), duration: 1.2 });
  motion.reveal(view);
  const ch = $('#acChart path.area', view); if (ch && motion.on()) gsap.from(ch, { opacity: 0, y: 12, duration: 0.8, delay: 0.2, ease: 'power2.out' });

  $('#acTop', view).onclick = () => openTopup();
  const lg = $('#acLogin', view); if (lg) lg.onclick = () => openLogin({ onDone: () => render(view) });
  $$('[data-pay]', view).forEach((b) => (b.onclick = () => { const o = orders.orders.find((x) => x.id === b.dataset.pay); if (o) openCheckout({ ...o, live: true }); }));

  let lastBal = bal;
  const unsub = subscribe((s) => { if (s.balance !== lastBal && $('#acBal', view)) { motion.counter($('#acBal', view), s.balance || 0, { from: lastBal || 0, fmt: (v) => fmtMoney(v) }); lastBal = s.balance; } });
  return () => unsub();
}

function daysLeft(ts) {
  const d = Math.ceil((ts - Date.now()) / 864e5);
  return d > 0 ? `<span class="mute">（剩 ${d} 天）</span>` : '';
}

/* 按天聚合花费画面积图 */
function chartSVG(rows, days) {
  const W = 720, H = 180, P = 26;
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const start = day0.getTime() - (days - 1) * 864e5;
  const buckets = Array.from({ length: days }, () => ({ spent: 0, calls: 0 }));
  rows.forEach((r) => { const i = Math.floor((r.ts - start) / 864e5); if (i >= 0 && i < days) { buckets[i].spent += r.price || 0; buckets[i].calls++; } });
  const max = Math.max(0.1, ...buckets.map((b) => b.spent));
  const x = (i) => P + (i * (W - P * 2)) / (days - 1), y = (v) => H - P - (v / max) * (H - P * 2);
  const pts = buckets.map((b, i) => [x(i), y(b.spent)]);
  const line = pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const q = pts[i - 1], cx = (q[0] + p[0]) / 2;
    return `C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join('');
  const area = `${line}L${x(days - 1)},${H - P}L${x(0)},${H - P}Z`;
  const grid = [0, 0.5, 1].map((g) => `<line x1="${P}" x2="${W - P}" y1="${y(max * g)}" y2="${y(max * g)}" class="gl"/><text x="${P - 6}" y="${y(max * g) + 4}" text-anchor="end" class="gt">${(max * g).toFixed(max < 1 ? 2 : 1)}</text>`).join('');
  const labels = [0, Math.floor(days / 2), days - 1].map((i) => { const d = new Date(start + i * 864e5); return `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="gt">${d.getMonth() + 1}/${d.getDate()}</text>`; }).join('');
  const dots = buckets.map((b, i) => (b.calls ? `<circle cx="${x(i)}" cy="${y(b.spent)}" r="3.5" class="dot"><title>${b.calls} 次 · ¥${b.spent.toFixed(2)}</title></circle>` : '')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="近 ${days} 天每日花费">
    <defs><linearGradient id="ucg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>
    ${grid}<path class="area" d="${area}" fill="url(#ucg)"/><path d="${line}" class="ln"/>${dots}${labels}</svg>`;
}
