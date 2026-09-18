/* 我的项目（保存在本机浏览器） */
import { state, removeProject } from '../core/store.js';
import { esc, $, $$, confirmBox, empty } from '../core/ui.js';
import { icon } from '../components/icons.js';
import { FAMILIES } from '../core/boards.js';
import { coverSVG } from '../components/covers.js';
import { motion } from '../core/motion.js';

export async function render(view) {
  const paint = () => {
    const list = state.projects;
    view.innerHTML = `<div class="page-h"><div><h1>我的项目</h1><p>项目自动保存在这台电脑上。从案例开始，或者在工作台说一句话新建。</p></div><span class="grow"></span><a class="btn primary" href="#/">${icon('plus')}新建项目</a></div>
      ${list.length ? `<div class="grid c3">${list.map((p) => `<div class="card hover proj-card" data-rv>
          <a href="#/project/${p.id}" class="pc-link" aria-label="打开 ${esc(p.title)}"></a>
          <div class="pc-cover">${coverSVG({ motif: p.family === 'esp32' ? 'wifi' : 'led', hue: p.family === 'esp32' ? 'cyan' : 'mint' }, 'p' + p.id)}</div>
          <div class="row" style="gap:8px;margin-top:12px"><span class="fam ${p.family}">${FAMILIES[p.family] ? FAMILIES[p.family].nm : ''}</span>${p.caseId ? '<span class="pill">来自案例</span>' : p.task ? '<span class="pill acc">AI 生成</span>' : ''}<span class="grow"></span><button class="icon-btn pc-del" data-del="${p.id}" aria-label="删除项目">${icon('x')}</button></div>
          <h3 style="margin-top:8px;font-size:16px">${esc(p.title || '未命名项目')}</h3>
          <p class="mute" style="font-size:12.5px">${(p.code || '').split('\n').length} 行 · ${new Date(p.updated || p.created).toLocaleString('zh-CN')}</p>
        </div>`).join('')}</div>`
        : `<div class="card">${empty({ title: '还没有项目', text: '挑个案例开始最快：打开案例 → 烧录到我的板子。', action: '<a class="btn primary" href="#/cases">去案例超市</a>' })}</div>`}`;
    $$('[data-del]', view).forEach((b) => (b.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (await confirmBox('删除这个项目？', '只删除本机保存的代码，不影响板子上已经烧进去的程序。', { ok: '删除', danger: true })) { removeProject(b.dataset.del); paint(); }
    }));
    motion.reveal(view);
  };
  paint();
}
