/* GSAP 封装。所有动效从这里走：
   - 只动 transform / opacity
   - 用户系统开了「减少动态效果」就全部降级成直接到位
   - GSAP 没加载（离线坏包）也不能让页面坏掉 */
const g = window.gsap;
if (g && window.Flip) g.registerPlugin(window.Flip);
const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const on = () => !!g && !reduce();
const done = () => Promise.resolve();

export const motion = {
  on,
  reveal(root, sel = '[data-rv]', { y = 14, stagger = 0.045, delay = 0 } = {}) {
    const els = typeof sel === 'string' ? root.querySelectorAll(sel) : sel;
    if (!on() || !els.length) return;
    g.fromTo(els, { y, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger, delay, clearProps: 'transform' });
  },
  pageIn(el) {
    if (!on()) return;
    g.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', clearProps: 'transform' });
  },
  counter(el, to, { from = 0, fmt = (v) => Math.round(v).toLocaleString('zh-CN'), duration = 1.1 } = {}) {
    if (!el) return;
    if (!on()) { el.textContent = fmt(to); return; }
    const o = { v: from };
    g.to(o, { v: to, duration, ease: 'power2.out', onUpdate: () => (el.textContent = fmt(o.v)) });
  },
  grow(el, p, { duration = 1 } = {}) {   // 经验条 / 进度条：--p 0..1
    if (!el) return;
    if (!on()) { el.style.setProperty('--p', p); return; }
    const o = { v: parseFloat(getComputedStyle(el).getPropertyValue('--p')) || 0 };
    g.to(o, { v: p, duration, ease: 'power3.out', onUpdate: () => el.style.setProperty('--p', o.v) });
  },
  press(e) {
    const t = e.target.closest('.btn, .chip, .card.hover, .icon-btn, .pressable');
    if (!t || t.disabled || !on()) return;
    g.fromTo(t, { scale: 0.96 }, { scale: 1, duration: 0.45, ease: 'elastic.out(1.1, 0.45)', clearProps: 'scale' });
  },
  pop(el) {
    if (!el || !on()) return;
    g.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.2)' });
  },
  shake(el) {
    if (!el || !on()) return;
    g.fromTo(el, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.3)' });
  },
  toastIn(el) { if (on()) g.fromTo(el, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }); },
  toastOut(el) { return on() ? new Promise((r) => g.to(el, { x: 40, opacity: 0, duration: 0.25, onComplete: r })) : done(); },
  layerIn(kind, panel, scrim) {
    if (!on()) return;
    g.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    if (kind === 'sheet') g.fromTo(panel, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.42, ease: 'power3.out' });
    else g.fromTo(panel, { y: 18, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' });
  },
  layerOut(kind, panel, scrim) {
    if (!on()) return done();
    return new Promise((r) => {
      g.to(scrim, { opacity: 0, duration: 0.2 });
      g.to(panel, kind === 'sheet' ? { x: 60, opacity: 0, duration: 0.24, ease: 'power2.in', onComplete: r } : { y: 10, scale: 0.98, opacity: 0, duration: 0.2, onComplete: r });
    });
  },
  /* 筛选前记下状态，改完 DOM 后调用 flip() */
  flipState(els) { return on() && window.Flip ? window.Flip.getState(els) : null; },
  flip(state, { targets } = {}) {
    if (!state || !on()) return;
    window.Flip.from(state, { duration: 0.5, ease: 'power3.inOut', absolute: true, scale: true, simple: true, targets,
      onEnter: (els) => g.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.4 }),
      onLeave: (els) => g.to(els, { opacity: 0, scale: 0.92, duration: 0.25 }) });
  },
  /* 成功庆祝：从某个元素中心向外迸发彩色小块 */
  burst(anchor, { count = 26, colors = ['#22D3EE', '#8B5CF6', '#34D399', '#FBBF24', '#F472B6'] } = {}) {
    if (!anchor || !on()) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:95';
    document.body.appendChild(layer);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      const s = 5 + Math.random() * 6;
      p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${s}px;height:${s * (Math.random() > .5 ? 1 : 2.2)}px;border-radius:${Math.random() > .5 ? '50%' : '2px'};background:${colors[i % colors.length]}`;
      layer.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 150;
      g.to(p, { x: Math.cos(a) * d, y: Math.sin(a) * d - 40, rotation: Math.random() * 540, opacity: 0, duration: 0.9 + Math.random() * 0.6, ease: 'power3.out' });
    }
    setTimeout(() => layer.remove(), 1700);
  },
  float(el) {
    if (!el || !on()) return;
    g.to(el, { y: -6, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  },
  kill(el) { if (g) g.killTweensOf(el); },
};

document.addEventListener('pointerdown', (e) => motion.press(e), { passive: true });
