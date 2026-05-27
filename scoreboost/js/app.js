// Crayxus AI 提分系统 · Web 版工具函数
// 模拟微信 API: storage / vibrate / showToast / showModal / showActionSheet
(function() {
const Storage = {
  get(key, def = null) {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return def
      return JSON.parse(raw)
    } catch (e) { return def }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key) } catch (e) {} }
}

function vibrate(strength = 'light') {
  if (!navigator.vibrate) return
  const ms = strength === 'heavy' ? 50 : strength === 'medium' ? 30 : 15
  try { navigator.vibrate(ms) } catch (e) {}
}

function showToast(msg, opts = {}) {
  const duration = opts.duration || 1500
  let host = document.getElementById('toast-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'toast-host'
    document.body.appendChild(host)
  }
  const el = document.createElement('div')
  el.className = 'toast-item ' + (opts.icon === 'success' ? 'toast-success' : '')
  el.innerHTML = (opts.icon === 'success' ? '<span class="ti">✓</span>' : '') + '<span>' + msg + '</span>'
  host.appendChild(el)
  setTimeout(() => el.classList.add('show'), 10)
  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.remove(), 250)
  }, duration)
}

function showModal({ title, content, confirmText = '确定', cancelText = '取消', showCancel = true, confirmColor = '#00d4ff' }) {
  return new Promise((resolve) => {
    const mask = document.createElement('div')
    mask.className = 'cx-modal-mask'
    mask.innerHTML = `
      <div class="cx-modal">
        ${title ? `<div class="cx-modal-title">${title}</div>` : ''}
        <div class="cx-modal-content">${(content || '').replace(/\n/g, '<br>')}</div>
        <div class="cx-modal-actions">
          ${showCancel ? `<button class="cx-btn ghost" data-act="cancel">${cancelText}</button>` : ''}
          <button class="cx-btn primary" data-act="ok" style="color:${confirmColor};border-color:${confirmColor}">${confirmText}</button>
        </div>
      </div>`
    document.body.appendChild(mask)
    setTimeout(() => mask.classList.add('show'), 10)
    mask.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act
      if (!act) return
      mask.classList.remove('show')
      setTimeout(() => mask.remove(), 200)
      resolve({ confirm: act === 'ok', cancel: act === 'cancel' })
    })
  })
}

function showActionSheet(items) {
  return new Promise((resolve) => {
    const mask = document.createElement('div')
    mask.className = 'cx-modal-mask cx-action-mask'
    mask.innerHTML = `
      <div class="cx-action-sheet">
        ${items.map((it, i) => `<button class="cx-action-item" data-idx="${i}">${it}</button>`).join('')}
        <button class="cx-action-item cx-action-cancel" data-idx="-1">取消</button>
      </div>`
    document.body.appendChild(mask)
    setTimeout(() => mask.classList.add('show'), 10)
    mask.addEventListener('click', (e) => {
      const idx = e.target.dataset && e.target.dataset.idx
      if (idx === undefined) return
      mask.classList.remove('show')
      setTimeout(() => mask.remove(), 200)
      resolve({ tapIndex: parseInt(idx, 10) })
    })
  })
}

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '小时前'
  const d = Math.floor(h / 24)
  if (d < 30) return d + '天前'
  return Math.floor(d / 30) + '月前'
}

