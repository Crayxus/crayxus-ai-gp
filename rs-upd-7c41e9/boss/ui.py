"""BOSS 直聘电脑客户端：找窗口、置前、截图、点击、滚动（ctypes，不装第三方库）。
坐标一律用「窗口内坐标」（左上角 = 0,0），截图也只截窗口。"""
import ctypes, ctypes.wintypes as W, time
from PIL import ImageGrab

u = ctypes.windll.user32
try: ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception: pass


def find():
    out = []
    @ctypes.WINFUNCTYPE(ctypes.c_bool, W.HWND, W.LPARAM)
    def cb(h, l):
        n = u.GetWindowTextLengthW(h)
        if n and u.IsWindowVisible(h):
            b = ctypes.create_unicode_buffer(n + 1); u.GetWindowTextW(h, b, n + 1)
            if b.value.strip() == 'BOSS直聘': out.append(h)
        return True
    u.EnumWindows(cb, 0)
    return out[0] if out else None


def rect(h):
    r = W.RECT(); u.GetWindowRect(h, ctypes.byref(r)); return r.left, r.top, r.right, r.bottom


def front(h, maximize=True):
    if maximize: u.ShowWindow(h, 3)   # SW_MAXIMIZE
    u.keybd_event(0x12, 0, 0, 0); u.keybd_event(0x12, 0, 2, 0)   # 按一下 Alt，SetForegroundWindow 才肯生效
    u.SetForegroundWindow(h); time.sleep(0.4)


def shot(h, path=None):
    l, t, r, b = rect(h)
    im = ImageGrab.grab(bbox=(max(0, l), max(0, t), r, b), all_screens=True)
    if path: im.save(path)
    return im


def click(h, x, y, wait=0.6):
    l, t, _, _ = rect(h)
    u.SetCursorPos(int(l + x), int(t + y)); time.sleep(0.05)
    u.mouse_event(2, 0, 0, 0, 0); time.sleep(0.04); u.mouse_event(4, 0, 0, 0, 0)
    time.sleep(wait)


def scroll(h, x, y, notches=-3, wait=0.5):
    l, t, _, _ = rect(h)
    u.SetCursorPos(int(l + x), int(t + y)); time.sleep(0.05)
    u.mouse_event(0x0800, 0, 0, 120 * notches, 0)
    time.sleep(wait)


# ---- 后台方式（10-21）：不抢鼠标、窗口被挡住也行 ----
import ctypes.wintypes as _W
from PIL import Image
_g = ctypes.windll.gdi32


class _BIH(ctypes.Structure):
    _fields_ = [('biSize', _W.DWORD), ('biWidth', _W.LONG), ('biHeight', _W.LONG), ('biPlanes', _W.WORD), ('biBitCount', _W.WORD),
                ('biCompression', _W.DWORD), ('biSizeImage', _W.DWORD), ('biXPelsPerMeter', _W.LONG), ('biYPelsPerMeter', _W.LONG),
                ('biClrUsed', _W.DWORD), ('biClrImportant', _W.DWORD)]


def pshot(h, path=None):
    """PrintWindow 截 BOSS 自己的画面（被微信挡住也能截）"""
    l, t, r, b = rect(h); w, hh = r - l, b - t
    hdc = u.GetWindowDC(h); mdc = _g.CreateCompatibleDC(hdc); bmp = _g.CreateCompatibleBitmap(hdc, w, hh); _g.SelectObject(mdc, bmp)
    u.PrintWindow(h, mdc, 2)
    bi = _BIH(); bi.biSize = ctypes.sizeof(_BIH); bi.biWidth = w; bi.biHeight = -hh; bi.biPlanes = 1; bi.biBitCount = 32
    buf = ctypes.create_string_buffer(w * hh * 4); _g.GetDIBits(mdc, bmp, 0, hh, buf, ctypes.byref(bi), 0)
    _g.DeleteObject(bmp); _g.DeleteDC(mdc); u.ReleaseDC(h, hdc)
    im = Image.frombuffer('RGBA', (w, hh), buf, 'raw', 'BGRA', 0, 1).convert('RGB')
    if path: im.save(path)
    return im


def render(h):
    out = []
    @ctypes.WINFUNCTYPE(ctypes.c_bool, _W.HWND, _W.LPARAM)
    def cb(c, lp):
        b = ctypes.create_unicode_buffer(256); u.GetClassNameW(c, b, 256)
        if b.value == 'Chrome_RenderWidgetHostHWND': out.append(c)
        return True
    u.EnumChildWindows(h, cb, 0)
    return out[0] if out else h


def _lp(x, y): return (int(y) << 16) | (int(x) & 0xFFFF)


def pclick(h, x, y, wait=0.8):
    """往 BOSS 的渲染窗口直接发鼠标消息（x, y = 截图里的坐标），不动真鼠标"""
    c = render(h); l, t, _, _ = rect(h); cl, ct, _, _ = rect(c)
    cx, cy = x - (cl - l), y - (ct - t)
    u.PostMessageW(c, 0x0200, 0, _lp(cx, cy)); time.sleep(0.03)
    u.PostMessageW(c, 0x0201, 1, _lp(cx, cy)); time.sleep(0.05)
    u.PostMessageW(c, 0x0202, 0, _lp(cx, cy))
    time.sleep(wait)


def pscroll(h, x, y, notches=-3, wait=0.5):
    c = render(h); l, t, _, _ = rect(h)
    u.PostMessageW(c, 0x020A, ((120 * notches) & 0xFFFF) << 16, _lp(l + x, t + y))   # 滚轮消息的坐标是屏幕坐标
    time.sleep(wait)
