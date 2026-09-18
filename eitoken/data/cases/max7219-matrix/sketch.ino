// EI TOKEN 案例 · 点阵滚动字
// 8×8 点阵上画出笑脸和爱心
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int DIN_PIN = 39;
const int CLK_PIN = 40;
const int CS_PIN = 38;
#elif defined(ESP32)
const int DIN_PIN = 14;
const int CLK_PIN = 13;
const int CS_PIN = 27;
#else
const int DIN_PIN = 11;
const int CLK_PIN = 13;
const int CS_PIN = 10;
#endif

#include <MD_MAX72xx.h>

MD_MAX72XX mx(MD_MAX72XX::FC16_HW, DIN_PIN, CLK_PIN, CS_PIN, 1);

const uint8_t SMILE[8] = {0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C};
const uint8_t HEART[8] = {0x00, 0x66, 0xFF, 0xFF, 0x7E, 0x3C, 0x18, 0x00};

void draw(const uint8_t *img) {
  for (int r = 0; r < 8; r++) mx.setRow(0, r, img[r]);
}

void setup() {
  Serial.begin(115200);
  mx.begin();
  mx.control(MD_MAX72XX::INTENSITY, 3);
  Serial.println("EIT max7219-matrix ready");
}

void loop() {
  draw(SMILE); Serial.println("smile"); delay(1000);
  draw(HEART); Serial.println("heart"); delay(1000);
}
