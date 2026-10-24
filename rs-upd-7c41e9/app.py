# -*- coding: utf-8 -*-
"""简历快筛：本机小服务（只听 127.0.0.1:8830）。
把简历放进岗位文件夹（或拖进网页）→ 自动逐份读取 → 火山方舟（豆包）按岗位标准抽取信息、逐项打分 → 这里的代码按权重算总分和档位 → 排名、统计、导出 Excel。
- 文字版 PDF / Word / TXT / 网页直接取文字；扫描件和照片转成图片给模型看。
- 模型只给「每项几分 + 依据」和硬性条件是否满足；总分、档位、是否硬性不符都由代码按规则算，改了权重点「全部重算」即可。
- 不让模型依据性别、年龄、婚育、籍贯、民族、照片等打分，也不抽取这些信息。
- 简历原件和结果只存在本机（data/screener.db）；只有简历内容会发给火山方舟做分析。
用法：python app.py（或双击「开始简历快筛.bat」）。RS_HOME 可以把数据和简历目录换到别处（测试用），RS_PORT 换端口。"""
import os, io, re, sys, json, shutil, time, base64, csv, queue, sqlite3, hashlib, threading, traceback, webbrowser, subprocess, zipfile
import urllib.request, urllib.parse, urllib.error, html as htmllib
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

VERSION = '1.1.8'  # 每次发更新 +1（publish_update.py 会自动改）
UPD_URL = os.environ.get('RS_UPD_URL') or 'https://crayxus.com.au/rs-upd-7c41e9/'  # 升级文件放这里：version.json + app.py + web/index.html
FROZEN = getattr(sys, 'frozen', False)  # 打包成 exe 时：网页在包里，数据放 exe 旁边
ROOT = os.path.dirname(sys.executable) if FROZEN else os.path.dirname(os.path.abspath(__file__))
RES = getattr(sys, '_MEIPASS', ROOT)
HOME = os.environ.get('RS_HOME') or ROOT
DATA = os.path.join(HOME, 'data')
INBOX = os.path.join(HOME, '简历')
PORT = int(os.environ.get('RS_PORT') or 8830)
INDEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web', 'index.html')  # 升级后的网页跟着新 app.py 走
if not os.path.isfile(INDEX): INDEX = os.path.join(RES, 'web', 'index.html')
def idx():   # 每次请求时再判断：升级换目录的那几秒 app\web 可能不在，退回包里自带的网页，不报错
    return INDEX if os.path.isfile(INDEX) else os.path.join(RES, 'web', 'index.html')
EXTS = {'.pdf', '.docx', '.txt', '.md', '.html', '.htm', '.jpg', '.jpeg', '.png', '.webp', '.bmp'}
WORKERS = int(os.environ.get('RS_WORKERS') or 3)   # BOSS 初筛时开到 6，读得快些
os.makedirs(DATA, exist_ok=True)
os.makedirs(INBOX, exist_ok=True)
if sys.stdout is None or FROZEN:  # pythonw / exe 没有控制台：日志写到 data/app.log
    sys.stdout = sys.stderr = open(os.path.join(DATA, 'app.log'), 'a', encoding='utf-8', buffering=1)


def load_env():
    """先读本文件夹的 .env，没有的再从 cos-code/.env 补（只取用得到的几项）"""
    env = {}
    for p in (os.path.join(ROOT, '.env'), os.path.join(os.path.expanduser('~'), 'cos-code', '.env')):
        if not os.path.isfile(p): continue
        for l in io.open(p, encoding='utf-8').read().splitlines():
            m = re.match(r'\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$', l)
            if m and m.group(1) in ('DOUBAO_API_KEY', 'RS_MODEL', 'RS_TEXT_MODEL') and m.group(1) not in env:
                env[m.group(1)] = m.group(2).strip('"\'')
    return env


SETF = os.path.join(DATA, 'settings.json')


def load_set():
    try: return json.load(io.open(SETF, encoding='utf-8'))
    except Exception: return {}


ENV = load_env()
KEY = load_set().get('ark_key') or ENV.get('DOUBAO_API_KEY', '')
MODEL = os.environ.get('RS_MODEL') or ENV.get('RS_MODEL') or 'doubao-seed-2-0-lite-260428'   # 读图（扫描件、照片、BOSS 截图）
TEXT_MODEL = os.environ.get('RS_TEXT_MODEL') or ENV.get('RS_TEXT_MODEL') or 'deepseek-v4-pro-ga-260813'   # 10-21 用户：打分用火山方舟上的 DeepSeek（它不看图，图先由豆包转成文字）
ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # 火山在国内，不走本机代理
BJ = timezone(timedelta(hours=8))
now = lambda: datetime.now(BJ).strftime('%Y-%m-%d %H:%M:%S')

# ---------------- 数据库 ----------------
LOCK = threading.RLock()
con = sqlite3.connect(os.path.join(DATA, 'screener.db'), check_same_thread=False, timeout=30)   # 10-21：升级重启时旧进程可能还没退干净，等它让出库，不要直接报 database is locked
con.row_factory = sqlite3.Row
con.executescript('''
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, name TEXT, jd TEXT, must TEXT, plus TEXT, dims TEXT,
  folder TEXT, auto INTEGER DEFAULT 1, a INTEGER DEFAULT 80, b INTEGER DEFAULT 65, created TEXT);
CREATE TABLE IF NOT EXISTS resumes(id INTEGER PRIMARY KEY, job_id INTEGER, file TEXT, fname TEXT, sha1 TEXT,
  status TEXT, err TEXT DEFAULT '', text TEXT DEFAULT '', via TEXT DEFAULT '', pages INTEGER DEFAULT 0, data TEXT DEFAULT '',
  total INTEGER, tier TEXT DEFAULT '', hard INTEGER DEFAULT 0, unsure INTEGER DEFAULT 0,
  name TEXT DEFAULT '', phone TEXT DEFAULT '', email TEXT DEFAULT '', dup_of INTEGER,
  mark TEXT DEFAULT '', note TEXT DEFAULT '', created TEXT, scored_at TEXT, ms INTEGER, UNIQUE(job_id, sha1));
''')
con.executescript('''
CREATE TABLE IF NOT EXISTS interviews(id INTEGER PRIMARY KEY, job_id INTEGER, rid INTEGER UNIQUE, day TEXT, start TEXT, end TEXT,
  status TEXT DEFAULT '待发', msg TEXT DEFAULT '', note TEXT DEFAULT '', created TEXT, updated TEXT);
''')   # 10-22 面试排期：一人一条，day = YYYY-MM-DD，start/end = HH:MM
for t, c in (('jobs', 'sign TEXT DEFAULT ""'), ('resumes', 'contacted TEXT DEFAULT ""'), ('jobs', 'city TEXT DEFAULT ""'), ('jobs', 'addr TEXT DEFAULT ""'), ('jobs', 'sched TEXT DEFAULT ""')):  # 后加的列：老库补上
    if c.split()[0] not in [x[1] for x in con.execute(f'PRAGMA table_info({t})')]: con.execute(f'ALTER TABLE {t} ADD COLUMN {c}')


def rows(sql, args=()):
    with LOCK:
        return con.execute(sql, args).fetchall()


def one(sql, args=()):
    r = rows(sql, args)
    return r[0] if r else None


def run(sql, args=()):
    with LOCK:
        cur = con.execute(sql, args)
        con.commit()
        return cur.lastrowid


DEFAULT_DIMS = [
    {'key': 'skill', 'name': '岗位技能匹配', 'w': 35, 'desc': '简历里的技能、工具、技术栈和岗位要求的重合程度'},
    {'key': 'exp', 'name': '相关工作经验', 'w': 25, 'desc': '做过的工作和这个岗位有多相关、做了多久、承担什么角色'},
    {'key': 'proj', 'name': '项目与成果', 'w': 20, 'desc': '有没有能说明能力的具体项目、量化成果、作品、专利、获奖'},
    {'key': 'edu', 'name': '学历与专业', 'w': 10, 'desc': '学历层次和专业与岗位的相关程度'},
    {'key': 'stable', 'name': '稳定性与成长', 'w': 10, 'desc': '每段任职是否够长、职责是否逐步提升；频繁短期跳槽扣分'},
]


def job_dict(r):
    d = dict(r)
    for k in ('must', 'plus', 'dims'): d[k] = json.loads(d[k] or '[]')
    return d


def get_job(jid):
    r = one('SELECT * FROM jobs WHERE id=?', (jid,))
    return job_dict(r) if r else None


def safe_name(s):
    return re.sub(r'[\\/:*?"<>|\r\n\t]+', '_', s).strip(' .') or '岗位'


if not one('SELECT id FROM jobs'):  # 第一次打开：放一个示例岗位，照着改或删掉
    nm = '嵌入式软件工程师（示例）'
    run('INSERT INTO jobs(name,jd,must,plus,dims,folder,auto,a,b,created) VALUES(?,?,?,?,?,?,?,?,?,?)', (
        nm,
        '负责机器人 / AIoT 设备的嵌入式软件开发：MCU 驱动、通信协议、传感器接入和整机联调，配合硬件和算法同事把样机做出来。',
        json.dumps(['本科及以上，电子 / 计算机 / 自动化等相关专业', '2 年以上嵌入式 C/C++ 开发经验', '熟悉 ESP32 或 STM32 中至少一种 MCU'], ensure_ascii=False),
        json.dumps(['做过机器人或 AIoT 量产产品', '熟悉 FreeRTOS 或 Linux 驱动', '会 Python，或有大模型应用开发经验'], ensure_ascii=False),
        json.dumps(DEFAULT_DIMS, ensure_ascii=False), os.path.join(INBOX, safe_name(nm)), 1, 80, 65, now()))

