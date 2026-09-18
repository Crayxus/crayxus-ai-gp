/* 「我」：登录、资料、经验、成就、余额。
   登录了走账号后端真数据；没登录 / 后端不在 → 演示资料（界面显式标「演示数据」）。 */
import { server, auth, fixtures } from './api.js';
import { state, set } from './store.js';
import { levelFor } from './ranks.js';
import { celebrateXp } from '../components/celebrate.js';

export async function loadMe() {
  if (!auth.loggedIn()) return useDemo();
  const [p, plans] = await Promise.all([server.get('/api/profile'), server.get('/api/billing/plans')]);
  if (p.status === 401) { auth.clear(); return useDemo(); }
  if (!p.ok) { set({ server: !p.offline ? true : false }); return useDemo(); }
  set({
    server: true, profile: p, profileDemo: false,
    balance: plans.ok ? plans.balance : state.balance,
    plan: plans.ok ? plans.current : state.plan,
  });
  return p;
}
async function useDemo() {
  const fx = await fixtures();
  const p = structuredClone(fx.profile || { profile: { nickname: '访客', avatar: 'bot-01' }, xp: 0, weekXp: 0, level: null, achievements: [] });
  // 访客的引导进度只记在本机：第一次来仍然会看到欢迎引导
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let tips = {}; try { tips = JSON.parse(lsGet('eit1.tips') || '{}'); } catch (e) {}
  p.profile.onboarding = { done: lsGet('eit1.obDone') === '1', tips };
  set({ profile: p, profileDemo: true, balance: fx.plans ? fx.plans.balance : null, plan: fx.plans ? fx.plans.current : null });
  return p;
}

export const myLevel = () => {
  const p = state.profile; const xp = (p && p.xp) || 0;
  return levelFor(xp);
};

export async function login(email, password) {
  const r = await server.post('/api/auth/login', { email, password });
  if (r.ok) { auth.save(r.token, r.email); await loadMe(); }
  return r;
}
export async function register(email, password) {
  const r = await server.post('/api/auth/register', { email, password });
  if (r.ok) { auth.save(r.token, r.email); await loadMe(); }
  return r;
}
export async function logout() {
  try { await server.post('/api/auth/logout'); } catch (e) {}
  auth.clear(); await loadMe();
}

export async function saveProfile(patch) {
  if (state.profileDemo) {   // 没登录：先记在本机，界面照样好用
    const p = structuredClone(state.profile);
    p.profile = { ...p.profile, ...patch, onboarding: { ...(p.profile.onboarding || {}), ...(patch.onboarding || {}) } };
    if (patch.onboarding && patch.onboarding.done) { try { localStorage.setItem('eit1.obDone', '1'); } catch (e) {} }
    set({ profile: p });
    return { ok: true, demo: true };
  }
  const cur = state.profile && state.profile.profile || {};
  const body = { ...patch };
  if (patch.onboarding) body.onboarding = { ...(cur.onboarding || {}), ...patch.onboarding, tips: { ...((cur.onboarding || {}).tips || {}), ...((patch.onboarding || {}).tips || {}) } };
  const r = await server.put('/api/profile', body);
  if (r.ok) set({ profile: r });
  return r;
}

/* 桥接 NDJSON 里的 xp 行 → 账号后端。meta 带 caseId / family，case_done、new_board 由后端推算 */
export async function forwardXp(line, meta = {}) {
  if (!auth.loggedIn() || state.profileDemo) return null;
  const r = await server.post('/api/xp/event', { kind: line.kind, ref: line.ref, ts: line.ts, proof: line.proof, meta: { ...(line.meta || {}), ...meta } });
  if (!r.ok) return r;
  const before = state.profile;
  const next = { ...before, xp: r.xp, level: r.level, achievements: [...new Set([...(before.achievements || []), ...(r.unlocked || []).map((u) => u.key)])] };
  set({ profile: next });
  if (r.gained || (r.unlocked && r.unlocked.length) || r.levelUp) celebrateXp(r);
  return r;
}
export const clientEvent = (kind, ref) => (auth.loggedIn() && !state.profileDemo ? server.post('/api/xp/client', { kind, ref }) : Promise.resolve(null));
