// EI TOKEN 案例 · OLED 小屏动画
// 0.96 寸 OLED 上画字、画进度条
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
int progress = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { Serial.println("OLED not found at 0x3C"); while (true) delay(1000); }
  Serial.println("EIT oled-ssd1306 ready");
}

void loop() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2);
  oled.setCursor(4, 4);
  oled.print("EI TOKEN");
  oled.setTextSize(1);
  oled.setCursor(4, 34);
  oled.print("loading ");
  oled.print(progress);
  oled.print("%");
  oled.drawRect(4, 48, 120, 10, SSD1306_WHITE);
  oled.fillRect(6, 50, progress * 116 / 100, 6, SSD1306_WHITE);
  oled.display();
  progress = (progress + 5) % 105;
  delay(150);
}
