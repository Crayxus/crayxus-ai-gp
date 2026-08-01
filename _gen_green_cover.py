# -*- coding: utf-8 -*-
"""生成泰国绿化工程报价分享封面 800x800，满底色，右下角铺底不留白（微信分享不白图）。"""
from PIL import Image, ImageDraw, ImageFont

W = H = 800
img = Image.new("RGB", (W, H), "#15402c")
d = ImageDraw.Draw(img)

# 深绿对角渐变满铺（左上深 -> 右下亮），右下角绝不留白
c1 = (18, 56, 38)    # #123826
c2 = (47, 133, 89)   # #2f8559 站点绿化主色
for y in range(H):
    for_t = y / (H - 1)
    # 用对角分量让右下也受光，避免右下死黑/白
    pass
# 逐行+水平双向渐变（一次性 numpy 替代避免太慢）
import numpy as np
yy, xx = np.mgrid[0:H, 0:W]
t = (xx / (W - 1) * 0.45 + yy / (H - 1) * 0.55)  # 对角
r = (c1[0] + (c2[0] - c1[0]) * t).astype("uint8")
g = (c1[1] + (c2[1] - c1[1]) * t).astype("uint8")
b = (c1[2] + (c2[2] - c1[2]) * t).astype("uint8")
arr = np.dstack([r, g, b])
img = Image.fromarray(arr, "RGB")
d = ImageDraw.Draw(img)

def font(sz, bold=True):
    p = "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"
    return ImageFont.truetype(p, sz)

GOLD = (214, 184, 122)
WHITE = (244, 248, 245)
SOFT = (200, 220, 208)

# 顶部细线 + 机构
d.text((70, 78), "CRAYXUS", font=font(30), fill=GOLD)
d.text((72, 120), "工程造价 · 投标报价", font=font(20, False), fill=SOFT)

# 主标题
d.text((70, 250), "泰国新动物园二期", font=font(58), fill=WHITE)
d.text((70, 335), "绿化工程", font=font(58), fill=WHITE)

# 金色分隔条
d.rounded_rectangle([72, 430, 232, 438], radius=4, fill=GOLD)

# 副标
d.text((72, 466), "正式报价书", font=font(26, False), fill=SOFT)
d.text((72, 506), "Landscape Works — Formal Quotation", font=font(17, False), fill=(150, 180, 162))

# 右下角金额铺底色块（确保右下绝不白）
panel = [430, 612, 730, 730]
d.rounded_rectangle(panel, radius=18, fill=(11, 38, 26))
d.text((452, 632), "报价总额（含 VAT 7%）", font=font(15, False), fill=SOFT)
d.text((450, 662), "THB 7,470,669", font=font(33), fill=GOLD)

# 左下日期/编号
d.text((72, 690), "DATE 2026-06-18   ·   NO. CRX-TZ-GRN-01", font=font(15, False), fill=(150, 180, 162))

img.save("thaizoo-green-cover.jpg", quality=90)
print("saved thaizoo-green-cover.jpg", img.size)
