/* 24 个预设工程师机器人头像 bot-01 … bot-24。
   纯参数化 SVG：底色 × 头型 × 眼睛 × 配饰，每个 id 固定生成同一张脸。 */
import { SERVER } from '../core/api.js';

const BG = ['#22D3EE', '#8B5CF6', '#34D399', '#FBBF24', '#F472B6', '#38BDF8', '#FB7185', '#A3E635', '#F97316', '#14B8A6', '#818CF8', '#E879F9'];
const FACE = ['#E6EAF2', '#F8FAFC', '#CBD5E1', '#FDE68A', '#BAE6FD', '#DDD6FE'];
const ACC = ['none', 'antenna', 'headset', 'goggles', 'hardhat', 'cap', 'bolt', 'wrench'];

export const AVATAR_IDS = Array.from({ length: 24 }, (_, i) => 'bot-' + String(i + 1).padStart(2, '0'));

function botSVG(n) {
  const i = n - 1;
  const bg = BG[i % BG.length];
  const face = FACE[(i * 5) % FACE.length];
  const acc = ACC[(i * 3) % ACC.length];
  const eye = i % 4;         // 0 圆眼 1 屏幕眼 2 笑眼 3 单眼
  const round = i % 3 === 0 ? 20 : i % 3 === 1 ? 12 : 26;
  const ink = '#0B1020';
  const eyes = eye === 0
    ? `<circle cx="40" cy="52" r="5.5" fill="${ink}"/><circle cx="60" cy="52" r="5.5" fill="${ink}"/><circle cx="42" cy="50" r="1.8" fill="#fff"/><circle cx="62" cy="50" r="1.8" fill="#fff"/>`
    : eye === 1
      ? `<rect x="30" y="44" width="40" height="16" rx="8" fill="${ink}"/><rect x="36" y="49" width="9" height="6" rx="3" fill="${bg}"/><rect x="55" y="49" width="9" height="6" rx="3" fill="${bg}"/>`
      : eye === 2
        ? `<path d="M34 54q6-7 12 0M54 54q6-7 12 0" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : `<circle cx="50" cy="52" r="9" fill="${ink}"/><circle cx="50" cy="52" r="4" fill="${bg}"/>`;
  const mouth = i % 2 ? `<rect x="42" y="66" width="16" height="4" rx="2" fill="${ink}" opacity=".75"/>` : `<path d="M42 66q8 6 16 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const cheeks = i % 5 === 0 ? `<circle cx="31" cy="64" r="4" fill="#FB7185" opacity=".45"/><circle cx="69" cy="64" r="4" fill="#FB7185" opacity=".45"/>` : '';
  const a = {
    none: '',
    antenna: `<path d="M50 26V14" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="12" r="5" fill="#FBBF24" stroke="${ink}" stroke-width="2.5"/>`,
    headset: `<path d="M22 50a28 28 0 0 1 56 0" stroke="${ink}" stroke-width="4" fill="none"/><rect x="16" y="46" width="9" height="16" rx="4" fill="${ink}"/><rect x="75" y="46" width="9" height="16" rx="4" fill="${ink}"/><path d="M80 62q0 12-14 14" stroke="${ink}" stroke-width="3" fill="none"/>`,
    goggles: `<rect x="24" y="36" width="52" height="9" rx="4.5" fill="${ink}" opacity=".85"/><circle cx="40" cy="40" r="6" fill="#67E8F9" stroke="${ink}" stroke-width="2.5"/><circle cx="60" cy="40" r="6" fill="#67E8F9" stroke="${ink}" stroke-width="2.5"/>`,
    hardhat: `<path d="M24 34a26 18 0 0 1 52 0v3H24Z" fill="#FBBF24" stroke="${ink}" stroke-width="2.5"/><rect x="20" y="35" width="60" height="6" rx="3" fill="#F59E0B" stroke="${ink}" stroke-width="2.5"/>`,
    cap: `<path d="M26 36a24 16 0 0 1 48 0Z" fill="${ink}"/><rect x="50" y="32" width="30" height="6" rx="3" fill="${ink}"/>`,
    bolt: `<path d="M68 18 60 32h7l-5 12 12-16h-7l5-10Z" fill="#FBBF24" stroke="${ink}" stroke-width="2"/>`,
    wrench: `<path d="M22 24l10 10" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><circle cx="20" cy="22" r="6" fill="none" stroke="${ink}" stroke-width="4"/>`,
  }[acc];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" fill="${bg}"/>
    <circle cx="82" cy="18" r="26" fill="#fff" opacity=".12"/><circle cx="12" cy="92" r="22" fill="#000" opacity=".08"/>
    <rect x="30" y="80" width="40" height="30" rx="10" fill="${ink}" opacity=".9"/>
    <rect x="44" y="72" width="12" height="10" fill="${ink}" opacity=".9"/>
    <rect x="22" y="30" width="56" height="48" rx="${round}" fill="${face}" stroke="${ink}" stroke-width="3"/>
    ${eyes}${mouth}${cheeks}${a}
  </svg>`;
}

/* avatar 值：bot-07 / upload:/avatars/7.png / 空 */
export function avatarHTML(val, cls = '') {
  const v = String(val || 'bot-01');
  if (v.startsWith('upload:')) return `<span class="avatar ${cls}"><img alt="" src="${SERVER}${v.slice(7)}"></span>`;
  const n = parseInt(v.replace(/\D/g, ''), 10) || 1;
  return `<span class="avatar ${cls}">${botSVG(((n - 1) % 24) + 1)}</span>`;
}
