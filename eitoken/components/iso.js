/* 等距积木插画（移植自经典版 legacy.js 的 isoSVG）。
   模型就是 {x,y,z,w,d,h,c} 立方体列表：顶面提亮、左面原色、右面压暗，画家算法按远近排序。 */
const ISO = { ax: Math.cos(Math.PI / 6), ay: 0.5, s: 1 };

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k > 1) { r += (255 - r) * (k - 1); g += (255 - g) * (k - 1); b += (255 - b) * (k - 1); } else { r *= k; g *= k; b *= k; }
  const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
const proj = (x, y, z) => [(x - y) * ISO.ax * ISO.s, ((x + y) * ISO.ay - z) * ISO.s];
function cube({ x, y, z, w, d, h, c }) {
  const P = (X, Y, Z) => proj(X, Y, Z).map((v) => v.toFixed(2)).join(',');
  const top = `${P(x, y, z + h)} ${P(x + w, y, z + h)} ${P(x + w, y + d, z + h)} ${P(x, y + d, z + h)}`;
  const left = `${P(x, y + d, z)} ${P(x + w, y + d, z)} ${P(x + w, y + d, z + h)} ${P(x, y + d, z + h)}`;
  const right = `${P(x + w, y, z)} ${P(x + w, y + d, z)} ${P(x + w, y + d, z + h)} ${P(x + w, y, z + h)}`;
  return `<polygon points="${left}" fill="${shade(c, 0.72)}"/><polygon points="${right}" fill="${shade(c, 0.52)}"/><polygon points="${top}" fill="${shade(c, 1.16)}"/>`;
}
export function isoSVG(parts, size = 160) {
  const sorted = parts.slice().sort((a, b) => (a.x + a.w / 2 + a.y + a.d / 2 + a.z + a.h / 2) - (b.x + b.w / 2 + b.y + b.d / 2 + b.z + b.h / 2));
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const b of parts) {
    for (const [dx, dy, dz] of [[0, 0, 0], [b.w, 0, 0], [0, b.d, 0], [b.w, b.d, 0], [0, 0, b.h], [b.w, 0, b.h], [0, b.d, b.h], [b.w, b.d, b.h]]) {
      const [px, py] = proj(b.x + dx, b.y + dy, b.z + dz);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const pad = 6, vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
  return `<svg width="${size}" height="${size}" viewBox="${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" aria-hidden="true">`
    + `<g stroke="rgba(4,8,16,.3)" stroke-width=".6" stroke-linejoin="round">${sorted.map(cube).join('')}</g></svg>`;
}

const pins = (x, y, n, gap, c = '#C9A227', axis = 'x') => Array.from({ length: n }, (_, i) => ({ x: axis === 'x' ? x + i * gap : x, y: axis === 'y' ? y + i * gap : y, z: 3, w: 1.6, d: 1.6, h: 2.2, c }));

export const MODELS = {
  esp32: [
    { x: 0, y: 0, z: 0, w: 52, d: 26, h: 3, c: '#1E3A5F' },
    { x: 8, y: 5, z: 3, w: 22, d: 16, h: 3, c: '#B8C2CC' },
    { x: 30, y: 6, z: 3, w: 10, d: 14, h: 1.5, c: '#0F172A' },
    { x: 44, y: 9, z: 3, w: 8, d: 8, h: 3.5, c: '#D1D5DB' },
    { x: 2, y: 9, z: 3, w: 4, d: 4, h: 2, c: '#38BDF8' },
    { x: 38, y: 3, z: 3, w: 3, d: 3, h: 1.6, c: '#F87171' },
    ...pins(4, 1, 15, 3), ...pins(4, 23.5, 15, 3),
  ],
  avr: [
    { x: 0, y: 0, z: 0, w: 56, d: 40, h: 3, c: '#0F766E' },
    { x: -2, y: 6, z: 3, w: 12, d: 10, h: 9, c: '#CBD5E1' },
    { x: -2, y: 27, z: 3, w: 11, d: 8, h: 8, c: '#1F2937' },
    { x: 24, y: 16, z: 3, w: 26, d: 8, h: 3, c: '#111827' },
    { x: 14, y: 6, z: 3, w: 6, d: 6, h: 5, c: '#9CA3AF' },
    { x: 44, y: 4, z: 3, w: 3, d: 3, h: 1.6, c: '#FBBF24' },
    { x: 17, y: 1, z: 3, w: 36, d: 3, h: 6, c: '#111827' },
    { x: 20, y: 36, z: 3, w: 30, d: 3, h: 6, c: '#111827' },
  ],
  stm32: [
    { x: 0, y: 0, z: 0, w: 54, d: 22, h: 3, c: '#1D4ED8' },
    { x: 20, y: 6, z: 3, w: 11, d: 11, h: 2, c: '#0F172A' },
    { x: -2, y: 7, z: 3, w: 7, d: 8, h: 3, c: '#CBD5E1' },
    { x: 40, y: 6, z: 3, w: 6, d: 4, h: 5, c: '#FBBF24' },
    ...pins(3, 1, 16, 3), ...pins(3, 19.5, 16, 3),
  ],
  ros: [
    { x: 2, y: 1, z: 0, w: 9, d: 5, h: 8, c: '#1F2937' }, { x: 2, y: 23, z: 0, w: 9, d: 5, h: 8, c: '#1F2937' },
    { x: 30, y: 1, z: 0, w: 9, d: 5, h: 8, c: '#1F2937' }, { x: 30, y: 23, z: 0, w: 9, d: 5, h: 8, c: '#1F2937' },
    { x: 0, y: 4, z: 5, w: 42, d: 21, h: 6, c: '#475569' },
    { x: 8, y: 7, z: 11, w: 22, d: 15, h: 7, c: '#76B900' },
    { x: 14, y: 11, z: 18, w: 9, d: 9, h: 6, c: '#0F172A' },
    { x: 36, y: 10, z: 11, w: 5, d: 9, h: 4, c: '#E5E7EB' },
  ],
  custom: [
    { x: 0, y: 0, z: 0, w: 30, d: 30, h: 3, c: '#831843' },
    { x: 6, y: 6, z: 3, w: 18, d: 18, h: 12, c: '#F472B6' },
    { x: 10, y: 10, z: 15, w: 10, d: 10, h: 6, c: '#FBCFE8' },
    { x: 26, y: 12, z: 3, w: 8, d: 6, h: 4, c: '#E5E7EB' },
  ],
};
export const boardArt = (family, size = 150) => isoSVG(MODELS[family] || MODELS.custom, size);
