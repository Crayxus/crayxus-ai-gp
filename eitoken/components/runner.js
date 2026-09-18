/* NDJSON 任务面板：编译 / 烧录 / 备份 / 还原 / 装库装核心 共用。
   大进度环 + 当前步骤一句话 + 步骤条 + 温和提示（带一键修复）+ 可折叠原始日志。
   绝不自己编造成功：结果完全以桥接的 done 行为准。 */
import { stream, CLOUD } from '../core/api.js';
import { esc, ring, setRing, toast } from '../core/ui.js';
import { icon } from './icons.js';
import { motion } from '../core/motion.js';
import { forwardXp } from '../core/me.js';

const FIX_LABEL = { 'install-lib': '一键装库', 'install-core': '一键装板卡支持包', 'close-port': '释放串口' };

export function createRunner(mount, { title = '任务', onDone } = {}) {
  mount.innerHTML = `<div class="runner">
    <div class="runner-top">
      <div class="runner-ring">${ring(0, 104, 9, `<div><div class="big-num rn-pct" style="font-size:26px">0%</div><div class="mute" style="font-size:11.5px">进度</div></div>`)}</div>
      <div class="grow">
        <div class="eyebrow rn-title">${esc(title)}</div>
        <div class="rn-now">准备中…</div>
        <div class="rn-stages"></div>
        <div class="rn-note mute" hidden></div>
      </div>
    </div>
    <div class="rn-hints"></div>
    <details class="rn-logbox"><summary>${icon('serial')}原始输出 <span class="mute rn-lines">0 行</span></summary><div class="log rn-log" style="max-height:240px"></div></details>
  </div>`;
  const $ = (s) => mount.querySelector(s);
  const stages = new Map();
  let lines = 0, ctl = null, meta = {};

  const paintStages = () => {
    $('.rn-stages').innerHTML = [...stages.values()].map((s) => `<span class="rn-st ${s.status}">${s.status === 'ok' ? icon('check') : s.status === 'err' ? icon('x') : s.status === 'run' ? '<i class="spin"></i>' : '<i class="dotty"></i>'}${esc(s.nm)}</span>`).join('');
  };
  const setPct = (p) => { setRing($('.runner-ring'), p); $('.rn-pct').textContent = Math.round(p * 100) + '%'; };
  const log = (s, cls = '') => {
    lines++; $('.rn-lines').textContent = lines + ' 行';
    const box = $('.rn-log'); const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = s; box.appendChild(d);
    if (box.childElementCount > 1500) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  };
  const hint = (h, retry) => {
    const el = document.createElement('div'); el.className = 'rn-hint';
    const fix = h.fix ? String(h.fix) : '';
    const kind = fix.split(':')[0];
    el.innerHTML = `<span class="chip-ic">${icon('sparkles')}</span><span class="grow">${esc(h.s)}</span>${fix && FIX_LABEL[kind] ? `<button class="btn sm primary">${FIX_LABEL[kind]}</button>` : ''}`;
    const b = el.querySelector('button');
    if (b) b.onclick = async () => {
      b.disabled = true; b.textContent = '处理中…';
      const arg = fix.slice(kind.length + 1);
      let r;
      if (kind === 'install-lib') r = await stream('/api/mcu/lib/install', { name: arg }, (o) => o.t === 'log' && log(o.s, 's-mute'));
      else if (kind === 'install-core') r = await stream('/api/mcu/core/install', { id: arg }, (o) => o.t === 'log' && log(o.s, 's-mute'));
      else if (kind === 'close-port') r = await stream('/api/serial/close', { com: arg }, () => {});
      if (r && r.ok !== false) { b.textContent = '好了，重试'; b.disabled = false; b.onclick = () => retry && retry(); }
      else { b.textContent = '没成功'; toast(esc((r && r.error) || '处理失败'), 'err'); }
    };
    $('.rn-hints').appendChild(el); motion.pop(el);
  };

  let lastRun = null;
  async function run(path, body, opt = {}) {
    lastRun = () => run(path, body, opt);
    meta = opt.meta || {};
    stages.clear(); lines = 0; $('.rn-hints').innerHTML = ''; $('.rn-log').innerHTML = ''; setPct(0); paintStages();
    $('.rn-now').textContent = opt.startText || '开始…';
    $('.rn-note').hidden = !opt.note; $('.rn-note').textContent = opt.note || '';
    mount.querySelector('.runner').classList.remove('ok', 'err');
    ctl = new AbortController();
    const done = await stream(path, body, (o) => {
      if (o.t === 'stage') {
        stages.set(o.id, { nm: o.nm || o.id, status: o.status });
        if (o.status === 'run') $('.rn-now').textContent = (o.nm || o.id) + '…';
        paintStages();
        const arr = [...stages.values()]; setPct(arr.filter((s) => s.status === 'ok' || s.status === 'skip').length / Math.max(arr.length, opt.expectStages || arr.length));
      } else if (o.t === 'progress') {
        const arr = [...stages.values()]; const doneN = arr.filter((s) => s.status === 'ok' || s.status === 'skip').length;
        const total = Math.max(arr.length, opt.expectStages || 1);
        setPct((doneN + (o.pct || 0) / 100) / total);
      } else if (o.t === 'log') log(o.s, /error|错误|failed|失败/i.test(o.s) ? 's-err' : '');
      else if (o.t === 'hint') hint(o, lastRun);
      else if (o.t === 'xp') forwardXp(o, meta);
    }, { signal: ctl.signal });
    ctl = null;
    const root = mount.querySelector('.runner');
    $('.rn-note').hidden = true;
    if (done.ok) {
      setPct(1); root.classList.add('ok');
      $('.rn-now').innerHTML = `<span class="ok-txt">${icon('check')}${esc(opt.okText || '完成')}</span>`;
      motion.burst(mount.querySelector('.runner-ring'));
    } else {
      root.classList.add('err');
      $('.rn-now').innerHTML = `<span class="err-txt">${esc(done.error || '没成功')}</span>`;
      if (done.offline) hint({ s: CLOUD
        ? '云端体验版还不能编译和烧录：浏览器直连烧录正在上线。现在要烧板子，请装 Windows 版（桌面安装包），代码和案例完全一样。'
        : '本机桥接没连上。Windows 版双击桌面「EI TOKEN」会自动启动；开发机在 cos-code 目录跑 npm run bridge。' });
      else if (done.missing) hint({ s: '当前桥接版本还没有这个功能，更新 EI TOKEN 后再试。' });
      motion.shake(mount.querySelector('.runner-ring'));
    }
    onDone && onDone(done);
    return done;
  }
  return { run, cancel: () => ctl && ctl.abort(), running: () => !!ctl };
}
