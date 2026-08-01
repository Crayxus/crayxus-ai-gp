# -*- coding: utf-8 -*-
"""生成泰国动物园二期【假山+绿化+房建】对外标准预报价书(含价格浮动区间机制)。
   数据源 D:\\card-battle-demo\\_data.json(成本价 _rate),投标价=成本×Factor-F。
   输出 -> C:\\Users\\Jayzee\\crayxus-ai-gp\\thaizoo-quote-9b2f4c7a.html"""
import json, re
from collections import defaultdict

SRC = r"D:\card-battle-demo\_data.json"
OUT = r"C:\Users\Jayzee\crayxus-ai-gp\thaizoo-quote-9b2f4c7a.html"
FF  = 1.1608          # 泰国政府工程综合系数(含管理/规费/利润/税)
CNY = 4.85; USD = 36  # 参考汇率

# 浮动假设:已核量(假山/绿化)−8%/+12%;粗估(房建)−12%/+20%
FL_BOQ = (0.08, 0.12)
FL_EST = (0.12, 0.20)

items = json.load(open(SRC, encoding="utf-8"))

def cat_green(s):
    if any(k in s for k in ['ระบบ','โคมไฟ','ไฟฟ้า','ดับเพลิง','สัญญาณ','พัดลม','สุขาภิบาล','ประปา','รดน้ำ','ท่อลม','ระบายน้ำ']):
        return ('B5', '景观机电系统', '给排水 / 雨污排水 / 电气照明 / 消防报警 / 灌溉')
    if any(k in s for k in ['ประตู','หน้าต่าง','ผนัง','ฝ้า','เพดาน','หลังคา','ซุ้ม','ถ้ำ','แต่ง']) or 'วัสดุพื้น' in s:
        return ('B4', '景观配套建筑', '观景洞穴 / 观察窗 / 廊架及其装修(门窗·墙·吊顶·屋面)')
    if any(k in s for k in ['น้ำตก','ท่าเรือ','ไส้ไก่','Boardwalk','ทางเดิน']):
        return ('B3', '水景 · 瀑布 · 水系', '景观水体 / 瀑布跌水 / 码头 / 引水沟渠 / 木栈道')
    if any(k in s for k in ['นุ่ม','SOFTSCAPE']) or re.match(r'^\s*\d+\)', s):
        return ('B1', '软景种植', '乔木 / 灌木 / 地被 / 草坪满铺 + 12 个月保活养护')
    return ('B2', '硬景铺装 · 园路 · 广场', '场地铺装 / 园路 / 广场 / 步道 / 散水')

def cat_rock(s):
    if 'น้ำตก' in s:
        return ('A2', '瀑布 · 水景塑石', '各展区瀑布跌水塑石造型及循环水构造')
    if re.match(r'^\s*\d+\)', s):
        return ('A3', '各展区动物栖架塑石', '虎/豹/牛/鸟等展区栖架·攀爬·洞穴塑石造型')
    return ('A1', '塑石假山主体 · 景观雕塑', '钢架 + 喷射混凝土(GUNITE)塑石、景观雕塑、硬质景观')

green = {}; rock = {}
for it in items:
    amt = (it.get('qty') or 0) * (it.get('_rate') or 0); sec = it.get('section', '')
    if it['book'] == '绿化':
        k, nm, ds = cat_green(sec); green.setdefault(k, [nm, ds, 0.0]); green[k][2] += amt
    elif it['book'] == '假山':
        k, nm, ds = cat_rock(sec);  rock.setdefault(k, [nm, ds, 0.0]);  rock[k][2] += amt

buildings = [
    ("ZA","อาคารร้านอาหาร 1","餐厅 1",1500,18000,"结构/建筑/机电/空调/内装/家具"),
    ("ZB","อาคารร้านอาหาร 2","餐厅 2",1200,18000,"结构/建筑/机电/空调/内装/电梯"),
    ("ZD","อาคาร KIOSK 2","小卖部 KIOSK 2",400,16000,"结构/建筑/机电/空调/内装"),
    ("PD","อาคารจอดรถยนต์","停车楼",6000,9000,"结构/建筑/机电/空调/电梯/内装"),
    ("PE","อาคาร SUBSTATION","变电站",600,14000,"结构/建筑/机电/空调/内装"),
    ("H01","อาคาร HOLDING","后勤 Holding 楼",2500,11000,"结构/建筑/机电/空调/家具"),
    ("ME","อาคารห้องเครื่องระบบสุขาภิบาล","给排水机房",500,13000,"结构/建筑/机电/空调/家具"),
    ("SJ","อาคารโรงเก็บมูลสัตว์","动物粪便储存房",800,10000,"结构/建筑/机电/空调/内装"),
]

