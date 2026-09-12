# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont

S = 800
img = Image.new("RGB", (S, S), (14, 17, 22))
d = ImageDraw.Draw(img)
top=(16,20,30); bot=(9,11,16)
for y in range(S):
    t=y/S
    d.line([(0,y),(S,y)], fill=(int(top[0]+(bot[0]-top[0])*t),int(top[1]+(bot[1]-top[1])*t),int(top[2]+(bot[2]-top[2])*t)))

def font(sz,bold=False):
    return ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc", sz)

BLUE=(59,130,246); AMBER=(245,158,11); TXT=(230,233,239); SUB=(139,148,167); PUR=(167,139,250); GRN=(34,197,94)

d.text((54,48), "CRAYXUS · 选址决策测算", font=font(24,True), fill=PUR)
d.text((54,92), "石马镇 · 单店 ROI", font=font(60,True), fill=TXT)
d.text((54,172), "瑞幸咖啡", font=font(34,True), fill=BLUE)
w1=d.textlength("瑞幸咖啡",font=font(34,True))
d.text((54+w1+14,176), "vs", font=font(28), fill=SUB)
w2=d.textlength("vs",font=font(28))
d.text((54+w1+14+w2+14,172), "乌镇泰丰斋", font=font(34,True), fill=AMBER)

# 卖点条
d.rounded_rectangle([54,232,746,288], radius=12, fill=(29,34,48))
d.text((72,244), "泰丰斋 · 自有房产 · 0 现金投入 · 首月即正现金流", font=font(26,True), fill=GRN)

# 折线图区
gx,gy,gw,gh = 70, 330, 660, 300
d.line([(gx,gy+gh*0.50),(gx+gw,gy+gh*0.50)], fill=(70,80,95), width=2)
d.text((gx,gy+gh*0.50+8), "回本线 (0)", font=font(18), fill=SUB)
def curve(color,pts,wd=6):
    path=[(gx+gw*px, gy+gh*(1-py)) for px,py in pts]
    d.line(path, fill=color, width=wd, joint="curve")
# 瑞幸：-38万起步，缓慢爬升，较晚穿越
curve(BLUE, [(0,0.10),(0.2,0.18),(0.4,0.30),(0.6,0.46),(0.78,0.60),(1.0,0.78)])
# 泰丰斋：0投入从零线起，锯齿，一路在上方
curve(AMBER, [(0,0.52),(0.13,0.66),(0.22,0.58),(0.34,0.78),(0.46,0.70),(0.58,0.88),(0.7,0.80),(0.82,0.97),(0.92,0.90),(1.0,1.0)])

ly=gy+gh+26
d.ellipse([gx,ly,gx+18,ly+18], fill=BLUE); d.text((gx+26,ly-2),"瑞幸 · 重投入¥38万 · 2年回本",font=font(22),fill=TXT)
d.ellipse([gx,ly+34,gx+18,ly+52], fill=AMBER); d.text((gx+26,ly+32),"泰丰斋 · 0现金 · 租金作投入 · 即赚",font=font(22),fill=TXT)
d.text((54,S-44), "crayxus.com.au", font=font(22,True), fill=PUR)

img.save("C:/Users/Jayzee/crayxus-ai-gp/shima-roi-cover-sq.png","PNG")
print("saved", img.size)
