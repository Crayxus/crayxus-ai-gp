"""BOSS 直聘初筛（10-21）：后台逐个点开聊天列表里的候选人，截聊天窗口顶部（简历摘要 + 他发来的话），
期望城市对得上就再点开「在线简历」一屏屏翻到底，存成 PDF 交给简历快筛用豆包读图打分。
- 只点左边的名单、右上角「在线简历」和弹窗的 ×：绝不碰聊天区、输入框、发送按钮，这个程序发不出任何消息。
- 后台方式：PrintWindow 截图 + 往 BOSS 窗口直接发鼠标消息，不占用真鼠标，窗口被别的程序挡住也行。
- 坐标按 2560×1440、缩放 100% 实测，换电脑时按窗口 DPI 等比换算（BOSS 是网页界面，布局随缩放等比变）；开跑前先校准，过不了就停。
- 停：快筛页面点「停止」、按 F12，或在本目录放一个 STOP 文件。重跑会跳过已经读过的人（boss_seen.json 存在数据目录）。
命令行：python reader.py <岗位文件夹> [--max N] [--delay 2.5] [--no-cv]"""
import hashlib, json, os, random, sys, time, threading
import ctypes
import numpy as np
from PIL import Image, JpegImagePlugin, PdfImagePlugin  # noqa: F401  存 PDF 要用 JPEG 编码器，先注册
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


class Geo:
    """所有坐标（窗口内、含边框），按缩放 s 换算；靠右 / 居中的按窗口宽度算"""
    def __init__(self, h):
        self.s = s = (ctypes.windll.user32.GetDpiForWindow(h) or 96) / 96
        l, t, r, b = ui.rect(h); self.W, self.H = r - l, b - t
        k = lambda v: int(round(v * s))
        c = self.W // 2
        self.pitch = 78 * s
        self.avatar = (k(148), k(182))
        self.text = (k(195), k(470))
        self.click_x = k(300)
        self.list_top = k(182)
        self.head = (k(520), k(40), self.W - k(56), k(640))
        self.head_sig = (k(520), k(40), k(1200), k(130))
        self.person = (k(520), k(40), k(1400), k(178))   # 名字 + 年龄年限学历 + 工作经历和学校：认人用
        self.expect = (c - k(300), k(140), self.W - k(56), k(215))   # 右半边「期望：城市 · 职位 · 薪资」那一行
        self.cv_btn = (self.W - k(238), k(93))
        self.cv_box = (c - k(528), k(40), c + k(192), self.H - k(8))
        self.cv_close = (c + k(568), k(65))
        self.dim_box = (k(200), k(600), k(480), k(900))
        self.list_box = (k(140), k(200), k(515), k(900))
        self.scroll_at = (k(330), k(800))
        self.unread_tab = (k(205), k(161))   # 列表上方「全部 / 未读」里的「未读」
        self.badge_x = (k(166), k(194))       # 头像右上角红色未读数字
        self.cv_scroll_at = (c - k(168), k(800))


