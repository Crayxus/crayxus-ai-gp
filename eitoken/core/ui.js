import { icon } from '../components/icons.js';
import { motion } from './motion.js';

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const fmtMoney = (n) => (n == null ? '—' : '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'));
export const fmtDate = (ts) => { if (!ts) return '—'; const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtTime = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const demoFlag = (txt = '演示数据') => `<span class="demo-flag" title="后端暂未提供，显示的是示例">${icon('eye')}${esc(txt)}</span>`;
export const stars = (n) => `<span class="stars" aria-label="难度 ${n}/3">${[1, 2, 3].map((i) => `<i class="${i <= n ? '' : 'off'}"></i>`).join('')}</span>`;

export function empty({ art = '', title, text = '', action = '' }) {
  return `<div class="empty">${art ? `<div class="art">${art}</div>` : ''}<h4>${esc(title)}</h4>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}

/* ───────── toast ───────── */
export function toast(msg, kind = 'info', { ms = 2600, action } = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const ic = { ok: 'check', err: 'x', warn: 'help', info: 'sparkles' }[kind] || 'sparkles';
  el.innerHTML = `<span class="chip-ic">${icon(ic)}</span><span class="grow">${msg}</span>${action ? `<button class="btn sm soft">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.run(); close(); };
  box.appendChild(el);
  motion.toastIn(el);
  const close = () => motion.toastOut(el).then(() => el.remove());
  setTimeout(close, ms);
  return close;
}

/* ───────── 层：sheet / modal（栈式，Esc 关最上层） ───────── */
const stack = [];
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

function layer(kind, html, { onClose, wide = false, label = '' } = {}) {
  const root = $('#layer');
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  let panel;
  if (kind === 'sheet') {
    panel = document.createElement('aside'); panel.className = 'sheet';
    panel.innerHTML = html;
    root.append(scrim, panel);
  } else {
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    panel = document.createElement('div'); panel.className = 'modal' + (wide ? ' wide' : '');
    panel.innerHTML = html; wrap.appendChild(panel);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) api.close(); });
    root.append(scrim, wrap);
    panel._wrap = wrap;
  }
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); if (label) panel.setAttribute('aria-label', label);
  const prevFocus = document.activeElement;
  let closed = false;
  const api = {
    el: panel,
    close: async (val) => {
      if (closed) return; closed = true;
      stack.splice(stack.indexOf(api), 1);
      await motion.layerOut(kind, panel, scrim);
      scrim.remove(); (panel._wrap || panel).remove();
      try { prevFocus && prevFocus.focus(); } catch (e) {}
      onClose && onClose(val);
    },
  };
  scrim.onclick = () => api.close();
  panel.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => api.close()));
  stack.push(api);
  motion.layerIn(kind, panel, scrim);
  setTimeout(() => { const f = panel.querySelector('[autofocus], input, button:not([data-close])'); f && f.focus(); }, 60);
  return api;
}
export const sheet = (html, opt) => layer('sheet', html, opt);
export const modal = (html, opt) => layer('modal', html, opt);

export function confirmBox(title, text, { ok = '确定', cancel = '取消', danger = false } = {}) {
  return new Promise((resolve) => {
    let val = false;
    const m = modal(`<div class="modal-h"><h3>${esc(title)}</h3></div>
      <div class="modal-b"><p class="dim">${text}</p>
      <div class="row" style="justify-content:flex-end;margin-top:20px"><button class="btn ghost" data-close>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(ok)}</button></div></div>`,
    { onClose: () => resolve(val) });
    m.el.querySelector('#cfOk').onclick = () => { val = true; m.close(true); };
  });
}

/* 进度环（SVG）。p: 0..1 */
export function ring(p, size = 120, stroke = 10, inner = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--acc)"/><stop offset="1" stop-color="var(--acc-2)"/></linearGradient></defs>
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, p)))}" data-c="${c}"/>
    </svg><div class="ring-c">${inner}</div></div>`;
}
export function setRing(el, p) {
  const fg = el.querySelector('.ring-fg'); if (!fg) return;
  const c = +fg.dataset.c; fg.setAttribute('stroke-dashoffset', c * (1 - Math.max(0, Math.min(1, p))));
}
