/* 由 cos-classic.html 抽出的纯逻辑, 不含任何 DOM 操作 —— 由 cos_extract.py 生成 */

const ISO = {ax:0.866, ay:0.5, s:2.05};

const C = {tire:'#252e45', metal:'#4a5570', white:'#dfe6f2', dark:'#1a2133'};

const PLATFORMS = [
  { id:'esp32', nm:'ESP32-S3', ch:'Xtensa LX7 · WiFi/BT', via:'ser',
    rt:'COS-MCU (FreeRTOS)', w:1.35, tool:'esptool / arduino-cli',
    role:'炫酷小车', tint:'rgba(224,72,63,.24)',
    model:[
      {x:2,y:1,z:0,w:9,d:5,h:7,c:C.tire},   {x:2,y:17,z:0,w:9,d:5,h:7,c:C.tire},
      {x:26,y:1,z:0,w:9,d:5,h:7,c:C.tire},  {x:26,y:17,z:0,w:9,d:5,h:7,c:C.tire},
      {x:0,y:2,z:5,w:38,d:19,h:7,c:'#e0483f'},
      {x:11,y:5,z:12,w:15,d:13,h:8,c:'#243356'},
      {x:12,y:6,z:12,w:13,d:11,h:7,c:'#243052'},
      {x:33,y:2,z:12,w:4,d:19,h:3,c:'#ffd166'},
      {x:1,y:6,z:12,w:5,d:11,h:3,c:'#ffd166'},
    ]},
  { id:'stm32', nm:'STM32', ch:'Cortex-M · 硬实时', via:'ser',
    rt:'COS-MCU (裸机/HAL)', w:1.45, tool:'st-flash / OpenOCD',
    role:'六轴机械臂', tint:'rgba(91,140,255,.24)',
    model:[
      {x:6,y:6,z:0,w:26,d:26,h:5,c:C.metal},
      {x:13,y:13,z:5,w:12,d:12,h:6,c:'#5b8cff'},
      {x:15,y:15,z:11,w:8,d:8,h:21,c:C.white},
      {x:13,y:13,z:32,w:12,d:12,h:6,c:'#5b8cff'},
      {x:22,y:15,z:34,w:19,d:8,h:6,c:C.white},
      {x:41,y:14,z:33,w:4,d:4,h:8,c:'#ffd166'},
      {x:41,y:21,z:33,w:4,d:4,h:8,c:'#ffd166'},
    ]},
  { id:'pi', nm:'树莓派', ch:'BCM2712 · Linux', via:'ssh',
    rt:'COS Runtime', w:1.00, tool:'ssh + systemd',
    role:'双足小鸭', tint:'rgba(255,217,61,.22)',
    model:[
      {x:12,y:11,z:0,w:5,d:6,h:8,c:'#ff9f43'},
      {x:21,y:11,z:0,w:5,d:6,h:8,c:'#ff9f43'},
      {x:8,y:6,z:8,w:22,d:19,h:16,c:'#ffd93d'},
      {x:13,y:9,z:24,w:14,d:13,h:13,c:'#ffe066'},
      {x:26,y:12,z:27,w:8,d:7,h:5,c:'#ff9f43'},
      {x:19,y:8,z:33,w:4,d:2,h:3,c:C.dark},
      {x:11,y:2,z:12,w:5,d:5,h:9,c:'#ffc93d'},
    ]},
  { id:'rk', nm:'瑞芯微', ch:'RK3566/3588 · NPU', via:'ssh',
    rt:'COS Runtime + NPU', w:1.10, tool:'ssh + rknn',
    role:'人形机器人', tint:'rgba(176,107,255,.24)',
    model:[
      {x:12,y:10,z:0,w:6,d:8,h:12,c:'#3d4a68'},
      {x:22,y:10,z:0,w:6,d:8,h:12,c:'#3d4a68'},
      {x:9,y:7,z:12,w:22,d:14,h:16,c:'#b06bff'},
      {x:5,y:9,z:15,w:4,d:6,h:13,c:'#8a4fd8'},
      {x:31,y:9,z:15,w:4,d:6,h:13,c:'#8a4fd8'},
      {x:12,y:8,z:28,w:16,d:12,h:12,c:C.white},
      {x:19,y:7,z:33,w:8,d:2,h:3,c:'#37e6c8'},
    ]},
  { id:'rdk', nm:'地瓜派 RDK X5', ch:'Sunrise 5 · 10 TOPS', via:'ssh',
    rt:'COS Runtime + BPU', w:1.10, tool:'ssh + hbdk',
    role:'自驾赛车', tint:'rgba(55,230,200,.24)',
    model:[
      {x:2,y:1,z:0,w:9,d:5,h:7,c:C.tire},   {x:2,y:17,z:0,w:9,d:5,h:7,c:C.tire},
      {x:26,y:1,z:0,w:9,d:5,h:7,c:C.tire},  {x:26,y:17,z:0,w:9,d:5,h:7,c:C.tire},
      {x:0,y:2,z:5,w:37,d:19,h:6,c:'#37e6c8'},
      {x:5,y:4,z:11,w:22,d:15,h:6,c:'#1f8f7d'},
      {x:13,y:8,z:17,w:8,d:8,h:5,c:'#5b8cff'},
      {x:12,y:7,z:22,w:10,d:10,h:2,c:C.white},
      {x:31,y:7,z:11,w:4,d:9,h:4,c:'#ffd166'},
    ]},
  { id:'jetson', nm:'Jetson', ch:'Orin · CUDA', via:'ssh',
    rt:'COS Runtime + CUDA', w:1.15, tool:'ssh + tensorrt',
    role:'四足机器狗', tint:'rgba(55,230,160,.22)',
    model:[
      {x:5,y:3,z:0,w:5,d:5,h:11,c:C.tire},  {x:5,y:16,z:0,w:5,d:5,h:11,c:C.tire},
      {x:24,y:3,z:0,w:5,d:5,h:11,c:C.tire}, {x:24,y:16,z:0,w:5,d:5,h:11,c:C.tire},
      {x:3,y:2,z:11,w:29,d:20,h:11,c:'#37e6a0'},
      {x:30,y:6,z:15,w:13,d:12,h:10,c:'#2aa87a'},
      {x:36,y:5,z:20,w:5,d:2,h:3,c:C.dark},
      {x:32,y:8,z:25,w:3,d:3,h:5,c:'#ffd166'},
      {x:0,y:8,z:20,w:4,d:6,h:3,c:'#2aa87a'},
    ]},
  /* ── 单片机 · 串口 ── */
  { id:'arduino', nm:'Arduino UNO / Mega', ch:'ATmega · 8-bit · 5V', via:'ser',
    rt:'COS-MCU (裸机)', w:1.20, tool:'arduino-cli',
    role:'教学小车', tint:'rgba(42,155,214,.24)',
    model:[
      {x:2,y:3,z:0,w:34,d:18,h:3,c:'#2a9bd6'},
      {x:14,y:8,z:3,w:10,d:8,h:3,c:C.dark},
      {x:0,y:5,z:3,w:5,d:6,h:4,c:C.metal},
      {x:8,y:2,z:3,w:24,d:2,h:2,c:C.dark},{x:8,y:19,z:3,w:24,d:2,h:2,c:C.dark},
      {x:30,y:10,z:3,w:2,d:2,h:2,c:'#ffd166'},
    ]},
  { id:'pico', nm:'树莓派 Pico 2', ch:'RP2350 · 双核 M33', via:'ser',
    rt:'COS-MCU (MicroPython/C)', w:1.20, tool:'picotool',
    role:'传感器节点', tint:'rgba(47,158,68,.24)',
    model:[
      {x:6,y:8,z:0,w:28,d:10,h:3,c:'#2f9e44'},
      {x:16,y:11,z:3,w:8,d:5,h:2,c:C.dark},
      {x:4,y:10,z:3,w:4,d:6,h:3,c:C.metal},
      {x:8,y:7,z:3,w:24,d:1,h:2,c:'#ffd166'},{x:8,y:18,z:3,w:24,d:1,h:2,c:'#ffd166'},
    ]},
  { id:'xiao', nm:'Seeed XIAO', ch:'ESP32-S3 / nRF52 · 拇指板', via:'ser',
    rt:'COS-MCU (FreeRTOS)', w:1.30, tool:'arduino-cli / esptool',
    role:'智能餐叉 · AI 笔', tint:'rgba(30,111,92,.26)',
    model:[
      {x:0,y:19,z:0,w:38,d:3,h:3,c:'#f0f0f0'},{x:38,y:19,z:0,w:3,d:3,h:3,c:C.dark},
      {x:12,y:6,z:0,w:14,d:10,h:3,c:'#1e6f5c'},
      {x:10,y:9,z:3,w:3,d:4,h:2,c:C.metal},
      {x:16,y:8,z:3,w:7,d:6,h:3,c:C.metal},
    ]},
  { id:'microbit', nm:'micro:bit V2', ch:'nRF52833 · BLE · 5×5 LED', via:'ser',
    rt:'COS-MCU (MicroPython)', w:1.10, tool:'uflash',
    role:'少儿编程 · AI 夏令营', tint:'rgba(230,57,70,.24)',
    model:[
      {x:6,y:4,z:0,w:26,d:20,h:3,c:'#e63946'},
      {x:13,y:8,z:3,w:12,d:12,h:2,c:C.dark},
      {x:15,y:10,z:5,w:2,d:2,h:1,c:'#ffd166'},{x:19,y:14,z:5,w:2,d:2,h:1,c:'#ffd166'},{x:23,y:10,z:5,w:2,d:2,h:1,c:'#ffd166'},
      {x:8,y:12,z:3,w:3,d:3,h:2,c:C.metal},{x:27,y:12,z:3,w:3,d:3,h:2,c:C.metal},
    ]},
  { id:'nrf52', nm:'Nordic nRF52840', ch:'Cortex-M4 · BLE 5 · 低功耗', via:'ser',
    rt:'COS-MCU (Zephyr)', w:1.35, tool:'nrfjprog / west',
    role:'穿戴 · 低功耗节点', tint:'rgba(15,95,168,.24)',
    model:[
      {x:8,y:9,z:0,w:24,d:8,h:3,c:'#0f5fa8'},
      {x:30,y:11,z:3,w:6,d:4,h:2,c:C.white},
      {x:14,y:11,z:3,w:8,d:4,h:2,c:C.dark},
      {x:6,y:11,z:3,w:3,d:4,h:2,c:C.metal},
    ]},
  { id:'teensy', nm:'Teensy 4.1', ch:'Cortex-M7 · 600 MHz', via:'ser',
    rt:'COS-MCU (裸机)', w:1.30, tool:'teensy_loader_cli',
    role:'高速电机 · 音频', tint:'rgba(43,45,66,.30)',
    model:[
      {x:4,y:9,z:0,w:32,d:8,h:3,c:'#2b2d42'},
      {x:16,y:11,z:3,w:8,d:4,h:2,c:C.metal},
      {x:30,y:10,z:3,w:5,d:6,h:2,c:C.dark},
      {x:5,y:8,z:3,w:30,d:1,h:2,c:'#ffd166'},{x:5,y:17,z:3,w:30,d:1,h:2,c:'#ffd166'},
    ]},
  { id:'gd32', nm:'兆易 GD32', ch:'Cortex-M · 引脚兼容 STM32', via:'ser',
    rt:'COS-MCU (裸机/HAL)', w:1.40, tool:'OpenOCD / GD-Link',
    role:'国产替代 STM32', tint:'rgba(38,70,83,.30)',
    model:[
      {x:6,y:6,z:0,w:26,d:16,h:3,c:'#264653'},
      {x:14,y:10,z:3,w:10,d:8,h:3,c:C.dark},
      {x:7,y:5,z:3,w:24,d:1,h:2,c:'#ffd166'},{x:7,y:22,z:3,w:24,d:1,h:2,c:'#ffd166'},
      {x:3,y:11,z:3,w:3,d:6,h:3,c:C.metal},
    ]},
  { id:'ch32', nm:'沁恒 CH32V', ch:'RISC-V MCU · 元级', via:'ser',
    rt:'COS-MCU (裸机)', w:1.40, tool:'wchisp / wlink',
    role:'百元级国产控制板', tint:'rgba(29,53,87,.30)',
    model:[
      {x:8,y:8,z:0,w:22,d:12,h:3,c:'#1d3557'},
      {x:15,y:11,z:3,w:8,d:6,h:2,c:C.dark},
      {x:9,y:7,z:3,w:20,d:1,h:2,c:'#ffd166'},{x:9,y:20,z:3,w:20,d:1,h:2,c:'#ffd166'},
      {x:5,y:12,z:3,w:3,d:4,h:2,c:C.metal},
    ]},
  { id:'openmv', nm:'OpenMV Cam', ch:'STM32H7 · MicroPython 视觉', via:'ser',
    rt:'COS-MCU (MicroPython)', w:1.25, tool:'openmv-ide / dfu',
    role:'视觉小模块', tint:'rgba(20,20,20,.34)',
    model:[
      {x:10,y:6,z:0,w:18,d:16,h:3,c:'#111'},
      {x:15,y:10,z:3,w:8,d:8,h:6,c:C.metal},
      {x:17,y:12,z:9,w:4,d:4,h:2,c:'#5b8cff'},
      {x:8,y:12,z:3,w:3,d:4,h:2,c:C.metal},
    ]},
  { id:'k230', nm:'嘉楠 K230 (CanMV)', ch:'RISC-V · 6 TOPS NPU', via:'ser',
    rt:'COS-MCU + NPU (RT-Smart)', w:1.35, tool:'CanMV IDE / burn tool',
    role:'国产视觉识别', tint:'rgba(138,79,216,.26)',
    model:[
      {x:6,y:5,z:0,w:26,d:18,h:3,c:'#8a4fd8'},
      {x:14,y:9,z:3,w:10,d:10,h:4,c:C.dark},
      {x:2,y:9,z:3,w:5,d:8,h:6,c:C.metal},{x:3,y:11,z:9,w:3,d:4,h:1,c:'#5b8cff'},
      {x:32,y:9,z:3,w:3,d:6,h:4,c:C.metal},
    ]},

  /* ── Linux 板 · SSH ── */
  { id:'unoq', nm:'Arduino UNO Q', ch:'Dragonwing + STM32 · 混合', via:'ssh',
    rt:'COS Runtime + COS-MCU', w:1.20, tool:'ssh + arduino-cli',
    role:'混合板 · 边缘 AI', tint:'rgba(42,155,214,.24)',
    model:[
      {x:2,y:3,z:0,w:34,d:18,h:3,c:'#2a9bd6'},
      {x:11,y:7,z:3,w:12,d:11,h:5,c:'#3a3a3a'},
      {x:26,y:7,z:3,w:6,d:6,h:3,c:C.dark},
      {x:0,y:5,z:3,w:5,d:6,h:4,c:C.metal},
      {x:8,y:20,z:3,w:24,d:2,h:2,c:C.dark},
      {x:13,y:9,z:8,w:8,d:7,h:1,c:'#37e6c8'},
    ]},
  { id:'rdks', nm:'地瓜派 RDK S100', ch:'Sunrise · 80 TOPS', via:'ssh',
    rt:'COS Runtime + BPU', w:1.15, tool:'ssh + hbdk',
    role:'人形 · 四足大脑', tint:'rgba(55,230,200,.24)',
    model:[
      {x:2,y:2,z:0,w:34,d:20,h:5,c:'#37e6c8'},
      {x:8,y:5,z:5,w:20,d:14,h:8,c:'#1f8f7d'},
      {x:9,y:6,z:13,w:18,d:2,h:2,c:C.metal},{x:9,y:10,z:13,w:18,d:2,h:2,c:C.metal},{x:9,y:14,z:13,w:18,d:2,h:2,c:C.metal},
      {x:31,y:6,z:5,w:4,d:12,h:5,c:'#ffd166'},
    ]},
  { id:'orangepi', nm:'香橙派', ch:'全志 / RK · 国产 SBC', via:'ssh',
    rt:'COS Runtime', w:1.05, tool:'ssh + systemd',
    role:'家用陪伴机器人', tint:'rgba(255,140,66,.24)',
    model:[
      {x:4,y:4,z:0,w:30,d:20,h:3,c:'#ff8c42'},
      {x:13,y:9,z:3,w:10,d:10,h:4,c:C.dark},
      {x:34,y:6,z:3,w:3,d:6,h:5,c:C.metal},{x:34,y:14,z:3,w:3,d:6,h:5,c:C.metal},
      {x:5,y:8,z:3,w:4,d:12,h:2,c:'#ffd166'},
    ]},
  { id:'radxa', nm:'Radxa Rock 5', ch:'RK3588 · 6 TOPS', via:'ssh',
    rt:'COS Runtime + NPU', w:1.10, tool:'ssh + rknn',
    role:'高算力上位机', tint:'rgba(11,61,145,.26)',
    model:[
      {x:4,y:4,z:0,w:30,d:20,h:3,c:'#0b3d91'},
      {x:13,y:9,z:3,w:10,d:10,h:4,c:C.dark},
      {x:14,y:10,z:7,w:8,d:1,h:2,c:C.metal},{x:14,y:13,z:7,w:8,d:1,h:2,c:C.metal},{x:14,y:16,z:7,w:8,d:1,h:2,c:C.metal},
      {x:34,y:8,z:3,w:3,d:8,h:5,c:C.metal},
    ]},
  { id:'luckfox', nm:'幸狐 Luckfox Pico', ch:'RV1106 · 0.5 TOPS · 百元 Linux', via:'ssh',
    rt:'COS Runtime (轻量)', w:1.15, tool:'ssh / adb',
    role:'微型视觉节点', tint:'rgba(58,125,68,.26)',
    model:[
      {x:12,y:9,z:0,w:16,d:9,h:3,c:'#3a7d44'},
      {x:8,y:11,z:3,w:4,d:5,h:5,c:C.metal},{x:9,y:12,z:8,w:2,d:3,h:1,c:'#5b8cff'},
      {x:18,y:12,z:3,w:6,d:4,h:2,c:C.dark},
    ]},
  { id:'milkv', nm:'Milk-V Duo', ch:'CV1800B · RISC-V Linux', via:'ssh',
    rt:'COS Runtime (轻量)', w:1.20, tool:'ssh (USB-RNDIS)',
    role:'微型 Linux 节点', tint:'rgba(233,196,106,.26)',
    model:[
      {x:12,y:9,z:0,w:16,d:8,h:3,c:'#e9c46a'},
      {x:18,y:11,z:3,w:5,d:4,h:2,c:C.dark},
      {x:10,y:11,z:3,w:3,d:4,h:2,c:C.metal},
      {x:13,y:8,z:3,w:14,d:1,h:2,c:'#ffd166'},{x:13,y:17,z:3,w:14,d:1,h:2,c:'#ffd166'},
    ]},
  { id:'beaglebone', nm:'BeagleBone', ch:'AM335x + PRU · 工业', via:'ssh',
    rt:'COS Runtime + PRU 实时', w:1.15, tool:'ssh',
    role:'工业实时 IO', tint:'rgba(214,40,40,.24)',
    model:[
      {x:4,y:4,z:0,w:30,d:18,h:3,c:'#d62828'},
      {x:14,y:9,z:3,w:9,d:9,h:4,c:C.dark},
      {x:34,y:8,z:3,w:3,d:8,h:6,c:C.metal},
      {x:5,y:3,z:3,w:28,d:1,h:2,c:C.dark},{x:5,y:22,z:3,w:28,d:1,h:2,c:C.dark},
    ]},
  { id:'coral', nm:'Google Coral', ch:'Edge TPU · 4 TOPS', via:'ssh',
    rt:'COS Runtime + TPU', w:1.15, tool:'ssh + edgetpu',
    role:'边缘视觉推理', tint:'rgba(244,162,97,.24)',
    model:[
      {x:4,y:4,z:0,w:30,d:20,h:3,c:'#f4a261'},
      {x:14,y:9,z:3,w:10,d:10,h:3,c:C.white},
      {x:16,y:11,z:6,w:6,d:6,h:1,c:'#37e6c8'},
      {x:34,y:8,z:3,w:3,d:8,h:5,c:C.metal},
    ]},
  { id:'x86', nm:'x86 工控机', ch:'Intel N100 / i5 · NUC', via:'ssh',
    rt:'COS Runtime (中控)', w:1.00, tool:'ssh + systemd / docker',
    role:'中控 · 上位机', tint:'rgba(61,74,104,.30)',
    model:[
      {x:6,y:4,z:0,w:28,d:22,h:14,c:'#3d4a68'},
      {x:6,y:4,z:14,w:28,d:22,h:2,c:C.metal},
      {x:8,y:6,z:16,w:2,d:2,h:1,c:'#37e6c8'},
      {x:34,y:8,z:3,w:2,d:5,h:4,c:C.dark},{x:34,y:15,z:3,w:2,d:5,h:4,c:C.dark},
    ]},
];

