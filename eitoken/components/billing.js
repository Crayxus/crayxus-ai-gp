/* 付费演示：充值抽屉、下单、演示收银台。
   接口按真实支付设计（docs/1.0-contracts.md 6b），当前是演示支付：界面始终写明「演示支付，不会真实扣款」。
   后端不在时退回本机演示订单，另外再标「演示数据」。 */
import { server, auth, fixtures } from '../core/api.js';
import { state, set } from '../core/store.js';
import { esc, sheet, modal, toast, fmtMoney, sleep } from '../core/ui.js';
import { icon } from './icons.js';
import { qrSVG } from './qr.js';
import { motion } from '../core/motion.js';
import { openLogin } from './login.js';
import { loadMe } from '../core/me.js';

export async function getPlans() {
  if (auth.loggedIn()) {
    const r = await server.get('/api/billing/plans');
    if (r.ok) { set({ balance: r.balance, plan: r.current }); return { ...r, live: true }; }
  }
  const fx = await fixtures();
  return { ...(fx.plans || {}), live: false };
}

const CH = { wechat: { nm: '微信支付', ic: 'wechat', color: '#07C160' }, alipay: { nm: '支付宝', ic: 'alipay', color: '#1677FF' } };

export async function openTopup({ reason = '' } = {}) {
  if (!auth.loggedIn()) return openLogin({ reason: '充值需要先登录，额度会记在你的账号上。', onDone: () => openTopup({ reason }) });
  const plans = await getPlans();
  const tops = plans.topups || [50, 200, 500];
  const cmin = (plans.custom && plans.custom.min) || 1, cmax = (plans.custom && plans.custom.max) || 5000;
  let amount = tops[1] || tops[0], channel = 'wechat';
  const s = sheet(`<div class="sheet-h"><span class="chip-ic">${icon('wallet')}</span><h3>充值额度</h3><span class="grow"></span><button class="icon-btn" data-close aria-label="关闭">${icon('x')}</button></div>
    <div class="sheet-b">
      ${reason ? `<div class="note-box warn">${esc(reason)}</div>` : ''}
      <div class="topup-bal"><span class="eyebrow">当前余额</span><b class="big-num num">${fmtMoney(state.balance)}</b>${plans.live ? '' : '<span class="demo-flag">演示数据</span>'}</div>
      <div class="eyebrow" style="margin:18px 0 10px">选择金额</div>
      <div class="amt-grid">
        ${tops.map((a, i) => `<button class="amt ${a === amount ? 'on' : ''}" data-a="${a}"><b class="num">¥${a}</b><span>${i === 0 ? '够生成约 250 次' : i === 1 ? '最受欢迎' : '团队 / 课堂'}</span>${i === 1 ? '<i class="amt-tag">推荐</i>' : ''}</button>`).join('')}
        <label class="amt custom" data-a="custom"><span class="mute" style="font-size:12px">自定义</span><span class="row" style="gap:4px"><b>¥</b><input class="amt-in num" id="tpCustom" inputmode="decimal" placeholder="${cmin}–${cmax}" aria-label="自定义金额"></span></label>
      </div>
      <div class="eyebrow" style="margin:22px 0 10px">支付方式</div>
      <div class="ch-grid">${Object.entries(CH).map(([k, c]) => `<button class="ch ${k === channel ? 'on' : ''}" data-ch="${k}" style="--ch:${c.color}">${icon(c.ic)}<b>${c.nm}</b></button>`).join('')}</div>
      <div class="demo-pay-note">${icon('shield')}<span><b>演示支付，不会真实扣款。</b>收银台会生成演示付款码，点「模拟扫码支付」即可到账。</span></div>
    </div>
    <div class="sheet-f"><div class="stack grow" style="gap:0"><span class="mute" style="font-size:12px">应付</span><b class="num" id="tpPay" style="font-size:20px;font-family:var(--display)">¥${amount}</b></div><button class="btn primary lg" id="tpGo">${icon('qr')}去支付</button></div>`, { label: '充值' });
  const q = (x) => s.el.querySelector(x);
  const paint = () => { q('#tpPay').textContent = amount ? '¥' + amount : '—'; };
  s.el.querySelectorAll('.amt[data-a]').forEach((b) => b.addEventListener('click', () => {
    s.el.querySelectorAll('.amt').forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.a === 'custom') { q('#tpCustom').focus(); amount = parseFloat(q('#tpCustom').value) || 0; } else amount = +b.dataset.a;
    paint();
  }));
  q('#tpCustom').addEventListener('input', (e) => { amount = Math.round((parseFloat(e.target.value) || 0) * 100) / 100; paint(); });
  s.el.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => { channel = b.dataset.ch; s.el.querySelectorAll('[data-ch]').forEach((x) => x.classList.toggle('on', x === b)); }));
  q('#tpGo').onclick = async () => {
    if (!(amount >= cmin && amount <= cmax)) { toast(`金额需在 ¥${cmin}–¥${cmax} 之间`, 'warn'); motion.shake(q('.amt-grid')); return; }
    q('#tpGo').disabled = true;
    const order = await createOrder({ type: 'topup', amount, channel });
    q('#tpGo').disabled = false;
    if (!order) return;
    s.close(); openCheckout(order);
  };
  return s;
}

