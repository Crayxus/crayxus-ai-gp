// EI TOKEN 案例 · 红外遥控
// 机身自带红外收发：先学一个家电遥控器的码，再按头顶把它重发出去
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>
#include <IRremoteESP8266.h>
#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>

static const uint16_t kIrRecvPin = 10;   // 机身红外接收脚
static const uint16_t kIrSendPin = 5;    // 机身红外发射脚
static const uint16_t kCaptureBufferSize = 1024;
static const uint8_t kTimeout = 15;      // 一帧结束判定（毫秒）

IRrecv irrecv(kIrRecvPin, kCaptureBufferSize, kTimeout, true);
IRsend irsend(kIrSendPin);
decode_results results;

// 学到的码直接存原始时序，不管什么协议都能照抄一遍重发
static uint16_t *raw_data = nullptr;
static uint16_t raw_len = 0;
static String learned_name = "";

void forget() {
  if (raw_data) { delete[] raw_data; raw_data = nullptr; }
  raw_len = 0;
  learned_name = "";
}

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();

  // 只收发红外，不动脖子
  M5StackChan.setServoPowerEnabled(false);

  M5StackChan.Display().setTextSize(2);
  M5StackChan.Display().setTextScroll(true);
  M5StackChan.Display().setTextColor(TFT_GREENYELLOW);
  M5StackChan.Display().printf("> aim remote, press key\n");

  irsend.begin();
  irrecv.enableIRIn();

  M5StackChan.showRgbColor(0, 0, 60);   // 蓝色 = 正在学
  Serial.println("EIT sc-ir ready");
  Serial.println("learning: point a remote at me and press a key");
}

void loop() {
  M5StackChan.update();

  // 还没学到码：一直听
  if (raw_len == 0 && irrecv.decode(&results)) {
    uint16_t len = getCorrectedRawLength(&results);
    if (len >= 8) {                       // 太短的多半是干扰
      forget();
      raw_data = resultToRawArray(&results);
      raw_len = len;
      learned_name = typeToString(results.decode_type, results.repeat);
      M5StackChan.showRgbColor(0, 60, 0); // 绿色 = 学会了
      M5StackChan.Display().printf("> learned %s (%d)\n", learned_name.c_str(), raw_len);
      Serial.printf("learned %s bits=%d raw=%d\n", learned_name.c_str(), results.bits, raw_len);
      Serial.println("tap the top to replay, hold to relearn");
    }
    irrecv.resume();
  }

  // 学会之后：点一下头顶重发
  if (raw_len > 0 && M5StackChan.TouchSensor.wasClicked()) {
    irrecv.disableIRIn();                 // 发的时候先把接收关掉，免得自己收自己
    irsend.sendRaw(raw_data, raw_len, 38);// 家用遥控基本都是 38kHz 载波
    irrecv.enableIRIn();
    M5StackChan.showRgbColor(120, 90, 0);
    M5StackChan.Display().printf("> sent %s\n", learned_name.c_str());
    Serial.printf("sent %s raw=%d\n", learned_name.c_str(), raw_len);
    delay(150);
    M5StackChan.showRgbColor(0, 60, 0);
  }

  // 长按两秒忘掉，重新学一个
  if (raw_len > 0 && M5StackChan.TouchSensor.pressedFor(2000)) {
    forget();
    M5StackChan.showRgbColor(0, 0, 60);
    M5StackChan.Display().printf("> forget, learning again\n");
    Serial.println("forget, learning again");
    irrecv.resume();
    delay(500);
  }

  delay(20);
}
