/* Crayxus access gate — client-side PIN.
   NOTE: static-hosting gate; stops casual visitors, not someone who reads page source. */
(function () {
  var PIN = '8888';
  // 每次进入都要求输入密码：不做任何记忆(无 session/local 缓存)。

  // Hide the page immediately (runs while <head> is still parsing) so content never flashes.
  var hide = document.createElement('style');
  hide.id = '__pin_hide';
  hide.textContent = 'html{overflow:hidden!important}body>*:not(#__pin_gate){visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(hide);

  function build() {
    if (document.getElementById('__pin_gate')) return;
    var g = document.createElement('div');
    g.id = '__pin_gate';
    g.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0b0d12;display:flex;' +
      'align-items:center;justify-content:center;flex-direction:column;padding:20px;box-sizing:border-box;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;');
    g.innerHTML =
      '<div style="color:#eaeaea;font-size:17px;margin-bottom:22px;letter-spacing:2px;">🔒 请输入访问密码</div>' +
      '<input id="__pin_in" type="password" inputmode="numeric" autocomplete="off" maxlength="8" ' +
      'style="font-size:24px;padding:13px 18px;width:220px;max-width:80vw;text-align:center;letter-spacing:8px;' +
      'border:1px solid #2a2f3a;border-radius:12px;background:#151820;color:#fff;outline:none;box-sizing:border-box;" />' +
      '<div id="__pin_err" style="color:#e0564b;font-size:13px;height:18px;margin-top:12px;"></div>' +
      '<div style="color:#555;font-size:12px;margin-top:26px;letter-spacing:1px;">© Crayxus · 仅限受邀访问</div>';
    document.body.appendChild(g);
    var inp = g.querySelector('#__pin_in'), err = g.querySelector('#__pin_err');
    function ok() {
      if (inp.value === PIN) {
        var h = document.getElementById('__pin_hide'); if (h) h.parentNode.removeChild(h);
        g.parentNode.removeChild(g);
      } else {
        err.textContent = '密码错误，请重试';
        inp.value = '';
        inp.focus();
      }
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    inp.addEventListener('input', function () { if (inp.value.length >= PIN.length && inp.value === PIN) ok(); });
    setTimeout(function () { inp.focus(); }, 60);
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
