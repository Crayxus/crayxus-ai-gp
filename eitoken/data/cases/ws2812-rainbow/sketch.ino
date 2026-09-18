// EI TOKEN 案例 · 彩虹灯环
// WS2812 灯环流动出彩虹光
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int LED_DIN = 15;
#elif defined(ESP32)
const int LED_DIN = 19;
#else
const int LED_DIN = 6;
#endif

#include <Adafruit_NeoPixel.h>

const int NUM = 16;
Adafruit_NeoPixel ring(NUM, LED_DIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  ring.begin();
  ring.setBrightness(40);   // 先调暗，保护眼睛也省电
  Serial.println("EIT ws2812-rainbow ready");
}

void loop() {
  for (long hue = 0; hue < 65536; hue += 512) {
    for (int i = 0; i < NUM; i++) ring.setPixelColor(i, ring.gamma32(ring.ColorHSV(hue + i * 65536L / NUM)));
    ring.show();
    delay(10);
  }
  Serial.println("rainbow");
}
