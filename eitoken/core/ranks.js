/* 工程师职级（高→低），与账号后端一致。只展示，不锁任何功能。 */
export const RANKS = [
  { n: 8, title: '首席工程师', min: 20000, hue: '#F472B6' },
  { n: 7, title: '架构师', min: 10000, hue: '#A78BFA' },
  { n: 6, title: '专家工程师', min: 5000, hue: '#818CF8' },
  { n: 5, title: '高级工程师', min: 2500, hue: '#38BDF8' },
  { n: 4, title: '工程师', min: 1200, hue: '#22D3EE' },
  { n: 3, title: '助理工程师', min: 500, hue: '#34D399' },
  { n: 2, title: '实习工程师', min: 150, hue: '#FBBF24' },
  { n: 1, title: '见习创客', min: 0, hue: '#94A3B8' },
];
export function levelFor(xp = 0) {
  const cur = RANKS.find((r) => xp >= r.min) || RANKS[RANKS.length - 1];
  const next = RANKS.find((r) => r.n === cur.n + 1) || null;
  const p = next ? (xp - cur.min) / (next.min - cur.min) : 1;
  return { ...cur, next, p: Math.max(0, Math.min(1, p)), toNext: next ? next.min - xp : 0 };
}
export const rankOf = (n) => RANKS.find((r) => r.n === n) || RANKS[RANKS.length - 1];

/* 职级徽章 SVG：六边形 + 等级数字，颜色随职级 */
export function rankBadge(n, size = 44) {
  const r = rankOf(n);
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-label="L${n} ${r.title}">
    <defs><linearGradient id="rb${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.hue}"/><stop offset="1" stop-color="${r.hue}" stop-opacity=".55"/></linearGradient></defs>
    <path d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3Z" fill="url(#rb${n})" opacity=".18"/>
    <path d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3Z" fill="none" stroke="${r.hue}" stroke-width="2"/>
    ${n >= 6 ? `<path d="M16 15h16" stroke="${r.hue}" stroke-width="2" stroke-linecap="round"/>` : ''}
    <text x="24" y="30" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="15" fill="${r.hue}">L${n}</text></svg>`;
}
