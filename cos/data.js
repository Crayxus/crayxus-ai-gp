/* EI TOKEN 具身智能开发平台 · 示例数据
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
      id:'humanoid', nm:'人形机器人', ico:'🧍', ver:'v0.4', budget:300, complex:true,
      devices:[
        { id:'d1', role:'主控计算板', plat:'rk',    conn:'以太网 · 192.168.1.108', env:'Python · ROS2 桥', prog:'brain/main.py',  status:'已连接' },
        { id:'d2', role:'运动控制板', plat:'stm32', conn:'CAN1 · 1 Mbps',          env:'C / HAL',          prog:'motion/main.c', status:'已连接' },
      ],
      link:{ a:'主控计算板', b:'运动控制板', proto:'CAN · 1 Mbps', ver:'关节协议 v0.4' },
      modules:[ { nm:'24 路关节电机', dev:'运动控制板', st:'已配置' }, { nm:'IMU', dev:'运动控制板', st:'已配置' }, { nm:'双目相机', dev:'主控计算板', st:'已配置' }, { nm:'足底压力', dev:'运动控制板', st:'已配置' } ],
      wiring:[],
      /* 全身诊断用的机器人本体: 关节按部位分组, 每个关节有 CAN 地址与实时量; 坐标是视图里的落点(0-300 × 0-480) */
      body:{
        model:'Humanoid H24', dof:24, bus:'CAN1 · 1 Mbps', ip:'192.168.1.108',
        parts:[
          { nm:'头部', joints:[ ['J01','颈部偏航',150,84], ['J02','颈部俯仰',150,98] ] },
          { nm:'腰部', joints:[ ['J03','腰部偏航',150,224], ['J04','腰部俯仰',150,244] ] },
          { nm:'左臂', joints:[ ['J05','肩部俯仰',96,112], ['J06','肩部侧摆',88,138], ['J07','肩部旋转',83,172], ['J08','肘部俯仰',78,214] ] },
          { nm:'右臂', joints:[ ['J09','肩部俯仰',204,112], ['J10','肩部侧摆',212,138], ['J11','肩部旋转',217,172], ['J12','肘部俯仰',222,214] ] },
          { nm:'左腿', joints:[ ['J13','髋部旋转',128,288], ['J14','髋部侧摆',124,308], ['J15','髋部俯仰',126,328], ['J16','膝部俯仰',126,374], ['J17','踝部俯仰',126,450], ['J18','踝部侧摆',126,466] ] },
          { nm:'右腿', joints:[ ['J19','髋部旋转',172,288], ['J20','髋部侧摆',176,308], ['J21','髋部俯仰',174,328], ['J22','膝部俯仰',174,374], ['J23','踝部俯仰',174,450], ['J24','踝部侧摆',174,466] ] },
        ],
        sensors:[ ['IMU','在线','🧭'], ['双目相机','在线','📷'], ['左足压力','在线','🦶'], ['右足压力','在线','🦶'], ['麦克风阵列','已配置','🎙️'], ['扬声器','已配置','🔊'] ],
        power:[ ['主控计算板','在线','🖥️'], ['运动控制板','在线','🎛️'], ['CAN 网关','在线','🔗'], ['电池 / BMS','在线','🔋'], ['电源分配板','已配置','⚡'], ['急停开关','已释放','🛑'] ],
        /* 实时量(示例): 温度阈值 65℃; J16 超阈值 → 预警 */
        live:{ J16:{ pos:32.4, temp:68, cur:1.8, volt:24.1, trend:[52,53,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68] } },
        threshold:65,
      },
      chat:[
        { who:'me', t:'人形机器人走路时左膝发热，先做一次全身检查，找出是电机、驱动还是机械阻力的问题。', ts:'今天 09:12' },
        { who:'ai', plan:['主控计算板：轮询 CAN 总线上 24 路关节的位置/温度/电流/电压','运动控制板：对异常关节做空载/带载对比测试','结论：温度超阈值且电流偏高 → 先查散热与机械阻力，再看驱动'],
          applied:'人形全身诊断流程', est:'整体任务预计约 24M 原始 Token' },
      ],
      files:{
        'brain/main.py':
`import time
from can_bus import Bus, JOINTS
from health import Watch

bus = Bus("can0", bitrate=1_000_000)
watch = Watch(temp_limit=65, current_limit=2.5)

# 24 路关节: 每 20ms 轮询一遍位置/温度/电流/电压(每帧 8 字节, 1Mbps 下一遍 < 4ms)
while True:
    for j in JOINTS:
        st = bus.read_state(j.addr)
        alarm = watch.check(j.id, st)
        if alarm:
            print(f"[WARN] {j.id} {j.name}: {alarm}")
            if alarm.startswith("temp"):
                bus.set_torque_limit(j.addr, 0.5)      # 先降半扭矩, 不停机, 等人来看
    time.sleep(0.02)`,
        'brain/can_bus.py':
`import can, struct
from collections import namedtuple

Joint = namedtuple("Joint", "id name addr part")
JOINTS = [Joint(f"J{i:02d}", n, 0x01 + i - 1, p) for i, (n, p) in enumerate([
    ("颈部偏航","头部"),("颈部俯仰","头部"),("腰部偏航","腰部"),("腰部俯仰","腰部"),
    ("肩部俯仰","左臂"),("肩部侧摆","左臂"),("肩部旋转","左臂"),("肘部俯仰","左臂"),
    ("肩部俯仰","右臂"),("肩部侧摆","右臂"),("肩部旋转","右臂"),("肘部俯仰","右臂"),
    ("髋部旋转","左腿"),("髋部侧摆","左腿"),("髋部俯仰","左腿"),("膝部俯仰","左腿"),("踝部俯仰","左腿"),("踝部侧摆","左腿"),
    ("髋部旋转","右腿"),("髋部侧摆","右腿"),("髋部俯仰","右腿"),("膝部俯仰","右腿"),("踝部俯仰","右腿"),("踝部侧摆","右腿"),
], 1)]

# 帧格式(关节协议 v0.4): 请求 id=0x100+addr 空帧; 回复 id=0x200+addr
#   pos int16 0.01° | temp int8 ℃ | cur int16 mA | volt uint16 10mV | flags uint8
class Bus:
    def __init__(self, ch, bitrate):
        self.b = can.interface.Bus(channel=ch, bustype="socketcan", bitrate=bitrate)
    def read_state(self, addr):
        self.b.send(can.Message(arbitration_id=0x100 + addr, data=[], is_extended_id=False))
        m = self.b.recv(timeout=0.01)
        if m is None or m.arbitration_id != 0x200 + addr:
            return None
        pos, temp, cur, volt, flags = struct.unpack("<hbhHB", m.data[:8])
        return dict(pos=pos / 100, temp=temp, cur=cur / 1000, volt=volt / 100, flags=flags)
    def set_torque_limit(self, addr, ratio):
        self.b.send(can.Message(arbitration_id=0x300 + addr, data=struct.pack("<B", int(ratio * 100)), is_extended_id=False))`,
        'brain/health.py':
`class Watch:
    '''每个关节的健康判定: 温度 / 电流 / 无回读'''
    def __init__(self, temp_limit, current_limit):
        self.tl, self.cl = temp_limit, current_limit
        self.miss = {}
    def check(self, jid, st):
        if st is None:
            self.miss[jid] = self.miss.get(jid, 0) + 1
            return "no-reply x%d" % self.miss[jid] if self.miss[jid] >= 3 else None
        self.miss[jid] = 0
        if st["temp"] >= self.tl:
            return f"temp {st['temp']}℃ ≥ {self.tl}℃"
        if st["cur"] >= self.cl:
            return f"current {st['cur']:.1f}A ≥ {self.cl}A"
        return None`,
        'motion/main.c':
`#include "main.h"
/* 运动控制板: 24 路关节 CAN 从站聚合 + 1kHz 步态循环
 * 主控只发目标(0x400+addr: pos int16 0.01°), 本板做电流环/位置环, 主控读状态(0x100/0x200)。
 * 温度由每个关节驱动板回读, 本板转发; 阈值判断在主控做, 本板只执行降扭矩(0x300)。 */
extern CAN_HandleTypeDef hcan1;
static int16_t target[24], pos[24]; static int8_t temp[24]; static int16_t cur[24]; static uint8_t torque_pct[24];

static void gait_tick(void){                      /* 1kHz */
    for(int j = 0; j < 24; j++){
        int32_t err = target[j] - pos[j];
        int32_t u = err * 8 / 10;                  /* P 环, 单位 0.01° → mA 粗略 */
        if(u >  2500) u =  2500; if(u < -2500) u = -2500;
        u = u * torque_pct[j] / 100;
        drive_current(j, (int16_t)u);
    }
}
void HAL_CAN_RxFifo0MsgPendingCallback(CAN_HandleTypeDef *h){
    CAN_RxHeaderTypeDef hd; uint8_t d[8];
    HAL_CAN_GetRxMessage(h, CAN_RX_FIFO0, &hd, d);
    uint16_t id = hd.StdId; int a = id & 0xFF;
    if((id & 0xF00) == 0x400 && a < 24){ target[a] = (int16_t)(d[0] | d[1] << 8); }
    else if((id & 0xF00) == 0x300 && a < 24){ torque_pct[a] = d[0]; }
    else if((id & 0xF00) == 0x100 && a < 24){ can_reply_state(a, pos[a], temp[a], cur[a]); }
}
int main(void){
    HAL_Init(); SystemClock_Config(); MX_CAN1_Init(); MX_TIM6_Init();   /* TIM6 1kHz → gait_tick */
    for(int j = 0; j < 24; j++) torque_pct[j] = 100;
    HAL_CAN_Start(&hcan1); HAL_CAN_ActivateNotification(&hcan1, CAN_IT_RX_FIFO0_MSG_PENDING);
    for(;;){ HAL_Delay(1); }
}`,
        'shared/joints.yaml':
`# 关节协议 v0.4 · CAN1 1Mbps
bus: can0
bitrate: 1000000
frames:
  request_state: 0x100+addr   # 空帧
  reply_state:   0x200+addr   # pos int16(0.01°) temp int8 cur int16(mA) volt u16(10mV) flags u8
  torque_limit:  0x300+addr   # u8 percent
  target_pos:    0x400+addr   # int16 0.01°
limits:
  temp_c: 65
  current_a: 2.5
joints: J01..J24  # 地址 0x01..0x18, 分组见 can_bus.py`,
        'requirements.txt': `python-can>=4.3\npyyaml`,
      },
    },
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
        'ui/RoomPanel.tsx':
