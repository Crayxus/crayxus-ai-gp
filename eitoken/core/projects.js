/* 新建项目的统一入口：从案例 / 从一句话 / 从设备。 */
import { saveProject, uid, state } from './store.js';
import { FAMILIES } from './boards.js';

export function projectFromCase(c, { family, fqbn, com } = {}) {
  const b = (c.boards || []).find((x) => (fqbn ? x.fqbn === fqbn : family ? x.family === family : true)) || (c.boards || [])[0] || {};
  return saveProject({
    id: uid('p'), title: c.title, caseId: c.id, code: c.code || '', family: b.family || family || 'avr',
    fqbn: b.fqbn || (FAMILIES[family] && FAMILIES[family].fqbn) || 'arduino:avr:uno', com: com || '', task: '', created: Date.now(),
  });
}
export function projectFromTask(task, { family = 'esp32', com = '' } = {}) {
  const t = task.trim();
  return saveProject({
    id: uid('p'), title: t.length > 22 ? t.slice(0, 22) + '…' : t, task: t, pendingTask: t, caseId: '', code: '',
    family, fqbn: (FAMILIES[family] && FAMILIES[family].fqbn) || 'esp32:esp32:esp32', com, created: Date.now(),
  });
}
/* 当前插着的一线板子（优先确定识别的） */
export function activeBoard() {
  const t1 = state.hw.filter((d) => (d.family === 'esp32' || d.family === 'avr') && !d.demo);
  return t1.find((d) => d.sure) || t1[0] || null;
}
