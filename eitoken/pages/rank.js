/* 排行榜：总榜 / 本周 / 机构。前三名做领奖台。 */
import { state } from '../core/store.js';
import { server, auth, fixtures } from '../core/api.js';
import { esc, $, $$, empty } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { avatarHTML } from '../components/avatars.js';
import { rankBadge } from '../core/ranks.js';
import { motion } from '../core/motion.js';
import { openLogin } from '../components/login.js';

export async function render(view) {
  let scope = 'all';
  const org = state.profile && state.profile.profile && state.profile.profile.org;
  view.innerHTML = `<div class="page-h"><div><h1>排行榜</h1><p>经验只来自真实完成的事：烧录成功、仿真跑通、完成案例。</p></div><span class="grow"></span>
    <div class="seg" id="rkScope"><button class="on" data-s="all">总榜</button><button data-s="week">本周</button><button data-s="org" ${org ? '' : 'title="在「我的」里填写学校或机构后可用"'}>${esc(org || '机构')}</button></div></div>
    <div id="rkBody"></div>`;

  const load = async () => {
    const box = $('#rkBody', view);
    box.innerHTML = `<div class="card skel" style="height:260px"></div>`;
    let r = null, demo = false;
    if (auth.loggedIn()) r = await server.get(`/api/leaderboard?scope=${scope}${scope === 'org' && org ? '&org=' + encodeURIComponent(org) : ''}&limit=50`);
    if (!r || !r.ok) { r = (await fixtures()).leaderboard; demo = true; }
    const rows = (r.rows || []).slice();
    if (scope === 'week') rows.sort((a, b) => b.weekXp - a.weekXp).forEach((x, i) => (x.rank = i + 1));
    const me = r.me || {};
    const myNick = state.profile && state.profile.profile && state.profile.profile.nickname;
    const top = rows.slice(0, 3), rest = rows.slice(3);
    const val = (x) => (scope === 'week' ? x.weekXp : x.xp);
    box.innerHTML = `
      ${demo ? `<div class="row" style="margin-bottom:12px"><span class="demo-flag">演示数据</span>${auth.loggedIn() ? '' : '<button class="btn sm ghost" id="rkLogin">登录看真实排名</button>'}</div>` : ''}
      ${rows.length ? `<section class="podium">${[1, 0, 2].map((i) => top[i] ? `<div class="pod pod-${i + 1} ${top[i].nickname === myNick ? 'me' : ''}" data-rv>
          <div class="pod-av">${avatarHTML(top[i].avatar, 'lg')}<span class="pod-n">${i + 1}</span></div>
          <b>${esc(top[i].nickname)}</b><span class="mute" style="font-size:12.5px">L${top[i].level} · ${esc(top[i].title)}</span>
          <div class="pod-xp num">${val(top[i]).toLocaleString('zh-CN')} <small>XP</small></div>
          <div class="pod-block">${i === 0 ? icon('crown') : ''}</div></div>` : '<div></div>').join('')}</section>
      <div class="card rank-list">
        ${rest.map((x) => row(x)).join('') || '<p class="mute" style="padding:10px">暂时只有这几位，快来占位。</p>'}
      </div>` : `<div class="card">${empty({ title: '榜单还空着', text: '烧录或仿真成功一次，你就上榜了。' })}</div>`}
      <div class="card me-rank-bar" data-rv>${avatarHTML(state.profile && state.profile.profile && state.profile.profile.avatar)}<div class="grow"><b>我</b><div class="mute" style="font-size:12.5px">${me.hidden ? '你已设置不上榜（仅自己可见名次）' : me.rank ? `第 <b class="num" style="color:var(--txt)">${me.rank}</b> 名` : '还没上榜：完成一次烧录或仿真就会出现'}</div></div><b class="num">${((scope === 'week' ? me.weekXp : me.xp) || 0).toLocaleString('zh-CN')} XP</b></div>`;
    function row(x) {
      return `<div class="rank-row ${x.nickname === myNick ? 'me' : ''}" data-rv><span class="rank-n num">${x.rank}</span>${avatarHTML(x.avatar, 'sm')}<div class="grow" style="min-width:0"><b>${esc(x.nickname)}</b><div class="mute" style="font-size:12px">本周完成 ${x.weekDone || 0} 件</div></div>
        <span class="rank-badge">${rankBadge(x.level, 30)}<span class="mute" style="font-size:12.5px">${esc(x.title)}</span></span><b class="num rank-xp">${val(x).toLocaleString('zh-CN')}</b></div>`;
    }
    const lg = $('#rkLogin', view); if (lg) lg.onclick = () => openLogin({ onDone: load });
    motion.reveal(box);
  };
  $$('#rkScope button', view).forEach((b) => (b.onclick = () => { scope = b.dataset.s; $$('#rkScope button', view).forEach((x) => x.classList.toggle('on', x === b)); load(); }));
  load();
}