export async function buyPlan(plan) {
  if (!auth.loggedIn()) return openLogin({ reason: '购买套餐需要先登录。', onDone: () => buyPlan(plan) });
  let channel = 'wechat';
  const m = modal(`<div class="modal-h"><span class="chip-ic">${icon('crown')}</span><h3>开通${esc(plan.nm)}</h3><span class="grow"></span><button class="icon-btn" data-close aria-label="关闭">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="plan-sum"><div><div class="eyebrow">年付</div><b class="big-num num">¥${plan.price.toLocaleString('zh-CN')}${plan.priceFrom ? '<small> 起</small>' : ''}</b></div><ul>${plan.features.slice(0, 3).map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul></div>
      <div class="eyebrow" style="margin:18px 0 10px">支付方式</div>
      <div class="ch-grid">${Object.entries(CH).map(([k, c]) => `<button class="ch ${k === channel ? 'on' : ''}" data-ch="${k}" style="--ch:${c.color}">${icon(c.ic)}<b>${c.nm}</b></button>`).join('')}</div>
      <div class="demo-pay-note">${icon('shield')}<span><b>演示支付，不会真实扣款。</b></span></div>
      <button class="btn primary lg block" id="plGo" style="margin-top:16px">${icon('qr')}去支付</button>
    </div>`, { label: '开通套餐' });
  m.el.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => { channel = b.dataset.ch; m.el.querySelectorAll('[data-ch]').forEach((x) => x.classList.toggle('on', x === b)); }));
  m.el.querySelector('#plGo').onclick = async () => {
    const order = await createOrder({ type: 'plan', plan: plan.id, amount: plan.price, channel });
    if (!order) return;
    m.close(); openCheckout(order, { plan });
  };
}

async function createOrder(body) {
  const r = await server.post('/api/billing/order', body);
  if (r.ok && r.order) return { ...r.order, live: true, title: r.order.title || (body.type === 'topup' ? `账户充值 ¥${body.amount}` : '套餐') };
  if (r.status === 401) { openLogin({ reason: '登录已过期，请重新登录。' }); return null; }
  if (r.offline || r.status === 404) {
    // 后端没有付费接口：本机演示订单（同样不扣款）
    return { id: 'o_local' + Date.now().toString(36), ...body, status: 'pending', title: body.type === 'topup' ? `账户充值 ¥${body.amount}` : '套餐', live: false, demo: true };
  }
  toast(esc(r.error || '下单失败'), 'err');
  return null;
}

