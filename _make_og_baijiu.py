# -*- coding: utf-8 -*-
"""Generate og-baijiu.jpg 800x800 WeChat share thumbnail — gold/wine liquor theme."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W = H = 800
img = Image.new("RGB", (W, H))
px = img.load()

# vertical gradient warm dark (aged baijiu) -> deep wine-brown
top = (21, 13, 7)
bot = (46, 24, 12)
for y in range(H):
    t = y / H
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    for x in range(W):
        px[x, y] = (r, g, b)

# radial gold glow behind cards
glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([150, 80, 650, 520], fill=80)
glow = glow.filter(ImageFilter.GaussianBlur(80))
gold = Image.new("RGB", (W, H), (240, 196, 106))
img = Image.composite(gold, img, glow.point(lambda v: v // 3))

d = ImageDraw.Draw(img)

F = r"C:\Windows\Fonts\msyhbd.ttc"
FL = r"C:\Windows\Fonts\msyh.ttc"
FS = r"C:\Windows\Fonts\seguisym.ttf"
f_brand = ImageFont.truetype(F, 30)
f_card = ImageFont.truetype(F, 120)
f_suit = ImageFont.truetype(FS, 58)
f_title = ImageFont.truetype(F, 76)
f_sub = ImageFont.truetype(FL, 34)
f_tag = ImageFont.truetype(FL, 28)
f_url = ImageFont.truetype(F, 30)


def center(draw, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text(((W - w) / 2, y), text, font=font, fill=fill)


def make_card(letter, suit, suit_color, angle):
    cw, ch = 200, 280
    pad = 40
    c = Image.new("RGBA", (cw + pad * 2, ch + pad * 2), (0, 0, 0, 0))
    cd = ImageDraw.Draw(c)
    cd.rounded_rectangle([pad + 6, pad + 10, pad + cw + 6, pad + ch + 10],
                         radius=22, fill=(0, 0, 0, 120))  # shadow
    cd.rounded_rectangle([pad, pad, pad + cw, pad + ch], radius=22,
                         fill=(248, 244, 234, 255), outline=(214, 178, 110, 255), width=2)
    lw = cd.textlength(letter, font=f_card)
    cd.text((pad + (cw - lw) / 2, pad + 28), letter, font=f_card, fill=(29, 22, 14))
    sw = cd.textlength(suit, font=f_suit)
    cd.text((pad + (cw - sw) / 2, pad + 180), suit, font=f_suit, fill=suit_color)
    cd.text((pad + 14, pad + 8), suit, font=ImageFont.truetype(FS, 32), fill=suit_color)
    cd.text((pad + cw - 42, pad + ch - 48), suit, font=ImageFont.truetype(FS, 32), fill=suit_color)
    return c.rotate(angle, expand=True, resample=Image.BICUBIC)

card_a = make_card("A", "♠", (29, 22, 14), 9)     # spade dark
card_i = make_card("I", "♥", (192, 57, 43), -9)   # heart wine-red
img.paste(card_a, (155, 95), card_a)
img.paste(card_i, (375, 105), card_i)

d = ImageDraw.Draw(img)
center(d, 38, "C R A Y X U S   A I", f_brand, (240, 210, 130))
center(d, 484, "AI·掼蛋 线上挑战赛", f_title, (247, 238, 223))
center(d, 596, "直播单挑 AI · 打赢 AI 赢美酒", f_sub, (224, 196, 150))
center(d, 654, "直播PK带货 · 宴席团购 · 区域独家", f_tag, (168, 140, 96))
d.line([(250, 718), (550, 718)], fill=(214, 168, 80), width=2)
center(d, 732, "crayxus.com.au", f_url, (255, 210, 122))

img.save(r"C:\Users\Administrator\Desktop\crayxus-site\og-baijiu.jpg", "JPEG", quality=86)
import os
print("saved", os.path.getsize(r"C:\Users\Administrator\Desktop\crayxus-site\og-baijiu.jpg"), "bytes")
