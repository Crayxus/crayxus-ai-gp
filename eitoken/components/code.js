/* Arduino C++ 高亮 + 轻量编辑器（textarea 叠在高亮层上）。不做动画。 */
import { esc } from '../core/ui.js';

const KW = new Set('if else for while do switch case break continue return void int long short char bool boolean float double unsigned signed const static struct class public private true false HIGH LOW INPUT OUTPUT INPUT_PULLUP byte uint8_t uint16_t uint32_t int8_t int16_t int32_t size_t String auto new delete nullptr sizeof enum typedef volatile extern'.split(' '));
const FN = new Set('setup loop pinMode digitalWrite digitalRead analogRead analogWrite delay millis micros Serial begin println print available read write map constrain tone noTone attach pulseIn ledcAttach ledcWrite WiFi random'.split(' '));

export function highlight(src) {
  const out = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(^[ \t]*#[^\n]*)|(\b\d+(?:\.\d+)?[fFuUlL]*\b|\b0x[0-9a-fA-F]+\b)|([A-Za-z_]\w*)/gm;
  let last = 0, m;
  while ((m = re.exec(src))) {
    out.push(esc(src.slice(last, m.index)));
    const [t] = m;
    if (m[1]) out.push(`<span class="tk-cm">${esc(t)}</span>`);
    else if (m[2]) out.push(`<span class="tk-str">${esc(t)}</span>`);
    else if (m[3]) out.push(`<span class="tk-pp">${esc(t)}</span>`);
    else if (m[4]) out.push(`<span class="tk-num">${esc(t)}</span>`);
    else if (KW.has(t)) out.push(`<span class="tk-kw">${t}</span>`);
    else if (FN.has(t) || src[re.lastIndex] === '(') out.push(`<span class="tk-fn">${t}</span>`);
    else out.push(t);
    last = re.lastIndex;
  }
  out.push(esc(src.slice(last)));
  return out.join('');
}

/* 只读代码块（案例详情用） */
export function codeBlock(src) {
  return `<div class="code"><pre>${highlight(src || '').split('\n').map((l) => `<span class="ln">${l || ' '}</span>`).join('')}</pre></div>`;
}

/* 可编辑：返回 { el, get, set, onChange } */
export function editor(mount, initial = '', { onChange } = {}) {
  mount.innerHTML = `<div class="editor"><div class="gutter" aria-hidden="true"></div><div class="ed-area"><pre aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="代码编辑器"></textarea></div></div>`;
  const ta = mount.querySelector('textarea'), pre = mount.querySelector('pre'), gut = mount.querySelector('.gutter'), area = mount.querySelector('.ed-area');
  const paint = () => {
    const v = ta.value;
    pre.innerHTML = highlight(v) + '\n';
    const n = v.split('\n').length;
    gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    // 不换行：高亮层按内容撑开，textarea 跟它同尺寸，横向滚动交给外层
    ta.style.height = 'auto'; ta.style.width = '100%';
    ta.style.height = Math.max(360, ta.scrollHeight) + 'px';
    pre.style.height = ta.style.height;
    ta.style.width = Math.max(area.clientWidth, pre.scrollWidth) + 'px';
  };
  ta.value = initial; paint();
  ta.addEventListener('input', () => { paint(); onChange && onChange(ta.value); });
  area.addEventListener('scroll', () => { gut.scrollTop = area.scrollTop; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); paint(); onChange && onChange(ta.value); }
  });
  return { el: ta, get: () => ta.value, set: (v) => { ta.value = v; paint(); } };
}
