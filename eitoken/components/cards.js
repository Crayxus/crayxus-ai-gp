/* 可复用卡片：案例卡、设备卡、统计卡。 */
import { esc, stars } from '../core/ui.js';
import { icon } from './icons.js';
import { coverSVG } from './covers.js';
import { boardArt } from './iso.js';
import { FAMILIES } from '../core/boards.js';

const CAT_NM = { stackchan: '桌面机器人', 'first-light': '第一次点亮', sensing: '感知', display: '显示', motion: '运动', connect: '联网' };
export const catName = (id) => CAT_NM[id] || id;

/* 热品角标。sm 用在按钮 / 行内，默认用在封面上 */
export const hotTag = (txt = '热', cls = '') => `<span class="hot-tag ${cls}" title="本周热品">${icon('flame')}${esc(txt)}</span>`;

export function caseCard(c, { done = false } = {}) {
  const fams = c.families || [...new Set((c.boards || []).map((b) => b.family))];
  return `<a class="card hover case-card" href="#/cases/${encodeURIComponent(c.id)}" data-id="${esc(c.id)}" data-rv>
    <div class="cc-cover">${coverSVG(c.cover, c.id)}
      <div class="cc-badges">${fams.map((f) => `<span class="fam ${f}">${FAMILIES[f] ? FAMILIES[f].nm : f}</span>`).join('')}</div>
      ${c.sim ? `<span class="cc-sim" title="没有板子也能先在仿真里跑">${icon('sim')}可仿真</span>` : ''}
      ${done ? `<span class="cc-done">${icon('check')}已完成</span>` : ''}
      ${c.hot ? `<span class="cc-hot">${hotTag()}</span>` : ''}
    </div>
    <div class="cc-body">
      <div class="cc-cat">${esc(catName(c.category))}</div>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.sub)}</p>
      <div class="cc-meta">${stars(c.difficulty || 1)}<span>${icon('clock')}${c.minutes || 10} 分钟</span><span>${icon('parts')}${typeof c.parts === 'number' ? c.parts : (c.parts || []).length} 个元件</span><span class="grow"></span><span class="cc-xp">+${c.xp || 30} XP</span></div>
    </div></a>`;
}

export function deviceCard(d, { big = false, extra = '', tag = '' } = {}) {
  const f = FAMILIES[d.family] || null;
  const tier1 = d.family === 'esp32' || d.family === 'avr';
  return `<div class="card dev-card ${big ? 'big' : ''} ${d.isNew ? 'is-new' : ''}" data-key="${esc(d.key)}" data-rv style="--fam:${f ? f.color : 'var(--mute)'}">
    <div class="dev-art">${boardArt(d.family || 'custom', big ? 150 : 96)}</div>
    <div class="dev-body">
      <div class="row wrap" style="gap:8px">${f ? `<span class="fam ${d.family}">${f.nm}</span>` : '<span class="pill">待识别</span>'}<span class="pill ok" style="height:22px"><i class="dot ok"></i>在线</span>${d.demo ? '<span class="demo-flag">演示</span>' : ''}${tag}</div>
      <h3>${esc(d.nm)}</h3>
      <p class="mute mono" style="font-size:12px">${esc(d.com || d.ip || '')}${d.sub && d.sub !== d.nm ? ' · ' + esc(d.sub) : ''}</p>
      ${f && f.desc ? `<p class="dim" style="font-size:13px">${esc(f.desc)}</p>` : ''}
      <div class="row wrap" style="margin-top:auto;gap:8px">
        ${tier1 ? `<a class="btn primary sm" href="#/cases?board=${d.family}">${icon('play')}跑个案例</a><button class="btn sm" data-new-project="${esc(d.key)}">${icon('code')}新建项目</button>`
          : `<a class="btn sm" href="/cos.html#/devices">${icon('layers')}在经典版打开</a>`}
        ${extra}
      </div>
    </div></div>`;
}

export function statCard({ ic, label, value, sub = '', id = '', trend = '' }) {
  return `<div class="card stat" data-rv><div class="card-h" style="margin-bottom:10px"><span class="chip-ic">${icon(ic)}</span><span class="eyebrow">${esc(label)}</span>${trend ? `<span class="grow"></span><span class="pill ok" style="height:22px">${esc(trend)}</span>` : ''}</div>
    <div class="big-num num" ${id ? `id="${id}"` : ''}>${value}</div>${sub ? `<div class="mute" style="font-size:12.5px;margin-top:6px">${sub}</div>` : ''}</div>`;
}