`export function RoomPanel() {
  return (
    <TaskPanel title="房间建图遥控台">
      <SlamMap source="map" />
      <CameraView source="video" />
      <RobotPose source="pose" />
      <DrivePad
        onMove={actions.drive}
        onRelease={actions.stop}
      />
      <SaveMap onClick={actions.saveMap} />
    </TaskPanel>
  );
}`,
        'ui/components/DrivePad.tsx':
`// 屏幕遥控器：按住移动，松开即停（对应机器人端 TIMEOUT_SECONDS 失联停车）
export function DrivePad({ onMove, onRelease, size = "normal" }) {
  const dirs = [["↑", 1, 0], ["←", 0, -1], ["→", 0, 1], ["↓", -1, 0]];
  return (
    <div className={"pad " + size}>
      {dirs.map(([k, t, s]) => (
        <button key={k} onPointerDown={() => onMove(t, s)} onPointerUp={onRelease}>{k}</button>
      ))}
      <button className="stop" onClick={onRelease}>■</button>
    </div>
  );
}`,
        'shared/bindings.json':
`{
  "map":   { "topic": "/slam/map",  "type": "occupancy_grid", "rate_hz": 2 },
  "video": { "topic": "/camera/mjpeg", "type": "mjpeg", "rate_hz": 15 },
  "pose":  { "topic": "/slam/pose", "type": "pose2d", "rate_hz": 10 },
  "actions": {
    "drive":   { "udp": "robot:9000", "payload": { "throttle": "float", "steer": "float" } },
    "stop":    { "udp": "robot:9000", "payload": { "throttle": 0, "steer": 0 } },
    "saveMap": { "http": "POST robot:8080/map/save" }
  }
}`,
        'requirements.txt': `gpiozero>=2.0`,
      },
      ui:{ title:'房间建图遥控台', sub:'遥控探索房间，实时查看地图与画面', caps:['地图与位姿','相机视频','移动与停止'] },
    },
    { id:'arm', nm:'机械臂分类抓取', ico:'🦾', ver:'v0.2', budget:100,
      devices:[ { id:'d1', role:'视觉与规划', plat:'rdk',   conn:'网络连接 · SSH', env:'Python',   prog:'vision/main.py', status:'已连接' },
                { id:'d2', role:'关节控制',   plat:'stm32', conn:'串口 · COM60',     env:'C / HAL',  prog:'arm/main.c',     status:'已连接' } ],
      link:{ a:'视觉与规划', b:'关节控制', proto:'串口 230400', ver:'文本协议 v0.2' },
      modules:[ { nm:'六轴舵机', dev:'关节控制', st:'已配置' }, { nm:'USB 摄像头', dev:'视觉与规划', st:'已配置' } ],
      wiring:[],
      chat:[
        { who:'me', t:'摄像头识别桌面上的红色和蓝色积木，机械臂按颜色分类抓取放到两个筐里。', ts:'今天 10:05' },
        { who:'ai', plan:['视觉与规划：取流 → HSV 分色 → 像素坐标换算到臂坐标','关节控制：串口收目标角，六路舵机插补到位','联合测试：单色 5 次抓取成功率 ≥ 4/5 再开双色'],
          applied:'机械臂颜色分拣', est:'整体任务预计约 18M 原始 Token' },
      ],
      files:{
        'vision/main.py':
`import cv2, json, time, serial
import numpy as np
from calib import pixel_to_arm

# 颜色阈值(HSV)。红色跨 0/180 两段, 蓝色一段。现场光线变了先改这里, 别改算法。
COLORS = {
    "red":  [((0, 120, 80), (10, 255, 255)), ((170, 120, 80), (180, 255, 255))],
    "blue": [((100, 120, 80), (125, 255, 255))],
}
BINS = {"red": (180, -120), "blue": (180, 120)}     # 两个筐在臂坐标系里的位置(mm)

arm = serial.Serial("/dev/ttyUSB0", 230400, timeout=0.5)
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640); cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

def send(cmd):
    arm.write((cmd + "\\n").encode())
    return arm.readline().decode().strip()          # 固件回 OK / BUSY / ERR

def find(frame, color):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = None
    for lo, hi in COLORS[color]:
        m = cv2.inRange(hsv, np.array(lo), np.array(hi))
        mask = m if mask is None else (mask | m)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = [c for c in cnts if cv2.contourArea(c) > 600]
    if not cnts:
        return None
    x, y, w, h = cv2.boundingRect(max(cnts, key=cv2.contourArea))
    return (x + w / 2, y + h / 2)

while True:
    ok, frame = cap.read()
    if not ok:
        continue
    for color in ("red", "blue"):
        px = find(frame, color)
        if not px:
            continue
        X, Y = pixel_to_arm(*px)
        print(f"[{color}] px={px} → arm=({X:.0f},{Y:.0f})")
        send(f"MOVE {X:.0f} {Y:.0f} 60")            # 先悬停在积木上方 60mm
        send(f"MOVE {X:.0f} {Y:.0f} 12")
        send("GRIP 1")
        send(f"MOVE {X:.0f} {Y:.0f} 80")
        bx, by = BINS[color]
        send(f"MOVE {bx} {by} 80")
        send("GRIP 0")
        send("HOME")
        time.sleep(0.5)
        break                                       # 一次只处理一块, 抓完重新取流`,
        'vision/calib.py':
`import json, numpy as np, cv2

# 四个标定点: 桌面上贴四个 ArUco/十字标记, 分别量出它们在臂坐标系的 mm 位置
# 然后在画面里点出对应像素, 存进 calib.json。之后 pixel_to_arm 就是一个单应变换。
try:
    C = json.load(open("calib.json"))
    H = cv2.findHomography(np.float32(C["pixels"]), np.float32(C["arm_mm"]))[0]
except FileNotFoundError:
    H = None

def pixel_to_arm(u, v):
    if H is None:
        raise RuntimeError("先跑 calib: 没有 calib.json")
    p = H @ np.array([u, v, 1.0])
    return p[0] / p[2], p[1] / p[2]`,
        'arm/main.c':
`#include "main.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

/* 六轴舵机机械臂 · 串口文本协议 v0.2 (230400 8N1)
 *   MOVE x y z      笛卡尔目标(mm), 固件做逆解 + 插补
 *   GRIP 1|0        夹爪
 *   HOME            回零
 *   STOP            急停(当前位置保持)
 * 每条回 OK / BUSY / ERR <msg>
 * 实机踩坑: 舵机 2·7 运动后偶发读超时, 靠重发 + 稀读; 3°/s 太慢, 插补步进用 15°/s */
extern UART_HandleTypeDef huart1;
extern TIM_HandleTypeDef  htim2, htim3;           /* 6 路 PWM, 50Hz */

static float cur[6] = {90, 90, 90, 90, 90, 90};   /* 当前关节角 */
static char  rx[64]; static int rxi = 0;

static void servo_write(int j, float deg){
    uint32_t pulse = 500 + (uint32_t)(deg * 2000.0f / 180.0f);   /* 500~2500us */
    if(j < 3) __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1 + 4*j, pulse);
    else      __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1 + 4*(j-3), pulse);
}
static void goto_joints(const float *tgt){        /* 15°/s 线性插补, 20ms 一步 */
    for(int step = 0; step < 100; step++){
        int done = 1;
        for(int j = 0; j < 6; j++){
            float d = tgt[j] - cur[j];
            if(d >  0.3f){ cur[j] += 0.3f; done = 0; }
            if(d < -0.3f){ cur[j] -= 0.3f; done = 0; }
            servo_write(j, cur[j]);
        }
        HAL_Delay(20);
        if(done) break;
    }
}
static void reply(const char *s){ HAL_UART_Transmit(&huart1, (uint8_t*)s, strlen(s), 100); HAL_UART_Transmit(&huart1, (uint8_t*)"\\n", 1, 10); }

static void handle(char *line){
    float tgt[6];
    if(!strncmp(line, "MOVE", 4)){
        float x = atof(strtok(line + 5, " ")), y = atof(strtok(NULL, " ")), z = atof(strtok(NULL, " "));
        if(!ik_solve(x, y, z, tgt)){ reply("ERR unreachable"); return; }
        goto_joints(tgt); reply("OK");
    }else if(!strncmp(line, "GRIP", 4)){ servo_write(5, line[5]=='1' ? 30 : 90); HAL_Delay(300); reply("OK"); }
    else if(!strcmp(line, "HOME")){ float h[6] = {90,90,90,90,90,90}; goto_joints(h); reply("OK"); }
    else if(!strcmp(line, "STOP")){ reply("OK"); }
    else reply("ERR unknown");
}
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *h){
    if(rx[rxi] == '\\n'){ rx[rxi] = 0; handle(rx); rxi = 0; }
    else if(rxi < 62) rxi++;
    HAL_UART_Receive_IT(&huart1, (uint8_t*)&rx[rxi], 1);
}
int main(void){
    HAL_Init(); SystemClock_Config(); MX_GPIO_Init(); MX_USART1_UART_Init(); MX_TIM2_Init(); MX_TIM3_Init();
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1); /* ...其余 5 路同理 */
    HAL_UART_Receive_IT(&huart1, (uint8_t*)&rx[0], 1);
    for(;;){ HAL_Delay(100); }
}`,
        'arm/ik.c':
`#include <math.h>
/* 三连杆平面逆解 + 底座旋转, 单位 mm/deg。L1 L2 L3 按实物量。 */
#define L1 105.0f
#define L2 98.0f
#define L3 150.0f
int ik_solve(float x, float y, float z, float *j){
    float base = atan2f(y, x);
    float r = sqrtf(x*x + y*y) - L3, h = z - 80.0f;     /* 末端保持竖直向下 */
    float d = sqrtf(r*r + h*h);
    if(d > L1 + L2 || d < fabsf(L1 - L2)) return 0;
    float a = acosf((L1*L1 + d*d - L2*L2) / (2*L1*d)), b = acosf((L1*L1 + L2*L2 - d*d) / (2*L1*L2));
    j[0] = 90 + base * 57.2958f;
    j[1] = (atan2f(h, r) + a) * 57.2958f;
    j[2] = b * 57.2958f;
    j[3] = 180 - j[1] - j[2];                          /* 腕保持竖直 */
    j[4] = 90; j[5] = 90;
    return 1;
}`,
        'shared/protocol.md':
`# 视觉 ↔ 机械臂 文本协议 v0.2
串口 230400 8N1，每条以 \\n 结尾，固件逐条应答。

| 指令 | 含义 | 应答 |
|---|---|---|
| MOVE x y z | 末端到 (x,y,z) mm，固件逆解 + 15°/s 插补 | OK / ERR unreachable |
| GRIP 1\\|0 | 夹爪 合/开 | OK |
| HOME | 回零 | OK |
| STOP | 保持当前位置 | OK |

坐标系原点在底座中心，x 朝前，y 朝左，z 朝上。`,
        'requirements.txt': `opencv-python>=4.9\nnumpy\npyserial`,
      } },
    { id:'buddy', nm:'陪伴机器人扩展', ico:'🤖', ver:'v0.1', budget:100,
      devices:[ { id:'d1', role:'大脑', plat:'pi', conn:'网络连接 · Wi-Fi', env:'Python', prog:'buddy/main.py', status:'已连接' },
                { id:'d2', role:'表情与舵机', plat:'xiao', conn:'USB · COM17', env:'C++ (Arduino)', prog:'face/face.ino', status:'未连接' } ],
      link:{ a:'大脑', b:'表情与舵机', proto:'串口 115200', ver:'文本协议 v0.1' },
      modules:[ { nm:'麦克风阵列', dev:'大脑', st:'已配置' }, { nm:'六路舵机', dev:'表情与舵机', st:'待确认接线' } ],
      wiring:[ { nm:'舵机总线接线', opts:['信号→D2 · 5V 独立供电','信号→D3 · 板载 5V(≤2 路)'] } ],
      chat:[
        { who:'me', t:'陪伴机器人：听到叫名字就转头看人，能语音对话，没人说话时安静待机。', ts:'昨天 21:40' },
        { who:'ai', plan:['大脑：唤醒词 → 定位人脸 → 云端对话 → 播报','表情与舵机：串口收 FACE / HEAD 指令驱动六路舵机','待机策略：3 分钟没人说话降到 IDLE，主动开口有频控'],
          applied:'陪伴机器人状态机', est:'整体任务预计约 10M 原始 Token' },
      ],
      files:{
        'buddy/main.py':
`import time, serial, cv2
from state import Machine, IDLE, ALERT, TALK
from chat import ask, say, listen, heard_name

face_mcu = serial.Serial("/dev/ttyACM0", 115200, timeout=0.2)
cam = cv2.VideoCapture(0)
detector = cv2.FaceDetectorYN.create("yunet.onnx", "", (320, 240))   # YuNet: Pi 上 ~15fps 够用

def mcu(cmd):
    face_mcu.write((cmd + "\\n").encode())

def face_center():
    ok, frame = cam.read()
    if not ok: return None
    frame = cv2.resize(frame, (320, 240))
    _, faces = detector.detect(frame)
    if faces is None: return None
    x, y, w, h = faces[0][:4]
    return (x + w/2) / 320, (y + h/2) / 240                 # 0..1

m = Machine()
mcu("FACE sleepy")
while True:
    st = m.state
    if st == IDLE:
        if heard_name():                                     # 唤醒词
            m.to(ALERT); mcu("FACE curious")
        time.sleep(0.2)
    elif st == ALERT:                                        # 转头找人, 找到就进对话
        c = face_center()
        if c:
            pan  = int(90 + (0.5 - c[0]) * 60)               # 画面偏左 → 头往左转
            tilt = int(90 + (0.5 - c[1]) * 30)
            mcu(f"HEAD {pan} {tilt}")
            m.to(TALK); mcu("FACE happy")
            say("我在。")
        elif m.elapsed() > 4:
            m.to(IDLE); mcu("FACE sleepy")
    elif st == TALK:
        text = listen(timeout=6)
        if not text:
            if m.elapsed() > 180:                            # 3 分钟没人说话 → 待机
                m.to(IDLE); mcu("FACE sleepy")
            continue
        mcu("FACE thinking")
        reply = ask(text)
        mcu("FACE talk")
        say(reply)
        m.touch()`,
        'buddy/state.py':
`import time
IDLE, ALERT, TALK = "IDLE", "ALERT", "TALK"

class Machine:
    def __init__(self):
        self.state, self.t0 = IDLE, time.time()
    def to(self, s):
        print(f"[state] {self.state} → {s}")
        self.state, self.t0 = s, time.time()
    def touch(self):
        self.t0 = time.time()
    def elapsed(self):
        return time.time() - self.t0`,
        'buddy/chat.py':
`import os, json, time, subprocess, urllib.request

GATEWAY = os.environ.get("COS_LLM_GATEWAY", "https://safegate-2rw7.onrender.com/v1/chat/completions")
KEY     = os.environ["COS_LLM_KEY"]                         # 不要写死在代码里
SYSTEM  = "你是一个桌面陪伴机器人, 说话简短温和, 每次不超过两句。"
_last_proactive = 0

def ask(text):
    body = {"model": "doubao", "temperature": 0.6, "max_tokens": 120,
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]}
    req = urllib.request.Request(GATEWAY, data=json.dumps(body, ensure_ascii=False).encode(),
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["choices"][0]["message"]["content"].strip()

def say(text):                                              # 本地 TTS, 换成你喜欢的引擎
    subprocess.run(["espeak-ng", "-v", "cmn", text])

def listen(timeout=6):                                      # 录音 → 识别, 这里用 vosk 离线
    from vosk_io import transcribe
    return transcribe(seconds=timeout)

def heard_name():
    t = listen(timeout=2)
    return t and ("小吉" in t or "Gibby" in t.lower())

def may_speak_proactively():                                # 主动开口频控: 10 分钟最多一次
    global _last_proactive
    if time.time() - _last_proactive > 600:
        _last_proactive = time.time(); return True
    return False`,
        'face/face.ino':
`// XIAO ESP32-S3 · 表情 + 六路舵机
// 编译必须带 USBMode=hwcdc, 否则 Serial 收不到任何数据(实机踩坑)
// LEDC 最高 14 bit, 舵机用 14 bit + 50Hz
#include <Arduino.h>
const int SERVO_PIN[6] = {D0, D1, D2, D3, D6, D7};   // D8/D9/D10 被 SD 卡占了, 别用
const int CH[6] = {0, 1, 2, 3, 4, 5};
String face = "sleepy";

void servoWrite(int i, int deg){
  int us = 500 + deg * 2000 / 180;
  ledcWrite(CH[i], (uint32_t)us * 16384 / 20000);     // 14 bit @ 50Hz → 20000us 满量程
}
void setFace(const String& f){                        // 眉/眼/嘴三组舵机的姿态表
  face = f;
  if(f == "sleepy")   { servoWrite(2, 60);  servoWrite(3, 60);  servoWrite(4, 90); }
  if(f == "curious")  { servoWrite(2, 110); servoWrite(3, 80);  servoWrite(4, 95); }
  if(f == "happy")    { servoWrite(2, 100); servoWrite(3, 100); servoWrite(4, 130); }
  if(f == "thinking") { servoWrite(2, 95);  servoWrite(3, 70);  servoWrite(4, 85); }
  if(f == "talk")     { servoWrite(4, 110); }
}
void setup(){
  Serial.begin(115200);
  for(int i = 0; i < 6; i++){ ledcSetup(CH[i], 50, 14); ledcAttachPin(SERVO_PIN[i], CH[i]); servoWrite(i, 90); }
  setFace("sleepy");
}
void loop(){
  if(!Serial.available()) return;
  String line = Serial.readStringUntil('\\n'); line.trim();
  if(line.startsWith("FACE ")) setFace(line.substring(5));
  else if(line.startsWith("HEAD ")){
    int sp = line.indexOf(' ', 5);
    int pan = line.substring(5, sp).toInt(), tilt = line.substring(sp + 1).toInt();
    servoWrite(0, constrain(pan, 30, 150)); servoWrite(1, constrain(tilt, 60, 120));
  }
  Serial.println("OK");
}`,
        'shared/protocol.json':
`{
  "version": "0.1",
  "transport": "serial 115200",
  "commands": {
    "FACE <sleepy|curious|happy|thinking|talk>": "切换表情姿态",
    "HEAD <pan 30-150> <tilt 60-120>": "转头"
  },
  "reply": "OK"
}`,
        'requirements.txt': `opencv-python>=4.9\npyserial\nvosk`,
      } },
  ],

  /* 经验与模板 */
  templates: [
    { id:'t1', cat:'任务方案', nm:'双设备遥控方案', ico:'🎮', tags:['Raspberry Pi','ESP32'], sub:'生成机器人与遥控器的配套程序', ver:'v0.3', verified:true,
      devs:'Raspberry Pi + ESP32', includes:['两端源码','通信协议','接线说明','测试步骤'], team:'EI Token 工程团队' },
    { id:'t2', cat:'驱动组件', nm:'舵机角度控制', ico:'⚙️', tags:['Arduino','ESP32'], sub:'配置舵机行程与动作参数', ver:'v0.2', verified:true,
      devs:'Arduino / ESP32', includes:['驱动源码','参数表','实机踩坑(LEDC 14bit)'], team:'EI Token 工程团队' },
    { id:'t3', cat:'任务方案', nm:'距离检测与避障', ico:'📡', tags:['Raspberry Pi','STM32'], sub:'读取距离并触发停止动作', ver:'v0.1', verified:false,
      devs:'Raspberry Pi + STM32', includes:['雷达接入','避障状态机','测试步骤'], team:'EI Token 工程团队' },
    { id:'t4', cat:'故障诊断', nm:'串口连接排障', ico:'🔌', tags:['诊断流程'], sub:'按步骤检查端口、驱动与通信', ver:'v0.1', verified:true,
      devs:'任意串口设备', includes:['端口漂移处理','驱动检查','回环测试'], team:'EI Token 工程团队' },
    { id:'t5', cat:'硬件配置', nm:'ESP32-S3 USB 串口配置', ico:'🧩', tags:['ESP32-S3'], sub:'USBMode=hwcdc 与烧录参数', ver:'v1.0', verified:true,
      devs:'ESP32-S3 / XIAO', includes:['编译参数','烧录命令','常见报错'], team:'EI Token 工程团队' },
    { id:'t6', cat:'任务方案', nm:'机械臂颜色分拣', ico:'🦾', tags:['RDK X5','STM32'], sub:'视觉识别 + 关节规划 + 抓取', ver:'v0.2', verified:false,
      devs:'RDK X5 + STM32', includes:['视觉源码','关节协议','标定步骤'], team:'EI Token 工程团队' },
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
    { id:'s7', cat:'创客套件', ico:'🧩', nm:'即插即用传感器包', sub:'雷达 · IMU · 超声 · 摄像头', tags:['EI Token 已适配'],    price:459,  fit:true,  proto:'RPLIDAR C1 + BNO055 + OV9281' },
    { id:'s8', cat:'机械臂',   ico:'🤖', nm:'人形上半身',     sub:'双臂 · 头部 · 表情屏',     tags:['开放 SDK'],          price:4999, fit:false, proto:'RK3588 · 20 舵机' },
  ],

  /* 仿真工作台(界面示例; Open Duck Mini 的步态就是 MuJoCo RL 策略, 这里的接口就是给它留的) */
  sim: {
    engines: [ { id:'isaac', nm:'Isaac Sim 6.0', ic:'🟩', st:'当前引擎' }, { id:'mujoco', nm:'MuJoCo', ic:'Ⓜ️', st:'配置接口' }, { id:'gazebo', nm:'Gazebo', ic:'🟧', st:'配置接口' } ],
    envs: ['本地工作站','远程工作站'], gpus: ['GPU-01','GPU-02'],
    scenes: ['室内平地测试场','斜坡与台阶','狭窄通道'], controllers: ['H24 步行控制器 v0.3','H24 站立平衡 v0.2'],
    task: { dist:2.0, speed:0.30, turn:180 },
    segments: [ ['站立','准备',0,3], ['前进','2 m',3,12], ['转身','180°',12,16], ['挥手','',16,20] ],
    instance:'SIM-024', model:'humanoid_h24.usd',
  },

  /* 故障诊断: 常见症状 → 排查步骤(有桥接时交给 COS 真跑) */
  symptoms: [
    { id:'serial', nm:'串口连不上 / 烧录失败', steps:['列出当前串口, 确认设备号没有漂移','检查驱动(CH340 / CP210x / 板载 USB CDC)','ESP32-S3 检查 USBMode=hwcdc 编译参数','按住 BOOT 再上电进入下载模式重试'] },
    { id:'motor',  nm:'电机不转但能读到位置',   steps:['确认驱动板供电与共地','PWM 分辨率是否超过 LEDC 上限(14 bit)','读回使能引脚状态','用最小脚本单独驱动一路电机隔离问题'] },
    { id:'wifi',   nm:'Wi-Fi / UDP 掉线',       steps:['确认两端在同一网段','看超时停车是否触发(TIMEOUT_SECONDS)','抓 5 秒 UDP 包统计丢包','换 2.4G 信道或关闭省电'] },
    { id:'imu',    nm:'IMU 数据漂移',            steps:['静置 10 秒采零偏','确认 I2C 地址与上拉','检查采样率与滤波参数','对比温度变化下的漂移曲线'] },
    { id:'cam',    nm:'摄像头取不到流',          steps:['列出 /dev/video* 与支持格式','确认分辨率/帧率组合(OV9281 只出 YUY2)','排除被其他进程占用','用 v4l2 单帧抓图验证'] },
  ],
};
