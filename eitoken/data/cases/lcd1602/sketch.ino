// EI TOKEN 案例 · 1602 屏显示文字
// 在 I2C 液晶屏上显示问候和计时
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // 没字就试试 0x3F

void setup() {
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Hello EI TOKEN");
  Serial.println("EIT lcd1602 ready");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Uptime: ");
  lcd.print(millis() / 1000);
  lcd.print(" s   ");
  delay(1000);
}
