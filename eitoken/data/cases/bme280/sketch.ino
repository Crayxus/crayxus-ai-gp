// EI TOKEN 案例 · 迷你气象站
// BME280 一次读出温度、湿度和气压
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!bme.begin(0x76) && !bme.begin(0x77)) { Serial.println("BME280 not found at 0x76/0x77"); while (true) delay(1000); }
  Serial.println("EIT bme280 ready");
}

void loop() {
  Serial.print("temp "); Serial.print(bme.readTemperature(), 1);
  Serial.print(" C  humidity "); Serial.print(bme.readHumidity(), 1);
  Serial.print(" %  "); Serial.print(bme.readPressure() / 100.0, 1); Serial.println(" hPa");
  delay(2000);
}
