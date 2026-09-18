// EI TOKEN 案例 · 数码管计时器
// 四位数码管显示分:秒，冒号一闪一闪
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int CLK_PIN = 4;
const int DIO_PIN = 5;
#elif defined(ESP32)
const int CLK_PIN = 4;
const int DIO_PIN = 16;
#else
const int CLK_PIN = 2;
const int DIO_PIN = 3;
#endif

#include <TM1637Display.h>

TM1637Display display(CLK_PIN, DIO_PIN);

void setup() {
  Serial.begin(115200);
  display.setBrightness(5);
  Serial.println("EIT tm1637-counter ready");
}

void loop() {
  unsigned long s = millis() / 1000;
  int mmss = (s / 60 % 100) * 100 + s % 60;
  bool colon = (millis() / 500) % 2;
  display.showNumberDecEx(mmss, colon ? 0b01000000 : 0, true);   // 冒号每半秒闪一次
  static unsigned long last = 99999;
  if (s != last) { last = s; Serial.print("time "); Serial.println(mmss); }
  delay(100);
}