def fmt(n): return f"{round(n):,}"

# —— 各块报价(成本×FF)——
rock_q  = {k:[v[0],v[1],v[2]*FF] for k,v in rock.items()}
green_q = {k:[v[0],v[1],v[2]*FF] for k,v in green.items()}
RQ = sum(v[2] for v in rock_q.values())
GQ = sum(v[2] for v in green_q.values())
BQ = sum(a*r*FF for _,_,_,a,r,_ in buildings)

def band(base, fl): d,u = fl; return (base*(1-d), base, base*(1+u))
rL,rB,rH = band(RQ, FL_BOQ)
gL,gB,gH = band(GQ, FL_BOQ)
bL,bB,bH = band(BQ, FL_EST)
LOW  = rL+gL+bL; BASE = rB+gB+bB; HIGH = rH+gH+bH
SCALE = HIGH
downp = (BASE-LOW)/BASE*100; upp = (HIGH-BASE)/BASE*100

def bar(low, base, high, color):
    s = base/SCALE*100; l = low/SCALE*100; w = (high-low)/SCALE*100
    return (f'<div class="rb"><div class="rb-solid" style="width:{s:.1f}%;background:{color}"></div>'
            f'<div class="rb-band" style="left:{l:.1f}%;width:{w:.1f}%"></div></div>')

