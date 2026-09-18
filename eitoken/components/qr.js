/* 演示支付码：由订单号确定性生成的二维码样式图案（装饰用，扫了不会有任何事发生）。
   有三个定位角 + 伪随机模块，看着像二维码，但明确标注「演示支付」。 */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000) / 1000; }; }

export function qrSVG(text, { size = 220, fg = '#0B1020', bg = '#FFFFFF', accent = '#22D3EE' } = {}) {
  const N = 29, cell = size / (N + 2), r = rng(hash(String(text)));
  const finder = (x, y) => `<rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${7 * cell}" height="${7 * cell}" rx="${cell * 1.6}" fill="${fg}"/>
    <rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${5 * cell}" height="${5 * cell}" rx="${cell * 1.1}" fill="${bg}"/>
    <rect x="${(x + 3) * cell}" y="${(y + 3) * cell}" width="${3 * cell}" height="${3 * cell}" rx="${cell * .7}" fill="${fg}"/>`;
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  const inLogo = (x, y) => x > 11 && x < 17 && y > 11 && y < 17;
  let mods = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (inFinder(x, y) || inLogo(x, y)) continue;
    if (r() > 0.52) mods += `<rect x="${(x + 1) * cell + .4}" y="${(y + 1) * cell + .4}" width="${cell - .8}" height="${cell - .8}" rx="${cell * .3}" fill="${fg}"/>`;
  }
  const c = size / 2;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="演示支付码（不可真实支付）">
    <rect width="${size}" height="${size}" rx="18" fill="${bg}"/>${mods}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}
    <rect x="${c - cell * 3}" y="${c - cell * 3}" width="${cell * 6}" height="${cell * 6}" rx="${cell * 1.5}" fill="${bg}"/>
    <rect x="${c - cell * 2.4}" y="${c - cell * 2.4}" width="${cell * 4.8}" height="${cell * 4.8}" rx="${cell * 1.2}" fill="${accent}"/>
    <path d="M${c - cell * 1.3} ${c - cell}h${cell * 2.2}M${c - cell * 1.3} ${c}h${cell * 1.6}M${c - cell * 1.3} ${c + cell}h${cell * 2.2}" stroke="${fg}" stroke-width="${cell * .6}" stroke-linecap="round"/>
  </svg>`;
}
