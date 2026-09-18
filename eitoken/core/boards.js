/* 设备身份的唯一来源：板卡分层、家族、USB 指纹 → 家族、默认 FQBN。
   老版把这件事分散在 PLATFORMS / usbdb / logsig / 深度识别四处，这里合成一处。 */

export const TIERS = [
  { n: 1, id: 'mcu', nm: '一线 · 单片机', sub: 'ESP32 与 Arduino（AVR）—— 1.0 全流程：识别、案例、编译、烧录、串口、仿真', families: ['esp32', 'avr'] },
  { n: 2, id: 'stm32', nm: '二线 · STM32', sub: '芯片级识别已可用；编译烧录在经典版', families: ['stm32'], classic: '/cos.html#/devices' },
  { n: 3, id: 'linux', nm: '三线 · 机器人主控', sub: 'ROS 小车、地瓜 RDK、Jetson、树莓派 —— 网络部署与实时面板在经典版', families: ['ros'], classic: '/cos.html#/devices' },
  { n: 4, id: 'custom', nm: '四线 · 自定义设备', sub: '没列出来的板子也能接：说清接口，平台帮你写驱动', families: ['custom'], classic: '/cos.html#/home' },
];

export const FAMILIES = {
  esp32: { nm: 'ESP32', tier: 1, color: 'var(--fam-esp32)', fqbn: 'esp32:esp32:esp32', kind: 'esp32', volt: '3.3V', adc: '12 位', desc: 'WiFi / 蓝牙 · 双核 · 3.3V' },
  avr: { nm: 'Arduino', tier: 1, color: 'var(--fam-avr)', fqbn: 'arduino:avr:uno', kind: 'arduino', volt: '5V', adc: '10 位', desc: 'ATmega · 5V · 入门首选' },
  stm32: { nm: 'STM32', tier: 2, color: 'var(--fam-stm32)', desc: 'Cortex-M · 硬实时' },
  ros: { nm: 'ROS 主控', tier: 3, color: 'var(--fam-ros)', desc: 'Linux · 网络部署' },
  custom: { nm: '自定义', tier: 4, color: 'var(--fam-custom)', desc: '任意串口 / 网络设备' },
};

export const BOARDS = [
  { fqbn: 'arduino:avr:uno', nm: 'Arduino Uno', family: 'avr' },
  { fqbn: 'arduino:avr:nano', nm: 'Arduino Nano', family: 'avr' },
  { fqbn: 'arduino:avr:nano:cpu=atmega328old', nm: 'Arduino Nano（旧 bootloader）', family: 'avr' },
  { fqbn: 'arduino:avr:mega', nm: 'Arduino Mega 2560', family: 'avr' },
  { fqbn: 'esp32:esp32:esp32', nm: 'ESP32 DevKit', family: 'esp32' },
  { fqbn: 'esp32:esp32:esp32s3', nm: 'ESP32-S3 DevKitC', family: 'esp32' },
  { fqbn: 'esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=cdc', nm: 'ESP32-S3（原生 USB 口）', family: 'esp32' },
  { fqbn: 'esp32:esp32:esp32c3', nm: 'ESP32-C3', family: 'esp32' },
  { fqbn: 'esp32:esp32:esp32c3:CDCOnBoot=cdc', nm: 'ESP32-C3（原生 USB 口）', family: 'esp32' },
  { fqbn: 'esp32:esp32:m5stack_cores3', nm: 'M5 StackChan（CoreS3）', family: 'esp32' },
];

/* ── 本周热品：M5Stack 官方 StackChan ──
   家族仍是 esp32，不新开 family；它只是一个板型 + 一个案例分类。界面口径都从这里取。 */