# ---------- 组装 HTML ----------
CSS = r"""
:root{--ink:#1c2a26;--mut:#8a988f;--soft:#54615b;--line:#e8efeb;--bg:#f6faf8;--card:#fff;
--lv:#2f8559;--lvd:#1d5a44;--teal:#1f7a6b;--gold:#b98b35;--or:#d4823a;--orbg:#fbf1e7;
--js:#b5762a;--jsbg:#f8f1e7;--bd:#3a66b0;}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:var(--ink);background:var(--bg);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:1060px;margin:0 auto;padding:26px 22px 0}
.share-cover{display:block;width:206px;height:206px;max-width:56%;object-fit:cover;margin:2px auto 18px;border-radius:16px;border:1px solid var(--line);box-shadow:0 6px 24px rgba(31,90,68,.12)}
.eyebrow{font-size:12px;letter-spacing:.5px;color:var(--lv);font-weight:700}
h1{margin:8px 0 5px;font-size:22px;font-weight:680;line-height:1.32}
.subttl{font-size:13.5px;color:var(--soft);font-weight:600;margin-bottom:12px}
.meta{font-size:12px;color:var(--mut);line-height:1.95}.meta b{color:var(--soft);font-weight:600}.meta .sep{margin:0 7px;color:var(--line)}
.prebar{margin:16px 0 4px;background:linear-gradient(100deg,var(--orbg),#fff);border:1px solid #f0d8c2;border-left:3px solid var(--or);border-radius:12px;padding:13px 16px;font-size:12.5px;color:#8a5326;line-height:1.75}
.prebar b{color:var(--or);font-weight:700}
.tagpre{display:inline-block;background:var(--or);color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;letter-spacing:.4px;vertical-align:middle}
.dash{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 8px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;position:relative;overflow:hidden}
.kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--mut)}
.kpi.main::before{background:var(--lv)}.kpi.lo::before{background:var(--bd)}.kpi.hi::before{background:var(--or)}.kpi.cny::before{background:var(--gold)}
.kpi.main{background:linear-gradient(160deg,#fff,#eef8f1)}
.kpi .t{font-size:11.5px;color:var(--mut);margin-bottom:8px}
.kpi .v{font-size:19px;font-weight:720;line-height:1.15;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
.kpi.main .v{font-size:21px;color:var(--lvd)}
.kpi .v .cur{display:block;font-size:11px;color:var(--mut);font-weight:500;margin-top:5px}
.kpi .s{font-size:11px;color:var(--mut);margin-top:7px}
.sectt{font-size:15px;font-weight:720;color:var(--lvd);margin:34px 0 4px;display:flex;align-items:center;gap:9px}
.sectt .amt{margin-left:auto;font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums}
.secsub{font-size:11.5px;color:var(--mut);margin:0 0 12px}
.rangewrap{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0 4px}
.rangewrap h3{margin:0 0 14px;font-size:12.5px;color:var(--soft);font-weight:700}
.rrow{display:grid;grid-template-columns:88px 1fr 150px;gap:12px;align-items:center;margin:0 0 13px}
.rrow .nm{font-size:12px;color:var(--soft);font-weight:600}
.rrow .nm small{display:block;color:var(--mut);font-weight:400;font-size:10.5px;margin-top:2px}
.rb{position:relative;height:24px;background:#eef2f0;border-radius:7px;overflow:hidden}
.rb-solid{position:absolute;left:0;top:0;bottom:0;border-radius:7px;opacity:.92}
.rb-band{position:absolute;top:0;bottom:0;background:rgba(255,255,255,.34);border-left:1px dashed rgba(28,42,38,.5);border-right:1px dashed rgba(28,42,38,.5)}
.rrow .rg{font-size:11.5px;text-align:right;font-variant-numeric:tabular-nums;color:var(--soft);line-height:1.5}
.rrow .rg b{color:var(--ink);font-weight:700}
.rrow.tot .nm{color:var(--lvd);font-weight:700;font-size:13px}
.rrow.tot .rb{height:30px;background:#e4efe9}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:14px;background:var(--card);margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:600px}
th,td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top}
thead th{color:var(--mut);font-weight:600;font-size:11.5px;white-space:nowrap;background:#f3f8f5}
td.l,th.l{text-align:left}td.c,th.c{text-align:center}
.code{color:var(--mut);font-weight:700;font-size:11px}
.nm2{font-weight:600}.spec{color:var(--mut);font-size:11px;display:block;margin-top:3px;font-weight:400;line-height:1.55;overflow-wrap:anywhere}
.amt{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
tbody tr:hover td{background:#fbfdfc}
.subt td{font-weight:700;background:#f3f8f5;border-top:2px solid #dde7e1;border-bottom:none}
.subt td.lab{color:var(--soft)}.subt .fl{font-size:11px;color:var(--or);font-weight:600}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:6px}
.fact{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.fact .h{font-size:12px;font-weight:700;color:var(--lvd);margin-bottom:6px}
.fact .c{font-size:12px;color:var(--soft);line-height:1.75}.fact .c b{color:var(--ink)}
.terms{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:4px}
.term{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.term .h{font-size:12px;font-weight:700;color:var(--lvd);margin-bottom:6px}
.term .c{font-size:12.5px;color:var(--soft);line-height:1.75}.term .c b{color:var(--ink);font-weight:600}
.scope{background:var(--jsbg);border:1px solid #ecdcc2;border-radius:12px;padding:14px 16px;font-size:12.5px;color:#7a5a2a;line-height:1.85;margin-top:4px}
.scope b{color:#5e4416}
.fx{font-size:11.5px;color:var(--mut);margin:14px 2px 0;line-height:1.7}
footer{margin-top:34px;background:linear-gradient(160deg,var(--lvd),#143d2f);color:#dcefe6;padding:26px 22px 30px}
.fwrap{max-width:1060px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;align-items:flex-end}
.fwrap .b{font-size:18px;font-weight:720;color:#fff;letter-spacing:.5px}
.fwrap .s{font-size:11.5px;color:#9fc8ba;margin-top:6px;line-height:1.7}
.fwrap .r{font-size:11.5px;color:#9fc8ba;text-align:right;line-height:1.8}.fwrap .r .big{font-size:15px;color:var(--gold);font-weight:700}
@media(max-width:680px){.dash{grid-template-columns:1fr 1fr}.facts,.terms{grid-template-columns:1fr}
 .rrow{grid-template-columns:74px 1fr;grid-template-areas:"nm rg" "rb rb"}.rrow .nm{grid-area:nm}.rrow .rg{grid-area:rg}.rrow .rb{grid-area:rb}
 h1{font-size:19px}.fwrap{flex-direction:column;align-items:flex-start}.fwrap .r{text-align:left}}
"""

