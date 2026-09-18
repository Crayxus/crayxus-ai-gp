/* 套餐：基础 / 标准 / 专业（年付）。演示支付。 */
import { state } from '../core/store.js';
import { esc, $, $$, fmtDate, fmtMoney } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { motion } from '../core/motion.js';
import { getPlans, buyPlan, openTopup } from '../components/billing.js';

const TAG = { basic: '入门', standard: '学校与机构首选', pro: '私有协议设备' };
const ICO = { basic: 'robot', standard: 'chip', pro: 'crown' };

export async function render(view) {
  const plans = await getPlans();
  const cur = plans.current || {};
  const order = { basic: 1, standard: 2, pro: 3 };
  view.innerHTML = `
    <section class="price-hero" data-rv>
      <span class="eyebrow">套餐与价格</span>
      <h1>免费就能做完大部分事</h1>
      <p class="mute">案例、编译、烧录、串口、仿真都不收费。AI 生成代码按实际用量从余额扣；团队和深度识别功能按年开通。</p>
      <div class="row wrap" style="justify-content:center;gap:10px;margin-top:14px">${plans.live ? '' : '<span class="demo-flag">演示数据</span>'}<span class="pill">${icon('shield')}演示支付，不会真实扣款</span></div>
    </section>
    <div class="price-grid">${(plans.plans || []).map((p) => {
      const isCur = cur.plan === p.id && !cur.expired;
      const lower = cur.plan && order[p.id] < order[cur.plan] && !cur.expired;
      return `<article class="card price ${p.highlight ? 'hl' : ''} ${isCur ? 'cur' : ''}" data-rv>
        ${p.highlight ? '<div class="price-rib">推荐</div>' : ''}
        <div class="row" style="gap:10px"><span class="price-ic">${icon(ICO[p.id] || 'cube')}</span><div><h3>${esc(p.nm)}</h3><span class="mute" style="font-size:12.5px">${esc(TAG[p.id] || '')}</span></div></div>
        <div class="price-num"><span class="cur-sym">¥</span><b class="num">${p.price.toLocaleString('zh-CN')}</b><span class="mute">/ 年${p.priceFrom ? ' 起' : ''}</span></div>
        <div class="mute" style="font-size:12.5px;margin-top:-6px">约 ¥${Math.round(p.price / 12).toLocaleString('zh-CN')} / 月</div>
        <ul class="feat">${p.features.map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>
        ${isCur ? `<button class="btn lg block cur-btn" disabled>${icon('check')}当前套餐${cur.expires ? ` · 至 ${fmtDate(cur.expires)}` : ''}</button>`
          : lower ? `<button class="btn ghost lg block" disabled>已包含在你的套餐中</button>`
          : `<button class="btn ${p.highlight ? 'primary' : 'soft'} lg block" data-buy="${p.id}">${cur.plan && !cur.expired ? '升级到' : '开通'}${esc(p.nm)}</button>`}
      </article>`; }).join('')}</div>

    <section class="card topup-band" data-rv>
      <span class="chip-ic">${icon('sparkles')}</span>
      <div class="grow"><b>AI 生成按量付费</b><p class="mute" style="font-size:13px">一次生成通常几分钱。当前余额 <b class="num" style="color:var(--txt)">${fmtMoney(plans.balance != null ? plans.balance : state.balance)}</b>，充值 ¥${(plans.topups || [50])[0]} 起，也可自定义 ¥${(plans.custom || {}).min || 1}–${(plans.custom || {}).max || 5000}。</p></div>
      <button class="btn primary" id="prTop">${icon('wallet')}充值</button>
    </section>

    <div class="section-h"><h2>常见问题</h2></div>
    <div class="faq">
      ${[['不开套餐能用吗？', '能。案例、编译、烧录、仿真、串口全部免费，AI 生成用余额按量计。'], ['现在付款会扣钱吗？', '不会。目前是演示支付：收银台生成演示付款码，点「模拟扫码支付」即到账，不会产生真实扣款。'], ['到期后会怎样？', '回到免费功能，项目和记录都保留，不会删除。'], ['学校要发票 / 对公转账？', '正式支付上线后在订单里申请，演示阶段请联系我们。']].map(([q, a]) => `<details class="card faq-i" data-rv><summary>${esc(q)}${icon('chevD')}</summary><p>${esc(a)}</p></details>`).join('')}
    </div>`;
  motion.reveal(view);
  $$('[data-buy]', view).forEach((b) => (b.onclick = () => buyPlan(plans.plans.find((p) => p.id === b.dataset.buy))));
  $('#prTop', view).onclick = () => openTopup();
}
