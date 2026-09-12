// 择大 AI 提分系统 · 科目注册表 (Web 版)
// 6 主科目 + 6 贝赛思子学科, 每科 12-20 道演示题
(function() {
const SUBJECTS_RAW = [
  // ===== 雅思 IELTS =====
  {
    id: 'ielts', name: '雅思 IELTS', shortName: '雅思', icon: '🌍',
    color: '#00d4ff', gradient: 'linear-gradient(135deg,#00d4ff,#7c4dff)', tag: '语言',
    textbook: { title: 'IELTS Academic · Official Guide', author: 'Cambridge Assessment', grade: 'Band 5.5 → 8.0', lessons: 48 },
    DIMS: [
      { key: 'listening',  name: '听力',  icon: '🎧', color: '#00d4aa' },
      { key: 'speaking',   name: '口语',  icon: '🗣', color: '#00d4ff' },
      { key: 'reading',    name: '阅读',  icon: '📖', color: '#7c4dff' },
      { key: 'writing',    name: '写作',  icon: '✍',  color: '#ffd700' },
      { key: 'vocabulary', name: '词汇',  icon: '📚', color: '#ff9500' },
      { key: 'grammar',    name: '语法',  icon: '🔤', color: '#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'ie01', dim:'listening', lesson:'Section 1 · Form Filling', difficulty:1, q:'IELTS Listening Section 1 中最常见的题型是?', options:['多选题','表格/笔记填空','标题匹配','摘要题'], answer:1, solution:'Section 1 多为表格/笔记填空（人物信息、预订、住宿等）。' },
      { id:'ie02', dim:'listening', lesson:'Number Spelling', difficulty:1, q:'听到 "B for Bravo, N for November" 时, 邮编 "BN1 4QP" 哪个对?', options:['BM1 4QP','BN1 4QP','VN1 4QP','BN1 4KP'], answer:1, solution:'NATO 字母表用于辨音防混淆,B=Bravo, N=November。' },
      { id:'ie03', dim:'listening', lesson:'Map Labelling', difficulty:2, q:'"The library is OPPOSITE the cafeteria." 图书馆在哪边?', options:['同侧','正对面','相邻','里面'], answer:1, solution:'opposite = 正对面（不同边）, adjacent = 相邻同边。' },
      { id:'ie04', dim:'speaking', lesson:'Part 2 · Cue Card', difficulty:2, q:'Speaking Part 2 题卡发放后, 准备时间是多久?', options:['30 秒','1 分钟','2 分钟','3 分钟'], answer:1, solution:'Part 2: 1 分钟准备 + 1-2 分钟陈述。' },
      { id:'ie05', dim:'speaking', lesson:'Coherence Connectors', difficulty:2, q:'哪个连接词最能表达 CONTRAST (对比)?', options:['Moreover','Whereas','For instance','Therefore'], answer:1, solution:'whereas = 对比, moreover 递进, for instance 举例, therefore 因果。' },
      { id:'ie06', dim:'speaking', lesson:'Part 3 · Abstract', difficulty:3, q:'Part 3 中 Band 8 答案的核心特征是?', options:['背诵套句','观点展开+例子支撑','长时间思考停顿','频繁自我修正'], answer:1, solution:'Part 3 考察抽象讨论的展开与举例支撑。' },
      { id:'ie07', dim:'reading', lesson:'T/F/NG', difficulty:2, q:'陈述: "X is the BEST option." 原文: "X is ONE OF several good options." 答案?', options:['True','False','Not Given','Both'], answer:1, solution:'原文说"之一",陈述说"最佳",与事实矛盾 → False。' },
      { id:'ie08', dim:'reading', lesson:'Matching Headings', difficulty:2, q:'Matching Headings 最佳策略是?', options:['通读全文','读每段首末句','只看标题','逐字翻译'], answer:1, solution:'段落主旨通常在首末句 (topic sentence)。' },
      { id:'ie09', dim:'reading', lesson:'Paraphrasing', difficulty:2, q:'"Urbanisation accelerated in the 19th century." 同义改写?', options:['Cities declined in 1800s','City growth sped up in the 1800s','Rural areas expanded','Urbanisation started in 1900s'], answer:1, solution:'19th century = 1800s, accelerated = sped up。' },
      { id:'ie10', dim:'writing', lesson:'Task 1 Overview', difficulty:2, q:'Writing Task 1 的 Overview 应该?', options:['列出每个数据','总结主要趋势不含数字','加入个人观点','给出结论'], answer:1, solution:'Overview 总结主要趋势,不含具体数字,不加主观评价。' },
      { id:'ie11', dim:'writing', lesson:'Task 2 Structure', difficulty:2, q:'Task 2 标准结构是几段?', options:['2','3','4','5'], answer:2, solution:'引言 + 2 主体段 + 结论 = 4 段为标准结构。' },
      { id:'ie12', dim:'writing', lesson:'Lexical Resource', difficulty:3, q:'"very important" 的学术替换最佳是?', options:['Really big','Crucial','Super nice','Way cool'], answer:1, solution:'crucial 为学术常用正式词汇。' },
      { id:'ie13', dim:'vocabulary', lesson:'Collocations', difficulty:2, q:'哪个搭配是正确的?', options:['Make a decision','Do a decision','Give a decision','Put a decision'], answer:0, solution:'英式标准搭配 make a decision。' },
      { id:'ie14', dim:'vocabulary', lesson:'AWL', difficulty:2, q:'"Analyse" 在 AWL 中属于哪类?', options:['Describe','Examine in detail','Summarise','Predict'], answer:1, solution:'analyse = 详细审视/拆解。' },
      { id:'ie15', dim:'vocabulary', lesson:'Word Formation', difficulty:2, q:'"significant" 的名词形式?', options:['Signify','Significance','Significantly','Significate'], answer:1, solution:'significant(adj) → significance(n)。' },
      { id:'ie16', dim:'grammar', lesson:'Conditionals', difficulty:2, q:'"If I ___ rich, I would travel." 填什么?', options:['am','was','were','will be'], answer:2, solution:'虚拟语气第二条件句: If + were, would + inf。' },
      { id:'ie17', dim:'grammar', lesson:'Passive Voice', difficulty:1, q:'"They built this school in 1990" 的被动形式?', options:['This school built in 1990','This school was built in 1990','This school is built in 1990','This school has built in 1990'], answer:1, solution:'一般过去时被动: was/were + p.p.' },
      { id:'ie18', dim:'grammar', lesson:'Articles', difficulty:2, q:'"___ UK is ___ country in Europe."', options:['A / a','The / a','The / the','— / a'], answer:1, solution:'国家名 UK 特指加 the, country 泛指用 a。' },
      { id:'ie19', dim:'grammar', lesson:'Relative Clauses', difficulty:2, q:'"The book ___ I bought is expensive." 填?', options:['who','whose','which','whom'], answer:2, solution:'先行词 the book 为物, 关系代词用 which/that。' },
      { id:'ie20', dim:'grammar', lesson:'Subject-Verb', difficulty:2, q:'"The number of students ___ increasing."', options:['are','is','have','were'], answer:1, solution:'The number of (+ pl) 整体作单数主语 → is。' },
    ]
  },

  // ===== TOEFL =====
  {
    id: 'toefl', name: '托福 TOEFL', shortName: '托福', icon: '🇺🇸',
    color: '#00d4aa', gradient: 'linear-gradient(135deg,#00d4aa,#00d4ff)', tag: '语言',
    textbook: { title: 'TOEFL iBT · ETS Official Guide', author: 'ETS', grade: '70 → 110', lessons: 36 },
    DIMS: [
      { key:'reading',   name:'阅读', icon:'📖', color:'#7c4dff' },
      { key:'listening', name:'听力', icon:'🎧', color:'#00d4aa' },
      { key:'speaking',  name:'口语', icon:'🗣', color:'#00d4ff' },
      { key:'writing',   name:'写作', icon:'✍',  color:'#ffd700' },
      { key:'vocabulary',name:'词汇', icon:'📚', color:'#ff9500' },
      { key:'integrate', name:'综合', icon:'🔗', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'tf01', dim:'reading', lesson:'Vocabulary in Context', difficulty:2, q:'In the passage, "subsequent" most nearly means:', options:['previous','following','simultaneous','accidental'], answer:1, solution:'subsequent = following 后续的。' },
      { id:'tf02', dim:'reading', lesson:'Inference', difficulty:3, q:'Inference 题最关键的策略是?', options:['找原文直接陈述','基于原文逻辑推论','凭常识猜','跳过不做'], answer:1, solution:'Inference 必须基于原文,不能脱离文本。' },
      { id:'tf03', dim:'reading', lesson:'Sentence Insertion', difficulty:3, q:'插入句题的关键线索是?', options:['段落首句','代词与连接词','文章长度','作者背景'], answer:1, solution:'代词 (this, these) 和连接词 (however, moreover) 指向上下文。' },
      { id:'tf04', dim:'listening', lesson:'Lecture Note-Taking', difficulty:2, q:'Lecture 题听讲座时最该记什么?', options:['每个词','主旨+例子+转折','只记数字','只记人名'], answer:1, solution:'记主旨、例子、转折关键词。' },
      { id:'tf05', dim:'listening', lesson:'Function Question', difficulty:3, q:'"What does the professor mean by saying..." 考察?', options:['字面意思','言外之意/态度','语法结构','发音清晰度'], answer:1, solution:'Function 题考察隐含意图、态度、目的。' },
      { id:'tf06', dim:'listening', lesson:'Conversation', difficulty:2, q:'Office Hours 对话最常见话题?', options:['请假','作业问题/选课','点餐','购物'], answer:1, solution:'TOEFL Conversation 多为学生与教授/职员讨论选课、作业、研究。' },
      { id:'tf07', dim:'speaking', lesson:'Task 1 · Independent', difficulty:2, q:'Independent Speaking 准备时间是?', options:['10 秒','15 秒','30 秒','60 秒'], answer:1, solution:'Task 1 准备 15 秒, 回答 45 秒。' },
      { id:'tf08', dim:'speaking', lesson:'Task 4 · Lecture', difficulty:3, q:'Task 4 重述讲座的关键策略?', options:['全文背诵','抓 main idea + 两个 example','只复述例子','只复述结论'], answer:1, solution:'主旨 + 两个例子, 60 秒内说完。' },
      { id:'tf09', dim:'writing', lesson:'Integrated Writing', difficulty:3, q:'Integrated Writing 阅读和听力的关系通常是?', options:['完全一致','听力反驳阅读','听力补充阅读','无关'], answer:1, solution:'95% 的题型: 听力点对点反驳阅读的 3 个观点。' },
      { id:'tf10', dim:'writing', lesson:'Academic Discussion', difficulty:2, q:'新版 Academic Discussion 推荐字数?', options:['50-80','100+','200+','300+'], answer:1, solution:'10 分钟内写 100+ 词, 有理有据。' },
      { id:'tf11', dim:'vocabulary', lesson:'Academic Words', difficulty:2, q:'"hypothesis" 的复数形式?', options:['hypothesises','hypothesises','hypotheses','hypothesi'], answer:2, solution:'希腊词源, -is → -es: hypothesis → hypotheses。' },
      { id:'tf12', dim:'integrate', lesson:'Time Management', difficulty:2, q:'TOEFL 阅读建议每篇用时?', options:['10 分钟','18 分钟','25 分钟','30 分钟'], answer:1, solution:'每篇 18 分钟左右, 总共 54-72 分钟。' },
    ]
  },

  // ===== AP =====
  {
    id: 'ap', name: 'AP 大学先修', shortName: 'AP', icon: '🎓',
    color: '#ffd700', gradient: 'linear-gradient(135deg,#ffd700,#ff9500)', tag: '美高',
    textbook: { title: 'AP Calculus / Physics / Bio · College Board', author: 'College Board', grade: '1 → 5', lessons: 80 },
    DIMS: [
      { key:'concept',   name:'概念理解', icon:'🧠', color:'#00d4aa' },
      { key:'compute',   name:'计算能力', icon:'🔢', color:'#00d4ff' },
      { key:'apply',     name:'应用题',   icon:'🎯', color:'#7c4dff' },
      { key:'analysis',  name:'分析推理', icon:'🔬', color:'#ffd700' },
      { key:'free_resp', name:'自由问答', icon:'📝', color:'#ff9500' },
      { key:'speed',     name:'解题速度', icon:'⚡', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'ap01', dim:'concept', lesson:'AP Calc · 导数定义', difficulty:2, q:'f(x) = x², f\'(2) 等于?', options:['2','3','4','8'], answer:2, solution:'f\'(x) = 2x, f\'(2) = 4。' },
      { id:'ap02', dim:'concept', lesson:'AP Calc · 中值定理', difficulty:3, q:'中值定理 (MVT) 要求函数在 [a,b] 上?', options:['仅连续','仅可导','连续且开区间可导','二阶可导'], answer:2, solution:'闭区间连续 + 开区间可导。' },
      { id:'ap03', dim:'compute', lesson:'AP Phys · 自由落体', difficulty:1, q:'g = 9.8 m/s², 自由下落 2 秒后速度是?', options:['9.8','14.7','19.6','24.5'], answer:2, solution:'v = gt = 9.8 × 2 = 19.6 m/s。' },
      { id:'ap04', dim:'compute', lesson:'AP Phys · 动量守恒', difficulty:2, q:'2kg 物体以 3m/s 撞 4kg 静止物体并粘连, 共同速度?', options:['0.5','1','1.5','2'], answer:1, solution:'2×3 = (2+4)v → v = 1 m/s。' },
      { id:'ap05', dim:'apply', lesson:'AP Stats · 标准差', difficulty:2, q:'数据 [2,4,4,4,5,5,7,9] 的中位数?', options:['4','4.5','5','6'], answer:1, solution:'排序后第 4、5 项均值 = (4+5)/2 = 4.5。' },
      { id:'ap06', dim:'apply', lesson:'AP Bio · 光合作用', difficulty:2, q:'光合作用暗反应发生在?', options:['类囊体膜','基质','线粒体','核糖体'], answer:1, solution:'暗反应 (Calvin) 在叶绿体基质 stroma。' },
      { id:'ap07', dim:'analysis', lesson:'AP Chem · 平衡常数', difficulty:3, q:'Kc 增大说明反应?', options:['更慢','更快','正向更彻底','逆向更彻底'], answer:2, solution:'Kc 大 = 产物多 = 正向更彻底。' },
      { id:'ap08', dim:'analysis', lesson:'AP Psych · 经典条件反射', difficulty:2, q:'巴甫洛夫的狗实验中, 铃声是?', options:['无条件刺激','无条件反应','条件刺激','条件反应'], answer:2, solution:'铃声本来无意义 → 配对后成为 CS (条件刺激)。' },
      { id:'ap09', dim:'free_resp', lesson:'FRQ 评分', difficulty:2, q:'AP FRQ 评分主要看?', options:['答案对错','步骤+逻辑+对错','字数','英语水平'], answer:1, solution:'FRQ 分步给分, 过程比最终答案更重要。' },
      { id:'ap10', dim:'speed', lesson:'AP MC 节奏', difficulty:1, q:'AP MC 部分平均每题用时?', options:['30 秒','60-90 秒','3 分钟','5 分钟'], answer:1, solution:'多数 AP 1 分多钟一题, 留时间检查。' },
      { id:'ap11', dim:'concept', lesson:'AP Calc · 积分基本定理', difficulty:2, q:'∫₀² 2x dx = ?', options:['2','4','6','8'], answer:1, solution:'∫2x dx = x², 代入 [0,2] = 4 - 0 = 4。' },
      { id:'ap12', dim:'apply', lesson:'AP Phys · 电路', difficulty:2, q:'两个 10Ω 电阻并联, 总电阻?', options:['5Ω','10Ω','15Ω','20Ω'], answer:0, solution:'并联: 1/R = 1/10 + 1/10 → R = 5Ω。' },
    ]
  },

  // ===== A-Level =====
  {
    id: 'alevel', name: 'A-Level', shortName: 'A-Level', icon: '🇬🇧',
    color: '#ff9500', gradient: 'linear-gradient(135deg,#ff9500,#ff6b6b)', tag: '英联邦',
    textbook: { title: 'Cambridge / Edexcel A-Level', author: 'Cambridge Assessment', grade: 'E → A*', lessons: 60 },
    DIMS: [
      { key:'theory',   name:'理论知识', icon:'📘', color:'#00d4aa' },
      { key:'problem',  name:'解题技巧', icon:'🎯', color:'#00d4ff' },
      { key:'practical',name:'实验/案例', icon:'🔬', color:'#7c4dff' },
      { key:'data',     name:'数据分析', icon:'📊', color:'#ffd700' },
      { key:'essay',    name:'论述题',   icon:'📝', color:'#ff9500' },
      { key:'exam',     name:'考试策略', icon:'⏱', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'al01', dim:'theory', lesson:'A-Level Math · 微积分', difficulty:2, q:'d/dx (sin x) = ?', options:['cos x','-cos x','sin x','-sin x'], answer:0, solution:'sin 求导 = cos。' },
      { id:'al02', dim:'theory', lesson:'A-Level Bio · 酶', difficulty:2, q:'酶的本质是?', options:['脂质','蛋白质或 RNA','糖类','维生素'], answer:1, solution:'酶绝大多数是蛋白质, 少数 RNA (核酶)。' },
      { id:'al03', dim:'problem', lesson:'Mechanics · F=ma', difficulty:1, q:'5kg 物体施加 10N 力, 加速度?', options:['0.5 m/s²','2 m/s²','5 m/s²','50 m/s²'], answer:1, solution:'a = F/m = 10/5 = 2 m/s²。' },
      { id:'al04', dim:'problem', lesson:'Chem · 摩尔', difficulty:2, q:'2g H₂ 是多少摩尔? (Mr=2)', options:['0.5','1','2','4'], answer:1, solution:'n = m/Mr = 2/2 = 1 mol。' },
      { id:'al05', dim:'practical', lesson:'实验设计', difficulty:2, q:'对照实验最关键的原则?', options:['多次重复','只改变一个变量','使用先进设备','延长时间'], answer:1, solution:'控制变量法是科学实验核心。' },
      { id:'al06', dim:'data', lesson:'图表解读', difficulty:2, q:'A-Level 图表题最忌讳的错误?', options:['只看坐标轴','只描述趋势不引数据','解释原因','计算斜率'], answer:1, solution:'必须引用具体数据点支撑描述。' },
      { id:'al07', dim:'essay', lesson:'Essay 结构', difficulty:3, q:'A-Level 历史 essay 推荐结构?', options:['P-E-E (Point-Evidence-Explain)','流水账','只列证据','只发表意见'], answer:0, solution:'PEE / PEEL 是英联邦考试论述题标准。' },
      { id:'al08', dim:'exam', lesson:'时间分配', difficulty:2, q:'A-Level 通常每分多少时间?', options:['0.5 分钟/分','1 分钟/分','2 分钟/分','3 分钟/分'], answer:1, solution:'1 mark ≈ 1 分钟, 多看 mark scheme。' },
      { id:'al09', dim:'theory', lesson:'Physics · 简谐运动', difficulty:3, q:'弹簧振子周期 T = ?', options:['2π√(m/k)','2π√(k/m)','π√(m/k)','m/k'], answer:0, solution:'T = 2π√(m/k), 与振幅无关。' },
      { id:'al10', dim:'problem', lesson:'Math · 二项式', difficulty:2, q:'(1+x)⁵ 的 x² 系数?', options:['5','10','15','20'], answer:1, solution:'C(5,2) = 10。' },
      { id:'al11', dim:'practical', lesson:'Chem 滴定', difficulty:2, q:'酸碱滴定终点用什么指示剂?', options:['石蕊','酚酞','溴麝香草酚蓝','根据酸碱性质选择'], answer:3, solution:'强酸强碱用酚酞或甲基橙均可, 视滴定曲线。' },
      { id:'al12', dim:'data', lesson:'Statistics', difficulty:2, q:'标准差越大说明数据?', options:['越集中','越分散','越准确','越多'], answer:1, solution:'SD 大 = 离散度大。' },
    ]
  },

  // ===== SAT =====
  {
    id: 'sat', name: 'SAT', shortName: 'SAT', icon: '🎯',
    color: '#7c4dff', gradient: 'linear-gradient(135deg,#7c4dff,#00d4ff)', tag: '标化',
    textbook: { title: 'SAT Official Guide · College Board', author: 'College Board', grade: '1000 → 1600', lessons: 40 },
    DIMS: [
      { key:'reading',  name:'阅读', icon:'📖', color:'#7c4dff' },
      { key:'writing',  name:'文法', icon:'✍',  color:'#00d4aa' },
      { key:'math_no',  name:'数学 (无计算器)', icon:'➗', color:'#00d4ff' },
      { key:'math_yes', name:'数学 (计算器)',   icon:'🧮', color:'#ffd700' },
      { key:'vocab',    name:'词汇',   icon:'📚', color:'#ff9500' },
      { key:'speed',    name:'速度',   icon:'⚡', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'sat01', dim:'reading', lesson:'Main Idea', difficulty:2, q:'SAT Reading 第一题通常考察?', options:['细节','主旨/段落功能','词汇','作者态度'], answer:1, solution:'首题 80% 概率是 main idea / paragraph function。' },
      { id:'sat02', dim:'reading', lesson:'Vocab in Context', difficulty:2, q:'"shrewd" 在句中最接近?', options:['lucky','astute','stubborn','greedy'], answer:1, solution:'shrewd = astute 精明的。' },
      { id:'sat03', dim:'reading', lesson:'Evidence Pairing', difficulty:3, q:'SAT Evidence 题 (line reference) 答错通常因为?', options:['没看选项','上一题答错连带错','英语不行','题目难'], answer:1, solution:'Evidence 题与前一题逻辑挂钩, 前题错 → 这题大概率错。' },
      { id:'sat04', dim:'writing', lesson:'Semicolon Rule', difficulty:2, q:'两个完整句子之间用?', options:['逗号','分号 ;','破折号 —','只能连词'], answer:1, solution:'分号连接两个独立完整的句子。' },
      { id:'sat05', dim:'writing', lesson:'Modifier', difficulty:2, q:'修饰语错位 (dangling modifier) 的修正?', options:['删除修饰语','放在被修饰词旁','换字体','分两句'], answer:1, solution:'修饰语紧贴所修饰对象。' },
      { id:'sat06', dim:'math_no', lesson:'Linear', difficulty:1, q:'若 3x + 5 = 20, x = ?', options:['3','4','5','6'], answer:2, solution:'3x = 15, x = 5。' },
      { id:'sat07', dim:'math_no', lesson:'System', difficulty:2, q:'若 x+y=10, x-y=2, 则 x = ?', options:['4','5','6','8'], answer:2, solution:'相加 2x=12, x=6。' },
      { id:'sat08', dim:'math_no', lesson:'Quadratic', difficulty:2, q:'x² - 5x + 6 = 0 的解?', options:['1, 6','2, 3','-2, -3','0, 5'], answer:1, solution:'因式分解 (x-2)(x-3)=0。' },
      { id:'sat09', dim:'math_yes', lesson:'Stats', difficulty:2, q:'5 个数平均数是 10, 加入 16 后新平均?', options:['11','12','13','14'], answer:0, solution:'总和 = 50+16=66, 平均 66/6 = 11。' },
      { id:'sat10', dim:'math_yes', lesson:'Geometry', difficulty:2, q:'半径为 5 的圆面积?', options:['10π','15π','20π','25π'], answer:3, solution:'A = πr² = 25π。' },
      { id:'sat11', dim:'vocab', lesson:'Tone Words', difficulty:2, q:'"meticulous" 意思?', options:['careless','very careful','angry','quick'], answer:1, solution:'meticulous = 一丝不苟的。' },
      { id:'sat12', dim:'speed', lesson:'Reading Pace', difficulty:1, q:'SAT Reading 每篇推荐用时?', options:['8 分钟','13 分钟','20 分钟','25 分钟'], answer:1, solution:'5 篇 65 分钟, 每篇约 13 分钟 (含答题)。' },
    ]
  },

  // ===== 贝赛思 6 子学科 (parentId='basis') =====
  {
    id: 'basis-math', parentId:'basis', name: 'BASIS 数学', shortName: '数学', icon: '📐',
    color: '#00d4ff', gradient: 'linear-gradient(135deg,#00d4ff,#7c4dff)', tag: '贝赛思',
    textbook: { title: 'BASIS Math · K-12 Curriculum', author: 'BASIS Independent', grade: 'G7-G12', lessons: 50 },
    DIMS: [
      { key:'algebra',  name:'代数', icon:'🔢', color:'#00d4aa' },
      { key:'geometry', name:'几何', icon:'📐', color:'#7c4dff' },
      { key:'calc',     name:'微积分', icon:'∫', color:'#00d4ff' },
      { key:'stats',    name:'统计', icon:'📊', color:'#ffd700' },
      { key:'trig',     name:'三角', icon:'📏', color:'#ff9500' },
      { key:'logic',    name:'数理逻辑', icon:'🧠', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'bm01', dim:'algebra', lesson:'一元一次', difficulty:1, q:'2x + 7 = 19, x = ?', options:['5','6','7','12'], answer:1, solution:'2x = 12, x = 6。' },
      { id:'bm02', dim:'algebra', lesson:'指数函数', difficulty:2, q:'2³ × 2⁵ = ?', options:['2⁸','2¹⁵','4⁸','8⁵'], answer:0, solution:'同底数幂相乘指数相加: 2^(3+5) = 2⁸。' },
      { id:'bm03', dim:'geometry', lesson:'三角形', difficulty:1, q:'三角形内角和?', options:['90°','180°','270°','360°'], answer:1, solution:'欧氏几何中三角形内角和为 180°。' },
      { id:'bm04', dim:'geometry', lesson:'勾股定理', difficulty:1, q:'直角边 3、4, 斜边?', options:['5','6','7','25'], answer:0, solution:'3² + 4² = 5²。' },
      { id:'bm05', dim:'calc', lesson:'极限', difficulty:2, q:'lim(x→0) (sin x)/x = ?', options:['0','1','∞','不存在'], answer:1, solution:'经典极限, 等于 1。' },
      { id:'bm06', dim:'calc', lesson:'导数', difficulty:2, q:'d/dx (x³) = ?', options:['x²','2x²','3x²','3x'], answer:2, solution:'幂函数求导: nx^(n-1)。' },
      { id:'bm07', dim:'stats', lesson:'均值', difficulty:1, q:'[2, 4, 6, 8] 的均值?', options:['4','5','6','20'], answer:1, solution:'20/4 = 5。' },
      { id:'bm08', dim:'stats', lesson:'概率', difficulty:2, q:'掷两骰子, 和为 7 的概率?', options:['1/6','1/12','1/36','6/36'], answer:0, solution:'共 6 种组合 / 36 总数 = 1/6。' },
      { id:'bm09', dim:'trig', lesson:'sin', difficulty:1, q:'sin 30° = ?', options:['1/2','√2/2','√3/2','1'], answer:0, solution:'30° 对边 1, 斜边 2 → 1/2。' },
      { id:'bm10', dim:'trig', lesson:'恒等式', difficulty:2, q:'sin²θ + cos²θ = ?', options:['0','1','tan θ','2'], answer:1, solution:'毕达哥拉斯三角恒等式。' },
      { id:'bm11', dim:'logic', lesson:'命题', difficulty:2, q:'"若 A 则 B" 的逆否命题是?', options:['若 B 则 A','若非 A 则非 B','若非 B 则非 A','与原命题相同'], answer:2, solution:'逆否命题与原命题等价。' },
      { id:'bm12', dim:'logic', lesson:'集合', difficulty:1, q:'A={1,2,3}, B={2,3,4}, A∩B = ?', options:['{1}','{2,3}','{1,2,3,4}','空集'], answer:1, solution:'交集是共同元素。' },
    ]
  },
  {
    id: 'basis-physics', parentId:'basis', name: 'BASIS 物理', shortName: '物理', icon: '⚛',
    color: '#00d4aa', gradient: 'linear-gradient(135deg,#00d4aa,#00d4ff)', tag: '贝赛思',
    textbook: { title: 'BASIS Physics · Honors', author: 'BASIS Independent', grade: 'G9-G12', lessons: 48 },
    DIMS: [
      { key:'mech',  name:'力学',   icon:'⚙', color:'#00d4aa' },
      { key:'em',    name:'电磁学', icon:'⚡', color:'#7c4dff' },
      { key:'wave',  name:'波动',   icon:'〰', color:'#00d4ff' },
      { key:'therm', name:'热学',   icon:'🔥', color:'#ffd700' },
      { key:'mod',   name:'近代物理', icon:'⚛', color:'#ff9500' },
      { key:'lab',   name:'实验',   icon:'🔬', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'bp01', dim:'mech', lesson:'牛顿第二定律', difficulty:1, q:'F = ma, 1kg 物体加速度 5m/s², 力是?', options:['1N','5N','10N','25N'], answer:1, solution:'F = ma = 1×5 = 5N。' },
      { id:'bp02', dim:'mech', lesson:'功能关系', difficulty:2, q:'高度 h, 自由下落到地面动能 = ?', options:['mgh','½mgh','2mgh','mh'], answer:0, solution:'重力做功 mgh 全部转为动能。' },
      { id:'bp03', dim:'em',   lesson:'欧姆定律', difficulty:1, q:'电压 12V, 电阻 4Ω, 电流?', options:['3A','4A','12A','48A'], answer:0, solution:'I = U/R = 12/4 = 3A。' },
      { id:'bp04', dim:'em',   lesson:'磁场', difficulty:2, q:'通电直导线周围磁场方向?', options:['平行电流','垂直电流, 同心圆','放射状','无方向'], answer:1, solution:'右手定则: 同心圆环绕导线。' },
      { id:'bp05', dim:'wave', lesson:'波速', difficulty:2, q:'v = fλ, 频率 100Hz 波长 3m 波速?', options:['33 m/s','100 m/s','300 m/s','3000 m/s'], answer:2, solution:'v = 100 × 3 = 300 m/s。' },
      { id:'bp06', dim:'wave', lesson:'干涉', difficulty:2, q:'双缝干涉条纹间距与什么成正比?', options:['缝间距','波长','光速','缝宽'], answer:1, solution:'Δy = λL/d, 与 λ 成正比。' },
      { id:'bp07', dim:'therm', lesson:'热平衡', difficulty:1, q:'热量从哪流向哪?', options:['低温→高温','高温→低温','无关温差','与压强相关'], answer:1, solution:'热力学第二定律。' },
      { id:'bp08', dim:'therm', lesson:'理想气体', difficulty:2, q:'pV = nRT, T 升高 V 不变, p 怎么变?', options:['下降','不变','上升','无规律'], answer:2, solution:'等容过程 p∝T。' },
      { id:'bp09', dim:'mod',  lesson:'光电效应', difficulty:2, q:'光电效应说明光具有?', options:['只有波动性','只有粒子性','波粒二象性','无性质'], answer:2, solution:'光电效应支持粒子说, 干涉支持波动说。' },
      { id:'bp10', dim:'mod',  lesson:'相对论', difficulty:3, q:'狭义相对论的两条基本假设之一?', options:['速度可超光速','光速在所有惯性系中相同','质量不变','时间绝对'], answer:1, solution:'光速不变原理。' },
      { id:'bp11', dim:'lab',  lesson:'误差分析', difficulty:2, q:'随机误差减小的方法?', options:['更换仪器','多次测量取平均','加大测量值','只测一次'], answer:1, solution:'多次测量取平均可减小随机误差。' },
      { id:'bp12', dim:'mech', lesson:'圆周运动', difficulty:2, q:'匀速圆周运动加速度方向?', options:['切线方向','指向圆心','背离圆心','无加速度'], answer:1, solution:'向心加速度 v²/r 指向圆心。' },
    ]
  },
  {
    id: 'basis-chemistry', parentId:'basis', name: 'BASIS 化学', shortName: '化学', icon: '⚗',
    color: '#ff6b6b', gradient: 'linear-gradient(135deg,#ff6b6b,#ff9500)', tag: '贝赛思',
    textbook: { title: 'BASIS Chemistry · Honors', author: 'BASIS Independent', grade: 'G9-G12', lessons: 44 },
    DIMS: [
      { key:'atom',     name:'原子结构', icon:'⚛', color:'#00d4aa' },
      { key:'bond',     name:'化学键',   icon:'🔗', color:'#7c4dff' },
      { key:'reaction', name:'反应方程', icon:'⚗', color:'#00d4ff' },
      { key:'organic',  name:'有机化学', icon:'🌿', color:'#ffd700' },
      { key:'thermo',   name:'热化学',   icon:'🔥', color:'#ff9500' },
      { key:'lab',      name:'实验',     icon:'🧪', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'bc01', dim:'atom', lesson:'电子排布', difficulty:1, q:'氧 (O) 的电子总数?', options:['6','7','8','16'], answer:2, solution:'O 原子序数 8 = 8 电子。' },
      { id:'bc02', dim:'atom', lesson:'同位素', difficulty:2, q:'同位素相同的是?', options:['中子数','质子数','电子排布','原子量'], answer:1, solution:'同位素 = 质子相同, 中子不同。' },
      { id:'bc03', dim:'bond', lesson:'共价键', difficulty:1, q:'H₂O 中 H-O 键是?', options:['离子键','共价键','金属键','氢键'], answer:1, solution:'非金属间形成共价键。' },
      { id:'bc04', dim:'bond', lesson:'极性', difficulty:2, q:'CO₂ 分子是?', options:['极性分子','非极性分子','离子分子','无法判断'], answer:1, solution:'CO₂ 直线对称, 极性抵消。' },
      { id:'bc05', dim:'reaction', lesson:'配平', difficulty:2, q:'H₂ + O₂ → H₂O, 配平 H₂ 系数?', options:['1','2','3','4'], answer:1, solution:'2H₂ + O₂ → 2H₂O。' },
      { id:'bc06', dim:'reaction', lesson:'摩尔', difficulty:2, q:'2 mol NaCl 质量? (Mr=58.5)', options:['58.5g','117g','29.25g','100g'], answer:1, solution:'m = n×Mr = 2×58.5 = 117g。' },
      { id:'bc07', dim:'organic', lesson:'烷烃', difficulty:1, q:'CH₄ 是?', options:['甲烷','乙烷','丙烷','丁烷'], answer:0, solution:'CnH(2n+2), n=1 → 甲烷。' },
      { id:'bc08', dim:'organic', lesson:'官能团', difficulty:2, q:'-COOH 是什么官能团?', options:['醛基','醇基','羧基','酯基'], answer:2, solution:'羧基 = 羰基 + 羟基。' },
      { id:'bc09', dim:'thermo', lesson:'放热反应', difficulty:2, q:'ΔH < 0 表示?', options:['吸热','放热','无反应','可逆'], answer:1, solution:'ΔH 负 = 放出热量。' },
      { id:'bc10', dim:'thermo', lesson:'熵', difficulty:3, q:'冰融化时熵变 ΔS?', options:['<0','=0','>0','无法判断'], answer:2, solution:'固→液无序度增, 熵增。' },
      { id:'bc11', dim:'lab', lesson:'安全', difficulty:1, q:'稀释浓硫酸时正确做法?', options:['水加入酸','酸缓慢加入水','两者同时倒','无所谓'], answer:1, solution:'酸入水, 沿器壁缓慢搅拌。' },
      { id:'bc12', dim:'reaction', lesson:'酸碱', difficulty:2, q:'pH = 3 的溶液是?', options:['强碱','弱碱','酸性','中性'], answer:2, solution:'pH < 7 酸性, 3 接近强酸。' },
    ]
  },
  {
    id: 'basis-biology', parentId:'basis', name: 'BASIS 生物', shortName: '生物', icon: '🧬',
    color: '#00d4aa', gradient: 'linear-gradient(135deg,#00d4aa,#43e97b)', tag: '贝赛思',
    textbook: { title: 'BASIS Biology · Honors', author: 'BASIS Independent', grade: 'G9-G12', lessons: 42 },
    DIMS: [
      { key:'cell',    name:'细胞',   icon:'🦠', color:'#00d4aa' },
      { key:'gene',    name:'遗传',   icon:'🧬', color:'#7c4dff' },
      { key:'evo',     name:'进化',   icon:'🐢', color:'#ffd700' },
      { key:'eco',     name:'生态',   icon:'🌳', color:'#43e97b' },
      { key:'physio',  name:'生理',   icon:'❤', color:'#ff6b6b' },
      { key:'lab',     name:'实验',   icon:'🔬', color:'#ff9500' },
    ],
    QUESTION_BANK: [
      { id:'bb01', dim:'cell', lesson:'原核 vs 真核', difficulty:1, q:'细菌属于?', options:['真核','原核','病毒','非生物'], answer:1, solution:'细菌无核膜, 属原核生物。' },
      { id:'bb02', dim:'cell', lesson:'细胞器', difficulty:2, q:'蛋白质合成场所?', options:['细胞核','线粒体','核糖体','溶酶体'], answer:2, solution:'核糖体是蛋白质工厂。' },
      { id:'bb03', dim:'gene', lesson:'DNA 双螺旋', difficulty:1, q:'DNA 中与 A 配对的碱基?', options:['G','C','T','U'], answer:2, solution:'DNA 中 A-T, G-C; RNA 中 A-U。' },
      { id:'bb04', dim:'gene', lesson:'孟德尔', difficulty:2, q:'Aa × Aa 后代隐性纯合 (aa) 概率?', options:['0','25%','50%','75%'], answer:1, solution:'1:2:1, aa 占 1/4。' },
      { id:'bb05', dim:'evo', lesson:'自然选择', difficulty:2, q:'达尔文进化论核心是?', options:['用进废退','自然选择','突变即进化','基因漂变'], answer:1, solution:'适者生存, 不适者被淘汰。' },
      { id:'bb06', dim:'evo', lesson:'同源结构', difficulty:2, q:'鲸鳍和人手是?', options:['同功','同源','无关','复制'], answer:1, solution:'同源 = 结构相似来源相同。' },
      { id:'bb07', dim:'eco', lesson:'食物链', difficulty:1, q:'生产者通常是?', options:['食肉动物','食草动物','植物','分解者'], answer:2, solution:'植物固定太阳能, 是生产者。' },
      { id:'bb08', dim:'eco', lesson:'能量流动', difficulty:2, q:'食物链能量传递效率约?', options:['1%','10%','50%','100%'], answer:1, solution:'生态金字塔每级约 10%。' },
      { id:'bb09', dim:'physio', lesson:'血液循环', difficulty:2, q:'肺循环血液回到?', options:['右心房','右心室','左心房','左心室'], answer:2, solution:'肺静脉 → 左心房。' },
      { id:'bb10', dim:'physio', lesson:'神经', difficulty:2, q:'神经冲动传导方向?', options:['双向','只能树突→轴突','只能轴突→树突','无方向'], answer:1, solution:'兴奋只能从树突到轴突单向。' },
      { id:'bb11', dim:'lab', lesson:'显微镜', difficulty:1, q:'低倍换高倍后视野?', options:['变亮','变暗','不变','颜色变'], answer:1, solution:'放大倍数高 → 视野范围小, 亮度降低。' },
      { id:'bb12', dim:'gene', lesson:'PCR', difficulty:3, q:'PCR 关键步骤的高温阶段是?', options:['退火','延伸','变性','连接'], answer:2, solution:'95℃ 变性 → 55℃ 退火 → 72℃ 延伸。' },
    ]
  },
  {
    id: 'basis-english', parentId:'basis', name: 'BASIS 英语', shortName: '英语', icon: '📖',
    color: '#7c4dff', gradient: 'linear-gradient(135deg,#7c4dff,#ff6b9d)', tag: '贝赛思',
    textbook: { title: 'BASIS English · Literature', author: 'BASIS Independent', grade: 'G7-G12', lessons: 40 },
    DIMS: [
      { key:'lit',      name:'文学分析', icon:'📚', color:'#7c4dff' },
      { key:'grammar',  name:'语法',     icon:'🔤', color:'#00d4aa' },
      { key:'vocab',    name:'词汇',     icon:'📖', color:'#ffd700' },
      { key:'essay',    name:'写作',     icon:'✍',  color:'#00d4ff' },
      { key:'reading',  name:'阅读',     icon:'👁', color:'#ff9500' },
      { key:'speak',    name:'演讲',     icon:'🎤', color:'#ff6b6b' },
    ],
    QUESTION_BANK: [
      { id:'be01', dim:'lit', lesson:'Shakespeare', difficulty:2, q:'"To be or not to be" 出自?', options:['Macbeth','Hamlet','King Lear','Othello'], answer:1, solution:'Hamlet 经典独白。' },
      { id:'be02', dim:'lit', lesson:'Metaphor', difficulty:2, q:'"Life is a journey" 是?', options:['Simile','Metaphor','Hyperbole','Irony'], answer:1, solution:'无 like/as 的直接比喻 = metaphor。' },
      { id:'be03', dim:'grammar', lesson:'Tense', difficulty:1, q:'"I ___ to school yesterday."', options:['go','went','have gone','going'], answer:1, solution:'yesterday 用过去时 went。' },
      { id:'be04', dim:'grammar', lesson:'Subjunctive', difficulty:3, q:'"I wish I ___ taller."', options:['am','was','were','will be'], answer:2, solution:'wish 后虚拟语气用 were。' },
      { id:'be05', dim:'vocab', lesson:'Roots', difficulty:2, q:'"bio-" 在 biology, biography 中表示?', options:['water','life','book','study'], answer:1, solution:'希腊词根 bio = life。' },
      { id:'be06', dim:'vocab', lesson:'Synonym', difficulty:2, q:'"ephemeral" 最接近?', options:['eternal','short-lived','important','obvious'], answer:1, solution:'ephemeral = 短暂的, 转瞬即逝。' },
      { id:'be07', dim:'essay', lesson:'Thesis', difficulty:2, q:'议论文中 thesis statement 位置?', options:['不需要','引言段末尾','结论段','全文最长一段'], answer:1, solution:'thesis 通常放在引言段末。' },
      { id:'be08', dim:'essay', lesson:'Cohesion', difficulty:2, q:'段落间过渡推荐用?', options:['And','In addition / However / Therefore','But','Maybe'], answer:1, solution:'学术过渡词更正式准确。' },
      { id:'be09', dim:'reading', lesson:'Inference', difficulty:2, q:'Inference 题答案要?', options:['原文直接抄','基于文本推论','凭感觉','看作者性别'], answer:1, solution:'必须有原文证据支撑。' },
      { id:'be10', dim:'reading', lesson:'Tone', difficulty:2, q:'"sardonic" 描述什么语气?', options:['热情','嘲讽','悲伤','客观'], answer:1, solution:'sardonic = 嘲讽的, 挖苦的。' },
      { id:'be11', dim:'speak', lesson:'Public Speaking', difficulty:1, q:'演讲开头最有效的方式?', options:['报姓名','故事/反问/数据','背诵讲稿','沉默 30 秒'], answer:1, solution:'引人入胜的开头三件套。' },
      { id:'be12', dim:'grammar', lesson:'Parallel', difficulty:2, q:'"She likes singing, dancing, and ___."', options:['to swim','swim','swimming','swam'], answer:2, solution:'平行结构都用 -ing。' },
    ]
  },
  {
    id: 'basis-history', parentId:'basis', name: 'BASIS 历史', shortName: '历史', icon: '🏛',
    color: '#ffd700', gradient: 'linear-gradient(135deg,#ffd700,#ff9500)', tag: '贝赛思',
    textbook: { title: 'BASIS World History · AP-Level', author: 'BASIS Independent', grade: 'G8-G12', lessons: 38 },
    DIMS: [
      { key:'ancient',  name:'古代史', icon:'🏛', color:'#ffd700' },
      { key:'modern',   name:'近现代', icon:'⚔', color:'#7c4dff' },
      { key:'world',    name:'世界史', icon:'🌍', color:'#00d4aa' },
      { key:'china',    name:'中国史', icon:'🇨🇳', color:'#ff6b6b' },
      { key:'source',   name:'史料分析', icon:'📜', color:'#00d4ff' },
      { key:'thesis',   name:'论述',   icon:'📝', color:'#ff9500' },
    ],
    QUESTION_BANK: [
      { id:'bh01', dim:'ancient', lesson:'罗马', difficulty:1, q:'罗马帝国分裂时间?', options:['公元 1 世纪','公元 395 年','公元 476 年','公元 1453 年'], answer:1, solution:'395 年狄奥多西分东西; 476 年西罗马灭亡。' },
      { id:'bh02', dim:'ancient', lesson:'希腊', difficulty:1, q:'雅典民主创始时期?', options:['公元前 7 世纪','公元前 5 世纪','公元前 3 世纪','公元 1 世纪'], answer:1, solution:'公元前 5 世纪伯里克利时代。' },
      { id:'bh03', dim:'modern', lesson:'工业革命', difficulty:1, q:'第一次工业革命发源地?', options:['德国','法国','英国','美国'], answer:2, solution:'18 世纪后期英国, 蒸汽机引领。' },
      { id:'bh04', dim:'modern', lesson:'一战', difficulty:2, q:'一战导火索?', options:['珍珠港','萨拉热窝事件','凡尔登战役','9·11'], answer:1, solution:'1914 年 6 月斐迪南大公遇刺。' },
      { id:'bh05', dim:'world', lesson:'冷战', difficulty:2, q:'冷战开始标志?', options:['丘吉尔铁幕演说','古巴危机','柏林墙建立','北约成立'], answer:0, solution:'1946 年 3 月富尔顿演说。' },
      { id:'bh06', dim:'world', lesson:'文艺复兴', difficulty:2, q:'文艺复兴最早发源地?', options:['英国伦敦','意大利佛罗伦萨','法国巴黎','德国柏林'], answer:1, solution:'14 世纪意大利佛罗伦萨美第奇家族赞助下兴起。' },
      { id:'bh07', dim:'china', lesson:'统一', difficulty:1, q:'中国第一个大一统王朝?', options:['夏','商','秦','汉'], answer:2, solution:'秦始皇公元前 221 年统一。' },
      { id:'bh08', dim:'china', lesson:'清朝', difficulty:2, q:'鸦片战争开始年份?', options:['1840','1894','1900','1911'], answer:0, solution:'第一次鸦片战争 1840-1842。' },
      { id:'bh09', dim:'source', lesson:'史料类型', difficulty:2, q:'考古挖出的青铜器是?', options:['一手史料','二手史料','口述史料','虚构史料'], answer:0, solution:'实物遗存为一手史料。' },
      { id:'bh10', dim:'source', lesson:'史料评估', difficulty:3, q:'评估史料可信度首要考虑?', options:['年代久远','作者立场/目的','字迹是否工整','是否为名人'], answer:1, solution:'作者立场决定史料偏向。' },
      { id:'bh11', dim:'thesis', lesson:'论述结构', difficulty:2, q:'历史 essay 应避免?', options:['引用日期','分段论证','只罗列事实不分析','使用过渡词'], answer:2, solution:'好的 essay 是 analysis 不是 narrative。' },
      { id:'bh12', dim:'modern', lesson:'冷战结束', difficulty:1, q:'苏联解体时间?', options:['1989','1991','1995','2000'], answer:1, solution:'1991 年 12 月 25 日。' },
    ]
  },
]

// 贝赛思组(顶层展示用)
const BASIS_GROUP = {
  id: 'basis', name: '贝赛思课程', shortName: '贝赛思', icon: '🏛',
  color: '#00d4aa', gradient: 'linear-gradient(135deg,#00d4aa,#00d4ff 50%,#7c4dff)',
  tag: '校本', isGroup: true,
  textbook: { title: 'BASIS Curriculum · 6 学科', author: 'BASIS Independent', grade: 'K-12', lessons: 300 }
}

// pickAdaptive: 按 mastery 加权抽取
function pickAdaptive(subject, masteryMap, count = 10) {
  const bank = subject.QUESTION_BANK || []
  const scored = bank.map(q => {
    const m = masteryMap[q.dim] != null ? masteryMap[q.dim] : 50
    const weight = (100 - m) + Math.random() * 5
    return { q, weight: Math.max(1, weight) }
  })
  scored.sort((a, b) => b.weight - a.weight)
  return scored.slice(0, count).map(s => s.q)
}

// 顶层 6 科目顺序: ielts, toefl, ap, alevel, basisGroup, sat
const TOP_IDS = ['ielts', 'toefl', 'ap', 'alevel', 'basis', 'sat']
const BASIS_CHILD_IDS = ['basis-math', 'basis-physics', 'basis-chemistry', 'basis-biology', 'basis-english', 'basis-history']

const ALL_MAP = {}
SUBJECTS_RAW.forEach(s => { ALL_MAP[s.id] = s })
ALL_MAP['basis'] = BASIS_GROUP

function getSubject(id) { return ALL_MAP[id] || ALL_MAP['sat'] }
function listTopSubjects() { return TOP_IDS.map(id => ALL_MAP[id]) }
function listBasisChildren() { return BASIS_CHILD_IDS.map(id => ALL_MAP[id]) }

window.Subjects = { getSubject, listTopSubjects, listBasisChildren, pickAdaptive, ALL_MAP, TOP_IDS, BASIS_CHILD_IDS }
})()