# ---------------- 读简历 ----------------
def clean(t):
    t = t.replace('　', ' ').replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\n\s*\n+', '\n', t).strip()


def jpeg_of(page, maxw=1400, z=None):
    import fitz
    z = z or min(2.0, maxw / max(page.rect.width, 1))
    pix = page.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False)
    return base64.b64encode(pix.tobytes('jpeg', jpg_quality=82)).decode()


def extract(path):
    """返回 (文字, [图片 base64], 页数)。有文字就不给图片。"""
    ext = os.path.splitext(path)[1].lower()
    if ext == '.pdf':
        import fitz
        with fitz.open(path) as d:
            text = clean('\n'.join(p.get_text() for p in d))
            if len(re.sub(r'\s', '', text)) >= 80: return text, [], d.page_count
            return '', [jpeg_of(p) for p in list(d)[:6]], d.page_count  # 扫描件：前 6 页转图片（BOSS 在线简历截图一般 3–5 屏）
    if ext == '.docx':
        import docx
        dd = docx.Document(path)
        parts = [p.text for p in dd.paragraphs]
        for t in dd.tables:
            for row in t.rows:
                cells = []
                for c in row.cells:
                    if c.text.strip() and (not cells or cells[-1] != c.text.strip()): cells.append(c.text.strip())
                if cells: parts.append(' | '.join(cells))
        text = clean('\n'.join(parts))
        if len(re.sub(r'\s', '', text)) < 80:  # 文字都在文本框里：直接从 XML 里抠
            with zipfile.ZipFile(path) as z:
                x = z.read('word/document.xml').decode('utf-8', 'ignore')
            text = clean(htmllib.unescape(re.sub(r'<[^>]+>', '', re.sub(r'</w:p>', '\n', x))))
        return text, [], 1
    if ext in ('.txt', '.md'):
        raw = open(path, 'rb').read()
        for enc in ('utf-8-sig', 'gb18030'):
            try: return clean(raw.decode(enc)), [], 1
            except UnicodeDecodeError: pass
        return clean(raw.decode('utf-8', 'ignore')), [], 1
    if ext in ('.html', '.htm'):
        raw = open(path, 'rb').read().decode('utf-8', 'ignore')
        raw = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', '', raw)
        raw = re.sub(r'(?i)<br\s*/?>|</(p|div|tr|li|h\d)>', '\n', raw)
        return clean(htmllib.unescape(re.sub(r'<[^>]+>', ' ', raw))), [], 1
    if ext in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
        import fitz
        with fitz.open(path) as d:
            return '', [jpeg_of(d[0], 1600)], 1
    raise ValueError('不支持这种文件：' + ext + '（旧版 .doc 请另存为 .docx 或 PDF）')


# ---------------- 问模型 ----------------
SYS = '''你是严谨的招聘初筛助手，帮 HR 快速判断一份简历和岗位的匹配程度。
只根据简历原文判断，不猜测、不脑补；简历没写的内容一律视为「没有证据」。
不得依据性别、年龄、民族、籍贯、婚育、宗教、身体状况、照片外貌等与岗位无关的个人特征打分，也不要在输出里提这些信息。
每个评分维度 0-10 分：9-10 有明确且突出的证据完全满足；7-8 基本满足；4-6 部分相关；1-3 只有很弱的关联；0 完全没有证据。
只输出一个 JSON 对象，不要任何解释，也不要 Markdown 代码块。'''


def build_prompt(job):
    dims = job['dims']
    num = lambda xs: '\n'.join(f'{i + 1}. {x}' for i, x in enumerate(xs)) or '（无）'
    schema = {
        'name': '姓名，没写就空字符串', 'phone': '手机号', 'email': '邮箱', 'city': '现居或期望城市', 'expect_city': '期望工作城市（看「期望」那一栏，多个用、分隔；写了全国/不限就照写；看不到填空字符串）',
        'degree': '最高学历：博士/硕士/本科/大专/高中及以下/未知', 'school': '最高学历的学校', 'major': '专业',
        'grad_year': '最高学历毕业年份（数字，没有填 null）',
        'years': '全职工作年限（数字，可一位小数；实习不算，应届生填 0）',
        'current': {'company': '最近一段工作的公司', 'title': '职位'},
        'jobs': [{'company': '', 'title': '', 'from': 'YYYY-MM', 'to': 'YYYY-MM 或 至今'}],
        'skills': ['关键技能，最多 12 个'],
        'must': [{'item': '硬性条件原文', 'met': '是/否/不确定', 'evidence': '简历里的依据，40 字内'}],
        'plus': [{'item': '加分项原文', 'met': '是/否'}],
        'dims': {d['key']: {'score': '0-10 的整数', 'why': '打分依据，40 字内'} for d in dims},
        'highlights': ['亮点，最多 3 条'], 'risks': ['需要面试时核实的疑点，最多 3 条'],
        'summary': '一句话结论，60 字内',
    }
    return '\n\n'.join([
        f'【岗位】{job["name"]}',
        '【岗位描述】\n' + (job['jd'] or '（未填写）'),
        '【硬性条件】逐条判断，met 只能填 是 / 否 / 不确定；简历里完全没提到的填 不确定，明确不满足才填 否。\n' + num(job['must']),
        '【加分项】\n' + num(job['plus']),
        '【评分维度】每项 0-10 分\n' + '\n'.join(f'- {d["key"]}（{d["name"]}）：{d.get("desc") or ""}' for d in dims),
        '【输出 JSON 格式】\n' + json.dumps(schema, ensure_ascii=False, indent=1),
        f'jobs 按时间倒序，最多 6 段；must、plus 和上面的条目一一对应、顺序一致。今天是 {datetime.now(BJ):%Y-%m-%d}，「至今」按今天算年限。',
    ])


USE_LOCK = threading.Lock()


def add_usage(model, u):
    """10-21：记每天每个模型用了多少 token（火山返回的 usage），存 data/usage.json，左下角显示"""
    if not u: return
    d, f = datetime.now(BJ).strftime('%Y-%m-%d'), os.path.join(DATA, 'usage.json')
    with USE_LOCK:
        try: U = json.load(io.open(f, encoding='utf-8'))
        except Exception: U = {}
        m = U.setdefault(d, {}).setdefault(model, {'in': 0, 'out': 0, 'n': 0})
        m['in'] += int(u.get('prompt_tokens') or 0); m['out'] += int(u.get('completion_tokens') or 0); m['n'] += 1
        try: json.dump(U, io.open(f, 'w', encoding='utf-8'), ensure_ascii=False)
        except OSError: pass


def usage_summary():
    try: U = json.load(io.open(os.path.join(DATA, 'usage.json'), encoding='utf-8'))
    except Exception: return None
    tot = lambda ms: {'in': sum(m['in'] for m in ms), 'out': sum(m['out'] for m in ms), 'n': sum(m['n'] for m in ms)}
    today = U.get(datetime.now(BJ).strftime('%Y-%m-%d'), {})
    return {'today': tot(today.values()), 'all': tot([m for d in U.values() for m in d.values()]), 'since': min(U) if U else ''}