export function openCheckout(order, { plan } = {}) {
  const ch = CH[order.channel] || CH.wechat;
  const before = state.balance;
  let stop = false, paid = false;
  const m = modal(`<div class="checkout">
      <button class="icon-btn co-x" data-close aria-label="关闭">${icon('x')}</button>
      <div class="co-demo">${icon('shield')}演示支付，不会真实扣款${order.live ? '' : ' · 演示数据'}</div>
      <div class="co-body">
        <div class="co-left">
          <div class="co-ch" style="--ch:${ch.color}">${icon(ch.ic)}${ch.nm}</div>
          <div class="co-qr" id="coQr">${qrSVG('eitoken-demo://pay/' + order.id, { size: 208 })}<div class="co-scan"></div></div>
          <div class="mute" style="font-size:12px;text-align:center">用${ch.nm.replace('支付', '')}「扫一扫」· 演示码扫了不会扣款</div>
        </div>
        <div class="co-right">
          <div class="eyebrow">订单</div>
          <h3>${esc(order.title || '订单')}</h3>
          <div class="co-amt num">¥${Number(order.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
          <div class="kv"><span>订单号</span><b class="mono">${esc(order.id)}</b><span>状态</span><b id="coSt"><i class="spin"></i>等待扫码支付…</b></div>
          <button class="btn primary lg block" id="coPay">${icon('qr')}模拟扫码支付</button>
          <button class="btn ghost block" data-close>稍后再付</button>
        </div>
      </div>
      <div class="co-success" id="coOk" hidden>
        <div class="co-check">${icon('check')}</div>
        <h3>支付成功</h3>
        <p class="mute" id="coOkSub"></p>
        <div class="co-balance"><span class="eyebrow">当前余额</span><b class="big-num num" id="coBal">${fmtMoney(before)}</b></div>
        <button class="btn primary lg" data-close>好的</button>
      </div>
    </div>`, { wide: true, label: '收银台', onClose: () => { stop = true; } });
  const q = (x) => m.el.querySelector(x);
  q('#coOk').querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => m.close()));

  const success = async (res) => {
    if (paid) return; paid = true; stop = true;
    const after = res && typeof res.balance === 'number' ? res.balance : (order.type === 'topup' ? (before || 0) + Number(order.amount) : before);
    if (order.live) await loadMe(); else set({ balance: after, plan: plan ? { plan: plan.id, expires: Date.now() + 365 * 864e5 } : state.plan });
    q('.co-body').hidden = true; q('#coOk').hidden = false;
    q('#coOkSub').textContent = order.type === 'topup' ? `¥${order.amount} 已到账，可以继续生成代码了` : `${plan ? plan.nm : '套餐'} 已开通，有效期一年`;
    motion.pop(q('.co-check'));
    motion.burst(q('.co-check'), { count: 42 });
    motion.counter(q('#coBal'), after, { from: before || 0, fmt: (v) => fmtMoney(v), duration: 1.4 });
  };

  // 轮询订单（真实支付时扫码后状态会在这里变成 paid）
  (async () => {
    if (!order.live) return;
    while (!stop) {
      await sleep(1500); if (stop) break;
      const r = await server.get('/api/billing/order/' + encodeURIComponent(order.id));
      if (r.ok && r.order) {
        if (r.order.status === 'paid') { success(r); break; }
        if (r.order.status === 'expired' || r.order.status === 'cancelled') { q('#coSt').innerHTML = `<span class="err-txt">订单已${r.order.status === 'expired' ? '过期' : '取消'}</span>`; q('#coPay').disabled = true; break; }
      }
    }
  })();

  q('#coPay').onclick = async () => {
    const b = q('#coPay'); b.disabled = true; b.innerHTML = '<i class="spin"></i>支付中…';
    q('#coQr').classList.add('scanning');
    await sleep(900);
    if (!order.live) { success(null); return; }
    const r = await server.post('/api/billing/order/' + encodeURIComponent(order.id) + '/demo-pay', {});
    if (r.ok) success(r);
    else { b.disabled = false; b.innerHTML = `${icon('qr')}模拟扫码支付`; q('#coQr').classList.remove('scanning'); toast(esc(r.error || '演示支付未开启'), 'err'); }
  };
  return m;
}
