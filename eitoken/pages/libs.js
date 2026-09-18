/* 兼容库：哪些库 AVR / ESP32 都能用、哪些要换成别的；已装状态；一键安装。 */
import { loadLibraries, bridge, stream } from '../core/api.js';
import { esc, $, $$, toast, empty } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { motion } from '../core/motion.js';

const CAT = { sensing: '感知', connect: '联网', sensor: '传感器', display: '显示', motion: '运动', comm: '通信', util: '工具', data: '数据', audio: '声音', input: '输入', time: '时间', storage: '存储', network: '网络' };

export async function render(view) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  view.innerHTML = `<div class="page-h"><div><h1>兼容库</h1><p>案例用到的库都在这。绿色表示这块板能直接用；「换成」表示要用专门的替代库——编译时平台会自动处理，这里给你查个明白。</p></div></div>
    <div class="card flat filters"><div class="row wrap" style="gap:10px">
      <label class="search"><span class="sr">搜索库</span>${icon('search')}<input class="input" id="lbQ" value="${esc(qs.get('q') || '')}" placeholder="搜 DHT、Servo、OLED…"></label>
      <div class="seg" id="lbArch"><button class="on" data-v="all">全部</button><button data-v="both">两边都能用</button><button data-v="swap">需要替换</button></div>
      <span class="grow"></span><span id="lbLive"></span>
    </div></div>
    <div class="card" style="margin-top:14px;padding:6px 20px"><div class="tbl-wrap"><table class="tbl lib-tbl"><thead><tr><th>库</th><th>用途</th><th>Arduino (AVR)</th><th>ESP32</th><th>状态</th><th></th></tr></thead><tbody id="lbBody"><tr><td colspan="6"><div class="skel" style="height:120px"></div></td></tr></tbody></table></div></div>`;

  const [libs, installed] = await Promise.all([loadLibraries(), bridge.get('/api/mcu/lib/list', { timeout: 8000 })]);
  const liveSet = installed.ok ? new Set((installed.libs || []).map((l) => l.name)) : null;
  $('#lbLive', view).innerHTML = liveSet ? `<span class="pill ok">${icon('check')}已读取本机 ${liveSet.size} 个库</span>` : `<span class="pill warn" title="${installed.status === 404 ? '桥接版本还不支持读取库列表' : '本机桥接没连上'}">安装状态取自验证记录</span>`;
  let arch = 'all';
  const cell = (l, a) => {
    if (l.archs && l.archs[a]) return `<span class="compat ok">${icon('check')}可用</span>`;
    const sw = l.swapFor && l.swapFor[a];
    return sw ? `<span class="compat swap">换成 <b>${esc(sw)}</b></span>` : `<span class="compat no">${icon('x')}不支持</span>`;
  };
  const paint = () => {
    const q = $('#lbQ', view).value.trim().toLowerCase();
    const rows = libs.filter((l) => (!q || [l.name, l.note, l.category].join(' ').toLowerCase().includes(q))
      && (arch === 'all' || (arch === 'both' ? l.archs && l.archs.avr && l.archs.esp32 : !(l.archs && l.archs.avr && l.archs.esp32))));
    const inst = (l) => (liveSet ? liveSet.has(l.name) : l.installed);
    $('#lbBody', view).innerHTML = rows.length ? rows.map((l) => `<tr data-rv>
      <td><b>${esc(l.name)}</b>${l.version ? `<div class="mute mono" style="font-size:11.5px">${esc(l.version)}</div>` : ''}</td>
      <td><span class="pill" style="height:22px">${esc(CAT[l.category] || l.category || '其他')}</span><div class="mute" style="font-size:12.5px;margin-top:4px;max-width:34ch">${esc(l.note || '')}</div></td>
      <td>${cell(l, 'avr')}</td><td>${cell(l, 'esp32')}</td>
      <td>${inst(l) ? `<span class="pill ok">${icon('check')}已安装</span>` : '<span class="pill">未安装</span>'}</td>
      <td style="text-align:right">${inst(l) ? (l.cases && l.cases.length ? `<a class="btn sm ghost" href="#/cases/${l.cases[0]}">看案例</a>` : '') : `<button class="btn sm primary" data-inst="${esc(l.install || l.name)}">${icon('download')}安装</button>`}</td></tr>`).join('')
      : `<tr><td colspan="6">${empty({ title: '没找到', text: '换个关键词。缺的库编译时会自动安装。' })}</td></tr>`;
    $$('[data-inst]', view).forEach((b) => (b.onclick = async () => {
      b.disabled = true; b.innerHTML = '<i class="spin"></i>安装中';
      const r = await stream('/api/mcu/lib/install', { name: b.dataset.inst }, () => {});
      if (r.ok) { b.outerHTML = `<span class="pill ok">${icon('check')}已安装</span>`; toast(`${esc(b.dataset.inst)} 装好了`, 'ok'); liveSet && liveSet.add(b.dataset.inst); }
      else { b.disabled = false; b.innerHTML = `${icon('download')}重试`; toast(r.offline ? '本机桥接没连上' : r.missing ? '桥接版本还不支持装库' : esc(r.error || '安装失败'), 'err'); }
    }));
    motion.reveal($('#lbBody', view), '[data-rv]', { y: 6, stagger: 0.015 });
  };
  $$('#lbArch button', view).forEach((b) => (b.onclick = () => { arch = b.dataset.v; $$('#lbArch button', view).forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
  let t; $('#lbQ', view).addEventListener('input', () => { clearTimeout(t); t = setTimeout(paint, 150); });
  paint();
}