def rows(d, unit_lbl):
    out = ""
    for k in sorted(d):
        nm, ds, q = d[k]
        out += (f'<tr><td class="code">{k}</td>'
                f'<td class="l"><span class="nm2">{nm}</span><span class="spec">{ds}</span></td>'
                f'<td class="amt">{fmt(q)}</td></tr>\n')
    return out

rock_rows = rows(rock_q, '')
green_rows = rows(green_q, '')
bld_rows = ""
for code, th, cn, area, rate, disc in buildings:
    bld_rows += (f'<tr><td class="code">{code}</td>'
                 f'<td class="l"><span class="nm2">{cn}</span><span class="spec">{th} · {disc}</span></td>'
                 f'<td class="amt">{fmt(area)}</td><td class="amt">{fmt(area*rate*FF/area)}</td>'
                 f'<td class="amt">{fmt(area*rate*FF)}</td></tr>\n')

HTML = f"""<!DOCTYPE html>
<html lang="zh"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>泰国新动物园二期 · 假山/绿化/房建 预报价书</title>
<meta name="description" content="泰国新动物园二期(亚洲展区)假山·绿化·房建全专业预算报价。基准 THB {fmt(BASE)},预估区间 THB {fmt(LOW)}~{fmt(HIGH)};现场踏勘后转固定价。">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CRAYXUS">
<meta property="og:url" content="https://crayxus.com.au/thaizoo-quote-9b2f4c7a.html">
<meta property="og:title" content="泰国新动物园二期 · 假山/绿化/房建 预报价书">
<meta property="og:description" content="全专业预算报价 · 预估区间 THB {fmt(LOW)}~{fmt(HIGH)}(基准 {fmt(BASE)}) · 踏勘后转固定价">
<meta property="og:image" content="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<meta property="og:image:secure_url" content="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="800"><meta property="og:image:height" content="800">
<meta property="og:image:alt" content="泰国新动物园二期 假山绿化房建 预报价">
<meta property="og:locale" content="zh_CN">
<meta itemprop="image" content="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<meta name="image" content="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<link rel="image_src" href="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="泰国新动物园二期 · 假山/绿化/房建 预报价书">
<meta name="twitter:image" content="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<link rel="icon" href="https://crayxus.com.au/thaizoo-quote-cover.jpg?v=q1">
<style>{CSS}</style></head>
<body><div class="wrap">
<img class="share-cover" src="thaizoo-quote-cover.jpg?v=q1" alt="泰国新动物园二期 假山绿化房建 预报价封面">
<div class="eyebrow">CRAYXUS · 工程造价 / 投标报价</div>
<h1>泰国新动物园二期 — 假山 / 绿化 / 房建 预报价书 <span class="tagpre">PRELIMINARY</span></h1>
<div class="subttl">New Zoo Phase II · Rockwork / Landscape / Buildings — Budgetary Quotation</div>
<div class="meta">
<b>报价编号</b> CRX-TZ-ALL-PRE-01 <span class="sep">|</span> <b>日期</b> 2026-06-18 <span class="sep">|</span> <b>币种</b> 泰铢 THB <span class="sep">|</span> <b>有效期</b> 30 天<br>
<b>业主</b> ZPO(皇家赞助) <span class="sep">|</span> <b>地点</b> 巴吞他尼府 Khlong Hok <span class="sep">|</span> <b>编制方</b> CRAYXUS</div>

<div class="prebar"><span class="tagpre">预报价</span>&nbsp; 本文件为<b>预报价(预算级报价)</b>,据业主已下发工程量(BOQ)及图纸编制。<b>因尚未进行现场踏勘</b>,各专业按数据置信度给出<b>价格区间</b>而非单一定值:假山、绿化(有 BOQ)浮动 <b>−8% / +12%</b>;房建(面积粗估)浮动 <b>−12% / +20%</b>。现场踏勘 + 施工图深化后,7~10 个工作日内出具<b>固定报价(Firm Quotation)</b>,浮动收窄至 ±3% 以内。</div>

<div class="dash">
<div class="kpi main"><div class="t">基准总价(含综合费税)</div><div class="v">THB {fmt(BASE)}<span class="cur">≈ ¥{BASE/CNY/1e4:.0f} 万 / US$ {BASE/USD/1e4:.0f} 万</span></div><div class="s">假山+绿化+房建(亚洲展区)</div></div>
<div class="kpi lo"><div class="t">预估区间 · 下限</div><div class="v">THB {fmt(LOW)}<span class="cur">−{downp:.1f}%</span></div></div>
<div class="kpi hi"><div class="t">预估区间 · 上限</div><div class="v">THB {fmt(HIGH)}<span class="cur">+{upp:.1f}%</span></div></div>
<div class="kpi cny"><div class="t">踏勘后</div><div class="v" style="font-size:15px">转固定价<span class="cur">浮动收窄至 ±3%</span></div><div class="s">7~10 个工作日出具</div></div>
</div>

<div class="rangewrap"><h3>价格浮动区间(实色条 = 基准报价额;虚线框 = 预估浮动区间 下限~上限)</h3>
<div class="rrow"><div class="nm">假山 / 塑石<small>BOQ · −8%/+12%</small></div>{bar(rL,rB,rH,'#b5762a')}<div class="rg"><b>{fmt(rB)}</b><br>{fmt(rL)} ~ {fmt(rH)}</div></div>
<div class="rrow"><div class="nm">绿化 / 景观<small>BOQ · −8%/+12%</small></div>{bar(gL,gB,gH,'#2f8559')}<div class="rg"><b>{fmt(gB)}</b><br>{fmt(gL)} ~ {fmt(gH)}</div></div>
<div class="rrow"><div class="nm">房建 / 土建<small>粗估 · −12%/+20%</small></div>{bar(bL,bB,bH,'#3a66b0')}<div class="rg"><b>{fmt(bB)}</b><br>{fmt(bL)} ~ {fmt(bH)}</div></div>
<div class="rrow tot"><div class="nm">合计</div>{bar(LOW,BASE,HIGH,'linear-gradient(90deg,#2f8559,#1d5a44)')}<div class="rg"><b>{fmt(BASE)}</b><br>{fmt(LOW)} ~ {fmt(HIGH)}</div></div>
</div>

<div class="sectt">第一部分 · 假山 / 塑石工程<span class="amt">THB {fmt(RQ)}</span></div>
<div class="secsub">ประติมากรรมปูนปั้น · 钢架 + 喷射混凝土(GUNITE)塑石造型</div>
<div class="scroll"><table><thead><tr><th class="c">编码</th><th class="l">分项工程 / 内容</th><th>报价(THB)</th></tr></thead><tbody>
{rock_rows}<tr class="subt"><td class="l lab" colspan="2">假山小计 <span class="fl">(浮动 −8% / +12%)</span></td><td class="amt">{fmt(RQ)}</td></tr>
</tbody></table></div>

<div class="sectt">第二部分 · 绿化 / 景观工程<span class="amt">THB {fmt(GQ)}</span></div>
<div class="secsub">งานภูมิทัศน์ · 软景种植 + 硬景铺装 + 水景 + 配套建筑 + 景观机电</div>
<div class="scroll"><table><thead><tr><th class="c">编码</th><th class="l">分项工程 / 内容</th><th>报价(THB)</th></tr></thead><tbody>
{green_rows}<tr class="subt"><td class="l lab" colspan="2">绿化小计 <span class="fl">(浮动 −8% / +12%)</span></td><td class="amt">{fmt(GQ)}</td></tr>
</tbody></table></div>

<div class="sectt">第三部分 · 房建 / 土建工程<span class="amt">THB {fmt(BQ)}</span></div>
<div class="secsub">8 栋单体(结构 / 建筑 / 机电 / 空调 / 内装)· 建筑面积与单方为<b>粗估</b>,待施工图核定</div>
<div class="scroll"><table><thead><tr><th class="c">编码</th><th class="l">建筑单体 / 专业</th><th>面积 ㎡</th><th>报价单方</th><th>报价(THB)</th></tr></thead><tbody>
{bld_rows}<tr class="subt"><td class="l lab" colspan="4">房建小计 <span class="fl">(浮动 −12% / +20%)</span></td><td class="amt">{fmt(BQ)}</td></tr>
</tbody></table></div>

<div class="sectt">价格浮动因素(为何为区间)</div>
<div class="facts">
<div class="fact"><div class="h">① 现场条件(未踏勘)</div><div class="c">实际<b>土质、地下水位、地形与运输条件</b>未经现场核实,直接影响土方、基础、塑石钢架及运距费用。</div></div>
<div class="fact"><div class="h">② 塑石工程量与造型</div><div class="c">塑石按展开面积计,<b>实际造型复杂度、洞穴/瀑布结构</b>与图纸偏差将影响用钢量与喷浆量。</div></div>
<div class="fact"><div class="h">③ 苗木现货与规格</div><div class="c">大规格全冠苗<b>现货供应、季节与起苗运输</b>波动较大;名贵/指定苗以实际采购为准。</div></div>
<div class="fact"><div class="h">④ 房建按图深化</div><div class="c">8 栋面积与单方为<b>粗估</b>,需依建筑/结构/机电施工图核量,故浮动区间最大(+20%)。</div></div>
<div class="fact"><div class="h">⑤ 范围与界面</div><div class="c">其他展区(非洲/澳洲/南美/亚洲一区)<b>暂未提供完整工程量</b>,本预报价未计入,待图纸算量后增补。</div></div>
<div class="fact"><div class="h">⑥ 汇率与税费</div><div class="c">综合单价为含税综合单价,已含管理费、措施费及规费;<b>汇率(THB/CNY)</b>波动以签约日为准。</div></div>
</div>

<div class="sectt">报价范围</div>
<div class="scope"><b>本预报价覆盖:</b>泰国新动物园二期<b>亚洲展区</b>(亚洲草原区 / 猛兽区 / 儿童与灵长区)之假山塑石、绿化景观,及全园 <b>8 栋单体建筑</b>(餐厅×2、小卖部、停车楼、变电站、后勤 Holding、给排水机房、粪便储存房)。<br>
<b>暂未计入(待业主提供工程量后另行增补):</b>非洲区 / 澳洲区 / 南美区 / 亚洲一区之景观与塑石;园区道路市政、大门、动物笼舍专项设备、智能化弱电、室外总体景观照明等专项;设计变更与业主指定品牌 / 进口材料加价。</div>

<div class="sectt">商务条款</div>
<div class="terms">
<div class="term"><div class="h">报价性质</div><div class="c"><b>预报价(预算级)</b>,供业主立项 / 比选参考;<b>非最终合同价</b>。现场踏勘 + 施工图深化后出具固定报价并据以签约。</div></div>
<div class="term"><div class="h">币种与税费</div><div class="c">币种 <b>泰铢 THB</b>;报价为<b>含税综合单价(已含管理费、措施费、规费及 VAT)</b>。有效期自报价日起 <b>30 天</b>。</div></div>
<div class="term"><div class="h">付款建议</div><div class="c">预付款 <b>15~30%</b> → 按月 / 节点进度计量支付 → 竣工验收尾款 <b>5~10%</b>(绿化含养护期满后结清)。最终以合同为准。</div></div>
<div class="term"><div class="h">工期与质保</div><div class="c">总工期待踏勘后据施工组织确定;绿化含 <b>12 个月成活养护</b>(成活率 ≥95%),塑石 / 房建按规范保修。</div></div>
</div>

<div class="fx">注:¥ / US$ 折算按参考汇率 1 CNY ≈ {CNY} THB、1 USD ≈ {USD} THB,仅供参考,以泰铢金额为准。报价均为含税综合单价。本预报价基于业主下发 BOQ 与图纸编制,工程量或规格调整时按实计量结算。</div>
</div>
<footer><div class="fwrap">
<div><div class="b">CRAYXUS</div><div class="s">工程造价 · 投标报价 · 假山 / 绿化 / 房建<br>泰国新动物园二期(ZPO · คลองหก)</div></div>
<div class="r">报价编号 CRX-TZ-ALL-PRE-01 · 2026-06-18 · 预报价<br>预估区间 <span class="big">THB {fmt(LOW)} ~ {fmt(HIGH)}</span></div>
</div></footer>
<script>(function(){{document.querySelectorAll('.scroll').forEach(function(s){{}});}})();</script>
</body></html>"""

open(OUT, "w", encoding="utf-8").write(HTML)
print("WROTE", OUT)
print(f"假山报价 {fmt(RQ)} | 绿化报价 {fmt(GQ)} | 房建报价 {fmt(BQ)}")
print(f"基准 {fmt(BASE)}  区间 {fmt(LOW)} ~ {fmt(HIGH)}  (−{downp:.1f}% / +{upp:.1f}%)")
print(f"≈ 基准 ¥{BASE/CNY/1e4:.0f}万 / US${BASE/USD/1e4:.0f}万")
