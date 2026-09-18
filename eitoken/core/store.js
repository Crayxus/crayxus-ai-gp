/* 订阅式状态。替代老版到处挂在 window 上的 gen / homeDevs。
   set 只做浅合并；订阅者拿到 (state, changedKeys)。 */
const LSP = 'eit1.';
export const LS = {
  get(k, d) { try { const v = localStorage.getItem(LSP + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(LSP + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(LSP + k); } catch (e) {} },
};

const subs = new Set();
export const state = {
  theme: LS.get('theme', 'night'),
  bridge: null,          // null = 探测中 / true / false
  server: null,          // 账号后端在不在
  hw: [],                // 设备列表（按 key）
  hwDemo: false,
  profile: null,         // /api/profile 的整包
  profileDemo: false,
  balance: null,
  plan: null,
  cases: null,           // 案例索引
  projects: LS.get('projects', []),
  toolchain: null,
};

export function set(patch) {
  const changed = Object.keys(patch).filter((k) => state[k] !== patch[k]);
  if (!changed.length) return;
  Object.assign(state, patch);
  if ('projects' in patch) LS.set('projects', state.projects);
  if ('theme' in patch) LS.set('theme', state.theme);
  subs.forEach((fn) => { try { fn(state, changed); } catch (e) { console.error(e); } });
}
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

/* 项目（本机保存）。字段：id, title, caseId, code, family, fqbn, updated, task */
export function saveProject(p) {
  const list = state.projects.filter((x) => x.id !== p.id);
  list.unshift({ ...p, updated: Date.now() });
  set({ projects: list.slice(0, 60) });
  return p;
}
export function getProject(id) { return state.projects.find((p) => p.id === id) || null; }
export function removeProject(id) { set({ projects: state.projects.filter((p) => p.id !== id) }); }
export const uid = (p = 'p') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