function shade(hex, k){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  if(k>1){ r+=(255-r)*(k-1); g+=(255-g)*(k-1); b+=(255-b)*(k-1); }
  else   { r*=k; g*=k; b*=k; }
  const h=v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0');
  return '#'+h(r)+h(g)+h(b);
}

function proj(x,y,z){ return [(x-y)*ISO.ax*ISO.s, ((x+y)*ISO.ay - z)*ISO.s]; }

function cube(b){
  const {x,y,z,w,d,h,c} = b;
  const P = (X,Y,Z)=>proj(X,Y,Z).join(',');
  // 顶面 / 左前面(y+d) / 右前面(x+w)
  const top   = `${P(x,y,z+h)} ${P(x+w,y,z+h)} ${P(x+w,y+d,z+h)} ${P(x,y+d,z+h)}`;
  const left  = `${P(x,y+d,z)} ${P(x+w,y+d,z)} ${P(x+w,y+d,z+h)} ${P(x,y+d,z+h)}`;
  const right = `${P(x+w,y,z)} ${P(x+w,y+d,z)} ${P(x+w,y+d,z+h)} ${P(x+w,y,z+h)}`;
  return `<polygon points="${left}"  fill="${shade(c,.72)}"/>`
       + `<polygon points="${right}" fill="${shade(c,.52)}"/>`
       + `<polygon points="${top}"   fill="${shade(c,1.18)}"/>`;
}

