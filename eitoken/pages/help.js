/* 帮助：常见问题（驱动 / 串口占用 / 烧录失败）、工具链状态、重看引导。 */
import { bridge, fixtures, BRIDGE } from '../core/api.js';
import { state } from '../core/store.js';
import { esc, $, $$, toast } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { motion } from '../core/motion.js';
import { startOnboarding } from './onboarding.js';

const FAQ = [
  ['driver', '插上板子没反应 / 设备页看不到', 'usb', [
    '换一根<b>能传数据</b>的线（很多充电线只有电源线）。',
    '国产 ESP32 / Nano 常用 CH340 或 CP2102 芯片：装对应驱动后重新插拔。',
    'ESP32-S3 / C3 走原生 USB，Windows 10/11 免驱；还不行就按住 BOOT 再插。',
    '在设备页点「重新扫描」。']],
  ['busy', '提示「串口被占用」', 'serial', [
    '关掉 Arduino IDE 的串口监视器、其他串口助手或另一个浏览器标签。',
    '平台烧录前会自动关自己的串口监视器，烧完再打开。',
    '仍然占用：拔掉板子等 3 秒再插。']],
  ['flash', '烧录失败 / 卡在 Connecting…', 'flash', [
    'ESP32：按住 <b>BOOT</b>，出现 Connecting 时松开；有的板要再按一下 EN/RST。',
    'Arduino Uno/Nano：选错板型最常见，老 Nano 请选「Nano (旧 Bootloader)」。',
    '换一个 USB 口（尽量直连电脑，不经过拓展坞）。',
    '烧录前平台会备份原程序，失败了随时在项目「备份」里还原。']],
  ['build', '编译报错看不懂', 'code', [
    '报错下方会出现「一键修复」（缺库、缺板卡支持包）。',
    '点右侧「让 AI 改一改」，它会带着报错修改代码。',
    '在「兼容库」查一下这个库在 ESP32 上是不是要换成别的。']],
  ['sim', '仿真和真板有什么区别', 'sim', [
    '仿真跑的是同一份代码，适合没有板子时先验证逻辑。',
    '传感器数值是模拟的；WiFi、真实电流驱动类效果以真板为准。']],
];

export async function render(view) {
  view.innerHTML = `<div class="page-h"><div><h1>帮助</h1><p>大部分问题 1 分钟能解决。解决不了，把项目里的日志复制给我们。</p></div><span class="grow"></span><button class="btn soft" id="hpOb">${icon('play')}重看新手引导</button></div>
    <div class="help-grid">
      <div class="faq">${FAQ.map(([k, q, ic, steps], i) => `<details class="card faq-i" ${i === 0 ? 'open' : ''} data-rv id="faq-${k}"><summary><span class="chip-ic sm">${icon(ic)}</span>${esc(q)}${icon('chevD')}</summary><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol></details>`).join('')}</div>
      <aside class="stack" style="gap:14px">
        <section class="card" id="hpTc" data-rv><div class="row"><h3>本机工具链</h3><span class="grow"></span><button class="icon-btn" id="hpRe" aria-label="重新检测">${icon('refresh')}</button></div><div id="hpTcBody"><div class="skel" style="height:140px;margin-top:12px"></div></div></section>
        <section class="card" data-rv><h3>快速入口</h3><div class="quick">
          <a href="#/devices">${icon('usb')}设备</a><a href="#/cases">${icon('book')}案例</a><a href="#/libs">${icon('layers')}兼容库</a><a href="/cos.html">${icon('link')}经典版</a></div></section>
        <section class="card" data-rv><h3>版本</h3><p class="mute" style="font-size:12.5px;margin-top:6px">EI TOKEN 1.0 · 桥接 ${state.bridge ? '<span class="ok-txt">在线</span>' : '<span class="err-txt">未连接</span>'} · 账号服务 ${state.server ? '<span class="ok-txt">在线</span>' : '<span class="err-txt">未连接</span>'}</p></section>
      </aside>
    </div>`;
  motion.reveal(view);
  $('#hpOb', view).onclick = () => { try { localStorage.removeItem('eit1.obSkip'); localStorage.removeItem('eit1.tips'); } catch (e) {} startOnboarding(); };
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q');
  if (q) { const d = $('#faq-' + q, view); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } }

  const loadTc = async () => {
    const box = $('#hpTcBody', view);
    const r = await bridge.get('/api/mcu/toolchain', { timeout: 10000 });
    const t = r.ok ? r : (await fixtures()).toolchain;
    const demo = !r.ok;
    const rowv = (ok, nm, val, fix) => `<div class="tc-row"><span class="tc-dot ${ok ? 'ok' : 'err'}"></span><span class="grow">${nm}</span><span class="mute mono" style="font-size:12px">${val}</span>${!ok && fix ? fix : ''}</div>`;
    const core = (id) => (t.cores || []).find((c) => c.id === id);
    box.innerHTML = `${demo ? `<div class="row" style="margin:10px 0 4px"><span class="demo-flag">演示数据</span><span class="mute" style="font-size:12px">${r.offline ? '本机桥接没连上' : '桥接版本还不支持检测'}</span></div>` : ''}
      <div class="tc">
        ${rowv(t.cli && t.cli.path, 'arduino-cli', t.cli && t.cli.version ? esc(t.cli.version) : '未安装')}
        ${rowv(core('arduino:avr'), 'Arduino AVR 支持包', core('arduino:avr') ? esc(core('arduino:avr').installed) : '未安装', `<button class="btn sm" data-core="arduino:avr">安装</button>`)}
        ${rowv(core('esp32:esp32'), 'ESP32 支持包', core('esp32:esp32') ? esc(core('esp32:esp32').installed) : '未安装', `<button class="btn sm" data-core="esp32:esp32">安装</button>`)}
        ${rowv(t.esptool && t.esptool.path, 'esptool', t.esptool && t.esptool.path ? esc(t.esptool.from || '已找到') : '未找到')}
        ${rowv(t.python && t.python.pyserial, 'Python + pyserial', t.python && t.python.path ? '已安装' : '未安装')}
        ${rowv(t.wokwi && t.wokwi.token, 'Wokwi 仿真', !t.wokwi ? '未检测' : !t.wokwi.token ? '缺少 Wokwi token' : t.wokwi.cli ? '已配置' : '首次仿真时自动下载')}
      </div>`;
    $$('[data-core]', box).forEach((b) => (b.onclick = async () => {
      if (demo) { toast('需要先打开本机桥接', 'warn'); return; }
      b.disabled = true; b.innerHTML = '<i class="spin"></i>';
      const { stream } = await import('../core/api.js');
      const res = await stream('/api/mcu/core/install', { id: b.dataset.core }, () => {});
      toast(res.ok ? '安装完成' : esc(res.error || '安装失败'), res.ok ? 'ok' : 'err');
      loadTc();
    }));
  };
  $('#hpRe', view).onclick = loadTc;
  loadTc();
}