export const STACKCHAN = {
  fqbn: 'esp32:esp32:m5stack_cores3',
  nm: 'M5 StackChan（CoreS3）',
  short: 'StackChan',
  family: 'esp32',
  chip: 'ESP32-S3',
  cat: 'stackchan',
  catNm: '桌面机器人',
  title: '本周热品 · StackChan 桌面机器人',
  tagline: '会转头、会做表情的桌面伙伴',
  desc: '两个反馈舵机转头点头、屏幕上一张表情脸、12 颗 RGB、NFC 和红外——插上 USB-C 就能开始。',
  plug: '插上 USB-C 即自动识别（ESP32-S3）',
};
/* fqbn 第 4 段可能带板选项，认前三段就够 */
export const isStackchanFqbn = (fq) => !!fq && String(fq).includes('m5stack_cores3');
export const isStackchanCase = (c) => !!c && (c.category === STACKCHAN.cat || (c.boards || []).some((b) => isStackchanFqbn(b.fqbn)));
/* ESP32-S3 原生 USB（VID 0x303A）——设备页给它「我就是 StackChan」的一键切板 */
export const canBeStackchan = (d, fqbn) => !!d && d.kind === 'serial' && !isStackchanFqbn(fqbn)
  && (d.vid === 0x303a || /s3/i.test(fqbn || '') || /s3/i.test((d.nm || '') + (d.sub || '')));
/* ESP32 的板选项写在 fqbn 第 4 段；先精确匹配，再按前三段匹配 */
export const boardByFqbn = (fq) => {
  if (!fq) return null;
  const base = fq.split(':').slice(0, 3).join(':');
  return BOARDS.find((b) => b.fqbn === fq) || BOARDS.find((b) => b.fqbn === base) || null;
};

/* USB VID → 家族（粗认）。CH340/CP210x 两边都有，只能算「可能」，最终以 /api/mcu/board 为准 */
const VID = {
  0x303a: { family: 'esp32', nm: 'ESP32（原生 USB）', sure: true },
  0x2341: { family: 'avr', nm: 'Arduino（官方）', sure: true },
  0x2a03: { family: 'avr', nm: 'Arduino（.org）', sure: true },
  0x1a86: { family: null, nm: 'CH340 / CH9102 串口', sure: false },
  0x10c4: { family: null, nm: 'CP210x 串口', sure: false },
  0x0403: { family: null, nm: 'FTDI 串口', sure: false },
  0x0483: { family: 'stm32', nm: 'STM32', sure: true },
  0x2888: { family: 'custom', nm: 'VEX V5', sure: true },
  0x2e8a: { family: 'custom', nm: 'RP2040', sure: true },
};

/* /api/hw 的一条 → 统一设备对象。key 用 com / ip，不再用数组下标 */
export function normalizeHw(hw) {
  const out = [];
  for (const s of hw.serial || []) {
    const vid = typeof s.vid === 'number' ? s.vid : parseInt(s.vid, 16);
    const v = VID[vid] || null;
    const deep = s.deep || null;
    let family = v ? v.family : null;
    const dn = deep && (deep.device && deep.device.nm || deep.raw && (deep.raw.chip || deep.raw.machine) || '');
    if (deep && deep.device && deep.device.plat) family = deep.device.plat === 'arduino' ? 'avr' : (deep.device.plat.startsWith('mpy') ? 'custom' : deep.device.plat);
    else if (/esp32/i.test(dn || '')) family = 'esp32';
    else if (/atmega|avr/i.test(dn || '')) family = 'avr';
    else if (/stm32/i.test(dn || '')) family = 'stm32';
    if (s.userCom || s.coms) family = family || 'custom';
    out.push({
      key: 'ser:' + s.com, kind: 'serial', com: s.com, vid, pid: s.pid,
      family: family || null, sure: !!(v && v.sure) || !!deep,
      nm: (deep && deep.device && deep.device.nm) || (v && v.nm) || s.name || s.com,
      sub: s.name || '', deep,
    });
  }
  for (const b of hw.boards || []) {
    out.push({ key: 'net:' + b.ip + (b.gz ? ':gz' : ''), kind: 'net', ip: b.ip, family: 'ros', sure: true, nm: b.nm || '网络设备', sub: (b.services || []).join(' · '), services: b.services || [] });
  }
  return out;
}

export const familyOf = (d) => (d && d.family && FAMILIES[d.family]) || null;
export const isTier1 = (d) => d && (d.family === 'esp32' || d.family === 'avr');
