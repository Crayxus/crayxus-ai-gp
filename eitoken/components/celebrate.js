/* 完成任务后的正反馈：经验飘字、成就解锁卡、升级弹窗。只在真实事件（后端确认）后出现。 */
import { motion } from '../core/motion.js';
import { esc, modal } from '../core/ui.js';
import { icon } from './icons.js';
import { rankBadge } from '../core/ranks.js';

const ACH_ICON = { build: 'code', flash: 'flash', sim: 'sim', led: 'led', dual: 'layers', wifi: 'wifi', motor: 'motor', ten: 'trophy', clean: 'shield', night: 'moon', supporter: 'gift', star: 'star', display: 'display', sensor: 'thermo', ble: 'link', mqtt: 'send' };
export const achIcon = (k) => icon(ACH_ICON[k] || 'star');

function xpFloat(n) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:38%;transform:translateX(-50%);z-index:96;pointer-events:none;font:700 34px/1 "Space Grotesk",sans-serif;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 24px rgba(34,211,238,.35))';
  el.textContent = `+${n} XP`;
  document.body.appendChild(el);
  const g = window.gsap;
  if (motion.on()) g.fromTo(el, { y: 20, opacity: 0, scale: 0.8 }, { y: -40, opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)', onComplete: () => g.to(el, { y: -80, opacity: 0, duration: 0.6, delay: 0.5, onComplete: () => el.remove() }) });
  else setTimeout(() => el.remove(), 1400);
}

function achCard(a, i) {
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `<div class="ach-medal">${achIcon(a.icon || a.key)}</div><div><div class="eyebrow">成就解锁</div><b>${esc(a.nm)}</b><p>${esc(a.desc || '')}</p></div>${a.xp ? `<span class="pill acc">+${a.xp}</span>` : ''}`;
  document.body.appendChild(el);
  el.style.top = 24 + i * 96 + 'px';
  const g = window.gsap;
  if (motion.on()) {
    g.fromTo(el, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.6)', delay: 0.4 + i * 0.25 });
    g.fromTo(el.querySelector('.ach-medal'), { rotation: -90, scale: 0.3 }, { rotation: 0, scale: 1, duration: 0.8, ease: 'elastic.out(1, .5)', delay: 0.5 + i * 0.25 });
    g.to(el, { x: 80, opacity: 0, duration: 0.35, delay: 4.2 + i * 0.25, onComplete: () => el.remove() });
  } else setTimeout(() => el.remove(), 4000);
}

export function celebrateXp(r) {
  if (r.gained) xpFloat(r.gained);
  (r.unlocked || []).forEach(achCard);
  if (r.levelUp && r.level) {
    setTimeout(() => {
      const m = modal(`<div class="lvup">
        <div class="lvup-badge">${rankBadge(r.level.n, 120)}</div>
        <div class="eyebrow">职级提升</div>
        <h2>你现在是 <span class="grad-txt">${esc(r.level.title)}</span></h2>
        <p class="mute">累计 ${r.xp} XP${r.level.nextTitle ? ` · 离「${esc(r.level.nextTitle)}」还差 ${r.level.next - r.xp}` : ''}</p>
        <button class="btn primary lg" data-close>继续做事</button></div>`, { label: '职级提升' });
      motion.pop(m.el.querySelector('.lvup-badge'));
      motion.burst(m.el.querySelector('.lvup-badge'), { count: 40 });
    }, 900);
  }
}
