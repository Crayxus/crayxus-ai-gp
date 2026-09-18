/* 我的：头像、昵称、职级、经验条、成就墙、职级阶梯。 */
import { state, subscribe } from '../core/store.js';
import { server, auth, fixtures } from '../core/api.js';
import { esc, $, $$, toast, modal, fmtDate } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { avatarHTML, AVATAR_IDS } from '../components/avatars.js';
import { RANKS, rankBadge, levelFor } from '../core/ranks.js';
import { achIcon } from '../components/celebrate.js';
import { motion } from '../core/motion.js';
import { saveProfile, logout } from '../core/me.js';
import { openLogin } from '../components/login.js';
import { startOnboarding } from './onboarding.js';

export async function render(view) {
  const live = auth.loggedIn() && !state.profileDemo;
  const achR = live ? await server.get('/api/achievements') : null;
  const ach = achR && achR.ok ? achR : (await fixtures()).achievements;
  const p = state.profile || {}; const pr = p.profile || {};
  const xp = p.xp || 0, lv = levelFor(xp);
  const mine = new Map((ach.mine || []).map((m) => [m.key, m.ts]));

  view.innerHTML = `
    ${!live ? `<div class="card hero" style="margin-bottom:16px"><div class="row wrap"><span class="chip-ic">${icon('user')}</span><div class="grow"><b>登录后开始记录你的经验和成就</b><p class="mute" style="font-size:13px">下面是演示数据。烧录、仿真成功的真实记录才会计入。</p></div><button class="btn primary" id="meLogin">登录 / 注册</button></div></div>` : ''}
    <section class="me-hero card hero">
      <button class="me-av" id="meAv" aria-label="更换头像">${avatarHTML(pr.avatar, 'xl')}<span class="me-av-edit">${icon('refresh')}</span></button>
      <div class="me-id">
        <div class="row" style="gap:8px">${!live ? '<span class="demo-flag">演示数据</span>' : ''}${pr.org ? `<span class="pill">${esc(pr.org)}</span>` : ''}</div>
        <div class="row" style="gap:10px;margin-top:6px"><h1 id="meNick">${esc(pr.nickname || '创客')}</h1><button class="icon-btn" id="meEdit" aria-label="改昵称" style="width:32px;height:32px">${icon('settings')}</button></div>
        <div class="me-rank">${rankBadge(lv.n, 40)}<div><b>${esc(lv.title)}</b><div class="mute" style="font-size:12.5px">L${lv.n} · 累计 <b class="num" id="meXp" style="color:var(--txt)">0</b> XP</div></div></div>
        <div class="me-bar"><div class="bar" style="height:10px"><i id="meBar" style="--p:0"></i></div>
          <div class="row" style="justify-content:space-between;font-size:12.5px;margin-top:6px"><span class="mute">${esc(lv.title)}</span><span class="mute">${lv.next ? `还差 <b class="num" style="color:var(--txt)">${lv.toNext}</b> XP 升到「${esc(lv.next.title)}」` : '已是最高职级'}</span></div></div>
      </div>
      <div class="me-stats">
        <div><span class="eyebrow">本周</span><b class="big-num num" id="meWeek">0</b><span class="mute">XP</span></div>
        <div><span class="eyebrow">成就</span><b class="big-num num">${mine.size}<small class="mute" style="font-size:14px"> / ${ach.all.length}</small></b></div>
      </div>
    </section>

    <div class="section-h"><h2>成就墙</h2><span class="sub">完成真实任务自动解锁，不需要刻意去刷</span></div>
    <div class="ach-wall">${ach.all.map((a) => { const got = mine.has(a.key); return `<div class="ach ${got ? 'got' : ''} ${a.secret && !got ? 'secret' : ''}" data-rv>
        <div class="ach-medal">${a.secret && !got ? icon('lock') : achIcon(a.icon || a.key)}</div>
        <b>${esc(a.nm)}</b><p>${esc(a.desc)}</p>
        <div class="ach-f">${got ? `<span class="pill ok">${icon('check')}${fmtDate(mine.get(a.key))}</span>` : `<span class="pill">未解锁</span>`}${a.xp ? `<span class="mute num">+${a.xp} XP</span>` : ''}</div></div>`; }).join('')}</div>

    <div class="section-h"><h2>工程师职级</h2><span class="sub">只是展示你的积累，任何功能都不设门槛</span></div>
    <div class="card ladder">${RANKS.map((r) => `<div class="rung ${r.n === lv.n ? 'cur' : r.n < lv.n ? 'past' : ''}" data-rv>${rankBadge(r.n, 38)}<div class="grow"><b>${r.title}</b><div class="mute num" style="font-size:12px">${r.min.toLocaleString('zh-CN')} XP</div></div>${r.n === lv.n ? '<span class="pill acc">你在这里</span>' : r.n < lv.n ? `<span class="ok-txt">${icon('check')}</span>` : ''}</div>`).join('')}</div>

    <div class="section-h"><h2>设置</h2></div>
    <div class="card"><div class="set-row"><div class="grow"><b>不参加排行榜</b><p class="mute" style="font-size:12.5px">打开后别人在榜上看不到你，你自己仍能看到名次。</p></div><label class="switch"><input type="checkbox" id="meHide" ${pr.hideFromRank ? 'checked' : ''}><i></i></label></div>
      <div class="set-row"><div class="grow"><b>新手引导</b><p class="mute" style="font-size:12.5px">重新走一遍欢迎流程。</p></div><button class="btn sm" id="meOb">重看引导</button></div>
      ${auth.loggedIn() ? `<div class="set-row"><div class="grow"><b>账号</b><p class="mute" style="font-size:12.5px">${esc(auth.email)}</p></div><button class="btn sm ghost" id="meOut">${icon('logout')}退出登录</button></div>` : ''}</div>`;

  motion.counter($('#meXp', view), xp);
  motion.counter($('#meWeek', view), p.weekXp || 0);
  setTimeout(() => motion.grow($('#meBar', view), lv.p, { duration: 1.3 }), 150);
  motion.reveal(view);

  const lg = $('#meLogin', view); if (lg) lg.onclick = () => openLogin({ onDone: () => location.reload() });
  $('#meAv', view).onclick = () => pickAvatar(pr.avatar);
  $('#meEdit', view).onclick = async () => {
    const m = modal(`<div class="modal-h"><h3>改昵称</h3></div><div class="modal-b"><input class="input" id="nkIn" maxlength="16" value="${esc(pr.nickname || '')}"><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="nkOk">保存</button></div></div>`);
    m.el.querySelector('#nkOk').onclick = async () => { const v = m.el.querySelector('#nkIn').value.trim(); if (!v) return; const r = await saveProfile({ nickname: v }); if (r.ok) { $('#meNick', view).textContent = v; toast('已保存', 'ok'); m.close(); } else toast(esc(r.error || '保存失败'), 'err'); };
  };
  $('#meHide', view).onchange = async (e) => { const r = await saveProfile({ hideFromRank: e.target.checked }); toast(r.ok ? (e.target.checked ? '已隐藏，不再出现在排行榜' : '已公开到排行榜') : '保存失败', r.ok ? 'ok' : 'err'); };
  $('#meOb', view).onclick = () => { try { localStorage.removeItem('eit1.obSkip'); localStorage.removeItem('eit1.tips'); } catch (e) {} startOnboarding(); };
  const out = $('#meOut', view); if (out) out.onclick = async () => { await logout(); location.hash = '#/'; };

  function pickAvatar(cur) {
    let sel = cur || 'bot-01';
    const m = modal(`<div class="modal-h"><h3>换个头像</h3><span class="grow"></span><button class="icon-btn" data-close aria-label="关闭">${icon('x')}</button></div>
      <div class="modal-b"><div class="av-grid">${AVATAR_IDS.map((a) => `<button class="ob-avb ${a === sel ? 'on' : ''}" data-av="${a}" aria-label="${a}">${avatarHTML(a)}</button>`).join('')}</div>
      <div class="row" style="margin-top:16px"><label class="btn ghost sm" style="cursor:pointer">${icon('download')}上传照片<input type="file" accept="image/png,image/jpeg,image/webp" id="avFile" hidden></label><span class="grow"></span><button class="btn primary" id="avOk">用这个</button></div></div>`, { wide: true });
    $$('[data-av]', m.el).forEach((b) => (b.onclick = () => { sel = b.dataset.av; $$('[data-av]', m.el).forEach((x) => x.classList.toggle('on', x === b)); motion.pop(b); }));
    m.el.querySelector('#avOk').onclick = async () => { const r = await saveProfile({ avatar: sel }); if (r.ok) { $('#meAv', view).innerHTML = avatarHTML(sel, 'xl') + `<span class="me-av-edit">${icon('refresh')}</span>`; motion.pop($('#meAv', view)); m.close(); } else toast('保存失败', 'err'); };
    m.el.querySelector('#avFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 1024 * 1024) { toast('图片请小于 1MB', 'warn'); return; }
      if (!live) { toast('登录后才能上传照片', 'warn'); return; }
      const dataUrl = await new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(f); });
      const r = await server.post('/api/profile/avatar', { dataUrl });
      if (r.ok) { await saveProfile({ avatar: r.avatar }); $('#meAv', view).innerHTML = avatarHTML(r.avatar, 'xl') + `<span class="me-av-edit">${icon('refresh')}</span>`; toast('头像已更新', 'ok'); m.close(); }
      else toast(esc(r.error || '上传失败'), 'err');
    };
  }
  const unsub = subscribe((s, k) => {});
  return () => unsub();
}