class Reader:
    def __init__(self, folder, data_dir=None, delay=2.5, cv=True, city_ok=None, log=None, max_n=100000):
        self.folder, self.delay, self.cv, self.city_ok, self.max_n = folder, delay, cv, city_ok, max_n
        self.data = data_dir or HERE
        self.seen_f = os.path.join(self.data, 'boss_seen.json')
        self.stats_f = os.path.join(self.data, 'boss_stats.json')   # 累计工作时间 / 人数（小窗算平均每人用时）
        self._mark = time.time()
        self.log_f = os.path.join(self.data, 'boss.log')
        self._log = log
        self.stop_ev = threading.Event()
        self.st = {'running': False, 'done': 0, 'dup': 0, 'skipped_city': 0, 'total_seen': 0, 'msg': '', 'error': '', 'started': 0}

    # ---------- 小工具 ----------
    def log(self, *a):
        s = time.strftime('%H:%M:%S ') + ' '.join(map(str, a))
        self.st['msg'] = s[9:]
        try:
            with open(self.log_f, 'a', encoding='utf-8') as f: f.write(s + '\n')
        except Exception: pass
        if self._log: self._log(s)
        else: print(s, flush=True)

    def stopping(self):
        return self.stop_ev.is_set() or os.path.exists(os.path.join(HERE, 'STOP')) or (ctypes.windll.user32.GetAsyncKeyState(0x7B) & 0x8000)

    def gray(self, im, box=None):
        return np.asarray((im.crop(box) if box else im).convert('L'), dtype=np.int16)

    def dimmed(self, im):   # 在线简历弹窗开着时，左边名单会蒙一层灰
        return self.gray(im, self.g.dim_box).mean() < 200

    def rows(self, g):
        """名单里完整可见的每一行：先用头像列认出几行定下网格相位，再按行高补全（浅色头像认不出也不漏）"""
        G = self.g; H = g.shape[0]
        band = (g[:, G.avatar[0]:G.avatar[1]] < 200).mean(axis=1)
        cs, y = [], G.list_top
        while y < H - 20:
            if band[y] > 0.3:
                s0 = y
                while y < H and band[y] > 0.3: y += 1
                if y - s0 > 30 * G.s: cs.append((s0 + y) / 2)
            y += 1
        if not cs: return []
        ph = float(np.median([c % G.pitch for c in cs]))
        out, c = [], ph
        while c < H:
            if c - 32 * G.s >= G.list_top and c + 34 * G.s <= H - 12: out.append(int(round(c)))
            c += G.pitch
        return out

    def unread(self, rgb, c):
        """这一行头像右上角有没有红色未读标记（点开读过就没了）"""
        G = self.g
        a = rgb[max(0, int(c - 30 * G.s)):int(c - 4 * G.s), G.badge_x[0]:G.badge_x[1]]
        return int(((a[:, :, 0] > 200) & (a[:, :, 1] < 110) & (a[:, :, 2] < 110)).sum()) > 12 * G.s * G.s

    def fp(self, g, c):   # 这一行的指纹：名字和预览文字二值化后的哈希（选中高亮、红点变化都不影响）
        G = self.g
        crop = g[max(0, int(c - 36 * G.s)):int(c + 36 * G.s), G.text[0]:G.text[1]] < 150
        if not crop.any(): return ''
        ys, xs = np.where(crop)   # 裁到文字的外框再算：截图上下差几个像素也是同一个指纹
        crop = crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        return hashlib.sha1(np.packbits(crop).tobytes() + bytes(str(crop.shape), 'ascii')).hexdigest()[:16]

    def person(self, im):
        """认人：右边摘要里的黑字（名字、年限学历、工作经历、学校）。只取黑灰色字，「刚刚活跃」这类彩色标签和高亮背景不算，
        所以同一个人发了新消息、换了在线状态，还是同一个指纹"""
        a = np.asarray(im.crop(self.g.person).convert('RGB'), dtype=np.int16)
        mx, mn = a.max(axis=2), a.min(axis=2)
        m = (mx < 130) & (mx - mn < 40)
        return hashlib.sha1(np.packbits(m).tobytes()).hexdigest()[:16] if m.sum() > 50 else ''

    def sig(self, im):
        return hashlib.sha1(np.packbits(self.gray(im, self.g.head_sig) < 150).tobytes()).hexdigest()[:16]

    # ---------- 在线简历 ----------
    def read_cv(self):
        h, G = self.h, self.g
        ui.pclick(h, *G.cv_btn, wait=2.0); im = ui.pshot(h)
        if not self.dimmed(im):
            ui.pclick(h, *G.cv_btn, wait=2.5); im = ui.pshot(h)
            if not self.dimmed(im): return []
        pages, last = [], None
        for _ in range(5):
            pg = im.crop(G.cv_box); a = self.gray(pg)
            if last is not None and np.abs(a - last).mean() < 1.0: break   # 翻不动了 = 到底
            pages.append(pg); last = a
            ui.pscroll(h, *G.cv_scroll_at, notches=-10, wait=0.9); im = ui.pshot(h)
        self.close_cv()
        return pages

    def close_cv(self):
        for _ in range(3):
            ui.pclick(self.h, *self.g.cv_close, wait=0.8)
            if not self.dimmed(ui.pshot(self.h)): return True
        return False

    # ---------- 校准：换了电脑先确认点得准，不准就停 ----------
    def calibrate(self):
        h = self.h
        ui.u.ShowWindow(h, 3); time.sleep(1.0)   # 最大化，布局才和实测一致
        self.g = G = Geo(h)
        im = ui.pshot(h)
        if self.dimmed(im): self.close_cv(); im = ui.pshot(h)
        ui.pclick(h, *G.unread_tab, wait=1.5); im = ui.pshot(h)
        rs = self.rows(self.gray(im))
        self.log(f'屏幕 {G.W}×{G.H}，缩放 {int(G.s * 100)}%，名单认出 {len(rs)} 行')
        if len(rs) < 1: return self.fail(im, '名单里认不出候选人：BOSS 要停在「消息」页，左上角选好岗位，列表里要有人')
        self.cal_k = self.fp(self.gray(im), rs[0])
        s0 = self.sig(im); ui.pclick(h, G.click_x, rs[0], wait=1.5); im2 = ui.pshot(h)
        if self.sig(im2) == s0:
            ui.pclick(h, G.click_x, rs[1], wait=1.5); im2 = ui.pshot(h)
            if self.sig(im2) == s0: return self.fail(im2, '点了名单，右边没换人：点击位置不对')
        if self.cv:
            ui.pclick(h, *G.cv_btn, wait=2.2); im3 = ui.pshot(h)
            if not self.dimmed(im3): return self.fail(im3, '点「在线简历」没打开弹窗：按钮位置不对')
            if not self.close_cv(): return self.fail(ui.pshot(h), '在线简历弹窗关不掉：× 的位置不对')
        self.log('校准通过')
        return True

    def fail(self, im, why):
        p = os.path.join(self.data, 'boss_calib.png')
        try: im.save(p)
        except Exception: pass
        self.st['error'] = why + '（截图存在 ' + p + '）'
        self.log('校准没过：' + why)
        return False

    def take(self, shot, seen, k):
        """右边已经是这个人：认人去重 → 看期望城市 → 翻在线简历 → 存文件"""
        G, st = self.g, self.st
        pk = self.person(shot)
        if pk and 'p:' + pk in seen:   # 这个人读过了（又发了新消息）：不重复读
            st['dup'] = st.get('dup', 0) + 1
            try:   # 留一张摘要备查：确认真是同一个人
                dd = os.path.join(self.data, 'boss_dups'); os.makedirs(dd, exist_ok=True)
                shot.crop(G.person).save(os.path.join(dd, f"dup_{st['dup']:03d}_{seen['p:' + pk]}.png"))
            except Exception: pass
            return False
        n = len([1 for kk in seen if kk.startswith('p:')]) + 1
        head = shot.crop(G.head)
        ok_city = True
        if self.city_ok:
            try: ok_city = self.city_ok(shot.crop(G.expect))
            except Exception as e: self.log('读期望城市出错，照常读简历', e)
        cv = self.read_cv() if (self.cv and ok_city) else []
        if cv:   # 第 1 页 = 聊天窗口顶部（摘要 + 他说的话），后面 = 在线简历每一屏
            fn = f'boss_{n:04d}.pdf'
            head.save(os.path.join(self.folder, fn), save_all=True, append_images=cv, resolution=110)
        else:
            fn = f'boss_{n:04d}.jpg'
            head.save(os.path.join(self.folder, fn), quality=85)
            if not ok_city: st['skipped_city'] += 1
        st['done'] += 1
        seen['p:' + (pk or k)] = fn; st['total_seen'] = n
        json.dump(seen, open(self.seen_f, 'w', encoding='utf-8'))
        self.bump(1)
        if st['done'] % 10 == 0: self.log(f'已读 {st["done"]} 人（期望不在本地、没翻简历的 {st["skipped_city"]} 人）')
        return True

    def bump(self, people=0):
        """把这段时间记进累计工作时间"""
        try: d = json.load(open(self.stats_f, encoding='utf-8'))
        except Exception: d = {'secs': 0, 'done': 0}
        now = time.time(); d['secs'] = d.get('secs', 0) + (now - self._mark); d['done'] = d.get('done', 0) + people; self._mark = now
        try: json.dump(d, open(self.stats_f, 'w', encoding='utf-8'))
        except Exception: pass

    # ---------- 主流程 ----------
    def run(self):
        st = self.st; st.update(running=True, error='', started=time.time(), done=0, dup=0, skipped_city=0); self._mark = time.time()
        try: self._run()
        except Exception as e:
            st['error'] = str(e)[:200]; self.log('出错：', e)
        finally:
            self.bump(0); st['running'] = False

    def _run(self):
        os.makedirs(self.folder, exist_ok=True)
        try: seen = json.load(open(self.seen_f, encoding='utf-8'))
        except Exception: seen = {}
        self.h = h = ui.find()
        if not h: self.st['error'] = '没找到 BOSS直聘 窗口：先打开 BOSS 直聘电脑版并登录'; return
        if not self.calibrate(): return
        G = self.g
        ui.pclick(h, *G.unread_tab, wait=1.5)   # 切到「未读」：读过的会从这里消失，新来的在最上面；程序只点最上面带红标的，不用滚动
        st = self.st; st['total_seen'] = len([1 for kk in seen if kk.startswith('p:')]); empty = 0; last_head = ''; tries = {}
        self.log(f'开始：之前读过 {st["total_seen"]} 人')
        shot = ui.pshot(h); last_head = self.sig(shot)   # 校准时点开的那个人：红标已经没了，先把他读掉
        self.take(shot, seen, self.cal_k)
        while st['done'] < self.max_n:
            if self.stopping(): self.log('已停止'); return
            im = ui.pshot(h); g = self.gray(im); rgb = np.asarray(im)
            todo = [c for c in self.rows(g) if self.unread(rgb, c) and tries.get(self.fp(g, c), 0) < 2]
            if not todo:
                empty += 1
                if empty >= 3: self.log('未读的都读完了'); break
                ui.pclick(h, *G.unread_tab, wait=3.0); continue   # 刷新一下列表再看
            empty = 0
            c = todo[0]; k = self.fp(g, c); tries[k] = tries.get(k, 0) + 1
            ui.pclick(h, G.click_x, c, wait=1.3); shot = ui.pshot(h); sg = self.sig(shot)
            if sg == last_head:
                ui.pclick(h, G.click_x, c, wait=1.5); shot = ui.pshot(h); sg = self.sig(shot)
            if sg == last_head: continue
            last_head = sg
            self.take(shot, seen, k)
            time.sleep(self.delay + random.random() * 1.5)   # 别太快，像人在翻
        self.log(f'结束：这次读了 {st["done"]} 人，累计 {len([1 for kk in seen if kk.startswith("p:")])} 人')


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('folder'); ap.add_argument('--max', type=int, default=100000); ap.add_argument('--delay', type=float, default=2.5)
    ap.add_argument('--no-cv', dest='cv', action='store_false')
    a = ap.parse_args()
    Reader(a.folder, delay=a.delay, cv=a.cv, max_n=a.max).run()