// AI 进度条假动画 (5 阶段 0→95)
function startAILoader(host, messages, opts = {}) {
  const minDuration = opts.minDuration || 2400
  host.innerHTML = `
    <div class="ai-ring"></div>
    <div class="ai-title">Crayxus AI 运行中</div>
    <div class="ai-msg">${messages[0]}</div>
    <div class="ai-bar-wrap"><div class="ai-bar-fill" style="width:0%"></div></div>
    <div class="ai-pct">0%</div>
    <div class="ai-stages">
      <div class="ai-stage"><span>读取</span></div>
      <div class="ai-stage"><span>分析</span></div>
      <div class="ai-stage"><span>生成</span></div>
      <div class="ai-stage"><span>完成</span></div>
    </div>`
  host.classList.add('show')
  const fill = host.querySelector('.ai-bar-fill')
  const pct = host.querySelector('.ai-pct')
  const msgEl = host.querySelector('.ai-msg')
  const stages = host.querySelectorAll('.ai-stage')
  let p = 0, idx = 0
  const startTs = Date.now()
  const timer = setInterval(() => {
    if (p < 25) p += 1.8
    else if (p < 55) p += 0.7
    else if (p < 80) p += 0.35
    else if (p < 92) p += 0.12
    else if (p < 95) p += 0.03
    if (p > 95) p = 95
    const newIdx = Math.min(messages.length - 1, Math.floor(p / 20))
    if (newIdx !== idx) { idx = newIdx; msgEl.textContent = messages[idx] }
    fill.style.width = p + '%'
    pct.textContent = Math.round(p) + '%'
    if (p >= 20) stages[0].classList.add('done')
    if (p >= 50) stages[1].classList.add('done')
    if (p >= 80) stages[2].classList.add('done')
  }, 180)

  return {
    finish(cb) {
      clearInterval(timer)
      const wait = Math.max(0, minDuration - (Date.now() - startTs))
      setTimeout(() => {
        fill.style.width = '100%'
        pct.textContent = '100%'
        msgEl.textContent = '生成完成 ✓'
        stages[3].classList.add('done')
        setTimeout(() => {
          host.classList.remove('show')
          if (cb) cb()
        }, 450)
      }, wait)
    }
  }
}

// 全局 AI Helper 浮动按钮 (页面引导)
const AI_HELPER_TEXTS = {
  scoreboost: ['👋 欢迎来到 Crayxus AI 提分系统！这里是 6 大科目 Hub。', '点击科目卡选择你要冲分的科目, 比如 SAT。', '完成「BOOST 测评」会解锁六维诊断 + AI 预测分数。', '建议先做「MATCH 匹配测评」, AI 会推荐方案 + 主攻科目。'],
  'sb-quiz-assess': ['📋 20 题定级测评。请认真作答。', '答完每题点确认查看解析, 系统会建立你的能力画像。', '连对 3 题有盲盒奖励!', '完成后会生成六维诊断报告。'],
  'sb-quiz-adaptive': ['🎯 自适应训练。AI 已锁定你的薄弱维度。', '10 道针对性题目, 比定级测评更精准。', '记得仔细看解析, 加入生词本/错题本可复习。'],
  'pre-screen-test': ['◆ MATCH DRIVE · 学习人格 + 兼容指数测评。', '10 道题, 5 分钟。如实选择, AI 会判断你的学习型人格。', '完成后获得专属推荐方案。'],
  'pre-screen': ['📊 这是你的 MATCH 报告。', '六维矩阵越高代表越适合该方向。', '可以分享给家长查看完整建议。'],
  wrongbook: ['📚 错题本采用艾宾浩斯记忆曲线。', '错题 1/3/7/15 天自动提醒复习。', '点击任意错题可看 AI 个性化讲解。'],
  'teacher-dashboard': ['🧑‍🏫 教师端可一键管理整个班级。', '本月 Top 3 自动获得次月免费使用权。', '可以一键发起班级月度测评。'],
}

function attachAIHelper(pageKey) {
  const texts = AI_HELPER_TEXTS[pageKey] || ['Crayxus AI 助手已就绪。']
  let step = 0
  const btn = document.createElement('div')
  btn.className = 'ai-helper-fab'
  btn.innerHTML = '<div class="ahf-orb"></div><div class="ahf-mark">AI</div>'
  document.body.appendChild(btn)
  const bubble = document.createElement('div')
  bubble.className = 'ai-helper-bubble'
  document.body.appendChild(bubble)
  function show() {
    bubble.textContent = texts[step % texts.length]
    bubble.classList.add('show')
    step++
    clearTimeout(bubble._t)
    bubble._t = setTimeout(() => bubble.classList.remove('show'), 6000)
  }
  btn.addEventListener('click', () => { vibrate('light'); show() })
  // 首次进入页面 1.2s 后自动弹一次
  setTimeout(show, 1200)
}

window.App = { Storage, vibrate, showToast, showModal, showActionSheet, relTime, startAILoader, attachAIHelper }
})()