function isoSVG(parts, size){
  // 画家算法：远的先画（x+y+z 小的在后）
  const sorted = parts.slice().sort((a,b)=>
    (a.x+a.w/2 + a.y+a.d/2 + a.z+a.h/2) - (b.x+b.w/2 + b.y+b.d/2 + b.z+b.h/2));
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(const b of parts){
    for(const [dx,dy,dz] of [[0,0,0],[b.w,0,0],[0,b.d,0],[b.w,b.d,0],
                             [0,0,b.h],[b.w,0,b.h],[0,b.d,b.h],[b.w,b.d,b.h]]){
      const [px,py] = proj(b.x+dx, b.y+dy, b.z+dz);
      minX=Math.min(minX,px); maxX=Math.max(maxX,px);
      minY=Math.min(minY,py); maxY=Math.max(maxY,py);
    }
  }
  const pad=6, vw=maxX-minX+pad*2, vh=maxY-minY+pad*2;
  return `<svg width="${size}" height="${size}" viewBox="${minX-pad} ${minY-pad} ${vw} ${vh}">`
       + `<g stroke="rgba(4,8,16,.34)" stroke-width=".7" stroke-linejoin="round">`
       + sorted.map(cube).join('') + `</g></svg>`;
}

const KIND = [
  {re:/排查|排障|不转|不动|报错|失败|调试|为什么|异常|崩/,      lvl:'排障',   turns:[6,14], w:2.4},
  {re:/移植|迁移|换.*板|适配|兼容/,                          lvl:'移植',   turns:[5,10], w:2.0},
  {re:/接入|接一个|新增|加一个|添加|支持/,                    lvl:'加功能', turns:[4,8],  w:1.5},
  {re:/优化|重构|加速|降低|提速/,                            lvl:'优化',   turns:[3,7],  w:1.4},
  {re:/读|写|控制|驱动|跑|做一个|实现/,                       lvl:'新建',   turns:[3,6],  w:1.0},
];