def ark(messages, model=None, max_tokens=3000):
    if not KEY: raise RuntimeError('没有火山方舟的 Key：点左下角「填 Key」')
    body = json.dumps({'model': model or TEXT_MODEL, 'messages': messages, 'temperature': 0.1, 'max_tokens': max_tokens,
                       'thinking': {'type': 'disabled'}}).encode()
    req = urllib.request.Request(ARK_URL, body, {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
    try:
        with OPENER.open(req, timeout=150) as r: j = json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'火山方舟返回 {e.code}：' + e.read().decode('utf-8', 'ignore')[:200])
    add_usage(model or TEXT_MODEL, j.get('usage'))
    return j['choices'][0]['message']['content'] or ''


def parse_json(s):
    s = re.sub(r'^```(?:json)?|```$', '', s.strip(), flags=re.M).strip()
    i, k = s.find('{'), s.rfind('}')
    if i < 0 or k < i: raise ValueError('no json')
    s = s[i:k + 1]
    try: return json.loads(s)
    except json.JSONDecodeError: pass
    # 10-21：DeepSeek 偶尔在字符串里写英文双引号（"why": "他说"很好""）、字符串里换行或多个尾逗号，整段就解析不了 → 修一下再解析
    out, ins, n = [], False, len(s)
    for x, ch in enumerate(s):
        if ch == '"' and (x == 0 or s[x - 1] != '\\'):
            if not ins: ins = True
            else:
                y = x + 1
                while y < n and s[y] in ' \t\r\n': y += 1
                if y >= n or s[y] in ',:}]': ins = False
                else: out.append('\\')   # 字符串中间的引号：转义
        elif ins and ch in '\r\n': out.append(' '); continue
        out.append(ch)
    fixed = re.sub(r',\s*([}\]])', r'\1', ''.join(out))
    try: return json.loads(fixed)
    except json.JSONDecodeError as e: raise ValueError(str(e))


TRANSCRIBE = ('把这些图片里的简历内容完整、按原顺序转写成纯文字：姓名、基本信息、期望（城市/职位/薪资）、每段工作经历（公司、职位、时间、做了什么）、'
              '项目经历、教育经历、技能、对方发来的话，都要写进去。不要总结、不要评价、不要漏掉数字；BOSS 直聘界面上的按钮文字跳过。')


def transcribe(imgs):
    """图 → 文字（豆包看图）。DeepSeek 不看图，扫描件 / 照片 / BOSS 截图先走这一步"""
    content = [{'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + b}} for b in imgs]
    content.append({'type': 'text', 'text': TRANSCRIBE})
    return ark([{'role': 'user', 'content': content}], model=MODEL, max_tokens=6000)


ECO_AT = 72   # 省钱模式下，豆包打到这个分以上的再交给 DeepSeek 精评（A 档 75 分，留点余量）


def eco_on():
    return load_set().get('eco', False)   # 10-21 用户看了账单（一天约 10 元）：「不要改动了」→ 默认关，打分照旧（豆包转文字 + DeepSeek）


def ask(job, text, imgs):
    """省钱模式：豆包一步打分（扫描件 / 截图直接看图，省掉转文字那一轮），≥ ECO_AT 分的再走精评；精评 = 豆包转文字 + DeepSeek 打分"""
    if eco_on():
        out = score_once(build_prompt(job), text, imgs, MODEL)
        try: total = compute(job, out)[0]
        except Exception: total = 0
        if (total or 0) < ECO_AT: out['_by'] = 'eco'; return out
        print(now(), f'豆包打了 {total} 分，交给 DeepSeek 精评', flush=True)
    out = ask_precise(job, text, imgs); out['_by'] = 'precise'; return out


def score_once(p, text, imgs, model):
    if text: content = p + '\n\n【简历原文】\n' + text[:14000]
    else:
        content = [{'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + b}} for b in imgs]
        content.append({'type': 'text', 'text': p + '\n\n【简历】见上面的图片（扫描件或照片），先认真读完再判断。'})
    last = ''
    for _ in range(2):
        last = ark([{'role': 'system', 'content': SYS}, {'role': 'user', 'content': content}], model=model, max_tokens=6000)
        try: return parse_json(last)
        except ValueError as e: print(now(), '回复解析不了（', e, '），原文：', last[:4000], flush=True)
    raise RuntimeError('模型回的不是 JSON：' + last[:100])


def ask_precise(job, text, imgs):
    p = build_prompt(job)
    if imgs:
        try: text = transcribe(imgs)
        except Exception as e:
            print(now(), '转文字失败，改成直接看图打分：', e, flush=True); text = ''
    if text:
        content, model = p + '\n\n【简历原文】\n' + text[:14000], TEXT_MODEL
    else:   # 转文字失败：退回豆包直接看图打分
        content = [{'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + b}} for b in imgs]
        content.append({'type': 'text', 'text': p + '\n\n【简历】见上面的图片（扫描件或照片），先认真读完再判断。'}); model = MODEL
    last = ''
    for _ in range(2):
        try: last = ark([{'role': 'system', 'content': SYS}, {'role': 'user', 'content': content}], model=model, max_tokens=6000)
        except RuntimeError as e:
            if model == MODEL: raise
            print(now(), 'DeepSeek 打分失败，这份改用豆包：', e, flush=True); model = MODEL; continue
        try: return parse_json(last)
        except ValueError as e: print(now(), '回复解析不了（', e, '），原文：', last[:4000], flush=True)
    raise RuntimeError('模型回的不是 JSON：' + last[:100])


def expect_city(img_b64):
    """BOSS 聊天窗口右上「期望」那一行 → 城市（豆包看图，一两秒）。读不出来返回空"""
    t = ark([{'role': 'user', 'content': [{'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + img_b64}},
             {'type': 'text', 'text': '图里「期望」后面写的工作城市是哪些？只回城市名，多个用、分隔；写了全国或不限就回 全国；看不到回 无'}]}],
            model=MODEL, max_tokens=30)
    return '' if '无' in t else t.strip()


# ---------------- 打分规则（代码算，不让模型算） ----------------
def clamp(v):
    try: return max(0, min(10, round(float(v))))
    except (TypeError, ValueError): return 0


def met_of(v, allow_unsure=True):
    s = str(v if v is not None else '').strip().lower()
    if s.startswith('是') or s in ('true', 'yes', 'y', '满足'): return '是'
    if s.startswith('否') or s in ('false', 'no', 'n', '不满足'): return '否'
    return '不确定' if allow_unsure else '否'


def compute(job, out):
    dims = job['dims']
    tw = sum(max(0.0, float(d.get('w') or 0)) for d in dims) or 1
    od = out.get('dims') if isinstance(out.get('dims'), dict) else {}
    s = 0.0
    for d in dims:
        v = od.get(d['key'])
        v = v if isinstance(v, dict) else {'score': v, 'why': ''}
        v['score'] = clamp(v.get('score'))
        od[d['key']] = v
        s += v['score'] * max(0.0, float(d.get('w') or 0))
    out['dims'] = od
    total = round(s / tw * 10)

    def align(items, got, unsure):
        got = got if isinstance(got, list) else []
        res = []
        for i, it in enumerate(items):
            g = got[i] if i < len(got) and isinstance(got[i], dict) else {}
            res.append({'item': it, 'met': met_of(g.get('met'), unsure), 'evidence': str(g.get('evidence') or '')[:80]})
        return res
    out['must'] = align(job['must'], out.get('must'), True)
    out['plus'] = align(job['plus'], out.get('plus'), False)
    # 10-21 用户：期望城市不在岗位城市（杭州）的打分压低，不浪费时间——最高只到 C 档（比 B 线低 1 分）
    city, ec = (job.get('city') or '').strip(), str(out.get('expect_city') or '').strip()
    if city and ec and city not in ec and not re.search(r'全国|不限|均可|都可|异地|远程', ec):
        total = min(total, int(job['b']) - 1)
        out['risks'] = ['期望城市是' + ec + '，不在' + city] + [x for x in (out.get('risks') or []) if city not in str(x)]
    hard = sum(m['met'] == '否' for m in out['must'])
    unsure = sum(m['met'] == '不确定' for m in out['must'])
    tier = 'X' if hard else 'A' if total >= job['a'] else 'B' if total >= job['b'] else 'C'
    return total, tier, hard, unsure


def norm_phone(p):
    d = re.sub(r'\D', '', p or '')
    return d[-11:] if len(d) >= 7 else ''


def mark_dup(job_id, rid, phone, email, name='', school=''):
    """同一岗位里手机号或邮箱相同 = 同一个人投了多份，后来的那份标成重复（统计里不算）。
    BOSS 截图没有手机号邮箱：姓名 + 学校都一样也算同一个人（10-21）"""
    ph, em = norm_phone(phone), (email or '').strip().lower()
    nm, sc = (name or '').strip(), re.sub(r'\s', '', school or '')
    run('UPDATE resumes SET dup_of=NULL WHERE id=?', (rid,))
    if not ph and not em and not (nm and sc): return
    for o in rows("SELECT id, phone, email, name, data FROM resumes WHERE job_id=? AND id<>? AND status='done' AND dup_of IS NULL", (job_id, rid)):
        osc = ''
        if nm and sc and (o['name'] or '').strip() == nm:
            try: osc = re.sub(r'\s', '', json.loads(o['data'] or '{}').get('school') or '')
            except Exception: osc = ''
        if (ph and norm_phone(o['phone']) == ph) or (em and (o['email'] or '').strip().lower() == em) or (osc and osc == sc):
            if o['id'] < rid: run('UPDATE resumes SET dup_of=? WHERE id=?', (o['id'], rid)); return
            run('UPDATE resumes SET dup_of=? WHERE id=?', (rid, o['id']))


# ---------------- 后台：逐份处理 + 自动翻阅文件夹 ----------------
Q = queue.Queue()


def process(rid):
    r = one('SELECT * FROM resumes WHERE id=?', (rid,))
    if not r or r['status'] != 'queued': return
    job = get_job(r['job_id'])
    if not job: return
    run("UPDATE resumes SET status='reading', err='' WHERE id=?", (rid,))
    t0 = time.time()
    try:
        if os.path.isfile(r['file']): text, imgs, pages = extract(r['file'])
        elif r['text']: text, imgs, pages = r['text'], [], r['pages']
        else: raise RuntimeError('原文件不见了：' + r['file'])
        if not text and not imgs: raise RuntimeError('读不到内容（空文件？）')
        out = ask(job, text, imgs)
        total, tier, hard, unsure = compute(job, out)
        run('''UPDATE resumes SET status='done', err='', text=?, via=?, pages=?, data=?, total=?, tier=?, hard=?, unsure=?,
               name=?, phone=?, email=?, scored_at=?, ms=? WHERE id=?''',
            (text, 'image' if imgs else 'text', pages, json.dumps(out, ensure_ascii=False), total, tier, hard, unsure,
             str(out.get('name') or '')[:40], str(out.get('phone') or '')[:40], str(out.get('email') or '')[:80],
             now(), int((time.time() - t0) * 1000), rid))
        mark_dup(r['job_id'], rid, out.get('phone'), out.get('email'), out.get('name'), out.get('school'))
        print(f'[{now()}] 读完 #{rid} {r["fname"]}：{total} 分 {tier}（{time.time() - t0:.1f}s）', flush=True)
    except Exception as e:
        run("UPDATE resumes SET status='error', err=? WHERE id=?", (('重试过：' if r['err'] else '') + str(e)[:280], rid))
        print(f'[{now()}] 出错 #{rid} {r["fname"]}：{e}', flush=True)


def worker():
    while True:
        rid = Q.get()
        try: process(rid)
        except Exception: traceback.print_exc()


def sha1_of(p):
    h = hashlib.sha1()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


SEEN = {}  # (路径, 修改时间, 大小) → 已经登记过，免得每轮都重新算哈希


def add_file(job_id, p):
    st = os.stat(p)
    k = (job_id, p, st.st_mtime, st.st_size)
    if k in SEEN: return None
    sha = sha1_of(p)
    with LOCK:
        if one('SELECT id FROM resumes WHERE job_id=? AND sha1=?', (job_id, sha)): SEEN[k] = 1; return None
        rid = run("INSERT INTO resumes(job_id,file,fname,sha1,status,created) VALUES(?,?,?,?, 'queued', ?)",
                  (job_id, p, os.path.basename(p), sha, now()))
    SEEN[k] = 1
    Q.put(rid)
    return rid


def scan(job):
    folder = job['folder']
    os.makedirs(folder, exist_ok=True)
    n = 0
    for d, _, fs in os.walk(folder):
        for f in sorted(fs):
            if f.startswith(('~$', '.')) or os.path.splitext(f)[1].lower() not in EXTS: continue
            try:
                if add_file(job['id'], os.path.join(d, f)): n += 1
            except OSError: pass  # 还在拷贝 / 被占用：下一轮再试
    return n


def auto_loop():
    while True:
        for r in rows('SELECT * FROM jobs WHERE auto=1'):
            try: scan(job_dict(r))
            except Exception: traceback.print_exc()
        try:   # 出错的（多半是网络抖或限流）自动再试一次；err 开头是「重试过」的不再试
            for r in rows("SELECT id FROM resumes WHERE status='error' AND err NOT LIKE '重试过%' AND err NOT LIKE '%Key%' LIMIT 20"):
                run("UPDATE resumes SET status='queued' WHERE id=?", (r['id'],)); Q.put(r['id'])
        except Exception: traceback.print_exc()
        time.sleep(15)


# ---------------- 网页接口 ----------------
def j_jobs(h, q, b):
    out = []
    for r in rows('SELECT * FROM jobs ORDER BY id'):
        d = job_dict(r)
        c = one('''SELECT COUNT(*) n, SUM(status='done' AND dup_of IS NULL) done, SUM(status IN ('queued','reading')) busy,
                   SUM(tier='A' AND status='done' AND dup_of IS NULL) na, SUM(status='done' AND dup_of IS NOT NULL) dup, SUM(status='error') err FROM resumes WHERE job_id=?''', (r['id'],))
        d.update({k: c[k] or 0 for k in ('n', 'done', 'busy', 'na', 'dup', 'err')})
        try: d['files'] = sum(1 for _, _, fs in os.walk(d['folder']) for f in fs if not f.startswith(('~$', '.')) and os.path.splitext(f)[1].lower() in EXTS)
        except Exception: d['files'] = None
        out.append(d)
    return out


def j_save_job(h, q, b):
    name = (b.get('name') or '').strip()
    if not name: return {'error': '岗位名称不能空'}
    lines = lambda v: [x.strip(' -·•\t') for x in (v if isinstance(v, list) else str(v or '').splitlines()) if x.strip(' -·•\t')]
    dims = []
    for i, d in enumerate(b.get('dims') or DEFAULT_DIMS):
        if not str(d.get('name') or '').strip(): continue
        key = re.sub(r'[^a-z0-9_]', '', str(d.get('key') or '').lower()) or f'd{i + 1}'
        while any(x['key'] == key for x in dims): key += 'x'
        dims.append({'key': key, 'name': str(d['name']).strip()[:20], 'w': max(0, min(100, float(d.get('w') or 0))), 'desc': str(d.get('desc') or '').strip()[:120]})
    if not dims or not sum(d['w'] for d in dims): return {'error': '至少要有一个权重大于 0 的评分维度'}
    folder = (b.get('folder') or '').strip() or os.path.join(INBOX, safe_name(name))
    a, bb = int(b.get('a') or 80), int(b.get('b') or 65)
    if not (0 < bb < a <= 100): return {'error': 'A 线要高于 B 线（0-100）'}
    vals = (name[:40], str(b.get('jd') or '')[:4000], json.dumps(lines(b.get('must'))[:10], ensure_ascii=False),
            json.dumps(lines(b.get('plus'))[:10], ensure_ascii=False), json.dumps(dims, ensure_ascii=False), folder, 1 if b.get('auto', True) else 0, a, bb, str(b.get('sign') or '').strip()[:60], str(b.get('city') or '').strip()[:20])
    if b.get('id'):
        run('UPDATE jobs SET name=?,jd=?,must=?,plus=?,dims=?,folder=?,auto=?,a=?,b=?,sign=?,city=? WHERE id=?', vals + (int(b['id']),))
        jid = int(b['id'])
    else:
        jid = run('INSERT INTO jobs(name,jd,must,plus,dims,folder,auto,a,b,sign,city,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', vals + (now(),))
    if 'addr' in b: run('UPDATE jobs SET addr=? WHERE id=?', (str(b.get('addr') or '').strip()[:120], jid))   # 10-22 面试地点
    os.makedirs(folder, exist_ok=True)
    return {'ok': True, 'id': jid}


def j_del_job(h, q, b):
    jid = int(b.get('id') or 0)
    run('DELETE FROM resumes WHERE job_id=?', (jid,))
    run('DELETE FROM jobs WHERE id=?', (jid,))
    return {'ok': True}  # 只删记录，文件夹里的简历原件不动


def j_auto(h, q, b):
    run('UPDATE jobs SET auto=? WHERE id=?', (1 if b.get('on') else 0, int(b.get('id') or 0)))
    return {'ok': True}


def j_scan(h, q, b):
    job = get_job(int(b.get('job') or 0))
    if not job: return {'error': '没有这个岗位'}
    return {'ok': True, 'added': scan(job)}


def j_resumes(h, q, b):
    out = []
    for r in rows('''SELECT id,fname,status,err,via,pages,data,total,tier,hard,unsure,name,phone,email,dup_of,mark,note,contacted,created,scored_at,ms
                     FROM resumes WHERE job_id=? ORDER BY id''', (int(q.get('job') or 0),)):
        d = dict(r)
        d['data'] = json.loads(d['data']) if d['data'] else None
        out.append(d)
    return out


EIT_API = os.environ.get('RS_EIT_API') or 'https://api.crayxus.com.au'   # EI TOKEN 后端：把面试名单推到 Finance 人事页（10-24）


def save_set(d):
    tmp = SETF + '.tmp'
    io.open(tmp, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1)); os.replace(tmp, SETF)


def eit_call(path, body, token=''):
    hd = {'Content-Type': 'application/json'}
    if token: hd['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(EIT_API + path, data=json.dumps(body, ensure_ascii=False).encode('utf-8'), headers=hd, method='POST')
    try:
        with OPENER.open(req, timeout=30) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {'error': 'HTTP %s' % e.code}


def j_eit_sync(h, q, b):
    """把要约面试的人（同 /api/invite）推到 EI TOKEN Finance 人事页的「待安排」。第一次要 EI TOKEN 账号密码登录，之后只存登录令牌（不存密码），令牌失效再问一次"""
    st = load_set(); tok = st.get('eit_token') or ''
    email, pw = str(b.get('email') or '').strip(), str(b.get('password') or '')
    if email and pw:
        code, j = eit_call('/api/auth/login', {'email': email, 'password': pw})
        if code != 200 or not j.get('token'): return {'error': j.get('error') or 'EI TOKEN 登录失败'}
        tok = j['token']; st['eit_token'] = tok; st['eit_email'] = j.get('email') or email; save_set(st)
    if not tok: return {'error': 'need_login'}
    items = [{'nm': c['nm'], 'job': c['job'], 'rid': c['rid'], 'tier': c['tier'], 'src': 'boss'} for c in j_invite(h, q, {})['items']]
    if not items: return {'ok': True, 'imported': 0, 'total': 0, 'email': st.get('eit_email', '')}
    code, j = eit_call('/api/fin/hr', {'op': 'import', 'items': items}, tok)
    if code == 401: st.pop('eit_token', None); save_set(st); return {'error': 'need_login'}
    if code != 200 or not j.get('ok'): return {'error': j.get('error') or ('同步失败 %s' % code)}
    return {'ok': True, 'imported': (j.get('value') or {}).get('imported', 0), 'total': len(items), 'email': st.get('eit_email', '')}


def j_mark_tier(h, q, b):
    """把一个岗位里某档（默认 A 档）、没标淘汰也没标面试的人全部标成「面试」—— 10-24 用户：推荐的人一键标面试，Finance 人事页导入后再逐个联系确认"""
    jid, tier = int(b.get('job') or 0), str(b.get('tier') or 'A')[:1]
    r = run("UPDATE resumes SET mark='面试' WHERE job_id=? AND status='done' AND dup_of IS NULL AND tier=? AND mark NOT IN ('淘汰','面试')", (jid, tier))
    n = one("SELECT COUNT(*) n FROM resumes WHERE job_id=? AND status='done' AND dup_of IS NULL AND mark='面试'", (jid,))['n']
    return {'ok': True, 'total': n}


def j_mark(h, q, b):
    run('UPDATE resumes SET mark=?, note=? WHERE id=?', (str(b.get('mark') or '')[:8], str(b.get('note') or '')[:1000], int(b.get('id') or 0)))
    return {'ok': True}


DRAFT = {
    'invite': '邀请对方来面试：先用一句话点出简历里一个具体打动我们的地方（真实、具体，别夸大），再说明岗位、请对方回复方便的面试时间（给两三个时间段让对方选，或者请对方提供），最后留联系方式。',
    'ask': '对方简历里有几条硬性条件没写清楚，礼貌地请对方补充说明（逐条列出要问的问题，问得具体、好回答），说明这是为了更好地安排下一步。',
    'reject': '礼貌婉拒：感谢对方投递，说明这次岗位要求和对方经历不太匹配，祝好，并表示以后有合适机会会再联系。不要列具体扣分原因，不要提分数。',
}


def j_draft(h, q, b):
    r = one('SELECT * FROM resumes WHERE id=?', (int(b.get('id') or 0),))
    kind = b.get('kind') if b.get('kind') in DRAFT else 'invite'
    if not r or r['status'] != 'done': return {'error': '这份简历还没读完'}
    job = get_job(r['job_id'])
    d = json.loads(r['data'] or '{}')
    info = {'姓名': r['name'], '最近': d.get('current'), '学历': [d.get('degree'), d.get('school'), d.get('major')],
            '亮点': d.get('highlights'), '技能': (d.get('skills') or [])[:8]}
    if kind == 'ask': info['没写清楚的硬性条件'] = [m['item'] for m in d.get('must') or [] if m.get('met') == '不确定']
    p = '\n'.join([
        f'帮招聘方给候选人写一条消息。岗位：{job["name"]}。岗位描述：{(job["jd"] or "")[:300]}',
        '候选人信息：' + json.dumps(info, ensure_ascii=False),
        '这条消息要：' + DRAFT[kind],
        f'落款：{job.get("sign") or "（落款留空，让 HR 自己填）"}',
        '要求：中文，口吻真诚、专业、简洁，正文 150 字以内；称呼用「姓名 + 您好」（没有姓名就用「您好」）；',
        '不要提评分、AI、筛选系统；不要提及年龄、性别、婚育等个人特征；不要编造候选人简历里没有的经历，也不要编造薪资、地址、面试时间等招聘方没给的信息（需要时用【】留空让 HR 填）。',
        '只输出 JSON：{"subject": "邮件标题，20 字内", "text": "消息正文"}',
    ])
    out = parse_json(ark([{'role': 'user', 'content': p}]))
    return {'ok': True, 'subject': str(out.get('subject') or '')[:60], 'text': str(out.get('text') or '')[:1500]}


def j_contacted(h, q, b):
    how = str(b.get('how') or '')[:20]
    run('UPDATE resumes SET contacted=? WHERE id=?', (f'{now()[5:16]} · {how}' if how else '', int(b.get('id') or 0)))
    return {'ok': True}


def j_rescore(h, q, b):
    ids = [int(x) for x in (b.get('ids') or [])]
    if ids: rs = [r['id'] for r in rows(f"SELECT id FROM resumes WHERE id IN ({','.join('?' * len(ids))}) AND status<>'reading'", ids)]
    else: rs = [r['id'] for r in rows("SELECT id FROM resumes WHERE job_id=? AND status<>'reading'", (int(b.get('job') or 0),))]
    for rid in rs:
        run("UPDATE resumes SET status='queued' WHERE id=?", (rid,))
        Q.put(rid)
    return {'ok': True, 'n': len(rs)}


def j_remove(h, q, b):
    run('DELETE FROM resumes WHERE id=?', (int(b.get('id') or 0),))
    return {'ok': True}  # 只删记录；文件还在文件夹里的话，要改名或移走，不然会被重新读到


def j_status(h, q, b):
    busy = one("SELECT COUNT(*) n FROM resumes WHERE status IN ('queued','reading')")['n']
    return {'ok': True, 'model': MODEL + ' 读图 · ' + TEXT_MODEL + ' 打分', 'key': bool(KEY), 'busy': busy, 'version': VERSION, 'frozen': bool(FROZEN),
            'upd': UPD if UPD.get('ver') and vt(UPD['ver']) > vt(VERSION) else None, 'usage': usage_summary(), 'eco': eco_on()}


# ---------------- 升级：只换 app.py 和网页，库不动 ----------------
UPD = {}
vt = lambda v: tuple(int(x) for x in re.findall(r'\d+', str(v)))


def check_update():
    global UPD
    try:
        with OPENER.open(UPD_URL + 'version.json?t=' + str(int(time.time())), timeout=20) as r: UPD = json.load(r)
    except Exception as e:
        print(now(), '检查更新失败', e, flush=True)


def upd_loop():
    while True:
        check_update()
        time.sleep(6 * 3600)


def j_check_update(h, q, b):
    check_update()
    return j_status(h, q, b)


def j_update(h, q, b):
    """下载新版到 exe 旁边的 app 目录（先下到 app.new，sha256 全对才替换），然后自己重启"""
    if not FROZEN: return {'ok': False, 'error': '开发版不自动升级，直接改代码'}
    check_update()
    if not UPD.get('ver') or vt(UPD['ver']) <= vt(VERSION): return {'ok': False, 'error': '已经是最新版'}
    new, cur = os.path.join(ROOT, 'app.new'), os.path.join(ROOT, 'app')
    shutil.rmtree(new, ignore_errors=True)
    for rel, sha in UPD['files'].items():
        with OPENER.open(UPD_URL + rel + '?v=' + UPD['ver'], timeout=60) as r: data = r.read()
        if hashlib.sha256(data).hexdigest() != sha: raise RuntimeError(f'{rel} 下载不完整，稍后再试')
        dst = os.path.join(new, *rel.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'wb').write(data)
    old = os.path.join(ROOT, 'app.old'); shutil.rmtree(old, ignore_errors=True)
    for i in range(6):   # 10-24：先把旧 app 挪成 app.old、再把 app.new 改名成 app，中间没有「app 目录不存在」的空档（之前先删后换，升级那几秒页面会报找不到 index.html）
        try:
            if os.path.isdir(cur): os.replace(cur, old)
            os.replace(new, cur); break
        except OSError: time.sleep(1)
    else:
        shutil.copytree(new, cur, dirs_exist_ok=True); shutil.rmtree(new, ignore_errors=True)
    shutil.rmtree(old, ignore_errors=True)
    print(now(), '已升级到', UPD['ver'], '正在重启', flush=True)
    threading.Thread(target=restart, daemon=True).start()
    return {'ok': True, 'ver': UPD['ver']}


def restart():
    time.sleep(0.8)  # 先把这次请求的回复发出去；新进程会等旧进程让出端口（main 里重试 15 秒）
    try: p = subprocess.Popen([sys.executable, '--no-browser'], cwd=ROOT, creationflags=0x00000008 | 0x00000200,  # DETACHED | NEW_PROCESS_GROUP
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True,
                     env=dict(os.environ, PYINSTALLER_RESET_ENVIRONMENT='1'))  # 让新进程当成全新启动，而不是旧 exe 的子进程
    except Exception: traceback.print_exc()
    else: print(now(), '新进程', p.pid, sys.executable, flush=True)
    os._exit(0)


def j_key(h, q, b):
    """在网页里填火山方舟 Key：先试调一次，通了才存到 data/settings.json（只存在这台电脑）"""
    global KEY
    k, old = (b.get('key') or '').strip(), KEY
    if not k: return {'ok': False, 'error': 'Key 是空的'}
    KEY = k
    try: ark([{'role': 'user', 'content': '只回复 ok'}])
    except Exception as e:
        KEY = old
        return {'ok': False, 'error': str(e)[:200]}
    st = load_set(); st['ark_key'] = k
    io.open(SETF, 'w', encoding='utf-8').write(json.dumps(st, ensure_ascii=False))
    for r in rows("SELECT id FROM resumes WHERE status='error' AND err LIKE '%Key%'"):  # 之前因为没 Key 失败的，重新排队
        run("UPDATE resumes SET status='queued', err='' WHERE id=?", (r['id'],))
        Q.put(r['id'])
    return {'ok': True}


def j_eco(h, q, b):
    st = load_set(); st['eco'] = bool(b.get('on'))
    io.open(SETF, 'w', encoding='utf-8').write(json.dumps(st, ensure_ascii=False))
    return {'ok': True, 'eco': st['eco']}


def j_open_folder(h, q, b):
    job = get_job(int(b.get('job') or 0))
    if job:
        os.makedirs(job['folder'], exist_ok=True)
        os.startfile(job['folder'])
    return {'ok': True}


def j_pick_folder(h, q, b):
    ps = ("Add-Type -AssemblyName System.Windows.Forms;$f=New-Object System.Windows.Forms.Form -Property @{TopMost=$true};"
          "$d=New-Object System.Windows.Forms.FolderBrowserDialog;$d.Description='选择放简历的文件夹';"
          "if($d.ShowDialog($f) -eq 'OK'){[Console]::OutputEncoding=[Text.Encoding]::UTF8;$d.SelectedPath}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps], capture_output=True, timeout=600)
    return {'ok': True, 'path': r.stdout.decode('utf-8', 'ignore').strip()}


def j_upload(h, q, b):
    job = get_job(int(q.get('job') or 0))
    if not job: return {'error': '没有这个岗位'}
    name = os.path.basename(q.get('name') or 'resume')
    if os.path.splitext(name)[1].lower() not in EXTS: return {'error': '不支持：' + name}
    os.makedirs(job['folder'], exist_ok=True)
    base, ext = os.path.splitext(safe_name(name))
    p, i = os.path.join(job['folder'], base + ext), 1
    while os.path.exists(p):
        i += 1
        p = os.path.join(job['folder'], f'{base}({i}){ext}')
    with open(p, 'wb') as f: f.write(b)
    rid = add_file(job['id'], p)
    if rid is None: os.remove(p)  # 同一份文件已经读过：不留副本
    return {'ok': True, 'id': rid, 'dup': rid is None}


TIER = {'A': 'A 推荐面试', 'B': 'B 可考虑', 'C': 'C 不合适', 'X': '硬性不符'}


def export_csv(h, q):
    job = get_job(int(q.get('job') or 0))
    if not job: return h.send(404, {'error': '没有这个岗位'})
    rs = [r for r in rows("SELECT * FROM resumes WHERE job_id=? AND status='done'", (job['id'],))]
    order = {'A': 0, 'B': 1, 'C': 2, 'X': 3}
    rs.sort(key=lambda r: (r['dup_of'] is not None, order.get(r['tier'], 4), -(r['total'] or 0)))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['排名', '姓名', '总分', '档位', '硬性条件'] + [d['name'] for d in job['dims']] +
               ['学历', '学校', '专业', '工作年限', '当前公司', '当前职位', '电话', '邮箱', '城市', '关键技能', '亮点', '待核实', '一句话结论', '标记', '备注', '联系', '文件', '重复'])
    for i, r in enumerate(rs, 1):
        d = json.loads(r['data'] or '{}')
        cur = d.get('current') or {}
        must = '全部满足' if not r['hard'] and not r['unsure'] else f"不满足 {r['hard']} 条" if r['hard'] else f"{r['unsure']} 条待确认"
        w.writerow([i, r['name'], r['total'], TIER.get(r['tier'], ''), must] +
                   [(d.get('dims') or {}).get(x['key'], {}).get('score', '') for x in job['dims']] +
                   [d.get('degree', ''), d.get('school', ''), d.get('major', ''), d.get('years', ''), cur.get('company', ''), cur.get('title', ''),
                    r['phone'], r['email'], d.get('city', ''), '、'.join(map(str, d.get('skills') or [])),
                    '；'.join(map(str, d.get('highlights') or [])), '；'.join(map(str, d.get('risks') or [])), d.get('summary', ''),
                    r['mark'], r['note'], r['contacted'] or '', r['fname'], f"和 #{r['dup_of']} 重复" if r['dup_of'] else ''])
    fn = urllib.parse.quote(f'{job["name"]}-简历评分-{datetime.now(BJ):%m%d}.csv')
    h.send(200, '﻿' + buf.getvalue(), 'text/csv; charset=utf-8', {'Content-Disposition': f"attachment; filename*=UTF-8''{fn}"})


def serve_file(h, q):
    r = one('SELECT file, fname FROM resumes WHERE id=?', (int(q.get('id') or 0),))
    if not r or not os.path.isfile(r['file']): return h.send(404, '原文件不见了', 'text/plain; charset=utf-8')
    ext = os.path.splitext(r['file'])[1].lower()
    ct = {'.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.bmp': 'image/bmp',
          '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.html': 'text/plain; charset=utf-8', '.htm': 'text/plain; charset=utf-8',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}.get(ext, 'application/octet-stream')
    disp = 'attachment' if ext == '.docx' else 'inline'
    h.send(200, open(r['file'], 'rb').read(), ct, {'Content-Disposition': f"{disp}; filename*=UTF-8''{urllib.parse.quote(r['fname'])}"})



# ---------------- BOSS 直聘初筛（10-21）：后台点开候选人、截简历，丢进岗位文件夹，照常打分 ----------------
BOSS = {'r': None, 't': None}


def boss_mod():
    """boss/reader.py：优先用 app.py 旁边的（升级下来的新版），没有就用包里带的"""
    import importlib.util
    for base in (os.path.dirname(os.path.abspath(__file__)), RES, ROOT):
        f = os.path.join(base, 'boss', 'reader.py')
        if os.path.isfile(f):
            if os.path.join(base, 'boss') not in sys.path: sys.path.insert(0, os.path.join(base, 'boss'))
            spec = importlib.util.spec_from_file_location('boss_reader', f)
            m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
            return m
    raise RuntimeError('找不到 boss/reader.py')


def j_boss_start(h, q, b):
    if BOSS['r'] and BOSS['r'].st.get('running'): return {'ok': False, 'error': '已经在跑了'}
    job = get_job(int(b.get('job') or 0))
    if not job: return {'ok': False, 'error': '先选一个岗位'}
    if not KEY: return {'ok': False, 'error': '没有火山方舟 Key'}
    city = (job.get('city') or '').strip()

    def city_ok(img):   # 期望城市不含岗位城市的，不点开在线简历（省时间），只存摘要
        if not city: return True
        buf = io.BytesIO(); img.convert('RGB').save(buf, 'JPEG', quality=85)
        ec = expect_city(base64.b64encode(buf.getvalue()).decode())
        return (not ec) or city in ec or bool(re.search(r'全国|不限|均可|异地|远程', ec))
    m = boss_mod()
    r = m.Reader(job['folder'], data_dir=DATA, delay=float(b.get('delay') or 2.5), cv=b.get('cv', True) is not False,
                 city_ok=city_ok, max_n=int(b.get('max') or 100000), log=lambda t: print(t, flush=True))
    r.st['job'] = job['id']
    if not job.get('auto'): run('UPDATE jobs SET auto=1 WHERE id=?', (job['id'],))   # 截图进文件夹要自动翻阅才会被读
    BOSS['r'] = r; BOSS['t'] = threading.Thread(target=r.run, daemon=True); BOSS['t'].start()
    return {'ok': True}


def j_boss_stop(h, q, b):
    if BOSS['r']: BOSS['r'].stop_ev.set()
    return {'ok': True}


def j_boss_summary(h, q, b):
    """小窗：已扫多少人、平均 / 最高 / 最低分、平均每人用时、总工作时间"""
    r = BOSS['r']; st = dict(r.st) if r else {}
    jid = int(q.get('job') or 0) or st.get('job') or (one("SELECT job_id FROM resumes WHERE fname LIKE 'boss_%' ORDER BY id DESC LIMIT 1") or {}).get('job_id') or 0
    job = get_job(jid) or {}
    rs = rows("SELECT name, total, tier, data FROM resumes WHERE job_id=? AND status='done' AND dup_of IS NULL", (jid,))
    sc = [x['total'] for x in rs if x['total'] is not None]
    try: people = len([1 for k in json.load(io.open(os.path.join(DATA, 'boss_seen.json'), encoding='utf-8')) if k.startswith('p:')])
    except Exception: people = 0
    try: d = json.load(io.open(os.path.join(DATA, 'boss_stats.json'), encoding='utf-8'))
    except Exception: d = {'secs': 0, 'done': 0}
    secs = d.get('secs', 0) + ((time.time() - r._mark) if r and st.get('running') else 0)
    tiers = {t: sum(1 for x in rs if x['tier'] == t) for t in 'ABCX'}
    def line(x):   # 排名里每人一行小字：现任 · 年限 · 期望城市
        try: d = json.loads(x['data'] or '{}')
        except Exception: d = {}
        cur = d.get('current') or {}
        bits = [cur.get('title') or '', f"{d['years']} 年" if d.get('years') not in (None, '') else '', d.get('expect_city') or '']
        return ' · '.join(b for b in bits if b)
    top = [{'name': x['name'] or '', 'total': x['total'], 'tier': x['tier'], 'line': line(x)}
           for x in sorted(rs, key=lambda x: -(x['total'] or 0))[:max(1, min(30, int(q.get('top') or 5)))]]
    return {'ok': True, 'job': job.get('name', ''), 'running': bool(st.get('running')), 'people': people, 'scored': len(sc),
            'avg': round(sum(sc) / len(sc)) if sc else None, 'max': max(sc) if sc else None, 'min': min(sc) if sc else None,
            'secs': round(secs), 'per': (secs / d['done']) if d.get('done') else None, 'tiers': tiers, 'top': top,
            'skipped_city': st.get('skipped_city', 0), 'msg': st.get('msg', ''), 'error': st.get('error', '')}


def j_boss_status(h, q, b):
    r = BOSS['r']
    return {'ok': True, **(dict(r.st) if r else {'running': False})}


# ---------------- 面试排期（10-22）：把入围的人按分数排进时间格，一人一条邀请消息；发消息仍由 HR 在 BOSS / 微信里自己点 ----------------
WEEK = '一二三四五六日'
SCHED_DEF = {'start': '', 'from': '10:00', 'to': '18:00', 'dur': 45, 'gap': 15, 'pool': 'A', 'weekend': 0, 'lunch': ''}
ST_INT = ['待发', '已发', '已确认', '改期', '取消']


def next_monday():
    d = datetime.now(BJ).date()
    d += timedelta(days=(7 - d.weekday()) % 7 or 7)
    return d.isoformat()


def hm(t):
    h, m = str(t).split(':'); return int(h) * 60 + int(m)


def mh(n): return f'{n // 60:02d}:{n % 60:02d}'


def day_slots(cfg):
    """一天里的时间格：from 起，每格 dur 分钟，格与格之间歇 gap；午休「12:00-13:00」这种时段跳过"""
    out, t, end = [], hm(cfg['from']), hm(cfg['to'])
    lunch = None
    if cfg.get('lunch') and '-' in cfg['lunch']:
        a, b = cfg['lunch'].split('-'); lunch = (hm(a.strip()), hm(b.strip()))
    while t + cfg['dur'] <= end:
        if lunch and t < lunch[1] and t + cfg['dur'] > lunch[0]: t = lunch[1]; continue
        out.append((mh(t), mh(t + cfg['dur']))); t += cfg['dur'] + cfg['gap']
    return out


def sched_cfg(job):
    cfg = dict(SCHED_DEF)
    try: cfg.update({k: v for k, v in json.loads(job.get('sched') or '{}').items() if k in cfg})
    except Exception: pass
    if not cfg['start']: cfg['start'] = next_monday()
    return cfg


def day_txt(d):
    x = datetime.strptime(d, '%Y-%m-%d'); return f'{x.month} 月 {x.day} 日（周{WEEK[x.weekday()]}）'


def invite_msg(job, r, it):
    """邀请消息：模板直接生成（不走模型，不编内容）；简历里有亮点就点一句"""
    d = json.loads(r['data'] or '{}'); hl = (d.get('highlights') or [''])[0]
    name = (r['name'] or '').strip()
    lines = [f'{name}您好，' if name else '您好，',
             f'我是{job.get("sign") or "【公司 · 招聘负责人】"}。看过您投递「{job["name"]}」的简历' + (f'，「{str(hl)[:40]}」这一点很打动我们' if hl else '') + '，想邀请您来参加线下面试：',
             f'时间：{day_txt(it["day"])} {it["start"]}–{it["end"]}（约 {job.get("_dur", 45)} 分钟）', f'地点：{job.get("addr") or "【面试地点】"}',
             '方便的话请回复「确认」；如果这个时间不方便，请告诉我您本周或下周方便的时段，我再为您调整。期待见面！']
    return '\n'.join(lines)


def sched_rows(jid):
    out = []
    for r in rows('''SELECT i.*, r.name, r.phone, r.email, r.total, r.tier, r.data, r.mark, r.contacted FROM interviews i JOIN resumes r ON r.id=i.rid
                     WHERE i.job_id=? ORDER BY i.day, i.start''', (jid,)):
        d = dict(r); dd = json.loads(d.pop('data') or '{}'); cur = dd.get('current') or {}
        d['edu'] = ' · '.join(x for x in [dd.get('degree'), dd.get('school')] if x); d['cur'] = ' · '.join(x for x in [cur.get('company'), cur.get('title')] if x)
        d['dayTxt'] = day_txt(d['day']); out.append(d)
    return out


def sched_pool(job, cfg):
    """谁该进排期：读完、不是重复、没被标淘汰、还没排过；pool = A（A 档）/ mark（标了「面试」）/ both（二者都算）；按总分从高到低"""
    rs = rows("SELECT id, total, tier, mark FROM resumes WHERE job_id=? AND status='done' AND dup_of IS NULL AND id NOT IN (SELECT rid FROM interviews) ORDER BY total DESC, id", (job['id'],))
    pick = {'A': lambda r: r['tier'] == 'A', 'mark': lambda r: r['mark'] == '面试', 'both': lambda r: r['tier'] == 'A' or r['mark'] == '面试'}[cfg.get('pool') if cfg.get('pool') in ('A', 'mark', 'both') else 'A']
    return [r for r in rs if r['mark'] != '淘汰' and pick(r)]


def j_sched(h, q, b):
    job = get_job(int(q.get('job') or 0))
    if not job: return {'error': '没有这个岗位'}
    cfg = sched_cfg(job)
    return {'ok': True, 'cfg': cfg, 'addr': job.get('addr') or '', 'sign': job.get('sign') or '', 'rows': sched_rows(job['id']), 'pool': len(sched_pool(job, cfg)), 'slotsPerDay': len(day_slots(cfg))}


def j_sched_build(h, q, b):
    """生成 / 续排：已排好的人不动（保住已发出去的时间），没排的人按分数填进后面的空格"""
    job = get_job(int(b.get('job') or 0))
    if not job: return {'error': '没有这个岗位'}
    cfg = sched_cfg(job)
    for k in ('start', 'from', 'to', 'pool', 'lunch'):
        if k in b: cfg[k] = str(b[k] or '').strip()
    for k in ('dur', 'gap', 'weekend'):
        if k in b: cfg[k] = int(b[k] or 0)
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', cfg['start']): cfg['start'] = next_monday()
    if not (15 <= cfg['dur'] <= 180): return {'error': '每人时长要在 15–180 分钟'}
    if not (0 <= cfg['gap'] <= 120): return {'error': '间隔要在 0–120 分钟'}
    try:
        if hm(cfg['from']) + cfg['dur'] > hm(cfg['to']): return {'error': '一天的时间段放不下一场面试'}
    except Exception: return {'error': '时间要写成 10:00 这样'}
    run('UPDATE jobs SET sched=?, addr=? WHERE id=?', (json.dumps(cfg, ensure_ascii=False), str(b.get('addr', job.get('addr')) or '').strip()[:120], job['id']))
    job = get_job(job['id']); job['_dur'] = cfg['dur']
    slots = day_slots(cfg)
    if not slots: return {'error': '一天的时间段放不下一场面试'}
    taken = {(r['day'], r['start']) for r in rows('SELECT day, start FROM interviews WHERE job_id=? AND status!=?', (job['id'], '取消'))}
    pool = sched_pool(job, cfg)
    day, i, n, guard = datetime.strptime(cfg['start'], '%Y-%m-%d').date(), 0, 0, 0
    while i < len(pool) and guard < 400:
        guard += 1
        if day.weekday() >= 5 and not cfg['weekend']: day += timedelta(days=1); continue
        for st, en in slots:
            if i >= len(pool): break
            if (day.isoformat(), st) in taken: continue
            r = one('SELECT * FROM resumes WHERE id=?', (pool[i]['id'],))
            it = {'day': day.isoformat(), 'start': st, 'end': en}
            run('INSERT INTO interviews(job_id,rid,day,start,end,status,msg,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',
                (job['id'], r['id'], it['day'], st, en, '待发', invite_msg(job, r, it), now(), now()))
            taken.add((it['day'], st)); i += 1; n += 1
        day += timedelta(days=1)
    return {'ok': True, 'added': n, **j_sched(h, {'job': job['id']}, b)}


def j_sched_set(h, q, b):
    """改一条：状态 / 备注 / 消息 / 改到别的时间（改时间会重写消息里的时间）"""
    it = one('SELECT * FROM interviews WHERE id=?', (int(b.get('id') or 0),))
    if not it: return {'error': '没有这条排期'}
    job = get_job(it['job_id']); cfg = sched_cfg(job); job['_dur'] = cfg['dur']
    if 'status' in b and b['status'] in ST_INT: run('UPDATE interviews SET status=?, updated=? WHERE id=?', (b['status'], now(), it['id']))
    if 'note' in b: run('UPDATE interviews SET note=? WHERE id=?', (str(b['note'] or '')[:300], it['id']))
    if 'msg' in b: run('UPDATE interviews SET msg=? WHERE id=?', (str(b['msg'] or '')[:1500], it['id']))
    if b.get('day') or b.get('start'):
        day = str(b.get('day') or it['day']); st = str(b.get('start') or it['start'])
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', day) or not re.match(r'^\d{1,2}:\d{2}$', st): return {'error': '日期或时间格式不对'}
        st = mh(hm(st)); en = mh(hm(st) + cfg['dur'])
        clash = one('SELECT i.id, r.name FROM interviews i JOIN resumes r ON r.id=i.rid WHERE i.job_id=? AND i.day=? AND i.start=? AND i.id!=? AND i.status!=?', (it['job_id'], day, st, it['id'], '取消'))
        if clash: return {'error': f'这个时间已经排了 {clash["name"] or "别人"}'}
        r = one('SELECT * FROM resumes WHERE id=?', (it['rid'],))
        new_it = {'day': day, 'start': st, 'end': en}
        run('UPDATE interviews SET day=?, start=?, end=?, msg=?, status=?, updated=? WHERE id=?', (day, st, en, invite_msg(job, r, new_it), '改期' if it['status'] in ('已发', '已确认', '改期') else it['status'], now(), it['id']))
    return {'ok': True, **j_sched(h, {'job': it['job_id']}, b)}


def j_sched_del(h, q, b):
    it = one('SELECT job_id FROM interviews WHERE id=?', (int(b.get('id') or 0),))
    if it: run('DELETE FROM interviews WHERE id=?', (int(b['id']),))
    return {'ok': True, **(j_sched(h, {'job': it['job_id']}, b) if it else {})}


def j_sched_clear(h, q, b):
    """清掉还没发出去的（待发 / 取消），已发、已确认、改期的保留"""
    jid = int(b.get('job') or 0)
    run("DELETE FROM interviews WHERE job_id=? AND status IN ('待发','取消')", (jid,))
    return {'ok': True, **j_sched(h, {'job': jid}, b)}


def export_sched(h, q):
    job = get_job(int(q.get('job') or 0))
    if not job: return h.send(404, {'error': '没有这个岗位'})
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(['日期', '星期', '开始', '结束', '候选人', '电话', '邮箱', '总分', '档位', '学历 · 学校', '最近', '状态', '备注', '邀请消息'])
    for r in sched_rows(job['id']):
        x = datetime.strptime(r['day'], '%Y-%m-%d')
        w.writerow([r['day'], '周' + WEEK[x.weekday()], r['start'], r['end'], r['name'], r['phone'], r['email'], r['total'], TIER.get(r['tier'], ''), r['edu'], r['cur'], r['status'], r['note'], r['msg']])
    fn = urllib.parse.quote(f'{job["name"]}-面试排期-{datetime.now(BJ):%m%d}.csv')
    h.send(200, '﻿' + buf.getvalue(), 'text/csv; charset=utf-8', {'Content-Disposition': f"attachment; filename*=UTF-8''{fn}"})


CORS_OK = ('https://eitoken.ai', 'https://www.eitoken.ai', 'http://127.0.0.1:8799', 'http://localhost:8799', 'http://127.0.0.1:8813')   # Finance 人事页从这些来源读名单
def cors_headers(h):
    o = h.headers.get('Origin') or ''
    if o not in CORS_OK: return {}
    return {'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin'}


def j_invite(h, q, b):
    """给 EI TOKEN Finance「人事」页：要约面试的人（标了「面试」、或已经进了排期且没取消），只给姓名 / 岗位 / 档位，不给联系方式"""
    out, seen = [], set()
    for r in rows("""SELECT r.id rid, r.name nm, r.tier, r.total, r.mark, j.name job FROM resumes r JOIN jobs j ON j.id=r.job_id
                     WHERE r.status='done' AND r.dup_of IS NULL AND r.mark!='淘汰' AND (r.mark='面试' OR r.id IN (SELECT rid FROM interviews WHERE status!='取消'))
                     ORDER BY r.total DESC, r.id"""):
        if r['rid'] in seen or not (r['nm'] or '').strip(): continue
        seen.add(r['rid']); out.append({'rid': r['rid'], 'nm': r['nm'].strip(), 'job': r['job'] or '', 'tier': r['tier'] or '', 'total': r['total'] or 0})
    return {'ok': True, 'items': out}


GET = {'/api/invite': j_invite, '/api/jobs': j_jobs, '/api/resumes': j_resumes, '/api/status': j_status, '/api/sched': j_sched, '/api/boss/status': j_boss_status, '/api/boss/summary': j_boss_summary}
POST = {'/api/eit-sync': j_eit_sync, '/api/mark-tier': j_mark_tier, '/api/boss/start': j_boss_start, '/api/boss/stop': j_boss_stop, '/api/job': j_save_job, '/api/job/del': j_del_job, '/api/job/auto': j_auto, '/api/scan': j_scan, '/api/mark': j_mark,
        '/api/rescore': j_rescore, '/api/remove': j_remove, '/api/open-folder': j_open_folder, '/api/pick-folder': j_pick_folder,
        '/api/draft': j_draft, '/api/contacted': j_contacted, '/api/sched/build': j_sched_build, '/api/sched/set': j_sched_set, '/api/sched/del': j_sched_del, '/api/sched/clear': j_sched_clear, '/api/key': j_key, '/api/eco': j_eco, '/api/update': j_update, '/api/check-update': j_check_update}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str): body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self): self.route('GET')

    def do_OPTIONS(self):   # 跨域预检：只放行 /api/invite
        u = urllib.parse.urlparse(self.path)
        if u.path != '/api/invite': return self.send(404, {'error': 'not found'})
        self.send(204, b'', extra=cors_headers(self))

    def do_POST(self): self.route('POST')

    def route(self, m):
        # 只认本机地址；POST 必须带 X-RS 头（别的网站发不出这种请求，防止网页偷偷改数据）
        if (self.headers.get('Host') or '').split(':')[0] not in ('127.0.0.1', 'localhost'): return self.send(403, {'error': 'forbidden'})
        if m == 'POST' and self.headers.get('X-RS') != '1': return self.send(403, {'error': 'forbidden'})
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if m == 'GET' and u.path in ('/', '/index.html'): return self.send(200, open(idx(), 'rb').read(), 'text/html; charset=utf-8')
            if m == 'GET' and u.path == '/mini': return self.send(200, open(os.path.join(os.path.dirname(idx()), 'mini.html'), 'rb').read(), 'text/html; charset=utf-8')   # 小窗
            if m == 'GET' and u.path == '/api/export': return export_csv(self, q)
            if m == 'GET' and u.path == '/api/sched/export': return export_sched(self, q)
            if m == 'GET' and u.path == '/api/file': return serve_file(self, q)
            if m == 'GET' and u.path == '/api/invite': return self.send(200, j_invite(self, q, {}), extra=cors_headers(self))
            n = int(self.headers.get('Content-Length') or 0)
            raw = self.rfile.read(n) if n else b''
            if m == 'POST' and u.path == '/api/upload': return self.send(200, j_upload(self, q, raw))
            fn = (GET if m == 'GET' else POST).get(u.path)
            if not fn: return self.send(404, {'error': 'not found'})
            b = json.loads(raw.decode('utf-8')) if raw else {}
            self.send(200, fn(self, q, b))
        except Exception as e:
            traceback.print_exc()
            self.send(500, {'error': str(e)[:300]})


def remap_paths():
    """整个文件夹搬到别的电脑 / 别的位置后（10-21）：岗位文件夹、简历文件的路径如果不在本程序目录下，
    而本程序的「简历/岗位名」里有同名的，就改指向这里（旧位置在不在都改：不然会往旧电脑的路径里写）"""
    home = os.path.normcase(os.path.abspath(HOME))
    inside = lambda f: os.path.normcase(os.path.abspath(f)).startswith(home + os.sep)
    for j in rows('SELECT id, folder FROM jobs'):
        f = j['folder'] or ''
        if not f or inside(f): continue
        nf = os.path.join(INBOX, os.path.basename(f.replace(chr(92), '/').rstrip('/')))
        if os.path.isdir(nf) or not os.path.isdir(f):
            os.makedirs(nf, exist_ok=True); run('UPDATE jobs SET folder=? WHERE id=?', (nf, j['id']))
    for r in rows('SELECT r.id, r.file, j.folder FROM resumes r JOIN jobs j ON j.id=r.job_id'):
        if r['file'] and not inside(r['file']):
            nf = os.path.join(r['folder'], os.path.basename(r['file'].replace(chr(92), '/')))
            if os.path.isfile(nf): run('UPDATE resumes SET file=? WHERE id=?', (nf, r['id']))


def main():
    global SRV
    url = f'http://127.0.0.1:{PORT}/'
    for i in range(30):  # 升级重启时旧进程可能还没让出端口，等一会
        try:
            SRV = ThreadingHTTPServer(('127.0.0.1', PORT), H)
            break
        except OSError:
            if '--no-browser' not in sys.argv: webbrowser.open(url); return  # 已经开着：直接打开网页
            time.sleep(0.5)
    else: return
    remap_paths()
    for r in rows("SELECT id FROM resumes WHERE status IN ('queued','reading') ORDER BY id"):  # 上次没读完的接着读
        run("UPDATE resumes SET status='queued' WHERE id=?", (r['id'],))
        Q.put(r['id'])
    for _ in range(WORKERS): threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=auto_loop, daemon=True).start()
    if FROZEN: threading.Thread(target=upd_loop, daemon=True).start()
    print(f'简历快筛 v{VERSION} 已启动：{url}  读图 {MODEL} · 打分 {TEXT_MODEL}  Key {"有" if KEY else "没有！"}  数据 {DATA}', flush=True)
    if '--no-browser' not in sys.argv: webbrowser.open(url)
    SRV.serve_forever()


if __name__ == '__main__':
    main()
