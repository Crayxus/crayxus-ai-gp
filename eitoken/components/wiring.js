/* 接线图：左边主控，右边元件，彩色贝塞尔线连到对应引脚。数据来自 case.wiring。 */
import { esc } from '../core/ui.js';

export function wiringSVG(wiring = [], { family = 'avr', boardName = '主控' } = {}) {
  if (!wiring.length) return '';
  const rowH = 58, top = 46, W = 720, mcuX = 24, mcuW = 230, partX = 470, partW = 226;
  const H = top + wiring.length * rowH + 26;
  const fam = family === 'esp32' ? '#38BDF8' : family === 'avr' ? '#14B8A6' : '#8B5CF6';
  // 同名元件合并成一个块
  const parts = [];
  wiring.forEach((w, i) => { let p = parts.find((x) => x.nm === w.part); if (!p) { p = { nm: w.part, rows: [] }; parts.push(p); } p.rows.push(i); });
  const y = (i) => top + i * rowH + rowH / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="接线图" style="display:block;min-width:560px">
  <defs><pattern id="wg" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity=".12"/></pattern></defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#wg)"/>`;
  // 主控
  s += `<rect x="${mcuX}" y="${top - 26}" width="${mcuW}" height="${wiring.length * rowH + 30}" rx="14" fill="${fam}" fill-opacity=".1" stroke="${fam}" stroke-opacity=".6" stroke-width="1.5"/>
    <text x="${mcuX + 16}" y="${top - 6}" font-size="12" font-weight="600" fill="${fam}" font-family="Space Grotesk,MiSans,sans-serif" letter-spacing="1">${esc(boardName)}</text>`;
  wiring.forEach((w, i) => {
    s += `<text x="${mcuX + 16}" y="${y(i) + 4}" font-size="12.5" fill="currentColor" font-family="JetBrains Mono,monospace">${esc(trim(w.mcu, 26))}</text>
      <circle cx="${mcuX + mcuW}" cy="${y(i)}" r="5" fill="${w.color || fam}" stroke="var(--surface)" stroke-width="2"/>`;
  });
  // 元件块
  parts.forEach((p) => {
    const y0 = y(p.rows[0]) - rowH / 2 + 6, y1 = y(p.rows[p.rows.length - 1]) + rowH / 2 - 6;
    s += `<rect x="${partX}" y="${y0}" width="${partW}" height="${y1 - y0}" rx="12" fill="currentColor" fill-opacity=".05" stroke="currentColor" stroke-opacity=".22"/>
      <text x="${partX + partW - 14}" y="${y0 + 18}" text-anchor="end" font-size="12" font-weight="600" fill="currentColor" opacity=".75" font-family="MiSans,sans-serif">${esc(trim(p.nm, 16))}</text>`;
  });
  wiring.forEach((w, i) => {
    const c = w.color || fam, x1 = mcuX + mcuW, x2 = partX, yy = y(i);
    s += `<path d="M${x1} ${yy} C ${x1 + 110} ${yy}, ${x2 - 110} ${yy}, ${x2} ${yy}" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="${x2}" cy="${yy}" r="5" fill="${c}" stroke="var(--surface)" stroke-width="2"/>
      <text x="${partX + 16}" y="${yy + 4}" font-size="12.5" fill="currentColor" font-family="MiSans,sans-serif">${esc(trim(w.pin, 14))}</text>
      ${w.note ? `<text x="${(x1 + x2) / 2}" y="${yy - 9}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6" font-family="MiSans,sans-serif">${esc(trim(w.note, 20))}</text>` : ''}`;
  });
  return s + '</svg>';
}
const trim = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