const BASE_CTX = 5200;      // 系统提示 + 工具定义，每轮都要重发（会命中缓存）

const PER_TURN_READ = 2600; // 每轮平均读进来的文件/回显

const OUT_PER_TURN = 420;   // 每轮平均输出（含工具调用参数）

const PRICE = {hit:0.15, miss:4.5, out:13.5};

function estimate(text, plat){
  const t = (text||'').trim();
  if(!t) return null;
  let k = KIND.find(x=>x.re.test(t)) || KIND[KIND.length-1];
  const lenFactor = Math.min(2.2, 1 + t.length/220);
  const pw = plat ? plat.w : 1.1;
  const turns = [
    Math.max(2, Math.round(k.turns[0]*lenFactor*0.9)),
    Math.round(k.turns[1]*lenFactor)
  ];
  const mid = (turns[0]+turns[1])/2;
  // 输入侧：首轮全新，之后大部分命中缓存
  const miss = BASE_CTX + PER_TURN_READ*mid*0.35*pw;
  const hit  = BASE_CTX*(mid-1) + PER_TURN_READ*mid*0.65*pw;
  const out  = OUT_PER_TURN*mid*k.w;
  const total = miss+hit+out;
  const cost = miss/1e6*PRICE.miss + hit/1e6*PRICE.hit + out/1e6*PRICE.out;
  return {lvl:k.lvl, turns, total, miss, hit, out, cost};
}

function fmtTok(n){
  n = Math.round(n);
  if(n>=1e6) return (n/1e6).toFixed(2)+'M';
  if(n>=1e3) return (n/1e3).toFixed(1)+'k';
  return String(n);
}

function ansiToHtml(s){
  s = s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  let open = 0;
  s = s.replace(/\[([0-9;]*)m/g, (_, codes) => {
    const parts = codes.split(';').filter(x=>x!=='').map(Number);
    if(parts.length === 0 || parts.includes(0)){
      const close = '</span>'.repeat(open); open = 0; return close;
    }
    const color = parts.find(p => ANSI[p] !== undefined);
    const bold = parts.includes(1);
    if(color !== undefined || bold){
      open++;
      return `<span style="${color!==undefined?`color:${ANSI[color]};`:''}${bold?'font-weight:600;':''}">`;
    }
    return '';
  });
  s = s.replace(/\[[0-9;?]*[A-Za-z]/g, '');   // 光标移动之类的一律丢掉
  return s + '</span>'.repeat(open);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

window.COS_LEGACY = { C, PLATFORMS, isoSVG, estimate, fmtTok, ansiToHtml, sleep, PRICE };
