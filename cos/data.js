/* COS 开发平台 · 示例数据
   这里的项目/模板/金额都是界面示例, 真实数据来自本机桥接(:8799)与 COS Runtime。 */
window.COS_DATA = {

  models: [
    { id:'auto',     nm:'自动选择模型' },
    { id:'deepseek', nm:'DeepSeek' },
    { id:'doubao',   nm:'豆包' },
    { id:'glm',      nm:'GLM' },
    { id:'qwen',     nm:'千问' },
  ],

  /* 首页三张示例卡 */
  starters: [
    { id:'rc',   ico:'🚗', nm:'遥控机器人', sub:'用遥控器控制机器人移动',   prompt:'用摇杆控制机器人前进、后退和转向，松开摇杆或遥控器断开时停车。请为机器人和遥控器都生成程序。' },
    { id:'arm',  ico:'🦾', nm:'机械臂抓取', sub:'识别物体并控制机械臂抓取', prompt:'摄像头识别桌面上的红色和蓝色积木，机械臂按颜色分类抓取放到两个筐里。' },
    { id:'buddy',ico:'🤖', nm:'陪伴机器人', sub:'实现语音对话与互动',       prompt:'陪伴机器人：听到叫名字就转头看人，能语音对话，没人说话时安静待机。' },
  ],

  chips: [
    '用遥控器控制机器人，松开摇杆时停车',
    '读 IMU 数据并做姿态解算',
    '接一个新的串口舵机总线',
    '雷达数据接入 + 避障',
    '摄像头取流做目标检测',
    '排查：电机不转但能读到位置',
  ],

  /* 示例项目 */
  projects: [
    {
      id:'rc', nm:'遥控机器人', ico:'🚗', ver:'v0.3', budget:100,
      devices:[
        { id:'d1', role:'机器人主控', plat:'pi',    conn:'网络连接 · Wi-Fi', env:'Python',      prog:'robot/main.py',  status:'已连接' },
        { id:'d2', role:'手持遥控器', plat:'esp32', conn:'USB · COM5',        env:'MicroPython', prog:'remote/main.py', status:'已连接' },
      ],
      link:{ a:'机器人主控', b:'手持遥控器', proto:'Wi-Fi / UDP', ver:'配套协议 v0.3' },
      modules:[
        { nm:'底盘电机', dev:'机器人主控', st:'已配置' },
        { nm:'摇杆模块', dev:'手持遥控器', st:'待确认接线' },
        { nm:'按键模块', dev:'手持遥控器', st:'待确认接线' },
      ],
      wiring:[ { nm:'摇杆模块接线', opts:['VRx→GPIO34 · VRy→GPIO35 · SW→GPIO32','VRx→GPIO36 · VRy→GPIO39 · SW→GPIO25'] },
               { nm:'按键模块接线', opts:['BTN→GPIO0 内部上拉','BTN→GPIO4 外部 10k 上拉'] } ],
      chat:[
        { who:'me', t:'用摇杆控制机器人前进、后退和转向，松开摇杆或遥控器断开时停车。请为机器人和遥控器都生成程序。', ts:'今天 14:23' },
        { who:'ai', plan:['机器人端：接收指令并控制运动','遥控器端：读取摇杆并发送指令','联合测试：检查通信、松杆停车与失联处理'],
          applied:'双设备遥控方案', est:'整体任务预计约 10M 原始 Token' },
      ],
      files:{
        'robot/main.py':
`import json
import socket
from chassis import drive, stop

TIMEOUT_SECONDS = 0.3

link = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
link.bind(("0.0.0.0", 9000))
link.settimeout(TIMEOUT_SECONDS)

while True:
    try:
        raw, peer = link.recvfrom(256)
        command = json.loads(raw)
        drive(command["throttle"], command["steer"])
    except socket.timeout:
        stop()

    # 其他异常单独处理，保证主循环稳定
    except Exception as e:
        print(f"[WARN] {e}")
        stop()`,
        'robot/chassis.py':
`# 底盘驱动：两路 H 桥 + PWM
from gpiozero import Motor

LEFT  = Motor(forward=12, backward=13)
RIGHT = Motor(forward=18, backward=19)

def drive(throttle, steer):
    l = max(-1, min(1, throttle + steer))
    r = max(-1, min(1, throttle - steer))
    LEFT.value, RIGHT.value = l, r

def stop():
    LEFT.stop(); RIGHT.stop()`,
        'remote/main.py':
`import json, socket, time
from joystick import read

PEER = ("192.168.4.1", 9000)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

while True:
    x, y, pressed = read()
    s.sendto(json.dumps({"throttle": y, "steer": x, "btn": pressed}).encode(), PEER)
    time.sleep(0.05)`,
        'remote/joystick.py':
`from machine import ADC, Pin

vrx = ADC(Pin(34)); vry = ADC(Pin(35)); sw = Pin(32, Pin.IN, Pin.PULL_UP)
for a in (vrx, vry): a.atten(ADC.ATTN_11DB)

def read():
    # 12 位 ADC → -1..1，中位死区 5%
    x = (vrx.read() - 2048) / 2048
    y = (vry.read() - 2048) / 2048
    x = 0 if abs(x) < 0.05 else x
    y = 0 if abs(y) < 0.05 else y
    return x, y, sw.value() == 0`,
        'shared/protocol.json':
`{
  "version": "0.3",
  "transport": "udp",
  "port": 9000,
  "timeout_ms": 300,
  "fields": { "throttle": "float -1..1", "steer": "float -1..1", "btn": "bool" }
}`,
        'requirements.txt': `gpiozero>=2.0`,
      },
    },
    { id:'arm', nm:'机械臂分类抓取', ico:'🦾', ver:'v0.2', budget:100,
      devices:[ { id:'d1', role:'视觉与规划', plat:'rdk',   conn:'网络连接 · SSH', env:'Python',   prog:'vision/main.py', status:'已连接' },
                { id:'d2', role:'关节控制',   plat:'stm32', conn:'串口 · COM60',     env:'C / HAL',  prog:'arm/main.c',     status:'已连接' } ],
      link:{ a:'视觉与规划', b:'关节控制', proto:'串口 230400', ver:'文本协议 v0.2' },
      modules:[ { nm:'六轴舵机', dev:'关节控制', st:'已配置' }, { nm:'USB 摄像头', dev:'视觉与规划', st:'已配置' } ],
      wiring:[], chat:[], files:{ 'vision/main.py': `# 摄像头取流 → 颜色分割 → 目标位姿 → 下发关节角\n`, 'arm/main.c': `// 关节 PID + 串口文本协议\n` } },
    { id:'buddy', nm:'陪伴机器人扩展', ico:'🤖', ver:'v0.1', budget:100,
      devices:[ { id:'d1', role:'大脑', plat:'pi', conn:'网络连接 · Wi-Fi', env:'Python', prog:'buddy/main.py', status:'已连接' },
                { id:'d2', role:'表情与舵机', plat:'xiao', conn:'USB · COM17', env:'C++ (Arduino)', prog:'face/face.ino', status:'未连接' } ],
      link:{ a:'大脑', b:'表情与舵机', proto:'串口 115200', ver:'文本协议 v0.1' },
      modules:[ { nm:'麦克风阵列', dev:'大脑', st:'已配置' }, { nm:'六路舵机', dev:'表情与舵机', st:'待确认接线' } ],
      wiring:[ { nm:'舵机总线接线', opts:['信号→D2 · 5V 独立供电','信号→D3 · 板载 5V(≤2 路)'] } ],
      chat:[], files:{ 'buddy/main.py': `# 唤醒词 → 转头 → 对话\n` } },
  ],

  /* 经验与模板 */
  templates: [
    { id:'t1', cat:'任务方案', nm:'双设备遥控方案', ico:'🎮', tags:['Raspberry Pi','ESP32'], sub:'生成机器人与遥控器的配套程序', ver:'v0.3', verified:true,
      devs:'Raspberry Pi + ESP32', includes:['两端源码','通信协议','接线说明','测试步骤'], team:'Crayxus 工程团队' },
    { id:'t2', cat:'驱动组件', nm:'舵机角度控制', ico:'⚙️', tags:['Arduino','ESP32'], sub:'配置舵机行程与动作参数', ver:'v0.2', verified:true,
      devs:'Arduino / ESP32', includes:['驱动源码','参数表','实机踩坑(LEDC 14bit)'], team:'Crayxus 工程团队' },
    { id:'t3', cat:'任务方案', nm:'距离检测与避障', ico:'📡', tags:['Raspberry Pi','STM32'], sub:'读取距离并触发停止动作', ver:'v0.1', verified:false,
      devs:'Raspberry Pi + STM32', includes:['雷达接入','避障状态机','测试步骤'], team:'Crayxus 工程团队' },
    { id:'t4', cat:'故障诊断', nm:'串口连接排障', ico:'🔌', tags:['诊断流程'], sub:'按步骤检查端口、驱动与通信', ver:'v0.1', verified:true,
      devs:'任意串口设备', includes:['端口漂移处理','驱动检查','回环测试'], team:'Crayxus 工程团队' },
    { id:'t5', cat:'硬件配置', nm:'ESP32-S3 USB 串口配置', ico:'🧩', tags:['ESP32-S3'], sub:'USBMode=hwcdc 与烧录参数', ver:'v1.0', verified:true,
      devs:'ESP32-S3 / XIAO', includes:['编译参数','烧录命令','常见报错'], team:'Crayxus 工程团队' },
    { id:'t6', cat:'任务方案', nm:'机械臂颜色分拣', ico:'🦾', tags:['RDK X5','STM32'], sub:'视觉识别 + 关节规划 + 抓取', ver:'v0.2', verified:false,
      devs:'RDK X5 + STM32', includes:['视觉源码','关节协议','标定步骤'], team:'Crayxus 工程团队' },
  ],
  templateCats: ['全部','硬件配置','驱动组件','任务方案','故障诊断'],

  /* 用量示例(没连桥接时显示) */
  usage: {
    balance:128.60, monthTokens:38.6e6, monthCost:71.40,
    byProject:[ { id:'rc', tok:10.0e6, cost:30.00 }, { id:'arm', tok:18.4e6, cost:27.60 }, { id:'buddy', tok:10.2e6, cost:13.80 } ],
    topups:[50,200,500],
  },

  /* 装置商城(概念商品, 价格为界面示例; 原型对应我们手上真实有的设备) */
  storeCats: ['全部','陪伴互动','机械臂','移动机器人','创客套件'],
  store: [
    { id:'s1', cat:'机械臂',   ico:'🦾', nm:'桌面机械臂',   sub:'抓取 · 分拣 · 动作编排',   tags:['Python','配套模板'], price:699,  fit:true,  proto:'ZYArm-X1 六轴 · 串口文本协议' },
    { id:'s2', cat:'移动机器人',ico:'🦿', nm:'迷你双足机器人', sub:'步态 · 遥控 · 自定义动作', tags:['开放 SDK'],          price:1299, fit:true,  proto:'Open Duck Mini v2 · Pi4 + 14 总线舵机' },
    { id:'s3', cat:'陪伴互动', ico:'🦧', nm:'AI 桌面伙伴',   sub:'对话 · 表情 · 陪伴游戏',   tags:['新手友好'],          price:399,  fit:true,  proto:'Gibby · 双目 + 六舵机 + 云端对话' },
    { id:'s4', cat:'移动机器人',ico:'🏎️', nm:'视觉巡游车',    sub:'视觉识别 · 避障 · 跟随',   tags:['Python','配套模板'], price:899,  fit:true,  proto:'AIGP 赛车 · Pi + ESP32-S3 + OV9281' },
    { id:'s5', cat:'移动机器人',ico:'🐕', nm:'迷你机器狗',    sub:'动作编排 · 舞蹈 · 遥控',   tags:['开放 SDK'],          price:1699, fit:false, proto:'四足 · Jetson' },
    { id:'s6', cat:'创客套件', ico:'🎮', nm:'遥控开发套件',   sub:'机器人与遥控器双端开发',   tags:['双设备项目'],        price:299,  fit:true,  proto:'Raspberry Pi + ESP32 + 摇杆模块' },
    { id:'s7', cat:'创客套件', ico:'🧩', nm:'即插即用传感器包', sub:'雷达 · IMU · 超声 · 摄像头', tags:['COS 驱动已备'],    price:459,  fit:true,  proto:'RPLIDAR C1 + BNO055 + OV9281' },
    { id:'s8', cat:'机械臂',   ico:'🤖', nm:'人形上半身',     sub:'双臂 · 头部 · 表情屏',     tags:['开放 SDK'],          price:4999, fit:false, proto:'RK3588 · 20 舵机' },
  ],

  /* 故障诊断: 常见症状 → 排查步骤(有桥接时交给 COS 真跑) */
  symptoms: [
    { id:'serial', nm:'串口连不上 / 烧录失败', steps:['列出当前串口, 确认设备号没有漂移','检查驱动(CH340 / CP210x / 板载 USB CDC)','ESP32-S3 检查 USBMode=hwcdc 编译参数','按住 BOOT 再上电进入下载模式重试'] },
    { id:'motor',  nm:'电机不转但能读到位置',   steps:['确认驱动板供电与共地','PWM 分辨率是否超过 LEDC 上限(14 bit)','读回使能引脚状态','用最小脚本单独驱动一路电机隔离问题'] },
    { id:'wifi',   nm:'Wi-Fi / UDP 掉线',       steps:['确认两端在同一网段','看超时停车是否触发(TIMEOUT_SECONDS)','抓 5 秒 UDP 包统计丢包','换 2.4G 信道或关闭省电'] },
    { id:'imu',    nm:'IMU 数据漂移',            steps:['静置 10 秒采零偏','确认 I2C 地址与上拉','检查采样率与滤波参数','对比温度变化下的漂移曲线'] },
    { id:'cam',    nm:'摄像头取不到流',          steps:['列出 /dev/video* 与支持格式','确认分辨率/帧率组合(OV9281 只出 YUY2)','排除被其他进程占用','用 v4l2 单帧抓图验证'] },
  ],
};
