# -*- coding: utf-8 -*-
"""泰国动物园二期 假山/绿化/房建 预报价分享封面 800x800，满底色，右下角铺底不留白。"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np

W = H = 800
c1 = (16, 46, 40)   # 深墨青绿
c2 = (38, 110, 96)  # teal
yy, xx = np.mgrid[0:H, 0:W]
t = (xx / (W - 1) * 0.45 + yy / (H - 1) * 0.55)
r = (c1[0] + (c2[0] - c1[0]) * t).astype("uint8")
g = (c1[1] + (c2[1] - c1[1]) * t).astype("uint8")
b = (c1[2] + (c2[2] - c1[2]) * t).astype("uint8")
img = Image.fromarray(np.dstack([r, g, b]), "RGB")
d = ImageDraw.Draw(img)

def font(sz, bold=True):
    p = "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"
    return ImageFont.truetype(p, sz)

GOLD = (216, 186, 122); WHITE = (244, 248, 246); SOFT = (196, 218, 210); DIM = (140, 176, 166)
ORANGE = (228, 142, 58)

# 机构
d.text((70, 74), "CRAYXUS", font=font(29), fill=GOLD)
d.text((72, 114), "工程造价 · 投标报价", font=font(19, False), fill=SOFT)

# 预报价标签(橙色胶囊，右上）
lbl = "预报价 PRELIMINARY"
fw = font(18)
tb = d.textbbox((0, 0), lbl, font=fw)
pw = tb[2] - tb[0]
d.rounded_rectangle([730 - pw - 28, 74, 730, 112], radius=19, fill=(58, 30, 12))
d.text((730 - pw - 14, 82), lbl, font=fw, fill=ORANGE)

# 主标题
d.text((70, 232), "泰国新动物园二期", font=font(54), fill=WHITE)
d.text((70, 312), "假山 · 绿化 · 房建", font=font(54), fill=WHITE)

# 金条
d.rounded_rectangle([72, 404, 232, 412], radius=4, fill=GOLD)
d.text((72, 440), "全专业预算报价 · 价格区间", font=font(25, False), fill=SOFT)
d.text((72, 480), "Budgetary Quotation — Three Disciplines", font=font(16, False), fill=DIM)

# 右下角区间金额块（铺底不留白）
panel = [398, 600, 730, 730]
d.rounded_rectangle(panel, radius=18, fill=(10, 34, 30))
d.text((420, 620), "预估总价区间(基准 410M)", font=font(15, False), fill=SOFT)
d.text((418, 650), "THB 370–474M", font=font(36), fill=GOLD)
d.text((420, 700), "≈ ¥0.85 亿 / US$11.4M", font=font(15, False), fill=DIM)

# 左下编号
d.text((72, 690), "DATE 2026-06-18", font=font(15, False), fill=DIM)
d.text((72, 712), "NO. CRX-TZ-ALL-PRE-01", font=font(15, False), fill=DIM)

img.save("thaizoo-quote-cover.jpg", quality=90)
print("saved thaizoo-quote-cover.jpg", img.size)
