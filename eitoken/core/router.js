/* hash 路由。页面模块导出 async render(view, params, ctx) → 可选返回 cleanup。 */
import { motion } from './motion.js';

const routes = [];
let cleanup = null, token = 0;
const listeners = new Set();

export function route(pattern, load, meta = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([a-z]+)/gi, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  routes.push({ pattern, re, keys, load, meta });
}
export const onRoute = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const go = (path) => { if (location.hash !== '#' + path) location.hash = path; else render(); };
export const current = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];

export async function render() {
  const path = current();
  let hit = null, params = {};
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { hit = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
  }
  if (!hit) { go('/'); return; }
  const my = ++token;
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  const view = document.getElementById('view');
  const mod = await hit.load();
  if (my !== token) return;
  view.innerHTML = '';
  window.scrollTo(0, 0);
  listeners.forEach((fn) => fn(hit.meta, params));
  try {
    cleanup = (await mod.render(view, params)) || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card" style="max-width:560px;margin:40px auto"><h3>这一页出了点问题</h3><p class="mute" style="margin:8px 0 16px">${String(e.message || e).replace(/</g, '&lt;')}</p><a class="btn" href="#/">回工作台</a></div>`;
  }
  if (my === token) motion.pageIn(view);
}
window.addEventListener('hashchange', render);
