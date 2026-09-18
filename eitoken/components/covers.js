/* 案例封面插画：按 motif 画一个主题元件，hue 定主色。320×180，生成式 SVG，不依赖图片文件。 */
const HUE = {
  cyan: ['#22D3EE', '#0E7490'], violet: ['#A78BFA', '#6D28D9'], amber: ['#FBBF24', '#B45309'],
  mint: ['#34D399', '#047857'], coral: ['#FF7A59', '#BE3A1C'],
};
const W = '#E6EAF2', INK = '#0B1020';

const M = {
  led: (a) => `<path d="M140 118V78a20 20 0 0 1 40 0v40Z" fill="${a}" opacity=".95"/><rect x="134" y="116" width="52" height="8" rx="3" fill="${W}" opacity=".8"/><path d="M150 124v34M170 124v24" stroke="${W}" stroke-width="4" stroke-linecap="round"/>${rays(160, 80, a)}`,
  pwm: (a) => `<path d="M60 130h30v-50h30v50h20v-50h40v50h10v-50h50v50h20" stroke="${a}" stroke-width="6" fill="none" stroke-linejoin="round"/><circle cx="250" cy="70" r="16" fill="${a}" opacity=".35"/><circle cx="250" cy="70" r="8" fill="${a}"/>`,
  button: (a) => `<rect x="118" y="78" width="84" height="60" rx="12" fill="${W}" opacity=".15" stroke="${W}" stroke-opacity=".5" stroke-width="3"/><circle cx="160" cy="108" r="20" fill="${a}"/><circle cx="160" cy="104" r="20" fill="${a}" opacity=".6"/>${rays(160, 70, a, 3)}`,
  buzzer: (a) => `<circle cx="140" cy="100" r="34" fill="${INK}" stroke="${W}" stroke-opacity=".5" stroke-width="3"/><circle cx="140" cy="100" r="6" fill="${a}"/><path d="M190 80q14 20 0 40M206 68q24 32 0 64M222 58q32 42 0 84" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  knob: (a) => `<circle cx="160" cy="100" r="42" fill="${W}" opacity=".12"/><circle cx="160" cy="100" r="30" fill="${a}"/><path d="M160 100l18-18" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M110 132a58 58 0 1 1 100 0" stroke="${W}" stroke-opacity=".35" stroke-width="4" fill="none" stroke-dasharray="4 8"/>`,
  rgb: () => `<circle cx="140" cy="92" r="30" fill="#F87171" opacity=".85"/><circle cx="180" cy="92" r="30" fill="#34D399" opacity=".85"/><circle cx="160" cy="124" r="30" fill="#60A5FA" opacity=".85"/><circle cx="160" cy="104" r="10" fill="${W}"/>`,
  serial: (a) => `<rect x="84" y="58" width="152" height="92" rx="12" fill="${INK}" stroke="${W}" stroke-opacity=".3" stroke-width="2"/><path d="M100 84l12 10-12 10" stroke="${a}" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="120" y="92" width="70" height="6" rx="3" fill="${W}" opacity=".7"/><rect x="100" y="114" width="100" height="6" rx="3" fill="${a}" opacity=".7"/><rect x="100" y="128" width="60" height="6" rx="3" fill="${W}" opacity=".4"/>`,
  traffic: () => `<rect x="138" y="40" width="44" height="116" rx="14" fill="${INK}" stroke="${W}" stroke-opacity=".35" stroke-width="3"/><circle cx="160" cy="66" r="12" fill="#F87171"/><circle cx="160" cy="98" r="12" fill="#FBBF24" opacity=".4"/><circle cx="160" cy="130" r="12" fill="#34D399" opacity=".4"/>`,
  thermo: (a) => `<rect x="150" y="40" width="20" height="84" rx="10" fill="${W}" opacity=".2" stroke="${W}" stroke-opacity=".5" stroke-width="3"/><rect x="155" y="70" width="10" height="60" rx="5" fill="${a}"/><circle cx="160" cy="132" r="18" fill="${a}"/><path d="M186 56h16M186 76h10M186 96h16" stroke="${W}" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`,
  light: (a) => `<circle cx="160" cy="98" r="26" fill="${a}"/>${rays(160, 98, a, 8, 40)}`,
  pir: (a) => `<path d="M120 120a40 40 0 0 1 80 0Z" fill="${W}" opacity=".85"/><rect x="116" y="120" width="88" height="18" rx="4" fill="${INK}"/><path d="M96 90q64-60 128 0" stroke="${a}" stroke-width="4" fill="none" stroke-dasharray="6 8"/><path d="M80 72q80-76 160 0" stroke="${a}" stroke-width="4" fill="none" stroke-dasharray="6 8" opacity=".6"/>`,
  soil: (a) => `<path d="M60 130h200v30H60Z" fill="#78350F" opacity=".7"/><path d="M160 130V92" stroke="${a}" stroke-width="5"/><path d="M160 104c-24 0-34-16-34-30 20 0 34 12 34 30ZM160 96c20 0 30-14 30-28-18 0-30 10-30 28Z" fill="${a}"/><rect x="202" y="80" width="12" height="70" rx="3" fill="${W}" opacity=".7"/>`,
  ultrasonic: (a) => `<rect x="92" y="84" width="96" height="44" rx="8" fill="#1D4ED8"/><circle cx="118" cy="106" r="16" fill="#CBD5E1" stroke="${INK}" stroke-width="3"/><circle cx="162" cy="106" r="16" fill="#CBD5E1" stroke="${INK}" stroke-width="3"/><path d="M208 86q14 20 0 40M226 74q24 32 0 64M244 64q34 42 0 84" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  pressure: (a) => `<circle cx="160" cy="100" r="44" fill="none" stroke="${W}" stroke-opacity=".35" stroke-width="6"/><path d="M122 124a44 44 0 0 1 60-64" stroke="${a}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M160 100l24-20" stroke="${W}" stroke-width="5" stroke-linecap="round"/><circle cx="160" cy="100" r="7" fill="${a}"/>`,
  imu: (a) => `<path d="M160 50l52 30v40l-52 30-52-30V80Z" fill="${a}" opacity=".25" stroke="${a}" stroke-width="3"/><path d="M160 100V50M160 100l52 20M160 100l-52 20" stroke="${W}" stroke-width="3"/><path d="M200 60a60 60 0 0 1 20 30" stroke="${a}" stroke-width="4" fill="none" marker-end="url(#ah)"/>`,
  lcd: (a) => `<rect x="70" y="66" width="180" height="76" rx="8" fill="#1E3A8A"/><rect x="82" y="78" width="156" height="52" rx="4" fill="${a}" opacity=".85"/><text x="94" y="100" font-family="JetBrains Mono,monospace" font-size="16" fill="${INK}">TEMP 25.3C</text><text x="94" y="122" font-family="JetBrains Mono,monospace" font-size="16" fill="${INK}">HUMI 61%</text>`,
  segment: (a) => `<rect x="66" y="70" width="188" height="66" rx="8" fill="${INK}" stroke="${W}" stroke-opacity=".3" stroke-width="2"/><text x="160" y="120" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="600" font-size="46" fill="${a}" letter-spacing="6">12:34</text>`,
  strip: () => `<rect x="40" y="96" width="240" height="20" rx="10" fill="${INK}" stroke="#fff" stroke-opacity=".25"/>${['#F87171', '#FB923C', '#FBBF24', '#34D399', '#22D3EE', '#60A5FA', '#A78BFA', '#F472B6'].map((c, i) => `<circle cx="${62 + i * 28}" cy="106" r="8" fill="${c}"/><circle cx="${62 + i * 28}" cy="106" r="14" fill="${c}" opacity=".25"/>`).join('')}`,
  matrix: (a) => { let s = `<rect x="104" y="46" width="112" height="112" rx="10" fill="${INK}"/>`; const heart = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000', '00000000']; heart.forEach((row, y) => [...row].forEach((v, x) => { s += `<circle cx="${118 + x * 12.3}" cy="${60 + y * 12.3}" r="4.2" fill="${v === '1' ? a : '#1F2937'}"/>`; })); return s; },
  oled: (a) => `<rect x="96" y="54" width="128" height="96" rx="8" fill="#1F2937"/><rect x="106" y="66" width="108" height="64" rx="3" fill="${INK}"/><path d="M114 116l18-22 16 14 18-26 22 20" stroke="${a}" stroke-width="3" fill="none"/><rect x="114" y="74" width="40" height="5" rx="2" fill="${a}"/>`,
  servo: (a) => `<rect x="110" y="84" width="84" height="50" rx="6" fill="#1E3A8A"/><rect x="96" y="100" width="112" height="10" rx="3" fill="#1E3A8A"/><circle cx="170" cy="96" r="12" fill="${W}"/><path d="M170 96l40-34" stroke="${W}" stroke-width="10" stroke-linecap="round"/><path d="M200 108a36 36 0 0 0 16-40" stroke="${a}" stroke-width="4" fill="none" stroke-dasharray="4 6"/>`,
  motor: (a) => `<rect x="96" y="80" width="90" height="50" rx="10" fill="${W}" opacity=".85"/><rect x="186" y="98" width="30" height="14" rx="3" fill="#CBD5E1"/><circle cx="230" cy="105" r="22" fill="none" stroke="${a}" stroke-width="6" stroke-dasharray="18 10"/><rect x="104" y="92" width="10" height="26" rx="2" fill="${a}"/>`,
  stepper: (a) => `<rect x="114" y="62" width="92" height="84" rx="14" fill="#94A3B8"/><circle cx="160" cy="104" r="28" fill="${INK}"/>${Array.from({ length: 8 }, (_, i) => { const t = i * Math.PI / 4; return `<rect x="${160 + Math.cos(t) * 20 - 3}" y="${104 + Math.sin(t) * 20 - 3}" width="6" height="6" fill="${a}"/>`; }).join('')}<circle cx="160" cy="104" r="6" fill="${W}"/>`,
  car: (a) => `<rect x="90" y="84" width="140" height="44" rx="12" fill="${a}"/><rect x="118" y="66" width="70" height="26" rx="8" fill="${INK}"/><circle cx="120" cy="134" r="16" fill="${INK}" stroke="${W}" stroke-width="3"/><circle cx="200" cy="134" r="16" fill="${INK}" stroke="${W}" stroke-width="3"/><circle cx="236" cy="96" r="6" fill="#FBBF24"/><path d="M252 88q10 10 0 20M264 80q18 18 0 36" stroke="${W}" stroke-opacity=".6" stroke-width="3" fill="none"/>`,
  clock: (a) => `<circle cx="160" cy="100" r="48" fill="${W}" opacity=".12" stroke="${W}" stroke-opacity=".5" stroke-width="4"/><path d="M160 100V66M160 100l24 14" stroke="${a}" stroke-width="6" stroke-linecap="round"/><circle cx="160" cy="100" r="6" fill="${W}"/>${Array.from({ length: 12 }, (_, i) => { const t = i * Math.PI / 6; return `<circle cx="${160 + Math.cos(t) * 40}" cy="${100 + Math.sin(t) * 40}" r="2.5" fill="${W}" opacity=".6"/>`; }).join('')}`,
  wifi: (a) => `<path d="M100 92a86 86 0 0 1 120 0" stroke="${a}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".45"/><path d="M120 112a56 56 0 0 1 80 0" stroke="${a}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".75"/><path d="M140 132a26 26 0 0 1 40 0" stroke="${a}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="160" cy="148" r="8" fill="${W}"/>`,
  ble: (a) => `<path d="M140 70l40 34-20 18V56l20 18-40 34" stroke="${a}" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="210" cy="104" r="30" fill="${a}" opacity=".15"/><circle cx="110" cy="104" r="30" fill="${a}" opacity=".15"/>`,
  mqtt: (a) => `<circle cx="160" cy="100" r="16" fill="${a}"/>${[[90, 60], [230, 60], [90, 142], [230, 142]].map(([x, y]) => `<path d="M160 100L${x} ${y}" stroke="${W}" stroke-opacity=".4" stroke-width="3" stroke-dasharray="5 6"/><circle cx="${x}" cy="${y}" r="11" fill="${INK}" stroke="${a}" stroke-width="3"/>`).join('')}`,
  stackchan: (a) => `${rgbBar(92, a)}${rgbBar(220, a)}
    <path d="M118 30a56 56 0 0 1 84 0" stroke="${a}" stroke-width="3.5" fill="none" stroke-dasharray="5 7" opacity=".8" marker-end="url(#ah)"/>
    <path d="M126 142h68l12 20h-92Z" fill="${W}" opacity=".2"/><path d="M114 162h92" stroke="${W}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
    <rect x="148" y="132" width="24" height="14" rx="4" fill="${W}" opacity=".3"/>
    <rect x="104" y="40" width="112" height="98" rx="18" fill="${INK}" stroke="${W}" stroke-opacity=".45" stroke-width="3"/>
    <rect x="114" y="50" width="92" height="72" rx="10" fill="#060A16"/>
    <circle cx="140" cy="78" r="10.5" fill="${a}"/><circle cx="180" cy="78" r="10.5" fill="${a}"/>
    <circle cx="143" cy="75" r="3.4" fill="${W}" opacity=".9"/><circle cx="183" cy="75" r="3.4" fill="${W}" opacity=".9"/>
    <path d="M145 100q15 13 30 0" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="199" cy="57" r="3.6" fill="${W}" opacity=".55"/><circle cx="199" cy="57" r="1.4" fill="${a}"/>
    <rect x="130" y="128" width="60" height="4" rx="2" fill="${W}" opacity=".25"/>`,
  web: (a) => `<rect x="80" y="54" width="160" height="104" rx="12" fill="${INK}" stroke="${W}" stroke-opacity=".3" stroke-width="2"/><path d="M80 76h160" stroke="${W}" stroke-opacity=".3" stroke-width="2"/><circle cx="94" cy="65" r="3.5" fill="#F87171"/><circle cx="106" cy="65" r="3.5" fill="#FBBF24"/><circle cx="118" cy="65" r="3.5" fill="#34D399"/><rect x="118" y="100" width="84" height="32" rx="16" fill="${a}"/><circle cx="186" cy="116" r="11" fill="${W}"/>`,
};
/* StackChan 两侧的 RGB 灯条（12 颗里画 5 颗意思到位） */
function rgbBar(x, a) {
  const cs = ['#F87171', '#FBBF24', '#34D399', '#22D3EE', '#A78BFA'];
  return `<rect x="${x}" y="52" width="8" height="74" rx="4" fill="${INK}" stroke="${W}" stroke-opacity=".3" stroke-width="1.5"/>`
    + cs.map((c, i) => `<circle cx="${x + 4}" cy="${62 + i * 14}" r="3.4" fill="${c}"/><circle cx="${x + 4}" cy="${62 + i * 14}" r="7" fill="${c}" opacity=".22"/>`).join('')
    + `<circle cx="${x + 4}" cy="136" r="2" fill="${a}" opacity=".6"/>`;
}
function rays(cx, cy, c, n = 6, r = 34) {
  return Array.from({ length: n }, (_, i) => { const t = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI / (n + 1)) * (n > 6 ? 2.2 : 1); const x1 = cx + Math.cos(t) * r, y1 = cy + Math.sin(t) * r, x2 = cx + Math.cos(t) * (r + 14), y2 = cy + Math.sin(t) * (r + 14); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`; }).join('');
}

export function coverSVG(cover = {}, id = 'x') {
  const [a, b] = HUE[cover.hue] || HUE.cyan;
  const draw = M[cover.motif] || M.led;
  const gid = 'cv' + id.replace(/[^a-z0-9]/gi, '');
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}" stop-opacity=".55"/><stop offset=".55" stop-color="#0B1020"/><stop offset="1" stop-color="#121A2E"/></linearGradient>
      <pattern id="${gid}g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" stroke-opacity=".05"/></pattern>
      <radialGradient id="${gid}r" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${a}" stop-opacity=".35"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
      <marker id="ah" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${a}"/></marker>
    </defs>
    <rect width="320" height="180" fill="url(#${gid})"/><rect width="320" height="180" fill="url(#${gid}g)"/>
    <circle cx="160" cy="100" r="96" fill="url(#${gid}r)"/>
    <path d="M0 160h40l10-10h60M320 30h-50l-10 10h-40" stroke="${a}" stroke-opacity=".35" stroke-width="2" fill="none"/>
    <circle cx="110" cy="150" r="3" fill="${a}" opacity=".6"/><circle cx="220" cy="40" r="3" fill="${a}" opacity=".6"/>
    ${draw(a)}
  </svg>`;
}
